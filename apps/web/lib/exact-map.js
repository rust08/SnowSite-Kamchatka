// Map editor adapter. No DOM, solver, filesystem or network dependency.
// Full evidence-bearing v1 requests belong to exact.html, not this scenario editor.
import {id as validId,truckCapacity} from './contracts/validate.mjs';
const clone = v => structuredClone(v);
const integer = (v,min,max) => Number.isSafeInteger(v) && v>=min && v<=max;
const fail = message => { throw Error(message); };
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const key = ids => JSON.stringify([...ids].sort());
export function defaultSettings(){return {count:1,topK:5,timeLimitMs:15000,replacements:[],excludedSiteIds:[],excludedConfigurations:[]};}
export function normalizeSettings(raw,scenario){
 const s=raw==null?defaultSettings():clone(raw);
 if(!s||!integer(s.count,0,30)||!integer(s.topK,1,50)||!integer(s.timeLimitMs,1,120000))fail('Неверное число площадок, Top-K или лимит времени');
 const by=new Map(scenario.sites.map(t=>[t.id,t]));
 if(!Array.isArray(s.replacements)||!Array.isArray(s.excludedSiteIds)||!Array.isArray(s.excludedConfigurations))fail('Некорректные настройки выбора');
 const seen=new Set();
 for(const r of s.replacements){if(!r||by.get(r.candidateId)?.kind!=='candidate'||by.get(r.existingId)?.kind!=='existing'||seen.has(r.candidateId))fail('Некорректная группа переноса');seen.add(r.candidateId);}
 const reason=e=>typeof e?.reason==='string'&&e.reason.trim().length>0&&e.reason.length<=200;
 const excluded=new Set();for(const e of s.excludedSiteIds){if(!reason(e)||by.get(e.id)?.kind!=='candidate'||excluded.has(e.id))fail('Некорректное исключение кандидата');excluded.add(e.id);}
 const configs=new Set();for(const e of s.excludedConfigurations){if(!reason(e)||!Array.isArray(e.siteIds)||e.siteIds.some(id=>!by.has(id))||new Set(e.siteIds).size!==e.siteIds.length||configs.has(key(e.siteIds)))fail('Некорректное исключение конфигурации');configs.add(key(e.siteIds));}
 if(s.excludedConfigurations.length>1000)fail('Слишком много исключённых конфигураций');
 return {count:s.count,topK:s.topK,timeLimitMs:s.timeLimitMs,replacements:s.replacements,excludedSiteIds:s.excludedSiteIds,excludedConfigurations:s.excludedConfigurations};
}
export function removeSiteSettings(settings,id){return {...settings,replacements:settings.replacements.filter(r=>r.existingId!==id&&r.candidateId!==id),excludedSiteIds:settings.excludedSiteIds.filter(e=>e.id!==id),excludedConfigurations:settings.excludedConfigurations.filter(e=>!e.siteIds.includes(id))};}
export function availableAdditions(scenario,settings){const replaced=new Set(settings.replacements.map(r=>r.candidateId)),excluded=new Set(settings.excludedSiteIds.map(e=>e.id));return scenario.sites.filter(t=>t.kind==='candidate'&&!replaced.has(t.id)&&!excluded.has(t.id)).length;}
export function buildExactRequest(scenario,rawSettings,meta,parentScenarioHash){
 const s=normalizeSettings(rawSettings,scenario),existing=scenario.sites.filter(t=>t.kind==='existing');
 const grouped=new Map();for(const r of s.replacements){if(!grouped.has(r.existingId))grouped.set(r.existingId,[r.existingId]);grouped.get(r.existingId).push(r.candidateId);}
 const replacementGroups=[...grouped].map(([id,siteIds])=>({id:'replacement:'+id,siteIds,lower:1,upper:1}));
 const members=new Set(replacementGroups.flatMap(g=>g.siteIds));
 const horizon={type:'event',label:'Условный снегопад — редактор карты'};
 const evidence=(ref)=>{if(!validDate(scenario.assumptionDate))fail('Укажите дату сценарного допущения при вводе ограничений');return {sourceRef:'scenario_only (user assumption, not observation): '+ref,observedAt:scenario.assumptionDate,horizon};};
 const truck={...scenario.truck,snowDensityKgM3:scenario.snowDensityKgM3??null};
 if((truck.payloadKg==null)!==(truck.snowDensityKgM3==null))fail('Грузоподъёмность и плотность задаются вместе или обе оставляются пустыми');
 return {schemaVersion:'1.0',networkId:meta.networkId,networkVersion:meta.networkVersion,networkHash:meta.networkHash,
  scenario:{id:scenario.id,mode:'scenario_only',horizon,truck,closedEdgeIds:clone(scenario.closedEdgeIds??[]),
   demands:scenario.demands.map(d=>({id:d.id,name:d.name,nodeId:d.nodeId,volumeM3:d.volumeM3,sourceStatus:'synthetic',...(d.snowType?{snowType:d.snowType}:{})})),
   sites:scenario.sites.map(t=>({id:t.id,name:t.name,accessNodeId:t.nodeId,availableCapacityM3:t.capacityM3,origin:t.kind,role:t.kind==='existing'&&!members.has(t.id)?'fixed':'optional',screening:{status:'unknown'},...(t.maxTripsDuringHorizon!=null?{maxTripsDuringHorizon:t.maxTripsDuringHorizon,tripLimitEvidence:evidence('user trip limit '+t.id)}:{}),...(t.acceptedSnowTypes!=null?{acceptedSnowTypes:clone(t.acceptedSnowTypes),snowTypeEvidence:evidence('user snow types '+t.id)}:{})}))},
  policy:{mode:existing.length?(replacementGroups.length?'relocate':'add'):'greenfield',preset:'preserve_existing',...(existing.length?{exactNewSites:s.count,exactActiveSites:existing.length+s.count}:{exactActiveSites:s.count}),replacementGroups,topK:s.topK,timeLimitMs:s.timeLimitMs,searchStrategy:'bounded_enumeration',objective:'min_unserved_then_distance',screeningPolicy:'exploratory',excludedSiteIds:clone(s.excludedSiteIds),excludedConfigurations:clone(s.excludedConfigurations)},...(parentScenarioHash?{parentScenarioHash}:{})};
}
export function hasExactOnlySettings(scenario,settings){return !!(settings.replacements.length||settings.excludedSiteIds.length||settings.excludedConfigurations.length||scenario.sites.some(t=>t.maxTripsDuringHorizon!=null||t.acceptedSnowTypes!=null)||scenario.demands.some(d=>d.snowType&&d.snowType!=='unknown'));}
// Convert aggregate rows without expanding trips, even for a million-trip scenario.
export function exactVariants(result,sites){
 const names=new Map(sites.map(t=>[t.id,t.name??t.id]));
 const adapt=(r,isBase,i)=>({key:isBase?'base':'exact:'+r.configurationId,label:isBase?'База':(result.search.rankingStatus==='exact_top_k'?'№ ':'Найденный № ')+(i+1),comp:r.activeSiteIds.map(id=>names.get(id)??id).join(' + '),siteIds:r.activeSiteIds,isBase,res:r});
 return [...(result.baseline?[adapt(result.baseline,true,0)]:[]),...result.alternatives.map((r,i)=>adapt(r,false,i))];
}
export function rankingText(result){
 const s=result.search;const status={exact_top_k:'Точный рейтинг доказан',provisional:'Предварительный рейтинг — оптимальность полного Top-K не доказана',incomplete:'Поиск не завершён — нет найденных альтернатив',infeasible:'Нет допустимых комбинаций в заданном каталоге'}[s.rankingStatus]??'Неизвестный статус';
 return `${status} (${s.rankingStatus}). Альтернатив: ${s.topKReturned} из ${s.topKRequested}; решено: ${s.proven}/${s.configurationsTotal??'?'}, отсечено: ${s.prunedByBound??0}. Solver: ${result.solver.status}.`;
}
const reasons={snow_type_mismatch:'несовместимость типов снега',no_compatible_round_trip_route:'нет совместимого пути туда и обратно',no_round_trip_route:'нет пути туда и обратно',capacity_trip_limit_or_allocation_constraint:'ёмкость, лимит рейсов или ограничения распределения',capacity_or_allocation_constraint:'ёмкость или ограничения распределения',solver_incomplete:'вычисление не завершено',capacity_exhausted:'недостаточная доступная вместимость'};
export const reasonText=r=>r.message??reasons[r.code]??r.code;
export function exactComparable(base,v){return !!base&&base.status==='optimal'&&v.status==='optimal'&&v.comparableToBaseline===true&&base.servedM3===v.servedM3;}
export function exactHeadline(total,base,v,isBase){
 const status=v.status==='optimal'?'Назначение оптимально для этого набора.':'Назначение предварительное; оптимальность не доказана.';
 const volume=`Вывезено ${v.servedM3} из ${total} м³; осталось ${v.unservedM3} м³.`;
 const delta=!isBase&&exactComparable(base,v)?` Изменение пробега к базе: ${v.deltaKm>0?'+':''}${v.deltaKm.toLocaleString('ru-RU',{maximumFractionDigits:6})} км (модель, не фактическая экономия).`:!isBase?' Сравнение пробега с базой недоступно.':'';
 return {tone:v.unservedM3>0||v.status!=='optimal'?'warn':'info',text:volume+' '+status+delta};
}
// Reconstruct only the selected assignment's road geometry from the canonical engine.
// An integer-distance mismatch is an explicit rendering failure, not a different route.
export function exactRoute(engine,a){
 const out=engine.path(a.routeRef.from,a.routeRef.to),home=engine.path(a.routeRef.to,a.routeRef.from);
 if(!out||!home||Math.round(out.km*1e6)!==a.loadedDistanceMm||Math.round(home.km*1e6)!==a.emptyDistanceMm)throw Error('Геометрия маршрута не совпадает с матрицей MILP: '+a.demandId+' → '+a.siteId);
 return {...a,outward:out,home,outwardKm:out.km,homeKm:home.km,kmPerTrip:a.roundtripMm/1e6};
}
export function assignmentRows(res,exact,legacyAggregate){return exact?res.assignments.map(a=>({...a,outwardKm:a.loadedDistanceMm/1e6,homeKm:a.emptyDistanceMm/1e6,kmPerTrip:a.roundtripMm/1e6})):legacyAggregate(res.assignments);}

// Do not infer a source binding from the current graph. Verify all explicitly
// supplied claims, even when node IDs still exist on a different snapshot.
export function validateMapNetworkBinding(raw,network,meta={}){
  const binding={};
  if(raw.meta!=null&&(typeof raw.meta!=='object'||Array.isArray(raw.meta)))fail('Некорректные метаданные привязки сети');
  for(const [field,expected] of [['networkVersion',network.version],['networkHash',meta.networkHash]]){
    for(const [path,value] of [[field,raw[field]],['meta.'+field,raw.meta?.[field]]]){
      if(value==null)continue;
      if(typeof value!=='string'||value.length===0||expected==null||value!==expected||binding[field]!=null&&binding[field]!==value)fail('Сценарий создан для другой версии дорожной сети или привязка не проверена: '+path);
      binding[field]=value;
    }
  }
  return binding;
}
export function sanitizeScenario(raw,network,meta={}){
  if(raw?.schemaVersion||raw?.scenario||raw?.policy||raw?.accessProfiles||raw?.horizon)throw Error('Расширенный JSON v1 открывается на /exact.html; карта не удаляет его ограничения');
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.sites)||!Array.isArray(raw.demands))throw Error('Неверная структура JSON');
  const binding=validateMapNetworkBinding(raw,network,meta);
  if(raw.id!=null&&!validId(raw.id))fail('Некорректный ID сценария (до 200 символов)');
  if(raw.sites.some(t=>t&&['intraSiteRoundtripMm','intraSiteDistanceEvidence','screening','tripLimitEvidence','snowTypeEvidence','accessNodeId','sharedAccessJustification','replacementGroup','geometryRef','role','origin','location'].some(k=>Object.hasOwn(t,k))))throw Error('Расширенные ограничения открываются на /exact.html');
  if(raw.assumptionDate!=null&&!validDate(raw.assumptionDate))throw Error('Некорректная дата сценарного допущения');
  if(raw.demands.some(d=>d&&['sourceStatus','sourceRef','observedAt'].some(k=>Object.hasOwn(d,k)))||Object.hasOwn(raw.truck??{},'snowDensityKgM3'))throw Error('Расширенный JSON v1 открывается на /exact.html');
  if(raw.closedEdgeIds!=null&&(!Array.isArray(raw.closedEdgeIds)||new Set(raw.closedEdgeIds.map(String)).size!==raw.closedEdgeIds.length||raw.closedEdgeIds.some(e=>!network.edges.some(x=>String(x.id)===String(e)))))throw Error('Некорректные перекрытия дорог');
  if(raw.demands.length>50||raw.sites.length>30)throw Error('Слишком много точек (до 50 источников и 30 площадок)');
  const ids=new Set(),str=(v,d)=>typeof v==='string'&&v.trim()?v.trim().slice(0,120):d;
  const chk=(x,g)=>{if(!x||!validId(x.id)||ids.has(x.id))throw Error('ID точек должны быть уникальными и содержать не более 200 символов');ids.add(x.id);
    if(!Object.hasOwn(network.nodes,String(x.nodeId)))throw Error('Точка '+x.id+' не привязана к узлу текущей дорожной сети');
    if(g==='d'&&!(Number.isSafeInteger(x.volumeM3)&&x.volumeM3>0&&x.volumeM3<=1000000))throw Error('Объём источника '+x.id+' должен быть целым положительным');
    if(g==='s'&&!(Number.isSafeInteger(x.capacityM3)&&x.capacityM3>=0&&x.capacityM3<=1000000))throw Error('Вместимость площадки '+x.id+' должна быть целой неотрицательной');
    if(g==='s'&&!['existing','candidate'].includes(x.kind))throw Error('Тип площадки '+x.id+' должен быть existing или candidate');};
  raw.demands.forEach(x=>{chk(x,'d');if(x.snowType!=null&&!['clean','with_reagents','unknown'].includes(x.snowType))throw Error('Некорректный тип снега');});raw.sites.forEach(x=>{chk(x,'s');if(x.maxTripsDuringHorizon!=null&&(!Number.isSafeInteger(x.maxTripsDuringHorizon)||x.maxTripsDuringHorizon<0||x.maxTripsDuringHorizon>1000000))throw Error('Некорректный лимит рейсов');if(x.acceptedSnowTypes!=null&&(!Array.isArray(x.acceptedSnowTypes)||new Set(x.acceptedSnowTypes).size!==x.acceptedSnowTypes.length||x.acceptedSnowTypes.some(v=>!['clean','with_reagents'].includes(v))))throw Error('Некорректные принимаемые типы снега');});
  if(raw.demands.reduce((n,d)=>n+d.volumeM3,0)>1000000)throw Error('Общий объём превышает 1 млн м³');
  if(new Set(raw.sites.map(t=>String(t.nodeId))).size!==raw.sites.length)throw Error('Две площадки не могут занимать один дорожный узел в редакторе карты');
  if(raw.sites.some(t=>t.maxTripsDuringHorizon!=null||t.acceptedSnowTypes!=null)&&!validDate(raw.assumptionDate))throw Error('Ограничения требуют дату сценарного допущения (assumptionDate)');
  const t=raw.truck||{};
  truckCapacity({...t,snowDensityKgM3:raw.snowDensityKgM3});
  return {...binding,id:raw.id??'imported',name:str(raw.name,'Импортированный сценарий'),mode:'scenario_only',provenance:str(raw.provenance,'Импорт пользователя; не подтверждено'),
    truck:{bodyM3:t.bodyM3,payloadKg:t.payloadKg??null,driveKmh:t.driveKmh,rateRubPerHour:t.rateRubPerHour??null},snowDensityKgM3:raw.snowDensityKgM3??null,
    closedEdgeIds:Array.isArray(raw.closedEdgeIds)?raw.closedEdgeIds.map(String):[],...(raw.assumptionDate?{assumptionDate:raw.assumptionDate}:{}),
    demands:raw.demands.map(x=>({id:x.id,name:str(x.name,x.id),nodeId:String(x.nodeId),volumeM3:x.volumeM3,...(x.snowType?{snowType:x.snowType}:{})})),
    sites:raw.sites.map(x=>({id:x.id,name:str(x.name,x.id),nodeId:String(x.nodeId),capacityM3:x.capacityM3,kind:x.kind,legalStatus:'unverified',...(x.maxTripsDuringHorizon!=null?{maxTripsDuringHorizon:x.maxTripsDuringHorizon}:{}),...(x.acceptedSnowTypes!=null?{acceptedSnowTypes:[...x.acceptedSnowTypes]}:{})}))};
}
