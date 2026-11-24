export class DomainError extends Error {
  constructor(message, path='', code='invalid_input', status=422){super(message);this.name='DomainError';this.path=path;this.code=code;this.status=status;}
}
export const requireValid=(condition,message,path,code,status)=>{if(!condition)throw new DomainError(message,path,code,status);};
export const int=(n,min=0,max=1_000_000)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export const id=x=>typeof x==='string'&&x.trim().length>0&&x.length<=200;
export function validateNetwork(network,closed=[]){
  requireValid(network&&network.nodes&&typeof network.nodes==='object'&&!Array.isArray(network.nodes)&&Array.isArray(network.edges),'Некорректная сеть','network');
  const nodes=Object.entries(network.nodes);requireValid(nodes.length>0&&nodes.length<=100000&&network.edges.length<=250000,'Network size limit','network','resource_limit');
  for(const [k,p] of nodes)requireValid(id(k)&&Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90,'Invalid node','network.nodes');
  const ids=new Set();for(const e of network.edges){requireValid(e&&(id(e.id)||Number.isSafeInteger(e.id))&&!ids.has(String(e.id))&&Object.hasOwn(network.nodes,String(e.from))&&Object.hasOwn(network.nodes,String(e.to))&&Number.isFinite(e.km)&&e.km>0&&e.km<=10000&&typeof e.oneway==='boolean'&&(e.routable===undefined||typeof e.routable==='boolean'),'Invalid edge','network.edges');ids.add(String(e.id));}
  requireValid(Array.isArray(closed)&&closed.every(x=>typeof x==='string'&&ids.has(x))&&new Set(closed).size===closed.length,'Unknown or duplicate closed edge','closedEdgeIds');
}
// Shared domain limits: browser forms consume these without duplicating the API contract.
export const TRUCK_LIMITS=Object.freeze({
  bodyM3:Object.freeze({min:1,max:1_000_000,integer:true,required:true}),
  payloadKg:Object.freeze({min:1,max:1_000_000,integer:true,required:false}),
  snowDensityKgM3:Object.freeze({min:1,max:1_000_000,integer:true,required:false}),
  driveKmh:Object.freeze({min:0.1,max:200,integer:false,required:true}),
  rateRubPerHour:Object.freeze({min:0,max:1e7,integer:false,required:false}),
});
export function validTruckValue(field,value){
  const rule=TRUCK_LIMITS[field];
  return !!rule&&(value==null?!rule.required:Number.isFinite(value)&&value>=rule.min&&value<=rule.max&&(!rule.integer||Number.isSafeInteger(value)));
}
export function truckCapacity(t){
  requireValid(t&&validTruckValue('bodyM3',t.bodyM3)&&validTruckValue('driveKmh',t.driveKmh),'Invalid truck body or speed','truck');
  requireValid((t.payloadKg==null)===(t.snowDensityKgM3==null),'Payload and density must be supplied together','truck');
  if(t.payloadKg!=null)requireValid(validTruckValue('payloadKg',t.payloadKg)&&validTruckValue('snowDensityKgM3',t.snowDensityKgM3),'Invalid payload/density','truck');
  requireValid(validTruckValue('rateRubPerHour',t.rateRubPerHour),'Invalid rate','truck.rateRubPerHour');
  const q=t.payloadKg==null?t.bodyM3:Math.min(t.bodyM3,Math.floor(t.payloadKg/t.snowDensityKgM3));requireValid(q>=1,'Truck cannot carry 1 m³','truck');return q;
}
// Legacy has no way to honor these v1/selection inputs. Fail closed at the
// shared module/HTTP boundary, not in the heuristic. Null means unspecified;
// snowType unknown is neutral; zero and [] in constraint fields are meaningful.
function rejectUnsupportedLegacy(s){
  const unsupported=path=>{throw new DomainError('Legacy cannot apply this field; use /api/v1/optimize or explicitly remove the constraint',path,'unsupported_model',422);};
  const present=(o,fields,path='')=>{for(const field of fields)if(o?.[field]!=null)unsupported(path+field);};
  present(s,['schemaVersion','scenario','policy','mapSettings','accessProfiles','constraints','horizon','parentScenarioHash','replacementGroups','excludedSiteIds','excludedConfigurations','fixedSiteIds','includeSiteIds','exactNewSites','exactActiveSites','newSiteCounts','topK','timeLimitMs','requireAllServed','screeningPolicy','objective','preset','searchStrategy']);
  if(s?.mode!=null&&s.mode!=='scenario_only')unsupported('mode');
  present(s?.truck,['snowDensityKgM3','accessProfiles'],'truck.');
  if(Array.isArray(s?.demands))s.demands.forEach((d,i)=>{
    if(d?.snowType!=null&&d.snowType!=='unknown')unsupported(`demands[${i}].snowType`);
  });
  if(Array.isArray(s?.sites))s.sites.forEach((t,i)=>present(t,['maxTripsDuringHorizon','acceptedSnowTypes','intraSiteRoundtripMm','tripLimitEvidence','snowTypeEvidence','intraSiteDistanceEvidence','screening','role','origin','replacementGroup','accessNodeId','availableCapacityM3','sharedAccessJustification','geometryRef','location','accessProfiles','constraints'],`sites[${i}].`));
}
export function validateLegacy(s,network){
  rejectUnsupportedLegacy(s);
  requireValid(s&&Array.isArray(s.demands)&&Array.isArray(s.sites)&&s.demands.length>0&&s.sites.length>0&&s.demands.length<=50&&s.sites.length<=30,'Invalid scenario size','scenario');
  validateNetwork(network,s.closedEdgeIds??[]);
  const ids=new Set();for(const group of ['demands','sites'])for(const x of s[group]){
    requireValid(x&&id(x.id)&&!ids.has(x.id)&&Object.hasOwn(network.nodes,String(x.nodeId)),'Invalid ID/node','scenario.'+group);ids.add(x.id);
    requireValid(group==='demands'?int(x.volumeM3,1):int(x.capacityM3)&&['existing','candidate'].includes(x.kind),'Invalid volume, capacity or kind','scenario.'+group);
  }
  if(s.networkVersion!=null)requireValid(s.networkVersion===network.version,'Network version mismatch','networkVersion','network_mismatch',409);
  const q=truckCapacity({...s.truck,snowDensityKgM3:s.snowDensityKgM3});
  // A conservative bound including fragmentation by site. Legacy uses per-trip objects and quadratic swaps.
  const upper=s.demands.reduce((v,d)=>v+Math.min(d.volumeM3,Math.ceil(d.volumeM3/q)+s.sites.length),0);
  requireValid(upper<=500&&upper*upper*Math.max(1,s.sites.length)<=2_000_000,'Legacy trip work limit; use v1','scenario','resource_limit');
}
