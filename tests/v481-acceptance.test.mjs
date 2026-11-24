import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {startServer} from '../apps/api/server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const registryFile = join(root,'examples/v44/registry.json');
const request = JSON.parse(readFileSync(join(root,'examples/v43/greenfield.json'),'utf8'));
const cityRequest = JSON.parse(readFileSync(join(root,'examples/demo-v1.json'),'utf8'));
const restorePython = value => {if(value===undefined) delete process.env.SNOW_PYTHON; else process.env.SNOW_PYTHON=value;};
async function withServer(fn){
 const server=startServer(0,{registryFile});
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{return await fn((body,signal,path='/api/v1/optimize')=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal}),base);}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
async function until(check,description){
 const end=Date.now()+10000;
 while(Date.now()<end){if(check())return;await sleep(30);}
 assert.fail('Timed out waiting for '+description);
}
function isAlive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}

test('B21 missing Python returns typed internal failure, no fake solution, CLI and HTTP recover', {timeout:30000}, async()=>{
 const old=process.env.SNOW_PYTHON,temp=mkdtempSync(join(tmpdir(),'snow-missing-'));
 try{
  process.env.SNOW_PYTHON=join(temp,'missing-interpreter');
  await withServer(async(post,base)=>{
   const response=await post(cityRequest);assert.equal(response.status,500);
   assert.deepEqual(await response.json(),{error:'Optimization failed',code:'internal_error',path:''});
   const cli=spawnSync(process.execPath,['apps/cli/cli.mjs','examples/demo-v1.json'],{cwd:root,encoding:'utf8',timeout:10000});
   assert.equal(cli.status,1);assert.deepEqual(JSON.parse(cli.stdout),{error:{code:'internal_error',message:'Optimization failed',path:''}});
   // The legacy Node-only engine and health remain available without Python.
   assert.equal((await fetch(base+'/api/health')).status,200);
   const demo=await (await fetch(base+'/api/demo')).json();
   assert.equal((await post(demo,undefined,'/api/compare')).status,200);
   restorePython(old);
   const recovered=await post(request);assert.equal(recovered.status,200);assert.equal((await recovered.json()).search.rankingStatus,'exact_top_k');
  });
 }finally{restorePython(old);rmSync(temp,{recursive:true,force:true});}
});

test('B07 disconnect cancels an in-flight child and releases the one-request slot', {skip:process.platform==='win32',timeout:40000}, async()=>{
 const old=process.env.SNOW_PYTHON,temp=mkdtempSync(join(tmpdir(),'snow-cancel-'));
 const executable=join(temp,'solver-fixture'),marker=join(temp,'pid');
 // Deliberately stalled subprocess, no fabricated allocation or solver response.
 // Shebang is POSIX-only; actual Windows acceptance is outside this session.
 writeFileSync(executable,`#!/usr/bin/env node\nconst fs=require('node:fs');\nprocess.stdin.once('data',()=>fs.writeFileSync(${JSON.stringify(marker)},String(process.pid)));\nsetInterval(()=>{},1000);\n`,{mode:0o755});
 const controller=new AbortController();let pid;
 try{
  process.env.SNOW_PYTHON=executable;
  await withServer(async(post,base)=>{
   const stalled=post({...request,policy:{...request.policy,timeLimitMs:30000}},controller.signal).then(()=>null,e=>e);
   await until(()=>existsSync(marker)&&Number(readFileSync(marker,'utf8'))>0,'child reading a solver request');
   pid=Number(readFileSync(marker,'utf8'));assert.ok(isAlive(pid));
   const busy=await post(request);assert.equal(busy.status,503);assert.equal((await busy.json()).code,'busy');
   assert.equal((await fetch(base+'/api/health')).status,200);
   controller.abort();assert.equal((await stalled)?.name,'AbortError');
   await until(()=>!isAlive(pid),'child process to exit');
   restorePython(old);
   let response;const end=Date.now()+10000;
   do{response=await post(request);if(response.status!==503)break;await response.text();await sleep(30);}while(Date.now()<end);
   assert.equal(response.status,200);assert.equal((await response.json()).search.rankingStatus,'exact_top_k');
  });
 }finally{controller.abort();restorePython(old);if(!pid&&existsSync(marker))pid=Number(readFileSync(marker,'utf8'));if(pid&&isAlive(pid))process.kill(pid,'SIGKILL');rmSync(temp,{recursive:true,force:true});}
});

test('B09 million m³ is one aggregate assignment; reject over-budget requests', {timeout:30000}, async()=>{
 const r=structuredClone(request);r.scenario.demands[0].volumeM3=1_000_000;r.scenario.sites=[{...r.scenario.sites[0],accessNodeId:'n1',availableCapacityM3:1_000_000}];r.scenario.truck.bodyM3=1;r.policy.exactActiveSites=1;r.policy.topK=1;r.policy.searchStrategy='bounded_enumeration';
 await withServer(async(post)=>{
  const response=await post(r);assert.equal(response.status,200);const body=await response.text(),result=JSON.parse(body);assert.equal(result.search.rankingStatus,'exact_top_k');
  const a=result.alternatives[0];assert.equal(a.servedM3,1_000_000);assert.equal(a.unservedM3,0);assert.equal(a.trips,1_000_000);assert.equal(a.transportDistanceMm,2_000_000_000_000);assert.equal(a.assignments.length,1);assert.equal(a.assignments[0].trips,1_000_000);assert.ok(Buffer.byteLength(body)<15000);
  console.log('B09 compact response bytes:',Buffer.byteLength(body));
  r.scenario.demands.push({...r.scenario.demands[0],id:'over-budget',volumeM3:1});const rejected=await post(r);assert.equal(rejected.status,422);assert.equal((await rejected.json()).code,'resource_limit');
 });
});
