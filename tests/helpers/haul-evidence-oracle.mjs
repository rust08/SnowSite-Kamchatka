// Independent hand oracle: no imports from production, no shared calculation helpers.
import assert from 'node:assert/strict';

export function assertFixtureOracle(report,expected) {
  assert.equal(report.asOf,expected.asOf);
  for (const side of ['carrier','receiver']) {
    assert.equal(report.sideCounts[side].rawCount,expected.rawCounts[side]);
    assert.equal(report.sideCounts[side].visibleCount,expected.visibleCounts[side]);
    assert.equal(report.sideCounts[side].duplicateDeliveries,expected.duplicates[side]);
    assert.equal(report.cutoffDiagnostics[side].lateReceiptCount,expected.lateReceiptDiagnostic[side]);
    assert.equal(report.cutoffDiagnostics[side].unknownReceiptCount,0);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(report.pairCounts).filter(([,n])=>n!==0)),expected.pairCounts);
  assert.equal(report.pairs.length,expected.keyResults.length);
  for (const want of expected.keyResults) {
    const matches=report.pairs.filter(p=>p.key[0]===want.namespace&&p.key[1]===want.series&&p.key[2]===want.ticket);
    assert.equal(matches.length,1);
    const [p]=matches;
    assert.deepEqual({carrierState:p.carrier.state,receiverState:p.receiver.state,pairStatus:p.status,carrierQuantity:p.carrier.quantity,receiverQuantity:p.receiver.quantity,matchedQuantity:p.matchedQuantity},Object.fromEntries(['carrierState','receiverState','pairStatus','carrierQuantity','receiverQuantity','matchedQuantity'].map(k=>[k,want[k]])),`${want.series} ${want.ticket}`);
  }
  // These literal labels belong only to the supplied hand oracle. Never join general IDs.
  const groupLabels=[['C1/S1/m3/nominal',['C1','S1','m3','nominal']],['C1/S2/m3/nominal',['C1','S2','m3','nominal']]];
  const compareGroups=(actual,want)=>{
    assert.equal(actual.length,Object.keys(want).length);
    for (const [label,qty] of Object.entries(want)) {
      const scope=groupLabels.find(([k])=>k===label)[1];
      assert.deepEqual(actual.filter(g=>g.scope.every((s,i)=>s===scope[i])),[{scope,quantity:qty}]);
    }
  };
  for (const side of ['carrier','receiver']) compareGroups(report.totals.knownActive[side],expected.groupedKnownActiveTotals[side]);
  compareGroups(report.totals.matched,expected.groupedMatchedTotals);
  compareGroups(report.totals.comparableDifference,expected.comparableActiveDifference);
  assert.deepEqual(report.sideCounts.carrier.effectiveStates,{active:7,cancelled:1,invalid:1,history_conflict:1,out_of_scope:0});
  assert.deepEqual(report.sideCounts.receiver.effectiveStates,{active:9,cancelled:1,invalid:0,history_conflict:0,out_of_scope:0});
  assert.equal(report.sideCounts.carrier.invalidRows,1);
  assert.equal(report.sideCounts.receiver.invalidRows,0);
  assert.deepEqual(report.unusableRows,{carrier:[],receiver:[]});
  const find=(series,ticket)=>report.pairs.find(p=>p.key[0]==='DEMO'&&p.key[1]===series&&p.key[2]===ticket);
  assert.deepEqual(find('A','T1').carrier.deliveries.map(x=>[x.revision,x.earliestReceipt,x.refs.map(r=>r.rowIndex)]),[[1,'2026-01-01T09:00:00Z',[1,2]],[2,'2026-01-02T09:00:00Z',[3]]]);
  assert.deepEqual(find('A','T6').carrier.refs.map(r=>r.rowIndex),[10]);
  assert.deepEqual(find('A','T5').carrier.refs.map(r=>r.rowIndex),[8,9]);
  assert.deepEqual(find('A','T9').carrier.refs.map(r=>r.rowIndex),[15,16]);
}

// A separate structural check: exhaustive row ownership, reference bounds and count identities.
export function assertConservation(report,inputs) {
  assert.equal(report.coverage,'unverified');
  assert.equal(Object.values(report.pairCounts).reduce((a,b)=>a+b,0),report.pairs.length);
  for (const input of inputs) {
    const side=input.source,c=report.sideCounts[side],d=report.cutoffDiagnostics[side];
    const effective=report.pairs.map(p=>p[side]).filter(p=>p.state!=='not_observed');
    const refs=[...effective.flatMap(p=>p.refs),...report.unusableRows[side].map(x=>x.ref)];
    assert.equal(c.rawCount,input.records.length);
    assert.equal(c.rawCount,c.visibleCount+d.lateReceiptCount+d.unknownReceiptCount);
    assert.equal(refs.length,c.visibleCount+d.unknownReceiptCount);
    assert.equal(new Set(refs.map(r=>r.rowIndex)).size,refs.length);
    assert.equal(c.invalidIdentityRows,report.unusableRows[side].length);
    assert.ok(c.invalidRows>=c.invalidIdentityRows&&c.invalidRows>=d.unknownReceiptCount);
    for (const r of refs) {assert.equal(r.source,side);assert.equal(r.datasetId,input.datasetId);assert.ok(Number.isInteger(r.rowIndex)&&r.rowIndex>=1&&r.rowIndex<=input.records.length);}
    for (const [state,n] of Object.entries(c.effectiveStates)) assert.equal(effective.filter(p=>p.state===state).length,n);
    for (const p of effective) {
      if (p.state!=='active') assert.equal(p.quantity,null);
      if (['invalid','history_conflict'].includes(p.state)) assert.equal(p.scope,null);
      const local=new Set(p.refs.map(r=>r.rowIndex));
      for (const delivery of p.deliveries) for (const r of delivery.refs) assert.ok(local.has(r.rowIndex));
    }
  }
}

import {createHash} from 'node:crypto';
const independentHash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Fixture-specific C16 checker: trusted golden is the independent reviewer artifact,
// not a result produced by core or adapter. Restrict to exact fixture bytes/cutoff.
export function assertByteFixtureReport(originals,cutoff,candidate,goldenBytes,expectedSemantics) {
  assert.equal(independentHash(goldenBytes),'f63da3f746c70457a126774aeb3c40004ebdd59e40bbb28ad8932ba8f8221d93');
  const golden=JSON.parse(goldenBytes.toString('utf8'));
  assert.equal(cutoff,golden.asOf);
  const inputs=originals.map(bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  assert.deepEqual(inputs.map(input=>input.source).sort(),['carrier','receiver']);
  for(let i=0;i<inputs.length;i++){
    const input=inputs[i],side=input.source;
    assert.equal(independentHash(originals[i]),golden.datasets[side].sha256);
    assert.deepEqual(candidate.datasets[side],{source:side,datasetId:input.datasetId,sha256:independentHash(originals[i])});
    const known=input.records.map((row,index)=>({row,index:index+1})).filter(({row})=>Date.parse(row.receivedAt)<=Date.parse(cutoff));
    const actual=[];
    for(const pair of candidate.pairs){
      const v=pair[side];
      for(const ref of v.refs){
        assert.equal(ref.source,side);assert.equal(ref.datasetId,input.datasetId);
        assert.ok(Number.isInteger(ref.rowIndex)&&ref.rowIndex>=1&&ref.rowIndex<=input.records.length);
        const row=input.records[ref.rowIndex-1];
        assert.ok(Date.parse(row.receivedAt)<=Date.parse(cutoff));
        assert.deepEqual(pair.key,[row.namespace,row.series,row.ticket]);
        actual.push(ref.rowIndex);
      }
      for(const delivery of v.deliveries)for(const ref of delivery.refs){
        assert.ok(v.refs.some(r=>r.source===ref.source&&r.datasetId===ref.datasetId&&r.rowIndex===ref.rowIndex));
        assert.equal(input.records[ref.rowIndex-1].revision,delivery.revision);
      }
    }
    assert.deepEqual(actual.sort((a,b)=>a-b),known.map(x=>x.index));
  }
  assertConservation(candidate,inputs);
  assertFixtureOracle(candidate,expectedSemantics);
  assert.deepEqual(candidate,golden);
}
