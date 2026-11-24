import {parseQuantity,formatQuantity,tupleId,compareTuple} from './validate.mjs';
import {statuses} from './reconcile.mjs';

// Aggregate internal fixed-point values, never JSON Numbers. A group is created even for zero.
const add = (map,scope,value) => {
  const id=tupleId(scope);
  if (!map.has(id)) map.set(id,{scope,quantity:0n});
  map.get(id).quantity+=value;
};
const finish = map => [...map.values()].sort((a,b)=>compareTuple(a.scope,b.scope)).map(group=>({scope:group.scope,quantity:formatQuantity(group.quantity)}));
export function makeReport(carrier,receiver,cutoff,sides,pairs) {
  const active={carrier:new Map(),receiver:new Map()}, matched=new Map(), difference=new Map();
  const pairCounts=Object.fromEntries(statuses.map(status=>[status,0]));
  for (const pair of pairs) {
    pairCounts[pair.status]++;
    for (const side of ['carrier','receiver']) {
      const value=pair[side];
      if (value.state==='active') add(active[side],value.scope,parseQuantity(value.quantity));
    }
    if (pair.status==='matched_records') add(matched,pair.carrier.scope,parseQuantity(pair.matchedQuantity));
    if (pair.status==='matched_records'||pair.status==='quantity_mismatch') add(difference,pair.carrier.scope,parseQuantity(pair.carrier.quantity)-parseQuantity(pair.receiver.quantity));
  }
  const dataset=env=>({source:env.source,datasetId:env.datasetId});
  return {
    reportVersion:'haul-evidence.report.v0.1',policyVersion:'synthetic-full-replacement.v0.1',mode:'synthetic',
    scopeId:carrier.scopeId,periodStart:carrier.start.text,periodEnd:carrier.end.text,asOf:cutoff.text,coverage:'unverified',
    datasets:{carrier:dataset(carrier),receiver:dataset(receiver)},
    sideCounts:{carrier:sides.carrier.counts,receiver:sides.receiver.counts},
    cutoffDiagnostics:{carrier:sides.carrier.diagnostic,receiver:sides.receiver.diagnostic},
    pairCounts,pairs,unusableRows:{carrier:sides.carrier.unusable,receiver:sides.receiver.unusable},
    totals:{knownActive:{carrier:finish(active.carrier),receiver:finish(active.receiver)},matched:finish(matched),comparableDifference:finish(difference)}
  };
}

// Adapter-only extension; preserve A1 ordering and all semantic fields.
export function withSourceHashes(report,hashes) {
  const datasets=Object.fromEntries(['carrier','receiver'].map(side=>[side,{...report.datasets[side],sha256:hashes[side]}]));
  return {...report,datasets};
}
export function serializeEvidenceReport(report) {
  return new TextEncoder().encode(JSON.stringify(report,null,2)+'\n');
}
