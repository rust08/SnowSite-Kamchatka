import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {optimize,safeRequest,exclusionRerun,inputFingerprint,DomainError} from 'snowsite-kamchatka';
import {loadNetwork} from 'snowsite-kamchatka/network-file';
import {validateSiteGeometry,adaptSiteRecord} from 'snowsite-kamchatka/catalog';
import {optimize as previousEntry} from '../src/core/optimize.mjs';
test('stable library boundary runs independent synthetic graph without HTTP and retains v1 contract',async()=>{
 assert.equal(optimize,previousEntry);assert.equal(typeof exclusionRerun,'function');assert.equal(typeof inputFingerprint,'function');assert.equal(typeof adaptSiteRecord,'function');assert.equal(typeof validateSiteGeometry,'function');
 const {network,networkMeta}=loadNetwork(new URL('../examples/v43/network.json',import.meta.url),'synthetic-v43');
 const original=JSON.parse(readFileSync(new URL('../examples/v44/add-2-plus-2.json',import.meta.url),'utf8'));
 const request=safeRequest(original),r=await optimize(network,request,{networkMeta});
 assert.equal(r.schemaVersion,'1.0');assert.equal(r.search.rankingStatus,'exact_top_k');assert.equal(r.alternatives[0].transportKm,56);assert.equal(r.alternatives.length,3);
 assert.ok(r.alternatives.every(a=>a.activeSiteIds.includes('E1')&&a.activeSiteIds.includes('E2')));
 await assert.rejects(optimize(network,{...request,networkHash:'a'.repeat(64)},{networkMeta}),DomainError);
});
