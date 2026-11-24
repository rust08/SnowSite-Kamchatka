import {createRouteEngine} from './engine.mjs';
import {performance} from 'node:perf_hooks';
import {compatible} from '../contracts/constraints.mjs';
import {hash} from '../contracts/request.mjs';
import {requireValid} from '../contracts/validate.mjs';
// Matrix cache: at most 8 small (max public shape 50×30) matrices per JS process,
// 120 s TTL. HTTP request workers are isolated; cache is for repeated JS work in one process.
const cache=new Map(),TTL=120000,MAX_ENTRIES=8;
export function clearMatrixCache(){cache.clear();}
export function buildMatrix(network,demands,sites,closedEdgeIds=[],{deadline=Infinity,signal,loadedClosed=closedEdgeIds,emptyClosed=closedEdgeIds,directions,graphHash,profileHash=null,useCache=true,metrics}={}){
 if(performance.now()>=deadline||signal?.aborted)return null;
 const key=useCache?hash({version:'directed-mm-v3',graphHash:graphHash??hash(network),networkVersion:network.version,profileHash,loadedClosed:[...loadedClosed].sort(),emptyClosed:[...emptyClosed].sort(),demands:demands.map(d=>[d.nodeId,d.snowType??null]),sites:sites.map(t=>[t.accessNodeId,t.acceptedSnowTypes??null,Object.hasOwn(t,'intraSiteRoundtripMm')?[t.intraSiteRoundtripMm]:[]])}):null;
 const hit=key&&cache.get(key);if(hit&&performance.now()-hit.created<TTL){cache.delete(key);cache.set(key,hit);if(metrics){metrics.cacheHit=true;metrics.routeStarts=0;}directions?.push(...structuredClone(hit.directions));return structuredClone(hit.matrix);}
 if(hit)cache.delete(key);
 const sourceNodes=new Set(demands.map(d=>d.nodeId)),siteNodes=new Set(sites.map(t=>t.accessNodeId));
 const useSources=sourceNodes.size<=siteNodes.size;
 // One forward and one reverse tree per unique node on the smaller side; no path arc reconstruction.
 const loaded=createRouteEngine(network,{closedEdgeIds:loadedClosed,reverse:!useSources,distanceOnly:true,cacheLimit:1});
 const empty=createRouteEngine(network,{closedEdgeIds:emptyClosed,reverse:useSources,distanceOnly:true,cacheLimit:1});
 const matrix=demands.map(()=>sites.map(()=>null)),legs=demands.map(()=>sites.map(()=>null));
 const byNode=(rows,f)=>{const map=new Map();rows.forEach((x,i)=>{const node=f(x);if(!map.has(node))map.set(node,[]);map.get(node).push(i);});return map;};
 const starts=useSources?byNode(demands,d=>d.nodeId):byNode(sites,t=>t.accessNodeId);
 let count=0;
 for(const [start,indices] of starts){if(performance.now()>=deadline||signal?.aborted)return null;count++;
  const other=useSources?siteNodes:sourceNodes;const lengths=new Map();for(const end of other){
   if(performance.now()>=deadline||signal?.aborted)return null;
   const outward=loaded.distance(start,end),home=empty.distance(start,end);
   if(outward===null||home===null)continue;
   const loadedDistanceMm=Math.round(outward*1e6),emptyDistanceMm=Math.round(home*1e6),mm=loadedDistanceMm+emptyDistanceMm;
   requireValid(Number.isSafeInteger(mm)&&mm>=0,'Unsafe route length','matrix');lengths.set(end,{loadedDistanceMm,emptyDistanceMm});
  }
  for(const k of indices)for(let t=0;t<(useSources?sites:demands).length;t++){
   const i=useSources?k:t,j=useSources?t:k,d=demands[i],s=sites[j];if(!compatible(d,s))continue;
   const value=lengths.get(useSources?s.accessNodeId:d.nodeId);if(!value)continue;const mm=value.loadedDistanceMm+value.emptyDistanceMm+(s.intraSiteRoundtripMm??0);
   requireValid(Number.isSafeInteger(mm)&&mm>=0,'Unsafe combined route length','matrix');matrix[i][j]=mm;
   legs[i][j]={...value,...(Object.hasOwn(s,'intraSiteRoundtripMm')?{intraSiteRoundtripMm:s.intraSiteRoundtripMm}:{})};
  }
 }
 if(metrics){metrics.cacheHit=false;metrics.routeStarts=2*count;metrics.startSide=useSources?'demands':'sites';}
 if(key&&demands.length<=50&&sites.length<=30){cache.set(key,{created:performance.now(),matrix:structuredClone(matrix),directions:structuredClone(legs)});while(cache.size>MAX_ENTRIES)cache.delete(cache.keys().next().value);}
 directions?.push(...legs);return matrix;
}
