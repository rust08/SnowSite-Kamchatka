# Canonical code map — v4.10.1

## H01 Alpha additions (accepted A1–A3; A4 review candidate)

| Path | Responsibility |
|---|---|
| `packages/haul-evidence/index.mjs` | Pure sync `reconcileEvidence`, async `reconcileEvidenceBytes`, accepted serializer |
| `packages/haul-evidence/validate.mjs`, `reconcile.mjs`, `report.mjs` | Parsed-object validation, as-of history, BigInt quantities and deterministic report |
| `packages/haul-evidence/parse.mjs`, `bytes.mjs` | Bounded JSON/UTF-8 and exact revision tokens; raw-byte Web Crypto SHA-256 |
| `packages/haul-evidence/haul-evidence.synthetic.v0.1.schema.json` | Isolated schema, separate `tools/check-haul-evidence-contract.py` gate |
| `apps/web/haul-evidence.html`, `haul-evidence.js`, `haul-evidence.css` | Local synthetic UI, generation safety, inspector, export |
| `apps/web/haul-evidence-demo/` | Two exact fixture copies; no published golden |
| `apps/api/server.mjs` | Six explicit `/lib/haul-evidence/*.mjs` GET mappings only, no new data API |
| `tests/haul-evidence-{core,adapter,ui,baseline}.test.mjs` | Semantic, byte, HTTP/DOM, and independent pinned-byte / historical CLI tests |
| `tests/helpers/haul-evidence-oracle.mjs`, `haul-evidence-dom.mjs` | Fixture-specific independent oracle and non-browser harness |

No imports of routing/MILP by haul-evidence; existing modules below retain their responsibilities. See [status](STATUS.md).


| Path | Responsibility |
|---|---|
| `packages/contracts/validate.mjs`, `request.mjs`, `constraints.mjs` | Domain checks, fingerprints, leg restrictions, request semantics |
| `packages/contracts/schemas/` | All versioned JSON schemas (including legacy) |
| `packages/optimization/optimize.mjs`, `select.mjs`, `allocate.mjs` | Catalogue search, unified MILP selection, allocation |
| `packages/optimization/configuration-bound.mjs` | Analytical lex lower bound; optional bounded enumeration cutoff in optimize.mjs |
| `packages/optimization/verify-result.mjs` | Independent checker (contracts only) |
| `packages/optimization/legacy.mjs` | Approximate compare, not exact |
| `packages/routing/engine.mjs`, `matrix.mjs` | Dijkstra, forward/reverse matrices, caching |
| `packages/routing/network-file.mjs` | Trusted operator file loader (not core) |
| `packages/catalog/site-catalog.mjs`, `site-geometry.mjs` | Evidence, catalogue, Polygon validation |
| `workers/milp-python/worker.py`, `exact-adapter.mjs` | Sparse MILP and cancellable subprocess protocol |
| `apps/api/server.mjs`, `network-registry.mjs`, `optimize-worker.mjs` | HTTP, graph registry, thread isolation |
| `apps/cli/cli.mjs` | CLI and exit codes |
| `apps/web/` | Exact map default, explicit legacy mode, advanced JSON UI |
| `apps/web/lib/exact-map.js`, `lib/core.js`, `app.js` | Snapshot-bound import, safe tuple aggregation/ID generation, shared truck validation and transactional UI |
| `packages/optimization/public.mjs`, `packages/catalog/index.mjs` | Stable Node exports |
| `src/`, `solver/` | Compatibility wrappers only (not alternate algorithms) |
| `data/snapshots/`, `data/fixtures/`, `data/evidence/` | Immutable graph, fictional demo, historical source records |

R01–R05: `tests/v4101-stabilization.test.mjs` exercises module, actual HTTP, tuple/ID/validation boundaries and the served map DOM/Leaflet harness. `apps/web/lib/contracts/validate.mjs` is a Node-side relative import bridge; the existing HTTP allowlist serves `packages/contracts/validate.mjs` at that URL (one canonical validation source).

Regression `tests/v46-architecture.test.mjs` checks dependency direction, checker isolation, compatibility identity, CLI/module parity and served assets. See `benchmarks/v46/` for test logs and byte parity.

Additional acceptance at `tests/v481-acceptance.test.mjs`: B07 HTTP disconnect / `apps/api/server.mjs` cancellation → `optimize-worker.mjs` → `workers/milp-python/exact-adapter.mjs` child exit; B21 missing executable solver fault in CLI/HTTP and recovery; B09 compact million-trip solve via v1 and resource rejection. No production code change. See `benchmarks/v481/acceptance.md`.

---
Historical implementation notes below preserve the paths used at those versions. Follow the canonical map above for v4.9.

# Code map v4.2
| Path | Responsibility | Main tests |
|---|---|---|
| src/routing.mjs | Dijkstra directed paths, closures, path rounding; legacy geometry | routing, exact B10 |
| src/optimizer.mjs | Original regret-greedy + local search, legacy contract only | optimizer/invariants/oracle/API |
| src/core/validate.mjs | Graph, truck, legacy validation / typed errors / limits | validation |
| src/core/request.mjs | v1 policy/domain validation, canonical SHA, screening/exclusions | search, v1-api |
| src/core/matrix.mjs | Common roundtrip matrix in mm, deadline checks | exact B03–B05/B10 |
| solver/worker.py | Sparse two-stage SciPy MILP fixed allocation | exact B03–B07 |
| src/solvers/exact-adapter.mjs | Python JSON-lines lifecycle, timeout, cancel, faults | exact B07, v1-api |
| src/core/allocate.mjs | Fixed config bridge, numeric budget, compact assignments | exact |
| src/core/verify-result.mjs | Independent allocation/configuration/serialized score checks | exact/search B20 |
| src/core/optimize.mjs | Catalogue enumeration, prune, baseline, reproducible rank, frontier | search B11–B18 |
| src/core/network-file.mjs | Trusted transport file loading/raw snapshot SHA | v1-api B19 |
| src/cli.mjs | JSON CLI and exit codes | v1-api B19 |
| src/server.mjs / optimize-worker.mjs | Local HTTP, old endpoints, worker thread & errors | API/v1-api B19–22 |
| schemas/ | Published request/response JSON Schemas; runtime domain validator in request.mjs | example schema checks |
| examples/ | Worked synthetic city input + actual output | v1-api |
| public/ | Unchanged legacy UI, map, JS | original tests + HTTP only in this session |
| docs/backend-review-2026-11-21 | Frozen source audit | baseline logs under benchmarks/ |

Flow: transport → request validation → enumerate policy → common matrix → child fixed solves → independent checker → sorted Top-K and provenance → JSON. No DOM in core. Main objective row is `solver/worker.py: stage('unservedM3',u_obj)` then `stage('transportDistanceMm',distance)`; constraints constructed immediately above. Stage status only matters together with complete catalogue coverage.

v4.3: request.mjs adds safeRequest, validateScreening, validReviewDate, inputFingerprint, exclusionRerun; tests/v43-safety.test.mjs. public/exact.html + exact.js provide separate v1 JSON interface. New audit retained in docs/backend-review-v42.

S4.1: src/core/site-catalog.mjs (evidence/lead validators, CSV parse/dry-run, SiteRecord adapter); tools/import-site-leads.mjs, tools/make-v43-examples.mjs; data/site-evidence/; schemas/site-{evidence,record}-v1.schema.json; tests/v43-catalog.test.mjs. See SITE_CATALOG.md.

S4.2: src/core/constraints.mjs validates horizon/provenance, trip caps, snow compatibility and access profiles; src/core/matrix.mjs computes pair costs and directional distances; solver/worker.py adds sparse trip limit row; verify-result.mjs independently checks trip limit and directed leg aggregates. tests/v43-constraints.test.mjs covers counterfactual, mass/width/direction and incompatible/unknown snow.

S4.3 partial: routing.mjs adds reverse/distance-only engine; matrix.mjs forward/reverse smaller-side matrix, bounded cache and metrics; tests/v43-matrix.test.mjs parity/invalidation; tools/benchmark-v43.mjs reproduces pinned 20×30 plus small and city cases. Strict catalogue adapter now binds supplied evidence to actual claimed values; tests/v43-catalog.test.mjs verifies tampering rejection. At v4.3, unified z MILP and registry were still open (now added below); cross-HTTP cache still open.

v4.4 S4.3a: `src/core/select.mjs` translates validated policy into binary-selection request, defines legacy-compatible tie order and checks selected configuration, cuts, aggregate allocation and tie proof. `solver/worker.py` solves both fixed and unified sparse models on same persistent child; GCD scaling for unified distance; `src/core/allocate.mjs` shared decoder validates proven objective arithmetic. `src/core/optimize.mjs` optionally searches rank-by-rank without enumeration, formats both modes through same checked Solution contract. `src/solvers/exact-adapter.mjs` reserves extra unified worker-response headroom before hard deadline. `tests/v44-selection.test.mjs` independent integer oracle, all 15 ranks, policy/physical parity, ties, exhaustion, timeout and tamper tests; `tools/benchmark-v44.mjs` consumes immutable v43 input and writes separate v44 comparison, never overwrites historical files.

v4.4 S4.3b: `src/network-registry.mjs` startup-only trusted registry; `src/server.mjs` resolves v1 request ID/version/hash before isolated worker, exposes metadata list; city legacy unchanged. `examples/v44/registry.json`, `schemas/network-registry-v1.schema.json` and `tests/v44-registry.test.mjs` second graph parity and negative cases. Mathematical core does not read registry files.

v4.4 A08a: `constraints.mjs` validates explicit per-trip internal length and evidence basis/value/snapshot/horizon/profile; `request.mjs` conditional model fingerprint; `site-catalog.mjs` strict scoped adapter, `matrix.mjs` combines two road legs + internal length with cache invalidation; `verify-result.mjs` recomputes term/leg sum/aggregate. `tests/v44-intrasite.test.mjs` verifies rank reversal, same-node, cache, tamper and strict adapter; independent synthetic example in `examples/v44/intrasite*.json`.

v4.5 A12a: `solver/worker.py` publishes completed-phase checkpoints; `src/solvers/exact-adapter.mjs` parses private frames, tracks only the current call and recovers the latest on hard timeout. `tests/v45-checkpoint.test.mjs` with `tests/helpers/checkpoint-worker.py` deterministically exercises protocol timeouts, cancellation, invalid frames and isolation. `tools/benchmark-v45.mjs` repeats immutable seed719 into a unique directory (exclusive creation), never overwrites older benchmarks.
v4.5 A08b: `src/core/site-geometry.mjs` validates bounded local Polygon (BigInt orientation, ring intersections and hole containment); `site-catalog.mjs` validates references and, for strict adaptation, exact scoped geometry claims. `schemas/site-record-v1.schema.json` structural contract. `tests/v45-geometry.test.mjs` covers geometry, malformed shapes, strict/exploratory scope and unchanged routing inputs.

v4.5 R0: `src/index.mjs` and `src/catalog.mjs` public facades, package.json exports `.` / `./catalog` / `./network-file`; `examples/v45/integration.mjs` standalone, `tests/v45-public-api.test.mjs` contract and existing-preserving preset. Future module migration ordered in ARCHITECTURE, stable transport contracts and independent checker must survive each move.

### v4.6 R1
Contracts/schema and optimization/checker physically moved to packages/contracts and packages/optimization; src imports delegate, schema bytes unchanged.

### v4.6 R2
Routing engine, matrix and trusted file loader moved to packages/routing; site evidence and geometry to packages/catalog. Legacy import identity preserved.

### v4.6 R3
Python MILP runtime and Node subprocess adapter moved to workers/milp-python; old solver/requirements.txt and worker launcher delegate to single canonical runtime. Protocol, pins and mathematical worker unchanged.

### v4.6 R4
API registry and HTTP thread in apps/api, CLI in apps/cli and byte-identical web assets in apps/web. npm start/optimize use canonical entrypoints; src/server.mjs and src/cli.mjs still launch. Existing path-based tests point to canonical UI/server source; assertions unchanged.

### v4.6 R4-data
Immutable snapshot moved to data/snapshots/pkgo-27233df581c6; synthetic demo in data/fixtures, historical evidence in data/evidence, legacy schema in packages/contracts/schemas. All data bytes unchanged, default consumers and benchmark paths updated.

### v4.6 R4 acceptance
New public exports resolve directly to canonical packages; four architecture regression tests passed. 24 UI/schema/data/worker files match base v4.5 byte-for-byte. All six schema definitions and selected actual city response/catalog/registry/request validated. Python Playwright/Chromium started, but local navigation was blocked by environment policy; browser smoke source and log retained, actual E2E remains OPEN.

### v4.7 A12b
`configuration-bound.mjs` computes U/L lower bounds; `optimize.mjs` sorts by lower bound and counts proved dominated suffix, only complete catalogue can be exact. `allocate.mjs` supplies private sourceTripCuts flag to canonical Python worker for full-service integer-cover cuts and exact GCD scaling. Request/response schema add strategy/pruned counter; `tests/v47-bounds.test.mjs` and `tools/benchmark-v47.mjs` prove/test and record timing. Architecture boundaries unchanged.

### v4.7 R4 contract gate
`tools/check-contracts.py` validates all canonical schema definitions and example requests, current catalogue, registry, synthetic record and freshly emitted CLI responses with offline Draft202012Validator. Dev-only dependencies in tools/contract-requirements.txt. `.github/workflows/check.yml` runs test:contracts and browser smoke on Linux/Windows, manual dispatch enabled. Actual remote CI not yet executed.

### v4.8 R4 transport/release verification
`apps/api/server.mjs` validates and reads regular static files before headers, resolves the public-root boundary and protects the error path from duplicate headers. `tests/v48-http.test.mjs` covers the directory-crash reproduction, health afterward and normal assets. `.gitattributes` preserves release bytes across checkout configurations.
`tools/acceptance.py` runs scoped core/browser/all gates using explicit commands, saves JSON status/OS/runtime and separate raw logs in a new directory; `.github/workflows/check.yml` runs the same runner and uploads artifacts even on failures. No deployment or auto-download.
`examples/v48/external-sdk.mjs` and its README demonstrate installing the local package in a separate consumer; actual result in `docs/benchmarks/v48/external-sdk-result.json`.

v4.9: `apps/web/lib/exact-map.js` maps editor state → safe v1 request and checked aggregate solution → routes and display. `apps/web/app.js` wires UI actions and HTTP, history, exports. `apps/api/server.mjs` serves only `/lib/routing/engine.mjs` and `/lib/contracts/validate.mjs` from canonical packages. `tests/v49-map*.test.mjs` test adapter, real HTTP and DOM event wiring; `tools/browser-smoke.py` updated for actual browser gate (not run here).

v4.10: `apps/web/index.html` and `style.css` provide the map workspace; `app.js` adds confirmed demo load and focus preservation; `exact.html` / `exact.js` share styles and export the received response. `tests/v410-ui.test.mjs` checks structure and real HTTP/JSON wiring.
