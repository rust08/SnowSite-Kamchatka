// H01-A4: independent pinned-byte and historical extended Top-5 gates.
// Hashes below are selected from the verified original v4.10.1 and accepted A3
// archives, never from the candidate. The two approved A3 integration edits
// and new H01 modules/assets use their accepted A3 hashes. No production imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
const pins = Object.freeze({
  ".github/workflows/check.yml": "edc0b37b7dd32ddb4e9eaa38315ae4e5a912aed7fb963d4169365c2eeaeb0b99",
  "START.bat": "07c1a54be2b3f8a0643cf2b578e963a61d357db1c1378fdb82e60719ad0dd101",
  "apps/api/network-registry.mjs": "29e36ac3f3d1c7770906d1263e6d77a00b5c9adef4767522bd11ce40147839ae",
  "apps/api/optimize-worker.mjs": "d83fe45ab5dc404cc524a323de207289644005f22e7ccda87b47f2b89c1d8f58",
  "apps/api/server.mjs": "2a4af3afb2bb896177a2498871ccc49541ffab5b9ed2c1061c7993fcc490d3a6",
  "apps/cli/cli.mjs": "d320eb862f593ab8e04a51aa9912cedf15efa2b313ff3a5f7fe8ae2020900c8a",
  "apps/web/app.js": "8805a62309c4a1ca5e30a05469cc1118e40863190ed0e4e4967b15721262a68f",
  "apps/web/city-context.js": "ce6c174c78261a62936949675780651d0b689c11f21278c99cfd2c9005672746",
  "apps/web/exact.html": "5ce7e2c51a9b321ed26f28f07d741d35fdda74506bb2c9fdb29fb0527e0c3fac",
  "apps/web/exact.js": "469b450316470538a9d24ae06490e721c98ff18b423ea1978d3cfb8df3fb7ebf",
  "apps/web/haul-evidence-demo/carrier.json": "d637b2adba3f8794ccc03e1b3c2848bcb5580428813d1045f36e98a5eff9ef97",
  "apps/web/haul-evidence-demo/receiver.json": "0c8fe87601dff95bfa3c0c63c1ee8bd467f365f2d948aa1df93c92c384575ec3",
  "apps/web/haul-evidence.css": "e165bb5b833b3012b59cce7ddc593e1699179d68e99bbc7ea2ed63ec66271df2",
  "apps/web/haul-evidence.html": "42384867066c93a5aa0169be1fe6c40dcf8b8136c00e4d03a2a4febdc368551b",
  "apps/web/haul-evidence.js": "3d025efa93f0e42554cc21346835548be46c8a941620ae7a6c910d28a184e4fc",
  "apps/web/index.html": "6bf4d2366e1ffccc75920c9cdc4ea1e520fd167f633f1a29d82ab67f4dd82d0b",
  "apps/web/lib/contracts/validate.mjs": "e41c0cd0c08d7b332b6ebb87bc9e7796521b3ecc79c3e04e7a5f603496953325",
  "apps/web/lib/core.js": "681175dadc853f5d987085e387b149c2d852df139fce31f03a0a41bc37d0a7a5",
  "apps/web/lib/exact-map.js": "361636f86a8f831ddafda1c65e932efa5e7285dbae64d82718ef6b275e3eac1a",
  "apps/web/style.css": "f8e9ee8ecc2ccf7c07016532b9b6136736359457edcdc479df54d12de14add37",
  "apps/web/terrain-map.webp": "901099622dca7eab5d803b5b204e9eb2245ca1d96528330507af4b1e353cc5a9",
  "apps/web/vendor/leaflet-LICENSE.txt": "bbc959aaef7488b38942e7f05cfd1244351f8bce54261951ea17dd7cf60f894b",
  "apps/web/vendor/leaflet.css": "337bfca5cabd03b39815b2700febe2b3b7edf55921c59cd49f88ecb328212303",
  "apps/web/vendor/leaflet.js": "db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a",
  "data/README.md": "994b4f6a426636ca283b9bd114298520014ab882cd6632804e770603efa10e8c",
  "data/evidence/pkgo-history.json": "cf235ce8f48db91ee482946a4c8cb90f4e42fb8d5c91d749a4817da594aa93f5",
  "data/evidence/sources-v1.json": "e47240d274868a0c1216f7627aff447e443911206eeed36fee01e83476457f25",
  "data/fixtures/scenario.demo.json": "53ab72fda223fba6b34d1a1905ca6aa1ce04d1ad5b5f02822666f1ef5d682e1c",
  "data/snapshots/pkgo-27233df581c6/CITY_SOURCES.md": "10258b1ab5907b3b0ee57e2bf0924ec3b07fc6b5e9f8289a01e9713ff406cbe4",
  "data/snapshots/pkgo-27233df581c6/city-network.json": "0e0a464f7d92057fa5bbad634c083ad0c1923294597d989ead386b393acf7ad2",
  "docs/benchmarks/v4101/evidence/extended.json": "b696d1fface42b4bfe9a065faeb78775909d27b806aa48fcc111e9c3a7d67c70",
  "examples/demo-v1.json": "892312c4b5daafc7131de6a9cfb39b33038a62696a1e8062a5a7824ef57b530c",
  "examples/demo-v1.result.json": "7ee6164ee401d324cddd40f2adf5e5cbd0393809eb044e476dbb6e4002348662",
  "examples/v43/add-2-plus-2.json": "35a8dcdc567348e5287dcee91e25647a18b379e7702be61b992a6632bf7b8b6e",
  "examples/v43/add-3-plus-1.json": "f395883de4ca29574bfe62b10628f77db456b389419dffc0bfba064b56b8126f",
  "examples/v43/frontier.json": "343424633ce9feff8cda8849a9fc2615ee206b9b1d7f156682e9386e077e3122",
  "examples/v43/greenfield.json": "30e9c2282dbcec5a40e390a6af92917c3df51b9c5b62708caaa478ad51378ad2",
  "examples/v43/network.json": "95069828541211729dca12b0343650e068b086a9820b3a14b5135ba3a3af1fac",
  "examples/v43/relocate.json": "ad613bf8a27b0b380688f3addc9ea9193678acfdf8005d2483cd1c2f45df4654",
  "examples/v44/add-2-plus-2.json": "c9f6da999f8a206a55769dfbd3e6715cc63f6db20719ac82abbf36d0d930a968",
  "examples/v44/intrasite-network.json": "ea5363ed0c32b17fc8da7ed997f6f429cba652b9524fa4ed2064cfaefac27a1d",
  "examples/v44/intrasite.json": "08d58986be00f96555a294f813dc651eb84aea1412841af6e567b2349fbdba7f",
  "examples/v44/registry.json": "c140848e81292570a05dc88407efa657654cb7e29a5811781934d73603c3d53a",
  "examples/v45/integration.mjs": "aabc610ef0f2fed13ab41d2610988d837ae1b5b5ce00c1825f03aafef114c6cb",
  "examples/v47/demo-bounded.json": "8797aac65c25f4e99b314c473edb84e956c10c3b26f78f7dc6f02d6cd117f3b8",
  "examples/v48/README.md": "24fcdd31582da80c288d62b5959ca69590d5e0b956d4cd9dc6caae6a240d1038",
  "examples/v48/external-sdk.mjs": "899c0e22a0424677915ed976082fb2afda2137c25a814f4f6523c9b8e789be97",
  "examples/v49/map-api-2plus2.json": "4506233c5ac5cedcb862f7c3bd79b09c3b1846c6da011984b6af52638d9c1647",
  "examples/v49/map-editor-2plus2.json": "4cee71f687bb75d4ae9508fc117eb35f7bd930510e779af78728b25257e7e401",
  "package.json": "c1c6c0cf90ef444a8f65ff0fd3f2a785f8101bec94fb4ce259716b078ec2c473",
  "packages/catalog/index.mjs": "82baaebbc0dd80b53601d40e28882e7254bc3887406d33bb1a795a6f03e1e3c3",
  "packages/catalog/site-catalog.mjs": "c2599bdf7a6e548ee1af5607381d01b1ae5c07c5d0cc96ea96894577981370b4",
  "packages/catalog/site-geometry.mjs": "783f814d4d1945380cc25254c57a295c513bf2a1b83138665ffa931c59d059a2",
  "packages/contracts/constraints.mjs": "bbbd38945a26fc7c7f627c00d298f7e7264e0ce652207662743a5d937d497dfe",
  "packages/contracts/index.mjs": "afffaa23d2ad0f8bd419233a45b9f771ef7dbeb5e5ebabe1c8b0ff7d9b3c6efc",
  "packages/contracts/request.mjs": "450c00d1981aacddc769c781fd28d3a0275227cbaa1fe3ab939bd8042d010626",
  "packages/contracts/schemas/network-registry-v1.schema.json": "5902163e6be7a9e86f7465c544437b3a99bde154ef7627c4df4b9e147010196f",
  "packages/contracts/schemas/optimize-request-v1.schema.json": "0bee8d5bd36e56e8e198596c7c7f20b3e9b88c968b37dc43762bec7f2976c13b",
  "packages/contracts/schemas/optimize-response-v1.schema.json": "10a684489bdbf23fa5c43ad55e35a1709bff5697ab42b6bd630152a618013230",
  "packages/contracts/schemas/scenario.schema.json": "ad9dc21739b2e36c611757a68b9e11a3f1328b8f67dfe32dbadfda5f9fcdf56a",
  "packages/contracts/schemas/site-evidence-v1.schema.json": "d416e2879f3568e8eaafb93db08cb0e3b117ad47564b99e8cac62a7cfaf61009",
  "packages/contracts/schemas/site-record-v1.schema.json": "34535ffb86d79d88fc560a4b5cb781b9a5ff825136759393b82c1091b935874d",
  "packages/contracts/validate.mjs": "62a84497cfa12b2b126e1360168a910daf2bdd973a0e1ce1c632867de5d926d2",
  "packages/haul-evidence/bytes.mjs": "cba66661701a85fada0f5f1b986510c48824e8e9014aeca77e8a9f3002b69fc0",
  "packages/haul-evidence/haul-evidence.synthetic.v0.1.schema.json": "67563b04968a1cd5991fbd2b2503e92cc866c5b09412c3101d2db99136a6fd94",
  "packages/haul-evidence/index.mjs": "07f47403f531442be004beef15b1e41f5c027d908881438453f3a61a7a5adf08",
  "packages/haul-evidence/parse.mjs": "06be4487cd7557093b8a963a15e43cb42624ff7ca87c0c6870b1e989ebcfd3cc",
  "packages/haul-evidence/reconcile.mjs": "8a8d5eb920dbeb466b6cb5a1a98b227c24d261c2591468d73e6f6b9d11f1e086",
  "packages/haul-evidence/report.mjs": "499a38c9cfda4121d624a5031762f816dc041f65236b8ecc739cdfb92d0a093b",
  "packages/haul-evidence/validate.mjs": "77c51365f069bef0bf36e84f195f26db842f74739268f0b1aa7bfde2ca70afdf",
  "packages/optimization/allocate.mjs": "bf783663f56874eed38dbf0a93ce7c60f63f9d5a5cb1bb3090cb211395811b3c",
  "packages/optimization/configuration-bound.mjs": "6017097c73873ac8ea82542d9ef8964a270cd8163fe6f8b7e01573a61a7a94e9",
  "packages/optimization/index.mjs": "c966fe82fc9fe88e1d53b52f83996c949979fafe59f6ee016fa8c4e29bc11852",
  "packages/optimization/legacy.mjs": "4b6e2073264132b5aba3da1ad51cb9e71cb1d707cc1e6cebbb021a9e8824e85d",
  "packages/optimization/optimize.mjs": "87739ce490dd1584006d5e698336b77b1ab5672132b5a3f710840ecb083a1fcb",
  "packages/optimization/public.mjs": "b0cf51887042e3e8b577b925256c942108734234b3225585e304f07a09d95ed4",
  "packages/optimization/select.mjs": "ba7da325f3fe6f81d7bd69047d0d9cc58c8364072732d539a3569c83e2fa8874",
  "packages/optimization/verify-result.mjs": "73f692f541d719dbb415456db3cc174bfb2afb0781e37513b5eb6122ee55c705",
  "packages/routing/engine.mjs": "980d6f1abd8315695f1d4339b1ed25be73998ead5c04be9726f9262d13885867",
  "packages/routing/index.mjs": "105ae910c56cace28ad42e3e07807a9dd06c32264812538c1023fea33845c036",
  "packages/routing/matrix.mjs": "db590a5fdaf0dffeccf6a4e3b9fa15c685e856cbf2880bd1c23a69bf8929f68a",
  "packages/routing/network-file.mjs": "28c9792b185e9929fe28c36134a610f5d77213e09205a5b6ff6bce76ea59825f",
  "solver/requirements.txt": "37c9c34e5e9abe8af4c42f642cb1cfdb2396f5ea76f346f7d920388fe0c8df1e",
  "solver/worker.py": "284c0aaf9573f78880189ca600003e83d4d6abb731e66b46b946c4f60a6e7649",
  "src/catalog.mjs": "f2e27125289e7940bd18d5566085e47b8c23169cfd97b3346ab98fa9429cba20",
  "src/cli.mjs": "339a8a3fa708a75102e12bbd92e3356af7a1a465f154411a8d17b7b501e1d69a",
  "src/core/allocate.mjs": "239a8317b8da336bca37537270bea5ab64dba944e25aac64947d40eeb513b2db",
  "src/core/constraints.mjs": "3f81b13a8c4bf7ec9eb430e016520d2f23e905752e21640864fb53c076dc5d77",
  "src/core/matrix.mjs": "03f918767ca8517ee385acfad033e0f0cf0c5cf81e20514270f16aff0e5d6e40",
  "src/core/network-file.mjs": "c2c6c45d8c6721303d0e7f78e1918d3864a6716f9af10efd0e3abe9ee5b7ef19",
  "src/core/optimize.mjs": "c1ca4fe00818b4e6cc3882feb0ad3a33e0c030e5198c11720316dcca66474839",
  "src/core/request.mjs": "f6e7bcae4c4598dde0ece59b487ac0840a98982d0d668276bff6ceac82024499",
  "src/core/select.mjs": "a73ecda4647a5f5725d3024a9db2abad11657612ccd191173ef2a7d91252e791",
  "src/core/site-catalog.mjs": "96ed5e74cd076366b250f5418aebdb30c0d3e2f19ebf3a2d8140cbeed3c34e5e",
  "src/core/site-geometry.mjs": "267283fa42b436288bc3c6992488de4a769b7276b9234bc2014bca3123bce571",
  "src/core/validate.mjs": "e900d8ed6773b033cb9a4bbd035ddcf80561a1568d95188ca9173fc21e01e61e",
  "src/core/verify-result.mjs": "e588fc9e54b4deb5f9957b8e28c21fce546b761d79a19d2993f5209474511ca8",
  "src/index.mjs": "0c5f3a453e56c014d95ae94a88c25f3668416c112685fb6477faa463ffb0aad1",
  "src/network-registry.mjs": "30890e976a7dd68273809b69cdb33a05864fcf7ebd3df13553dfe25c48c6ee75",
  "src/optimize-worker.mjs": "d126ad5a97a9b6e2941e50add0203d294332c2f24c2e0097215b7372773b6dd7",
  "src/optimizer.mjs": "4872e5712d1aa00405a324bf85ac0651d7c466e379669503b25e06e2f4660d9b",
  "src/routing.mjs": "1563d10fc972512a919909977445a696b03653c39bea905351ae0ff941e7fa0c",
  "src/server.mjs": "39395f876a1d54a589349af958c642a97dbdca4a31e71411be4794d0436049c6",
  "src/solvers/exact-adapter.mjs": "bfc377de3de89d4e64c1a0cccff67a576f3b4a1ee42d24f02c2babf35b75e719",
  "tests/fixtures/haul-evidence/carrier.json": "d637b2adba3f8794ccc03e1b3c2848bcb5580428813d1045f36e98a5eff9ef97",
  "tests/fixtures/haul-evidence/expected-report.json": "f63da3f746c70457a126774aeb3c40004ebdd59e40bbb28ad8932ba8f8221d93",
  "tests/fixtures/haul-evidence/expected_semantics.json": "d34002b5e1be6226662d941630737d5e8bf7cfdf05a7b610dbbb3847b93ec69b",
  "tests/fixtures/haul-evidence/receiver.json": "0c8fe87601dff95bfa3c0c63c1ee8bd467f365f2d948aa1df93c92c384575ec3",
  "tools/acceptance.py": "2cf385186a5447d5ec73de1af294e6f290a0c6da2d7fd15dc6f4d164800c05da",
  "tools/benchmark-v43.mjs": "b6aaba2e302eab3e7bac09824cd2c048109970e6038668f562ae86902cb51768",
  "tools/benchmark-v44.mjs": "529066a8c09e7a050c7031485304d7721bb6fe713a137512f7b2480260e40b3f",
  "tools/benchmark-v45.mjs": "bc6ea70b5454f0495beee08ca34fa22313b52bcd00c26e74fcdaccb4f20142f5",
  "tools/benchmark-v47.mjs": "8d4cfa24b98511778fd44acc3b24d65b6dcdac2b27e054294f76e9c87d514467",
  "tools/browser-requirements.txt": "df7696acf1e200684a962c8b7cb25363273b8239093235e68bb3f60231a9799f",
  "tools/browser-smoke.py": "0ecc84f877f86982c030ff3598246d345057bd41e3ee697a088fb1fba7e3ff96",
  "tools/check-contracts.py": "c97eef4239b13f06d866e45672f09d8bb40b4764a28e1d8cf2260ee83455aa74",
  "tools/check-data.mjs": "461d3dcf05580aa3118d8dd62b582f35ed4333f926ffab04c5994b50fbc65783",
  "tools/check-haul-evidence-contract.py": "c464b95677f6b35b48704b901455825e12993e875eb2b3fb380140175b4c6b7b",
  "tools/check-manifest.mjs": "92ae0e7c03cce62a10cef28028f04226d9c77b0d977c5ba754cdc219c5535562",
  "tools/contract-requirements.txt": "3a727a9e0fcd872939d3f26303ef71bde418ebffa16bac85f30fe95e2b1f823a",
  "tools/e2e.cjs": "3549c20d7177f57399fae11f2f5b960f19059ee39ce1a16b2a1238afa56b9e12",
  "tools/generate-manifest.mjs": "723d0618c719a3b8d62cd86a430b0717ff9646ef4151037c923b1a848674387d",
  "tools/import-site-leads.mjs": "04985138f649b2916fae5f7d4e33ee5523821e3581bf45ef167d9519f9d7a40c",
  "tools/make-v43-examples.mjs": "4c516317c247bee78636b6cd24d19de1649c34ac31620f8dcd2b33cfe5ce63db",
  "tools/verify-v47-benchmark.mjs": "d8dba7c5b9f9021fcfd16f3d0ac81c59e8885b2b0582f71acc3ff98643563626",
  "workers/milp-python/README.md": "a8b13d44fc5b019f04cfa341bdb21b1bfec5b63acd5ee46260f6bfd4b5781681",
  "workers/milp-python/exact-adapter.mjs": "c9e8c3eb82a57391474c54eccb17cc6ddff3cb9376c84bcbb14b869b89a6effc",
  "workers/milp-python/requirements.txt": "1668a3152e33680d94637b13421c15e68bd97cd8701f7f555c691f5bc5c0b9f3",
  "workers/milp-python/worker.py": "46f29d647c71ee43a0bbb849c47aa895aba850eb07476b465b4c93b2d9fff753"
} );
const digest = path => createHash('sha256').update(readFileSync(new URL('../'+path, import.meta.url))).digest('hex');
test('C22 pinned original runtime, inputs and accepted H01 bytes', () => {
 for (const [path,sha] of Object.entries(pins)) assert.equal(digest(path),sha,path);
 console.log(`C22 ${Object.keys(pins).length} independent byte pins PASS`);
});
// Hand-transcribed from immutable v4.10.1 docs/benchmarks/v4101/evidence/extended.json
// and ADR004; no calls to candidate solver to construct expectations.
const expected = [
 [['C1','C6'],70508430], [['C3','C6'],71054490], [['C4','C6'],78682230],
 [['C2','C6'],84600400], [['C1','C4'],90254310]
];
const expectedBaseline = 159425990;
function check(result) {
 assert.equal(result.networkHash,pins['data/snapshots/pkgo-27233df581c6/city-network.json']);
 assert.equal(result.search.rankingStatus,'exact_top_k');
 assert.equal(result.search.configurationsTotal,15);
 assert.equal(result.search.topKRequested,5); assert.equal(result.search.topKReturned,5);
 assert.equal(result.baseline.configurationId,'["S0","S1"]');
 assert.deepEqual(result.baseline.activeSiteIds,['S0','S1']);
 assert.equal(result.baseline.transportDistanceMm,expectedBaseline);
 assert.equal(result.alternatives.length,5);
 for (const a of [result.baseline,...result.alternatives]) {
  assert.equal(a.status,'optimal'); assert.equal(a.servedM3,228); assert.equal(a.unservedM3,0);
  assert.ok(Number.isSafeInteger(a.transportDistanceMm));
 }
 assert.deepEqual(result.alternatives.map(a=>[a.newSiteIds,a.transportDistanceMm]),expected);
 for (let i=0;i<expected.length;i++) {
  const ids=[...expected[i][0],'S0','S1'];
  assert.deepEqual(result.alternatives[i].activeSiteIds,ids);
  assert.equal(result.alternatives[i].configurationId,JSON.stringify(ids));
 }
}
test('C23 historical extended exact Top-5, actual CLI integer mm and configuration IDs', {timeout:120000}, () => {
 const historical=JSON.parse(readFileSync(new URL('../docs/benchmarks/v4101/evidence/extended.json',import.meta.url),'utf8'));
 check(historical);
 const run=spawnSync(process.execPath,['apps/cli/cli.mjs','examples/v49/map-api-2plus2.json'],{cwd:root,encoding:'utf8',timeout:100000,maxBuffer:8*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.ifError(run.error); assert.equal(run.status,0,run.stderr);
 const actual=JSON.parse(run.stdout); check(actual);
 console.log('C23 actual CLI result: '+JSON.stringify({baseline:actual.baseline,alternatives:actual.alternatives,search:actual.search,networkHash:actual.networkHash}));
});
