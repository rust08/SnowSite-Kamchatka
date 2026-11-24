import test from 'node:test';import assert from 'node:assert/strict';
import {nextId,createRequestGate,validateTruckField,fmtDuration,aggregateTrips,isComparable} from '../apps/web/lib/core.js';

test('BUG-02: ids stay unique after deleting a middle point (sources)',()=>{
  const ids=['D1','D2'];
  for(let i=0;i<3;i++)ids.push(nextId('DUSER',ids));            // DUSER1..3
  ids.splice(ids.indexOf('DUSER2'),1);                            // delete the middle one
  const fresh=nextId('DUSER',ids);
  assert.ok(!ids.includes(fresh));assert.equal(fresh,'DUSER4');
});
test('BUG-02: ids stay unique for candidates and imported custom ids',()=>{
  const ids=['S0','S1','CUSER7','CUSER2'];
  const a=nextId('CUSER',ids);assert.equal(a,'CUSER8');ids.push(a);
  ids.splice(ids.indexOf('CUSER8'),1);ids.push('CUSER9');
  assert.equal(nextId('CUSER',ids),'CUSER10');
  assert.equal(nextId('X',['X1','X1a','Xfoo']),'X2');
  assert.equal(nextId('Z',[]),'Z1');
});
test('BUG-03: stale response is rejected after the scenario changes',async()=>{
  const gate=createRequestGate();
  const first=gate.begin();                    // slow request started with revision 0
  gate.changed();                              // user edits capacity -> revision 1, first aborted
  assert.equal(first.signal.aborted,true);
  const second=gate.begin();
  assert.equal(gate.isCurrent(first),false);   // late answer of #1 must be ignored
  assert.equal(gate.isCurrent(second),true);
});
test('BUG-03: a newer request supersedes an older one even with no edit between',()=>{
  const gate=createRequestGate();const a=gate.begin(),b=gate.begin();
  assert.equal(a.signal.aborted,true);assert.equal(gate.isCurrent(a),false);assert.equal(gate.isCurrent(b),true);
});
test('BUG-03: edit after the last request finished invalidates its result',()=>{
  const gate=createRequestGate();const t=gate.begin();gate.finish(t);assert.equal(gate.isCurrent(t),true);
  gate.changed();assert.equal(gate.isCurrent(t),false);
});
test('BUG-03 end-to-end shape: slow first fetch cannot overwrite second result',async()=>{
  const gate=createRequestGate();let shown=null;
  const run=(label,ms)=>{const t=gate.begin();return new Promise(r=>setTimeout(r,ms)).then(()=>{if(!t.signal.aborted&&gate.isCurrent(t))shown=label;gate.finish(t);});};
  const p1=run('first(old state)',60);gate.changed();const p2=run('second(new state)',10);
  await Promise.all([p1,p2]);assert.equal(shown,'second(new state)');
});
test('BUG-01: truck field validation keeps valid values and rejects bad ones',()=>{
  assert.deepEqual(validateTruckField('driveKmh','33'),{ok:true,value:33});
  assert.deepEqual(validateTruckField('driveKmh','33,5'),{ok:true,value:33.5});
  assert.equal(validateTruckField('driveKmh','0').ok,false);
  assert.equal(validateTruckField('driveKmh','').ok,false);
  assert.equal(validateTruckField('driveKmh','abc').ok,false);
  assert.equal(validateTruckField('rateRubPerHour','-5').ok,false);
  assert.deepEqual(validateTruckField('rateRubPerHour',''),{ok:true,value:null});
  assert.equal(validateTruckField('bodyM3','10.5').ok,false);
});
test('fmtDuration formats hours and minutes',()=>{
  assert.equal(fmtDuration(501.3),'8 ч 21 мин');assert.equal(fmtDuration(45),'45 мин');assert.equal(fmtDuration(NaN),'не указано');
});
test('aggregateTrips merges identical source->site trips',()=>{
  const arcs={km:1,arcs:[]};
  const g=aggregateTrips([{demandId:'D1',siteId:'S',volumeM3:10,km:2,outward:arcs,home:arcs},{demandId:'D1',siteId:'S',volumeM3:6,km:2,outward:arcs,home:arcs},{demandId:'D2',siteId:'S',volumeM3:5,km:4,outward:arcs,home:arcs}]);
  assert.equal(g.length,2);assert.equal(g[0].trips,2);assert.equal(g[0].volumeM3,16);
});
test('isComparable only for equal served volume',()=>{
  assert.equal(isComparable({servedM3:228},{servedM3:228}),true);assert.equal(isComparable({servedM3:40},{servedM3:140}),false);
});
import {headline,shortSiteName,reasonsSummary,fmtKm} from '../apps/web/lib/core.js';
const mk=(o)=>({servedM3:228,unservedM3:0,transportKm:100,trips:20,unservedReasons:[],...o});
test('headline: deficit is a warning, never a success',()=>{
  const h=headline(228,mk({servedM3:40,unservedM3:188,transportKm:12}),mk({servedM3:140,unservedM3:88,unservedReasons:[{code:'capacity_exhausted'}]}),false);
  assert.equal(h.tone,'warn');assert.match(h.text,/Из 228 м³ вывезено 140 м³\. Осталось 88 м³: вместимости доступных площадок недостаточно\./);
});
test('headline: comparable variant reports km difference with % and no savings claim',()=>{
  const h=headline(228,mk({transportKm:167.098}),mk({transportKm:108.556}),false);
  assert.equal(h.tone,'ok');assert.match(h.text,/меньше базового на 58,5 км/);assert.match(h.text,/−35,0%/);assert.match(h.text,/не фактическая экономия/);
});
test('headline: different served volume is not presented as km saving',()=>{
  const h=headline(228,mk({servedM3:40,unservedM3:188}),mk({servedM3:228}),false);
  assert.equal(h.tone,'info');assert.match(h.text,/не сравниваются/);assert.ok(!/меньше базового/.test(h.text));
});
test('headline: zero baseline km gives no NaN/Infinity',()=>{
  const h=headline(228,mk({transportKm:0}),mk({transportKm:5}),false);
  assert.ok(!/NaN|Infinity/.test(h.text));assert.match(h.text,/не определяется/);
});
test('shortSiteName and reasonsSummary',()=>{
  assert.equal(shortSiteName({name:'Кандидат C — сценарий'}),'C');assert.equal(shortSiteName({name:'Базовая площадка A — сценарий'}),'A');assert.equal(shortSiteName({id:'X'}),'X');
  assert.match(reasonsSummary([{code:'no_round_trip_route'}]),/нет маршрута/);assert.equal(fmtKm(NaN),'не указано');
});
