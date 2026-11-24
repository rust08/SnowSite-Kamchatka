# External SDK smoke (private local package)

No publishing, registry access or application server. Use Node 22+ and Python 3.13 with pinned solver dependencies installed in the active environment. Tested on Linux. The archive name below follows the unchanged package version 0.3.0 (product release v4.8).

From SnowSite root, use a new sibling directory (POSIX shell example):

```sh
mkdir -p ../sdk-smoke/consumer
npm pack --offline --ignore-scripts --pack-destination ../sdk-smoke
cp examples/v48/external-sdk.mjs ../sdk-smoke/consumer/check.mjs
cp examples/v43/network.json ../sdk-smoke/consumer/network.json
cp examples/v44/add-2-plus-2.json ../sdk-smoke/consumer/request.json
cd ../sdk-smoke/consumer
npm init -y
npm install --offline --ignore-scripts --no-audit --no-fund ../snowsite-kamchatka-0.3.0.tgz
node check.mjs
```

The example uses the externally installed root SDK and both public subpaths rather than package self-reference, and the Python worker bundled under `node_modules`. Expected score/fingerprint is in `docs/benchmarks/v48/external-sdk-result.json`. Its baseline leaves 3 m³ unserved; do not compare its 16 km directly to the full-service alternatives' 56 km. These are synthetic scenarios, not real operational results. `private:true` prevents accidental npm publication; the local tarball is not a published distribution and includes source/evidence/docs. Review contents/licensing before distributing beyond the authorized team. No production deployment added.
