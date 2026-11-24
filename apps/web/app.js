import {nextId,createRequestGate,validateTruckField,aggregateTrips,isComparable,headline,shortSiteName,fmtKm,fmtRub,fmtDuration} from './lib/core.js';
import {truckCapacity} from './lib/contracts/validate.mjs';
import {createRouteEngine} from './lib/routing/engine.mjs';
import {defaultSettings,normalizeSettings,removeSiteSettings,availableAdditions,buildExactRequest,hasExactOnlySettings,exactVariants,rankingText,reasonText,exactComparable,exactHeadline,exactRoute,assignmentRows,sanitizeScenario} from './lib/exact-map.js';
const $=id=>document.getElementById(id);
const gate=createRequestGate();
let network,scenario,map,roadLayer,pointLayer,routeLayer,edgeLookup,lastResult=null,variants=[],selectedKey='base',selectedMode=null,hasFit=false;
let health,settings=defaultSettings(),pendingParent=null,routeEngine=null;
const runHistory=[];let droppedRuns=0;
const isExact=()=>$('calc-mode').value==='exact';
const rows=res=>assignmentRows(res,isExact(),aggregateTrips);
const canCompare=(base,res)=>isExact()?exactComparable(base,res):!!base&&isComparable(base,res);
const markers=new Map();
const ROUTE_COLOR='#10243f',BACK_COLOR='#a259d9';
const pl=(n,f)=>{const a=Math.abs(n)%100,b=a%10;return a>10&&a<20?f[2]:b>1&&b<5?f[1]:b===1?f[0]:f[2];};
const trips=n=>n+' '+pl(n,['рейс','рейса','рейсов']);
const safe2=s=>String(s??'').replace(/[^\p{L}\p{N}]/gu,'').slice(0,2);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
async function getJson(path,options){const r=await fetch(path,options);const v=await r.json();if(!r.ok)throw Error((v.error||'Не удалось выполнить запрос')+(v.path?' ['+v.path+']':'')+(v.code?' ('+v.code+')':''));return v;}
function msg(id,s){const n=$(id);if(n)n.textContent=s;}
function latLng(nodeId){const xy=network.nodes[nodeId];return [xy[1],xy[0]];}

function nearestNode(latlng){let best=null,score=Infinity;for(const [id,xy] of Object.entries(network.nodes)){const dx=(xy[0]-latlng.lng)*Math.cos(latlng.lat*Math.PI/180),dy=xy[1]-latlng.lat,d=dx*dx+dy*dy;if(d<score){score=d;best=id;}}return {nodeId:best,approxMeters:Math.sqrt(score)*111000};}
// Relief: 10x10 Terrarium tiles at z11 (2560 px); same bounds as the Sever basemap.
const RELIEF_BOUNDS=[[662,1922],[672,1932]].map(([y,x])=>[Math.atan(Math.sinh(Math.PI*(1-2*y/2048)))*180/Math.PI,x/2048*360-180]);
// Vector detail (coast, water, forest, urban, buildings, context roads) from the same OSM snapshot; loaded lazily.
function addStreetDetail(map){
  map.createPane('geography').style.zIndex='320';map.getPane('geography').style.pointerEvents='none';
  const renderer=L.canvas({pane:'geography',padding:.2}),group=L.layerGroup().addTo(map);
  const colors={building:'#a9a99f',forest:'#bbceb6',park:'#c6d9bb',brush:'#d0d9c1',urban:'#e8e6dd',industrial:'#dad7ce',water:'#aacacd',river:'#81afb4',coast:'#73a7ac'};
  let ctx=null;
  function refresh(){
    group.clearLayers();if(!ctx||map.getZoom()<11.5)return;
    const rect=map.getBounds().pad(.1),ids=new Set();
    for(let x=Math.floor(rect.getWest()*100);x<=Math.floor(rect.getEast()*100);x++)for(let y=Math.floor(rect.getSouth()*100);y<=Math.floor(rect.getNorth()*100);y++)for(const id of ctx.cells[x+'/'+y]||[])ids.add(id);
    for(const id of [...ids].sort((a,b)=>a-b)){
      const [kind,rings]=ctx.records[id];if(kind==='building'&&map.getZoom()<14.5)continue;
      const lines=rings.map(ring=>{const line=[];let x=0,y=0;for(let i=0;i<ring.length;i+=2){x+=ring[i];y+=ring[i+1];line.push([y/100000,x/100000]);}return line;});
      const style={pane:'geography',renderer,interactive:false,color:colors[kind],weight:1,fillOpacity:kind==='building'?.76:kind==='water'?1:.40,opacity:kind==='coast'?.75:.45};
      if(kind==='contextRoad')L.polyline(lines,{...style,color:'#718087',weight:map.getZoom()<14?1:2,opacity:.65}).addTo(group);
      else if(kind==='coast'||kind==='river')L.polyline(lines,style).addTo(group);
      else L.polygon(lines,style).addTo(group);
    }
  }
  map.on('moveend',refresh);
  import('/city-context.js').then(m=>{ctx=m.cityContext;refresh();}).catch(()=>{});
}
function initMap(){
  map=L.map('map',{preferCanvas:true,zoomControl:false,minZoom:9,maxZoom:19,zoomSnap:.25,attributionControl:false,renderer:L.canvas({tolerance:3,padding:.15})}).setView([53.05,158.63],12.5);
  map.setMaxBounds(L.latLngBounds(RELIEF_BOUNDS));
  L.control.zoom({position:'topright'}).addTo(map);
  L.imageOverlay('/terrain-map.webp',RELIEF_BOUNDS,{pane:'tilePane',interactive:false,opacity:1,alt:'Рельеф Авачинской губы'}).addTo(map);
  addStreetDetail(map);
  roadLayer=L.polyline(network.edges.map(e=>e.geometry.map(([lon,lat])=>[lat,lon])),{color:'#7f9195',weight:1.1,opacity:.9,interactive:false,renderer:L.canvas({tolerance:3})}).addTo(map);
  map.createPane('routes').style.zIndex='450';
  routeLayer=L.layerGroup().addTo(map);pointLayer=L.layerGroup().addTo(map);
  map.on('click',e=>{
    if(!selectedMode)return;
    const point=nearestNode(e.latlng);
    if(point.approxMeters>1500){msg('pick-help','Точка далеко от дороги: выберите ближе к дороге.');$('pick-banner').textContent='Слишком далеко от дороги — выберите ближе';return;}
    const site=selectedMode!=='demand',existing=selectedMode==='existing',ids=[...scenario.demands.map(x=>x.id),...scenario.sites.map(x=>x.id)];
    if(site&&scenario.sites.some(t=>t.nodeId===point.nodeId)){msg('pick-banner','В этом узле уже есть площадка. Выберите другой въезд.');return;}
    if((site?scenario.sites:scenario.demands).length>=(site?30:50)){msg('pick-banner','Достигнут лимит количества точек');return;}
    const id=nextId(existing?'SUSER':site?'CUSER':'DUSER',ids),n=Number(id.replace(/\D+/g,''))||1;
    if(site)scenario.sites.push({id,name:(existing?'Базовая площадка ':'Кандидат ')+n+' — сценарий',nodeId:point.nodeId,capacityM3:100,kind:existing?'existing':'candidate',legalStatus:'unverified'});
    else scenario.demands.push({id,name:'Источник снега '+n+' — сценарий',nodeId:point.nodeId,volumeM3:30});
    endPick();changed();markers.get(id)?.openPopup();msg('stats-status','Точка добавлена — нажмите «Пересчитать»');
  });
}
// ---------- points on the map ----------
function mkIcon(kind,label,cls=''){const s=kind==='cand'?36:28;return L.divIcon({className:`pt pt-${kind} ${cls}`,html:`<span>${safe2(label)}</span>`,iconSize:[s,s],iconAnchor:[s/2,s/2]});}
const curVariant=()=>variants.find(v=>v.key===selectedKey)||null;
function servedMap(v){const m=new Map();if(v)for(const a of v.res.assignments)m.set(a.demandId,(m.get(a.demandId)||0)+a.volumeM3);return m;}
function sourcePopup(d,i,v){
  const box=el('div');box.append(el('h3',`Источник ${i+1}: ${d.name}`),el('p',`Нужно вывезти: ${d.volumeM3} м³`));
  if(!v){box.append(el('p','Расчёт ещё не выполнен.'));return box;}
  const per=new Map();for(const a of v.res.assignments.filter(a=>a.demandId===d.id)){const x=per.get(a.siteId)||{t:0,m:0};x.t+=a.trips??1;x.m+=a.volumeM3;per.set(a.siteId,x);}
  const served=[...per.values()].reduce((s,x)=>s+x.m,0),rest=d.volumeM3-served;
  box.append(el('p',`Вывезено: ${served} м³ · Осталось: ${rest} м³`));
  for(const [sid,x] of per){const s=scenario.sites.find(z=>z.id===sid);box.append(el('p',`→ ${s?shortSiteName(s):sid}: ${trips(x.t)}, ${x.m} м³`));}
  if(rest>0){const r=(v.res.unservedReasons||[]).find(z=>z.demandId===d.id);box.append(el('p',(r?reasonText(r):'Причина не установлена')+'.','warn-text'));}
  return box;
}
function sitePopup(x,v){
  const box=el('div');box.append(el('h3',x.name),el('p',x.kind==='existing'?'Условная действующая площадка (сценарий)':'Рассматриваемая площадка — не утверждена'),el('p',`Вместимость (сценарная): ${x.capacityM3} м³`));
  if(v){const u=v.res.siteUtilization.find(z=>z.siteId===x.id);
    if(u){const n=v.res.assignments.filter(a=>a.siteId===x.id).reduce((n,a)=>n+(a.trips??1),0);box.append(el('p',`В этом варианте занято: ${u.usedM3} из ${u.capacityM3} м³ · осталось ${u.capacityM3-u.usedM3} м³`),el('p',`Рейсов: ${n}`));}
    else box.append(el('p','Не участвует в выбранном варианте.'));}
  if(x.maxTripsDuringHorizon!=null)box.append(el('p','Сценарный предел рейсов: '+x.maxTripsDuringHorizon));
  box.append(el('p','Правовой статус: не проверен'));return box;
}
function renderPoints(){
  pointLayer.clearLayers();markers.clear();
  const v=curVariant(),active=v?new Set(v.siteIds):null,served=servedMap(v);
  scenario.demands.forEach((d,i)=>{if(!network.nodes[d.nodeId])return;
    const short=v&&d.volumeM3-(served.get(d.id)||0)>0;
    markers.set(d.id,L.marker(latLng(d.nodeId),{icon:mkIcon('src',String(i+1),short?'pt-short':''),title:`Источник ${i+1}: ${d.name}`,riseOnHover:true}).bindPopup(()=>sourcePopup(d,i,curVariant())).addTo(pointLayer));});
  for(const x of scenario.sites){if(!network.nodes[x.nodeId])continue;
    const off=(active&&!active.has(x.id))||(isExact()&&settings.excludedSiteIds.some(e=>e.id===x.id)),kind=x.kind==='existing'?'base':'cand';
    markers.set(x.id,L.marker(latLng(x.nodeId),{icon:mkIcon(kind,shortSiteName(x),off?'pt-off':''),title:x.name+(off?' (не участвует в выбранном варианте)':''),riseOnHover:true,zIndexOffset:off?-500:200}).bindPopup(()=>sitePopup(x,curVariant())).addTo(pointLayer));}
  const total=scenario.demands.reduce((s,d)=>s+d.volumeM3,0),nb=scenario.sites.filter(x=>x.kind==='existing').length,nc=scenario.sites.length-nb;
  msg('task',`Сравниваем варианты вывоза снега: ${scenario.demands.length} ${pl(scenario.demands.length,['источник','источника','источников'])} (${total} м³), ${nb} условных действующих площадок и ${nc} ${pl(nc,['место-кандидат','места-кандидата','мест-кандидатов'])} — ${isExact()?'точный выбор конфигураций из каталога.':'legacy: кандидаты проверяются по одному.'}`);
}
// ---------- routes ----------
function pathLatLngs(path){const out=[];for(const arc of path.arcs){const e=edgeLookup.get(arc.edgeId);if(!e)continue;let g=e.geometry;if(!arc.forward)g=[...g].reverse();for(const [lon,lat] of g)out.push([lat,lon]);}return out;}
function routePopup(g,loaded,i,s){const box=el('div');const km=loaded?g.outwardKm:g.homeKm;
  box.append(el('h3',loaded?`Гружёный: источник ${i+1} → площадка ${s}`:`Возврат пустой машины: площадка ${s} → источник ${i+1}`),el('p',`Рейсов: ${g.trips} · объём: ${g.volumeM3} м³`),el('p',`Длина в одну сторону: ${fmtKm(km)} км · за все рейсы (в одну сторону): ${fmtKm(km*g.trips)} км`));return box;}
function drawRoutes(v){
  routeLayer.clearLayers();msg('route-status','');if(!v)return;
  let groups;
  try{if(isExact()){if(!routeEngine)routeEngine=createRouteEngine(network,{closedEdgeIds:scenario.closedEdgeIds??[],cacheLimit:8});groups=v.res.assignments.map(a=>exactRoute(routeEngine,a));}else groups=aggregateTrips(v.res.assignments);}
  catch(e){msg('route-status','Маршруты на карте не показаны: '+e.message+'. Числовой результат сохранён.');return;}
  for(const g of groups){
    const i=scenario.demands.findIndex(d=>d.id===g.demandId),site=scenario.sites.find(x=>x.id===g.siteId),s=site?shortSiteName(site):g.siteId;
    const out=pathLatLngs(g.outward),back=pathLatLngs(g.home);if(!out.length&&!back.length)continue;
    if(out.length)L.polyline(out,{pane:'routes',color:'#fff',weight:8,opacity:.8,interactive:false}).addTo(routeLayer);
    if(back.length)L.polyline(back,{pane:'routes',color:BACK_COLOR,weight:6,opacity:.95,dashArray:'8 8',bubblingMouseEvents:false}).bindPopup(()=>routePopup(g,false,i,s)).addTo(routeLayer);
    if(out.length){L.polyline(out,{pane:'routes',color:ROUTE_COLOR,weight:3,opacity:1,bubblingMouseEvents:false}).bindPopup(()=>routePopup(g,true,i,s)).addTo(routeLayer);
      L.marker(out[Math.floor(out.length/2)],{pane:'routes',interactive:false,keyboard:false,icon:L.divIcon({className:'route-label',html:`<span>${g.trips}</span>`,iconSize:[Math.max(24,14+String(g.trips).length*7),24],iconAnchor:[Math.max(24,14+String(g.trips).length*7)/2,12]})}).addTo(routeLayer);}
  }
}
function fitMap(){const pts=[...scenario.demands,...scenario.sites].filter(x=>network.nodes[x.nodeId]).map(x=>latLng(x.nodeId));if(!pts.length)return;
  const lg=document.querySelector('.legend'),room=lg&&lg.open?lg.offsetHeight+24:30;   // keep points clear of the legend
  map.fitBounds(L.latLngBounds(pts),{maxZoom:13.5,paddingTopLeft:[60,60],paddingBottomRight:[60,room]});}
// ---------- result panel ----------
function buildVariants(r){
  const baseIds=scenario.sites.filter(x=>x.kind==='existing').map(x=>x.id),sn=id=>shortSiteName(scenario.sites.find(x=>x.id===id)||{id});
  const baseLabel=baseIds.map(sn).join(' + ');
  return [{key:'base',label:'База',comp:baseLabel,res:r.baseline,siteIds:baseIds,isBase:true},
    ...r.variants.map(v=>({key:v.siteId,label:'+ '+sn(v.siteId),comp:baseLabel+' + '+sn(v.siteId),res:v,siteIds:[...baseIds,v.siteId],isBase:false}))];
}
function kpi(label,value,small,cls){const d=el('div',null,'kpi'+(cls?' '+cls:''));d.append(el('span',label),el('strong',value));if(small)d.append(el('small',small));return d;}
function renderResult(){
  const vbox=$('variants'),v=curVariant(),scroll=vbox.scrollTop??0;vbox.replaceChildren();
  for(const x of ['composition','headline','kpis','sites-use','routes-text','details-body'])$(x).replaceChildren();
  $('headline').className='headline';
  msg('solver-status',lastResult&&isExact()?rankingText(lastResult):lastResult?'Legacy: приближённый результат, не доказанный минимум.':'');
  $('solver-status').dataset.tone=!lastResult?'neutral':isExact()&&lastResult.search.rankingStatus==='exact_top_k'?'success':'warning';
  renderExclusions();
  if(!lastResult||!v){
    $('composition').textContent='';$('headline').append(el('span',lastResult&&isExact()?'Нет решения для отображения. Смотрите статус поиска.':'Условия изменены или расчёт ещё не выполнен. Нажмите «Пересчитать».','empty'));
    drawRoutes(null);return;
  }
  const base=variants.find(x=>x.isBase)?.res??null,total=scenario.demands.reduce((s,d)=>s+d.volumeM3,0);
  for(const x of variants){
    const b=el('button',null);b.type='button';b.setAttribute('aria-pressed',String(x.key===selectedKey));b.dataset.key=x.key;
    const caption=x.isBase?'Базовый вариант':x.label;
    const title=isExact()&&!x.isBase?caption+' · '+(x.siteIds.map(id=>shortSiteName(scenario.sites.find(t=>t.id===id)||{id})).join(' + ')||'нет площадок'):caption;
    const summary=`${fmtKm(x.res.transportKm)} км · ${x.res.servedM3}/${total} м³ · ${trips(x.res.trips)}`;
    b.append(el('b',title),el('small',summary),el('small',isExact()?(x.res.status==='optimal'?'Оптимальное назначение':'Предварительное назначение'):(x.isBase?'Без нового места · legacy':'Площадки '+x.comp+' · legacy')));
    b.addEventListener('click',()=>{selectedKey=x.key;renderPoints();renderResult();[...vbox.querySelectorAll('button')].find(node=>node.dataset.key===x.key)?.focus({preventScroll:true});});vbox.append(b);
  }
  vbox.scrollTop=scroll;
  $('composition').textContent=v.isBase?`База = ${v.comp}. Новых площадок нет.`:isExact()?`Вариант ${v.label}: ${v.comp||'нет активных площадок'}. Новых: ${v.res.newSiteIds.length}; замены: ${v.res.relocatedGroups.map(g=>g.selectedSiteIds.join(', ')).join('; ')||'нет'}.`:`Вариант ${v.label} = ${v.comp}. Добавляется одна новая площадка, остальные кандидаты не учитываются.`;
  const h=isExact()?exactHeadline(total,base,v.res,v.isBase):headline(total,base,v.res,v.isBase);$('headline').className='headline '+h.tone;$('headline').textContent=h.text;
  const res=v.res,cmp=!v.isBase&&canCompare(base,res);
  const k=$('kpis');
  k.append(kpi('Вывезено',`${res.servedM3} из ${total} м³`),kpi('Осталось',`${res.unservedM3} м³`,res.unservedM3>0?'требует внимания':'всё вывезено',res.unservedM3>0?'bad':''),
    kpi('Пробег туда и обратно',fmtKm(res.transportKm)+' км',v.isBase?null:cmp?`${res.transportKm-base.transportKm<=0?'−':'+'}${fmtKm(Math.abs(res.transportKm-base.transportKm))} км к базе`:'сравнение с базой недоступно (объём или статус)'),
    kpi('Рейсов',String(res.trips)));
  const det=el('details',null,'more');det.style.gridColumn='1/3';det.append(el('summary','Время и затраты движения'));
  const g=el('div',null,'kpis');g.append(kpi('Время в дороге',fmtDuration(res.estimatedDriveMinutes)),kpi('Условные затраты',(res.estimatedDriveCostRub??res.estimatedCostRub)==null?'тариф не задан':fmtRub(res.estimatedDriveCostRub??res.estimatedCostRub),'только движение; без погрузки, разгрузки и содержания площадок'));det.append(g);k.append(det);
  const su=$('sites-use');su.append(el('h3','Загрузка площадок'));
  const active=new Set(v.siteIds);
  for(const s of scenario.sites){const u=res.siteUtilization.find(z=>z.siteId===s.id),row=el('div',null,'use-row'+(active.has(s.id)?'':' off'));
    row.append(el('span',`${shortSiteName(s)} — ${s.kind==='existing'?'действующая (условно)':'кандидат'}`),el('span',active.has(s.id)?`${u?u.usedM3:0} / ${s.capacityM3} м³`:'не участвует'));
    if(active.has(s.id)&&u?.maxTripsDuringHorizon!=null)row.append(el('span',`Рейсы: ${u.usedTrips} / ${u.maxTripsDuringHorizon}`));
    if(active.has(s.id)){const p=document.createElement('progress');p.max=Math.max(1,s.capacityM3);p.value=u?u.usedM3:0;p.setAttribute('aria-label',`Загрузка площадки ${shortSiteName(s)}`);row.append(p);}su.append(row);}
  const rt=$('routes-text');
  for(const a of rows(res)){const i=scenario.demands.findIndex(d=>d.id===a.demandId),s=scenario.sites.find(x=>x.id===a.siteId);
    rt.append(el('li',`Источник ${i+1} → площадка ${s?shortSiteName(s):a.siteId}: ${trips(a.trips)}, ${a.volumeM3} м³; ${fmtKm(a.kmPerTrip??a.outwardKm+a.homeKm)} км за рейс туда и обратно`));}
  if(!rt.children.length)rt.append(el('li','Рейсов нет.'));
  const db=$('details-body');
  if(isExact()){
    db.append(el('h3','Ограничения и достоверность','small-h'));
    db.append(el('p','Горизонт: условное событие. Никакая площадка не подтверждена юридически. Неизвестные ограничения не проверены.'));
    const warns=el('ul',null,'reasons'),labels={legal_not_assessed:'Юридический допуск не проверен.',trip_limit_unknown:'У части площадок лимит приёма рейсов неизвестен.',snow_type_unknown:'Совместимость типов снега частично неизвестна.',same_node:'Совпадение узлов не подтверждает нулевую длину реального подъезда.',intra_site_distance_unknown:'Неизвестный внутренний пробег не включён.'};
    for(const w of lastResult.warnings??[])warns.append(el('li',labels[w.code]??w.message));db.append(warns);
    db.append(el('p','Хеш сценария: '+lastResult.scenarioHash,'helper'));
  }
  if(res.unservedReasons?.length){db.append(el('h3','Почему остался снег','small-h'));const ul=el('ul',null,'reasons');
    for(const u of res.unservedReasons){const i=scenario.demands.findIndex(d=>d.id===u.demandId);ul.append(el('li',`Источник ${i+1} (${u.demandId}): не вывезено ${u.unservedM3} м³ — ${reasonText(u)} [${u.code}]`));}db.append(ul);}
  const t=document.createElement('table');t.className='cmp';const cap=t.createCaption();cap.textContent='Сравнение вариантов';cap.className='small-h';
  const hr=t.createTHead().insertRow();for(const x of ['Вариант','Вывезено, м³','Осталось, м³','Пробег, км','Рейсов','Сравнимо с базой'])hr.append(Object.assign(document.createElement('th'),{textContent:x,scope:'col'}));
  const tb=t.createTBody();for(const x of variants){const r=tb.insertRow();const th=document.createElement('th');th.scope='row';th.textContent=x.isBase?'База':x.label;r.append(th);
    for(const c of [x.res.servedM3,x.res.unservedM3,fmtKm(x.res.transportKm),x.res.trips,x.isBase?'—':canCompare(base,x.res)?'да':'нет (объём/статус)'])r.insertCell().textContent=String(c);}
  db.append(t);
  drawRoutes(v);
}
function syncSettingsInputs(){for(const [k,id] of [['count','new-count'],['topK','top-k'],['timeLimitMs','time-limit']])$(id).value=settings[k];}
function readSettings(){const next={...settings};for(const [k,id] of [['count','new-count'],['topK','top-k'],['timeLimitMs','time-limit']])next[k]=$(id).value.trim()===''?NaN:Number($(id).value);return normalizeSettings(next,scenario);}
function renderPolicy(){
 const existing=scenario.sites.filter(t=>t.kind==='existing').length,groups=new Set(settings.replacements.map(r=>r.existingId)).size;
 $('exact-controls').hidden=!isExact();$('exclusions-panel').hidden=!isExact();$('mode-help').hidden=!isExact();$('legacy-help').hidden=isExact();
 msg('result-title',isExact()?'Точная оптимизация':'Приблизительный расчёт');
 $('new-count').max=String(availableAdditions(scenario,settings));
 msg('policy-summary',`Действующих: ${existing}; групп переноса: ${groups}; доступных кандидатов для ${existing?'добавления':'выбора с нуля'}: ${availableAdditions(scenario,settings)}. При переносе выбирается одно место из каждой группы (включая исходное).`);
}
function renderExclusions(){
 $('export-runs').disabled=!runHistory.length;msg('run-history-status',`В памяти вкладки: ${runHistory.length} точных расчётов (до 5). ${droppedRuns?'Вытеснено старых: '+droppedRuns+'. ':''}Скачайте JSON перед закрытием сайта.`);
 const actions=$('exclusion-actions'),list=$('exclusions-list');actions.replaceChildren();list.replaceChildren();
 if(!isExact())return;
 const siteName=id=>scenario.sites.find(t=>t.id===id)?.name??id;
 for(const e of settings.excludedSiteIds)list.append(el('li',siteName(e.id)+' — '+e.reason));
 for(const e of settings.excludedConfigurations)list.append(el('li','Набор '+e.siteIds.map(siteName).join(' + ')+' — '+e.reason));
 $('clear-exclusions').disabled=!list.children.length;
 const v=curVariant();if(!v||v.isBase||!lastResult)return;
 const add=(text,fn)=>{const b=el('button',text,'secondary');b.type='button';b.addEventListener('click',fn);actions.append(b);};
 for(const id of v.siteIds.filter(id=>scenario.sites.some(t=>t.id===id&&t.kind==='candidate')))add('Отклонить '+siteName(id),()=>exclude({id}));
 add('Отклонить эту комбинацию',()=>exclude({siteIds:[...v.siteIds]}));
}
function exclude(item){
 const reason=$('exclusion-reason').value.trim();if(!reason){msg('stats-status','Введите причину отклонения');$('exclusion-reason').focus();return;}
 const next=structuredClone(settings);if(item.id)next.excludedSiteIds.push({...item,reason});else next.excludedConfigurations.push({...item,reason});
 try{settings=normalizeSettings(next,scenario);}catch(e){msg('stats-status',e.message);return;}
 pendingParent=lastResult?.scenarioHash??null;$('exclusion-reason').value='';selectedKey='';changed({keepParent:true});return compare();
}
function changed({keepParent=false}={}){if(!keepParent)pendingParent=null;gate.changed();lastResult=null;variants=[];routeEngine=null;renderPolicy();renderPoints();renderResult();renderEntries();msg('stats-status','Изменено — пересчитайте');const b=$('compare');b.textContent='Пересчитать';b.disabled=false;$('cancel-solve').hidden=true;}
async function compare(){
 if(gate.busy)return;
 if(!updateTruck()){msg('stats-status','Исправьте выделенные поля («Изменить условия» → «Машина»)');return;}
 let request,exact=isExact();
 try{if(exact){settings=readSettings();request=buildExactRequest(scenario,settings,health,pendingParent);}else{if(hasExactOnlySettings(scenario,settings))throw Error('Legacy не поддерживает перенос, отклонения или физические ограничения. Используйте точный режим либо явно снимите ограничения.');request=scenario;}}
 catch(e){msg('stats-status',e.message);return;}
 // Clear old drawing before a new solve; no stale success/error may replace a newer revision.
 lastResult=null;variants=[];routeEngine=null;renderPoints();renderResult();
 const token=gate.begin(),button=$('compare');$('headline').textContent=exact?'Выполняется точный поиск. Результаты появятся после проверки solver.':'Выполняется приблизительный расчёт.';button.textContent='Считаем…';button.disabled=true;$('cancel-solve').hidden=false;msg('stats-status',exact?'Выполняется точный поиск…':'Считаем эвристику…');
 const snapshot=JSON.stringify(request);
 try{
   const r=await getJson(exact?'/api/v1/optimize':'/api/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:snapshot,signal:token.signal});
   if(!gate.isCurrent(token))return;
   if(exact&&(r.networkHash!==health.networkHash||r.networkVersion!==health.networkVersion))throw Error('Ответ для другой версии сети');
   if(exact){runHistory.push({request:JSON.parse(snapshot),response:r});if(runHistory.length>5){runHistory.shift();droppedRuns++;}}
   lastResult=r;variants=exact?exactVariants(r,scenario.sites):buildVariants(r);pendingParent=null;
   if(!variants.some(x=>x.key===selectedKey)||selectedKey==='base'&&!hasFit)selectedKey=variants.find(x=>!x.isBase)?.key??variants[0]?.key??'';
   renderPoints();renderResult();if(!hasFit){fitMap();hasFit=true;}
   msg('stats-status',exact?(r.search.rankingStatus==='exact_top_k'?'Готово: точный рейтинг':'Расчёт завершён: '+r.search.rankingStatus):'Готово (legacy)');
 }catch(err){
   if(err.name==='AbortError'||!gate.isCurrent(token))return;
   msg('stats-status',exact?'Ошибка точного расчёта — проверьте Python/SciPy или сообщение API. Автоматического перехода на legacy нет.':'Ошибка расчёта legacy');lastResult=null;variants=[];renderResult();$('headline').replaceChildren(el('span','Не удалось рассчитать: '+err.message,'empty'));
 }finally{if(gate.isCurrent(token)||!gate.busy){gate.finish(token);button.disabled=false;$('cancel-solve').hidden=true;button.textContent='Пересчитать';}}
}
// ---------- form (single source of truth) ----------
const TRUCK_INPUTS=[['bodyM3','body'],['payloadKg','payload'],['driveKmh','speed'],['rateRubPerHour','rate'],['snowDensityKgM3','density']];
function fieldError(inputId,text){let e=document.getElementById(inputId+'-err');const input=$(inputId);
  if(!e){e=el('small',null,'field-err');e.id=inputId+'-err';e.setAttribute('role','alert');input.after(e);}
  e.textContent=text||'';input.setAttribute('aria-invalid',text?'true':'false');}
function updateTruck(){
  let ok=true;const values={};
  for(const [field,inputId] of TRUCK_INPUTS){const r=validateTruckField(field,$(inputId).value);fieldError(inputId,r.ok?'':r.error);if(r.ok)values[field]=r.value;else ok=false;}
  if(!ok)return false;
  try{truckCapacity(values);}catch(e){
    const detail='Укажите грузоподъёмность и плотность вместе (или оставьте обе пустыми); машина должна вмещать не менее 1 м³.';
    fieldError('payload',detail);fieldError('density',detail);return false;
  }
  const {snowDensityKgM3,...truck}=values;scenario.truck=truck;scenario.snowDensityKgM3=snowDensityKgM3;return true;
}
function truckControls(){const t=scenario.truck;$('body').value=t.bodyM3??'';$('payload').value=t.payloadKg??'';$('density').value=scenario.snowDensityKgM3??'';$('speed').value=t.driveKmh??'';$('rate').value=t.rateRubPerHour??'';for(const [,id] of TRUCK_INPUTS)fieldError(id,'');}
// ---------- drawer: points list ----------
function renderEntries(){const div=$('entries');div.replaceChildren();
  const rows=[...scenario.demands.map((p,i)=>({p,kind:'demand',i})),...scenario.sites.map(p=>({p,kind:'site'}))];
  for(const {p:point,kind,i} of rows){
    const array=kind==='demand'?scenario.demands:scenario.sites,entry=el('div',null,'entry'),title=el('div');
    if(kind==='site'&&point.kind==='candidate'){const nm=document.createElement('input');nm.type='text';nm.maxLength=120;nm.value=point.name;nm.className='name-edit';nm.setAttribute('aria-label','Название кандидата');
      nm.addEventListener('change',()=>{const v=nm.value.trim();if(v){point.name=v.slice(0,120);changed();}else nm.value=point.name;});title.append(nm);}
    else title.append(el('strong',kind==='demand'?`${i+1}. ${point.name}`:point.name));
    title.append(el('span',kind==='demand'?'Источник · объём, м³':point.kind==='existing'?'Условная действующая площадка · вместимость, м³':'Кандидат (не утверждён) · вместимость, м³'));
    const controls=el('div',null,'entry-actions'),input=document.createElement('input');input.type='number';input.min=kind==='demand'?'1':'0';input.max='1000000';input.step='1';input.value=kind==='demand'?point.volumeM3:point.capacityM3;
    input.setAttribute('aria-label',(kind==='demand'?'Объём снега, м³: ':'Вместимость, м³: ')+point.name);
    input.addEventListener('change',()=>{const n=Number(input.value);if(input.value.trim()!==''&&Number.isSafeInteger(n)&&n>=(kind==='demand'?1:0)&&n<=1000000){point[kind==='demand'?'volumeM3':'capacityM3']=n;changed();}else input.value=kind==='demand'?point.volumeM3:point.capacityM3;});
    const loc=el('button','На карте');loc.type='button';loc.setAttribute('aria-label','Показать на карте: '+point.name);loc.addEventListener('click',()=>{closeDrawer();const m=markers.get(point.id);if(m){map.setView(m.getLatLng(),Math.max(map.getZoom(),14));m.openPopup();}});
    const del=el('button','×');del.type='button';del.title='Удалить точку';del.setAttribute('aria-label','Удалить: '+point.name);del.addEventListener('click',()=>{const j=array.findIndex(v=>v.id===point.id);if(j>=0)array.splice(j,1);if(kind==='site')settings=removeSiteSettings(settings,point.id);changed();});
    if(isExact()){
      title.classList.add('entry-constraints');
      const select=(label,options,value,onChange)=>{const lab=el('label',label),sel=document.createElement('select');sel.setAttribute('aria-label',label+': '+point.name);for(const [v,t] of options){const o=el('option',t);o.value=v;sel.append(o);}sel.value=value;sel.addEventListener('change',()=>{onChange(sel.value);changed();});lab.append(sel);title.append(lab);};
      const stamp=()=>{scenario.assumptionDate=new Date().toISOString().slice(0,10);};
      if(kind==='demand')select('Тип снега',[['unknown','Неизвестен'],['clean','Условно чистый'],['with_reagents','С реагентами']],point.snowType??'unknown',v=>{point.snowType=v;stamp();});
      else{
        const limit=el('label','Лимит рейсов за событие (пусто — неизвестен)'),n=document.createElement('input');n.type='number';n.min='0';n.max='1000000';n.step='1';n.className='constraint-input';n.value=point.maxTripsDuringHorizon??'';n.setAttribute('aria-label','Лимит рейсов: '+point.name);n.addEventListener('change',()=>{const v=n.value.trim()===''?null:Number(n.value);if(v!=null&&(!Number.isSafeInteger(v)||v<0||v>1000000)){msg('stats-status','Некорректный лимит рейсов');n.value=point.maxTripsDuringHorizon??'';return;}if(v==null)delete point.maxTripsDuringHorizon;else point.maxTripsDuringHorizon=v;stamp();changed();});limit.append(n);title.append(limit);
        select('Принимаемый снег',[['unknown','Неизвестно'],['both','Оба типа'],['clean','Только чистый'],['with_reagents','Только с реагентами'],['none','Ни один из известных типов']],point.acceptedSnowTypes==null?'unknown':point.acceptedSnowTypes.length===2?'both':point.acceptedSnowTypes[0]??'none',v=>{if(v==='unknown')delete point.acceptedSnowTypes;else point.acceptedSnowTypes=v==='both'?['clean','with_reagents']:v==='none'?[]:[v];stamp();});
        if(point.kind==='candidate')select('Роль кандидата',[['','Новое место'],...scenario.sites.filter(t=>t.kind==='existing').map(t=>[t.id,'Альтернатива для '+t.name])],settings.replacements.find(r=>r.candidateId===point.id)?.existingId??'',v=>{settings.replacements=settings.replacements.filter(r=>r.candidateId!==point.id);if(v)settings.replacements.push({candidateId:point.id,existingId:v});});
      }
    }
    controls.append(input,loc,del);entry.append(title,controls);div.append(entry);}
}
// ---------- drawer / dialogs / pick mode ----------
function openDrawer(tab){$('drawer').hidden=false;$('edit-btn').setAttribute('aria-expanded','true');if(tab)showTab(tab);}
function closeDrawer(){if($('drawer').hidden)return;$('drawer').hidden=true;$('edit-btn').setAttribute('aria-expanded','false');}
function showTab(name){for(const t of ['points','truck','file']){const on=t===name;$('tab-'+t).setAttribute('aria-selected',String(on));$('panel-'+t).hidden=!on;}}
function beginAdd(mode){selectedMode=mode;closeDrawer();map.getContainer().style.cursor='crosshair';const b=$('pick-banner');b.hidden=false;b.textContent='Нажмите на дорогу на карте, чтобы добавить '+(mode==='site'?'кандидата':mode==='existing'?'условную действующую площадку':'источник снега')+' (Esc — отмена)';}
function endPick(){selectedMode=null;map.getContainer().style.cursor='';$('pick-banner').hidden=true;}
// ---------- import / export ----------
function downloadJson(out,name){const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function saveScenario(exact=false){try{if(!updateTruck())throw Error('Исправьте параметры машины');settings=readSettings();if(exact)downloadJson(buildExactRequest(scenario,settings,health,pendingParent),'snowsite-request-v1.json');else downloadJson({...scenario,mapSettings:settings,meta:{exportedAt:new Date().toISOString(),networkVersion:network.version,networkHash:health.networkHash,app:'snow-site-4.10.1-map',note:'Привязка экспорта — текущий граф. Сценарные данные; юридическая допустимость не проверена',sourceNetworkBinding:scenario.networkVersion&&scenario.networkHash?'version_and_hash_verified':scenario.networkVersion||scenario.networkHash?'partial':'unspecified'}},'snowsite-scenario.json');}catch(e){msg('stats-status',e.message);}}
function applyMapScenario(raw){
  const candidate=sanitizeScenario(raw,network,health),candidateSettings=normalizeSettings(raw.mapSettings,candidate);
  endPick();scenario=candidate;settings=candidateSettings;syncSettingsInputs();$('calc-mode').value='exact';truckControls();hasFit=false;selectedKey='';changed();fitMap();const note=candidate.networkVersion&&candidate.networkHash?'Исходная привязка сети проверена.':'Полная исходная привязка к снимку сети не указана; ID узлов проверены на текущем графе.';msg('pick-help','Сценарий загружен. '+note);msg('stats-status','Сценарий загружен — нажмите «Пересчитать». '+note);
}
async function loadScenario(file){const revision=gate.revision;try{if(file.size>1024*1024)throw Error('Файл слишком большой');let raw;try{raw=JSON.parse(await file.text());}catch{throw Error('файл не является корректным JSON')}
  if(revision!==gate.revision)return;applyMapScenario(raw);}
  catch(e){if(revision!==gate.revision)return;msg('stats-status','Ошибка импорта — сценарий не изменён');msg('pick-help','Импорт отклонён: '+e.message+'. Текущий сценарий сохранён.');openDrawer('file');$('panel-file').prepend(Object.assign(el('p','Импорт отклонён: '+e.message+'. Текущий сценарий сохранён.','field-err'),{role:'alert',id:'import-err'}));}}
async function loadExtendedDemo(){
  if(!window.confirm('Заменить текущие условия учебным сценарием 2+2 из 6? Если нужно сохранить текущий сценарий, сначала скачайте JSON в разделе «Файл».'))return;
  const revision=gate.revision,button=$('demo-extended');button.disabled=true;
  try{const raw=await getJson('/demo-extended.json');if(revision!==gate.revision)return;applyMapScenario(raw);closeDrawer();await compare();}
  catch(e){if(revision===gate.revision)msg('stats-status','Не удалось загрузить демо: '+e.message);}
  finally{button.disabled=false;}
}
async function boot(){try{
  [network,scenario,health]=await Promise.all([getJson('/api/network'),getJson('/api/demo'),getJson('/api/health')]);
  if(network.version!==health.networkVersion)throw Error('Версия сети не совпадает с API');syncSettingsInputs();
  document.querySelector('.legend').open=false;
  edgeLookup=new Map(network.edges.map(e=>[String(e.id),e]));
  initMap();truckControls();renderPolicy();renderEntries();renderPoints();renderResult();fitMap();
  for(const [,id] of TRUCK_INPUTS)$(id).addEventListener('input',()=>{updateTruck();changed();});
  $('demo-extended').addEventListener('click',loadExtendedDemo);$('demo-extended').disabled=false;
  $('compare').addEventListener('click',compare);$('cancel-solve').addEventListener('click',()=>{changed();msg('stats-status','Расчёт отменён. При необходимости повторите после освобождения solver.');});
  $('calc-mode').addEventListener('change',()=>{selectedKey='';changed();});
  for(const id of ['new-count','top-k','time-limit'])$(id).addEventListener('input',()=>{try{settings=readSettings();}catch{}changed();});
  $('clear-exclusions').addEventListener('click',()=>{settings.excludedSiteIds=[];settings.excludedConfigurations=[];changed();});
  let resetTimer=null;$('reset').addEventListener('click',async()=>{const b=$('reset');
    if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Точно сбросить? Нажмите ещё раз';clearTimeout(resetTimer);resetTimer=setTimeout(()=>{b.dataset.armed='';b.textContent='Сброс';},4000);return;}
    clearTimeout(resetTimer);b.dataset.armed='';b.textContent='Сброс';
    scenario=await getJson('/api/demo');settings=defaultSettings();syncSettingsInputs();$('calc-mode').value='exact';truckControls();hasFit=false;selectedKey='';changed();fitMap();msg('stats-status','Демо-сценарий восстановлен — нажмите «Пересчитать»');});
  $('new-existing').addEventListener('click',()=>beginAdd('existing'));
  $('new-demand').addEventListener('click',()=>beginAdd('demand'));$('new-site').addEventListener('click',()=>beginAdd('site'));
  $('fit-map').addEventListener('click',fitMap);
  $('export-runs').addEventListener('click',()=>downloadJson({schemaVersion:'map-session-1',droppedRuns,runs:runHistory},'snowsite-map-results.json'));
  $('export').addEventListener('click',()=>saveScenario());$('export-exact').addEventListener('click',()=>saveScenario(true));
  $('import').addEventListener('change',e=>{$('import-err')?.remove();const file=e.target.files[0];e.target.value='';if(file)return loadScenario(file);});
  $('edit-btn').addEventListener('click',()=>$('drawer').hidden?openDrawer():closeDrawer());$('drawer-close').addEventListener('click',()=>{closeDrawer();$('edit-btn').focus();});
  for(const t of ['points','truck','file'])$('tab-'+t).addEventListener('click',()=>showTab(t));
  $('how-btn').addEventListener('click',()=>$('how').showModal());$('how-close').addEventListener('click',()=>$('how').close());
  $('variants').addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key))return;const bs=[...$('variants').querySelectorAll('button')],i=bs.indexOf(document.activeElement);if(i<0)return;bs[(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:bs.length-1))%bs.length].focus();e.preventDefault();});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(selectedMode)endPick();else if(!$('drawer').hidden){closeDrawer();$('edit-btn').focus();}});
  await compare();
}catch(e){msg('stats-status','Ошибка запуска: '+e.message);$('headline').textContent='Не удалось загрузить карту. Проверьте локальный сервер и перезагрузите страницу.';console.error(e);}}
export const ready=boot();
