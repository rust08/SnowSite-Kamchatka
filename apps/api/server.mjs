import {createServer} from 'node:http';
import {readFileSync,statSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve,extname,relative,isAbsolute,sep} from 'node:path';
import {compareSites} from '../../packages/optimization/legacy.mjs';
import {loadNetwork} from '../../packages/routing/network-file.mjs';
import {DomainError} from '../../packages/contracts/validate.mjs';
import {Worker} from 'node:worker_threads';
import {createNetworkRegistry} from './network-registry.mjs';
const dir=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const webRoot=realpathSync(join(dir,'apps/web'));
const insideWeb=file=>{const rel=relative(webRoot,file);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);};
const {network,networkMeta}=loadNetwork(join(dir,'data/snapshots/pkgo-27233df581c6/city-network.json'),'pkgo');
const demo=JSON.parse(readFileSync(join(dir,'data/fixtures/scenario.demo.json'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
export function startServer(port=Number(process.env.PORT||8793),{registryFile=process.env.SNOW_NETWORK_REGISTRY}={}){
  const registry=createNetworkRegistry({network,networkMeta},registryFile);
  let solving=false;
  const srv=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
      // Explicit browser-safe modules, served from their single canonical source. No generic package/file access.
      const browserModules={'/lib/routing/engine.mjs':'packages/routing/engine.mjs','/lib/contracts/validate.mjs':'packages/contracts/validate.mjs',
        '/lib/haul-evidence/index.mjs':'packages/haul-evidence/index.mjs',
        '/lib/haul-evidence/validate.mjs':'packages/haul-evidence/validate.mjs',
        '/lib/haul-evidence/reconcile.mjs':'packages/haul-evidence/reconcile.mjs',
        '/lib/haul-evidence/report.mjs':'packages/haul-evidence/report.mjs',
        '/lib/haul-evidence/parse.mjs':'packages/haul-evidence/parse.mjs',
        '/lib/haul-evidence/bytes.mjs':'packages/haul-evidence/bytes.mjs'};
      if(req.method==='GET'&&Object.hasOwn(browserModules,url.pathname)){
        const data=readFileSync(join(dir,browserModules[url.pathname]));res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(data);
      }
      if(req.method==='GET'&&url.pathname==='/api/health')return json({ok:true,version:'snow-site-0.1',apiVersion:'1.0',networkId:networkMeta.id,networkHash:networkMeta.hash,networkVersion:network.version});
      if(req.method==='GET'&&url.pathname==='/api/demo')return json(demo);
      if(req.method==='GET'&&url.pathname==='/demo-extended.json')return json(JSON.parse(readFileSync(join(dir,'examples/v49/map-editor-2plus2.json'),'utf8')));
      if(req.method==='GET'&&url.pathname==='/api/network')return json(network);
      if(req.method==='GET'&&url.pathname==='/api/v1/networks')return json({schemaVersion:'1.0',networks:registry.list()});
      if(req.method==='POST'&&['/api/compare','/api/v1/optimize'].includes(url.pathname)){
        const error=(code,message,status,path='')=>json({error:message,code,path},status);
        if((req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json'){req.resume();return error('unsupported_media_type','Ожидается JSON',415);}
        if(Number(req.headers['content-length'])>1024*1024){req.resume();return error('resource_limit','Размер запроса превышает 1 МБ',413);}
        // Consume without retaining excess bytes; avoid destroying socket before 413 can be sent.
        const chunks=[];let bytes=0;
        for await(const chunk of req){bytes+=chunk.length;if(bytes<=1024*1024)chunks.push(chunk);else if(bytes-chunk.length<=1024*1024)chunks.length=0;}
        if(bytes>1024*1024)return error('resource_limit','Размер запроса превышает 1 МБ',413);
        let scenario;try{scenario=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return error('invalid_json','Некорректный JSON',400);}
        if(url.pathname==='/api/compare'){
          try{return json(compareSites(network,scenario));}catch(e){if(e instanceof DomainError)return error(e.code,e.message,e.status,e.path);throw e;}
        }
        let snapshot;try{snapshot=registry.lookup(scenario);}catch(e){if(e instanceof DomainError)return error(e.code,e.message,e.status,e.path);throw e;}
        if(solving)return error('busy','Оптимизатор занят',503);
        solving=true;let worker;
        const cancel=()=>{if(!res.writableEnded)worker?.postMessage('cancel');};
        try{
          worker=new Worker(new URL('./optimize-worker.mjs',import.meta.url),{workerData:{...snapshot,request:scenario},resourceLimits:{maxOldGenerationSizeMb:256}});
          res.once('close',cancel);if(res.destroyed)cancel();
          const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(Error('Optimization worker exited '+code));else reject(Error('Optimization worker closed without response'));});});
          if(res.destroyed)return;
          if(result.error)return error(result.error.code,result.error.message,result.status,result.error.path);
          return json(result.result);
        }finally{res.off('close',cancel);solving=false;}
      }
      if(req.method!=='GET')return json({error:'Метод не поддерживается'},405);
      const p=url.pathname==='/'?'index.html':url.pathname.replace(/^\/+/, '');
      if(p.includes('..')||p.includes('\\'))return json({error:'Недопустимый путь'},400);
      const file=resolve(webRoot,p);
      if(!insideWeb(file))return json({error:'Не найдено'},404);
      // Resolve symlinks and read before committing response headers. Directories,
      // missing assets and links outside the public root are not web resources.
      let data;
      try{
        const actual=realpathSync(file);
        if(!insideWeb(actual)||!statSync(actual).isFile())return json({error:'Не найдено'},404);
        data=readFileSync(actual);
      }catch(e){if(['ENOENT','ENOTDIR','EISDIR'].includes(e.code))return json({error:'Не найдено'},404);throw e;}
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});return res.end(data);
    }catch(e){console.error(e);if(res.destroyed)return;if(res.headersSent){res.destroy();return;}res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Внутренняя ошибка'}));}
  });
  srv.listen(port,'127.0.0.1');return srv;
}
export function launchServer(){
  const first=Number(process.env.PORT||8793);
  const tryPort=(port,left)=>{
    const server=startServer(port);
    server.once('error',e=>{
      if(e.code==='EADDRINUSE'&&left>0&&!process.env.PORT){console.log('Port '+port+' is busy, trying '+(port+1)+'...');tryPort(port+1,left-1);}
      else{console.error('Cannot start server: '+e.message+(e.code==='EADDRINUSE'?' (port '+port+' is busy; close the other SnowSite window or set PORT)':''));process.exit(1);}
    });
    server.once('listening',()=>{
      const url='http://127.0.0.1:'+server.address().port;console.log('SnowSite: '+url);
      if(process.env.SNOW_OPEN){const [cmd,args]=process.platform==='win32'?['cmd',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
        import('node:child_process').then(({spawn})=>{try{spawn(cmd,args,{stdio:'ignore',detached:true}).on('error',()=>{}).unref();}catch{}});}
    });
  };
  tryPort(first,20);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))launchServer();
