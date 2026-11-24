import test from 'node:test';
import assert from 'node:assert/strict';
import {startServer} from '../apps/api/server.mjs';

test('static directories and missing files return 404 without killing the API', async()=>{
 const server=startServer(0);
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const path of ['/vendor/','/lib','/vendor/missing.css','/index.html/not-a-file']){
   const response=await fetch(base+path);
   assert.equal(response.status,404,path);
   assert.equal(typeof (await response.json()).error,'string');
   const health=await fetch(base+'/api/health');
   assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
  }
  for(const [path,type] of [['/','text/html'],['/exact.html','text/html'],['/vendor/leaflet.js','text/javascript']]){
   const response=await fetch(base+path);assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith(type));assert.ok((await response.text()).length>0);
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});
