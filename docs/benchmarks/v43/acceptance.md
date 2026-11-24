# v4.3 — acceptance, 2026-11-21
Base SHA dd769fbb79032e700d9997f23cf36ea09a63a1e4; source ZIP cbea40937cd4dc064e8eb4f3b0958306dd6a53c744c84842a18a4f3a2845a61c. Original history restored from verified local bundle; clean before modifications. Frozen audit: `docs/backend-review-v42/`. Node 22.16.0 / Python 3.13.5 / SciPy 1.17.0 / NumPy 2.3.5, Linux. No external data fetch in implementation; pinned city SHA 0e0a464f7d92057fa5bbad634c083ad0c1923294597d989ead386b393acf7ad2.

| ID | State | Evidence/limitation |
|---|---|---|
| A00 | PASS | 54 baseline, 69 final, all previous tests; pinned graph unchanged |
| A01 | PASS | 2+2/6 -> 15 configurations; independent enumerated volume oracle, Top-3 |
| A02 | PASS | safe relocation explicit cardinalities, group and fixed site checked |
| A03 | PASS | previous B13/14 and new safe fixed-exclude conflict |
| A04 | PASS with caller boundary | fingerprint and exclusionRerun parent consistency, stateless HTTP reports unverified lineage |
| A05 | PASS | complete finite search/fewer reasons/tie by sorted IDs, partial status tested |
| A06 | PASS for supplied evidence | invalid enum/date in HTTP/CLI/JS; strict adapter checks scoped claims, not legal authority |
| A07 | PASS | 10+1 leads, 11 unknown/ineligible, 10 unlocated; 2019 removed, POI not access; CSV/JSON parity |
| A08 | PARTIAL | sameNode and access proof; strict positive intra-site distance intentionally rejected, point only; no polygon support |
| A09 | PASS | near 100 m³ but 1 trip, 30 m³ Q10 -> 14 km; without cap 6 km; checker rejects >1; null warning |
| A10 | PASS within supplied model | mass, width, separate loaded/empty, closures and no-return; city parity and cache invalidation; actual road records not validated |
| A11 | PASS | all four historic exact distances unchanged: 159.425990, 108.556350, 122.648320, 92.228770 km / 228 m³ |
| A12 | PASS benchmark / OPEN integrated search | 20×30 seed719, 378 combos, 5s, evaluated17/proven16, provisional; memory estimate Node RSS only, not child peak |
| A13 | PASS basic integration / PARTIAL registry | city HTTP/CLI/JS parity; second graph CLI and module; schema validation logged. HTTP one trusted pinned snapshot, no multi-network registry |
| A14 | PARTIAL | legacy visibly approximate, exact separate page HTTP 200, JS handles errors/no fallback. No Playwright install/browser click test, Windows not run |
| A15 | PASS | versioned historical catalog and five synthetic scenario types, source limited scope; no real sites asserted |
| A16 | PASS | STATUS/HANDOFF/ALGORITHM/API/CODE_MAP/CHANGELOG/AGENTS updated each stage; manifest checked at packaging |

### Benchmark (factual run; not performance guarantee)
`node tools/benchmark-v43.mjs` with pinned seed, Linux, AMD EPYC 9V74, 5 logical CPUs, ~6.24 GB RAM. `benchmark-report.json` stores hashes, wall time, matrix timings, Node RSS before/after, status, response bytes. City original path matrix 155.718 ms, new distance-only 92.583 ms; city first solve ~1.031s, repeat ~0.823s, cache matrix ~0.110ms. Small exact 15/15, ~0.795s. Large 20×30 first 4.979s, 17/378 evaluated, 16 proven, topK5 provisional, best encountered 119 km and zero unserved (not global); 35,018-byte response. RSS 125.1→127.0 MB, child memory unmeasured. Repeat ~4.979s and same coverage, cache hit. Evidence does not establish real-city optimality or production-scale guarantee. Further binary z MILP OPEN.

### Reproduce
`npm run check; npm test; node src/cli.mjs examples/demo-v1.json; node src/cli.mjs --network examples/v43/network.json --network-id synthetic-v43 examples/v43/add-2-plus-2.json`. Import commands in SITE_CATALOG.md. `schema-check.txt` is actual jsonschema validation. Prior logs preserved. Browser/Windows and operational inputs WAIT_DATA/Open. No actual economic savings claimed.
