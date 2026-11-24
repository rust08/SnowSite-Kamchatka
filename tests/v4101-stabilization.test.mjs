import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {startServer} from '../apps/api/server.mjs';
import {compareSites} from '../packages/optimization/legacy.mjs';
import {loadNetwork} from '../packages/routing/network-file.mjs';
import {truckCapacity} from '../packages/contracts/validate.mjs';
import {sanitizeScenario,buildExactRequest,defaultSettings} from '../apps/web/lib/exact-map.js';
import {aggregateTrips,nextId,validateTruckField} from '../apps/web/lib/core.js';
import {installMapDom} from './helpers/map-dom.mjs';

const demo=()=>JSON.parse(readFileSync(new URL('../data/fixtures/scenario.demo.json',import.meta.url),'utf8'));
const {network,networkMeta}=loadNetwork(fileURLToPath(new URL('../data/snapshots/pkgo-27233df581c6/city-network.json',import.meta.url)),'pkgo');
const health={networkId:networkMeta.id,networkVersion:networkMeta.version,networkHash:networkMeta.hash};
const variants=[
 ['zero',s=>s.sites.forEach(t=>t.maxTripsDuringHorizon=0),'sites'],
 ['snow mismatch',s=>{s.demands.forEach(d=>d.snowType='with_reagents');s.sites.forEach(t=>t.acceptedSnowTypes=['clean']);},'demands'],
 ['both',s=>{s.demands.forEach(d=>d.snowType='with_reagents');s.sites.forEach(t=>{t.acceptedSnowTypes=['clean'];t.maxTripsDuringHorizon=0;});},'demands'],
 ['empty accepted list',s=>s.sites[0].acceptedSnowTypes=[],'sites'],
 ['positive cap',s=>s.sites[0].maxTripsDuringHorizon=1,'sites'],
 ['internal distance zero',s=>s.sites[0].intraSiteRoundtripMm=0,'sites'],
 ['access profiles',s=>s.accessProfiles={loaded:{blockedEdgeIds:['edge']}},'accessProfiles'],
 ['screening',s=>s.sites[0].screening={status:'prohibited'},'sites'],
 ['policy',s=>s.policy={requireAllServed:false},'policy'],
 ['map policy',s=>s.mapSettings={count:2},'mapSettings'],
 ['schema',s=>s.schemaVersion='1.0','schemaVersion'],
 ['truck density',s=>s.truck.snowDensityKgM3=700,'truck'],
 ['limiting evidence',s=>s.sites[0].tripLimitEvidence={sourceRef:'x'},'sites'],
 ['flattened policy',s=>s.exactNewSites=0,'exactNewSites'],
];
const reject=(e,path)=>e.code==='unsupported_model'&&e.status===422&&typeof e.path==='string'&&e.path.includes(path);

test('R01 module rejects each unsupported semantic field; neutral unknown/null and metadata preserve legacy demo',()=>{
 for(const [label,mutate,path] of variants){const s=demo();mutate(s);assert.throws(()=>compareSites(network,s),e=>reject(e,path),label);}
 const s=demo(),expected=compareSites(network,s);s.demands[0].snowType='unknown';s.sites[0].acceptedSnowTypes=null;s.sites[0].maxTripsDuringHorizon=null;s.sites[0].intraSiteRoundtripMm=null;s.accessProfiles=null;s.policy=null;s.meta={comment:'metadata'};s.assumptionDate='2026-11-21';assert.deepEqual(compareSites(network,s),expected);
 assert.throws(()=>compareSites(network,buildExactRequest(demo(),defaultSettings(),health)),e=>reject(e,'schemaVersion'));
});

test('R01 HTTP typed 422, including meaningful empty/zero; exact unchanged; ordinary legacy works',async()=>{
 const server=startServer(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{const post=async(path,s)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(s)});return {status:r.status,body:await r.json()};};
  for(const [label,mutate,path] of variants){const s=demo();s.assumptionDate='2026-11-21';mutate(s);const a=await post('/api/compare',s);assert.equal(a.status,422,label);assert.equal(a.body.code,'unsupported_model',label);assert.ok(a.body.path.includes(path),label);assert.equal(a.body.baseline,undefined,label);
   if(['zero','snow mismatch','both'].includes(label)){const b=await post('/api/v1/optimize',buildExactRequest(s,defaultSettings(),health));assert.equal(b.status,200,JSON.stringify(b.body));assert.equal(b.body.baseline.servedM3,0);assert.equal(b.body.baseline.trips,0);assert.ok(b.body.alternatives.every(v=>v.servedM3===0&&v.trips===0));}
  }
  const b=await post('/api/compare',demo());assert.equal(b.status,200);assert.equal(b.body.baseline.servedM3,228);assert.equal(b.body.baseline.trips,26);
 }finally{await new Promise(r=>server.close(r));}
});

test('R02 standalone import checks root/nested version and hash, including conflict; retains supplied binding only',()=>{
 const v=health.networkVersion,h=health.networkHash;
 const cases=[{networkVersion:'old'},{networkHash:'a'.repeat(64)},{meta:{networkVersion:'old'}},{meta:{networkHash:'a'.repeat(64)}},{networkVersion:v,meta:{networkVersion:'old'}},{networkHash:h,meta:{networkHash:'b'.repeat(64)}},{networkVersion:'',meta:{networkVersion:v}},{meta:{networkHash:123}}];
 for(const fields of cases){const raw={...demo(),...fields},before=structuredClone(raw);assert.throws(()=>sanitizeScenario(raw,network,health),/сет|привяз|сним|network/i,JSON.stringify(fields));assert.deepEqual(raw,before);}
 const old=sanitizeScenario(demo(),network,health);assert.equal(old.networkVersion,undefined);assert.equal(old.networkHash,undefined);
 for(const fields of [{networkVersion:v,networkHash:h},{meta:{networkVersion:v,networkHash:h}},{networkVersion:v,networkHash:h,meta:{networkVersion:v,networkHash:h}}]){const clean=sanitizeScenario({...demo(),...fields},network,health);assert.equal(clean.networkVersion,v);assert.equal(clean.networkHash,h);}
 assert.throws(()=>sanitizeScenario({...demo(),networkHash:h},network),/сет|привяз|сним|network/i);
 const partial=sanitizeScenario({...demo(),networkVersion:v},network,health);assert.equal(partial.networkVersion,v);assert.equal(partial.networkHash,undefined);
});

test('R03 tuple keys distinguish delimiters/quotes/Unicode and still aggregate identical pairs',()=>{
 const trip=(d,s,n)=>({demandId:d,siteId:s,volumeM3:n,km:2,outward:{km:1},home:{km:1}});
 const result=aggregateTrips([trip('x|y','z',3),trip('x','y|z',4),trip('x|y','z',5),trip('雪|"','ё',1),trip('雪','"|ё',2)]);
 assert.equal(result.length,4);const row=(d,s)=>result.find(x=>x.demandId===d&&x.siteId===s);assert.equal(row('x|y','z').volumeM3,8);assert.equal(row('x|y','z').trips,2);assert.equal(row('x','y|z').volumeM3,4);assert.equal(row('雪|"','ё').volumeM3,1);assert.equal(row('雪','"|ё').volumeM3,2);
});

test('R04 bounded unique ID generation at safe-integer limit, and ordinary monotonic behavior',()=>{
 const ids=['CUSER9007199254740991','CUSER9007199254740992',...Array.from({length:70},(_,i)=>'CUSER'+(i+1))];
 const url=new URL('../apps/web/lib/core.js',import.meta.url).href;
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {nextId} from ${JSON.stringify(url)}; console.log(nextId('CUSER',${JSON.stringify(ids)}));`],{timeout:1200,encoding:'utf8'});
 assert.equal(child.error,undefined,child.error?.message);assert.equal(child.status,0,child.stderr);assert.match(child.stdout.trim(),/^CUSER\d+$/);assert.ok(!ids.includes(child.stdout.trim()));assert.equal(nextId('CUSER',['CUSER1','CUSER4']),'CUSER5');assert.equal(nextId('CUSER',['CUSER1','CUSER5']),'CUSER6');
});

test('R05 truck fields agree with canonical bounds, import validates IDs and paired truck values',()=>{
 const rules={bodyM3:[1,1e6,true],payloadKg:[1,1e6,true],snowDensityKgM3:[1,1e6,true],driveKmh:[0.1,200,false],rateRubPerHour:[0,1e7,false]};
 for(const [field,[min,max,integer]] of Object.entries(rules))for(const value of [min,max,min-(integer?1:0.01),max+(integer?1:0.01),0.5,'',null]){
  const raw=value==null?'':String(value),parsed=raw===''?null:Number(raw),t={bodyM3:10,driveKmh:20,payloadKg:null,snowDensityKgM3:null,rateRubPerHour:null};t[field]=parsed;
  if(field==='payloadKg')t.snowDensityKgM3=parsed===null?null:1;
  if(field==='snowDensityKgM3')t.payloadKg=parsed===null?null:1e6;
  let expected=true;try{truckCapacity(t);}catch{expected=false;}
  assert.equal(validateTruckField(field,raw).ok,expected,`${field}=${value}`);
  const s=demo();s.truck={bodyM3:t.bodyM3,driveKmh:t.driveKmh,payloadKg:t.payloadKg,rateRubPerHour:t.rateRubPerHour};s.snowDensityKgM3=t.snowDensityKgM3;
  if(expected)assert.doesNotThrow(()=>sanitizeScenario(s,network,health));else assert.throws(()=>sanitizeScenario(s,network,health));
 }
 for(const n of [200,201])for(const kind of ['demands','sites','scenario']){const s=demo();if(kind==='scenario')s.id='x'.repeat(n);else s[kind][0].id='x'.repeat(n);if(n===200){const clean=sanitizeScenario(s,network,health);assert.equal(kind==='scenario'?clean.id:clean[kind][0].id,'x'.repeat(n));}else assert.throws(()=>sanitizeScenario(s,network,health));}
 for(const [payload,density] of [[null,500],[500,null],[499,500]]){const s=demo();s.truck.payloadKg=payload;s.snowDensityKgM3=density;assert.throws(()=>sanitizeScenario(s,network,health));}
 const html=readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8');for(const [id,min,max,step] of [['body',1,1e6,'1'],['payload',1,1e6,'1'],['density',1,1e6,'1'],['speed',0.1,200,'any'],['rate',0,1e7,'any']]){const tag=html.match(new RegExp(`<input[^>]+id="${id}"[^>]*>`))[0];assert.equal(Number(tag.match(/\bmin="([^"]+)"/)?.[1]),min,id);assert.equal(Number(tag.match(/\bmax="([^"]+)"/)?.[1]),max,id);assert.equal(tag.match(/\bstep="([^"]+)"/)?.[1],step,id);}
});

test('R02/R05 actual served map harness: mismatches leave scenario/settings/results untouched; paired inputs block dispatch',async()=>{
 const server=startServer(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`,nativeFetch=globalThis.fetch;
 const dir=await mkdtemp(join(tmpdir(),'snow-v4101-'));let harness;
 try{harness=installMapDom(await (await nativeFetch(base+'/')).text());await writeFile(join(dir,'package.json'),'{"type":"module"}');
  for(const path of ['app.js','lib/core.js','lib/exact-map.js','lib/routing/engine.mjs','lib/contracts/validate.mjs']){const r=await nativeFetch(base+'/'+path);assert.equal(r.status,200);await mkdir(dirname(join(dir,path)),{recursive:true});await writeFile(join(dir,path),Buffer.from(await r.arrayBuffer()));}
  const requests=[];globalThis.fetch=(path,options)=>{if(options?.method==='POST')requests.push({path,body:JSON.parse(options.body)});return nativeFetch(base+path,options);};
  const $=id=>harness.nodes.get(id),text=id=>$(id).textContent,click=id=>$(id).click(),set=async(id,v)=>{$(id).value=v;await $(id).dispatch('input');};
  const imported=async raw=>{$('import').files=[{size:100,text:async()=>JSON.stringify(raw)}];await $('import').dispatch('change');};
  await (await import(pathToFileURL(join(dir,'app.js')).href)).ready;
  assert.ok($('variants').children.length>0);const before={composition:text('composition'),headline:text('headline'),variants:$('variants').children.length,count:$('new-count').value,speed:$('speed').value};const n=requests.length;
  for(const meta of [{networkVersion:'different'},{networkHash:'0'.repeat(64)},{networkVersion:health.networkVersion,meta:{networkVersion:'old'}},{networkHash:health.networkHash,meta:{networkHash:'0'.repeat(64)}}]){
   const raw={...demo(),...meta,mapSettings:{...defaultSettings(),count:2}};raw.truck.driveKmh=40;await imported(raw);assert.match(text('stats-status'),/Ошибка импорта/);assert.equal(text('composition'),before.composition);assert.equal(text('headline'),before.headline);assert.equal($('variants').children.length,before.variants);assert.equal($('new-count').value,before.count);assert.equal($('speed').value,before.speed);assert.equal(requests.length,n);
  }
  await imported(demo());assert.match(text('pick-help'),/привяз|сним/i);assert.match(text('pick-help'),/не указ|отсутств|нет/i);
  await imported({...demo(),meta:{networkVersion:health.networkVersion,networkHash:health.networkHash}});assert.match(text('stats-status'),/загружен/);await click('export');const saved=JSON.parse(await harness.download.blob.text());assert.equal(saved.networkVersion,health.networkVersion);assert.equal(saved.networkHash,health.networkHash);
  await set('payload','');let prior=requests.length;await click('compare');assert.equal(requests.length,prior);assert.equal($('payload').getAttribute('aria-invalid'),'true');assert.equal($('density').getAttribute('aria-invalid'),'true');
  await set('payload','499');await click('compare');assert.equal(requests.length,prior);await set('density','');await set('payload','');await set('speed','0.5');await click('compare');assert.equal(requests.length,prior+1);assert.equal(requests.at(-1).body.scenario.truck.driveKmh,0.5);assert.equal(requests.at(-1).body.scenario.truck.payloadKg,null);assert.equal($('density').getAttribute('aria-invalid'),'false');
 }finally{globalThis.fetch=nativeFetch;harness?.restore();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
