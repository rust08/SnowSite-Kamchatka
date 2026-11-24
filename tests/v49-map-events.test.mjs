import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';import {pathToFileURL} from 'node:url';
import {startServer} from '../apps/api/server.mjs';import {installMapDom} from './helpers/map-dom.mjs';

test('v4.9 served app event wiring with real API and DOM/Leaflet harness (not browser E2E)',async()=>{
 const srv=startServer(0);await new Promise(r=>srv.once('listening',r));const base=`http://127.0.0.1:${srv.address().port}`,nativeFetch=globalThis.fetch;
 const dir=await mkdtemp(join(tmpdir(),'snow-map-events-'));let harness;
 try{
  const html=await (await fetch(base+'/')).text();harness=installMapDom(html);
  // Execute exactly the JS bytes served by the API, with their browser-relative module layout.
  await writeFile(join(dir,'package.json'),'{"type":"module"}');
  for(const path of ['app.js','lib/core.js','lib/exact-map.js','lib/routing/engine.mjs','lib/contracts/validate.mjs']){const r=await fetch(base+'/'+path);assert.equal(r.status,200,path);await mkdir(dirname(join(dir,path)),{recursive:true});await writeFile(join(dir,path),Buffer.from(await r.arrayBuffer()));}
  const requests=[];let failExact=false;globalThis.fetch=async(path,options)=>{if(options?.method==='POST')requests.push({path,body:JSON.parse(options.body)});if(failExact&&path==='/api/v1/optimize')return new Response(JSON.stringify({error:'fault injection',code:'internal_error'}),{status:500});return nativeFetch(base+path,options);};
  const $=id=>harness.nodes.get(id),text=id=>$(id).textContent,click=id=>$(id).click(),set=async(id,value,event='input')=>{$(id).value=value;await $(id).dispatch(event);};
  const mod=await import(pathToFileURL(join(dir,'app.js')).href);await mod.ready;
  assert.equal(requests[0].path,'/api/v1/optimize');assert.equal($('variants').children.length,3,text('headline'));assert.match(text('solver-status'),/exact_top_k/);assert.match(text('headline'),/108|пробега/);assert.equal($('solver-status').dataset.tone,'success');assert.equal(text('route-status'),'');
  assert.match(text('composition'),/Кандидат C/);assert.ok(harness.allLayers.some(g=>g.items.some(x=>x.kind==='line'&&x.options.pane==='routes')),'selected routes actually sent to map layer');
  await $('variants').children[0].click();assert.equal(document.activeElement,$('variants').children[0]);assert.match(text('composition'),/^База/);assert.match(text('headline'),/228/);assert.equal(text('route-status'),'');
  await set('new-count','2');assert.equal($('variants').children.length,0);await click('compare');assert.equal(requests.at(-1).body.policy.exactNewSites,2);assert.equal($('variants').children.length,2);await $('variants').children[1].click();assert.match(text('composition'),/Кандидат C.*Кандидат D/);assert.match(text('kpis'),/92,2/);
  await set('new-count','1');await click('compare');await $('variants').children[1].click();$('exclusion-reason').value='условная проверка';await $('exclusion-actions').children.find(x=>x.textContent.startsWith('Отклонить Кандидат C')).click();assert.match(text('composition'),/Кандидат D/);assert.equal(requests.at(-1).body.policy.excludedSiteIds[0].id,'C1');assert.match(requests.at(-1).body.parentScenarioHash,/^[a-f0-9]{64}$/);assert.match(text('exclusions-list'),/условная проверка/);
  await click('export-runs');const saved=JSON.parse(await harness.download.blob.text());assert.ok(saved.runs.length>=2);assert.equal(saved.runs.at(-1).response.parentScenarioHash,saved.runs.at(-2).response.scenarioHash);
  await set('calc-mode','legacy','change');const before=requests.length;await click('compare');assert.equal(requests.length,before,'legacy must not ignore excluded candidate');assert.match(text('stats-status'),/не поддерживает/);
  await set('calc-mode','exact','change');await click('clear-exclusions');await set('calc-mode','legacy','change');await click('compare');assert.equal(requests.at(-1).path,'/api/compare');assert.equal($('variants').children.length,3);assert.match(text('solver-status'),/приближённый/);
  await set('calc-mode','exact','change');failExact=true;await click('compare');assert.equal($('variants').children.length,0);assert.match(text('stats-status'),/Автоматического перехода/);assert.match(text('headline'),/fault injection/);assert.equal(requests.at(-1).path,'/api/v1/optimize');failExact=false;
  await click('edit-btn');await click('tab-truck');await set('speed','33');await click('drawer-close');await click('compare');assert.equal(requests.at(-1).body.scenario.truck.driveKmh,33);assert.match(text('solver-status'),/exact_top_k/);
  // Invalid import is transactional and v1 cannot be silently downgraded.
  const beforeText=text('composition');$('import').files=[{size:100,text:async()=>JSON.stringify(requests.at(-1).body)}];await $('import').dispatch('change');assert.match(text('stats-status'),/Ошибка импорта/);assert.equal(text('composition'),beforeText);
  await click('tab-file');await click('export');const exported=JSON.parse(await harness.download.blob.text());assert.equal(exported.truck.driveKmh,33);assert.equal(exported.mapSettings.count,1);
  // The extended demo is discoverable, confirmed, not an implicit replacement.
  window.confirm=()=>false;const n=requests.length;await click('demo-extended');assert.equal(requests.length,n);
  window.confirm=()=>true;await click('demo-extended');assert.equal(requests.at(-1).body.policy.exactNewSites,2);assert.equal(requests.at(-1).body.policy.topK,5);assert.equal(requests.at(-1).body.scenario.sites.filter(x=>x.origin==='candidate').length,6);assert.equal($('variants').children.length,6);assert.equal($('solver-status').dataset.tone,'success');assert.match(text('solver-status'),/exact_top_k/);assert.equal(text('route-status'),'');
  assert.equal($('demo-extended').disabled,false);assert.equal($('compare').disabled,false);
  // Arrow keys apply to the vertical alternatives list; focus is retained across rerender.
  $('variants').children[0].focus();await $('variants').dispatch('keydown',{key:'ArrowDown'});assert.equal(document.activeElement,$('variants').children[1]);await document.activeElement.click();assert.equal(document.activeElement,$('variants').children[1]);
 }finally{globalThis.fetch=nativeFetch;harness?.restore();await new Promise(r=>srv.close(r));await rm(dir,{recursive:true,force:true});}
});
