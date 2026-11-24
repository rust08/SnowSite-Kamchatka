import {validateNetwork} from '../contracts/validate.mjs';
/** SnowSite: standalone directed shortest-path engine for the Sever OSM graph.
 * Does not import or modify Sever; respects oneway and explicitly unroutable edges.
 * Does NOT know turn restrictions, road legal classes, seasonal or weight constraints.
 */

class MinHeap {
  constructor() { this.a = []; }
  push(item) {
    const a=this.a; let i=a.length;
    while(i>0){const p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p;}
    a[i]=item;
  }
  pop() {
    const a=this.a; if(!a.length)return null;
    const first=a[0],last=a.pop();if(!a.length)return first;
    let i=0;
    while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=last[0])break;a[i]=a[j];i=j;}
    a[i]=last;return first;
  }
  get size(){return this.a.length;}
}
export function createRouteEngine(network,{closedEdgeIds=[],reverse=false,distanceOnly=false,cacheLimit=Infinity}={}){
  validateNetwork(network,closedEdgeIds);
  const closed=new Set(closedEdgeIds.map(String));
  const adjacency=new Map(Object.keys(network.nodes).map(id=>[id,[]]));
  const add=(from,to,edge,forward)=>adjacency.get(reverse?to:from).push({to:reverse?from:to,edgeId:String(edge.id),km:edge.km,forward});
  for(const edge of network.edges){
    if(edge.routable===false||closed.has(String(edge.id)))continue;
    if(!(edge.km>0)|| !adjacency.has(String(edge.from)) || !adjacency.has(String(edge.to)))throw Error('Повреждённое ребро '+edge.id);
    add(String(edge.from),String(edge.to),edge,true);
    if(!edge.oneway)add(String(edge.to),String(edge.from),edge,false);
  }
  const cache=new Map();
  function tree(start){
    if(cache.has(start))return cache.get(start);
    if(!adjacency.has(start))throw Error('Узел вне графа: '+start);
    const dist=new Map([[start,0]]),prev=distanceOnly?null:new Map(),heap=new MinHeap();
    heap.push([0,start]);
    while(heap.size){
      const [cost,u]=heap.pop();if(cost!==dist.get(u))continue;
      for(const arc of adjacency.get(u)){
        const next=cost+arc.km;
        if(next+1e-12>=(dist.get(arc.to)??Infinity))continue;
        dist.set(arc.to,next);
        prev?.set(arc.to,{from:u,edgeId:arc.edgeId,forward:arc.forward});
        heap.push([next,arc.to]);
      }
    }
    const result={dist,prev};if(cacheLimit>0){cache.set(start,result);while(cache.size>cacheLimit)cache.delete(cache.keys().next().value);}return result;
  }
  function distance(start,end){const km=tree(String(start)).dist.get(String(end));return km===undefined?null:Number(km.toFixed(6));}
  function path(start,end){
    if(distanceOnly||reverse)throw Error('Path reconstruction is available only on forward full engines');
    start=String(start);end=String(end);
    const result=tree(start),km=result.dist.get(end);
    if(km===undefined)return null;
    const arcs=[];
    for(let u=end;u!==start;){
      const arc=result.prev.get(u);if(!arc)throw Error('Нарушена цепочка пути');
      arcs.push({edgeId:arc.edgeId,forward:arc.forward});u=arc.from;
    }
    arcs.reverse();
    return {km:Number(km.toFixed(6)),arcs};
  }
  function roundTrip(from,to){
    const outward=path(from,to),home=path(to,from);
    return outward&&home?{outward,home,km:Number((outward.km+home.km).toFixed(6))}:null;
  }
  return {path,roundTrip,distance,networkVersion:network.version,graphSize:{nodes:adjacency.size,edges:network.edges.length}};
}
