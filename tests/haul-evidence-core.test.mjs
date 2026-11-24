import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {reconcileEvidence,HaulEvidenceInputError} from '../packages/haul-evidence/index.mjs';
import {assertFixtureOracle,assertConservation} from './helpers/haul-evidence-oracle.mjs';

const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/haul-evidence/${name}.json`,import.meta.url),'utf8'));
const cutoff='2026-01-05T00:00:00Z', start='2026-01-01T00:00:00Z', end='2026-02-01T00:00:00Z';
const row=(overrides={})=>({namespace:'D',series:'A',ticket:'T',revision:1,action:'issue',eventAt:'2026-01-01T08:00:00Z',receivedAt:'2026-01-01T09:00:00Z',contract:'C',site:'S',unit:'m3',basis:'nominal',quantity:'12',...overrides});
const correction=(overrides={})=>row({revision:2,action:'correct',eventAt:'2026-01-02T08:00:00Z',receivedAt:'2026-01-02T09:00:00Z',quantity:'3',...overrides});
const cancel=(overrides={})=>correction({action:'cancel',quantity:null,...overrides});
const env=(source,records,overrides={})=>({schemaVersion:'haul-evidence.synthetic.v0.1',mode:'synthetic',source,datasetId:source+'-test',scopeId:'scope',periodStart:start,periodEnd:end,records,...overrides});
const run=(c=[],r=[],asOf=cutoff)=>{const inputs=[env('carrier',c),env('receiver',r)];const result=reconcileEvidence(...inputs,asOf);assertConservation(result,inputs);return result;};
const one=(c,r=[],asOf=cutoff)=>{const x=run(c,r,asOf);assert.equal(x.pairs.length,1);return x.pairs[0];};
const codes=side=>side.reasons.map(r=>r.code);
const scope=['C','S','m3','nominal'];
const total=quantity=>[{scope,quantity}];
function freeze(value){if(value&&typeof value==='object'){for(const x of Object.values(value))freeze(x);Object.freeze(value);}return value;}
// Permutations remove only provenance indices and row ordering of standalone errors, not counts or semantic fields.
function semantic(value) {
  if(Array.isArray(value))return value.map(semantic);
  if(value===null||typeof value!=='object')return value;
  const out={};
  for(const [k,v] of Object.entries(value)) {
    if(['rowIndex','rowIndices'].includes(k))continue;
    if(k==='unusableRows'){out[k]=Object.fromEntries(Object.entries(v).map(([side,rows])=>[side,rows.map(semantic).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0)]));continue;}
    out[k]=semantic(v);
  }
  return out;
}
function shuffle(rows,seed){const result=[...rows];for(let i=result.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}

test('C01 independent hand oracle: all 11 keys, quantities, counts, totals, evidence',()=>{
  const c=fixture('carrier'),r=fixture('receiver'),e=fixture('expected_semantics');
  const result=reconcileEvidence(c,r,e.asOf);assertFixtureOracle(result,e);assertConservation(result,[c,r]);
  assert.equal(result.reportVersion,'haul-evidence.report.v0.1');assert.equal(result.policyVersion,'synthetic-full-replacement.v0.1');assert.equal(result.mode,'synthetic');
  assert.equal(result.pairCounts.out_of_scope,0);assert.equal(result.pairs.length,11);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
});
test('C02 duplicate deliveries preserve all refs and earliest receipt; equivalent decimal and timestamp syntax',()=>{
  const rows=[row({quantity:'12.000',eventAt:'2026-01-01T08:00:00.000Z',receivedAt:'2026-01-01T10:00:00Z'}),row({quantity:'12.0'}),row({quantity:'12',receivedAt:'2026-01-01T09:00:00.000Z'})];
  const r=run(rows,[row()]);assert.equal(r.sideCounts.carrier.duplicateDeliveries,2);assert.deepEqual(r.totals.knownActive.carrier,total('12'));assert.deepEqual(r.totals.matched,total('12'));
  assert.deepEqual(r.pairs[0].carrier.deliveries,[{revision:1,earliestReceipt:'2026-01-01T09:00:00Z',refs:[1,2,3].map(rowIndex=>({source:'carrier',datasetId:'carrier-test',rowIndex}))}]);
  const distinct=one([row({eventAt:'2026-01-01T08:00:00.1Z'}),row({eventAt:'2026-01-01T08:00:00.100Z'})]);assert.equal(distinct.carrier.deliveries.length,1);
});
test('C03 repetition, role order, 64 seeded permutations, frozen inputs, independent output',()=>{
  const c=freeze(fixture('carrier')),r=freeze(fixture('receiver'));const before=JSON.stringify([c,r]);const fixed=reconcileEvidence(c,r,cutoff);const original=JSON.stringify(fixed);
  assert.equal(JSON.stringify(reconcileEvidence(c,r,cutoff)),original);assert.equal(JSON.stringify(reconcileEvidence(r,c,cutoff)),original);
  for(let seed=1;seed<=64;seed++){const a={...c,records:shuffle(c.records,seed)},b={...r,records:shuffle(r.records,seed+100)};const x=reconcileEvidence(a,b,cutoff);assertConservation(x,[a,b]);assert.deepEqual(semantic(x),semantic(fixed));}
  fixed.pairs[0].key[0]='changed';assert.equal(JSON.stringify(reconcileEvidence(c,r,cutoff)),original);assert.equal(JSON.stringify([c,r]),before);
  const extra=[row(),row({quantity:null}),row({ticket:'bad',receivedAt:null}),{receivedAt:null},false,row({ticket:'bad2',quantity:'invalid'}),row({ticket:'bad3',quantity:'bad'})];
  const base=run(extra);for(let i=1;i<=8;i++)assert.deepEqual(semantic(run(shuffle(extra,i))),semantic(base));
});
test('C04 conflicting revision never last-write-wins; duplicates within conflict still counted',()=>{
  const a=row(),b=row({quantity:'13'});const r=run([a,b,{...a,receivedAt:'2026-01-01T10:00:00Z'},{...b,quantity:'13.000'}],[a]);
  assert.equal(r.pairs[0].status,'review_history');assert.equal(r.pairs[0].carrier.state,'history_conflict');assert.equal(r.sideCounts.carrier.duplicateDeliveries,2);assert.equal(r.sideCounts.carrier.invalidRows,0);assert.deepEqual(r.pairs[0].carrier.reasons,[{code:'revision_conflict',side:'carrier',rowIndices:[1,2,3,4],revision:1}]);assert.deepEqual(r.totals.knownActive.carrier,[]);assert.deepEqual(r.totals.knownActive.receiver,total('12'));
  const mixed=one([a,b,row({revision:2,quantity:'bad'})]);assert.equal(mixed.carrier.state,'invalid');assert.ok(codes(mixed.carrier).includes('revision_conflict'));assert.equal(mixed.carrier.refs.length,3);
  for(const payload of [{site:'other'},{action:'correct'},{eventAt:'2026-01-01T07:00:00Z'}])assert.equal(one([row(),row(payload)]).carrier.state,'history_conflict');
});
test('C05 gap, absent rev1, rev1 not issue, later issue, postcancel, event order, scope mutation',()=>{
  const cases=[[[row(),correction({revision:3})],'revision_gap'],[[correction()],'revision_gap'],[[row({action:'correct'})],'invalid_transition'],[[row({action:'cancel',quantity:null})],'invalid_transition'],[[row(),correction({action:'issue'})],'invalid_transition'],[[row(),cancel(),correction({revision:3})],'invalid_transition'],[[row(),correction({eventAt:'2026-01-01T07:00:00Z'})],'event_order'],[[row(),correction({contract:'C2'})],'scope_changed'],[[row(),correction({site:'S2'})],'scope_changed']];
  for(const [rows,code] of cases){const p=one(rows);assert.equal(p.carrier.state,'history_conflict');assert.ok(codes(p.carrier).includes(code),code);assert.equal(p.carrier.quantity,null);}
  const malformed=one([row({quantity:'bad'}),correction()]);assert.equal(malformed.carrier.state,'invalid');assert.equal(malformed.carrier.refs.length,2);assert.ok(codes(malformed.carrier).includes('invalid_field'));
  const valid=one([correction({eventAt:'2026-01-01T08:00:00Z',receivedAt:'2026-01-01T08:30:00Z'}),row()]);assert.equal(valid.carrier.state,'active');assert.equal(valid.carrier.quantity,'3');
  const final=one([row(),correction({quantity:'2'}),correction({revision:3,quantity:'8'})]);assert.equal(final.carrier.quantity,'8');
});
test('C06 cancellation terminal, both/no opposite, mixed active, different scope and invalid cancel quantity',()=>{
  const chain=[row(),cancel()];assert.equal(one(chain,chain).status,'both_cancelled');assert.equal(one(chain,[row()]).status,'review_history');assert.equal(one([row()],chain).status,'review_history');assert.equal(one(chain,[]).status,'not_observed_in_source');assert.equal(one([],chain).status,'not_observed_in_source');
  const scoped=[row({site:'S2'}),cancel({site:'S2'})];assert.equal(one(chain,scoped).status,'scope_mismatch');assert.equal(one([row(),cancel({site:'S2'})]).carrier.state,'history_conflict');assert.equal(one([row(),cancel({quantity:'0'})]).carrier.state,'invalid');
  const missing=cancel();delete missing.quantity;assert.equal(one([row(),missing]).carrier.state,'invalid');
});
test('C07 exact structured identity; Unicode point order, length, escaping, own fields and no prototype collisions',()=>{
  const keys=[['D','A','T'],['D','B','T'],['E','A','T'],['D/a','b','c'],['D','a/b','c'],['D','a|b','"c'],['__proto__','constructor','toString'],['D','A','\uE000'],['D','A','\u{10000}'],['D','A','é'],['D','A','e\u0301'],['D','A','😀'.repeat(128)],['D','A','a b']];
  const rows=keys.map(([namespace,series,ticket])=>row({namespace,series,ticket}));const x=run(rows,rows);assert.equal(x.pairs.length,keys.length);assert.equal(x.pairCounts.matched_records,keys.length);
  const order=x.pairs.map(p=>p.key[2]);assert.ok(order.indexOf('\uE000')<order.indexOf('\u{10000}'));for(const key of keys)assert.ok(x.pairs.some(p=>p.key.every((v,i)=>v===key[i])));
  for(const ticket of ['',' T','T ','T\n','\uFEFFT','\ud800','\udc00','😀'.repeat(129)]){const y=run([row({ticket})]);assert.equal(y.pairs.length,0);assert.equal(y.sideCounts.carrier.invalidIdentityRows,1);}
  const inherited=Object.create(row());inherited.receivedAt=row().receivedAt;assert.equal(run([inherited]).pairs.length,0);
  const dangerous=JSON.parse(JSON.stringify(row()).replace(/^\{/, '{"__proto__":{"polluted":true},'));assert.equal(one([dangerous]).carrier.state,'invalid');assert.equal({}.polluted,undefined);
  const grouped=run([row({ticket:'1',contract:'a/b',site:'c'}),row({ticket:'2',contract:'a',site:'b/c'})]);assert.equal(grouped.totals.knownActive.carrier.length,2);
});
test('C08 exact fixed point, zero groups, maximum, large aggregate, invalid input numbers and unit/basis',()=>{
  const values=[['0','0'],['0.000','0'],['0.001','0.001'],['1.010','1.01'],['999999999.999','999999999.999']];for(const [quantity,want] of values){const r=run([row({quantity})],[row({quantity})]);assert.equal(r.pairs[0].matchedQuantity,want);assert.deepEqual(r.totals.matched,total(want));assert.deepEqual(r.totals.comparableDifference,total('0'));}
  for(const quantity of [null,0,1,NaN,Infinity,'','-1','+1','1e0','1E0','01','00.0','1.0000','1000000000','1.',' .1','.1','1 ',' 1','1\n','1\r','1\u2028','NaN','Infinity'])assert.equal(one([row({quantity})]).carrier.state,'invalid',String(quantity));
  for(const override of [{unit:'kg'},{basis:'weighed'},{revision:'1'},{revision:0},{revision:1.1},{revision:10001},{revision:Infinity},{revision:NaN}])assert.equal(one([row(override)]).carrier.state,'invalid');
  const large=Array.from({length:5000},(_,i)=>row({ticket:`${i}`,quantity:'999999999.999'}));const r=run(large);assert.deepEqual(r.totals.knownActive.carrier,total('4999999999995'));assert.equal(r.pairs.length,5000);assert.deepEqual(r.totals.matched,[]);
  const diff=run([row({quantity:'0.001'})],[row({quantity:'0.003'})]);assert.deepEqual(diff.totals.comparableDifference,total('-0.002'));
  const small=run([row({ticket:'1',quantity:'0.1'}),row({ticket:'2',quantity:'0.2'})]);assert.deepEqual(small.totals.knownActive.carrier,total('0.3'));
  const zero=run([row({quantity:'0'})],[row({quantity:'0'})]);assert.deepEqual(zero.totals.knownActive.carrier,total('0'));assert.deepEqual(zero.totals.matched,total('0'));assert.deepEqual(zero.totals.comparableDifference,total('0'));
});
test('C09 scope mismatch for contract/site; no comparable sum, known side totals retained',()=>{
  for(const override of [{contract:'C2'},{site:'S2'}]){const r=run([row()],[row(override)]);assert.equal(r.pairs[0].status,'scope_mismatch');assert.deepEqual(r.totals.comparableDifference,[]);assert.deepEqual(r.totals.matched,[]);assert.deepEqual(r.totals.knownActive.carrier,total('12'));assert.equal(r.totals.knownActive.receiver[0].quantity,'12');}
});
test('C10 Gregorian UTC boundaries, normalized instant equality, invalid dates and receipt before event',()=>{
  for(const bad of ['0000-01-01T00:00:00Z','2026-02-29T00:00:00Z','1900-02-29T00:00:00Z','2026-04-31T00:00:00Z','2026-00-01T00:00:00Z','2026-01-00T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:60:00Z','2026-01-01T00:00:60Z','2026-01-01t00:00:00z','2026-01-01T00:00:00+00:00','2026-01-01','2026-01-01T00:00:00.0000Z','2026-01-01T00:00:00Z\n']){assert.throws(()=>run([],[],bad),HaulEvidenceInputError);assert.equal(one([row({eventAt:bad})]).carrier.state,'invalid');}
  for(const date of ['0001-01-01T00:00:00Z','2000-02-29T00:00:00Z','2024-02-29T00:00:00.1Z','9999-12-31T23:59:59.999Z']){const r=run([],[],date);assert.equal(r.asOf,date.replace('.1Z','.100Z'));}
  const x=reconcileEvidence(env('carrier',[]),env('receiver',[],{periodStart:'2026-01-01T00:00:00.000Z'}),'2026-01-05T00:00:00.00Z');assert.equal(x.periodStart,start);assert.equal(x.asOf,cutoff);
  const p=one([row({receivedAt:'2026-01-01T07:00:00Z'})]);assert.equal(p.carrier.state,'invalid');assert.ok(codes(p.carrier).includes('receipt_before_event'));
});
test('C10 ADR as-of: inclusive cutoff, no future leakage even malformed payload, late predecessor, before period',()=>{
  const late=correction({receivedAt:'2026-01-06T00:00:00Z'});const normal=run([row(),late],[row()]);assert.equal(normal.pairs[0].status,'matched_records');assert.equal(normal.cutoffDiagnostics.carrier.lateReceiptCount,1);assert.equal(run([row(),late],[row()],'2026-01-06T00:00:00Z').pairs[0].carrier.quantity,'3');
  const malformed={receivedAt:'2026-01-06T00:00:00Z',ticket:'SECRET_LATE',garbage:'SECRET_PAYLOAD'};const x=run([row(),malformed],[row()]);assert.deepEqual(x.pairs,normal.pairs);assert.deepEqual(x.totals,normal.totals);assert.equal(JSON.stringify(x).includes('SECRET'),false);assert.equal(x.sideCounts.carrier.invalidRows,0);
  const missingFirst=one([row({receivedAt:'2026-01-06T00:00:00Z'}),correction()]);assert.equal(missingFirst.carrier.state,'history_conflict');assert.deepEqual(missingFirst.carrier.refs.map(r=>r.rowIndex),[2]);
  assert.equal(run([row()],[],'2025-12-31T00:00:00Z').pairs.length,0);
});
test('C10 ADR period boundary and precedence; corrections and cancels after period',()=>{
  const before=row({eventAt:'2025-12-31T00:00:00Z',receivedAt:'2025-12-31T00:00:00Z'});
  const after=row({eventAt:end,receivedAt:end});const future='2026-03-01T00:00:00Z';
  for(const rows of [[before],[before,correction()],[after]]) {assert.equal(one(rows,[],future).status,'out_of_scope');assert.equal(one([],rows,future).status,'out_of_scope');assert.equal(one(rows,rows,future).status,'out_of_scope');assert.equal(one(rows,[row()],future).status,'scope_mismatch');assert.equal(one([row()],rows,future).status,'scope_mismatch');}
  const conflict=[before,{...before,quantity:'11'}];assert.equal(one(conflict,[before]).status,'review_history');assert.equal(one([before],conflict).status,'review_history');assert.equal(one([before],[before,correction({quantity:'bad'})]).status,'review_history');
  const post=correction({eventAt:end,receivedAt:end});assert.equal(one([row(),post],[],future).carrier.quantity,'3');assert.equal(one([row(),{...post,action:'cancel',quantity:null}],[],future).carrier.state,'cancelled');
  assert.equal(one([row({eventAt:start,receivedAt:start})]).carrier.state,'active');assert.equal(one([before,correction({revision:3})]).carrier.state,'history_conflict');
});
test('C11 unknown receipt quarantine, malformed visible identity standalone, all rows counted once',()=>{
  const unknown=row({receivedAt:'bad',quantity:'SECRET_UNKNOWN'});const missing=row({ticket:'missing'});delete missing.receivedAt;
  const invalidIdentity=row({ticket:' ',quantity:'bad'});const y=run([row(),unknown,missing,invalidIdentity,null,[],1,'a',false],[row()]);
  assert.equal(y.pairs.length,2);const p=y.pairs.find(p=>p.key[2]==='T');assert.equal(p.carrier.state,'invalid');assert.deepEqual(p.carrier.reasons,[{code:'unknown_receipt',side:'carrier',rowIndices:[2]}]);assert.deepEqual(p.carrier.refs.map(r=>r.rowIndex),[1,2]);assert.equal(p.carrier.deliveries.length,1);assert.equal(JSON.stringify(y).includes('SECRET_UNKNOWN'),false);
  assert.equal(y.cutoffDiagnostics.carrier.unknownReceiptCount,7);assert.equal(y.sideCounts.carrier.visibleCount,2);assert.equal(y.sideCounts.carrier.invalidRows,8);assert.equal(y.sideCounts.carrier.invalidIdentityRows,6);assert.equal(y.unusableRows.carrier.length,6);assert.deepEqual(y.totals.knownActive.receiver,total('12'));assert.deepEqual(y.totals.knownActive.carrier,[]);
  const malformed=row();delete malformed.quantity;const q=one([malformed,correction()]);assert.equal(q.carrier.state,'invalid');assert.deepEqual(q.carrier.reasons,[{code:'invalid_field',side:'carrier',rowIndices:[1],field:'quantity'}]);
  const unknownProp=one([row({extra:'secret'})]);assert.deepEqual(unknownProp.carrier.reasons,[{code:'unknown_field',side:'carrier',rowIndices:[1]}]);
});
test('C12 unmatched both directions and empty input, no coverage or fabricated pair',()=>{
  const y=run([row({ticket:'1'})],[row({ticket:'2'})]);assert.equal(y.pairCounts.not_observed_in_source,2);assert.equal(y.pairs[0].receiver.state,'not_observed');assert.equal(y.pairs[1].carrier.state,'not_observed');assert.deepEqual(y.pairs[0].receiver.refs,[]);assert.equal(y.pairs[0].receiver.quantity,null);assert.equal(y.coverage,'unverified');
  const empty=run();assert.deepEqual(empty.pairs,[]);assert.equal(Object.values(empty.pairCounts).reduce((a,b)=>a+b,0),0);assert.deepEqual(empty.totals,{knownActive:{carrier:[],receiver:[]},matched:[],comparableDifference:[]});
});
test('ADR atomic whole-input typed failures vs row-level error; role, scope, period, size, exact own keys',()=>{
  const c=env('carrier',[]),r=env('receiver',[]);
  const cases=[null,[],1,{...c,extra:true},{...c,schemaVersion:'other'},{...c,mode:'real'},{...c,source:'x'},{...c,datasetId:' '},{...c,scopeId:'\ud800'},{...c,periodStart:end},{...c,periodEnd:start},{...c,records:{}},{...c,records:new Array(5001).fill(null)},Object.create(c)];
  const missing={...c};delete missing.records;cases.push(missing);
  for(const a of cases) assert.throws(()=>reconcileEvidence(a,r,cutoff),e=>e instanceof HaulEvidenceInputError&&e.code==='invalid_envelope'&&e.name==='HaulEvidenceInputError');
  for(const b of [{...r,source:'carrier'},{...r,scopeId:'other'},{...r,periodEnd:'2026-02-02T00:00:00Z'},{...r,periodStart:'2026-01-02T00:00:00Z'}])assert.throws(()=>reconcileEvidence(c,b,cutoff),e=>e.code==='invalid_pair');
  assert.throws(()=>reconcileEvidence(c,r),e=>e instanceof HaulEvidenceInputError&&e.code==='invalid_as_of');assert.equal(run([null]).sideCounts.carrier.invalidRows,1);
  const sameId=reconcileEvidence({...c,datasetId:'same'},{...r,datasetId:'same'},cutoff);assert.equal(sameId.datasets.carrier.datasetId,'same');
});
test('ADR independent pair precedence matrix (36 combinations, excluding absent/absent)',()=>{
  const states=['active','cancelled','invalid','history_conflict','out_of_scope','not_observed'];
  const rows={active:[row()],cancelled:[row(),cancel()],invalid:[row({quantity:'bad'})],history_conflict:[row(),row({quantity:'2'})],out_of_scope:[row({eventAt:'2025-12-31T00:00:00Z',receivedAt:'2025-12-31T00:00:00Z'})],not_observed:[]};
  // Hand table, row carrier/column receiver. No production policy helpers.
  const M='matched_records', R='review_history', S='scope_mismatch', N='not_observed_in_source', O='out_of_scope', B='both_cancelled';
  const matrix=[[M,R,R,R,S,N],[R,B,R,R,S,N],[R,R,R,R,R,R],[R,R,R,R,R,R],[S,S,R,R,O,O],[N,N,R,R,O,null]];
  for(let i=0;i<states.length;i++)for(let j=0;j<states.length;j++){const x=run(rows[states[i]],rows[states[j]]);if(!matrix[i][j])assert.equal(x.pairs.length,0);else {assert.equal(x.pairs.length,1);assert.equal(x.pairs[0].status,matrix[i][j],`${states[i]} / ${states[j]}`);}}
});
test('ADR pure core / bounded byte adapter DAG and independent oracle',()=>{
  const dir=new URL('../packages/haul-evidence/',import.meta.url);
  const allowed={
    'index.mjs':['validate.mjs','reconcile.mjs','report.mjs','parse.mjs','bytes.mjs'],
    'validate.mjs':[], 'reconcile.mjs':['validate.mjs'], 'report.mjs':['validate.mjs','reconcile.mjs'],
    'parse.mjs':['validate.mjs'], 'bytes.mjs':['validate.mjs']
  };
  function checkModule(file,source){
    assert.ok(Object.hasOwn(allowed,file),file);
    // Static guard for this small reviewed module graph, not a JS sandbox.
    assert.doesNotMatch(source,/\bimport\s*\(/,file);
    const imports=[...source.matchAll(/(?:\bfrom\s*|\bimport\s+)["']([^"']+)["']/g)].map(m=>m[1]);
    assert.ok(imports.every(x=>allowed[file].some(f=>x==='./'+f)),file);
    let guarded=source;
    if(file==='bytes.mjs'){
      guarded=guarded.replace('const provider=globalThis.crypto;','')
        .replace("typeof provider?.subtle?.digest!=='function'",'')
        .replace("provider.subtle.digest('SHA-256',bytes)",'');
    }
    // Retain previous exclusions and add common environment/dynamic-code paths.
    assert.doesNotMatch(guarded,/\b(?:fetch|XMLHttpRequest|document|window|localStorage|process|performance|crypto|eval|Function)\s*[.(\[]|Date\.now\s*\(|new Date\s*\(\s*\)|Math\.random\s*\(/,file);
    assert.doesNotMatch(file==='validate.mjs'?guarded.replace('new Date(0)',''):guarded,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|navigator|document|window|localStorage|sessionStorage|process|performance|crypto|globalThis|global|self|require|eval|Function|setTimeout|setInterval|randomUUID|getRandomValues|provider|subtle)\b|\bMath\s*(?:\.\s*random\b|\[)|\bDate\s*(?:\.\s*now\b|\[|\()|\bnew\s+Date\s*\((?!0\))/,file);
    return [...new Set(imports.map(x=>x.slice(2)))];
  }
  const files=readdirSync(dir).filter(f=>f.endsWith('.mjs')).sort();
  assert.deepEqual(files,Object.keys(allowed).sort());
  const graph=Object.fromEntries(files.map(file=>[file,checkModule(file,readFileSync(new URL(file,dir),'utf8'))]));
  for(const file of files) assert.deepEqual([...graph[file]].sort(),[...allowed[file]].sort(),file);
  function acyclic(g){
    const visiting=new Set(),visited=new Set();
    function visit(file){assert.ok(!visiting.has(file),'cyclic dependency');if(visited.has(file))return;visiting.add(file);for(const dependency of g[file])visit(dependency);visiting.delete(file);visited.add(file);}
    for(const file of Object.keys(g))visit(file);
  }
  acyclic(graph);
  assert.throws(()=>acyclic({'a':['b'],'b':['a']}));
  assert.deepEqual(checkModule('index.mjs',"import {x} from './bytes.mjs';"),['bytes.mjs']);
  assert.deepEqual(checkModule('parse.mjs',"import {x} from './validate.mjs';"),['validate.mjs']);
  assert.deepEqual(checkModule('bytes.mjs',"const provider=globalThis.crypto; if(typeof provider?.subtle?.digest!=='function') throw 0; provider.subtle.digest('SHA-256',bytes);"),[]);
  for(const file of ['validate.mjs','reconcile.mjs','report.mjs','parse.mjs']){
    assert.throws(()=>checkModule(file,"import {x} from './bytes.mjs';"));
    assert.throws(()=>checkModule(file,"globalThis.crypto.subtle.digest('SHA-256',bytes)"));
  }
  for(const source of ["import x from 'node:crypto'","import x from 'fs'","import('./validate.mjs')","fetch('x')","Math.random()","Date.now()","new Date()","Date()","eval('x')","globalThis['fetch']('x')","provider.subtle.digest('SHA-512',bytes)","globalThis.crypto.getRandomValues(bytes)","crypto.randomUUID()","import x from './index.mjs'"]){
    assert.throws(()=>checkModule('bytes.mjs',source),source);
  }
  const oracle=readFileSync(new URL('./helpers/haul-evidence-oracle.mjs',import.meta.url),'utf8');assert.doesNotMatch(oracle,/from\s+['"].*packages\/|reconcileEvidence\s*\(/);
  assert.doesNotMatch(oracle,/\breconcileEvidenceBytes\s*\(|\b(?:parseEvidenceJson|sha256EvidenceBytes|serializeEvidenceReport|withSourceHashes)\s*\(/);
});
