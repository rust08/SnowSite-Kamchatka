// Evidence is not a site. This adapter never geocodes, invents capacity or grants permission.
import {hash,object,validReviewDate,validateScreening} from '../contracts/request.mjs';
import {requireValid as check,id,int,truckCapacity} from '../contracts/validate.mjs';
import {validateSiteGeometry} from './site-geometry.mjs';
import {validateIntraSiteDistance} from '../contracts/constraints.mjs';
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const enumOf=(v,values)=>values.includes(v);
const unique=a=>Array.isArray(a)&&new Set(a).size===a.length;
const refList=(refs,known)=>unique(refs)&&refs.length>0&&refs.every(r=>known.has(r));
export function validateEvidence(records){
 check(Array.isArray(records)&&records.length<=10000,'Invalid evidence list','evidence');const map=new Map();
 for(const e of records){check(object(e)&&id(e.id)&&!map.has(e.id)&&id(e.kind)&&typeof e.scope==='string'&&e.scope.trim()&&validReviewDate(e.checkedAt)&&Array.isArray(e.urls)&&e.urls.every(u=>typeof u==='string'&&/^https?:\/\//.test(u)),'Invalid evidence record','evidence');map.set(e.id,e);}return map;
}
export function validateLead(l,known){
 check(object(l)&&id(l.id)&&id(l.locality)&&typeof l.historicalDescription==='string'&&l.historicalDescription.trim()&&id(l.document)&&enumOf(l.historicalStatus,['listed_2017','removed_2019','map_hint'])&&l.operationalStatus==='unknown'&&l.legalStatus==='needs_review'&&enumOf(l.geometryStatus,['unlocated','poi_hint_not_entrance'])&&l.accessNodeId===null&&l.availableCapacityM3===null&&l.eligibleForOptimization===false&&refList(l.sourceIds,known)&&typeof l.notes==='string','Invalid or promoted historical lead','lead');
 check(l.geometryStatus==='unlocated'?l.location===null:point(l.location),'Invalid lead location','lead.location');return l;
}
export function importLeads(leads,evidence,{siteCatalogId='pkgo-history',version='2026-11-21.1'}={}){
 check(id(siteCatalogId)&&id(version),'Invalid catalog metadata','catalog');const known=validateEvidence(evidence);check(Array.isArray(leads)&&leads.length<=10000,'Invalid lead list','sites');
 const seen=new Set(),accepted=[],rejected=[];for(const l of leads){try{validateLead(l,known);check(!seen.has(l.id),'Duplicate lead ID','lead.id');seen.add(l.id);accepted.push(l);}catch(e){rejected.push({id:l?.id??null,reason:e.message,path:e.path??''});}}
 const content={schemaVersion:'site-evidence-1.0',siteCatalogId,version,evidence,leads:accepted};return {catalog:{...content,hash:hash(content)},report:{accepted:accepted.length,rejected,unknown:accepted.filter(l=>l.operationalStatus==='unknown').map(l=>l.id),unlocated:accepted.filter(l=>l.location===null).map(l=>l.id),notEligible:accepted.map(l=>l.id)}};
}
// RFC4180 quoting, BOM and CRLF; no silent field truncation or duplicate headers.
export function parseLeadCsv(raw){
 const rows=[];let row=[],field='',quoted=false,closed=false;raw=raw.replace(/^\uFEFF/,'');
 const push=()=>{row.push(field);field='';closed=false;};const end=()=>{push();rows.push(row);row=[];};
 for(let i=0;i<raw.length;i++){const c=raw[i];if(quoted){if(c==='"'){if(raw[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
 if(c==='"'){check(!field&&!closed,'Unexpected CSV quote','csv');quoted=true;}else if(c===',')push();else if(c==='\n'||c==='\r'){if(c==='\r'&&raw[i+1]==='\n')i++;end();}else{check(!closed,'Unexpected characters after CSV quote','csv');field+=c;}}
 check(!quoted,'Unclosed CSV quote','csv');if(field||row.length||closed)end();const headers=rows.shift();const required=['id','locality','historicalDescription','document','historicalStatus','operationalStatus','legalStatus','geometryStatus','location','accessNodeId','availableCapacityM3','sourceIds','eligibleForOptimization','notes'];check(headers&&unique(headers)&&headers.length===required.length&&required.every(k=>headers.includes(k)),'Invalid CSV headers','csv');
 return rows.map(r=>{check(r.length===headers.length,'Invalid CSV row width','csv');const l=Object.fromEntries(headers.map((k,i)=>[k,r[i]]));l.location=l.location?JSON.parse(l.location):null;l.accessNodeId=l.accessNodeId||null;l.availableCapacityM3=l.availableCapacityM3===''?null:Number(l.availableCapacityM3);l.sourceIds=l.sourceIds.split(';');check(['False','True','false','true'].includes(l.eligibleForOptimization),'Invalid CSV boolean','csv');l.eligibleForOptimization=l.eligibleForOptimization.toLowerCase()==='true';return l;});
}
const sameHorizon=(a,b)=>object(a)&&object(b)&&hash(a)===hash(b);
const hasScoped=(known,ref,kind,siteId,horizon,asOf,claims)=>{const e=known.get(ref);return e?.kind===kind&&e.siteId===siteId&&sameHorizon(e.horizon,horizon)&&validReviewDate(e.validFrom)&&validReviewDate(e.validUntil)&&Date.parse(e.validFrom)<=Date.parse(asOf)&&Date.parse(asOf)<=Date.parse(e.validUntil)&&Date.parse(e.checkedAt)<=Date.parse(asOf)&&object(e.claims)&&Object.entries(claims).every(([k,v])=>Object.hasOwn(e.claims,k)&&hash(e.claims[k])===hash(v));};
export function validateSiteRecord(r,known){
 check(object(r)&&id(r.id)&&refList(r.sourceRefs,known)&&enumOf(r.operationalStatus,['unknown','historical','active','planned','closed'])&&enumOf(r.geometryStatus,['unlocated','approximate','verified'])&&(r.location===null||point(r.location))&&(r.accessNodeId===null||id(r.accessNodeId))&&(r.availableCapacityM3===null||int(r.availableCapacityM3))&&Array.isArray(r.snowTypes)&&unique(r.snowTypes)&&r.snowTypes.every(x=>enumOf(x,['clean','with_reagents','unknown'])),'Invalid SiteRecord','record');
 for(const k of ['validFrom','validUntil'])check(r[k]===null||validReviewDate(r[k]),'Invalid site validity','record.'+k);
 check(r.validFrom===null||r.validUntil===null||Date.parse(r.validFrom)<=Date.parse(r.validUntil),'Invalid validity interval','record');
 check(r.geometryStatus!=='verified'||r.location!==null,'Verified site requires coordinates','record.location');
 if(Object.hasOwn(r,'geometry')){validateSiteGeometry(r.geometry);check(r.geometryStatus!=='unlocated'&&r.sourceRefs.includes(r.geometryEvidenceRef)&&known.has(r.geometryEvidenceRef),'Polygon requires located record and source reference','record.geometryEvidenceRef');}
 else check(!Object.hasOwn(r,'geometryEvidenceRef'),'Geometry evidence without polygon','record.geometryEvidenceRef');
 if(Object.hasOwn(r,'operationalEvidenceRef'))check(known.has(r.operationalEvidenceRef),'Unknown operation evidence','record.operationalEvidenceRef');
 validateScreening(r.screening,'record.screening');if(r.screening.sourceRef)check(known.has(r.screening.sourceRef),'Unknown screening evidence','record.screening.sourceRef');
 if(r.accessVerification!==null){const a=r.accessVerification;check(object(a)&&id(a.networkId)&&id(a.networkVersion)&&typeof a.networkHash==='string'&&/^[a-f0-9]{64}$/.test(a.networkHash)&&known.has(a.sourceRef)&&int(a.intraSiteDistanceMm,0,1e9)&&(!Object.hasOwn(a,'intraSiteDistanceBasis')||a.intraSiteDistanceBasis==='roundtrip'),'Invalid access verification','record.accessVerification');}
 if(r.capacityEvidence!==null)check(object(r.capacityEvidence)&&known.has(r.capacityEvidence.sourceRef)&&object(r.capacityEvidence.horizon),'Invalid capacity evidence','record.capacityEvidence');
 return r;
}
// Convert only an explicitly selected record; leads cannot pass this contract.
// Strict adapter verifies supplied evidence scope, not signatures or real-world truth.
export function adaptSiteRecord(record,{evidence,network,networkMeta,horizon,asOf,truck,accessProfiles,mode='exploratory',assumptions,origin,role}){
 const known=validateEvidence(evidence);const r=validateSiteRecord(record,known);truckCapacity(truck);check(object(horizon)&&validReviewDate(asOf)&&enumOf(mode,['exploratory','strict'])&&enumOf(origin,['existing','candidate'])&&enumOf(role,['fixed','optional','excluded']),'Invalid adapter context','adapter');
 check(!['prohibited','conflict'].includes(r.screening.status)&&r.screening.decision!=='prohibited'&&r.operationalStatus!=='closed','Site is blocked or closed','record','site_excluded');
 const meta=networkMeta??{id:network.id,version:network.version,hash:hash(network)};
 let capacity,node,screening,notes=[],intraSite={};
 if(mode==='strict'){
  const a=r.accessVerification,c=r.capacityEvidence;
  check(r.operationalStatus==='active'&&r.geometryStatus==='verified'&&r.validFrom!==null&&r.validUntil!==null&&Date.parse(r.validFrom)<=Date.parse(asOf)&&Date.parse(asOf)<=Date.parse(r.validUntil)&&r.availableCapacityM3!==null&&a&&c&&r.accessNodeId&&r.screening.status==='documented'&&r.screening.decision==='allowed'&&id(r.screening.reviewedBy)&&validReviewDate(r.screening.reviewedAt),'Missing operational evidence','record');
  check(a.networkId===meta.id&&a.networkVersion===meta.version&&a.networkHash===meta.hash&&sameHorizon(c.horizon,horizon),'Evidence snapshot/horizon mismatch','record');
  check(id(r.screening.ruleId)&&id(r.screening.scope)&&Date.parse(r.screening.reviewedAt)<=Date.parse(asOf)&&[a.sourceRef,c.sourceRef,r.screening.sourceRef,r.operationalEvidenceRef].every(ref=>r.sourceRefs.includes(ref)), 'Missing scoped evidence references','record');
  check(a.intraSiteDistanceMm===0||a.intraSiteDistanceBasis==='roundtrip','Positive intra-site distance requires explicit roundtrip basis','record.accessVerification','unsupported_model');
  const explicitBasis=a.intraSiteDistanceBasis==='roundtrip';
  check(hasScoped(known,a.sourceRef,'access_verification',r.id,horizon,asOf,{networkId:a.networkId,networkVersion:a.networkVersion,networkHash:a.networkHash,accessNodeId:r.accessNodeId,location:r.location,intraSiteDistanceMm:a.intraSiteDistanceMm,truckHash:hash(truck),...(explicitBasis?{intraSiteDistanceBasis:'roundtrip',accessProfileHash:hash(accessProfiles??null)}:{})})&&hasScoped(known,c.sourceRef,'capacity_measurement',r.id,horizon,asOf,{availableCapacityM3:r.availableCapacityM3})&&hasScoped(known,r.screening.sourceRef,'screening_allow',r.id,horizon,asOf,{decision:'allowed',ruleId:r.screening.ruleId,scope:r.screening.scope,reviewedBy:r.screening.reviewedBy,reviewedAt:r.screening.reviewedAt})&&hasScoped(known,r.operationalEvidenceRef,'operational_status',r.id,horizon,asOf,{operationalStatus:'active'}),'Evidence scope or claimed values not verified','record');
  if(explicitBasis)intraSite={intraSiteRoundtripMm:a.intraSiteDistanceMm,intraSiteDistanceEvidence:{basis:'roundtrip',valueMm:a.intraSiteDistanceMm,sourceRef:a.sourceRef,observedAt:known.get(a.sourceRef).checkedAt,horizon,networkHash:meta.hash,truckHash:hash(truck),accessProfileHash:hash(accessProfiles??null)}};
  if(r.geometry)check(hasScoped(known,r.geometryEvidenceRef,'site_geometry',r.id,horizon,asOf,{geometry:r.geometry}),'Polygon evidence scope or claimed geometry not verified','record.geometry');
  capacity=r.availableCapacityM3;node=r.accessNodeId;screening=r.screening;notes=['caller-supplied scoped evidence, not official approval'];
 }else{
  check(object(assumptions)&&assumptions.confirmedConditionalAccess===true&&id(assumptions.accessNodeId)&&int(assumptions.availableCapacityM3)&&sameHorizon(assumptions.horizon,horizon)&&assumptions.networkHash===meta.hash&&assumptions.truckHash===hash(truck)&&id(assumptions.reason),'Explicit scenario capacity/access/horizon/profile required','assumptions');
  if(Object.hasOwn(assumptions,'intraSiteRoundtripMm'))intraSite.intraSiteRoundtripMm=assumptions.intraSiteRoundtripMm;
  if(Object.hasOwn(assumptions,'intraSiteDistanceEvidence'))intraSite.intraSiteDistanceEvidence=assumptions.intraSiteDistanceEvidence;
  capacity=assumptions.availableCapacityM3;node=assumptions.accessNodeId;screening={status:'needs_review'};notes=['conditional access and capacity, unknown legal/operational suitability',assumptions.reason];
 }
 check(Object.hasOwn(network.nodes,node),'Unknown access node','record.accessNodeId');
 validateIntraSiteDistance(intraSite,{horizon,networkHash:meta.hash,truck,accessProfiles});
 return {id:r.id,accessNodeId:node,availableCapacityM3:capacity,origin,role,screening,...intraSite,...(r.location?{location:r.location}:{}),provenance:{sourceRefs:r.sourceRefs,recordHash:hash(r),...(r.geometry?{geometryHash:hash(r.geometry),geometryEvidenceRef:r.geometryEvidenceRef,geometryUse:'metadata_only'}:{}),networkHash:meta.hash,asOf,mode,assumptions:notes,...(mode==='exploratory'?{inputAssumptions:assumptions}:{})}};
}
