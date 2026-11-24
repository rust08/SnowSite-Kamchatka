/** Scenario-only capacitated assignment heuristic, not a global optimizer.
 * Output numbers are conditional on input assumptions and road graph limitations.
 * Sites are never legally approved by this module.
 */
import {createRouteEngine} from '../routing/engine.mjs';
import {validateLegacy as validate,DomainError} from '../contracts/validate.mjs';
function tripLimit(s){
  const truck=s.truck;const limited=truck.payloadKg==null?truck.bodyM3:Math.min(truck.bodyM3,Math.floor(truck.payloadKg/s.snowDensityKgM3));
  if(limited<1)throw Error('При заданной плотности машина не может увезти даже 1 м³');
  return limited;
}

/** Local search on trips (fixed sizes). Moves: relocate a trip (or send it to "unserved"), swap two trips.
 * Accepts a move only if (unserved m3, transport km) improves lexicographically, so it can never be worse than greedy.
 * Deterministic: fixed iteration order, first improvement. Not a global optimum. */
function localSearch(s,demands,activeSites,pairs,assignments,maxTripM3){
  const items=[];
  for(const a of assignments)items.push({demandId:a.demandId,amount:a.volumeM3,site:a.siteId});
  const served=new Map();for(const a of assignments)served.set(a.demandId,(served.get(a.demandId)||0)+a.volumeM3);
  for(const d of demands){let rest=d.volumeM3-(served.get(d.id)||0);while(rest>0){const x=Math.min(rest,maxTripM3);items.push({demandId:d.id,amount:x,site:null});rest-=x;}}
  const left=new Map(activeSites.map(x=>[x.id,x.capacityM3]));
  for(const it of items)if(it.site)left.set(it.site,left.get(it.site)-it.amount);
  const km=(it,site)=>site==null?0:(pairs.get(it.demandId).get(site)?.km??null);
  const ids=[null,...activeSites.map(x=>x.id)];
  const EPS=1e-9;let guard=0,improved=true,work=0;
  const gain=(dUn,dKm)=>dUn<0||(dUn===0&&dKm<-EPS);
  while(improved&&guard++<2000&&work<2_000_000){
    improved=false;
    for(let i=0;i<items.length&&!improved;i++){
      const a=items[i],from=a.site,kFrom=km(a,from);
      for(const to of ids){ // relocate
        if(++work>2_000_000)break;
        if(to===from)continue;const kTo=km(a,to);if(kTo===null)continue;
        if(to!==null&&left.get(to)<a.amount)continue;
        const dUn=(to===null?a.amount:0)-(from===null?a.amount:0);
        if(gain(dUn,kTo-kFrom)){if(from)left.set(from,left.get(from)+a.amount);if(to)left.set(to,left.get(to)-a.amount);a.site=to;improved=true;break;}
      }
      if(improved)break;
      for(let j=i+1;j<items.length;j++){ // swap
        if(++work>2_000_000)break;
        const b=items[j],sa=a.site,sb=b.site;if(sa===sb)continue;
        const ka=km(a,sb),kb=km(b,sa);if(ka===null||kb===null)continue;
        if(sa&&left.get(sa)+a.amount-b.amount<0)continue;
        if(sb&&left.get(sb)+b.amount-a.amount<0)continue;
        const dUn=(sb===null?0:0)+((sb===null?a.amount:0)-(sa===null?a.amount:0))+((sa===null?b.amount:0)-(sb===null?b.amount:0));
        const dKm=ka+kb-km(a,sa)-km(b,sb);
        if(gain(dUn,dKm)){if(sa)left.set(sa,left.get(sa)+a.amount-b.amount);if(sb)left.set(sb,left.get(sb)+b.amount-a.amount);a.site=sb;b.site=sa;improved=true;break;}
      }
    }
  }
  const out=[],used=new Map(activeSites.map(x=>[x.id,0]));let unservedM3=0,transportKm=0,totalMin=0;
  for(const it of items){
    if(!it.site){unservedM3+=it.amount;continue;}
    const r=pairs.get(it.demandId).get(it.site);
    out.push({demandId:it.demandId,siteId:it.site,volumeM3:it.amount,km:r.km,driveMinutes:r.km/s.truck.driveKmh*60,outward:r.outward,home:r.home});
    used.set(it.site,used.get(it.site)+it.amount);transportKm+=r.km;totalMin+=r.km/s.truck.driveKmh*60;
  }
  out.sort((x,y)=>x.demandId.localeCompare(y.demandId)||x.siteId.localeCompare(y.siteId)||y.volumeM3-x.volumeM3);
  return {assignments:out,used,unservedM3,transportKm,totalMin};
}
function solveScenario(s,activeSites,engine,{improve=true}={}){
  const capacities=new Map(activeSites.map(site=>[site.id,site.capacityM3]));
  const pairs=new Map();
  for(const demand of s.demands){
    pairs.set(demand.id,new Map(activeSites.map(site=>[site.id,engine.roundTrip(demand.nodeId,site.nodeId)])));
  }
  // Regret-first ordering often reduces competition for scarce nearby capacity.
  // It remains a heuristic and can be suboptimal; preserve explicit caveat.
  const demands=s.demands.map(d=>{
    const km=[...pairs.get(d.id).values()].filter(Boolean).map(r=>r.km).sort((a,b)=>a-b);
    const regret=km.length===0?Infinity:km.length===1?1e9:km[1]-km[0];
    return {...d,regret};
  }).sort((a,b)=>b.regret-a.regret||a.id.localeCompare(b.id));
  const maxTripM3=tripLimit(s),assignments=[];let unservedM3=0,transportKm=0,totalMin=0;
  for(const demand of demands){
    let remaining=demand.volumeM3;
    const eligible=activeSites.map(site=>({site,route:pairs.get(demand.id).get(site.id)}))
      .filter(v=>v.route).sort((a,b)=>a.route.km-b.route.km||a.site.id.localeCompare(b.site.id));
    for(const {site,route} of eligible){
      while(remaining>0 && capacities.get(site.id)>0){
        const amount=Math.min(remaining,capacities.get(site.id),maxTripM3);
        const minutes=route.km/s.truck.driveKmh*60;
        assignments.push({demandId:demand.id,siteId:site.id,volumeM3:amount,km:route.km,driveMinutes:minutes,
          outward:route.outward,home:route.home});
        transportKm+=route.km;totalMin+=minutes;remaining-=amount;
        capacities.set(site.id,capacities.get(site.id)-amount);
      }
      if(!remaining)break;
    }
    unservedM3+=remaining;
  }
  if(improve){
    const better=localSearch(s,demands,activeSites,pairs,assignments,maxTripM3);
    assignments.length=0;assignments.push(...better.assignments);
    capacities.clear();for(const site of activeSites)capacities.set(site.id,site.capacityM3-better.used.get(site.id));
    unservedM3=better.unservedM3;transportKm=better.transportKm;totalMin=better.totalMin;
  }
  const servedM3=assignments.reduce((sum,a)=>sum+a.volumeM3,0);
  const servedBy=new Map();for(const a of assignments)servedBy.set(a.demandId,(servedBy.get(a.demandId)||0)+a.volumeM3);
  const unservedReasons=[];
  for(const d of s.demands){
    const rest=d.volumeM3-(servedBy.get(d.id)||0);if(rest<=0)continue;
    const reachable=activeSites.filter(site=>pairs.get(d.id).get(site.id));
    const code=!reachable.length?'no_round_trip_route':'capacity_exhausted';
    unservedReasons.push({demandId:d.id,unservedM3:rest,code,
      message:code==='no_round_trip_route'?'Нет маршрута туда и обратно ни до одной площадки (закрытия, односторонние участки или узел вне связной сети)':'Вместимость достижимых площадок исчерпана'});
  }
  const estimatedCostRub=s.truck.rateRubPerHour==null?null:totalMin/60*s.truck.rateRubPerHour;
  return {mode:'scenario_only',solver:improve?'regret_greedy_plus_local_search_not_global_optimum':'regret_first_greedy_not_global_optimum',networkVersion:engine.networkVersion,
    servedM3,unservedM3,unservedReasons,trips:assignments.length,transportKm:Number(transportKm.toFixed(3)),
    estimatedDriveMinutes:Number(totalMin.toFixed(1)),
    estimatedCostRub:estimatedCostRub==null?null:Number(estimatedCostRub.toFixed(2)),
    siteUtilization:activeSites.map(site=>({siteId:site.id,capacityM3:site.capacityM3,usedM3:site.capacityM3-capacities.get(site.id)})),
    assignments,assumptions:['Сценарные объёмы и площадки; юридическая допустимость не проверена',
      'Нет очередей, погрузки, разгрузки, смен, топлива, сезонных и поворотных ограничений',
      'Граф OSM не подтверждает транспортную доступность тяжёлых машин',
      'Эвристика (жадный проход + локальный поиск): глобальный оптимум и экономия не гарантированы']};
}
export function compareSites(network,scenario,{improve=true}={}){
  validate(scenario,network);
  const engine=createRouteEngine(network,{closedEdgeIds:scenario.closedEdgeIds||[]});
  const baseSites=scenario.sites.filter(s=>s.kind==='existing');
  const candidates=scenario.sites.filter(s=>s.kind==='candidate');
  if(!baseSites.length)throw new DomainError('Нужна хотя бы одна базовая сценарная площадка','sites');
  if(!candidates.length)throw new DomainError('Нужен хотя бы один кандидат для сравнения','sites');
  const baseline=solveScenario(scenario,baseSites,engine,{improve});
  const variants=candidates.map(site=>{
    const result=solveScenario(scenario,[...baseSites,site],engine,{improve});
    return {siteId:site.id,siteName:site.name||site.id,legalStatus:'not_assessed',
      ...result,deltaKm:Number((result.transportKm-baseline.transportKm).toFixed(3)),
      deltaKmPercent:baseline.transportKm>0?Number(((result.transportKm-baseline.transportKm)/baseline.transportKm*100).toFixed(1)):null};
  });
  variants.sort((a,b)=>a.unservedM3-b.unservedM3||a.transportKm-b.transportKm||a.siteId.localeCompare(b.siteId));
  return {baseline,variants,rankBasis:'minimum_unserved_volume_then_transport_km',
    notice:'Моделирование логистики, не заключение о пригодности участка. Кандидаты не признаны законными полигонами.'};
}
