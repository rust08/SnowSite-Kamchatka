import test from 'node:test';import assert from 'node:assert/strict';
import {createRouteEngine} from '../src/routing.mjs';
const g={version:'test',nodes:{A:[0,0],B:[1,0],C:[2,0],D:[1,1]},edges:[
 {id:'ab',from:'A',to:'B',km:1,oneway:true},
 {id:'bc',from:'B',to:'C',km:2,oneway:false},
 {id:'ca',from:'C',to:'A',km:4,oneway:true},
 {id:'ad',from:'A',to:'D',km:10,oneway:false,routable:false}]};
test('directed paths and reverse route are different',()=>{
 const engine=createRouteEngine(g);assert.equal(engine.path('A','C').km,3);assert.equal(engine.path('C','A').km,4);assert.equal(engine.roundTrip('A','C').km,7);
});
test('explicit unroutable road cannot be used',()=>{assert.equal(createRouteEngine(g).path('A','D'),null);});
test('closures affect both directions',()=>{const e=createRouteEngine(g,{closedEdgeIds:['bc']});assert.equal(e.path('A','C'),null);assert.equal(e.path('B','C'),null);assert.equal(e.path('C','B').km,5);});
test('same-node path zero and unknown node rejected',()=>{const e=createRouteEngine(g);assert.equal(e.path('B','B').km,0);assert.throws(()=>e.path('Q','A'));});
