import {compatible} from '../contracts/constraints.mjs';
// Independent arithmetic verification of a fixed-configuration allocation.
export function verifyAllocation({demands,sites,costs,q},allocations){
 const fail=message=>{throw new Error('Invalid solver result: '+message);};
 const used=sites.map(()=>0),siteTrips=sites.map(()=>0),served=demands.map(()=>0),seen=new Set();let distance=0,trips=0;
 if(!Array.isArray(allocations))fail('allocations');
 for(const a of allocations){
  if(!Array.isArray(a)||a.length!==4)fail('row');const [i,j,x,n]=a;
  if(!a.every(Number.isSafeInteger)||i<0||i>=demands.length||j<0||j>=sites.length||x<=0||n!==Math.ceil(x/q)||costs[i][j]===null||!compatible(demands[i],sites[j])||seen.has(`${i}:${j}`))fail('pair, reachability or trip count');
  seen.add(`${i}:${j}`);used[j]+=x;siteTrips[j]+=n;served[i]+=x;distance+=n*costs[i][j];trips+=n;
  if(!Number.isSafeInteger(distance)||!Number.isSafeInteger(trips))fail('overflow');
 }
 if(used.some((v,j)=>v>sites[j].availableCapacityM3)||served.some((v,i)=>v>demands[i].volumeM3))fail('capacity or demand');
 if(siteTrips.some((n,j)=>sites[j].maxTripsDuringHorizon!=null&&n>sites[j].maxTripsDuringHorizon))fail('site trip limit');
 const servedM3=served.reduce((a,b)=>a+b,0),unservedM3=demands.reduce((a,b)=>a+b.volumeM3,0)-servedM3;
 return {used,siteTrips,served,servedM3,unservedM3,transportDistanceMm:distance,trips};
}

// Check selected catalogue membership and policy independently of enumeration.
export function verifyConfiguration(v,config,count){
 const ids=config.map(x=>x.id),selected=new Set(ids);
 const fail=message=>{throw Error('Invalid configuration: '+message);};
 if(selected.size!==ids.length||ids.some(x=>!v.sites.some(s=>s.id===x)||v.exclusions.has(x))||[...v.fixed].some(x=>!selected.has(x)))fail('membership/fixed/exclusion');
 if(v.excludedConfigs.has(JSON.stringify([...ids].sort())))fail('excluded configuration');
 for(const g of v.groups){const n=g.siteIds.filter(x=>selected.has(x)).length;if(n<g.lower||n>g.upper)fail('replacement group');}
 const fresh=config.filter(t=>t.origin==='candidate'&&!v.groups.some(g=>g.siteIds.includes(t.id))).length;
 if(count!=null&&fresh!==count||v.p.exactActiveSites!=null&&ids.length!==v.p.exactActiveSites||v.p.mode==='evaluate'&&ids.length!==v.fixed.size)fail('cardinality');
}

// Check serialized solution arithmetic, including aggregates and estimated motion costs.
export function verifySolution(input,solution,truck){
 const {demands,sites,costs,q}=input;
 const rows=solution.assignments.map(a=>{
  const i=demands.findIndex(d=>d.id===a.demandId),j=sites.findIndex(s=>s.id===a.siteId);
  if(i<0||j<0||a.roundtripMm!==costs[i][j]||a.tripCapacityM3!==q||a.routeRef?.from!==demands[i].nodeId||a.routeRef?.to!==sites[j].accessNodeId)throw Error('Invalid solver result: assignment metadata');
  if(a.sameNode!==(demands[i].nodeId===sites[j].accessNodeId))throw Error('Invalid sameNode flag');
  const siteDistance=sites[j].intraSiteRoundtripMm;
  if(a.intraSiteRoundtripMm!==siteDistance)throw Error('Invalid intra-site distance');
  if(input.directions){const legs=input.directions[i][j];if(!legs||a.loadedDistanceMm!==legs.loadedDistanceMm||a.emptyDistanceMm!==legs.emptyDistanceMm||legs.intraSiteRoundtripMm!==siteDistance||a.loadedDistanceMm+a.emptyDistanceMm+(siteDistance??0)!==a.roundtripMm)throw Error('Invalid directed distances');}
  return [i,j,a.volumeM3,a.trips];
 });
 const v=verifyAllocation(input,rows);
 for(const k of ['servedM3','unservedM3','transportDistanceMm','trips'])if(solution[k]!==v[k])throw Error('Invalid solution aggregate '+k);
 if(JSON.stringify(solution.activeSiteIds)!==JSON.stringify(sites.map(s=>s.id).sort()))throw Error('Invalid solution activeSiteIds');
 if(solution.siteUtilization.length!==sites.length||sites.some((s,j)=>!solution.siteUtilization.some(u=>u.siteId===s.id&&u.usedM3===v.used[j]&&u.capacityM3===s.availableCapacityM3&&((u.usedTrips===undefined&&s.maxTripsDuringHorizon==null)||u.usedTrips===v.siteTrips[j])&&((u.maxTripsDuringHorizon===undefined&&s.maxTripsDuringHorizon==null)||u.maxTripsDuringHorizon===(s.maxTripsDuringHorizon??null)))))throw Error('Invalid utilization');
 const km=v.transportDistanceMm/1e6,minutes=km/truck.driveKmh*60,cost=truck.rateRubPerHour==null?null:minutes/60*truck.rateRubPerHour;
 if(!Number.isFinite(minutes)||cost!==null&&!Number.isFinite(cost)||solution.transportKm!==km||solution.estimatedDriveMinutes!==minutes||solution.estimatedDriveCostRub!==cost)throw Error('Invalid distance/time/cost');
 return true;
}
