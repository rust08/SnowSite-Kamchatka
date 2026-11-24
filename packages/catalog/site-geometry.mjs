// Bounded local GeoJSON Polygon metadata; not a land survey or a routing input.
// Exact planar topology on a documented 1e-7 degree integer grid. No silent rounding.
import {requireValid as check} from '../contracts/validate.mjs';
const SCALE=10_000_000,MAX_POINTS=512,MAX_RINGS=16;
const eq=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const between=(x,a,b)=>a<=b?a<=x&&x<=b:b<=x&&x<=a;
const on=(a,b,c)=>cross(a,b,c)===0n&&between(c[0],a[0],b[0])&&between(c[1],a[1],b[1]);
const sign=x=>x>0n?1:x<0n?-1:0;
function intersects(a,b,c,d){
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 return on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)||sign(abC)*sign(abD)<0&&sign(cdA)*sign(cdB)<0;
}
function pointInside(p,ring){
 // Winding number, with boundary explicitly rejected by caller.
 let winding=0;
 for(let i=0;i<ring.length-1;i++){
  const a=ring[i],b=ring[i+1];
  if(on(a,b,p))return false;
  if(a[1]<=p[1]&&b[1]>p[1]&&cross(a,b,p)>0n)winding++;
  if(a[1]>p[1]&&b[1]<=p[1]&&cross(a,b,p)<0n)winding--;
 }
 return winding!==0;
}
export function validateSiteGeometry(geometry,path='record.geometry'){
 const fail=(message)=>check(false,message,path);
 check(geometry&&typeof geometry==='object'&&!Array.isArray(geometry)&&geometry.type==='Polygon'&&Object.keys(geometry).every(k=>['type','coordinates'].includes(k))&&Array.isArray(geometry.coordinates)&&geometry.coordinates.length>=1&&geometry.coordinates.length<=MAX_RINGS,'Expected bounded GeoJSON Polygon (WGS84, no foreign members)',path);
 let total=0,minLon=180,maxLon=-180;
 const rings=geometry.coordinates.map(r=>{
  check(Array.isArray(r)&&r.length>=4&&(total+=r.length)<=MAX_POINTS,'Invalid ring length or polygon point budget exceeded',path);
  return r.map(p=>{
   check(Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=-180&&p[0]<=180&&p[1]>-90&&p[1]<90,'Invalid local WGS84 position [lon,lat]',path);
   minLon=Math.min(minLon,p[0]);maxLon=Math.max(maxLon,p[0]);
   return p.map(x=>{const integer=Math.round(x*SCALE);check(integer/SCALE===x,'Position must lie on 1e-7 degree grid; no implicit rounding',path);return BigInt(integer);});
  });
 });
 check(maxLon-minLon<180,'Antimeridian-spanning polygons unsupported',path);
 for(const r of rings){
  const n=r.length-1;
  check(eq(r[0],r[n]),'Ring is not closed',path);
  check(new Set(r.slice(0,n).map(p=>p.join(','))).size===n,'Duplicate ring vertex',path);
  let area=0n;
  for(let i=0;i<n;i++){
   const a=r[i],b=r[i+1],c=r[(i+2)%n];area+=a[0]*b[1]-a[1]*b[0];
   // Adjacent collinear segments may continue straight but cannot backtrack.
   if(cross(a,b,c)===0n&&(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])<=0n)fail('Overlapping adjacent ring segments');
   for(let j=i+2;j<n;j++)if(!(i===0&&j===n-1)&&intersects(a,b,r[j],r[j+1]))fail('Self-intersecting ring');
  }
  check(area!==0n,'Zero-area ring',path);
 }
 for(let i=0;i<rings.length;i++)for(let j=i+1;j<rings.length;j++){
  const a=rings[i],b=rings[j];
  for(let x=0;x<a.length-1;x++)for(let y=0;y<b.length-1;y++)if(intersects(a[x],a[x+1],b[y],b[y+1]))fail('Polygon rings touch or intersect');
  if(i===0){if(!pointInside(b[0],a))fail('Hole outside shell');}
  else if(pointInside(b[0],a)||pointInside(a[0],b))fail('Nested holes unsupported');
 }
 return geometry;
}
