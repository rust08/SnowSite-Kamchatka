# v4.5 acceptance — 2026-11-21
Base `6700571` v4.4 ZIP exactly matches restored bundle (except .git). New local branch work/v4.5, previous history preserved. Linux Node v22.16.0, SciPy 1.17.0, Python 3.13; baseline `npm run check && npm test` 84/84 PASS. No browser/Windows execution or remote CI. No real operational source added.

## A12a — timeout durability and repeated profiling
`tests/v45-checkpoint.test.mjs`: 4/4 focused checks, hard kill with last completed phase, validation after recovery and forged allocation rejection, subsequent request isolation, error instead of proof, explicit cancellation. Initial 750ms fixture deadline failed under concurrent prior benchmark; recorded and increased fixture-only budget to 3000ms, no increase in production deadline. The SciPy worker sends completed-stage checkpoints; there is no mid-stage incumbent callback. This improves durability, not guaranteed performance. No objective or solver/default-strategy change.

`node tools/benchmark-v45.mjs before` ran using extracted untouched v4.4 copy; `after` ran modified v4.5. Both use the frozen v43 seed719 20×30 graph and request, same matrix SHA `c559c139de390d08935a91ace555f9ef08288018673e8587f88cbf8f5d073fda`. Cold/warm 5s and longer 15s, all full responses and machine info saved, same objective and catalogue; 378 candidate sets before restrictions as in pinned fixture. Only matrix cache is warm, not persistent worker across optimize calls. Runs share machine with light development/test activity; not a controlled statistical performance comparison. Scores in km below (all served same demand). Enumeration proof counts configurations, unified proof counts ranks; not interchangeable.

| Strategy / scope | v4.4 5s cold/warm, best km / proved | v4.5 5s cold/warm | v4.4 15s | v4.5 15s |
|---|---|---|---|---|
| enum (config) | 119 / 16, 119 /16 | 119 /15, 119 /14 | 119 /46 | 109 /49 |
| unified (rank) | 74.2 /0, 74.2 /0 | 74.2 /0, 74.2 /0 | 74.2 /1 | 74.2 /1 |

Every aggregate ranking remains provisional. At 15s both unified runs gave two ranked incumbents 74.2/79.6 km, one completed rank. At 5s after-run last-stage distance bounds 70.4/71.8 km, before 67.4/67.4 km; not a demonstrated reproducible improvement in proof speed. 12 benchmark result schemas validated. No change to default enumeration. Next A12b: investigate solver lower bound strengthening and rank proof, or alternative solver only after pinned comparative spike; do not claim full Top-K or increase search budget silently. Preserve previous failed experiments.

## A08b — boundary metadata
`tests/v45-geometry.test.mjs`: 4/4 targeted tests, valid rings/holes/winding, invalid topology/coordinates/resource abuse, strict source binding and exploratory separation. Geometry syntax schema + exact bounded integer-grid runtime validation. No actual land polygons, capacity or geometry-derived road access; no connector routing. A08 remains partial for connector geometry/measurement.

## R0 — architecture/facade
Added private package exports (existing file imports retained), standalone integration example `node examples/v45/integration.mjs`: exact_top_k, 3 alternatives, both existing fixed, best 56 km, response schema PASS. Proposed structure and migration gates in ARCHITECTURE. Current tree retained; no remote repo creation, no big-bang path migration. README consolidated, old demo guide retained and GitHub instructions corrected to preserve history. All schema definitions validated locally. Actual full suite captured separately in final-tests.txt.

Final integration and regression: `npm run check && npm test` 93/93 PASS (final-tests.txt), all 84 original tests retained. All schema definitions and 12 benchmark responses + one integration response validated via Python jsonschema Draft202012Validator/check_schema. Exact public module result and data check recorded. No Windows/Playwright run. A12 full 5s rank proof, A08 connectors and R1+ migrations remain open; S5 WAIT_DATA.
