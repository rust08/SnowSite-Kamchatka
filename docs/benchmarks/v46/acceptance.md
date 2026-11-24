# v4.6 acceptance — architecture migration

Base commit `ba22248` from v4.5 bundle; branch `work/v4.6`. Local Linux, Node 22.16.0, Python 3.13, SciPy 1.17.0. No remote push. Separate commits for R1, R2, R3, R4, R4-data and final gates.

| Gate | Result |
|---|---|
| v4.5 baseline | 93/93 (`baseline-tests.txt`) |
| R1 contracts/optimization | 93/93 (`r1-tests.txt`) |
| R2 routing/catalog | 93/93 (`r2-tests.txt`) |
| R3 worker | 93/93 (`r3-tests.txt`) |
| R4 apps | 93/93 (`r4-tests.txt`) |
| R4 data | 93/93 (`data-tests.txt`) |
| Architecture regression | 97/97 (`final-tests.txt`) |
| Pinned graph | PASS, 9983 nodes and 12354 edges, SHA-256 unchanged |
| Files moved unchanged | 24/24 (byte comparison against v4.5 `byte-parity.txt`) |
| Contract schemas and selected inputs/output | 6 schemas + 4 instances, PASS (`schema-check.txt`) |
| Browser test | OPEN: executable available, navigation blocked by environment (`browser-blocked.txt`) |
| Windows / remote CI | OPEN, CI configuration defined, not executed remotely |

`npm run check && npm test` used per boundary. Original 93 tests retained; direct filesystem assertions in core/invariants and data fixture reads updated to new canonical paths only. New tests check dependency rules, independent checker, identical function exports, canonical/legacy CLI from non-root cwd, snapshot and static HTTP bytes. City exact request returns 159.425990 km baseline, 92.228770 km with both new sites; synthetic module example returns 56 km best. These are synthetic scenario results, not real-world savings. Full Top-K scale proof (A12b) was not changed/rebenchmarked by this path-only migration. Historical benchmarks preserved. Reproduction commands are in README and CONTRIBUTING. Browser test `SNOW_CHROMIUM=/usr/bin/chromium python tools/browser-smoke.py` failed due to environment restriction before the application was rendered; no browser acceptance claim.
