// Slow non-pruning reference on the frozen seed719 fixture. Independent
// configuration enumeration; reuses checked fixed-allocation MILP (not an
// independent integer solver). Run after benchmark-v47 with a fresh label.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {buildMatrix} from '../packages/routing/matrix.mjs';
import {validateRequest} from '../packages/contracts/request.mjs';
import {allocateExact} from '../packages/optimization/allocate.mjs';
import {createSolverSession} from '../workers/milp-python/exact-adapter.mjs';
const input=JSON.parse(readFileSync(new URL('../docs/benchmarks/v43/benchmark-input.json',import.meta.url),'utf8'));
const label=process.argv[2]??'complete-reference';if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid label');
const dest=new URL(`../docs/benchmarks/v47/${label}/`,import.meta.url);mkdirSync(dest,{recursive:true});
const v=validateRequest(input.graph,input.request),{demands,sites,q}=v;
const matrix=buildMatrix(input.graph,demands,sites,[]),fixed=sites.map((s,j)=>v.fixed.has(s.id)?j:-1).filter(j=>j>=0),optional=sites.map((s,j)=>v.fixed.has(s.id)?-1:j).filter(j=>j>=0);
if(fixed.length!==2||optional.length!==28||q!==10||input.request.policy.exactNewSites!==2||v.exclusions.size||v.groups.length)throw Error('Expected frozen 2+2 reference');
const start=performance.now(),session=createSolverSession(),scores=[];
try{for(let a=0;a<optional.length;a++)for(let b=a+1;b<optional.length;b++){
 if(performance.now()-start>120000)throw Error('Reference total deadline exceeded');
 const idx=[...fixed,optional[a],optional[b]],config=idx.map(j=>sites[j]);
 let result;try{result=await allocateExact({demands,sites:config,costs:matrix.map(row=>idx.map(j=>row[j])),q},{session,timeLimitMs:10000,sourceTripCuts:true});}catch(e){console.error("Failed config",config.map(s=>s.id));throw e;}
 if(result.status!=='optimal')throw Error('Reference configuration incomplete');
 scores.push([JSON.stringify(config.map(s=>s.id).sort()),result.solution.unservedM3,result.solution.transportDistanceMm]);
}}finally{session.close();}
scores.sort((a,b)=>a[1]-b[1]||a[2]-b[2]||(a[0]<b[0]?-1:a[0]>b[0]?1:0));
const result={count:scores.length,wallMs:performance.now()-start,top5:scores.slice(0,5),scores};
writeFileSync(new URL('reference.json',dest),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({count:result.count,wallMs:result.wallMs,top5:result.top5}));
