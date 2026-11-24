// Historical legacy regression (explicit legacy mode; needs Playwright): node tools/e2e.cjs [url]
const {chromium}=require('playwright');
const URL=process.argv[2]||'http://127.0.0.1:8793';
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:768}});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto(URL);await p.waitForFunction(()=>document.getElementById('task').textContent.includes('Сравниваем'));await p.selectOption('#calc-mode','legacy');await p.click('#compare');await p.waitForSelector('#variants button',{timeout:20000});await p.waitForTimeout(1500);
// first screen
const mapBox=await p.locator('#map').boundingBox(),resBox=await p.locator('.result').boundingBox();
ok(mapBox.y+mapBox.height<=768+2&&resBox.y+Math.min(resBox.height,200)<=768,'1366x768: map and result visible together without page scroll');
ok(await p.locator('.legend').isVisible(),'legend visible');
const btns=await p.$$eval('#variants button',a=>a.map(x=>[x.textContent,x.getAttribute('aria-pressed')]));
ok(btns.length===3,'3 variant buttons: '+JSON.stringify(btns));
console.log('   headline:',await p.textContent('#headline'));
ok((await p.textContent('#headline')).includes('меньше базового'),'headline compares with base');
const kp=await p.$$eval('#kpis .kpi strong',a=>a.map(x=>x.textContent));console.log('   kpis:',kp.join(' | '));
// switch to base by keyboard
await p.focus('#variants button >> nth=0');await p.keyboard.press('Enter');await p.waitForTimeout(300);
ok((await p.getAttribute('#variants button >> nth=0','aria-pressed'))==='true','keyboard: Enter selects base');
ok((await p.textContent('#composition')).startsWith('База'),'composition text updates for base');
await p.focus('#variants button >> nth=0');await p.keyboard.press('ArrowRight');
ok(await p.evaluate(()=>document.activeElement.dataset.key)!=='base','keyboard: ArrowRight moves focus');
await p.keyboard.press('Enter');await p.waitForTimeout(300);
const off=await p.$$eval('.pt-off',a=>a.length);ok(off===1,'inactive candidate is faded (count='+off+')');
// click source marker -> popup
await p.locator('.pt-src').first().click();await p.waitForTimeout(400);
const pop=await p.textContent('.leaflet-popup-content');ok(/Вывезено/.test(pop)&&/Осталось/.test(pop),'source popup: '+pop.slice(0,90));
await p.keyboard.press('Escape');
// route popup
await p.locator('.legend summary').click();
// drawer + BUG-01
await p.click('#edit-btn');ok(await p.locator('#drawer').isVisible(),'drawer opens');
await p.click('#tab-truck');await p.fill('#speed','33');await p.locator('#speed').blur();
await p.click('#tab-points');
await p.click('#new-demand');ok(!(await p.locator('#drawer').isVisible()),'drawer closes during map pick');
let box=await p.locator('#map').boundingBox();await p.mouse.click(box.x+box.width*0.5,box.y+box.height*0.5);await p.waitForTimeout(300);
await p.click('#edit-btn');await p.click('#new-site');box=await p.locator('#map').boundingBox();await p.mouse.click(box.x+box.width*0.6,box.y+box.height*0.55);await p.waitForTimeout(300);
await p.click('#edit-btn');await p.click('#tab-truck');ok(await p.inputValue('#speed')==='33','BUG-01 speed stays 33');
let sent=null;await p.route('**/api/compare',async r=>{sent=JSON.parse(r.request().postData());await r.continue();});
await p.click('#drawer-close');await p.click('#compare');await p.waitForTimeout(1500);
ok(sent&&sent.truck.driveKmh===33,'BUG-01 compare uses 33');await p.unroute('**/api/compare');
// BUG-02
for(const [dx,dy] of [[0.45,0.45],[0.5,0.48],[0.55,0.5]]){await p.click('#edit-btn');await p.click('#tab-points');await p.click('#new-demand');box=await p.locator('#map').boundingBox();await p.mouse.click(box.x+box.width*dx,box.y+box.height*dy);await p.waitForTimeout(200);}
await p.click('#edit-btn');await p.click('#tab-points');
await p.locator('.entry').filter({hasText:'Источник снега'}).nth(1).locator('button[title="Удалить точку"]').click();
await p.click('#new-demand');box=await p.locator('#map').boundingBox();await p.mouse.click(box.x+box.width*0.48,box.y+box.height*0.52);await p.waitForTimeout(200);
await p.click('#compare');await p.waitForTimeout(1500);ok((await p.textContent('#stats-status'))==='Готово (legacy)','BUG-02 compare OK after add/delete/add');
// BUG-03
let n=0;await p.route('**/api/compare',async r=>{n++;if(n===1)await new Promise(x=>setTimeout(x,1500));await r.continue();});
await p.click('#compare');await p.waitForTimeout(200);
await p.click('#edit-btn');await p.click('#tab-points');const cap=p.locator('.entry input[type=number]').last();await cap.fill('1');await cap.press('Tab');
ok((await p.textContent('#stats-status')).includes('Изменено'),'BUG-03 status "Изменено" while request in flight');
await p.click('#drawer-close');await p.click('#compare');await p.waitForTimeout(3000);ok((await p.textContent('#stats-status'))==='Готово (legacy)','BUG-03 second result applied');
await p.unroute('**/api/compare');
// BUG-04 reset/import
await p.click('#edit-btn');await p.click('#tab-file');await p.click('#reset');ok((await p.textContent('#reset')).includes('Точно'),'BUG-04 reset asks confirmation');
await p.setInputFiles('#import',{name:'x.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({meta:{networkVersion:'other'},demands:[],sites:[],truck:{}}))});await p.waitForTimeout(400);
ok((await p.textContent('#import-err')).includes('другой версии'),'BUG-04 import with other network version rejected');
await p.keyboard.press('Escape');ok(!(await p.locator('#drawer').isVisible()),'Escape closes drawer');
// deficit scenario
await p.click('#edit-btn');await p.click('#tab-file');await p.click('#reset');await p.click('#reset');await p.waitForTimeout(500);await p.click('#drawer-close');await p.selectOption('#calc-mode','legacy');await p.click('#edit-btn');
await p.click('#tab-points');const caps=p.locator('.entry input[type=number]');
for(const i of [5,6]){await caps.nth(i).fill('20');await caps.nth(i).press('Tab');}
await p.click('#drawer-close');await p.click('#compare');await p.waitForTimeout(1500);
console.log('   deficit headline:',await p.textContent('#headline'));
ok((await p.textContent('#headline')).includes('Осталось'),'deficit shows remaining volume');
ok(await p.locator('.pt-short').count()>0,'sources with remainder are ringed');
await p.screenshot({path:process.env.SHOT||'e2e-desktop.png'});
ok(errs.length===0,'no page errors '+JSON.stringify(errs.slice(0,3)));
await b.close();})();
