import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSiteGeometry} from '../src/core/site-geometry.mjs';
import {adaptSiteRecord,validateSiteRecord,validateEvidence} from '../src/core/site-catalog.mjs';
import {hash} from '../src/core/request.mjs';
const polygon=(...coordinates)=>({type:'Polygon',coordinates});
const square=(x,y,w=1)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]];
const boundary=polygon(square(1,1,4),square(2,2,1));
test('local WGS84 polygon accepts shell, hole, either orientation and exact decimal grid',()=>{
 for(const g of [boundary,polygon([...square(1,1)].reverse()),polygon([[1,1],[1.5,1],[2,1],[2,2],[1,2],[1,1]]),polygon(square(0.0000001,0.0000001,0.0000001))])assert.equal(validateSiteGeometry(g),g);
});
test('polygon rejects invalid topology, scope, coordinates and resource abuse',()=>{
 const cases=[polygon([[1,1],[3,3],[1,3],[3,1],[1,1]]),polygon([[1,1],[3,1],[2,1],[3,3],[1,1]]),polygon([[1,1],[2,1],[2,2],[1,2]]),polygon([[1,1],[2,1],[1,1],[1,1]]),polygon([[1,1],[2,2],[3,3],[1,1]]),polygon(square(1,1),square(3,3)),polygon(square(1,1,4),square(1,2)),polygon(square(1,1,7),square(2,2,3),square(3,3)),polygon(square(1,1,4),square(2,2,2),square(3,3,2)),polygon([[-179,1],[179,1],[179,2],[-179,2],[-179,1]]),polygon(square(1,90)),polygon(square(181,1)),polygon([[1,1],[1.00000001,1],[2,2],[1,1]]),polygon([[1,1,3],[2,1],[2,2],[1,1]]),polygon([...Array(513).fill([1,1])]),polygon(...Array(17).fill(square(1,1))),{type:'MultiPolygon',coordinates:[]},{...boundary,crs:{}}];
 for(const [i,g] of cases.entries())assert.throws(()=>validateSiteGeometry(g),undefined,`case ${i}`);
});
const horizon={type:'event',label:'synthetic'},truck={bodyM3:2,driveKmh:20},networkMeta={id:'fixture',version:'v1',hash:'a'.repeat(64)},network={nodes:{n1:[0,0]}};
const record={id:'site',sourceRefs:['a','c','l','o','g'],validFrom:'2026-11-01',validUntil:'2026-11-30',operationalStatus:'active',operationalEvidenceRef:'o',geometryStatus:'verified',location:[0,0],geometry:boundary,geometryEvidenceRef:'g',accessNodeId:'n1',accessVerification:{networkId:networkMeta.id,networkVersion:networkMeta.version,networkHash:networkMeta.hash,sourceRef:'a',intraSiteDistanceMm:0},availableCapacityM3:5,capacityEvidence:{sourceRef:'c',horizon},snowTypes:['unknown'],screening:{status:'documented',decision:'allowed',sourceRef:'l',reviewedBy:'synthetic reviewer',reviewedAt:'2026-11-20',ruleId:'synthetic-rule',scope:'synthetic scenario'}};
const evidence=(id,kind,claims)=>({id,kind,scope:'synthetic fixture',checkedAt:'2026-11-20',urls:[],siteId:record.id,horizon,validFrom:record.validFrom,validUntil:record.validUntil,claims});
const records=[evidence('a','access_verification',{networkId:networkMeta.id,networkVersion:networkMeta.version,networkHash:networkMeta.hash,accessNodeId:'n1',location:[0,0],intraSiteDistanceMm:0,truckHash:hash(truck)}),evidence('c','capacity_measurement',{availableCapacityM3:5}),evidence('l','screening_allow',{decision:'allowed',ruleId:record.screening.ruleId,scope:record.screening.scope,reviewedBy:record.screening.reviewedBy,reviewedAt:record.screening.reviewedAt}),evidence('o','operational_status',{operationalStatus:'active'}),evidence('g','site_geometry',{geometry:boundary})];
const ctx={evidence:records,network,networkMeta,horizon,truck,asOf:'2026-11-21',mode:'strict',origin:'candidate',role:'optional'};
test('strict geometry evidence binds exact polygon without inferring entrance, capacity or route',()=>{
 const site=adaptSiteRecord(record,ctx);assert.equal(site.provenance.geometryHash,hash(boundary));assert.equal(site.provenance.geometryUse,'metadata_only');assert.equal(site.accessNodeId,'n1');assert.equal(site.availableCapacityM3,5);assert.deepEqual(site.location,[0,0]);assert.equal(site.geometry,undefined);
 assert.throws(()=>adaptSiteRecord({...record,geometry:polygon(square(1,1,3))},ctx),/Polygon evidence scope/);
 assert.throws(()=>adaptSiteRecord(record,{...ctx,evidence:records.map(e=>e.id==='g'?{...e,siteId:'other'}:e)}),/Polygon evidence scope/);
 assert.throws(()=>validateSiteRecord({...record,geometryEvidenceRef:'missing'},validateEvidence(records)),/source reference/);
});
test('exploratory metadata cannot bypass explicit access and capacity',()=>{
 assert.throws(()=>adaptSiteRecord(record,{...ctx,mode:'exploratory'}),/Explicit scenario/);
 const assumptions={confirmedConditionalAccess:true,accessNodeId:'n1',availableCapacityM3:4,horizon,networkHash:networkMeta.hash,truckHash:hash(truck),reason:'synthetic assumption'};
 const site=adaptSiteRecord(record,{...ctx,mode:'exploratory',assumptions});assert.equal(site.screening.status,'needs_review');assert.equal(site.availableCapacityM3,4);assert.equal(site.provenance.geometryUse,'metadata_only');
});
