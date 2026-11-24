// Repeat the immutable v43 seed719 large fixture; never overwrite old results.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {cpus,platform,release,totalmem} from 'node:os';
import {optimize} from '../src/core/optimize.mjs';
import {hash} from '../src/core/request.mjs';
import {clearMatrixCache} from '../src/core/matrix.mjs';
const input=JSON.parse(readFileSync(new URL('../docs/benchmarks/v43/benchmark-input.json',import.meta.url),'utf8'));
const label=process.argv[2]??'current';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid local benchmark label');
const dest=new URL(`../docs/benchmarks/v45/${label}/`,import.meta.url);mkdirSync(dest,{recursive:true});
const save=(name,value)=>writeFileSync(new URL(name+'.json',dest),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const report={seed:input.seed,graphHash:hash(input.graph),originalInputHash:hash(input.request),node:process.version,platform:platform(),release:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),runs:[]};
for(const strategy of ['enumeration','unified_milp']){
 clearMatrixCache();
 for(const [label,timeLimitMs] of [['cold',5000],['warm',5000],['long',15000]]){
  const request={...input.request,policy:{...input.request.policy,searchStrategy:strategy,timeLimitMs}};
  const t=performance.now(),r=await optimize(input.graph,request),wallMs=performance.now()-t;
  save(`${strategy}-${label}`,r);
  const entry={strategy,label,timeLimitMs,wallMs,matrixMs:r.matrixMs,matrixHash:r.matrixHash,matrixMetrics:r.matrixMetrics,scenarioHash:r.scenarioHash,solverVersion:r.solver.version,search:r.search,stages:r.solver.stages,scores:r.alternatives.map(a=>[a.configurationId,a.unservedM3,a.transportDistanceMm]),responseBytes:Buffer.byteLength(JSON.stringify(r))};
  report.runs.push(entry);console.log(JSON.stringify(entry));
 }
}
save('report',report);
