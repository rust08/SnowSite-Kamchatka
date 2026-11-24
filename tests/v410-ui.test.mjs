import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startServer} from '../apps/api/server.mjs';
import {installMapDom} from './helpers/map-dom.mjs';

// Structural checks, not visual layout or browser E2E.
test('v4.10 main map has early solve action, stable unique controls and educational demo',async()=>{
 const html=await readFile(new URL('../apps/web/index.html',import.meta.url),'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const id of ['map','compare','cancel-solve','demo-extended','variants','stats-status','solver-status','new-count','edit-btn','exclusion-reason'])assert.ok(ids.includes(id),id);
 assert.ok(html.indexOf('id="compare"')<html.indexOf('id="variants"'));assert.ok(html.indexOf('id="stats-status"')<html.indexOf('id="variants"'));
 assert.match(html,/<details class="legend">/);assert.match(html,/class="map-key"/);
 const css=await readFile(new URL('../apps/web/style.css',import.meta.url),'utf8');assert.match(css,/\[hidden\]\{display:none!important\}/);assert.match(css,/@media\(max-width:800px\)/);
});

test('v4.10 advanced JSON page uses actual API and downloads the same answer, clears stale download on file change and errors',async()=>{
 const srv=startServer(0);await new Promise(r=>srv.once('listening',r));const base=`http://127.0.0.1:${srv.address().port}`;
 const nativeFetch=globalThis.fetch;const dir=await mkdtemp(join(tmpdir(),'snow-exact-ui-'));let h;
 try{
  const html=await (await nativeFetch(base+'/exact.html')).text();assert.match(html,/href="\/style.css"/);h=installMapDom(html);
  const script=await (await nativeFetch(base+'/exact.js')).text();await writeFile(join(dir,'exact.mjs'),script);
  const sample=await (await nativeFetch(base+'/demo-extended.json')).json();assert.deepEqual(sample,JSON.parse(await readFile(new URL('../examples/v49/map-editor-2plus2.json',import.meta.url),'utf8')));
  const request=JSON.parse(await readFile(new URL('../examples/demo-v1.json',import.meta.url),'utf8'));let apiResponse=null;
  globalThis.fetch=async(path,options)=>{const response=await nativeFetch(base+path,options);if(path==='/api/v1/optimize')apiResponse=await response.clone().json();return response;};
  await import(pathToFileURL(join(dir,'exact.mjs')).href);
  const $=id=>h.nodes.get(id);assert.equal($('run').disabled,true);assert.equal($('download-result').disabled,true);
  $('input').files=[{size:100,text:async()=>JSON.stringify(request)}];await $('input').dispatch('change');assert.equal($('run').disabled,false);
  await $('run').click();assert.equal($('download-result').disabled,false);assert.deepEqual(JSON.parse($('output').textContent),apiResponse);
  await $('download-result').click();assert.deepEqual(JSON.parse(await h.download.blob.text()),apiResponse);assert.equal(h.download.name,'snowsite-result-v1.json');
  $('input').files=[{size:100,text:async()=>'{'}];await $('input').dispatch('change');assert.equal($('download-result').disabled,true);assert.match($('output').textContent,/появится/);
  await $('run').click();assert.equal($('download-result').disabled,true);assert.match($('status').textContent,/Автоматического перехода/);
 }finally{globalThis.fetch=nativeFetch;h?.restore();await new Promise(r=>srv.close(r));await rm(dir,{recursive:true,force:true});}
});
