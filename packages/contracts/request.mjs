import {validateConstraints} from './constraints.mjs';
import {createHash} from 'node:crypto';
import {validateNetwork,truckCapacity,requireValid as check,int,id} from './validate.mjs';
export const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
export const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
// Date-only for historical reviews; timestamp must be UTC and calendar-valid.
export function validReviewDate(x){
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(x))return false;
 const n=Date.parse(x);if(!Number.isFinite(n))return false;
 const iso=new Date(n).toISOString();return iso.slice(0,10)===x.slice(0,10)&&(x.length===10||iso.slice(11,19)===x.slice(11,19));
}
export function validateScreening(s,path='screening'){
 check(object(s)&&['unknown','needs_review','documented','conflict','inapplicable','prohibited'].includes(s.status),'Invalid screening status',path);
 if(Object.hasOwn(s,'decision'))check(['allowed','prohibited'].includes(s.decision),'Invalid screening decision',path+'.decision');
 for(const field of ['sourceRef','reviewedBy'])if(Object.hasOwn(s,field))check(id(s[field]),'Invalid screening reference',path+'.'+field);
 if(Object.hasOwn(s,'reviewedAt'))check(validReviewDate(s.reviewedAt),'Invalid review date (YYYY-MM-DD or UTC timestamp)',path+'.reviewedAt');
}
// Exclusions and caller-supplied parent are the only omitted fields. Technical limits are included intentionally.
export function inputFingerprint(request){const copy=structuredClone(request);delete copy.parentScenarioHash;delete copy.policy.excludedSiteIds;delete copy.policy.excludedConfigurations;return hash({model:copy.scenario.sites.some(t=>Object.hasOwn(t,'intraSiteRoundtripMm'))?'fixed-charge-mm-v1.2-intrasite':'fixed-charge-mm-v1.1-constraints',request:copy});}
export function exclusionRerun(parent,child){check(child.parentScenarioHash===hash(parent),'Parent hash mismatch','parentScenarioHash');check(inputFingerprint(parent)===inputFingerprint(child),'Non-exclusion input changed','inputFingerprint');return true;}
// Explicit opt-in; unchanged v1 callers retain their documented role semantics.
export function safeRequest(request){const copy=structuredClone(request);copy.policy.preset='preserve_existing';return copy;}
const list=(v,path,max=1000)=>{check(Array.isArray(v)&&v.length<=max,'Invalid list',path);return v;};
function assertJson(v,depth=0){check(depth<50,'JSON nesting limit','request','resource_limit');if(v===null||typeof v==='string'||typeof v==='boolean')return;if(typeof v==='number'){check(Number.isFinite(v),'Non-finite number','request');return;}check(typeof v==='object'&&v!==null,'Expected JSON data','request');if(Array.isArray(v)){for(const x of v)assertJson(x,depth+1);}else{check(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null,'Expected plain JSON object','request');for(const x of Object.values(v))assertJson(x,depth+1);}}
export function validateRequest(network,request,meta){
 check(object(network),'Invalid network','network');
 meta??={id:network.id??network.scope??'network',version:network.version,hash:hash(network)};
 assertJson(request);check(object(request)&&request.schemaVersion==='1.0','Expected schemaVersion 1.0','schemaVersion');
 check(id(request.networkId)&&id(request.networkVersion)&&hex(request.networkHash),'Network ID/version/hash required','network');
 check(request.networkId===meta.id&&request.networkVersion===meta.version&&request.networkVersion===network.version&&request.networkHash===meta.hash,'Network snapshot mismatch','network','network_mismatch',409);
 const s=request.scenario,p=request.policy;check(object(s)&&object(p),'Scenario and policy required','scenario');
 check(id(s.id)&&s.mode==='scenario_only'&&object(s.horizon)&&id(s.horizon.type)&&id(s.horizon.label),'Scenario ID, mode and horizon required','scenario.horizon');
 validateNetwork(network,s.closedEdgeIds??[]);
 const demands=list(s.demands,'scenario.demands',50),sites=list(s.sites,'scenario.sites',30);check(demands.length>0,'At least one demand required','scenario.demands');
 const ids=new Set(),node=n=>typeof n==='string'&&Object.hasOwn(network.nodes,n),geometry=new Set(),access=new Map();
 for(const d of demands){check(object(d)&&id(d.id)&&!ids.has(d.id)&&node(d.nodeId)&&int(d.volumeM3,0)&&id(d.sourceStatus),'Invalid demand','scenario.demands');ids.add(d.id);}
 for(const t of sites){check(object(t)&&id(t.id)&&!ids.has(t.id)&&node(t.accessNodeId)&&int(t.availableCapacityM3)&&['fixed','optional','excluded'].includes(t.role)&&['existing','candidate'].includes(t.origin)&&object(t.screening)&&['unknown','needs_review','documented','conflict','inapplicable','prohibited'].includes(t.screening.status),'Invalid site','scenario.sites');ids.add(t.id);
  validateScreening(t.screening,'scenario.sites.'+t.id+'.screening');
  if(Object.hasOwn(t,'sharedAccessJustification'))check(id(t.sharedAccessJustification),'Invalid shared access justification','scenario.sites.sharedAccessJustification');
  if(t.geometryRef!=null){check(id(t.geometryRef)&&!geometry.has(t.geometryRef),'Duplicate physical geometry','scenario.sites.geometryRef');geometry.add(t.geometryRef);}
  if(t.location!=null)check(Array.isArray(t.location)&&t.location.length===2&&t.location.every(Number.isFinite)&&Math.abs(t.location[0])<=180&&Math.abs(t.location[1])<=90,'Invalid location','scenario.sites.location');
  if(t.replacementGroup!=null)check(id(t.replacementGroup),'Invalid replacementGroup','scenario.sites');
  const prev=access.get(t.accessNodeId);if(prev)check(id(prev.sharedAccessJustification)&&id(t.sharedAccessJustification),'Shared access requires separate physical-site justification','scenario.sites');access.set(t.accessNodeId,t);
 }
 check(Object.keys(network.nodes).length*new Set([...demands.map(d=>d.nodeId),...sites.map(t=>t.accessNodeId)]).size<=850000,'Route tree memory budget exceeded','network','resource_limit');
 const q=truckCapacity(s.truck);validateConstraints(network,s,meta);const total=demands.reduce((a,d)=>a+d.volumeM3,0);check(total<=1e6,'Demand budget exceeded','scenario.demands','resource_limit');
 check(['add','relocate','greenfield','evaluate','frontier'].includes(p.mode)&&p.objective==='min_unserved_then_distance'&&['exploratory','strict'].includes(p.screeningPolicy)&&int(p.topK,1,50)&&int(p.timeLimitMs,1,120000),'Invalid policy','policy');
 for(const key of ['exactNewSites','exactActiveSites'])if(p[key]!=null)check(int(p[key],0,30),'Invalid site count','policy.'+key);
 check(p.mode!=='add'||p.exactNewSites!=null,'add requires exactNewSites','policy');check(p.mode!=='greenfield'||p.exactActiveSites!=null,'greenfield requires exactActiveSites','policy');
 check(p.mode==='frontier'||p.newSiteCounts==null,'newSiteCounts only for frontier','policy');
 if(p.mode==='frontier')check(p.exactNewSites==null&&list(p.newSiteCounts,'policy.newSiteCounts',10).length>0&&p.newSiteCounts.every(x=>int(x,0,30))&&new Set(p.newSiteCounts).size===p.newSiteCounts.length,'Invalid frontier counts','policy.newSiteCounts');
 check(p.topK*demands.length*sites.length*(p.mode==='frontier'?p.newSiteCounts.length:1)<=25000,'Response budget exceeded','policy.topK','resource_limit');
 if(Object.hasOwn(p,'searchStrategy'))check(['enumeration','unified_milp','bounded_enumeration'].includes(p.searchStrategy),'Invalid search strategy','policy.searchStrategy');
 if(p.requireAllServed!=null)check(typeof p.requireAllServed==='boolean','Invalid requireAllServed','policy');
 if(request.parentScenarioHash!=null)check(hex(request.parentScenarioHash),'Invalid parentScenarioHash','parentScenarioHash');
 const byId=new Map(sites.map(t=>[t.id,t]));
 function siteIds(v,path){list(v,path,30);check(v.every(x=>byId.has(x))&&new Set(v).size===v.length,'Unknown or duplicate site ID',path);return v;}
 const fixed=new Set([...sites.filter(t=>t.role==='fixed').map(t=>t.id),...siteIds(p.fixedSiteIds??[],'policy.fixedSiteIds'),...siteIds(p.includeSiteIds??[],'policy.includeSiteIds')]);
 check(p.mode!=='greenfield'||sites.every(t=>t.origin!=='existing')&&fixed.size===0,'Greenfield must not contain existing or fixed sites','policy');
 const exclusions=new Map();for(const x of list(p.excludedSiteIds??[],'policy.excludedSiteIds',30)){const e=typeof x==='string'?{id:x,reason:'user_exclusion'}:x;check(object(e)&&byId.has(e.id)&&id(e.reason)&&!exclusions.has(e.id),'Invalid exclusion','policy.excludedSiteIds');exclusions.set(e.id,e);}
 const excludedConfigs=new Map();for(const x of list(p.excludedConfigurations??[],'policy.excludedConfigurations',1000)){const e=Array.isArray(x)?{siteIds:x,reason:'user_exclusion'}:x;check(object(e)&&id(e.reason),'Invalid configuration exclusion','policy.excludedConfigurations');const key=JSON.stringify([...siteIds(e.siteIds,'policy.excludedConfigurations.siteIds')].sort());check(!excludedConfigs.has(key),'Duplicate excluded configuration','policy.excludedConfigurations');excludedConfigs.set(key,e);}
 const groups=[],groupIds=new Set(),members=new Set();for(const g of list(p.replacementGroups??[],'policy.replacementGroups',30)){check(object(g)&&id(g.id)&&!groupIds.has(g.id)&&int(g.lower,0,1)&&g.upper===1&&g.lower<=g.upper,'Invalid replacement group','policy.replacementGroups');groupIds.add(g.id);const ids=siteIds(g.siteIds,'policy.replacementGroups.siteIds');check(ids.length>=2&&ids.every(x=>!members.has(x)&&(!byId.get(x).replacementGroup||byId.get(x).replacementGroup===g.id)),'Overlapping or inconsistent replacement group','policy.replacementGroups');ids.forEach(x=>members.add(x));groups.push({...g,siteIds:ids});}
 for(const t of sites)if(t.replacementGroup!=null)check(groups.some(g=>g.id===t.replacementGroup&&g.siteIds.includes(t.id)),'Undeclared replacement group','scenario.sites');
 check(p.mode!=='relocate'||groups.length>0,'Relocate requires replacementGroups','policy');
 if(Object.hasOwn(p,'preset')){
  check(p.preset==='preserve_existing','Unknown policy preset','policy.preset');
  if(p.mode==='add'||p.mode==='frontier')check(groups.length===0,'Use relocate for replacement groups','policy.replacementGroups');
  if(p.mode==='relocate'){
   check(p.exactNewSites!=null&&p.exactActiveSites!=null,'Safe relocate requires both cardinalities','policy');
   for(const g of groups)check(g.siteIds.filter(x=>byId.get(x).origin==='existing').length===1,'Replacement group must contain one original site','policy.replacementGroups');
  }
  if(['add','frontier','relocate'].includes(p.mode))for(const t of sites)if(t.origin==='existing'&&!(p.mode==='relocate'&&members.has(t.id)))fixed.add(t.id);
 }
 for(const e of [...exclusions.values(),...excludedConfigs.values()]){
  for(const field of ['sourceRef','reviewer'])if(Object.hasOwn(e,field))check(id(e[field]),'Invalid exclusion metadata','policy.'+field);
  if(Object.hasOwn(e,'time'))check(validReviewDate(e.time),'Invalid exclusion date','policy.time');
 }
 const reason=t=>{if(t.role==='excluded')return 'role_excluded';if(['conflict','prohibited'].includes(t.screening.status)||t.screening.decision==='prohibited')return 'screening_prohibited';if(p.screeningPolicy==='strict'&&!(t.screening.status==='documented'&&t.screening.decision==='allowed'&&id(t.screening.sourceRef)&&id(t.screening.reviewedBy)&&id(t.screening.reviewedAt)))return 'screening_not_documented';return null;};
 for(const t of sites){const r=reason(t);if(r&&!exclusions.has(t.id))exclusions.set(t.id,{id:t.id,reason:r,...(t.screening.sourceRef?{sourceRef:t.screening.sourceRef}:{})});}
 for(const x of fixed)check(!exclusions.has(x),'Mandatory site excluded: '+x,'policy','fixed_excluded');
 return {s,p,demands,sites,fixed,exclusions,excludedConfigs,groups,q,meta,scenarioHash:hash(request),inputFingerprint:inputFingerprint(request),screeningReason:reason};
}
