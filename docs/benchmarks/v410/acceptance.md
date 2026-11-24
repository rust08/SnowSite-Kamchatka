# v4.10 local workspace acceptance — 2026-11-21

Base v4.9 `7a690a5`; previous standalone history restored from bundle. Owner requested frontend ergonomics and single cumulative update to already merged v4.8.1. No mathematical model, graph, data, dependencies or JSON solver contract changes. Only added a fixed GET serving the existing v4.9 educational editor fixture.

## Executed
- `node --test tests/v410-ui.test.mjs tests/v49-map-events.test.mjs`: 3/3 PASS. Confirmed demo replacement/cancel, exact 2+2-of-6 Top-5, focus preservation via ArrowDown/selection, real API, advanced response downloaded byte-compatible with JSON, stale result cleared on new file/error. DOM/Leaflet test harness, not actual browser.
- `npm test`: 114/114 PASS (112 prior + 2 new); 43.17 seconds in local Linux with Node 22.16.0; raw node-tests.txt. `npm run test:contracts`: 6 schemas / 30 instance checks PASS. `npm run check`: pinned 9983 nodes, 12354 edges, SHA-256 0e0a464f7d92057fa5bbad634c083ad0c1923294597d989ead386b393acf7ad2 PASS. SciPy 1.17.0.
- `git diff --check`: no whitespace errors. Python `py_compile` on updated browser-smoke script; no syntax errors. Static HTML IDs unique; CSS top-level parse via tinycss2 no errors (not visual certification).
- Verified current shared/snowsite Git tree on upstream main: e873b79bd117b23943a64a71076e7424c1b15fa7, exactly standalone 3259795 minus four historical `.log` files (docs/backend-review-v42/evidence/{manifest-check,network-check,repro,test}.log). Cumulative patch restores these logs; PR need not apply v4.9 separately.

## Not executed
Actual Chromium screenshots, event/layout tests at 1366×768 and 390×844 remain blocked by prior navigation policy. Browser smoke extended for future authorized run, not executed. Do not claim actual browser/responsive certification. Windows/GitHub Actions paused by owner; research and R5 deployment unchanged. No network or real-data additions in runtime.
