import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {dirname,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as api from 'snowsite-kamchatka';
import * as oldApi from '../src/index.mjs';
import * as catalog from 'snowsite-kamchatka/catalog';
import * as oldCatalog from '../src/catalog.mjs';
import {loadNetwork} from 'snowsite-kamchatka/network-file';
import {loadNetwork as oldLoader} from '../src/core/network-file.mjs';
import {startServer} from '../apps/api/server.mjs';
import {startServer as oldServer} from '../src/server.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const path=p=>resolve(root,p);
const json=p=>JSON.parse(readFileSync(path(p),'utf8'));
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
const imports=src=>[...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)].map(m=>m[1]);
test('R1–R4 canonical code has directed boundaries, no back-import into legacy src/apps',()=>{
 const allowed={contracts:['contracts'],routing:['routing','contracts'],catalog:['catalog','contracts'],optimization:['optimization','routing','contracts','workers'],workers:['workers'],'haul-evidence':['haul-evidence']};
 for(const dir of ['packages','workers'])for(const file of walk(path(dir)).filter(p=>p.endsWith('.mjs'))){
  const parts=relative(root,file).split(sep),from=parts[0]==='workers'?'workers':parts[1];
  const source=readFileSync(file,'utf8');
  for(const spec of imports(source)){
   if(spec.startsWith('.')){const target=resolve(dirname(file),spec);assert.ok(existsSync(target),target);const targetParts=relative(root,target).split(sep);assert.ok(['packages','workers'].includes(targetParts[0]),`${file} -> ${spec}`);const to=targetParts[0]==='workers'?'workers':targetParts[1];assert.ok(allowed[from].includes(to),`${from} -> ${to}`);}
   else if(from!=='workers'&&file!==path('packages/routing/network-file.mjs'))assert.ok(!['node:fs','node:http','node:child_process','node:worker_threads'].includes(spec),`${file} -> ${spec}`);
  }
 }
 const checker=readFileSync(path('packages/optimization/verify-result.mjs'),'utf8');assert.ok(imports(checker).every(s=>s.startsWith('../contracts/')),'checker must be independent of solver and optimizer');
});
test('R1–R4 compatibility aliases expose the same functions and typed errors',()=>{
 assert.deepEqual(Object.keys(api),Object.keys(oldApi));for(const k of Object.keys(api))assert.equal(api[k],oldApi[k]);
 assert.deepEqual(Object.keys(catalog),Object.keys(oldCatalog));for(const k of Object.keys(catalog))assert.equal(catalog[k],oldCatalog[k]);
 assert.equal(loadNetwork,oldLoader);assert.equal(startServer,oldServer);
});
test('R4 canonical CLI, old CLI and independent module agree on score and fingerprints',async()=>{
 const request=json('examples/v44/add-2-plus-2.json');
 const {network,networkMeta}=loadNetwork(path('examples/v43/network.json'),'synthetic-v43');
 const expected=await api.optimize(network,request,{networkMeta});
 const score=r=>({scenarioHash:r.scenarioHash,networkHash:r.networkHash,inputFingerprint:r.inputFingerprint,rankingStatus:r.search.rankingStatus,alternatives:r.alternatives.map(x=>[x.configurationId,x.unservedM3,x.transportDistanceMm])});
 const run=promisify(execFile);const args=['--network',path('examples/v43/network.json'),'--network-id','synthetic-v43',path('examples/v44/add-2-plus-2.json')];
 // Run from non-root working directory; resources must resolve relative to code.
 for(const entry of ['apps/cli/cli.mjs','src/cli.mjs']){const {stdout}=await run(process.execPath,[path(entry),...args],{cwd:path('examples')});assert.deepEqual(score(JSON.parse(stdout)),score(expected));}
 assert.equal(expected.search.rankingStatus,'exact_top_k');assert.equal(expected.alternatives[0].transportDistanceMm,56000000);
});
test('R4 canonical static assets and data loaded through HTTP have unchanged content',async()=>{
 const server=startServer(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{for(const file of ['index.html','exact.html','exact.js','lib/core.js','vendor/leaflet.js','terrain-map.webp']){const res=await fetch(base+'/'+file);assert.equal(res.status,200,file);assert.deepEqual(Buffer.from(await res.arrayBuffer()),readFileSync(path('apps/web/'+file)),file);}
 const network=await (await fetch(base+'/api/network')).json();assert.equal(network.version,'pkgo-27233df581c6');assert.deepEqual(await (await fetch(base+'/api/demo')).json(),json('data/fixtures/scenario.demo.json'));}finally{await new Promise(r=>server.close(r));}
});
