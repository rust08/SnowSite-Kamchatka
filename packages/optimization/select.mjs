import {checkObjectiveBudget,decodeAllocation} from './allocate.mjs';
import {verifyConfiguration} from './verify-result.mjs';

export const isNewSite=(v,t)=>t.origin==='candidate'&&!v.groups.some(g=>g.siteIds.includes(t.id));
// Legacy config ordering uses JSON.stringify(sorted raw IDs). Binary inclusion
// priority matches that order if the JSON-encoded tokens preserve raw ordering.
export function tieOrder(sites){
 const indices=sites.map((_,i)=>i).sort((a,b)=>sites[a].id<sites[b].id?-1:1);
 const encoded=indices.map(i=>JSON.stringify(sites[i].id));
 return encoded.every((x,i)=>i===0||encoded[i-1]<x)?indices:null;
}
export function makeSelection(v,count,previous){
 const {sites,p,groups,fixed,exclusions,excludedConfigs}=v;
 const indices=ids=>ids.map(id=>sites.findIndex(t=>t.id===id));
 const all=sites.map((_,i)=>i),fresh=all.filter(i=>isNewSite(v,sites[i]));
 const fixedIndices=indices([...fixed]);
 const excluded=all.filter(i=>exclusions.has(sites[i].id)||p.mode==='evaluate'&&!fixed.has(sites[i].id));
 const cardinalities=groups.map(g=>({indices:indices(g.siteIds),lower:g.lower,upper:g.upper}));
 if(count!=null)cardinalities.push({indices:fresh,lower:count,upper:count});
 if(p.exactActiveSites!=null)cardinalities.push({indices:all,lower:p.exactActiveSites,upper:p.exactActiveSites});
 return {fixed:fixedIndices,excluded,cardinalities,excludedSets:[...excludedConfigs.keys()].map(k=>indices(JSON.parse(k))).concat(previous.map(a=>indices(a.activeSiteIds))),requireAllServed:!!p.requireAllServed,tieOrder:tieOrder(sites)};
}
export async function selectExact(v,count,previous,costs,{session,timeLimitMs}){
 const {sites,demands,q}=v,selection=makeSelection(v,count,previous);
 if(!selection.tieOrder)throw Error('Unsupported configuration tie ordering');
 checkObjectiveBudget(demands,costs);
 const r=await session.solve({demands:demands.map(d=>d.volumeM3),capacities:sites.map(t=>t.availableCapacityM3),tripLimits:sites.map(t=>t.maxTripsDuringHorizon??null),costs,q,selection},timeLimitMs);
 if(r.status==='infeasible'){
  if(r.allocations!==null||r.stages.length!==1||r.stages[0].status!=='infeasible'||r.stages[0].name!=='unservedM3')throw Error('Invalid infeasibility status');
  return {...r,solution:null};
 }
 if(r.allocations===null){if(r.status!=='time_limit')throw Error('Missing solver incumbent');return {...r,solution:null};}
 if(!['optimal','time_limit'].includes(r.status))throw Error('Unexpected selection solver status');
 if(!Array.isArray(r.selected)||new Set(r.selected).size!==r.selected.length||r.selected.some(j=>!Number.isInteger(j)||j<0||j>=sites.length))throw Error('Invalid selected site indices');
 const idx=[...r.selected].sort((a,b)=>sites[a].id<sites[b].id?-1:1),config=idx.map(j=>sites[j]);
 verifyConfiguration(v,config,count);
 if(previous.some(a=>a.configurationId===JSON.stringify(config.map(t=>t.id))))throw Error('Duplicate selected configuration');
 const rows=r.allocations.map(([i,j,x,n])=>[i,idx.indexOf(j),x,n]); // -1 is rejected by independent checker
 const result=decodeAllocation({demands,sites:config,costs:costs.map(row=>idx.map(j=>row[j])),q},{...r,allocations:rows},true);
 if(selection.requireAllServed&&result.solution.unservedM3!==0)throw Error('Incomplete service in full-service selection');
 const tie=-selection.tieOrder.reduce((a,j,i)=>a+(idx.includes(j)?2**(sites.length-1-i):0),0);
 if(r.status==='optimal'&&Math.abs(r.stages[2].value-tie)>1e-5)throw Error('Configuration tie objective verification failed');
 return {...result,config};
}
