import {performance} from 'node:perf_hooks';
import {blockedEdges,compatible} from '../contracts/constraints.mjs';
import {hash,validateRequest} from '../contracts/request.mjs';
import {buildMatrix} from '../routing/matrix.mjs';
import {allocateExact,checkObjectiveBudget} from './allocate.mjs';
import {configurationBound} from './configuration-bound.mjs';
import {verifyConfiguration,verifySolution} from './verify-result.mjs';
import {selectExact,tieOrder,isNewSite} from './select.mjs';
import {createSolverSession} from '../../workers/milp-python/exact-adapter.mjs';
const key=ids=>JSON.stringify([...ids].sort());
const order=(a,b)=>a.unservedM3-b.unservedM3||a.transportDistanceMm-b.transportDistanceMm||(a.configurationId<b.configurationId?-1:a.configurationId>b.configurationId?1:0);
// Enumerate catalogue only; prune cardinalities. Bounded nodes even for infeasible policies.
function enumerate(v,k,deadline,signal){
 const {sites,fixed,exclusions,excludedConfigs,groups,p}=v;
 const eligible=sites.filter(t=>!exclusions.has(t.id)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const must=eligible.filter(t=>fixed.has(t.id)),opt=eligible.filter(t=>!fixed.has(t.id));
 const configs=[];let nodes=0,complete=true;
 const isNew=t=>t.origin==='candidate'&&!groups.some(g=>g.siteIds.includes(t.id)); // replacements are not pure additions
 const valid=selected=>{const ids=selected.map(t=>t.id),set=new Set(ids);return groups.every(g=>{const n=g.siteIds.filter(x=>set.has(x)).length;return n>=g.lower&&n<=g.upper;})&&!excludedConfigs.has(key(ids));};
 function walk(i,selected,newCount){
  if(!complete)return;if(++nodes>100000||configs.length>=1000||performance.now()>=deadline||signal?.aborted){complete=false;return;}
  const max=opt.length-i;
  if(k!=null&&(newCount>k||newCount+max<k)||p.exactActiveSites!=null&&(selected.length>p.exactActiveSites||selected.length+max<p.exactActiveSites))return;
  if(groups.some(g=>g.siteIds.filter(x=>selected.some(t=>t.id===x)).length>g.upper))return;
  if(i===opt.length){if((k==null||newCount===k)&&(p.exactActiveSites==null||selected.length===p.exactActiveSites)&&valid(selected))configs.push([...selected].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));return;}
  walk(i+1,selected,newCount);if(p.mode!=='evaluate'){selected.push(opt[i]);walk(i+1,selected,newCount+Number(isNew(opt[i])));selected.pop();}
 }
 walk(0,[...must],must.filter(isNew).length);return {configs,complete,eligible:eligible.length,isNew};
}
export async function optimize(network,request,{networkMeta,signal}={}){
 const started=performance.now(),v=validateRequest(network,request,networkMeta),{s,p,sites,demands,q,meta}=v,deadline=started+p.timeLimitMs;
 const counts=p.mode==='frontier'?[...p.newSiteCounts].sort((a,b)=>a-b):[p.exactNewSites??null];
 const requestedStrategy=p.searchStrategy??'enumeration',unified=requestedStrategy==='unified_milp'&&tieOrder(sites)!==null;
 const bounded=requestedStrategy==='bounded_enumeration';
 const plans=counts.map(k=>({k,...(unified?{eligible:sites.filter(t=>!v.exclusions.has(t.id)).length,isNew:t=>isNewSite(v,t)}:enumerate(v,k,deadline,signal))}));
 const matrixStart=performance.now(),loadedClosed=blockedEdges(s,'loaded'),emptyClosed=blockedEdges(s,'empty'),directions=[],matrixMetrics={};
 const matrix=performance.now()<deadline&&!signal?.aborted?buildMatrix(network,demands,sites,s.closedEdgeIds??[],{deadline,signal,loadedClosed,emptyClosed,directions,graphHash:meta.hash,profileHash:hash(s.accessProfiles??null),metrics:matrixMetrics}):null,matrixMs=performance.now()-matrixStart;
 if(matrix&&bounded)checkObjectiveBudget(demands,matrix);
 const session=createSolverSession({signal});let version=null,baseline=null,baselineStatus='not_applicable';
 const assumptions=['scenario_only: no real site or capacity verification',s.accessProfiles?'caller-supplied loaded/empty full-load access profiles; missing road limits not checked':'loaded and empty use identical road access profile','distance only; no queue/loading/CAPEX/OPEX','mass_'+(s.truck.payloadKg==null?'not_checked':'scenario_checked')];
 const warnings=[{code:'legal_not_assessed',message:'Screening is supplied evidence, not legal approval.'}];
 if(requestedStrategy==='unified_milp'&&!unified)warnings.push({code:'selection_tie_fallback',message:'JSON-escaped IDs require legacy configuration ordering; bounded enumeration used.'});
 if(sites.some(t=>Object.hasOwn(t,'intraSiteRoundtripMm'))){assumptions.push('supplied intra-site roundtrip distance included per trip; uniform scenario drive speed also used inside site');if(sites.some(t=>t.intraSiteRoundtripMm==null))warnings.push({code:'intra_site_distance_unknown',message:'Unknown intra-site distances are excluded from the modeled cost, not verified zero.'});}
 if(sites.some(t=>t.maxTripsDuringHorizon==null))warnings.push({code:'trip_limit_unknown',message:'Missing receiving trip limits: no time feasibility claim.'});
 if(demands.some(d=>d.snowType==null||d.snowType==='unknown')||sites.some(t=>t.acceptedSnowTypes==null))warnings.push({code:'snow_type_unknown',message:'Unknown acceptance compatibility is not verified.'});
 if(demands.some(d=>sites.some(t=>d.nodeId===t.accessNodeId)))warnings.push({code:'same_node',message:'Zero road distance is a same-network-node assumption; access connectors are not verified; intra-site distance is included only when explicitly supplied.'});
 async function solve(config,isNew,precomputed){
  const idx=config.map(t=>sites.indexOf(t)),costs=matrix.map(row=>idx.map(j=>row[j]));
  const input={demands,sites:config,costs,q,directions:directions.map(row=>idx.map(j=>row[j]))};
  const r=precomputed??await allocateExact(input,{session,timeLimitMs:Math.max(0,Math.floor(deadline-performance.now())),signal,sourceTripCuts:bounded});
  version=r.version??version;if(!r.solution)return {status:r.status,solution:null,stages:r.stages};
  const a=r.solution,activeSiteIds=config.map(t=>t.id).sort(),transportKm=a.transportDistanceMm/1e6;
  const estimatedDriveMinutes=transportKm/s.truck.driveKmh*60;
  const unresolvedChecks=config.map(t=>({siteId:t.id,status:t.screening.status==='documented'&&t.screening.decision==='allowed'?'provided_documentation':'needs_review'}));
  const solution={configurationId:key(activeSiteIds),activeSiteIds,newSiteIds:config.filter(isNew).map(t=>t.id),relocatedGroups:v.groups.map(g=>({groupId:g.id,selectedSiteIds:g.siteIds.filter(x=>activeSiteIds.includes(x))})),status:r.status,servedM3:a.servedM3,unservedM3:a.unservedM3,transportDistanceMm:a.transportDistanceMm,transportKm,trips:a.trips,assignments:a.assignments.map(a=>({...a,...input.directions[demands.findIndex(d=>d.id===a.demandId)][config.findIndex(t=>t.id===a.siteId)]})),siteUtilization:config.map((t,j)=>({siteId:t.id,capacityM3:t.availableCapacityM3,usedM3:a.used[j],usedTrips:a.siteTrips[j],maxTripsDuringHorizon:t.maxTripsDuringHorizon??null,tripLimitBinding:t.maxTripsDuringHorizon!=null&&a.siteTrips[j]===t.maxTripsDuringHorizon})),unservedReasons:demands.flatMap((d,i)=>a.served[i]===d.volumeM3?[]:[{demandId:d.id,unservedM3:d.volumeM3-a.served[i],code:!config.some(t=>compatible(d,t))&&config.length?'snow_type_mismatch':!costs[i].some(x=>x!==null)?(config.some(t=>!compatible(d,t))?'no_compatible_round_trip_route':'no_round_trip_route'):r.status==='optimal'?(config.some(t=>t.maxTripsDuringHorizon!=null)?'capacity_trip_limit_or_allocation_constraint':'capacity_or_allocation_constraint'):'solver_incomplete'}]),estimatedDriveMinutes,estimatedDriveCostRub:s.truck.rateRubPerHour==null?null:estimatedDriveMinutes/60*s.truck.rateRubPerHour,screeningStatus:'not_assessed',unresolvedChecks,solverStages:r.stages};
  verifySolution(input,solution,s.truck);return {status:r.status,stages:r.stages,solution};
 }
 const rankings=[];
 try{
  const existing=sites.filter(t=>t.origin==='existing').sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  // Historical reference: exclusions apply to alternatives, not the unchanged original baseline.
  // A documented prohibition/strict rejection prevents computing a reference as an eligible solution.
  if(matrix&&performance.now()<deadline&&existing.length&&p.mode!=='greenfield'&&existing.every(t=>!v.screeningReason(t))){const r=await solve(existing,plans[0].isNew);baseline=r.solution;baselineStatus=r.status;}
  else if(existing.length)baselineStatus=!matrix||performance.now()>=deadline?'time_limit':'screening_excluded';
  for(const plan of plans){
   let evaluated=0,proven=0,prunedByBound=0;const found=[];let lastStages=[];
   let exhausted=false;
   if(unified){
    while(found.length<p.topK&&matrix&&performance.now()<deadline&&!signal?.aborted){
     const r=await selectExact(v,plan.k,found,matrix,{session,timeLimitMs:Math.max(0,Math.floor(deadline-performance.now()))});
     evaluated++;lastStages=r.stages;version=r.version??version;
     if(r.status==='infeasible'){exhausted=true;break;}
     if(r.solution){const formatted=await solve(r.config,plan.isNew,r);if(found.length&&order(found.at(-1),formatted.solution)>0)throw Error('Unified ranking out of order');found.push(formatted.solution);if(r.status==='optimal')proven++;}
     if(r.status!=='optimal')break;
    }
   }else {
    let candidates=plan.configs.map(config=>({config}));
    if(bounded&&matrix){
     candidates=candidates.map(({config})=>{const indices=config.map(t=>sites.indexOf(t));return {config,bound:configurationBound(demands,config,matrix.map(row=>indices.map(j=>row[j])),q)};}).sort((a,b)=>order(a.bound,b.bound));
    }
    for(const [i,{config,bound}] of candidates.entries()){
     if(!matrix||performance.now()>=deadline||signal?.aborted)break;
     // All remaining lower bounds are >= this one. Only fully proved K
     // incumbents can justify elimination. No pruning after a partial solve.
     if(bounded&&bound&&found.length===p.topK&&proven===evaluated&&order(bound,found.at(-1))>=0){prunedByBound=candidates.length-i;break;}
     verifyConfiguration(v,config,plan.k);const r=await solve(config,plan.isNew);evaluated++;lastStages=r.stages;
     if(r.status==='optimal')proven++;
     if(r.solution&&(!p.requireAllServed||r.solution.unservedM3===0)){found.push(r.solution);found.sort(order);if(found.length>p.topK)found.pop();}
     if(r.status==='time_limit')break;
    }
   }
   found.sort(order);const alternatives=found.slice(0,p.topK);
   for(const a of alternatives){a.comparableToBaseline=!!baseline&&baseline.status==='optimal'&&a.status==='optimal'&&baseline.servedM3===a.servedM3;a.deltaKm=a.comparableToBaseline?a.transportKm-baseline.transportKm:null;a.deltaKmPercent=a.comparableToBaseline&&baseline.transportDistanceMm>0?(a.transportDistanceMm-baseline.transportDistanceMm)/baseline.transportDistanceMm*100:null;}
   const complete=unified?(proven===found.length&&(exhausted||proven===p.topK)):plan.complete&&evaluated+prunedByBound===plan.configs.length&&proven===evaluated;
   if(!complete&&!lastStages.length)lastStages=[{name:'not_started',status:'time_limit',value:null,bound:null,gap:null}];
   const rankingStatus=complete?(alternatives.length?'exact_top_k':'infeasible'):(alternatives.length?'provisional':'incomplete');
   rankings.push({exactNewSites:plan.k,alternatives,search:{catalogSize:sites.length,eligibleSize:plan.eligible,configurationsTotal:unified?null:plan.complete?plan.configs.length:null,enumerated:unified?0:plan.configs.length,evaluated,proven,...(bounded?{prunedByBound}:{}),...(p.searchStrategy?{strategy:unified?'unified_milp':bounded?'bounded_enumeration':'enumeration',requestedStrategy,counterScope:unified?'rank_attempts_and_proven_ranks':'configurations'}:{}),topKRequested:p.topK,topKReturned:alternatives.length,rankingStatus,coverage:unified||plan.complete?'finite_catalogue':'restricted_catalogue',reason:alternatives.length<p.topK?(complete?'finite_set_exhausted_or_filtered':'time_or_catalogue_limit'):null},lastStages});
  }
 }finally{session.close();}
 const allExact=rankings.every(r=>['exact_top_k','infeasible'].includes(r.search.rankingStatus));const primary=rankings[0];
 return {schemaVersion:'1.0',scenarioHash:v.scenarioHash,inputFingerprint:v.inputFingerprint,lineageStatus:request.parentScenarioHash?'caller_supplied_unverified':'root',...(request.parentScenarioHash?{parentScenarioHash:request.parentScenarioHash}:{}),networkId:meta.id,networkVersion:meta.version,networkHash:meta.hash,solver:{name:'SciPy/HiGHS MILP',version,status:allExact?(rankings.every(r=>r.search.rankingStatus==='infeasible')?'infeasible':'optimal'):'time_limit',stages:primary.lastStages,stageScope:unified?'last rank attempt of primary ranking; individual solutions carry their own stages':'last evaluated configuration of primary ranking; individual solutions carry their own stages',timeMs:performance.now()-started,limits:{timeLimitMs:p.timeLimitMs,...(unified?{maxRankAttempts:p.topK}:{maxConfigurations:1000,maxEnumerationNodes:100000})},...(p.mode==='frontier'?{note:'Per-cardinality rankings are independent'}:{})},matrixMs,matrixMetrics,matrixHash:matrix?hash({networkHash:meta.hash,loadedClosed,emptyClosed,profiles:s.accessProfiles??null,costs:matrix,directions}):null,baseline,baselineStatus,search:primary.search,alternatives:primary.alternatives,...(p.mode==='frontier'?{frontier:rankings.map(({lastStages,...r})=>r)}:{}),excludedSites:[...v.exclusions.values()],excludedConfigurations:[...v.excludedConfigs.values()],assumptions,warnings};
}
