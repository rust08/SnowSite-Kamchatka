import {createSolverSession} from '../../workers/milp-python/exact-adapter.mjs';
import {verifyAllocation} from './verify-result.mjs';
import {requireValid} from '../contracts/validate.mjs';
export function checkObjectiveBudget(demands,costs){
 // Conservative upper bound on objective: at most one trip per cubic metre.
 const total=demands.reduce((a,d)=>a+d.volumeM3,0), maxCost=Math.max(0,...costs.flat().filter(x=>x!==null));
 requireValid(Number.isSafeInteger(total*maxCost)&&total*maxCost<=1e13,'Distance objective exceeds safe numerical budget','matrix','resource_limit');
}
export function decodeAllocation({demands,sites,costs,q},r,selection=false){
 if(r.allocations===null)return {...r,solution:null};
 const v=verifyAllocation({demands,sites,costs,q},r.allocations);
 const expected=['unservedM3','transportDistanceMm','configurationTie'];
 if(r.status==='optimal'&&(r.stages.length!==(selection?3:2)||r.stages.some((s,i)=>s.status!=='optimal'||!Number.isFinite(s.value)||s.name!==expected[i])))throw Error('Solver objective verification failed');
 for(const [i,value] of [v.unservedM3,v.transportDistanceMm].entries()){
  const stage=r.stages[i];if(stage?.status==='optimal'&&(!Number.isFinite(stage.value)||stage.name!==expected[i]||Math.abs(stage.value-value)>1e-5))throw Error('Solver objective verification failed');
 }
 return {...r,solution:{...v,assignments:r.allocations.map(([i,j,x,n])=>({demandId:demands[i].id,siteId:sites[j].id,volumeM3:x,trips:n,tripCapacityM3:q,roundtripMm:costs[i][j],sameNode:demands[i].nodeId===sites[j].accessNodeId,routeRef:{from:demands[i].nodeId,to:sites[j].accessNodeId}}))}};
}
export async function allocateExact({demands,sites,costs,q},{session,timeLimitMs=10000,signal,sourceTripCuts=false}={}){
 checkObjectiveBudget(demands,costs);
 const owned=!session;session??=createSolverSession({signal});
 try{
  const r=await session.solve({demands:demands.map(d=>d.volumeM3),capacities:sites.map(s=>s.availableCapacityM3),tripLimits:sites.map(s=>s.maxTripsDuringHorizon??null),costs,q,...(sourceTripCuts?{sourceTripCuts:true}:{})},timeLimitMs);
  return decodeAllocation({demands,sites,costs,q},r);
 }finally{if(owned)session.close();}
}
