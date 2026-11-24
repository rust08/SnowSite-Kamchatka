# Приёмка v4.2 / фактический прогон
Environment: Linux, Node 22.16.0, Python 3.13.5 / NumPy 2.3.5 / SciPy 1.17.0. Tests `npm test` 54/54; `npm run check` PASS (pinned graph 9983 nodes, 12354 edges); JSON Schema example request/response validated with jsonschema 4.26.0. No downloaded graph or real site data. Original 39 tests kept unchanged. Logs under this directory; exact parameters in examples/ and audit.

| ID | Result | Evidence / limitation |
|---|---|---|
| B01 | PASS | npm run check exact pinned hash |
| B02 | PASS | 39 original tests preserved + 15 new |
| B03 | PASS | exact.test: C 132, D 144, all 12 served |
| B04 | PASS | exact.test: 16 / 16 / 16, 11 served |
| B05 | PASS | exact.test: four city reference distances; all 228 served |
| B06 | PASS | 60 random integer cases independent DFS seed 719; includes zero/nullable costs/capacity; B10 graph cases separately |
| B07 | PASS with limitation | 1ms hard child timeout and incomplete core/HTTP status; unknown bounds represented null, no exact status; disconnect code present but not separately stress-tested |
| B08 | PASS | legacy and v1 invalid enum/closure/speed/density/ID/version |
| B09 | PASS with limitation | safe rejection/resource budgets and response size assertion on demo; no stress RSS measurement, Python RSS not OS-capped |
| B10 | PASS | exact matrix no return, closed, unroutable |
| B11 | PASS | six 2+2 independent exhaustive configurations |
| B12 | PASS | unique K=3; K>catalogue size |
| B13 | PASS | site exclusion, recorded parent and unchanged baseline; exact score non-improvement check for subset |
| B14 | PASS | exact set exclusion only, other pair remains |
| B15 | PASS | replacement group, fixed conflict, zero pure new |
| B16 | PASS | greenfield 2, null baseline |
| B17 | PASS | 0/1/2 cardinalities, no cross-volume delta |
| B18 | PASS | known prohibited, exploratory/strict, fixed conflict, no legal approval |
| B19 | PASS | v1 module/CLI/HTTP mathematical parity and hash, old endpoint |
| B20 | PASS | checks conservation, integer ceil, reachability, aggregate distance/time/cost, config; injected tampering rejected |
| B21 | PASS (main cases) | 400/413/415/422/409 tested; internal errors generic, missing-solver failure path exists, not fault-injection tested |
| B22 | PARTIAL | HTML, demo JSON, legacy compare verified HTTP; original browser UI files unchanged. Playwright absent, browser import/console/E2E not verified |
| B23 | PASS | changelog/status/handoff/API/code map/algorithm, logs and regenerated manifest (release sha check separate) |

S4 P1 benchmark 20×30 and cross-request cache, shortlist import, multi-network HTTP registry not implemented; second small graph is exercised in S2, CLI supports operator-selected graph. S5 external data unavailable. No claim of field optimization or full production readiness.
