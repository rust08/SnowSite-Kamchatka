import test from 'node:test';import assert from 'node:assert/strict';
import {compareSites} from '../src/optimizer.mjs';
const graph={version:'test',nodes:{A:[0,0],B:[1,0],C:[2,0]},edges:[
 {id:'ab',from:'A',to:'B',km:1,oneway:false},
 {id:'bc',from:'B',to:'C',km:1,oneway:false}]};
const scene=()=>({demands:[{id:'D',nodeId:'A',volumeM3:12}],sites:[
 {id:'S',name:'Базовая',kind:'existing',nodeId:'C',capacityM3:20},
 {id:'C',name:'Кандидат',kind:'candidate',nodeId:'B',capacityM3:20}],
 truck:{bodyM3:10,payloadKg:5000,driveKmh:20},snowDensityKgM3:500});
test('candidate reduces modeled roundtrip when closer',()=>{
 const result=compareSites(graph,scene());assert.equal(result.baseline.transportKm,8);
 assert.equal(result.variants[0].transportKm,4);assert.equal(result.variants[0].deltaKm,-4);
 assert.equal(result.variants[0].trips,2);assert.equal(result.variants[0].servedM3,12);
});
test('site capacity is respected, unmet demand exposed',()=>{
 const s=scene();s.sites[0].capacityM3=3;s.sites[1].capacityM3=4;
 const r=compareSites(graph,s);assert.equal(r.baseline.unservedM3,9);assert.equal(r.variants[0].unservedM3,5);
 assert.equal(r.variants[0].siteUtilization.reduce((n,x)=>n+x.usedM3,0),7);
});
test('payload density controls trip volume',()=>{const s=scene();s.snowDensityKgM3=1000;const r=compareSites(graph,s);assert.equal(r.variants[0].trips,3);});
test('unverified sites never become approved',()=>{const r=compareSites(graph,scene());assert.equal(r.variants[0].legalStatus,'not_assessed');assert.match(r.notice,/не заключение/);});
test('invalid graph node and capacity rejected',()=>{const s=scene();s.demands[0].nodeId='bad';assert.throws(()=>compareSites(graph,s));s.demands[0].nodeId='A';s.sites[0].capacityM3=-1;assert.throws(()=>compareSites(graph,s));});

test('user-supplied legal status cannot create legal approval',()=>{const s=scene();s.sites[1].legalStatus='verified';const r=compareSites(graph,s);assert.equal(r.variants[0].legalStatus,'not_assessed');});
