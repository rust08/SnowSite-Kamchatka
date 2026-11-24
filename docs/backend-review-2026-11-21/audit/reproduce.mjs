// Run: node audit/reproduce.mjs <path-to-unpacked-SnowSite-Kamchatka>
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {compareSites}=await import(pathToFileURL(path.join(root,'src/optimizer.mjs')));
const {createRouteEngine}=await import(pathToFileURL(path.join(root,'src/routing.mjs')));
const here=path.dirname(fileURLToPath(import.meta.url));
function exactTiny(network,s,sites){
  const eng=createRouteEngine(network),Q=s.truck.payloadKg==null?s.truck.bodyM3:Math.min(s.truck.bodyM3,Math.floor(s.truck.payloadKg/s.snowDensityKgM3));
  const costs=s.demands.map(d=>sites.map(t=>eng.roundTrip(d.nodeId,t.nodeId)?.km??Infinity));
  let best={unservedM3:Infinity,transportKm:Infinity};const cap=sites.map(t=>t.capacityM3);
  function demand(i,un,km){if(i===s.demands.length){if(un<best.unservedM3||(un===best.unservedM3&&km<best.transportKm))best={unservedM3:un,transportKm:km};return;}
    function allocate(j,rem,k){if(j===sites.length){demand(i+1,un+rem,km+k);return;}
      for(let x=0;x<=Math.min(rem,cap[j]);x++){if(x&&!Number.isFinite(costs[i][j]))continue;cap[j]-=x;allocate(j+1,rem-x,k+(x?Math.ceil(x/Q)*costs[i][j]:0));cap[j]+=x;}}
    allocate(0,s.demands[i].volumeM3,0);
  }demand(0,0,0);return best;
}
const summarize=r=>({siteId:r.siteId??'baseline',servedM3:r.servedM3,unservedM3:r.unservedM3,transportKm:r.transportKm,trips:r.trips});
for(const f of fs.readFileSync(path.join(here,'counterexamples.jsonl'),'utf8').trim().split('\n').map(JSON.parse)){
  const r=compareSites(f.graph,f.scenario);const base=f.scenario.sites.filter(s=>s.kind==='existing');
  console.log(JSON.stringify({case:f.tag,actual:[r.baseline,...r.variants].map(summarize),exact:[{id:'baseline',...exactTiny(f.graph,f.scenario,base)},...f.scenario.sites.filter(s=>s.kind==='candidate').map(c=>({id:c.id,...exactTiny(f.graph,f.scenario,[...base,c])}))]}));
}
const g=JSON.parse(fs.readFileSync(path.join(root,'data/city-network.json'))),s=JSON.parse(fs.readFileSync(path.join(root,'data/scenario.demo.json')));
const r=compareSites(g,s);console.log(JSON.stringify({demo:[r.baseline,...r.variants].map(summarize)}));
for(const [label,mutate] of [['unknown_kind',v=>v.sites.push({id:'bad',nodeId:v.sites[0].nodeId,kind:'typo',capacityM3:1})],['unknown_closure',v=>v.closedEdgeIds=['nonexistent']],['nonfinite_minutes',v=>v.truck.driveKmh=Number.MIN_VALUE]]){
  const v=structuredClone(s);mutate(v);try{const out=compareSites(g,v);console.log(JSON.stringify({label,accepted:true,minutes:String(out.baseline.estimatedDriveMinutes)}))}catch(e){console.log(JSON.stringify({label,accepted:false,error:e.message}));}
}
const e=createRouteEngine(g);const pairs=s.demands.map(d=>s.sites.map(t=>e.roundTrip(d.nodeId,t.nodeId)?.km??null));fs.writeFileSync(path.join(here,'demo_costs.reproduced.json'),JSON.stringify({s,pairs}));
