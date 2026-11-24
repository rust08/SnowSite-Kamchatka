# CHANGELOG

## H01 Alpha — standalone technical acceptance candidate (no version change)
- A1 accepted: isolated synthetic reconciliation core, explicit as-of, exact BigInt, hand oracle and isolated schema. A2 accepted: bounded raw-byte adapter, strict UTF-8/JSON, exact revision tokens, original SHA-256 and deterministic golden export; A2-B01 resolved with scoped architecture test.
- A3 accepted within HTTP/DOM scope: separate local page, one nav link, six static GET mappings, safe state/inspection/export. No uploads, storage or new business API.
- A4 scope: independent byte pins and historical CLI Top-5 regression gate, current status/handoff/code map/plan/acceptance documentation, exact standalone manifest. Actual final results in external A4 Full Review Pack. No runtime change at A4, no version bump or PR. Browser UNVERIFIED, Windows/CI paused, R06/R07 open. Independent A4 review pending; synthetic only. See [status](docs/STATUS.md).


## v4.1.1 — исторический вход / аудит 2026-11-21
- 39/39, graph check PASS. CRIT-01/02/03 и F-01–04 подтверждены/описаны в `docs/backend-review-2026-11-21/01_AUDIT.md`. Не изменять старые показатели.

## v4.2 — S0
- Локально воспроизведены km/rank_reversal, demo 167.098 км baseline, F-01–03; F-04 проверен безопасным отказом по лимиту без нагрузочного запуска.
- Общая валидация `src/core/validate.mjs`, typed DomainError, ограничение legacy на 500 рейсов (консервативная верхняя оценка) и 2 млн pair-work; прежний UI/solver сохранены.
- `npm test` 41/41; `npm run check` PASS; исходный ZIP и SHA графа совпали. ZIP без Git; создан локальный import commit и ветка work/v4.2.

## v4.2 — S1
- Добавлены sparse MILP worker SciPy 1.17.0 / NumPy 2.3.5, асинхронный JSON-lines adapter, deadline/kill, агрегированные назначения, независимый checker и матрица в мм.
- B03–B05: km 16/16/16; rank_reversal C=132, D=144; демо 159.425990 / 108.556350 / 122.648320 / 92.228770 км, 228 м³ в каждой конфигурации.
- Oracle 60 произвольных целочисленных задач, seed 719; forced timeout и tampered allocation проверены. 45/45, граф PASS. Legacy остаётся эвристикой с историческими expected.

## v4.2 — S2
- `optimize(network,request)` и v1 domain validator: finite catalogue, 2+2, Top-K по (U,L,ID), fixed/optional/excluded, replacement, greenfield/evaluate/frontier, exclusions с parent hash и причинами. Strict требует supplied evidence; правового одобрения нет.
- Лимиты 1000 конфигураций/100000 узлов перебора, 50 demands/30 sites, таймаут не выдаёт exact ranking. Baseline исторический, delta только при одинаковом объёме и optimal обоих.
- B11–B18, B08/B09 и timeout: 51/51, граф PASS. Проверен независимый перебор всех 6 сочетаний 2+2. S3 — transport/CLI/schema/документация.

## v4.2 — S3
- Новый POST `/api/v1/optimize` через Node worker thread + local Python child, localhost-only; typed 400/409/413/415/422/503/500. CLI same core и JSON schemas. Legacy endpoint и frontend сохранены. Bounded legacy local search.
- Independent checker выбираемых конфигураций и aggregate result, response limits, матричный deadline; keep only topK, no unbounded result list. Snapshot hash из bytes; JSON scenario hash canonical. Windows/Linux CI с pinned Python dependencies настроен (не запущен удалённо).
- 54/54 Node tests, graph PASS, example request/response schema PASS; module/CLI/HTTP same math, legacy HTTP smoke PASS. E2E Browser / Windows actual unverified. S4/S5 отложены по stop rule. См. acceptance-v42.md.

## v4.3 / S3.1 — 2026-11-21
- Verified input ZIP SHA and restored original work/v4.2 history from bundle (base dd769fb). 54/54 baseline, pinned graph unchanged; audit repro confirmed.
- Added explicit `policy.preset=preserve_existing` (safeRequest), strict decision/date validation, exclusion fingerprint and caller-side parent verification; unchanged valid legacy v1 role semantics.
- Marked legacy approximate, added separate exact JSON upload page; HTTP endpoint unchanged. Browser E2E not run.
- 57/57 tests and network check PASS. Remaining: catalogue, operational constraints, scale, actual browser/Windows.

## v4.3 / S4.1 — 2026-11-21
- Added versioned historical evidence catalogue, 11 leads/9 source records, JSON/CSV dry-run, validation reports and SiteRecord adapter (no automatic promotion). Unknown remains null; strict adapter only checks supplied scoped evidence. Synthetic scenarios with six candidates and independent 15-config oracle.
- 61/61 tests PASS. Remaining: P1 constraints, scale; positive intra-site distance and polygon not supported, actual site records WAIT_DATA. Browser/Windows pending.

## v4.3 / S4.2 — 2026-11-21
- Added horizon-scoped trip cap (with independent checker), supplied loaded/empty gross/width/blocked edge profiles, documented snow-type pair compatibility, matrix hash and directional leg distances. Unknown facts warn; no fabricated timing or legal conclusions.
- 65/65 tests PASS (including all original 54, four exact city values, 60 oracle cases). Physical constraint fixture: Q10, 30 m³: near cap 1 trip -> 14 km vs 6 without; baseline deficit 20 m³. S4.3 remains next. No field data or browser/Windows pass claimed.

## v4.3 / S4.3 partial + contract hardening — 2026-11-21
- Distance-only forward/reverse Dijkstra from smaller unique-node side, bounded in-process cache, cache metrics, parity tests. Strict adapter now checks exact evidence claims (capacity/access/allow/active), negative HTTP/CLI validation tests. Schema checks for catalog and request/response examples.
- 69/69 tests PASS (54 original), pinned network PASS, CLI demo + independent small graph PASS. Benchmark 20×30, seed 719, 5 seconds: 17 evaluated / 16 proven of 378, provisional; unified MILP not implemented. City matrix parity 155.7 ms old vs 92.6 ms new in recorded run; repeated in-process matrix cache hit. HTTP worker cache not shared. Browser/Windows not tested.
- Next: integrated binary z model plus exact rank/tie/no-good proof, compare to bounded enumeration. Operational data still WAIT_DATA. See acceptance.md and HANDOFF.md.

## v4.4 / S4.3a unified selection — 2026-11-21
- Continued from d86dfc0 on `work/v4.4`; baseline 69/69 and pinned graph PASS. Introduced opt-in `policy.searchStrategy=unified_milp` (default enumeration unchanged), binary z MILP, exact-set no-good cuts, three lex stages and tie fallback for escaped IDs. Checked every incumbent independently; no rank proof on partial solve. Preserved physical, screening, safe preset, baseline and frontier semantics.
- 76/76 tests + schemas and graph PASS; all 15 ranks + exhaustion independently verified, 24 random integer catalogues, physical parity and tamper/timeout cases. v43 benchmark input preserved: large 5s enum 119 km, unified 74.2 km incumbent, U=0, distance bound 70.2 km, ranking provisional; no full Top-K certification. Earlier proof/tie timeout and rejected LP variants retained under docs/benchmarks/v44. Small and city exact parity.
- Next atomic task: trusted multi-network HTTP registry, without request file paths or UI changes; then remaining A08 and large-catalogue proof work.

## v4.4 / S4.3b registry — 2026-11-21
- Trusted operator startup registry `SNOW_NETWORK_REGISTRY` / `startServer(port,{registryFile})`, default city plus up to seven extra versioned snapshots; validates raw hash, graph, duplicates and bounded config/file sizes. Exact endpoint selects by ID/version/hash only; GET `/api/v1/networks` exposes metadata (not paths). Legacy city data, health and compare unchanged. No remote file/URL in request, no network fetch. Fixed worker construction failure resetting busy flag.
- 79/79 tests and pinned graph PASS. Second graph unified module/CLI/HTTP score/hash parity, invalid version/hash/ID/path, startup duplicate/tamper/invalid snapshot, multiple versions of same ID; old city HTTP regression. Browser/Windows not tested. See `docs/benchmarks/v44/registry-final-tests.txt`.

## v4.4 / A08a intra-site cost — 2026-11-21
- Added explicit per-trip internal roundtrip distance (integer mm), evidence bound to value, basis, horizon, graph and truck/access profile. Both solvers share combined cost; separate road legs preserved, same-node semantics unchanged. Model fingerprint v1.2-intrasite only for extended inputs; old fingerprints/graph/matrix parity retained. Strict scoped adapter accepts positive distance only with explicit roundtrip basis, refuses ambiguous values. Null is unknown, omitted with warning, not verified zero.
- 84/84 tests, graph PASS, CLI synthetic exact ranking 12/15 km (near previously 6 vs far 12). Cache invalidation, route closure, same-node, evidence tampering, independent distance/aggregate checks. Schemas validated. A08 remains partial: polygons and actual site/source geometry open; browser/Windows unverified, actual data WAIT_DATA. Stop after verified three atoms; see current HANDOFF.

## [v4.5] — 2026-11-21
### A12a — checkpointed solver protocol
- Preserve the latest completed MILP phase allocation across the Node hard deadline using private JSON-lines checkpoint frames. Checkpoints are never final or optimal; independent allocation/configuration checks still apply. Explicit cancellation discards checkpoints, errors remain errors.
- Baseline 84/84, 4 focused protocol tests PASS. A short initial fixture deadline failed under concurrent load; increased test budget without changing production deadlines, retained log. Repeat benchmark uses immutable v43 seed719 at 5s cold/warm and 15s; A12 full large Top-K proof remains open.

### A08b — local polygon metadata
- Optional GeoJSON Polygon on SiteRecord, exact bounded planar topology at 1e-7 degree grid, 512 total positions, 16 rings, rejects self-intersections, overlap/touch, nested/outside holes, duplicate vertices, invalid coordinates and unsupported antimeridian/poles. No auto-snap, area, capacity or route claims; scoped source binds exact polygon in strict adapter, exploratory still requires explicit access/capacity.
- 4/4 focused tests PASS; existing evidence catalog unchanged. Connector geometry and physical survey remain open.

### R0 — independent repository preparation
- Private Node package v0.3.0 with explicit exports and standalone integration example (v1 JSON contract unchanged); prior internal imports and UI/API/CLI kept. Independent synthetic module exact best 56 km.
- Consolidated README and quick-start, retained historical legacy guide, fixed GitHub instructions to clone history not reinitialize. Added CONTRIBUTING and target ARCHITECTURE with current dependencies and incremental migration/acceptance gates; no remote publication.
- Final 93/93 tests, pinned graph PASS, all schemas and 13 actual responses validated locally. Paired 5s/15s benchmark retained; large unified full Top-K proof still OPEN. Windows/Playwright unverified, S5 WAIT_DATA.

## v4.6 — R1
- Contracts/schema and optimization/checker physically moved to packages/contracts and packages/optimization; src imports delegate, schema bytes unchanged.
- Linux: `npm run check` PASS, `npm test` 93/93; прежняя математика и публичные импорты сохранены.

## v4.6 — R2
- Routing engine, matrix and trusted file loader moved to packages/routing; site evidence and geometry to packages/catalog. Legacy import identity preserved.
- Linux: `npm run check` PASS, `npm test` 93/93; прежняя математика и публичные импорты сохранены.

## v4.6 — R3
- Python MILP runtime and Node subprocess adapter moved to workers/milp-python; old solver/requirements.txt and worker launcher delegate to single canonical runtime. Protocol, pins and mathematical worker unchanged.
- Linux: `npm run check` PASS, `npm test` 93/93; прежняя математика и публичные импорты сохранены.

## v4.6 — R4
- API registry and HTTP thread in apps/api, CLI in apps/cli and byte-identical web assets in apps/web. npm start/optimize use canonical entrypoints; src/server.mjs and src/cli.mjs still launch. Existing path-based tests point to canonical UI/server source; assertions unchanged.
- Linux: `npm run check` PASS, `npm test` 93/93; прежняя математика и публичные импорты сохранены.

## v4.6 — R4-data
- Immutable snapshot moved to data/snapshots/pkgo-27233df581c6; synthetic demo in data/fixtures, historical evidence in data/evidence, legacy schema in packages/contracts/schemas. All data bytes unchanged, default consumers and benchmark paths updated.
- Linux: `npm run check` PASS, `npm test` 93/93; прежняя математика и публичные импорты сохранены.

## v4.6 — R4 acceptance
- New public exports resolve directly to canonical packages; four architecture regression tests passed. 24 UI/schema/data/worker files match base v4.5 byte-for-byte. All six schema definitions and selected actual city response/catalog/registry/request validated. Python Playwright/Chromium started, but local navigation was blocked by environment policy; browser smoke source and log retained, actual E2E remains OPEN.
- Linux: `npm run check` PASS, `npm test` 97/97; прежняя математика и публичные импорты сохранены.

## v4.6 — Release
- Canonical R1–R4 layout complete; archive with compatibility wrappers, source provenance, acceptance logs, current README, docs and Git history. `node tools/generate-manifest.mjs` after staging; `npm run check:manifest` verifies release bytes. A12b, browser/Windows and real-data gates remain open; no change to mathematical objective, versioned API or UI payloads.

## v4.7 / A12b — 2026-11-21
- Added opt-in `bounded_enumeration`, lexicographic lower bound and certified suffix pruning, full-service integer trip cuts and exact GCD scaling. Native integer distance normalization fixes tiny solver roundoff before mm conversion without weakening independent checker. API v1 additive enum and `prunedByBound`; old default/strategies unchanged.
- Frozen seed719 20×30: three final exact Top-5 runs 1.785–2.065 s (16 optimal solves + 362 proved dominated); all 378 sets solved separately in 29.575 s, same ranks. 72 independent oracle cases and policy/constraints/tie/cap/timeout/parity/city regressions; preserve all failures and raw results in benchmarks/v47. No universal timing guarantee, no change to model/data/UI. R4 actual browser/Windows and S5 remain open/WAIT_DATA.
- Final math regression: 103/103 PASS; city graph and all 97 earlier tests preserved.

## v4.7 / R4 verification automation — 2026-11-21
- Added offline dev-only `npm run test:contracts`; six schemas and 26 instance checks PASS (four fresh CLI responses across two graphs/three strategies). No new runtime dependency.
- CI manual dispatch, independent Linux/Windows unit/contract and browser matrices with bounded jobs. CI and actual Windows/browser remain unverified; previous environment block logged, no bypass. Updated README/README_FIRST and repository setup instructions; retained history.

## v4.7 / release — 2026-11-21
- A12b commit a921f19; R4 verification automation b79cb8c. Source archive and Git bundle prepared from clean release tree; manifest generated against tracked bytes. All previous audits/results retained. Latest actual gates recorded in benchmarks/v47 (103/103 unit/integration and six schemas/26 checks), post-extraction verification in release report. No publication or real-world certification.


## v4.7.1 / Deferred site evidence plan — 2026-11-21
- Owner expects no supplied actual site catalogue/geometry for now. Recorded A08-DATA / S5-SITES as WAIT_DATA / DEFERRED_RESEARCH, with future independent public-source search, field checklist, geometry/access workflow, GIS-01…07 proposed backlog and acceptance gates in `docs/DEFERRED_SITE_DATA_PLAN.md`.
- Linked from README, AGENTS, STATUS, HANDOFF, SITE_CATALOG, ARCHITECTURE and data index; no research performed, no evidence added, no runtime/data/model/API changes. Historical benchmarks preserved.

- Local verification: 103/103 regression tests, pinned graph PASS, plan links PASS.

## v4.8 — R4 local HTTP reliability
- Reproduced a process crash on GET `/vendor/`: directory read after response headers, then ERR_HTTP_HEADERS_SENT. Read and validate public regular files before headers, reject directory/missing/outside paths (including resolved symlinks), and never attempt a second response after headers. Regression covers API survival and normal public assets. No solver/schema/UI change.
- Pin checkout byte preservation in `.gitattributes` (explicit LF for JSON/Markdown, no conversion for remaining tracked files), including historical CRLF CSV and START.bat. Verify release with simulated `core.autocrlf=true` checkout; not actual Windows acceptance.

## v4.8 — R4 acceptance evidence
- `tools/acceptance.py` runs core (manifest, graph, tests, contracts), browser or all, with separate logs, version metadata, explicit not_run and failure exit codes, no overwriting prior reports. CI uses same runner and uploads scoped logs on all outcomes. No access to public infrastructure required.
- External SDK smoke: packed/installed locally offline in an independent consumer; public imports and actual worker ran, result score/hash matched in-tree integration. Reproduction in examples/v48. No publish or version/schema changes.
- Final local core gate PASS 104/104 tests, graph, six schemas/26 instances; separate external SDK score/fingerprint parity. Browser FAIL due to administrator navigation block, Windows/remote CI NOT RUN. No data or production changes; remaining R4 platform gates need authorized environment, R5 WAIT_REQUIREMENTS, S5 WAIT_DATA. Release v4.8.

## v4.8.1 — residual local acceptance / freeze existing scope
- Restored v4.8 `dd1b56a`; 328/328 baseline manifest, pinned graph and 104/104 tests verified. Added targeted tests for existing B07 (HTTP disconnect, stalled child actually exits, busy slot released), B21 (missing interpreter typed HTTP/CLI failure and exact recovery), B09 (one million trips in one aggregate row, 2988-byte response, demand above cap rejected).
- Measured compact test max RSS 123776 KiB, 1.45s; not whole tree peak or OS hard cap. Three focused tests and full 107/107 regression PASS, six schemas / 26 checks PASS. No runtime, mathematical, schema, graph or data change. `docs/benchmarks/v481/acceptance.md` and raw logs.
- Owner pauses Windows/GitHub Actions, no research or new backlog. Live implementation/acceptance plans updated to reflect finished work; historical checklists explicitly marked. Real browser blocked, S5/A08-DATA deferred, R5 awaits requirements. README/STATUS/HANDOFF/technical docs updated. No publication.

## v4.9 — exact map integration
- Main map defaults to exact v1 bounded enumeration. Safe 0/1/2+ selections, Top-K, replacements/greenfield, exclusions with reason and lineage, export editor/API/session JSON. Explicit approximate mode; no fallback on solver errors. Advanced v1 remains separate. Canonical route geometry checked against aggregate costs.
- Five added tests (adapter, real HTTP, DOM/Leaflet event harness); 112/112 Node tests and 6 schemas / 30 instance checks. Demo on six synthetic candidates; original graph/core/JSON API unchanged. Actual browser E2E outstanding (environment policy), Windows/CI paused.
- README/status/handoff/technical docs and plan updated; next PR scoped to shared/snowsite only.

## v4.10 — map workspace UX
- Owner requested presentation and ergonomics polish after exact map integration. Calculation/cancellation before results, sticky map at desktop widths, compact visible legend and vertical alternative list with comparable metrics; mobile stacking, keyboard focus preservation, explicit solver status. No frontend framework or new dependencies.
- Confirmed shortcut opens the existing synthetic 2+2-of-6 fixture and runs exact Top-5; advanced exact JSON page uses same stylesheet and downloads received response, clears stale download on input/error. No change to mathematical core, data, JSON contracts or implicit legacy fallback.
- 114/114 Node tests and six schemas/30 instance checks; expanded actual HTTP+DOM harness, static structure checks. Browser smoke updated, **not visually executed**, known environment block; Windows/CI paused. README/status/architecture/handoff updated; cumulative PR replaces v4.9-only patch.

## v4.10.1 — R01–R05 stabilization
- R01: reject unsupported meaningful advanced legacy constraints in `validateLegacy`, typed 422 and field path; normal demo and exact v1 unchanged. R02: compare root/meta network version/hash before atomic map import; missing binding visible, verified supplied fields retained. R03: tuple key for legacy trip rows. R04: bounded unique ID fallback at MAX_SAFE_INTEGER. R05: shared truck limits/capacity, aligned form/HTML/import and ID validation.
- Seven regression tests fail on v4.10 before fixes and pass on v4.10.1; original diagnostic script rerun. Actual gates and extended 2+2 fixture in `docs/benchmarks/v4101/acceptance.md` and `REVIEW_FIX_REPORT.md`. No mathematical model, graph, SDK, JSON schema, dependencies, new features or remote operations. Browser remains blocked, Windows/CI/publish paused, S5/A08-DATA deferred, R5 awaits requirements.
