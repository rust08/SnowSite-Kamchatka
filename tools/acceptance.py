"""Local/CI acceptance runner. No downloads, no publication, no implicit browser pass."""
import argparse
from datetime import datetime, timezone
from importlib.metadata import version, PackageNotFoundError
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent

def installed(name):
    try:
        return version(name)
    except PackageNotFoundError:
        return None

def capture(command):
    try:
        return subprocess.check_output(command, cwd=ROOT, stderr=subprocess.STDOUT,
                                       timeout=10, text=True).strip()
    except (OSError, subprocess.SubprocessError):
        return None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['core', 'browser', 'all'], default='all')
    parser.add_argument('--output', required=True, type=Path,
                        help='new report directory; existing results are never overwritten')
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    env = {**os.environ, 'SNOW_PYTHON': sys.executable}
    # Use direct commands (no shell or npm.cmd resolution differences on Windows).
    gates = [
        ('manifest', ['node', 'tools/check-manifest.mjs'], 60, 'core'),
        ('graph', ['node', 'tools/check-data.mjs'], 60, 'core'),
        ('tests', ['node', '--test', 'tests/*.test.mjs'], 600, 'core'),
        ('contracts', [sys.executable, 'tools/check-contracts.py'], 180, 'core'),
        ('browser', [sys.executable, 'tools/browser-smoke.py'], 180, 'browser'),
    ]
    # Expand paths ourselves: Node 22 and Windows shell glob semantics differ.
    gates[2][1][2:] = [p.relative_to(ROOT).as_posix() for p in sorted((ROOT/'tests').glob('*.test.mjs'))]
    report = {
        'schemaVersion': '1.0', 'scope': args.mode,
        'startedAt': datetime.now(timezone.utc).isoformat(),
        'platform': {'system': platform.system(), 'release': platform.release(),
                     'machine': platform.machine(), 'python': platform.python_version(),
                     'node': capture(['node', '--version']),
                     'scipy': installed('scipy'), 'numpy': installed('numpy'),
                     'jsonschema': installed('jsonschema'), 'playwright': installed('playwright')},
        'gitHead': capture(['git', 'rev-parse', 'HEAD']),
        'gates': [], 'status': 'running',
    }
    def save():
        (out/'report.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    save()
    for name, cmd, timeout, scope in gates:
        item = {'name': name, 'status': 'not_run'}
        report['gates'].append(item)
        if args.mode != 'all' and scope != args.mode:
            save()
            continue
        log = out/f'{name}.txt'
        started = time.monotonic()
        print(f'Running {name}', flush=True)
        with log.open('wb') as f:
            try:
                p = subprocess.run(cmd, cwd=ROOT, env=env, stdout=f, stderr=subprocess.STDOUT,
                                   timeout=timeout, check=False)
                item.update(status='pass' if p.returncode == 0 else 'fail', exitCode=p.returncode)
            except subprocess.TimeoutExpired:
                item.update(status='timeout', exitCode=None)
                f.write(b'\nAcceptance gate timed out.\n')
            except OSError as exc:
                item.update(status='error', exitCode=None)
                f.write((str(exc)+'\n').encode('utf-8'))
        item.update(log=log.name, elapsedSeconds=round(time.monotonic()-started, 3))
        print(f'{name}: {item["status"]}', flush=True)
        save()
    report['status'] = 'pass' if all(g['status'] in ('pass','not_run') for g in report['gates']) else 'fail'
    report['finishedAt'] = datetime.now(timezone.utc).isoformat()
    save()
    print(f'Scope {args.mode}: {report["status"]}; report: {out}', flush=True)
    return 0 if report['status']=='pass' else 1

if __name__ == '__main__':
    sys.exit(main())
