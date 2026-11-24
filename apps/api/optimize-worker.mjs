import {parentPort,workerData} from 'node:worker_threads';
import {optimize} from '../../packages/optimization/optimize.mjs';
import {DomainError} from '../../packages/contracts/validate.mjs';
const controller=new AbortController();
parentPort.on('message',m=>{if(m==='cancel')controller.abort();});
try{const {network,networkMeta,request}=workerData;const result=await optimize(network,request,{networkMeta,signal:controller.signal});parentPort.postMessage({result});}
catch(e){if(!(e instanceof DomainError))console.error(e);parentPort.postMessage({error:{code:e.code??'internal_error',message:e instanceof DomainError?e.message:'Optimization failed',path:e.path??''},status:e instanceof DomainError?e.status:500});}
finally{parentPort.close();}
