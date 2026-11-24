import {requireValid as check,id,int} from './validate.mjs';
import {hash,object,validReviewDate} from './request.mjs';
export const snowTypes=['clean','with_reagents','unknown'];
export function evidenceFor(value,horizon,path){check(object(value)&&id(value.sourceRef)&&validReviewDate(value.observedAt)&&object(value.horizon)&&hash(value.horizon)===hash(horizon),'Constraint evidence must match scenario horizon','scenario.'+path);}
// A separate per-trip distance term. Null is unknown, not an observed zero.
export function validateIntraSiteDistance(t,{horizon,networkHash,truck,accessProfiles}){
 if(!Object.hasOwn(t,'intraSiteRoundtripMm')){check(!Object.hasOwn(t,'intraSiteDistanceEvidence'),'Intra-site evidence without distance','scenario.sites.intraSiteDistanceEvidence');return;}
 check(t.intraSiteRoundtripMm===null||int(t.intraSiteRoundtripMm,0,1e9),'Invalid intra-site roundtrip distance','scenario.sites.intraSiteRoundtripMm');
 if(t.intraSiteRoundtripMm===null){check(!Object.hasOwn(t,'intraSiteDistanceEvidence'),'Unknown intra-site distance cannot have distance evidence','scenario.sites.intraSiteDistanceEvidence');return;}
 const e=t.intraSiteDistanceEvidence;evidenceFor(e,horizon,'sites.intraSiteDistanceEvidence');
 check(e.basis==='roundtrip'&&e.valueMm===t.intraSiteRoundtripMm&&e.networkHash===networkHash&&e.truckHash===hash(truck)&&e.accessProfileHash===hash(accessProfiles??null),'Intra-site evidence basis/snapshot/profile mismatch','scenario.sites.intraSiteDistanceEvidence');
}
export function validateConstraints(network,s,meta){
 for(const d of s.demands)if(Object.hasOwn(d,'snowType'))check(snowTypes.includes(d.snowType),'Invalid snow type','scenario.demands.snowType');
 for(const t of s.sites){
  validateIntraSiteDistance(t,{horizon:s.horizon,networkHash:meta?.hash??hash(network),truck:s.truck,accessProfiles:s.accessProfiles});
  if(Object.hasOwn(t,'maxTripsDuringHorizon'))check(t.maxTripsDuringHorizon===null||int(t.maxTripsDuringHorizon,0,1e6),'Invalid trip limit','scenario.sites.maxTripsDuringHorizon');
  if(t.maxTripsDuringHorizon!=null||Object.hasOwn(t,'tripLimitEvidence'))evidenceFor(t.tripLimitEvidence,s.horizon,'sites.tripLimitEvidence');
  if(Object.hasOwn(t,'acceptedSnowTypes')&&t.acceptedSnowTypes!==null){check(Array.isArray(t.acceptedSnowTypes)&&new Set(t.acceptedSnowTypes).size===t.acceptedSnowTypes.length&&t.acceptedSnowTypes.every(x=>['clean','with_reagents'].includes(x)),'Invalid acceptance types','scenario.sites.acceptedSnowTypes');}
  if(t.acceptedSnowTypes!=null||Object.hasOwn(t,'snowTypeEvidence'))evidenceFor(t.snowTypeEvidence,s.horizon,'sites.snowTypeEvidence');
 }
 if(!Object.hasOwn(s,'accessProfiles'))return;
 const a=s.accessProfiles;check(object(a)&&object(a.loaded)&&object(a.empty),'Both access profiles required','scenario.accessProfiles');
 const ids=new Set(network.edges.map(e=>String(e.id)));for(const name of ['loaded','empty']){const p=a[name];check(int(p.grossKg,1,1e6)&&int(p.widthMm,1,20000)&&Array.isArray(p.blockedEdgeIds)&&new Set(p.blockedEdgeIds).size===p.blockedEdgeIds.length&&p.blockedEdgeIds.every(x=>typeof x==='string'&&ids.has(x)),'Invalid access profile','scenario.accessProfiles.'+name);evidenceFor(p.evidence,s.horizon,'accessProfiles.'+name);}
 check(a.loaded.grossKg>=a.empty.grossKg&&a.loaded.widthMm===a.empty.widthMm,'Inconsistent truck profiles','scenario.accessProfiles');
 if(s.truck.payloadKg!=null)check(a.loaded.grossKg>=a.empty.grossKg+s.truck.payloadKg,'Loaded profile must cover full rated payload','scenario.accessProfiles.loaded');
 check(Array.isArray(a.edgeLimits)&&a.edgeLimits.length<=network.edges.length,'Invalid edge limits','scenario.accessProfiles.edgeLimits');const seen=new Set();for(const e of a.edgeLimits){check(object(e)&&typeof e.edgeId==='string'&&ids.has(e.edgeId)&&!seen.has(e.edgeId)&&(e.maxGrossKg==null||int(e.maxGrossKg,1,1e6))&&(e.maxWidthMm==null||int(e.maxWidthMm,1,20000))&&(e.maxGrossKg!=null||e.maxWidthMm!=null),'Invalid or duplicate edge limit','scenario.accessProfiles.edgeLimits');seen.add(e.edgeId);evidenceFor(e.evidence,s.horizon,'accessProfiles.edgeLimits');}
}
export function blockedEdges(s,direction){const a=s.accessProfiles,p=a?.[direction];return [...new Set([...(s.closedEdgeIds??[]),...(p?.blockedEdgeIds??[]),...(a?.edgeLimits??[]).filter(e=>e.maxGrossKg!=null&&p.grossKg>e.maxGrossKg||e.maxWidthMm!=null&&p.widthMm>e.maxWidthMm).map(e=>e.edgeId)])].sort();}
export function compatible(d,t){return d.snowType==null||d.snowType==='unknown'||t.acceptedSnowTypes==null||t.acceptedSnowTypes.includes(d.snowType);}
