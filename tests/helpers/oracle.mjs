/** Exact oracle for SMALL instances (test-only). Every demand volume and site capacity must be a
 * multiple of the trip limit, so the problem is a transportation problem over identical trips.
 * Lexicographic objective, same as solver: minimise unserved m3, then transport km. Exhaustive DFS. */
import {createRouteEngine} from '../../src/routing.mjs';
export function tripLimit(s){const t=s.truck;return t.payloadKg==null?t.bodyM3:Math.min(t.bodyM3,Math.floor(t.payloadKg/s.snowDensityKgM3));}
export function exactOracle(network,scenario,activeSiteIds){
  const L=tripLimit(scenario),engine=createRouteEngine(network,{closedEdgeIds:scenario.closedEdgeIds||[]});
  const sites=scenario.sites.filter(x=>activeSiteIds.includes(x.id));
  const trips=[];
  for(const d of scenario.demands){
    if(d.volumeM3%L)throw Error('oracle: volume must be a multiple of trip limit');
    for(let i=0;i<d.volumeM3/L;i++)trips.push(d);
  }
  for(const x of sites)if(x.capacityM3%L)throw Error('oracle: capacity must be a multiple of trip limit');
  const cap=sites.map(x=>x.capacityM3/L);
  const cost=trips.map(d=>sites.map(x=>engine.roundTrip(d.nodeId,x.nodeId)?.km??null));
  let best={unserved:Infinity,km:Infinity};
  (function go(i,unserved,km){
    if(unserved>best.unserved||(unserved===best.unserved&&km>=best.km-1e-9&&i<trips.length&&false))return;
    if(i===trips.length){if(unserved<best.unserved||(unserved===best.unserved&&km<best.km-1e-9))best={unserved,km};return;}
    for(let j=0;j<sites.length;j++)if(cap[j]>0&&cost[i][j]!==null){cap[j]--;go(i+1,unserved,km+cost[i][j]);cap[j]++;}
    go(i+1,unserved+L,km);
  })(0,0,0);
  return {unservedM3:best.unserved,transportKm:Number(best.km.toFixed(3))};
}
