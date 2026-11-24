# v4.8 — local R4 reliability and acceptance

Base v4.7.1 `49f29d5`. Restored bundle, new branch work/v4.8. Linux x86_64, Node 22.16.0, Python 3.13.5, SciPy 1.17.0, NumPy 2.3.5. Historical results preserved. Code tested at `e45bb8e`; subsequent release changes are documentation and example only.

| Gate | Result |
|---|---|
| Prior unit/integration | 103/103 PASS (baseline-tests.txt) |
| Static directory reproduction | original `/vendor/` terminated Node, ERR_HTTP_HEADERS_SENT (static-before.txt) |
| Focused regression | 1/1 PASS, API survives requests for directories and missing paths; valid assets unchanged (static-after.txt) |
| Local core report | 104/104 tests PASS; pinned graph PASS; 6 schemas + 26 instances PASS; manifest PASS (core/) |
| Git checkout | Linux `git -c core.autocrlf=true clone -b work/v4.8 --no-hardlinks ...`; 317/317 manifest entries at tested commit, CRLF START.bat / historical CSV retained; not real Windows |
| External SDK | offline local `npm pack`, offline install in separate sibling consumer; all three entrypoints, actual bundled Python worker and exact rank scores/fingerprints matched in-tree example (external-sdk-result.json). 313 packaged entries in measured pre-final archive, runtime/private directories absent. No published package. |
| Actual browser | FAIL/BLOCKED: Chromium started, initial navigation to loopback blocked by ERR_BLOCKED_BY_ADMINISTRATOR. See browser/report.json and browser/browser.txt. No bypass, interaction assertions not executed. |
| Windows / remote CI | NOT RUN: no authorized Windows environment / remote repo. Workflows prepared for artifacts. |

Core commands `python tools/acceptance.py --mode core --output runtime/v48-core`; `SNOW_CHROMIUM=/usr/bin/chromium python tools/acceptance.py --mode browser --output runtime/v48-browser`; external reproduction examples/v48/README.md. Runner returns scoped exit code; core pass does not imply browser pass. Final package verification is manifest and pinned graph after extraction, against exact code tested at e45bb8e. No model, graph, UI, schema, dependency changes, no real data research, no public deployment. Do not reopen A12b reference benchmark without a new measured need.
