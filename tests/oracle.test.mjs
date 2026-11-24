import test from 'node:test';import assert from 'node:assert/strict';
import {compareSites} from '../src/optimizer.mjs';
import {exactOracle} from './helpers/oracle.mjs';
// A16: frozen counterexample found by random search against the exact oracle.
const graph={version:'t',nodes:{N0:[0,0],N1:[1,0],N2:[2,0],N3:[3,0],N4:[4,0]},edges:[
 {id:'e1',from:'N0',to:'N1',km:2,oneway:false},{id:'e2',from:'N0',to:'N2',km:5,oneway:false},
 {id:'e3',from:'N0',to:'N3',km:1,oneway:false},{id:'e4',from:'N1',to:'N4',km:4,oneway:false}]};
const scene=()=>({truck:{bodyM3:10,payloadKg:5000,driveKmh:20},snowDensityKgM3:500,
 demands:[{id:'D0',nodeId:'N3',volumeM3:20},{id:'D1',nodeId:'N0',volumeM3:10}],
 sites:[{id:'S0',kind:'existing',nodeId:'N3',capacityM3:10},{id:'S1',kind:'existing',nodeId:'N1',capacityM3:10},
  {id:'C',kind:'candidate',nodeId:'N1',capacityM3:20}]});
test('A16: exact oracle beats greedy on a frozen counterexample (same unserved, fewer km)',()=>{
  const g=compareSites(graph,scene(),{improve:false}).baseline,o=exactOracle(graph,scene(),['S0','S1']);
  assert.equal(g.unservedM3,o.unservedM3);assert.equal(o.transportKm,4);assert.equal(g.transportKm,6);
  assert.ok(g.transportKm>o.transportKm,'greedy is not globally optimal');
});
test('oracle never worse than greedy on 300 seeded random small graphs (sanity of both)',()=>{
  let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296,ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  let worse=0;
  for(let t=0;t<300;t++){
    const n=ri(4,6),nodes={},edges=[];for(let i=0;i<n;i++)nodes['N'+i]=[i,0];
    for(let i=1;i<n;i++)edges.push({id:'e'+i,from:'N'+ri(0,i-1),to:'N'+i,km:ri(1,6),oneway:false});
    const sc={truck:{bodyM3:10,payloadKg:5000,driveKmh:20},snowDensityKgM3:500,
      demands:[0,1,2].map(i=>({id:'D'+i,nodeId:'N'+ri(0,n-1),volumeM3:10*ri(1,2)})),
      sites:[{id:'S0',kind:'existing',nodeId:'N'+ri(0,n-1),capacityM3:10*ri(1,2)},
             {id:'S1',kind:'existing',nodeId:'N'+ri(0,n-1),capacityM3:10*ri(1,3)},
             {id:'C',kind:'candidate',nodeId:'N0',capacityM3:10}]};
    const g=compareSites({version:'t',nodes,edges},sc,{improve:false}).baseline,o=exactOracle({version:'t',nodes,edges},sc,['S0','S1']);
    assert.ok(g.unservedM3>=o.unservedM3,'greedy cannot serve more than exact optimum');
    if(g.unservedM3===o.unservedM3)assert.ok(g.transportKm>=o.transportKm-1e-6);
    if(g.unservedM3>o.unservedM3||g.transportKm>o.transportKm+1e-6)worse++;
  }
  assert.ok(worse>0,'expected greedy to be suboptimal on some instances');
});
test('local search fixes the frozen counterexample and never worsens greedy',()=>{
  const g=compareSites(graph,scene()).baseline,o=exactOracle(graph,scene(),['S0','S1']);
  assert.equal(g.unservedM3,o.unservedM3);assert.equal(g.transportKm,o.transportKm);
  let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296,ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  let greedyGap=0,improvedGap=0;
  for(let t=0;t<300;t++){
    const n=ri(4,6),nodes={},edges=[];for(let i=0;i<n;i++)nodes['N'+i]=[i,0];
    for(let i=1;i<n;i++)edges.push({id:'e'+i,from:'N'+ri(0,i-1),to:'N'+i,km:ri(1,6),oneway:false});
    const sc={truck:{bodyM3:10,payloadKg:5000,driveKmh:20},snowDensityKgM3:500,
      demands:[0,1,2].map(i=>({id:'D'+i,nodeId:'N'+ri(0,n-1),volumeM3:10*ri(1,2)})),
      sites:[{id:'S0',kind:'existing',nodeId:'N'+ri(0,n-1),capacityM3:10*ri(1,2)},
             {id:'S1',kind:'existing',nodeId:'N'+ri(0,n-1),capacityM3:10*ri(1,3)},{id:'C',kind:'candidate',nodeId:'N0',capacityM3:10}]};
    const net={version:'t',nodes,edges},o2=exactOracle(net,sc,['S0','S1']);
    const gr=compareSites(net,sc,{improve:false}).baseline,im=compareSites(net,sc).baseline;
    assert.ok(im.unservedM3<=gr.unservedM3);assert.ok(im.unservedM3>o2.unservedM3-1e-9);
    if(im.unservedM3===gr.unservedM3)assert.ok(im.transportKm<=gr.transportKm+1e-6);
    if(gr.unservedM3>o2.unservedM3||gr.transportKm>o2.transportKm+1e-6)greedyGap++;
    if(im.unservedM3>o2.unservedM3||im.transportKm>o2.transportKm+1e-6)improvedGap++;
  }
  console.log('greedy suboptimal:',greedyGap,'/300; with local search:',improvedGap,'/300');
  assert.ok(improvedGap<=greedyGap);
});
