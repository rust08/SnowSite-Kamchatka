import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configurationBound} from '../packages/optimization/configuration-bound.mjs';
import {allocateExact} from '../packages/optimization/allocate.mjs';
import {createSolverSession} from '../workers/milp-python/exact-adapter.mjs';
import {loadNetwork} from '../packages/routing/network-file.mjs';
import {optimize} from '../packages/optimization/optimize.mjs';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const {network,networkMeta}=loadNetwork(new URL('../examples/v43/network.json',import.meta.url),'synthetic-v43');
const scores=r=>r.alternatives.map(a=>[a.configurationId,a.unservedM3,a.transportDistanceMm]);
const ordered=(a,b)=>a[0]-b[0]||a[1]-b[1];
// Independent per-unit recursion, no use of the bound or production constraints builder.
function oracle(demands,sites,costs,q){
 const cap=sites.map(s=>s.availableCapacityM3),trips=sites.map(s=>s.maxTripsDuringHorizon??Infinity);let best=[Infinity,Infinity];
 function go(i,j,left,u,l){
  if(i===demands.length){if(ordered([u,l],best)<0)best=[u,l];return;}
  if(j===sites.length)return go(i+1,0,demands[i+1]?.volumeM3??0,u+left,l);
  for(let x=0;x<=Math.min(left,cap[j]);x++){
   const n=Math.ceil(x/q);if(n>trips[j]||x&&costs[i][j]===null)continue;
   cap[j]-=x;trips[j]-=n;go(i,j+1,left-x,u,l+n*(costs[i][j]??0));cap[j]+=x;trips[j]+=n;
  }
 }
 go(0,0,demands[0].volumeM3,0,0);return best;
}
test('A12b lower bound and strengthened fixed solver versus independent oracle, 72 cases seed 470719',async()=>{
 let state=470719;const rand=n=>((state=(Math.imul(state,1664525)+1013904223)>>>0)%n);
 const session=createSolverSession();try{
  for(let k=0;k<72;k++){
   const sites=Array.from({length:k%9===0?0:3},(_,j)=>({id:'s'+j,accessNodeId:'s'+j,availableCapacityM3:rand(7),maxTripsDuringHorizon:k%3===0?rand(4):null}));
   const demands=Array.from({length:2},(_,i)=>({id:'d'+i,nodeId:'d'+i,volumeM3:rand(7)}));
   const costs=demands.map(()=>sites.map(()=>rand(5)===0?null:rand(11)*(k%2===0?100003:1)));const q=2+rand(4);
   const optimum=oracle(demands,sites,costs,q),b=configurationBound(demands,sites,costs,q);
   assert.ok(ordered([b.unservedM3,b.transportDistanceMm],optimum)<=0,`bound case ${k}`);
   const r=await allocateExact({demands,sites,costs,q},{session,timeLimitMs:10000,sourceTripCuts:true});
   assert.equal(r.status,'optimal',`case ${k}`);assert.deepEqual([r.solution.unservedM3,r.solution.transportDistanceMm],optimum,`case ${k}`);
  }
 }finally{session.close();}
});
async function parity(request){
 const a=await optimize(network,request,{networkMeta});const b=await optimize(network,{...request,policy:{...request.policy,searchStrategy:'bounded_enumeration'}},{networkMeta});
 assert.equal(b.search.rankingStatus,a.search.rankingStatus);assert.deepEqual(scores(b),scores(a));
 if(a.frontier)assert.deepEqual(b.frontier.map(scores),a.frontier.map(scores));
 for(const r of b.frontier??[b]){assert.equal(r.search.evaluated,r.search.proven);assert.equal(r.search.evaluated+r.search.prunedByBound,r.search.configurationsTotal);}
 return b;
}
test('A12b all modes and ties, fixed/excluded memberships, full-service filter, and actual pruning',async()=>{
 for(const name of ['add-2-plus-2','add-3-plus-1','relocate','greenfield','frontier']){
  const r=json('examples/v43/'+name+'.json');r.policy.topK=2;await parity(r);
 }
 const r=json('examples/v43/add-2-plus-2.json');r.policy.topK=2;r.policy.excludedSiteIds=['C1'];r.policy.excludedConfigurations=[['C2','C3','E1','E2']];await parity(r);
 r.policy.requireAllServed=true;r.scenario.demands[0].volumeM3=100;assert.equal((await parity(r)).search.rankingStatus,'infeasible');
 const tie=json('examples/v43/greenfield.json');tie.policy.topK=2;tie.scenario.demands.forEach(d=>d.volumeM3=0);const b=await parity(tie);assert.ok(b.search.prunedByBound>0);
 const positive=json('examples/v43/greenfield.json');positive.policy.topK=2;positive.scenario.demands.forEach(d=>d.volumeM3=1);positive.scenario.sites.forEach(s=>s.availableCapacityM3=20);assert.ok((await parity(positive)).search.prunedByBound>0);
 const e=json('examples/v43/add-2-plus-2.json');e.policy.mode='evaluate';delete e.policy.exactNewSites;await parity(e);
});
test('A12b incomplete enumeration/deadline cannot claim exactness',async()=>{
 const r=json('examples/v43/greenfield.json');r.policy.searchStrategy='bounded_enumeration';r.policy.timeLimitMs=1;
 const a=await optimize(network,r,{networkMeta});assert.notEqual(a.search.rankingStatus,'exact_top_k');assert.equal(a.search.prunedByBound,0);
 const c=new AbortController();c.abort();r.policy.timeLimitMs=5000;const b=await optimize(network,r,{networkMeta,signal:c.signal});assert.equal(b.search.rankingStatus,'incomplete');assert.equal(b.search.prunedByBound,0);
});
test('A12b city reference scores and bounded strategy HTTP, CLI, module parity',async()=>{
 const {startServer}=await import('../apps/api/server.mjs');const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const city=loadNetwork(new URL('../data/snapshots/pkgo-27233df581c6/city-network.json',import.meta.url));
 const r=json('examples/v47/demo-bounded.json');const direct=await optimize(city.network,r,{networkMeta:city.networkMeta});
 assert.equal(direct.search.rankingStatus,'exact_top_k');assert.equal(direct.baseline.transportDistanceMm,159425990);assert.equal(direct.alternatives[0].transportDistanceMm,92228770);assert.equal(direct.alternatives[0].servedM3,228);
 const single=structuredClone(r);single.policy.exactNewSites=1;const one=await optimize(city.network,single,{networkMeta:city.networkMeta});assert.deepEqual(one.alternatives.map(a=>a.transportDistanceMm),[108556350,122648320]);
 const s=startServer(0);await new Promise(resolve=>s.once('listening',resolve));try{
  const response=await fetch(`http://127.0.0.1:${s.address().port}/api/v1/optimize`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(r)});assert.equal(response.status,200);const http=await response.json();
  const {stdout}=await promisify(execFile)(process.execPath,['apps/cli/cli.mjs','examples/v47/demo-bounded.json'],{cwd:new URL('..',import.meta.url)});const cli=JSON.parse(stdout);
  for(const x of [http,cli]){assert.deepEqual(scores(x),scores(direct));assert.deepEqual(x.search,direct.search);assert.equal(x.inputFingerprint,direct.inputFingerprint);assert.equal(x.matrixHash,direct.matrixHash);assert.equal(x.baseline.transportDistanceMm,direct.baseline.transportDistanceMm);}
 }finally{await new Promise(resolve=>s.close(resolve));}
});
test('A12b native integer distance normalization does not weaken exact mm checker',async()=>{
 const {buildMatrix}=await import('../packages/routing/matrix.mjs');const input=json('docs/benchmarks/v43/benchmark-input.json');const {demands,sites}=input.request.scenario;
 const config=[0,1,2,7].map(i=>sites[i]),costs=buildMatrix(input.graph,demands,config,[]);
 const r=await allocateExact({demands,sites:config,costs,q:10},{sourceTripCuts:true});assert.equal(r.status,'optimal');assert.equal(r.solution.transportDistanceMm,100000000);assert.equal(r.stages[1].value,100000000);
});
test('A12b bound cannot certify incomplete catalogue after configuration cap',async()=>{
 const input=json('docs/benchmarks/v43/benchmark-input.json');input.request.policy.searchStrategy='bounded_enumeration';input.request.policy.exactNewSites=4;input.request.policy.topK=1;input.request.policy.timeLimitMs=10000;input.request.scenario.demands.forEach(d=>d.volumeM3=0);
 const r=await optimize(input.graph,input.request);assert.equal(r.search.configurationsTotal,null);assert.equal(r.search.coverage,'restricted_catalogue');assert.notEqual(r.search.rankingStatus,'exact_top_k');assert.equal(r.search.enumerated,1000);
});
