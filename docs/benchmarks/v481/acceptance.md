# v4.8.1 — остаточные критерии исходной приёмки, 21.11.2026

Base dd1b56a from v4.8 history bundle, branch work/v4.8.1. Baseline manifest 328/328; graph check PASS; Linux Node 22.16.0, Python 3.13.5, SciPy 1.17.0. Original 104/104 tests PASS (baseline-tests.txt). No existing tests weakened or removed. No runtime source, dependency, schema, graph or data change. Owner requested no new backlog or research and paused Windows/GitHub Actions.

| Existing gate | Actual local verification | Scope |
|---|---|---|
| B07 | Deliberately stalled subprocess accepts request, second request 503, health 200, abort HTTP client, poll subprocess PID until exits, next real exact solve succeeds. | POSIX child fixture; no claim of every possible cancellation race or Windows result. Earlier deadline/checkpoint tests retained. |
| B21 | Missing executable gives HTTP 500 typed `internal_error`, CLI exit 1 and typed JSON, no allocation/fake score, health/legacy still operational and later real solver request succeeds. | Injected missing interpreter; prior negative-input, corrupted checkpoint, timeout tests retained. |
| B09 | Existing small registered graph, 1m³ truck, one source 1,000,000 m³, one candidate capacity 1,000,000 m³, 2 km roundtrip: exact_top_k, all served, 1,000,000 trips, 2e12 mm, exactly one aggregate row; 2,988-byte body. Additional 1 m³ rejected with 422 `resource_limit`. | Synthetic, not field workload; limits already present, no change. |
| B09 resource measurement | GNU time -v reports maximum RSS 123776 KiB (~120.9 MiB) and wall 1.45 s for isolated B09 test process invocation. | Not simultaneous aggregate process-tree RSS, not a stress test of every accepted request. Existing 256 MiB Node worker V8 old-generation cap is not full RSS; no OS-enforced native Python cap. B09 scoped, deployment limit policy depends on R5 requirements. |

## Commands and results

- `node --test tests/v481-acceptance.test.mjs` 3/3, see focused-tests.txt.
- `/usr/bin/time -v -o docs/benchmarks/v481/compact-memory.txt node --test --test-name-pattern='B09 million' tests/v481-acceptance.test.mjs` 1/1, see compact-test.txt.
- `npm test` 107/107, zero skipped/failed (final-tests.txt, 40.30 s). `npm run test:contracts` 6 schema definitions / 26 checks (contracts.txt). `npm run check` pinned graph SHA unchanged (graph.txt).
- Source diff is tests/documentation/manifest only; existing findings and benchmark reference remain intact. No re-run of separately accepted seed719 proof without change. No browser, Windows, GitHub Actions, real data collection or R5 implementation.

## Current disposition

B07 and B21 PASS_LOCAL within specified fault scenarios. B09 PASS_SCOPED, no blanket hard memory limit claim. B22/A14 BLOCKED_ENVIRONMENT based on actual v4.8 browser report, not retried. Windows/CI PAUSED_BY_OWNER, not pass. S5/A08-DATA and GIS DEFERRED_RESEARCH/WAIT_DATA; R5 WAIT_REQUIREMENTS. Live roll-up in `../../07_IMPLEMENTATION_PLAN.md`; immutable original audit criteria and historical outputs retained. No further authorized unblocked implementation tasks from current plan. Review remaining blockers with owner before proceeding.
