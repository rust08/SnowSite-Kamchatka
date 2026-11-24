import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createSolverSession} from '../src/solvers/exact-adapter.mjs';
import {decodeAllocation} from '../src/core/allocate.mjs';
const workerPath=fileURLToPath(new URL('./helpers/checkpoint-worker.py',import.meta.url));
const input={demands:[{id:'d',nodeId:'n1',volumeM3:3}],sites:[{id:'s',accessNodeId:'n2',availableCapacityM3:3}],costs:[[3]],q:2};
test('hard deadline recovers latest completed phase, never ranks it optimal',async()=>{
 const s=createSolverSession({workerPath});try{
  const raw=await s.solve({fixture:'two',selection:{}},3000);
  assert.equal(raw.status,'time_limit');assert.equal(raw.stages[2].name,'configurationTie');
  assert.equal(raw.stages[2].status,'time_limit');assert.equal(raw.stages[1].value,6);
  const r=decodeAllocation(input,raw,true);assert.equal(r.solution.transportDistanceMm,6);assert.equal(r.solution.unservedM3,0);
  assert.equal((await s.solve({},50)).allocations,null);
  assert.throws(()=>decodeAllocation(input,{...raw,allocations:[[0,0,2,1]]},true),/verification/i);
 }finally{s.close();}
});
test('checkpoints do not complete a request and cannot leak to next request',async()=>{
 const s=createSolverSession({workerPath});try{
  const a=await s.solve({fixture:'final'},3000);assert.equal(a.status,'optimal');assert.equal(decodeAllocation(input,a).solution.transportDistanceMm,6);
  const b=await s.solve({fixture:'silent'},2000);assert.equal(b.status,'time_limit');assert.equal(b.allocations,null);
 }finally{s.close();}
});
test('malformed checkpoint fails rather than reporting optimum',async()=>{
 const s=createSolverSession({workerPath});try{await assert.rejects(s.solve({fixture:'malformed'},3000),/Invalid worker checkpoint/);}finally{s.close();}
});
test('caller cancellation still aborts without replaying partial work',async()=>{
 const controller=new AbortController(),s=createSolverSession({workerPath,signal:controller.signal});try{
  const promise=s.solve({fixture:'two',selection:{}},3000);setTimeout(()=>controller.abort(),300);
  assert.equal((await promise).allocations,null);
 }finally{s.close();}
});
