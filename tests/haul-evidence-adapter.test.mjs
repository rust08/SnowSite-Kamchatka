import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {reconcileEvidence,reconcileEvidenceBytes,serializeEvidenceReport,HaulEvidenceInputError} from '../packages/haul-evidence/index.mjs';
import {parseEvidenceJson} from '../packages/haul-evidence/parse.mjs';
import {assertByteFixtureReport,assertConservation} from './helpers/haul-evidence-oracle.mjs';
const fixture=n=>readFileSync(new URL(`./fixtures/haul-evidence/${n}.json`,import.meta.url));
const cb=fixture('carrier'),rb=fixture('receiver'),golden=fixture('expected-report'),expected=JSON.parse(fixture('expected_semantics'));
const cutoff='2026-01-05T00:00:00Z';
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=x=>Buffer.from(JSON.stringify(x));
const carrier=JSON.parse(cb),receiver=JSON.parse(rb),row=carrier.records[0];
const env=(source,records,extra={})=>({...source==='carrier'?carrier:receiver,records,...extra});
const cempty=json(env('carrier',[])),rempty=json(env('receiver',[]));
const run=(c=cb,r=rb,asOf=cutoff)=>reconcileEvidenceBytes(c,r,asOf);
const withoutHashes=r=>{const copy=structuredClone(r);for(const side of ['carrier','receiver'])delete copy.datasets[side].sha256;return copy;};
const rejects=async (c,code,r=rb,asOf=cutoff)=>assert.rejects(()=>reconcileEvidenceBytes(c,r,asOf),e=>e instanceof HaulEvidenceInputError&&e.name==='HaulEvidenceInputError'&&e.code===code&&e.message===code);
const verify=r=>assertByteFixtureReport([cb,rb],cutoff,r,golden,expected);
const withToken=(token,overrides={})=>Buffer.from(JSON.stringify(env('carrier',[{...row,revision:'REVISION_TOKEN',...overrides}])).replace('"REVISION_TOKEN"',token));

test('C13/C15 exact raw hashes, independent golden, canonical UTF-8 export and A1 parity',async()=>{
  const r=await run();verify(r);
  assert.equal(hash(golden),'f63da3f746c70457a126774aeb3c40004ebdd59e40bbb28ad8932ba8f8221d93');
  assert.deepEqual(Buffer.from(serializeEvidenceReport(r)),golden);
  assert.deepEqual(withoutHashes(r),reconcileEvidence(carrier,receiver,cutoff));
  assert.deepEqual(await run(rb,cb),r);assert.deepEqual(await run(),r);
  assert.equal(r.datasets.carrier.sha256,hash(cb));assert.equal(r.datasets.receiver.sha256,hash(rb));
  assert.deepEqual(Object.keys(r.datasets.carrier),['source','datasetId','sha256']);
});
test('C13 whitespace/member order, Buffer subview, same role-qualified dataset ID, snapshot/no mutation',async()=>{
  const baseline=await run();const altered=Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(carrier).reverse()),null,4)+'\n');
  const r=await run(altered,rb);assert.notEqual(r.datasets.carrier.sha256,baseline.datasets.carrier.sha256);assert.equal(r.datasets.carrier.sha256,hash(altered));assert.deepEqual(withoutHashes(r),withoutHashes(baseline));
  const whole=Buffer.concat([Buffer.from('prefix'),cb,Buffer.from('suffix')]);const view=whole.subarray(6,6+cb.length);const before=Buffer.from(whole);
  assert.deepEqual(await run(view,rb),baseline);assert.deepEqual(whole,before);
  const x=Buffer.from(cb),y=Buffer.from(rb);const pending=run(x,y);x.fill(0);y.fill(0);assert.deepEqual(await pending,baseline);
  const sharedId=[json({...carrier,datasetId:'same'}),json({...receiver,datasetId:'same'})];const s=await run(...sharedId);assert.equal(s.datasets.carrier.datasetId,'same');assert.equal(s.datasets.receiver.datasetId,'same');assert.notEqual(s.datasets.carrier.sha256,s.datasets.receiver.sha256);assertConservation(s,sharedId.map(b=>JSON.parse(b)));assert.deepEqual(await run(...sharedId.reverse()),s);
  const foreign=vm.runInNewContext('new Uint8Array(data)',{data:cb});assert.deepEqual(await run(foreign,rb),baseline);
});
test('C14 strict byte type, shared/detached/resizable bounds and crypto failures',async()=>{
  const detached=new Uint8Array(8);structuredClone(detached.buffer,{transfer:[detached.buffer]});
  const resizable=new ArrayBuffer(8,{maxByteLength:16}),outOfBounds=new Uint8Array(resizable,4,4);resizable.resize(2);
  for(const b of [null,undefined,'{}',cb.buffer,new Uint16Array(3),new Uint8ClampedArray(3),new DataView(new ArrayBuffer(2)),new Uint8Array(new SharedArrayBuffer(3)),detached,outOfBounds,new Proxy(cb,{}),{[Symbol.toStringTag]:'Uint8Array'}])await rejects(b,'invalid_bytes');
  await rejects(cb,'invalid_bytes',null);
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  try{
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});await rejects(cb,'crypto_unavailable');
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest(){throw new Error('secret');}}}});await rejects(cb,'crypto_failure');
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest(){return Promise.reject(new Error('secret'));}}}});await rejects(cb,'crypto_failure');
  }finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});
test('C14 byte limits inclusive/exclusive and row count 5000/5001',async()=>{
  const max=2097152;const padded=Buffer.alloc(max,32);cempty.copy(padded);
  const r=await run(padded,rempty);assert.equal(r.sideCounts.carrier.rawCount,0);assert.equal(r.datasets.carrier.sha256,hash(padded));
  await rejects(Buffer.concat([padded,Buffer.from(' ')]),'byte_limit',rempty);
  await rejects(cempty,'byte_limit',Buffer.alloc(max+1));
  const rows=new Array(5000).fill(null);const ok=await run(json(env('carrier',rows)),rempty);assert.equal(ok.sideCounts.carrier.invalidRows,5000);
  await rejects(json(env('carrier',[...rows,null])),'invalid_envelope',rempty);
});
test('C14 strict UTF-8, BOM, JSON lexical grammar and atomic syntax failure',async()=>{
  for(const b of [Buffer.from([0xc0,0xaf]),Buffer.from([0xe2,0x82]),Buffer.from([0xed,0xa0,0x80]),Buffer.from([0xf4,0x90,0x80,0x80]),Buffer.concat([cempty,Buffer.from([0xff])])])await rejects(b,'invalid_utf8');
  await rejects(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),cb]),'utf8_bom');
  for(const s of ['', ' ','{','[1,]','{"a":1,}','{"a":1 "b":2}','{"a" 1}','{"a":01}','{"a":-01}','{"a":+1}','{"a":1.}','{"a":1e}','{"a":1e+}','{"a":NaN}','{"a":Infinity}','{"a":.1}','{"a":true false}','{"a":undefined}','{"a":tru}','{"a":"\\x"}','{"a":"\\u000"}','{"a":"\\u00xz"}','{"a":"\t"}','{"a":"\\','{}{}','\u00a0{}','\ufeff{}\n'.replace('\ufeff',' \ufeff')])await rejects(Buffer.from(s),'invalid_json');
  await rejects(withToken('1e',{receivedAt:'2026-01-06T00:00:00Z'}),'invalid_json');
});
test('C14 decoded duplicate members at all depths and depth 32/33',async()=>{
  const cases=['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"a":[{"x":1,"x":2}]}','{"𐀀":1,"\\ud800\\udc00":2}','{"__proto__":1,"__proto__":2}','{"a":{"b":{"z":0,"\\u007a":1}}}'];
  for(const s of cases)await rejects(Buffer.from(s),'duplicate_member');
  const dup=cb.toString().replace('"revision": 1','"revision": 1, "\\u0072evision": 2');assert.notEqual(dup,cb.toString());await rejects(Buffer.from(dup),'duplicate_member');
  const depth=n=>'['.repeat(n)+'0'+']'.repeat(n);
  const atDepth=n=>Buffer.from(JSON.stringify(env('carrier',[{...row,extra:'DEPTH'}])).replace('"DEPTH"',depth(n)));
  const ok=await run(atDepth(29),rempty);assert.equal(ok.sideCounts.carrier.invalidRows,1);await rejects(atDepth(30),'depth_limit',rempty);
  const objects=n=>'{"x":'.repeat(n)+'0'+'}'.repeat(n);
  const atObjects=n=>Buffer.from(JSON.stringify(env('carrier',[{...row,extra:'DEPTH'}])).replace('"DEPTH"',objects(n)));
  assert.equal((await run(atObjects(29),rempty)).sideCounts.carrier.invalidRows,1);await rejects(atObjects(30),'depth_limit',rempty);
});
test('C14 safe own keys, Unicode and primitive rows; no silent property loss',async()=>{
  const obj=parseEvidenceJson('{"__proto__":{"polluted":true},"constructor":7,"x":0,"X":1,"é":2,"e\\u0301":3}');
  assert.equal(Object.getPrototypeOf(obj),null);assert.equal(Object.hasOwn(obj,'__proto__'),true);assert.equal(obj.__proto__.polluted,true);assert.equal({}.polluted,undefined);assert.equal(obj.constructor,7);assert.equal(Object.keys(obj).length,6);
  const rows=[{...row,ticket:'\ud800'},{...row,ticket:'𐀀'},{...row,ticket:'__proto__'},{...row,ticket:'constructor'},false,0,null,[],{...row,ticket:'extra',['__proto__']:{polluted:true}}];
  const r=await run(json(env('carrier',rows)),rempty);assert.deepEqual(withoutHashes(r),reconcileEvidence(env('carrier',rows),env('receiver',[]),cutoff));assert.equal(r.sideCounts.carrier.invalidRows,6);assert.equal(r.sideCounts.carrier.invalidIdentityRows,5);assert.equal(r.pairs.find(p=>p.key[2]==='extra').carrier.state,'invalid');assert.equal({}.polluted,undefined);
  assert.equal(r.sideCounts.carrier.rawCount,9);assert.equal(r.cutoffDiagnostics.carrier.unknownReceiptCount,4);
});
test('C14 malformed envelopes, pair/version/mode and cutoff reject atomically',async()=>{
  const c=env('carrier',[]),r=env('receiver',[]);
  for(const x of [null,false,[],{...c,mode:'real'},{...c,schemaVersion:'bad'},{...c,source:'unknown'},{...c,records:{}},{...c,scopeId:' '},{...c,extra:true}])await rejects(json(x),'invalid_envelope');
  const missing={...c};delete missing.records;await rejects(json(missing),'invalid_envelope');
  for(const x of [{...r,source:'carrier'},{...r,scopeId:'other'},{...r,periodEnd:'2026-03-01T00:00:00Z'}])await rejects(json(c),'invalid_pair',json(x));
  await rejects(cempty,'invalid_as_of',rempty,'invalid');
});
test('ADR002 exact revision token semantics (range, rounding, huge exponent, direct field only)',async()=>{
  for(const [token,n] of [['1',1],['1.0',1],['1e0',1],['10e-1',1],['10000.000',10000],['0.0001e4',1],['100000e-1',10000],['1e+0000000000000000',1],['1'+'0'.repeat(10000)+'e-10000',1]]){
    const bytes=withToken(token);const r=await run(bytes,rempty);assert.deepEqual(withoutHashes(r),reconcileEvidence(env('carrier',[{...row,revision:n}]),env('receiver',[]),cutoff),token.slice(0,30));assert.equal(r.sideCounts.carrier.invalidRows,0);assert.equal(r.pairs[0].carrier.deliveries[0].revision,n);
  }
  for(const token of ['1.00000000000000001','10000.00000000000001','1e-999999','1e999999','0','-1','1.1','"1"','null','10001','-0','1e'+'9'.repeat(100000),'1e-'+'9'.repeat(100000),'1.'+'0'.repeat(10000)+'1']){
    const r=await run(withToken(token),rempty);assert.equal(r.pairs[0].carrier.state,'invalid');assert.equal(r.sideCounts.carrier.invalidRows,1);assert.deepEqual(r.pairs[0].carrier.reasons,[{code:'invalid_field',side:'carrier',rowIndices:[1],field:'revision'}]);
  }
  const missing={...row};delete missing.revision;assert.equal((await run(json(env('carrier',[missing])),rempty)).pairs[0].carrier.state,'invalid');
  const outside=parseEvidenceJson('{"revision":1.00000000000000001,"records":[{"revision":1.00000000000000001,"nested":{"revision":1.00000000000000001}}]}');assert.equal(outside.revision,1);assert.equal(outside.records[0].revision,null);assert.equal(outside.records[0].nested.revision,1);
  const escaped=withToken('1.00000000000000001').toString().replace('"revision"','"\\u0072evision"');assert.equal((await run(Buffer.from(escaped),rempty)).pairs[0].carrier.state,'invalid');
});
test('ADR002 invalid revision with visible, future, unknown receipts; syntax cannot be quarantined',async()=>{
  const visible=await run(withToken('1.00000000000000001'),rempty);assert.equal(visible.pairs[0].carrier.state,'invalid');
  const future=await run(withToken('1.00000000000000001',{ticket:'SECRET_LATE',receivedAt:'2026-01-06T00:00:00Z'}),rempty);assert.equal(future.cutoffDiagnostics.carrier.lateReceiptCount,1);assert.equal(future.sideCounts.carrier.invalidRows,0);assert.deepEqual(future.pairs,[]);assert.ok(!JSON.stringify(future).includes('SECRET_LATE'));
  const unknown=await run(withToken('1.00000000000000001',{receivedAt:null}),rempty);assert.equal(unknown.cutoffDiagnostics.carrier.unknownReceiptCount,1);assert.deepEqual(unknown.pairs[0].carrier.reasons,[{code:'unknown_receipt',side:'carrier',rowIndices:[1]}]);
  const dup=withToken('1',{receivedAt:'2026-01-06T00:00:00Z'}).toString().replace('"revision":1','"revision":1,"revision":2');await rejects(Buffer.from(dup),'duplicate_member',rempty);
});
test('C15 varied deterministic semantic parity and exact grouped sums',async()=>{
  for(let i=0;i<40;i++){
    const a=env('carrier',Array.from({length:8},(_,j)=>({...row,ticket:`T${j}`,quantity:`${i+j}.001`,site:j%2?'S1':'S2'})));
    const b=env('receiver',a.records.filter((_,j)=>j%3!==0).map((v,j)=>({...v,quantity:j%2?v.quantity:'0.001'})));
    const bytes=[json(a),json(b)],r=await run(...bytes);assert.deepEqual(withoutHashes(r),reconcileEvidence(a,b,cutoff));assertConservation(r,[a,b]);assert.deepEqual(await run(bytes[1],bytes[0]),r);
  }
  const a=env('carrier',Array.from({length:5000},(_,i)=>({...row,ticket:`T${i}`,quantity:'999999999.999'})));const b=env('receiver',a.records);const bytes=[json(a),json(b)];assert.ok(bytes.every(x=>x.length<=2097152));const r=await run(...bytes);assert.equal(r.totals.matched[0].quantity,'4999999999995');assert.equal(r.totals.comparableDifference[0].quantity,'0');assert.equal(r.pairCounts.matched_records,5000);
});
test('C16 independent fixture checker rejects tampered status, quantities, refs, scope, counts, hashes and consistent forgery',async()=>{
  const good=await run();verify(good);const changes=[
    x=>x.pairs[0].status='quantity_mismatch',x=>x.pairs[0].carrier.quantity='13',x=>x.pairs[0].matchedQuantity='13',
    x=>x.pairs[0].carrier.refs[0].rowIndex=0,x=>x.pairs[0].carrier.refs[0].rowIndex=999,x=>x.pairs[0].carrier.refs[0].rowIndex=4,
    x=>x.pairs[0].carrier.refs[0].rowIndex=11,x=>x.pairs[0].carrier.refs[0].source='receiver',x=>x.pairs[0].carrier.refs[0].datasetId='other',
    x=>x.pairs[0].carrier.refs.pop(),x=>x.pairs[0].carrier.refs.push({...x.pairs[0].carrier.refs[0]}),x=>x.pairs[0].carrier.refs.push({source:'carrier',datasetId:'carrier-demo',rowIndex:11}),
    x=>x.pairs[0].carrier.deliveries[0].refs.pop(),x=>x.pairs[0].carrier.deliveries[0].refs[0].rowIndex=4,x=>x.pairs[0].carrier.deliveries[0].refs.push({...x.pairs[0].carrier.deliveries[0].refs[0]}),
    x=>x.totals.matched[0].quantity='21',x=>x.totals.knownActive.receiver[0].quantity='48',x=>x.totals.comparableDifference[0].quantity='0',
    x=>x.datasets.carrier.sha256='0'.repeat(64),x=>x.datasets.receiver.sha256=x.datasets.carrier.sha256,x=>x.sideCounts.carrier.rawCount++,x=>x.cutoffDiagnostics.carrier.lateReceiptCount++,x=>x.pairCounts.matched_records++,
    x=>x.pairs[0].carrier.scope[1]='FORGED',x=>x.scopeId='FORGED',x=>x.asOf='2026-01-06T00:00:00Z',x=>x.periodEnd='2026-03-01T00:00:00Z',
    x=>{x.pairs[0].carrier.quantity='13';x.pairs[0].receiver.quantity='13';x.pairs[0].matchedQuantity='13';x.totals.matched[0].quantity='21';x.totals.knownActive.carrier[0].quantity='40';x.totals.knownActive.receiver[0].quantity='48';},
    x=>x.pairs[0].carrier.deliveries[0].earliestReceipt='2026-01-02T09:00:00Z',x=>x.pairs.pop(),x=>x.coverage='verified',x=>x.extra='unexpected'
  ];
  for(const change of changes){const forged=structuredClone(good);change(forged);assert.throws(()=>verify(forged),assert.AssertionError);}
  assert.throws(()=>assertByteFixtureReport([Buffer.concat([cb,Buffer.from('\n')]),rb],cutoff,good,golden,expected),assert.AssertionError);
  assert.throws(()=>assertByteFixtureReport([cb,rb],'2026-01-06T00:00:00Z',good,golden,expected),assert.AssertionError);
  assertByteFixtureReport([rb,cb],cutoff,good,golden,expected);
});

test('ADR002 differential exact-token arithmetic with independent bounded rational oracle',()=>{
  // All tokens are grammar-valid; small exponents allow independent BigInt powers.
  // The production path never computes powers proportional to arbitrary exponents.
  let cases=0;
  for(const integer of ['0','1','9','10','999','9999','10000','10001','123456789'])
    for(const fraction of ['','0','1','001','0000','99999','00000000000000001'])
      for(const exponent of [-10,-5,-4,-3,-2,-1,0,1,2,3,4,5,10])
        for(const sign of ['','-']){
          const token=sign+integer+(fraction?'.'+fraction:'')+'e'+exponent;
          const numerator=BigInt(sign+integer+fraction)*10n**BigInt(Math.max(0,exponent));
          const denominator=10n**BigInt(fraction.length+Math.max(0,-exponent));
          const v=numerator/denominator;
          const want=numerator%denominator===0n&&v>=1n&&v<=10000n?Number(v):null;
          assert.equal(parseEvidenceJson('{"records":[{"revision":'+token+'}]}').records[0].revision,want,token);cases++;
        }
  assert.equal(cases,1638);
});
test('ADR002 lexical parser differential on ordinary JSON values and escaped strings',()=>{
  const values=[null,true,false,0,-0,1e300,-1e-300,'','\u0000\t\r\n\b\f"\\/','é','𐀀','\ud800',[],{},Object.fromEntries([['__proto__',1],['constructor',2],['0',3],['a',4]])];
  for(const a of values)for(const b of values){
    const text=JSON.stringify([a,{b,other:[a,b]}]);
    assert.equal(JSON.stringify(parseEvidenceJson(text)),JSON.stringify(JSON.parse(text)));
  }
  assert.equal(parseEvidenceJson('1e999999'),Infinity);assert.equal(parseEvidenceJson('-1e-999999'),-0);
});
