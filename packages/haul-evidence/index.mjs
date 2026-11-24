import {validateEnvelope,parseTimestamp,HaulEvidenceInputError} from './validate.mjs';
import {inspectSide,pairSides} from './reconcile.mjs';
import {makeReport} from './report.mjs';
export {HaulEvidenceInputError} from './validate.mjs';

/** Reconcile two parsed synthetic extracts as of an explicit UTC instant. No I/O. */
export function reconcileEvidence(first,second,asOf) {
  const cutoff=parseTimestamp(asOf);
  if (!cutoff) throw new HaulEvidenceInputError('invalid_as_of',null,'asOf');
  const a=validateEnvelope(first), b=validateEnvelope(second);
  if (a.source===b.source) throw new HaulEvidenceInputError('invalid_pair',null,'source');
  for (const [field,equal] of [['scopeId',a.scopeId===b.scopeId],['periodStart',a.start.instant===b.start.instant],['periodEnd',a.end.instant===b.end.instant]]) {
    if (!equal) throw new HaulEvidenceInputError('invalid_pair',null,field);
  }
  const [carrier,receiver]=a.source==='carrier'?[a,b]:[b,a];
  const sides={carrier:inspectSide(carrier,cutoff),receiver:inspectSide(receiver,cutoff)};
  return makeReport(carrier,receiver,cutoff,sides,pairSides(sides.carrier,sides.receiver));
}

import {parseEvidenceJson} from './parse.mjs';
import {snapshotEvidenceBytes,decodeEvidenceBytes,sha256EvidenceBytes} from './bytes.mjs';
import {withSourceHashes} from './report.mjs';
export {serializeEvidenceReport} from './report.mjs';

/** Raw-byte boundary. Both snapshots and the A1 result precede the first await. */
export async function reconcileEvidenceBytes(firstBytes,secondBytes,asOf) {
  const snapshots=snapshotEvidenceBytes(firstBytes,secondBytes);
  const inputs=snapshots.map(bytes=>parseEvidenceJson(decodeEvidenceBytes(bytes)));
  const report=reconcileEvidence(inputs[0],inputs[1],asOf);
  const digests=await Promise.all(snapshots.map(sha256EvidenceBytes));
  return withSourceHashes(report,Object.fromEntries(inputs.map((input,i)=>[input.source,digests[i]])));
}
