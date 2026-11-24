// Run with node examples/v45/integration.mjs from the checked-out package.
// Consumers supply an already loaded, trusted snapshot; file loading is a separate adapter.
import {readFileSync} from 'node:fs';
import {optimize,safeRequest} from 'snowsite-kamchatka';
import {loadNetwork} from 'snowsite-kamchatka/network-file';
const {network,networkMeta}=loadNetwork(new URL('../v43/network.json',import.meta.url),'synthetic-v43');
const request=safeRequest(JSON.parse(readFileSync(new URL('../v44/add-2-plus-2.json',import.meta.url),'utf8')));
const result=await optimize(network,request,{networkMeta});
console.log(JSON.stringify(result,null,2));
if(result.solver.status==='time_limit')process.exitCode=3;
