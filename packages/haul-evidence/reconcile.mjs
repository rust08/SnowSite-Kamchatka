import {own,extractKey,parseTimestamp,validateRow,tupleId,compareTuple,formatQuantity,reason,sortReasons} from './validate.mjs';

const states = Object.freeze(['active','cancelled','invalid','history_conflict','out_of_scope']);
export const statuses = Object.freeze(['matched_records','quantity_mismatch','scope_mismatch','not_observed_in_source','both_cancelled','review_history','out_of_scope']);
const countsOf = labels => Object.fromEntries(labels.map(label=>[label,0]));
const ref = (env,index) => ({source:env.source,datasetId:env.datasetId,rowIndex:index});
const semanticTuple = row => [row.action,row.event.text,...row.scope,formatQuantity(row.quantity)??''];
const scopeEqual = (a,b) => tupleId(a)===tupleId(b);

function inspectHistory(group,env,counts) {
  const side = env.source;
  const revisions = new Map();
  for (const row of group.valid) {
    if (!revisions.has(row.revision)) revisions.set(row.revision,new Map());
    const versions = revisions.get(row.revision);
    const signature = tupleId(semanticTuple(row));
    if (!versions.has(signature)) versions.set(signature,{representative:row,earliest:row.receipt,indices:[]});
    const delivery = versions.get(signature);
    delivery.indices.push(row.index);
    if (row.receipt.instant<delivery.earliest.instant) delivery.earliest=row.receipt;
  }
  const deliveries = [], chain = [], conflicts = [];
  const ordered = [...revisions.entries()].sort(([a],[b])=>a-b);
  for (const [revision,versions] of ordered) {
    const options = [...versions.values()].sort((a,b)=>compareTuple(semanticTuple(a.representative),semanticTuple(b.representative)));
    for (const option of options) {
      counts.duplicateDeliveries += option.indices.length-1;
      deliveries.push({revision,earliestReceipt:option.earliest.text,refs:option.indices.map(i=>ref(env,i))});
    }
    if (options.length>1) conflicts.push(reason('revision_conflict',side,options.flatMap(x=>x.indices),{revision}));
    else chain.push(options[0]);
  }
  const allRefs = group.indices.map(i=>ref(env,i));
  const result = (state,quantity,scope,reasons) => ({state,quantity,scope,refs:allRefs,deliveries,reasons:sortReasons(reasons)});
  // Do not infer a canonical history across malformed or conflicting revisions.
  if (group.errors.length) return result('invalid',null,null,[...group.errors,...conflicts]);
  if (conflicts.length) return result('history_conflict',null,null,conflicts);
  const errors = [];
  const first = chain[0].representative;
  let previous = null, expected = 1;
  for (const entry of chain) {
    const row = entry.representative;
    const add = (code,indices=entry.indices)=>errors.push(reason(code,side,indices,{revision:row.revision}));
    if (row.revision!==expected) add('revision_gap');
    if ((row.revision===1&&row.action!=='issue') || (row.revision!==1&&row.action==='issue') || previous?.representative.action==='cancel') add('invalid_transition',previous?.representative.action==='cancel'?[...previous.indices,...entry.indices]:entry.indices);
    if (!scopeEqual(row.scope,first.scope)) add('scope_changed');
    if (previous && row.event.instant<previous.representative.event.instant) add('event_order',[...previous.indices,...entry.indices]);
    expected=row.revision+1;
    previous=entry;
  }
  if (errors.length) return result('history_conflict',null,null,errors);
  if (first.event.instant<env.start.instant || first.event.instant>=env.end.instant) return result('out_of_scope',null,first.scope,[reason('issue_outside_period',side,chain[0].indices,{revision:1})]);
  const last=previous.representative;
  return last.action==='cancel'?result('cancelled',null,last.scope,[]):result('active',formatQuantity(last.quantity),last.scope,[]);
}

export function inspectSide(env,cutoff) {
  const counts = {rawCount:env.records.length,visibleCount:0,duplicateDeliveries:0,invalidRows:0,invalidIdentityRows:0,effectiveStates:countsOf(states)};
  const diagnostic = {lateReceiptCount:0,unknownReceiptCount:0};
  const groups = new Map(), unusable = [];
  for (let i=0;i<env.records.length;i++) {
    const row = Object.hasOwn(env.records,i)?env.records[i]:undefined, index=i+1;
    const receipt = parseTimestamp(own(row,'receivedAt'));
    if (receipt && receipt.instant>cutoff.instant) {diagnostic.lateReceiptCount++;continue;}
    const key = extractKey(row);
    let validated;
    if (!receipt) {
      diagnostic.unknownReceiptCount++;
      validated={reasons:[reason('unknown_receipt',env.source,[index])]};
      if (!key) validated.reasons.push(reason('invalid_identity',env.source,[index]));
    } else {
      counts.visibleCount++;
      validated=validateRow(row,key,receipt,env.source,index);
    }
    if (validated.reasons.length) counts.invalidRows++;
    if (!key) {
      counts.invalidIdentityRows++;
      unusable.push({ref:ref(env,index),reasons:sortReasons(validated.reasons)});
      continue;
    }
    const id=tupleId(key);
    if (!groups.has(id)) groups.set(id,{key,indices:[],valid:[],errors:[]});
    const group=groups.get(id);
    group.indices.push(index);
    if (validated.record) group.valid.push(validated.record);
    else group.errors.push(...validated.reasons);
  }
  const effective=new Map();
  for (const [id,group] of groups) {
    const value=inspectHistory(group,env,counts);
    counts.effectiveStates[value.state]++;
    effective.set(id,{key:group.key,value});
  }
  return {counts,diagnostic,effective,unusable};
}

const absent = side => ({state:'not_observed',quantity:null,scope:null,refs:[],deliveries:[],reasons:[reason('not_observed',side,[])]});
export function pairSides(carrier,receiver) {
  const ids = new Set([...carrier.effective.keys(),...receiver.effective.keys()]);
  const pairs = [];
  for (const id of ids) {
    const c=carrier.effective.get(id), r=receiver.effective.get(id);
    const a=c?.value??absent('carrier'), b=r?.value??absent('receiver');
    const x=a.state,y=b.state;
    let status, code;
    if ([x,y].some(s=>s==='invalid'||s==='history_conflict')) status='review_history';
    else if (x==='out_of_scope'||y==='out_of_scope') {
      if ([x,y].every(s=>s==='out_of_scope'||s==='not_observed')) status='out_of_scope';
      else {status='scope_mismatch';code='scope_mismatch';}
    } else if (x==='not_observed'||y==='not_observed') status='not_observed_in_source';
    else if (x!==y) {status='review_history';code='state_mismatch';}
    else if (!scopeEqual(a.scope,b.scope)) {status='scope_mismatch';code='scope_mismatch';}
    else if (x==='cancelled') status='both_cancelled';
    else if (a.quantity===b.quantity) status='matched_records';
    else {status='quantity_mismatch';code='quantity_mismatch';}
    pairs.push({key:(c??r).key,carrier:a,receiver:b,status,matchedQuantity:status==='matched_records'?a.quantity:null,reasons:code?[reason(code,null,[])]:[]});
  }
  return pairs.sort((a,b)=>compareTuple(a.key,b.key));
}
