// Same pinned input + budget as v4.3; do not overwrite historical benchmark.
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {cpus,platform,release,totalmem} from 'node:os';
import {optimize} from '../src/core/optimize.mjs';
import {hash} from '../src/core/request.mjs';
import {clearMatrixCache} from '../src/core/matrix.mjs';
import {loadNetwork} from '../src/core/network-file.mjs';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const target=new URL('../docs/benchmarks/v44/',import.meta.url),save=(name,v)=>writeFileSync(new URL(name,target),JSON.stringify(v,null,2)+'\n');
const pinned=json('docs/benchmarks/v43/benchmark-input.json'),city=loadNetwork(new URL('../data/snapshots/pkgo-27233df581c6/city-network.json',import.meta.url),'pkgo'),small=loadNetwork(new URL('../examples/v43/network.json',import.meta.url),'synthetic-v43');
const cases=[['small',small.network,json('examples/v43/add-2-plus-2.json'),small.networkMeta],['city',city.network,json('examples/demo-v1.json'),city.networkMeta],['large',pinned.graph,pinned.request,undefined]];
const report={seed:pinned.seed,node:process.version,platform:platform(),release:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),cases:[]};
for(const [name,network,request,networkMeta] of cases){const summary={name,originalInputHash:hash(request),timeLimitMs:request.policy.timeLimitMs,methods:[]};for(const strategy of ['enumeration','unified_milp']){const input={...request,policy:{...request.policy,searchStrategy:strategy}};clearMatrixCache();const before=process.memoryUsage().rss,t=performance.now(),r=await optimize(network,input,{networkMeta});const wallMs=performance.now()-t;save(`${name}-${strategy}.json`,r);summary.methods.push({strategy,scenarioHash:r.scenarioHash,matrixHash:r.matrixHash,rankingStatus:r.search.rankingStatus,counterScope:r.search.counterScope,evaluated:r.search.evaluated,proven:r.search.proven,total:r.search.configurationsTotal,topK:r.alternatives.length,wallMs,matrixMs:r.matrixMs,nodeRssBeforeBytes:before,nodeRssAfterBytes:process.memoryUsage().rss,responseBytes:Buffer.byteLength(JSON.stringify(r)),solverVersion:r.solver.version,scores:r.alternatives.map(a=>[a.configurationId,a.unservedM3,a.transportDistanceMm])});}report.cases.push(summary);save('benchmark-report.json',report);console.log(JSON.stringify(summary,null,2));}
