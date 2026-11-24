import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
const timedOut=()=>({status:'time_limit',allocations:null,stages:[{name:'unknown_or_not_started',status:'time_limit',bound:null,value:null,gap:null}]});
const worker=fileURLToPath(new URL('./worker.py',import.meta.url));
export class SolverError extends Error {constructor(message){super(message);this.name='SolverError';}}
// Sequential requests on a single child. Hard deadline kills worker including startup.
export function createSolverSession({python=process.env.SNOW_PYTHON|| (process.platform==='win32'?'python':'python3'),signal,workerPath=worker}={}){
 const child=spawn(python,['-u',workerPath],{stdio:['pipe','pipe','pipe'],env:{...process.env,OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1'},windowsHide:true});
 const lines=createInterface({input:child.stdout});let pending=null,closed=false,stderr='',failure=null;
 function finish(err,value){const p=pending;pending=null;if(!p)return;clearTimeout(p.timer);err?p.reject(err):p.resolve(value);}
 function shutdown(useCheckpoint=false){if(closed)return;closed=true;signal?.removeEventListener('abort',abort);lines.close();child.stdin.destroy();child.kill();finish(null,useCheckpoint&&pending?.checkpoint?pending.checkpoint:timedOut());}
 function close(){shutdown();}
 function abort(){close();}
 signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)close();
 child.stderr.on('data',b=>{stderr=(stderr+b).slice(-4000);});
 child.on('error',e=>{failure=new SolverError('Worker start failed: '+e.message);finish(failure);});
 child.stdin.on('error',e=>{if(!closed){failure=new SolverError('Worker input failed: '+e.message);finish(failure);}});
 child.on('exit',(code)=>{if(!closed){failure=new SolverError(`Worker exited (${code}): ${stderr}`);finish(failure);}});
 lines.on('line',line=>{if(!pending)return;try{const r=JSON.parse(line);if(Object.hasOwn(r,'checkpoint')){
   const c=r.checkpoint,n=c?.stages?.length;
   const names=['unservedM3','transportDistanceMm','configurationTie'];
   if(c?.status!=='time_limit'||!Array.isArray(c.allocations)||!Array.isArray(c.stages)||![2,3].includes(n)||n>(pending.selection?3:2)||c.stages.some((s,i)=>s.name!==names[i]||(i===n-1?s.status!=='time_limit':s.status!=='optimal'||!Number.isFinite(s.value)))||n<=(pending.checkpoint?.stages.length??0))throw new SolverError('Invalid worker checkpoint');
   pending.checkpoint=c;return;
  }if(r.status==='error')throw new SolverError(r.message);finish(null,r);}catch(e){finish(e);close();}});
 function solve(input,timeLimitMs){
  if(failure)return Promise.reject(failure);
  if(closed||timeLimitMs<=0)return Promise.resolve(timedOut());
  if(pending)return Promise.reject(new SolverError('Concurrent solver call'));
  return new Promise((resolve,reject)=>{pending={resolve,reject,selection:!!input.selection,checkpoint:null,timer:setTimeout(()=>shutdown(true),timeLimitMs)};child.stdin.write(JSON.stringify({...input,timeLimitMs:Math.max(1,timeLimitMs-(input.selection?Math.min(150,Math.max(25,Math.floor(timeLimitMs/10))):25))})+'\n');});
 }
 return {solve,close};
}
