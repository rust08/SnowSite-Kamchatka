import test from 'node:test';import assert from 'node:assert/strict';
import {startServer} from '../src/server.mjs';
import {readFileSync} from 'node:fs';
const scenario=JSON.parse(readFileSync(new URL('../data/fixtures/scenario.demo.json',import.meta.url)));

test('local HTTP server health, UI, compare and invalid data', async()=>{
 const server=startServer(0);
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
   const health=await fetch(base+'/api/health');assert.equal(health.status,200);
   const h=await health.json();assert.equal(h.networkVersion,'pkgo-27233df581c6');
   const html=await fetch(base+'/');assert.equal(html.status,200);assert.match(await html.text(),/SnowSite/);
   const result=await fetch(base+'/api/compare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(scenario)});
   assert.equal(result.status,200);const r=await result.json();assert.equal(r.variants.length,2);
   assert.equal(r.baseline.unservedM3,0);assert.equal(r.baseline.transportKm,167.098);
   const bad=await fetch(base+'/api/compare',{method:'POST',headers:{'content-type':'application/json'},body:'not-json'});
   assert.equal(bad.status,400);
   const outside=await fetch(base+'/../../package.json');assert.equal(outside.status,404);
 } finally{await new Promise(resolve=>server.close(resolve));}
});
