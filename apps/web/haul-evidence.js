import {reconcileEvidenceBytes,serializeEvidenceReport} from '/lib/haul-evidence/index.mjs';
import {parseEvidenceJson} from '/lib/haul-evidence/parse.mjs';
import {decodeEvidenceBytes,sha256EvidenceBytes} from '/lib/haul-evidence/bytes.mjs';

const $=id=>document.getElementById(id);
const carrier=$('carrier-file'),receiver=$('receiver-file'),cutoff=$('as-of');
const exportButton=$('export'), status=$('status');
const roles=['carrier','receiver'];
const MAX_BYTES=2097152, PAGE_SIZE=25;
const DEMO_CUTOFF='2026-01-05T00:00:00Z';
const DEMO_URLS=['/haul-evidence-demo/carrier.json','/haul-evidence-demo/receiver.json'];
let generation=0,current=null,objectUrl=null;
const message=code=>({missing_files:'Выберите оба файла.',byte_limit:'Файл превышает 2 МиБ.',read_failed:'Не удалось прочитать файл.',demo_failed:'Не удалось загрузить локальные демонстрационные файлы.',invalid_as_of:'Укажите корректный UTC as-of с Z.',invalid_utf8:'Файл не является корректным UTF-8.',utf8_bom:'UTF-8 BOM не допускается.',invalid_json:'Некорректный JSON.',duplicate_member:'Повторяющееся имя поля JSON.',depth_limit:'Превышена допустимая вложенность JSON.',invalid_bytes:'Некорректные входные байты.',crypto_unavailable:'Web Crypto недоступен. Сверка без SHA-256 запрещена.',crypto_failure:'Не удалось вычислить SHA-256.',invalid_pair:'Источники не образуют допустимую пару (роль, scope или период).',invalid_envelope:'Некорректный реестр: проверьте схему, режим, поля и лимиты.',row_limit:'Превышено допустимое число строк.',export_failed:'Не удалось скачать отчёт.'})[code]??'Сверка не выполнена: проверьте входные данные и окружение.';
const fail=code=>{throw Object.assign(new Error(code),{code});};
function revoke(){if(objectUrl!==null){URL.revokeObjectURL(objectUrl);objectUrl=null;}}
function closeInspection(){ $('inspection').hidden=true;$('inspect-ref').textContent='';$('inspect-row').textContent=''; }
function clearResult(){current=null;revoke();exportButton.disabled=true;$('result').hidden=true;for(const id of ['metadata','diagnostics','totals','pairs','unusable'])$(id).replaceChildren();closeInspection();}
function invalidate(text){generation++;clearResult();status.textContent=text;return generation;}
function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);return node;}
const value=v=>v===null?'— (неизвестно / неприменимо)':Array.isArray(v)?JSON.stringify(v):String(v);
const json=v=>JSON.stringify(v,null,2);
function table(parent,headers,rows){const wrapper=element('div');wrapper.className='table-wrap';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label',headers.join(' / '));const t=element('table'),head=element('thead'),tr=element('tr');for(const label of headers){const th=element('th',label);th.setAttribute('scope','col');tr.append(th);}head.append(tr);t.append(head);const body=element('tbody');for(const cells of rows){const row=element('tr');for(const c of cells){const td=element('td');if(typeof c==='object'&&c!==null&&!Array.isArray(c))td.append(c);else td.textContent=value(c);row.append(td);}body.append(row);}t.append(body);wrapper.append(t);parent.append(wrapper);}
function details(label,text){const d=element('details'),s=element('summary',label),p=element('pre',text);p.className='detail-text';d.append(s,p);return d;}
function refText(ref){return `${ref.source} / ${ref.datasetId} / records #${ref.rowIndex}`;}
function inspect(context,ref){
 if(current!==context)return;
 try {
  // Parse at most once per source, only when a report reference is opened.
  const source=context.sources.get(ref.source);
  if(!source||context.report.datasets[ref.source].datasetId!==ref.datasetId)return;
  const data=source.decoded??=parseEvidenceJson(decodeEvidenceBytes(source.bytes));
  if(data.source!==ref.source||data.datasetId!==ref.datasetId||!Number.isInteger(ref.rowIndex)||ref.rowIndex<1||ref.rowIndex>data.records.length)return;
  $('inspect-ref').textContent=`${refText(ref)} · SHA-256 ${context.report.datasets[ref.source].sha256}`;
  $('inspect-row').textContent=json(data.records[ref.rowIndex-1]);$('inspection').hidden=false;$('inspect-row').focus();
 }catch{invalidate('Не удалось открыть строку из проверенного снимка. Выполните сверку заново.');}
}
function refList(context,refs){const parent=element('div');if(!refs.length){parent.append(element('span','Нет ссылок'));return parent;}const disclosure=element('details');disclosure.append(element('summary',`Ссылки на строки (${refs.length})`));const container=element('div');disclosure.append(container);let built=false;disclosure.addEventListener('toggle',()=>{if(!disclosure.open||built||current!==context)return;built=true;paginate(container,refs,context,(part,target)=>{for(const ref of part){const button=element('button',refText(ref));button.type='button';button.className='ref';button.addEventListener('click',()=>inspect(context,ref));target.append(button);}});});parent.append(disclosure);return parent;}
function sideCell(context,side){const node=element('div');node.append(element('strong',side.state),element('p',`Объём: ${value(side.quantity)}`),element('p',`Область: ${value(side.scope)}`),details('Причины',json(side.reasons)),details('Ревизии и доставки',json(side.deliveries)),refList(context,side.refs));return node;}
function paginate(parent,items,context,render){let page=0;const count=Math.max(1,Math.ceil(items.length/PAGE_SIZE));function paint(){if(current!==context)return;parent.replaceChildren();const controls=element('div');controls.className='pagination';const previous=element('button','Назад'),next=element('button','Далее');previous.type=next.type='button';previous.className=next.className='secondary';previous.disabled=page===0;next.disabled=page+1>=count;previous.addEventListener('click',()=>{if(page>0){page--;paint();}});next.addEventListener('click',()=>{if(page+1<count){page++;paint();}});controls.append(previous,element('span',`Страница ${page+1} / ${count} · всего ${items.length}`),next);parent.append(controls);if(items.length)render(items.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE),parent);else parent.append(element('p','Нет записей.'));}paint();}
function render(context){const r=context.report;const meta=$('metadata');meta.append(element('p',`mode: ${r.mode} · coverage: ${r.coverage} (полнота не подтверждена)`),element('p',`Scope: ${r.scopeId} · UTC период [${r.periodStart}, ${r.periodEnd}) · as-of ${r.asOf}`),element('p',`Слот перевозчика → ${context.slotRoles[0]}; слот принимающей стороны → ${context.slotRoles[1]}. Результат сгруппирован по проверенным ролям source.`));table(meta,['Роль','Dataset ID','SHA-256'],roles.map(role=>[role,r.datasets[role].datasetId,r.datasets[role].sha256]));const d=$('diagnostics');d.append(element('h3','Счётчики и диагностика cutoff'));table(d,['Показатель',...roles],Object.keys(r.sideCounts.carrier).filter(k=>k!=='effectiveStates').concat(Object.keys(r.cutoffDiagnostics.carrier)).map(k=>[k,...roles.map(role=>r.sideCounts[role][k]??r.cutoffDiagnostics[role][k])]));table(d,['Состояние',...roles],Object.keys(r.sideCounts.carrier.effectiveStates).map(k=>[k,...roles.map(role=>r.sideCounts[role].effectiveStates[k])]));table(d,['Статус пары','Число'],Object.entries(r.pairCounts));const t=$('totals');t.append(element('h3','Точные объёмы по областям (м³, nominal)'));for(const [label,groups] of [['Известные активные — carrier',r.totals.knownActive.carrier],['Известные активные — receiver',r.totals.knownActive.receiver],['Совпавшие записи',r.totals.matched],['Разность сопоставимых пар (carrier − receiver)',r.totals.comparableDifference]]){t.append(element('h4',label));const page=element('div');t.append(page);paginate(page,groups,context,(part,target)=>table(target,['Область [contract, site, unit, basis]','Объём'],part.map(x=>[x.scope,x.quantity])));}
 paginate($('pairs'),r.pairs,context,(part,target)=>table(target,['Ключ [namespace, series, ticket]','Статус','Carrier','Receiver','Совпавший объём','Причины пары'],part.map(p=>[p.key,p.status,sideCell(context,p.carrier),sideCell(context,p.receiver),p.matchedQuantity,details('Причины',json(p.reasons))])));
 paginate($('unusable'),roles.flatMap(role=>r.unusableRows[role]),context,(part,target)=>table(target,['Строка','Причины','Инспекция'],part.map(x=>[refText(x.ref),details('Причины',json(x.reasons)),refList(context,[x.ref])])));$('result').hidden=false;
}
async function fileBytes(file){if(!file)fail('missing_files');if(file.size>MAX_BYTES)fail('byte_limit');try{return new Uint8Array(await file.arrayBuffer());}catch{fail('read_failed');}}
async function demoBytes(path){try{const response=await fetch(path,{method:'GET'});if(!response.ok)fail('demo_failed');return new Uint8Array(await response.arrayBuffer());}catch{fail('demo_failed');}}
async function execute(mode){const token=invalidate('Выполняется сверка…');if(mode==='demo'){carrier.value='';receiver.value='';cutoff.value=DEMO_CUTOFF;}const asOf=cutoff.value,files=[carrier.files[0],receiver.files[0]];try{if(mode==='manual'){if(files.some(f=>!f))fail('missing_files');if(files.some(f=>f.size>MAX_BYTES))fail('byte_limit');}const bytes=await Promise.all(mode==='demo'?DEMO_URLS.map(demoBytes):files.map(fileBytes));if(token!==generation)return;const report=await reconcileEvidenceBytes(bytes[0],bytes[1],asOf);if(token!==generation)return;
 // Resolve the slot mapping against the accepted role-qualified hashes, not raw labels.
 // One extra digest avoids reparsing both sources on initial paint. The row view is lazy.
 const firstHash=await sha256EvidenceBytes(bytes[0]);if(token!==generation)return;
 const matching=roles.filter(role=>report.datasets[role].sha256===firstHash);
 if(matching.length!==1)fail('crypto_failure');
 const slotRoles=[matching[0],roles.find(role=>role!==matching[0])];
 const sources=new Map(slotRoles.map((role,i)=>[role,{bytes:bytes[i],decoded:null}]));
 const context={report,sources,slotRoles};current=context;render(context);exportButton.disabled=false;status.textContent='Сверка завершена. Данные синтетические, полнота не подтверждена.';
 }catch(error){if(token!==generation)return;clearResult();status.textContent=message(error?.code);}}
for(const input of [carrier,receiver,cutoff]){input.addEventListener('input',()=>invalidate('Входные данные изменены. Выполните новую сверку.'));input.addEventListener('change',()=>invalidate('Входные данные изменены. Выполните новую сверку.'));}
$('run').addEventListener('click',()=>execute('manual'));$('demo').addEventListener('click',()=>execute('demo'));$('reset').addEventListener('click',()=>{carrier.value='';receiver.value='';cutoff.value='';invalidate('Выберите два файла и задайте UTC as-of или запустите демо.');});$('close-inspect').addEventListener('click',closeInspection);
exportButton.addEventListener('click',()=>{if(!current||exportButton.disabled)return;const link=element('a');try{revoke();objectUrl=URL.createObjectURL(new Blob([serializeEvidenceReport(current.report)],{type:'application/json'}));link.href=objectUrl;link.download='haul-evidence-report.json';document.body.append(link);link.click();}catch{invalidate(message('export_failed'));}finally{link.remove();revoke();}});
