// Lexicographic lower bound for a fixed configuration. Relax shared capacities
// and trip slots between sources when computing individual possible service.
// Distance bound is conditional on full service (U=0); otherwise zero is safe.
// Caller validates nonnegative integer costs and the objective budget.
export function configurationBound(demands,sites,costs,q){
 const capacities=sites.map(s=>Math.min(s.availableCapacityM3,(s.maxTripsDuringHorizon??Infinity)*q));
 const total=demands.reduce((a,d)=>a+d.volumeM3,0);
 let sourceDeficit=0,fullDistance=0;
 for(let i=0;i<demands.length;i++){
  const volume=demands[i].volumeM3; if(!volume)continue;
  let reachableCapacity=0,cheapest=Infinity;
  for(let j=0;j<sites.length;j++)if(costs[i][j]!==null&&capacities[j]>0){
   reachableCapacity+=capacities[j];cheapest=Math.min(cheapest,costs[i][j]);
  }
  sourceDeficit+=Math.max(0,volume-reachableCapacity);
  if(cheapest!==Infinity)fullDistance+=Math.ceil(volume/q)*cheapest;
 }
 const unservedM3=Math.max(sourceDeficit,total-capacities.reduce((a,b)=>a+b,0),0);
 return {unservedM3,transportDistanceMm:unservedM3===0?fullDistance:0,configurationId:JSON.stringify(sites.map(s=>s.id).sort())};
}
