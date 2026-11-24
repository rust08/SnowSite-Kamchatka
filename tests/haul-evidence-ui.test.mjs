import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {request} from 'node:http';
import {once} from 'node:events';
import {startServer} from '../apps/api/server.mjs';
import {installEvidenceDom,servedLoader,deferred,tick} from './helpers/haul-evidence-dom.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
const fixtures='tests/fixtures/haul-evidence/';
const c=read(fixtures+'carrier.json'),r=read(fixtures+'receiver.json'),golden=read(fixtures+'expected-report.json');
const cObj=()=>JSON.parse(c),rObj=()=>JSON.parse(r),asOf='2026-01-05T00:00:00Z';
const enc=o=>Buffer.from(JSON.stringify(o));
const rawFetch=globalThis.fetch.bind(globalThis), originalCrypto=globalThis.crypto;
let server,base,html,loader;
before(async()=>{server=startServer(0);await once(server,'listening');base='http://127.0.0.1:'+server.address().port;html=await(await rawFetch(base+'/haul-evidence.html')).text();loader=await servedLoader(base,rawFetch);});
after(async()=>{loader?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function withDom(fn){const d=installEvidenceDom(html,base,rawFetch);try{await loader.load();await fn(d);}finally{d.restore();}}
const buffer=b=>Uint8Array.from(b).buffer;
function file(b,name='synthetic.json'){return {name,size:b.length,arrayBuffer:async()=>buffer(b)};}
function select(d,a,b,t=asOf){d.get('carrier-file').files=a?[a]:[];d.get('receiver-file').files=b?[b]:[];d.get('as-of').value=t;}
const click=(d,id)=>d.get(id).click();
const visible=d=>!d.get('result').hidden&&!d.get('export').disabled;
function cleared(d){assert.equal(d.get('result').hidden,true);assert.equal(d.get('export').disabled,true);assert.equal(d.get('inspection').hidden,true);for(const id of ['metadata','diagnostics','totals','pairs','unusable','inspect-ref','inspect-row'])assert.equal(d.get(id).textContent,'',id);assert.equal(d.urls.size,0);}
function texts(d){return ['metadata','diagnostics','totals','pairs','unusable','inspect-ref','inspect-row','status'].map(k=>d.get(k).textContent).join('\n');}
async function exportReport(d){await click(d,'export');const download=d.downloads.at(-1);assert.equal(download.name,'haul-evidence-report.json');assert.equal(download.blob.type,'application/json');assert.equal(d.urls.size,0);assert.ok(d.revoked.includes(download.url));return Buffer.from(await download.blob.arrayBuffer());}
async function revealRefs(d,id='pairs'){for(const detail of d.get(id).all('details')){detail.open=true;await detail.dispatch('toggle');}return d.get(id).all('button').filter(b=>b.className==='ref');}
async function inspectRef(d,role,index,where='pairs'){const refs=await revealRefs(d,where);const node=refs.find(b=>b.textContent.startsWith(role+' / ')&&b.textContent.endsWith('records #'+index));assert.ok(node,`${role} ${index}`);await node.click();return JSON.parse(d.get('inspect-row').textContent);}
function rawRequest(path,method='GET'){return new Promise((resolve,reject)=>{const req=request(base,{path,method},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks),headers:res.headers}));});req.on('error',reject);req.end();});}
// Hashes pinned independently from the accepted A2 archive, not from the modified tree.
const oldStatic={
  "/app.js": "8805a62309c4a1ca5e30a05469cc1118e40863190ed0e4e4967b15721262a68f",
  "/city-context.js": "ce6c174c78261a62936949675780651d0b689c11f21278c99cfd2c9005672746",
  "/exact.html": "5ce7e2c51a9b321ed26f28f07d741d35fdda74506bb2c9fdb29fb0527e0c3fac",
  "/exact.js": "469b450316470538a9d24ae06490e721c98ff18b423ea1978d3cfb8df3fb7ebf",
  "/index.html": "13627904cb2a9df134a766dfc8bdb710c154a148dc66acb80939521891aff848",
  "/lib/core.js": "681175dadc853f5d987085e387b149c2d852df139fce31f03a0a41bc37d0a7a5",
  "/lib/exact-map.js": "361636f86a8f831ddafda1c65e932efa5e7285dbae64d82718ef6b275e3eac1a",
  "/style.css": "f8e9ee8ecc2ccf7c07016532b9b6136736359457edcdc479df54d12de14add37",
  "/terrain-map.webp": "901099622dca7eab5d803b5b204e9eb2245ca1d96528330507af4b1e353cc5a9",
  "/vendor/leaflet-LICENSE.txt": "bbc959aaef7488b38942e7f05cfd1244351f8bce54261951ea17dd7cf60f894b",
  "/vendor/leaflet.css": "337bfca5cabd03b39815b2700febe2b3b7edf55921c59cd49f88ecb328212303",
  "/vendor/leaflet.js": "db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a"
};
test('C17/C19 actual HTTP: exact six modules, demo bytes, MIME, old assets/API, no broad access',async()=>{
  for(const name of ['index','validate','reconcile','report','parse','bytes']){const res=await rawRequest(`/lib/haul-evidence/${name}.mjs`);assert.equal(res.status,200);assert.equal(res.headers['content-type'],'text/javascript; charset=utf-8');assert.deepEqual(res.body,read(`packages/haul-evidence/${name}.mjs`));}
  for(const [path,type] of [['/haul-evidence.html','text/html'],['/haul-evidence.js','text/javascript'],['/haul-evidence.css','text/css'],['/haul-evidence-demo/carrier.json','application/json'],['/haul-evidence-demo/receiver.json','application/json']]){const res=await rawRequest(path);assert.equal(res.status,200,path);assert.equal(res.headers['content-type'],type+'; charset=utf-8');assert.deepEqual(res.body,read('apps/web'+path));}
  assert.deepEqual((await rawRequest('/haul-evidence-demo/carrier.json')).body,c);assert.deepEqual((await rawRequest('/haul-evidence-demo/receiver.json')).body,r);
  for(const [path,hash] of Object.entries(oldStatic)){const res=await rawRequest(path);assert.equal(res.status,200,path);const body=path==='/index.html'?Buffer.from(res.body.toString().replace('    <a class="ghost" href="/haul-evidence.html">Snow Haul Evidence</a>\n','')):res.body;assert.equal(digest(body),hash,path);}
  const home=(await rawRequest('/')).body;assert.deepEqual(home,read('apps/web/index.html'));assert.match(home.toString(),/href="\/haul-evidence\.html"/);assert.match(home.toString(),/id="map"/);assert.match(html,/href="\/"/);assert.match(html,/Только синтетические данные/);assert.match(html,/полнота не подтверждена/);
  for(const [path,p] of [['/lib/routing/engine.mjs','packages/routing/engine.mjs'],['/lib/contracts/validate.mjs','packages/contracts/validate.mjs']])assert.deepEqual((await rawRequest(path)).body,read(p));
  const health=JSON.parse((await rawRequest('/api/health')).body);assert.deepEqual(health,{ok:true,version:'snow-site-0.1',apiVersion:'1.0',networkId:'pkgo',networkHash:'0e0a464f7d92057fa5bbad634c083ad0c1923294597d989ead386b393acf7ad2',networkVersion:'pkgo-27233df581c6'});
  for(const [path,p] of [['/api/network','data/snapshots/pkgo-27233df581c6/city-network.json'],['/api/demo','data/fixtures/scenario.demo.json'],['/demo-extended.json','examples/v49/map-editor-2plus2.json']])assert.deepEqual(JSON.parse((await rawRequest(path)).body),JSON.parse(read(p)));
  assert.equal(JSON.parse((await rawRequest('/api/v1/networks')).body).schemaVersion,'1.0');
  for(const path of ['/lib/haul-evidence/','/lib/haul-evidence/missing.mjs','/lib/haul-evidence/haul-evidence.synthetic.v0.1.schema.json','/packages/haul-evidence/index.mjs','/lib/haul-evidence/%2e%2e/%2e%2e/packages/haul-evidence/index.mjs','/lib/haul-evidence/..%2f..%2fpackages%2fhaul-evidence%2findex.mjs','/lib/haul-evidence/%5c..%5cindex.mjs','/haul-evidence-demo/expected-report.json','/tests/fixtures/haul-evidence/expected-report.json'])assert.ok([400,404].includes((await rawRequest(path)).status),path);
  for(const method of ['POST','PUT','HEAD','DELETE','OPTIONS'])assert.equal((await rawRequest('/lib/haul-evidence/index.mjs',method)).status,405,method);
});
test('C17/C20 executed served UI demo: exact golden, all status counters, refs and download cleanup',async()=>withDom(async d=>{
  cleared(d);await click(d,'demo');assert.ok(visible(d));assert.equal(d.get('as-of').value,asOf);assert.deepEqual(await exportReport(d),golden);assert.equal(d.calls.length,2);assert.deepEqual(d.calls.map(x=>x.path),['/haul-evidence-demo/carrier.json','/haul-evidence-demo/receiver.json']);
  for(const s of ['synthetic','unverified','DEMO-C1-JAN',asOf,'2026-01-01T00:00:00Z','2026-02-01T00:00:00Z','lateReceiptCount','unknownReceiptCount','matched_records','quantity_mismatch','scope_mismatch','not_observed_in_source','both_cancelled','review_history','out_of_scope','history_conflict','invalid','carrier-demo','receiver-demo',digest(c),digest(r),'nominal','-1'])assert.ok(texts(d).includes(s),s);
  assert.deepEqual(await inspectRef(d,'carrier',1),cObj().records[0]);assert.ok(d.get('inspect-ref').textContent.includes(digest(c)));assert.equal(d.document.activeElement,d.get('inspect-row'));assert.deepEqual(await inspectRef(d,'receiver',13),rObj().records[12]);assert.ok(!(await revealRefs(d)).some(x=>x.textContent==='carrier / carrier-demo / records #11'));
  await click(d,'close-inspect');assert.equal(d.get('inspect-row').textContent,'');await click(d,'reset');cleared(d);assert.equal(d.get('as-of').value,'');
}));
test('C19/C20 manual reversed roles, same dataset IDs, hostile literals, invalid revision, unusable and late exclusion',async()=>withDom(async d=>{
  const a=cObj(),b=rObj();a.datasetId=b.datasetId='same <img src=x onerror=alert(1)>';a.records=[{...a.records[0],ticket:'<script>alert(1)</script>',quantity:'0'},null,{...a.records[0],ticket:'bad-revision',revision:12345},{...a.records[0],ticket:'LATE_SECRET_NOT_RENDERED',receivedAt:'2026-01-06T00:00:00Z'},{...a.records[0],ticket:'outside',eventAt:'2025-12-31T00:00:00Z'}];b.records=[{...a.records[0]}];
  const ab=Buffer.from(JSON.stringify(a).replace('"revision":12345','"revision":1.00000000000000001'));const bb=enc(b);select(d,file(bb,'<img>'),file(ab,'<script>'));await click(d,'run');assert.ok(visible(d));assert.ok(texts(d).includes('Слот перевозчика → receiver'));assert.ok(texts(d).includes('<script>alert(1)</script>'));assert.ok(texts(d).includes('out_of_scope'));assert.ok(texts(d).includes('invalid_identity'));assert.ok(texts(d).includes('unknown_receipt'));assert.ok(texts(d).includes('Объём: 0'));assert.ok(!texts(d).includes('LATE_SECRET_NOT_RENDERED'));assert.equal(d.get('pairs').all('script').length,0);assert.equal(d.get('metadata').all('img').length,0);
  assert.equal((await inspectRef(d,'carrier',3)).revision,null);assert.equal(await inspectRef(d,'carrier',2,'unusable'),null);assert.equal((await inspectRef(d,'receiver',1)).ticket,a.records[0].ticket);assert.ok(d.get('inspect-ref').textContent.includes(digest(bb)));assert.equal((await inspectRef(d,'carrier',1)).ticket,a.records[0].ticket);assert.ok(d.get('inspect-ref').textContent.includes(digest(ab)));assert.ok(!(await revealRefs(d)).some(x=>x.textContent.endsWith('records #4')));
  const report=JSON.parse(await exportReport(d));assert.equal(report.datasets.carrier.datasetId,report.datasets.receiver.datasetId);assert.equal(report.datasets.carrier.sha256,digest(ab));assert.equal(report.datasets.receiver.sha256,digest(bb));assert.equal(d.calls.length,0);assert.ok(!JSON.stringify(report).includes('LATE_SECRET_NOT_RENDERED'));
}));
test('C18 failures atomic and recovery: missing, size before reads, failed read, byte/JSON/cutoff, crypto absent/failure',async()=>withDom(async d=>{
  await click(d,'demo');assert.ok(visible(d));select(d,file(c),null);await click(d,'run');cleared(d);assert.match(d.get('status').textContent,/оба файла/);
  let reads=0;const large={size:2097153,arrayBuffer(){reads++;throw Error('should not read');}};const counted={size:r.length,arrayBuffer(){reads++;return buffer(r);}};select(d,large,counted);await click(d,'run');cleared(d);assert.equal(reads,0);assert.match(d.get('status').textContent,/2 МиБ/);
  for(const [a,t,pattern] of [[{size:1,arrayBuffer:async()=>{throw Error('PRIVATE ERROR');}},asOf,/прочитать/],[file(Buffer.from([0xc0,0xaf])),asOf,/UTF-8/],[file(Buffer.from('{')),asOf,/JSON/],[file(c),'2026-01-05',/UTC/],[file(r),asOf,/допустимую пару/]]){select(d,a,file(r),t);await click(d,'run');cleared(d);assert.match(d.get('status').textContent,pattern);assert.ok(!texts(d).includes('PRIVATE ERROR'));}
  select(d,file(c),file(r));d.setCrypto(undefined);await click(d,'run');cleared(d);assert.match(d.get('status').textContent,/Web Crypto/);d.setCrypto({subtle:{digest:async()=>{throw Error('PRIVATE HASH FAILURE');}}});await click(d,'run');cleared(d);assert.match(d.get('status').textContent,/SHA-256/);d.setCrypto(originalCrypto);await click(d,'run');assert.deepEqual(await exportReport(d),golden);
  d.setFetch(async()=>({ok:false}));await click(d,'demo');cleared(d);assert.match(d.get('status').textContent,/демонстрационные/);d.setFetch(rawFetch);await click(d,'demo');assert.ok(visible(d));
}));
test('C18 synchronous invalidation on each input/cutoff, reset and new run; stale read success/rejection ignored',async()=>withDom(async d=>{
  for(const [id,event] of [['carrier-file','change'],['receiver-file','input'],['as-of','input']]){await click(d,'demo');await inspectRef(d,'carrier',1);await d.get(id).dispatch(event);cleared(d);}
  for(const reject of [false,true])for(const id of ['carrier-file','receiver-file','as-of']){const gate=deferred();select(d,{size:c.length,arrayBuffer:()=>gate.promise},file(r));const pending=click(d,'run');await d.get(id).dispatch('change');cleared(d);const status=d.get('status').textContent;if(reject)gate.reject(Error('stale failure'));else gate.resolve(buffer(c));await pending;cleared(d);assert.equal(d.get('status').textContent,status);}
  const gate=deferred();select(d,{size:c.length,arrayBuffer:()=>gate.promise},file(r));const pending=click(d,'run');await click(d,'reset');gate.resolve(buffer(c));await pending;cleared(d);
}));
test('C18 double run with stale adapter success/rejection and cutoff changes; only latest can expose report',async()=>withDom(async d=>{
  for(const reject of [false,true]){const gate=deferred(),started=deferred();d.setCrypto({subtle:{digest(...args){started.resolve();return gate.promise.then(()=>originalCrypto.subtle.digest(...args));}}});select(d,file(c),file(r));const old=click(d,'run');await started.promise;cleared(d);d.setCrypto(originalCrypto);select(d,file(c),file(r),'2026-01-04T00:00:00Z');await click(d,'run');const fresh=await exportReport(d);assert.equal(JSON.parse(fresh).asOf,'2026-01-04T00:00:00Z');const status=d.get('status').textContent;if(reject)gate.reject(Error('stale digest'));else gate.resolve();await old;assert.deepEqual(await exportReport(d),fresh);assert.equal(d.get('status').textContent,status);}
  for(const reject of [false,true]){const gate=deferred(),started=deferred();d.setCrypto({subtle:{digest(...args){started.resolve();return gate.promise.then(()=>originalCrypto.subtle.digest(...args));}}});select(d,file(c),file(r));const pending=click(d,'run');await started.promise;d.get('as-of').value='2026-01-03T00:00:00Z';await d.get('as-of').dispatch('input');if(reject)gate.reject(Error('old'));else gate.resolve();await pending;cleared(d);}d.setCrypto(originalCrypto);
}));
test('C18 demo/manual crossing: stale demo response arrayBuffer success/rejection and stale manual read',async()=>withDom(async d=>{
  for(const reject of [false,true]){const gate=deferred(),started=deferred();d.setFetch(async url=>({ok:true,arrayBuffer(){started.resolve();return gate.promise.then(()=>buffer(url.endsWith('carrier.json')?c:r));}}));const old=click(d,'demo');await started.promise;select(d,file(c),file(r),'2026-01-04T00:00:00Z');await click(d,'run');const fresh=await exportReport(d);if(reject)gate.reject(Error('stale demo'));else gate.resolve();await old;assert.deepEqual(await exportReport(d),fresh);}
  d.setFetch(rawFetch);for(const reject of [false,true]){const gate=deferred();select(d,{size:c.length,arrayBuffer:()=>gate.promise},file(r));const old=click(d,'run');await click(d,'demo');if(reject)gate.reject(Error('stale manual'));else gate.resolve(buffer(c));await old;assert.deepEqual(await exportReport(d),golden);}
}));
test('C20 bounded pages expose every pair and ref, no silent truncation; stale detached controls harmless',async()=>withDom(async d=>{
  const a=cObj(),b=rObj();a.records=Array.from({length:55},(_,i)=>({...a.records[0],ticket:`P${String(i).padStart(3,'0')}`}));b.records=[];select(d,file(enc(a)),file(enc(b)));await click(d,'run');assert.ok(visible(d));assert.match(d.get('pairs').textContent,/Страница 1 \/ 3 · всего 55/);const next=()=>d.get('pairs').all('button').find(b=>b.textContent==='Далее');await next().click();assert.match(d.get('pairs').textContent,/P025/);await next().click();assert.match(d.get('pairs').textContent,/P054/);assert.equal(next().disabled,true);assert.equal(JSON.parse(await exportReport(d)).pairs.length,55);const detached=(await revealRefs(d))[0];await click(d,'reset');await detached.click();cleared(d);
  const many=cObj();many.records=Array.from({length:55},()=>({...many.records[0]}));select(d,file(enc(many)),file(enc(b)));await click(d,'run');await revealRefs(d);const buttons=d.get('pairs').all('button').filter(b=>b.textContent==='Далее');assert.equal(buttons.length,2);await buttons[1].click();const refs=d.get('pairs').all('button').filter(b=>b.className==='ref');assert.ok(refs.some(x=>x.textContent.endsWith('records #26')));await buttons[1].click(); // detached page control still belongs to same report; may page forward
  assert.ok(d.get('pairs').textContent.includes('records #55'));
}));
test('C18 stale slot-mapping digest cannot publish or clear a newer result',async()=>withDom(async d=>{
  for(const reject of [false,true]){let count=0;const gate=deferred(),started=deferred();d.setCrypto({subtle:{digest(...args){if(++count===3){started.resolve();return gate.promise.then(()=>originalCrypto.subtle.digest(...args));}return originalCrypto.subtle.digest(...args);}}});select(d,file(c),file(r));const old=click(d,'run');await started.promise;cleared(d);d.setCrypto(originalCrypto);await click(d,'demo');const fresh=await exportReport(d);if(reject)gate.reject(Error('stale mapping'));else gate.resolve();await old;assert.deepEqual(await exportReport(d),fresh);}
}));
test('C20 unusable and grouped totals pages remain accessible',async()=>withDom(async d=>{
 const a=cObj(),b=rObj();a.records=Array.from({length:55},()=>null);b.records=Array.from({length:55},(_,i)=>({...b.records[0],ticket:`G${i}`,site:`S${String(i).padStart(3,'0')}`}));select(d,file(enc(a)),file(enc(b)));await click(d,'run');assert.ok(visible(d));const next=(id)=>d.get(id).all('button').find(x=>x.textContent==='Далее'&&!x.disabled);await next('unusable').click();await next('unusable').click();assert.match(d.get('unusable').textContent,/records #55/);assert.equal(await inspectRef(d,'carrier',55,'unusable'),null);await next('totals').click();await next('totals').click();assert.ok(d.get('totals').textContent.includes('S054'));const report=JSON.parse(await exportReport(d));assert.equal(report.unusableRows.carrier.length,55);assert.equal(report.totals.knownActive.receiver.length,55);
}));
test('C19 source safety assertions and explicit local-only UI dependencies',()=>{
  const js=read('apps/web/haul-evidence.js').toString();assert.doesNotMatch(js,/\b(?:innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB|sendBeacon|XMLHttpRequest|WebSocket|eval)\b/);assert.doesNotMatch(html,/\son\w+\s*=|https?:\/\//i);assert.match(js,/parseEvidenceJson\(decodeEvidenceBytes/);assert.match(js,/serializeEvidenceReport\(current\.report\)/);assert.doesNotMatch(js,/\bJSON\.parse\(/);assert.match(html,/for="as-of"/);assert.match(html,/type="text" maxlength="24"/);assert.match(html,/role="status"/);assert.match(html,/Декодированное представление/);
});
