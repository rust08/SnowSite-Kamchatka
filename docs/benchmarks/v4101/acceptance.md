# v4.10.1 local stabilization acceptance — 21.11.2026

Actual local Linux run; Node 22.16.0, Python 3.13.5, NumPy 2.3.5, SciPy 1.17.0. Restored parent `7fbf0de40b6d874b411e7cf2dba201b26ff49d03` from the original Git bundle. Input ZIP SHA-256 `474ab2d08c9d4604bb51851da9e634c87cbe2ee953eae81dc52f6f8c3ebbd9b1`; original archive and restored parent tree match. Parent integrity 355/355. See `evidence/identity.txt`.

| Command | Observed exit | Result / evidence |
|---|---:|---|
| `node /path/to/reproduce.mjs <root>` (on parent) | 0 | Reproduced 5/5 defect groups (seven JSONL rows); diagnostic, not assertion gate. `before-reproduction.jsonl` |
| `node --test tests/v4101-stabilization.test.mjs` (tests added, product unmodified) | 1 | 0 pass, 7 fail; `new-tests-before.log.gz` (lossless gzip; original raw log in external handoff) |
| Same targeted regression suite after fixes | 0 | 7/7, 0 fail; `new-tests-after.log` |
| `npm test` | 0 | **121/121**, 0 fail/skipped/cancelled, 44.026 s; `full-tests.log` |
| `npm run check` | 0 | 9,983 nodes / 12,354 edges; graph `pkgo-27233df581c6`; SHA-256 `0e0a464f7d92057fa5bbad634c083ad0c1923294597d989ead386b393acf7ad2`; `check.log` |
| `npm run test:contracts` | 0 | 6 schemas, 30 instance checks; `contracts.log` |
| `node apps/cli/cli.mjs examples/v49/map-api-2plus2.json` | 0 | `extended.json`; independent expected-value assertions in `city-assertions.txt` |
| `node /path/to/reproduce.mjs <root>` (after fixes) | 0 | All seven diagnostic rows show expected behavior; `after-reproduction.jsonl` |

All evidence paths in the table are relative to `evidence/`. The diagnostic script is supplied by the original independent auditor and is included unchanged in the separate review handoff. The test file is part of the release tree. No historical evidence is overwritten.

## City fixture

`exact_top_k`, 15 configurations (5 proven, 10 pruned in this run). Baseline 159.425990 km, 228 m³. Ordered alternatives C1+C6 70.508430, C3+C6 71.054490, C4+C6 78.682230, C2+C6 84.600400, C1+C4 90.254310 km; all 228 m³. Assertions compare integer mm, volume, order, configuration IDs and ranking status to the required benchmark. This is a synthetic fixture, not actual city savings or a separate mathematical proof of every MILP.

## Release-only checks

Staged intended release files, regenerate via `node tools/generate-manifest.mjs`, check committed clean ZIP via `npm run check:manifest`, compare exact ZIP membership and parent-relative patch. External release identity and evidence accompany the archive to avoid circular hashing. See `REVIEW_FIX_REPORT.md` at repository root and the separate handoff.

## Not executed / blocked

Actual browser: BLOCKED_ENVIRONMENT, not run again. Actual Windows/GitHub Actions/publish: PAUSED_BY_OWNER. Remote PR not checked or modified. S5/A08-DATA WAIT_DATA/DEFERRED_RESEARCH; R5 WAIT_REQUIREMENTS. No new research, dependency, schema, MILP, graph or deployment work. Stop at independent review.
