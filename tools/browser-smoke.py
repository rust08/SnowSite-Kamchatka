"""Optional actual browser regression: Linux/Windows, starts a disposable local API.
Install tools/browser-requirements.txt and playwright install chromium. On systems
with installed Chromium, set SNOW_CHROMIUM to its executable. No network service.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
url = f'http://127.0.0.1:{port}'
env = {**os.environ, 'PORT': str(port)}
env.pop('SNOW_OPEN', None)
proc = subprocess.Popen(['node', str(ROOT / 'apps/api/server.mjs')], cwd=ROOT, env=env)
try:
    for _ in range(100):
        if proc.poll() is not None:
            raise RuntimeError('API exited during startup')
        try:
            with urlopen(url + '/api/health', timeout=0.5) as r:
                if r.status == 200:
                    break
        except OSError:
            time.sleep(0.1)
    else:
        raise RuntimeError('API not ready')
    with sync_playwright() as p:
        options = {'headless': True}
        if os.getenv('SNOW_CHROMIUM'):
            options['executable_path'] = os.environ['SNOW_CHROMIUM']
        browser = p.chromium.launch(**options)
        print('Chromium', browser.version, flush=True)
        page = browser.new_page(viewport={'width': 1366, 'height': 768})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url)
        expect(page.locator('#variants button')).to_have_count(3, timeout=30000)
        expect(page.locator('#map')).to_be_visible()
        expect(page.locator('#calc-mode')).to_have_value('exact')
        expect(page.locator('#solver-status')).to_contain_text('exact_top_k')
        expect(page.locator('#composition')).to_contain_text('Кандидат C')
        expect(page.locator('#kpis')).to_contain_text('108,6 км')
        expect(page.locator('#route-status')).to_have_text('')
        assert page.locator('.route-label').count() > 0
        page.locator('#variants button').first.focus()
        page.keyboard.press('Enter')
        expect(page.locator('#variants button').first).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('#composition')).to_contain_text('База')
        expect(page.locator('#kpis')).to_contain_text('159,4 км')
        page.locator('#new-count').fill('2')
        with page.expect_request(lambda r: r.url.endswith('/api/v1/optimize') and r.method == 'POST') as request:
            page.locator('#compare').click()
        assert request.value.post_data_json['policy']['exactNewSites'] == 2
        expect(page.locator('#variants button')).to_have_count(2, timeout=30000)
        page.locator('#variants button').nth(1).click()
        expect(page.locator('#kpis')).to_contain_text('92,2 км')
        page.locator('#new-count').fill('1')
        page.locator('#compare').click()
        expect(page.locator('#variants button')).to_have_count(3, timeout=30000)
        page.locator('#variants button').nth(1).click()
        page.locator('#exclusions-panel summary').click()
        page.locator('#exclusion-reason').fill('учебная проверка')
        with page.expect_request(lambda r: r.url.endswith('/api/v1/optimize') and r.method == 'POST') as request:
            page.locator('#exclusion-actions button').first.click()
        assert request.value.post_data_json['policy']['excludedSiteIds'][0]['id'] == 'C1'
        assert request.value.post_data_json['parentScenarioHash']
        expect(page.locator('#variants button')).to_have_count(2, timeout=30000)
        expect(page.locator('#composition')).to_contain_text('Кандидат D')
        expect(page.locator('#exclusions-list')).to_contain_text('учебная проверка')
        page.locator('#clear-exclusions').click()
        page.locator('#edit-btn').click()
        expect(page.locator('#drawer')).to_be_visible()
        page.locator('#tab-truck').click()
        page.locator('#speed').fill('33')
        page.locator('#speed').blur()
        page.locator('#drawer-close').click()
        with page.expect_request(lambda r: r.url.endswith('/api/v1/optimize') and r.method == 'POST') as request:
            page.locator('#compare').click()
        assert request.value.post_data_json['scenario']['truck']['driveKmh'] == 33
        expect(page.locator('#stats-status')).to_have_text('Готово: точный рейтинг', timeout=30000)
        page.locator('#edit-btn').click()
        page.locator('#tab-file').click()
        page.locator('#import').set_input_files(str(ROOT / 'examples/v49/map-editor-2plus2.json'))
        expect(page.locator('#stats-status')).to_contain_text('Сценарий загружен')
        page.locator('#drawer-close').click()
        expect(page.locator('#new-count')).to_have_value('2')
        page.locator('#compare').click()
        expect(page.locator('#variants button')).to_have_count(6, timeout=30000)
        expect(page.locator('#solver-status')).to_contain_text('exact_top_k')
        expect(page.locator('#route-status')).to_have_text('')
        print('PASS exact map, route labels, keyboard, count, exclusion, speed, 2+2 import', flush=True)
        page.locator('#calc-mode').select_option('legacy')
        page.locator('#compare').click()
        expect(page.locator('#stats-status')).to_have_text('Готово (legacy)', timeout=30000)
        expect(page.locator('#solver-status')).to_contain_text('приближённый')
        print('PASS explicit legacy switch', flush=True)
        # Actual layout checks only in an authorized browser environment.
        expect(page.locator('#compare')).to_be_visible()
        assert page.locator('#compare').evaluate("e=>!!(e.compareDocumentPosition(document.querySelector('#variants')) & Node.DOCUMENT_POSITION_FOLLOWING)")
        page.once('dialog', lambda d: d.accept())
        page.locator('#demo-extended').click()
        expect(page.locator('#variants button')).to_have_count(6, timeout=30000)
        expect(page.locator('#solver-status')).to_have_attribute('data-tone', 'success')
        expect(page.locator('#new-count')).to_have_value('2')
        page.locator('#variants button').first.focus()
        page.keyboard.press('ArrowDown')
        page.keyboard.press('Enter')
        expect(page.locator('#variants button').nth(1)).to_be_focused()
        for width,height in [(1366,768),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            expect(page.locator('#map')).to_be_visible()
        page.set_viewport_size({'width':1366,'height':768})
        print('PASS responsive workspace and confirmed extended demo', flush=True)
        page.goto(url + '/exact.html')
        page.locator('#input').set_input_files(str(ROOT / 'examples/demo-v1.json'))
        page.locator('#run').click()
        expect(page.locator('#status')).to_contain_text('exact_top_k', timeout=30000)
        expect(page.locator('#download-result')).to_be_enabled()
        with page.expect_download() as download:
            page.locator('#download-result').click()
        assert download.value.suggested_filename == 'snowsite-result-v1.json'
        result = json.loads(page.locator('#output').text_content())
        assert result['alternatives'][0]['transportDistanceMm'] == 92228770
        assert result['baseline']['transportDistanceMm'] == 159425990
        assert not errors, errors
        print('PASS exact file upload, API solve, baseline and best, no page errors', flush=True)
        browser.close()
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
