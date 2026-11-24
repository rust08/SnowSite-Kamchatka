// Trusted operator transport registry. Only startup configuration can load files.
// The request can identify a loaded snapshot; it can never supply a file or URL.
import {readFileSync,statSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {loadNetwork} from '../../packages/routing/network-file.mjs';
import {requireValid as check,id,validateNetwork} from '../../packages/contracts/validate.mjs';
import {hex,object} from '../../packages/contracts/request.mjs';
const MiB=1024*1024;
const key=(id,version)=>JSON.stringify([id,version]);
export function createNetworkRegistry(builtin,configFile){
 const records=new Map();
 function register(record){
  const {network,networkMeta:m}=record;
  check(id(m.id)&&id(m.version)&&hex(m.hash)&&m.version===network.version,'Invalid network metadata','registry');
  validateNetwork(network);
  const k=key(m.id,m.version);check(!records.has(k),'Duplicate network ID/version','registry');records.set(k,record);
 }
 register(builtin);
 if(configFile){
  const file=resolve(configFile),configStat=statSync(file);check(configStat.isFile()&&configStat.size<=64*1024,'Invalid registry config size/type','registry');
  const config=JSON.parse(readFileSync(file,'utf8'));
  check(object(config)&&config.schemaVersion==='1.0'&&Object.keys(config).every(k=>['schemaVersion','networks'].includes(k))&&Array.isArray(config.networks)&&config.networks.length<=7,'Invalid registry configuration (at most 7 additional snapshots)','registry');
  let totalBytes=0;
  for(const entry of config.networks){
   check(object(entry)&&Object.keys(entry).length===4&&['id','version','sha256','file'].every(k=>Object.hasOwn(entry,k))&&id(entry.id)&&id(entry.version)&&hex(entry.sha256)&&typeof entry.file==='string'&&entry.file.trim().length>0&&entry.file.length<=4096&&!/^[a-z][a-z0-9+.-]*:\/\//i.test(entry.file),'Invalid registry entry','registry');
   check(!records.has(key(entry.id,entry.version)),'Duplicate network ID/version','registry');
   const path=resolve(dirname(file),entry.file),stat=statSync(path);
   totalBytes+=stat.size;check(stat.isFile()&&stat.size<=32*MiB&&totalBytes<=64*MiB,'Registry snapshot size limit','registry','resource_limit');
   const record=loadNetwork(path,entry.id);
   check(record.networkMeta.hash===entry.sha256&&record.networkMeta.version===entry.version,'Registered snapshot hash or version mismatch','registry','network_mismatch',409);
   register(record);
  }
 }
 return {
  list:()=>[...records.values()].map(({networkMeta:m})=>({networkId:m.id,networkVersion:m.version,networkHash:m.hash})),
  lookup(request){
   check(object(request)&&request.schemaVersion==='1.0','Expected schemaVersion 1.0','schemaVersion');
   check(id(request.networkId)&&id(request.networkVersion)&&hex(request.networkHash),'Network ID/version/hash required','network');
   const r=records.get(key(request.networkId,request.networkVersion));
   check(r&&r.networkMeta.hash===request.networkHash,'Network snapshot mismatch','network','network_mismatch',409);
   return r;
  }
 };
}
