import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {startServer} from '../apps/api/server.mjs';
import {createRouteEngine} from '../packages/routing/engine.mjs';
import {loadNetwork} from '../packages/routing/network-file.mjs';
import {validateRequest,exclusionRerun,inputFingerprint} from '../packages/contracts/request.mjs';
import {defaultSettings,normalizeSettings,removeSiteSettings,availableAdditions,buildExactRequest,hasExactOnlySettings,exactVariants,rankingText,reasonText,exactComparable,exactHeadline,exactRoute,assignmentRows,sanitizeScenario} from '../apps/web/lib/exact-map.js';
import {aggregateTrips} from '../apps/web/lib/core.js';
const demo=()=>JSON.parse(readFileSync(new URL('../data/fixtures/scenario.demo.json',import.meta.url),'utf8'));
const {network,networkMeta}=loadNetwork(fileURLToPath(new URL('../data/snapshots/pkgo-27233df581c6/city-network.json',import.meta.url)),'pkgo');
const health={networkId:networkMeta.id,networkVersion:networkMeta.version,networkHash:networkMeta.hash};
const settings=(patch={})=>({...defaultSettings(),...patch});
const make=(patch={},s=demo(),parent)=>buildExactRequest(s,settings(patch),health,parent);

test('v4.9 map editor builds safe add/relocate/greenfield policies and preserves explicit constraints',()=>{
 const s=demo();const request=make({},s);const v=validateRequest(network,request,networkMeta);
 assert.equal(request.policy.mode,'add');assert.equal(request.policy.searchStrategy,'bounded_enumeration');assert.equal(request.policy.preset,'preserve_existing');assert.equal(request.policy.exactNewSites,1);assert.equal(request.policy.exactActiveSites,3);assert.deepEqual([...v.fixed].sort(),['S0','S1']);
 const patch={count:1,replacements:[{candidateId:'C1',existingId:'S0'}]};const rel=make(patch,s);assert.equal(rel.policy.mode,'relocate');assert.deepEqual(rel.policy.replacementGroups,[{id:'replacement:S0',siteIds:['S0','C1'],lower:1,upper:1}]);assert.deepEqual([...validateRequest(network,rel,networkMeta).fixed],['S1']);assert.equal(availableAdditions(s,settings(patch)),1);
 const green=demo();green.sites=green.sites.filter(t=>t.kind==='candidate');const g=make({count:2},green);assert.equal(g.policy.mode,'greenfield');assert.equal(g.policy.exactActiveSites,2);assert.equal(g.policy.exactNewSites,undefined);validateRequest(network,g,networkMeta);
 s.assumptionDate='2026-11-21';s.demands[0].snowType='clean';s.sites[0].maxTripsDuringHorizon=0;s.sites[0].acceptedSnowTypes=['clean'];const constraints=make({},s);validateRequest(network,constraints,networkMeta);assert.equal(constraints.scenario.sites[0].maxTripsDuringHorizon,0);assert.match(constraints.scenario.sites[0].tripLimitEvidence.sourceRef,/user assumption, not observation/);assert.equal(constraints.scenario.demands[0].snowType,'clean');assert.equal(hasExactOnlySettings(s,settings()),true);assert.equal(hasExactOnlySettings(demo(),settings()),false);
 assert.throws(()=>normalizeSettings(settings({excludedSiteIds:[{id:'S0',reason:'no'}]}),demo()),/исключение/);assert.throws(()=>normalizeSettings(settings({count:NaN}),demo()),/число/);assert.throws(()=>normalizeSettings(settings({replacements:[{candidateId:'C1',existingId:'S0'},{candidateId:'C1',existingId:'S1'}]}),demo()),/переноса/);
 assert.deepEqual(removeSiteSettings(settings({...patch,excludedSiteIds:[{id:'C1',reason:'r'}],excludedConfigurations:[{siteIds:['C1','S1'],reason:'r'}]}),'C1'),settings());
});

test('v4.9 map JSON import preserves settings and constraints; does not silently downgrade advanced v1',()=>{
 const s=demo();s.assumptionDate='2026-11-21';s.sites[0].maxTripsDuringHorizon=0;s.sites[1].acceptedSnowTypes=[];s.demands[0].snowType='with_reagents';const raw=JSON.parse(JSON.stringify({...s,mapSettings:settings({excludedSiteIds:[{id:'C2',reason:'review'}]})}));
 const clean=sanitizeScenario(raw,network),saved=normalizeSettings(raw.mapSettings,clean);assert.deepEqual(clean.sites,s.sites);assert.deepEqual(clean.demands,s.demands);assert.equal(clean.assumptionDate,s.assumptionDate);assert.equal(saved.excludedSiteIds[0].id,'C2');assert.deepEqual(buildExactRequest(clean,saved,health),buildExactRequest(s,saved,health));
 assert.throws(()=>sanitizeScenario(make(),network),/JSON v1/);assert.throws(()=>sanitizeScenario({...s,sites:[{...s.sites[0],intraSiteRoundtripMm:1000}]},network),/Расширенные ограничения/);assert.throws(()=>sanitizeScenario({...s,assumptionDate:'2026-02-30'},network),/дата/);assert.throws(()=>sanitizeScenario({...s,closedEdgeIds:['bad-edge']},network),/перекрытия/);
 const fake=demo();fake.sites[0].legalStatus='verified';assert.equal(sanitizeScenario(fake,network).sites[0].legalStatus,'unverified');
});

test('v4.9 exact display does not expand trip rows or mislabel partial/no-baseline output',()=>{
 const a={demandId:'D',siteId:'S',volumeM3:1000000,trips:1000000,loadedDistanceMm:1000,emptyDistanceMm:2000,roundtripMm:3000,routeRef:{from:'a',to:'b'}};
 const sol={configurationId:'["S"]',activeSiteIds:['S'],assignments:[a],status:'time_limit',servedM3:1000000,unservedM3:0,transportKm:3000,comparableToBaseline:false};
 const r={baseline:null,alternatives:[sol],solver:{status:'time_limit'},search:{rankingStatus:'provisional',topKReturned:1,topKRequested:5,proven:0,configurationsTotal:10}};
 const v=exactVariants(r,[{id:'S',name:'S'}]);assert.equal(v.length,1);assert.match(v[0].label,/Найденный/);assert.match(rankingText(r),/не доказана/);assert.match(exactHeadline(1000000,null,sol,false).text,/предварительное/);assert.equal(exactComparable(null,sol),false);assert.equal(assignmentRows(sol,true,aggregateTrips).length,1);assert.equal(assignmentRows(sol,true,aggregateTrips)[0].trips,1000000);assert.match(reasonText({code:'solver_incomplete'}),/не завершено/);
 const engine={path:()=>({km:0,arcs:[]})};assert.throws(()=>exactRoute(engine,a),/не совпадает/);
});

test('v4.9 actual map-generated HTTP requests: city Top-K, geometry, exclusion lineage, relocation and greenfield',async()=>{
 const srv=startServer(0);await new Promise(r=>srv.once('listening',r));const base=`http://127.0.0.1:${srv.address().port}`;
 try{
  const h=await (await fetch(base+'/api/health')).json(),s=await (await fetch(base+'/api/demo')).json();assert.equal(h.networkHash,health.networkHash);
  const post=async r=>{const res=await fetch(base+'/api/v1/optimize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(r)});const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data;};
  const parent=buildExactRequest(s,settings(),h),res=await post(parent);assert.equal(res.search.rankingStatus,'exact_top_k');assert.equal(res.baseline.transportDistanceMm,159425990);assert.deepEqual(res.alternatives.map(v=>v.transportDistanceMm),[108556350,122648320]);
  const engine=createRouteEngine(network,{cacheLimit:8});for(const solution of [res.baseline,...res.alternatives]){let distance=0,trips=0;for(const a of solution.assignments){const g=exactRoute(engine,a);distance+=Math.round(g.kmPerTrip*1e6)*g.trips;trips+=g.trips;assert.ok(g.outward.arcs.length&&g.home.arcs.length);for(const arc of [...g.outward.arcs,...g.home.arcs])assert.equal(typeof arc.forward,'boolean');}assert.equal(distance,solution.transportDistanceMm);assert.equal(trips,solution.trips);}
  const two=await post(buildExactRequest(s,settings({count:2}),h));assert.equal(two.alternatives[0].transportDistanceMm,92228770);assert.equal(two.alternatives[0].activeSiteIds.length,4);
  const skip=buildExactRequest(s,settings({excludedSiteIds:[{id:'C1',reason:'synthetic review'}]}),h,res.scenarioHash);assert.equal(exclusionRerun(parent,skip),true);const rerun=await post(skip);assert.equal(rerun.inputFingerprint,res.inputFingerprint);assert.equal(rerun.parentScenarioHash,res.scenarioHash);assert.deepEqual(rerun.alternatives.map(x=>x.newSiteIds),[['C2']]);
  const skipSet=buildExactRequest(s,settings({excludedConfigurations:[{siteIds:res.alternatives[0].activeSiteIds,reason:'synthetic review'}]}),h,res.scenarioHash);assert.equal(exclusionRerun(parent,skipSet),true);assert.deepEqual((await post(skipSet)).alternatives.map(x=>x.newSiteIds),[['C2']]);
  const rel=await post(buildExactRequest(s,settings({count:1,replacements:[{candidateId:'C1',existingId:'S0'}]}),h));assert.equal(rel.search.rankingStatus,'exact_top_k');assert.ok(rel.alternatives.every(x=>x.activeSiteIds.includes('S1')&&x.activeSiteIds.includes('C2')&&x.relocatedGroups[0].selectedSiteIds.length===1&&x.activeSiteIds.length===3));
  const green={...s,sites:s.sites.filter(t=>t.kind==='candidate')};const fromZero=await post(buildExactRequest(green,settings({count:1}),h));assert.equal(fromZero.baseline,null);assert.equal(fromZero.search.rankingStatus,'exact_top_k');assert.ok(fromZero.alternatives.every(x=>x.activeSiteIds.length===1));
  // Both browser-safe canonical module sources are byte-exact; the allowlist is not a general file route.
  for(const [url,path] of [['/lib/routing/engine.mjs','../packages/routing/engine.mjs'],['/lib/contracts/validate.mjs','../packages/contracts/validate.mjs']]){const asset=await fetch(base+url);assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);assert.deepEqual(Buffer.from(await asset.arrayBuffer()),readFileSync(new URL(path,import.meta.url)));}
  for(const path of ['/lib/contracts/request.mjs','/packages/optimization/optimize.mjs','/lib/routing/network-file.mjs'])assert.equal((await fetch(base+path)).status,404);
 }finally{await new Promise(r=>srv.close(r));}
});
