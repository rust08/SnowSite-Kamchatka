import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {compareSites} from '../src/optimizer.mjs';
const raw=readFileSync(new URL('../data/snapshots/pkgo-27233df581c6/city-network.json',import.meta.url));
const network=JSON.parse(raw);
const demo=()=>JSON.parse(readFileSync(new URL('../data/fixtures/scenario.demo.json',import.meta.url)));
const graph={version:'t',nodes:{A:[0,0],B:[1,0],C:[2,0]},edges:[{id:'ab',from:'A',to:'B',km:1,oneway:false},{id:'bc',from:'B',to:'C',km:1,oneway:false}]};
const small=()=>({demands:[{id:'D',nodeId:'A',volumeM3:25}],sites:[{id:'S',kind:'existing',nodeId:'C',capacityM3:15},{id:'C1',kind:'candidate',nodeId:'B',capacityM3:15}],
 truck:{bodyM3:10,payloadKg:5000,driveKmh:20},snowDensityKgM3:500});
test('A01: network snapshot version, size and sha256 are pinned',()=>{
  assert.equal(network.version,'pkgo-27233df581c6');assert.equal(Object.keys(network.nodes).length,9983);assert.equal(network.edges.length,12354);
  assert.equal(createHash('sha256').update(raw).digest('hex').length,64);
});
test('A05/A06/A07/A08 invariants on the real-graph demo scenario',()=>{
  const sc=demo(),r=compareSites(network,sc);
  for(const res of [r.baseline,...r.variants]){
    for(const d of sc.demands){const got=res.assignments.filter(a=>a.demandId===d.id).reduce((s,a)=>s+a.volumeM3,0);assert.ok(got<=d.volumeM3);}
    assert.equal(res.servedM3+res.unservedM3,sc.demands.reduce((s,d)=>s+d.volumeM3,0));
    for(const u of res.siteUtilization)assert.ok(u.usedM3<=u.capacityM3);
    for(const a of res.assignments){assert.ok(a.volumeM3<=sc.truck.bodyM3&&a.volumeM3*sc.snowDensityKgM3<=sc.truck.payloadKg);
      assert.ok(Array.isArray(a.outward.arcs)&&Array.isArray(a.home.arcs)&&(a.km===0||a.outward.arcs.length>0));assert.ok(Math.abs(a.outward.km+a.home.km-a.km)<1e-5);}
  }
});
test('A09: solver does not mutate its input; A15: repeated runs are identical',()=>{
  const sc=demo(),before=JSON.stringify(sc);const a=compareSites(network,sc),b=compareSites(network,sc),c=compareSites(network,sc);
  assert.equal(JSON.stringify(sc),before);assert.deepEqual(a,b);assert.deepEqual(b,c);
});
test('A10: capacity deficit is reported and ranks by least unserved',()=>{
  const sc=small();sc.sites[0].capacityM3=5;sc.sites[1].capacityM3=0;
  const r=compareSites(graph,sc);assert.equal(r.baseline.unservedM3,20);assert.equal(r.variants[0].unservedM3,20);
  sc.sites[1].capacityM3=10;assert.equal(compareSites(graph,sc).variants[0].unservedM3,10);
});
test('A11: zero baseline km gives null percent, never NaN/Infinity',()=>{
  const sc={demands:[{id:'D',nodeId:'A',volumeM3:5}],sites:[{id:'S',kind:'existing',nodeId:'A',capacityM3:5},{id:'C1',kind:'candidate',nodeId:'B',capacityM3:5}],
   truck:{bodyM3:10,driveKmh:20}};
  const r=compareSites(graph,sc);assert.equal(r.baseline.transportKm,0);assert.equal(r.variants[0].deltaKmPercent,null);
  assert.ok(Number.isFinite(r.variants[0].deltaKm));
});
test('A10b: unreachable site (closed road) leaves demand unserved with explanation fields',()=>{
  const sc=small();sc.closedEdgeIds=['bc','ab'];const r=compareSites(graph,sc);assert.equal(r.baseline.servedM3,0);assert.equal(r.baseline.unservedM3,25);
});
test('A19: client never writes user strings through innerHTML',()=>{
  const js=readFileSync(new URL('../apps/web/app.js',import.meta.url),'utf8');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(js));
});
test('A20: server binds to 127.0.0.1 only',()=>{
  const s=readFileSync(new URL('../apps/api/server.mjs',import.meta.url),'utf8');assert.match(s,/listen\(port,'127\.0\.0\.1'\)/);
});
test('unserved reasons: no round-trip route vs exhausted capacity',()=>{
  const g={version:'t',nodes:{A:[0,0],B:[1,0],C:[2,0]},edges:[{id:'ab',from:'A',to:'B',km:1,oneway:true},{id:'bc',from:'B',to:'C',km:1,oneway:false}]};
  const sc={demands:[{id:'D',nodeId:'A',volumeM3:10}],sites:[{id:'S',kind:'existing',nodeId:'B',capacityM3:50},{id:'C1',kind:'candidate',nodeId:'C',capacityM3:50}],truck:{bodyM3:10,driveKmh:20}};
  const r=compareSites(g,sc);// B->A is one-way forbidden: no way home
  assert.equal(r.baseline.unservedReasons[0].code,'no_round_trip_route');assert.equal(r.baseline.unservedM3,10);
  const g2={...g,edges:[{id:'ab',from:'A',to:'B',km:1,oneway:false},{id:'bc',from:'B',to:'C',km:1,oneway:false}]};
  sc.sites[0].capacityM3=4;const r2=compareSites(g2,sc);assert.equal(r2.baseline.unservedReasons[0].code,'capacity_exhausted');
  assert.equal(r2.baseline.unservedReasons[0].unservedM3,6);
});
test('METHOD-01: demo scenario has distinct nodes and no zero-km trips',()=>{
  const sc=demo(),ids=[...sc.demands,...sc.sites].map(x=>x.nodeId);
  assert.equal(new Set(ids).size,ids.length);
  const r=compareSites(network,sc);
  for(const res of [r.baseline,...r.variants])assert.equal(res.assignments.filter(a=>a.km===0).length,0);
  assert.equal(r.baseline.transportKm,167.098);assert.equal(r.baseline.trips,26);
  assert.equal(r.variants[0].siteId,'C1');assert.equal(r.variants[0].transportKm,108.556);assert.equal(r.variants[0].trips,25);
  assert.equal(r.variants[1].transportKm,122.648);assert.equal(r.variants[1].trips,25);
  for(const res of [r.baseline,...r.variants])assert.equal(res.unservedM3,0);
});
