# Handoff — v4.10.1

## Current standalone H01 A4 handoff (review candidate)

Use the accompanying Full Review Pack; start with its Coding Handoff `START_HERE.md` / `CURRENT_STATE.md`, approved ADR001–004, `TASK_PLAN.md` and `ACCEPTANCE.md`. Verify archive SHA and exact manifest membership. Do not follow historical Git restoration as the current procedure: this is standalone, Git HEAD unknown. A4 changes only a baseline test, six documentation files and the product manifest. No runtime or dependency changes. See [current status](STATUS.md), [code map](CODE_MAP.md), [acceptance](08_ACCEPTANCE_TESTS.md). Evidence and exact final command results are outside the product tree. Stop for independent final review; H02, PR, pilot, release and municipal deployment NO_GO. Browser UNVERIFIED, Windows/CI paused, R06/R07 open.


Read AGENTS → STATUS → 07_IMPLEMENTATION_PLAN → this file → CHANGELOG. Restore `git clone -b work/v4.10.1 SnowSite-v4.10.1-history.bundle SnowSite-Kamchatka`. Verify clean tree and manifest. Canonical apps/packages/workers; legacy wrappers only. No remote push. Preserve older audits/benchmarks.

## Current handoff v4.10.1 — independent review first
- Restored exact v4.10 history from the owner library bundle; archive SHA and clean tree checked. Parent `7fbf0de40b6d874b411e7cf2dba201b26ff49d03`. v4.10.1 source ZIP and incremental patch refer to this parent. Full commit identity is in the accompanying history bundle / release identity file, not inferred from a filename.
- Scope R01–R05 only; initial repro + original 7-test failing regression suite followed by minimal fixes and passing regressions. [Report](../REVIEW_FIX_REPORT.md) and [evidence](benchmarks/v4101/acceptance.md). API 1.0, SDK 0.3.0, solver and graph unchanged.
- Do not apply previous cumulative patch over v4.10. Current remote PR was not checked; before integration verify its actual tree and base. Use scoped incremental patch only if v4.10 baseline matches; no remote push/merge by this session.
- Stop after independent audit of this release. Real browser BLOCKED_ENVIRONMENT; Windows/CI/publish paused; data/research and R5 stay blocked. Never infer legal approval or real savings from fixture results.

## Historical baseline v4.8.1
- Restored v4.8 `dd1b56a`, original 328 manifest entries and 104 baseline tests PASS. Added `tests/v481-acceptance.test.mjs` for outstanding B07/B09/B21 proof. All three focused checks pass against existing production code. Actual HTTP abort kills deliberately stalled child; next solve succeeds. Missing Python test verifies typed HTTP/CLI error and recovery. Million m³/Q=1 returns compact assignment; 1m+1 rejected; measured maximum RSS, no hard OS memory-limit assertion.
- Final 107/107 tests, graph unchanged, six schemas and 26 instances PASS. Raw evidence in `docs/benchmarks/v481/`. No runtime/data/math/API/schema change, no platform/research/deployment work. Previous v4.7 ranking proof and v4.8 SDK evidence unchanged.
- Updated README/README_FIRST, AGENTS, STATUS, HANDOFF, live 07 plan and 08 acceptance status, API/ALGORITHM/ARCHITECTURE/CODE_MAP and history. Marked legacy planning snapshots historical. No new tasks added.

## Remaining existing tasks and blockers (not active work)
1. **B22/A14 browser gate BLOCKED_ENVIRONMENT.** v4.8 Playwright initial navigation blocked by policy, cannot validate actual click/import/map behavior here. If owner later authorizes a working browser environment, use existing `python tools/acceptance.py --mode browser --output runtime/owner-browser-unique`; do not bypass policy or retry in the same environment.
2. **Windows and GitHub Actions PAUSED_BY_OWNER.** Owner reports existing local Windows launch works; not formal platform/CI PASS. Preserve START.bat and workflows unchanged. No remote operations or repetitive platform tests.
3. **A08-DATA / S5-SITES and existing GIS-01…07 WAIT_DATA / DEFERRED_RESEARCH.** Real site leads, verified access geometry, capacity, status, road restrictions, demand/trucks/receiving and economics require research/actual inputs. [DEFERRED_SITE_DATA_PLAN](DEFERRED_SITE_DATA_PLAN.md). Do not fabricate, start synthetic GIS expansion or add tasks. Resume explicit existing research track only after owner asks.
4. **R5 WAIT_REQUIREMENTS.** Optional deployment and hard process-tree/Python resource limits depend on target host, workload/quotas, persistence, authorization and ownership. B09 scoped local acceptance does not prove native memory cap; do not add arbitrary platform-specific limits or production infrastructure. Larger scale workloads not covered by seed719 guarantee; don't reopen accepted benchmark without concrete need.

## Historical next action (pre-v4.10.1)
Review these remaining items with the owner. Owner subsequently requested exact map integration; completed below. No further unblocked task remains under current no-research/no-new-backlog instruction. Stop at this tested state; do not treat lack of external data/platform requirements as a reason to generate more versions. If an actual defect is demonstrated, fix the specific existing criterion, run tests, append history and regenerate manifest. If a blocked task is explicitly restarted, follow its existing plan. No publication.

## v4.9 completed / integration handoff
Map parity explicitly authorized. `apps/web/lib/exact-map.js` builds safe synthetic v1 requests, normalizes settings, refuses lossy advanced imports and maps compact results to view; `app.js` orchestrates exact/legacy modes, route verification, cancellation, variants, relocation, exclusions and export. Server exposes two canonical routing/validation modules; solver and API JSON version unchanged. New fixtures in `examples/v49/`; `tests/v49-map.test.mjs` and `tests/v49-map-events.test.mjs` exercise real API and wiring. 112/112 + 30 checks. See `benchmarks/v49/acceptance.md`.
Next: update shared/snowsite via a new integration branch from current upstream main and a scoped patch. Never force push or touch other teams. Browser gate remains open; updated smoke script is ready for an allowed browser. No research, production or new backlog.

## Historical v4.10 workspace polish / integration handoff
- v4.9 exact map behavior preserved. Changes limited to frontend hierarchy and event wiring, one explicit GET of the existing demo fixture, test harness, documentation. New school demo button confirms replacement, then requests exact Top-5; no fabricated sites. Clear pending results, do not conflate local assignment optimal with full rank proof.
- `tests/v410-ui.test.mjs` and extended `tests/v49-map-events.test.mjs` exercise static structure, confirmed/cancelled demo, keyboard focus, real HTTP JSON result downloads and stale output clearing. 114/114 local regression, graph and contracts PASS. `tools/browser-smoke.py` now includes 1366×768 and 390×844 layout/interaction checks but not executed here. No visual certification; existing deferred gates unchanged.
- For team repository, use **only** cumulative v4.10 integration patch from current `origin/main` with `git apply --check --index --directory=shared/snowsite ...`. Actual verified upstream subtree matches v4.8.1 minus four ignored `.log` files; patch restores them. Full standalone bundle keeps all development commits, team PR can use one scoped commit. If patch check fails, stop; never force-push or overwrite another team's changes.
