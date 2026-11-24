import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {startServer} from '../src/server.mjs';import {optimize} from '../src/core/optimize.mjs';import {loadNetwork} from '../src/core/network-file.mjs';
const request=JSON.parse(readFileSync(new URL('../examples/demo-v1.json',import.meta.url),'utf8'));
const run=promisify(execFile);const cwd=new URL('..',import.meta.url);
const score=r=>({hash:r.scenarioHash,network:r.networkHash,search:r.search,baseline:[r.baseline.servedM3,r.baseline.transportDistanceMm],alternatives:r.alternatives.map(a=>[a.activeSiteIds,a.unservedM3,a.transportDistanceMm])});
test('B19/B21 API module CLI parity, errors, health while solving',async()=>{
 const server=startServer(0);await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;const post=(body,type='application/json',path='/api/v1/optimize')=>fetch(base+path,{method:'POST',headers:{'content-type':type},body});
 try{
  const task=post(JSON.stringify(request));const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.equal((await health.json()).networkHash,request.networkHash);
  const response=await task;assert.equal(response.status,200);const r=await response.json();assert.equal(r.solver.status,'optimal');assert.equal(r.baseline.transportDistanceMm,159425990);assert.equal(r.alternatives[0].transportDistanceMm,92228770);assert.ok(JSON.stringify(r).length<100000);
  const {network,networkMeta}=loadNetwork(new URL('../data/snapshots/pkgo-27233df581c6/city-network.json',import.meta.url));const m=await optimize(network,request,{networkMeta});const {stdout}=await run(process.execPath,['src/cli.mjs','examples/demo-v1.json'],{cwd});assert.deepEqual(score(r),score(m));assert.deepEqual(score(m),score(JSON.parse(stdout)));
  for(const [body,type,status,code] of [['not JSON','application/json',400,'invalid_json'],['{}','text/plain',415,'unsupported_media_type'],[' '.repeat(1024*1024+1),'application/json',413,'resource_limit'],[JSON.stringify({...request,networkVersion:'wrong'}),'application/json',409,'network_mismatch'],[JSON.stringify({...request,policy:{...request.policy,topK:-1}}),'application/json',422,'invalid_input']]){const res=await post(body,type);assert.equal(res.status,status);assert.equal((await res.json()).code,code);}
  const timeout=await post(JSON.stringify({...request,policy:{...request.policy,timeLimitMs:1}}));assert.equal(timeout.status,200);assert.notEqual((await timeout.json()).solver.status,'optimal');
  // Legacy endpoint + HTML + imported demo unchanged; browser E2E is separate.
  const html=await fetch(base+'/');assert.equal(html.status,200);const demo=await (await fetch(base+'/api/demo')).json();const old=await post(JSON.stringify(demo),'application/json','/api/compare');assert.equal(old.status,200);assert.equal((await old.json()).baseline.transportKm,167.098);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
