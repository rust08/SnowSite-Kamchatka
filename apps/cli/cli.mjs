import {readFileSync} from 'node:fs';
import {loadNetwork} from '../../packages/routing/network-file.mjs';
import {optimize} from '../../packages/optimization/optimize.mjs';
import {DomainError} from '../../packages/contracts/validate.mjs';
import {fileURLToPath} from 'node:url';
const usage='Usage: node apps/cli/cli.mjs [--network FILE --network-id ID] REQUEST.json (or - for stdin)';
try{
 let path=fileURLToPath(new URL('../../data/snapshots/pkgo-27233df581c6/city-network.json',import.meta.url)),id='pkgo',input;
 const args=process.argv.slice(2);while(args.length){const a=args.shift();if(a==='--network'||a==='--network-id'){const v=args.shift();if(!v)throw new DomainError(usage);if(a==='--network')path=v;else id=v;}else if(a==='--help'){console.log(usage);process.exit(0);}else if(!input&&(a==='-'||!a.startsWith('-')))input=a;else throw new DomainError(usage);}
 if(!input)throw new DomainError(usage);
 const raw=readFileSync(input==='-'?0:input);if(raw.length>1024*1024)throw new DomainError('Request exceeds 1 MiB','','resource_limit',413);
 let request;try{request=JSON.parse(raw.toString('utf8'));}catch{throw new DomainError('Invalid JSON','','invalid_json',400);}
 const {network,networkMeta}=loadNetwork(path,id);
 const result=await optimize(network,request,{networkMeta});console.log(JSON.stringify(result));
 if(result.solver.status==='time_limit')process.exitCode=3;
}catch(e){console.error(e.message);console.log(JSON.stringify({error:{code:e.code??'internal_error',message:e instanceof DomainError?e.message:'Optimization failed',path:e.path??''}}));process.exitCode=e instanceof DomainError?2:1;}
