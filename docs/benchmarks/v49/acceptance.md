# v4.9 exact map acceptance (2026-11-21)

Base: v4.8.1 3259795. Local Linux Node 22.16.0 / Python 3.13.5. Existing 107 tests plus five tests of v4.9. No graph, solver, mathematical contract or real-data changes.

- `node --test tests/v49-map.test.mjs`: 4/4, including real HTTP city graph, 2 additions, route parity, exclusion lineage, relocation and greenfield.
- `node --test tests/v49-map-events.test.mjs`: 1/1. Served app.js, real API plus test DOM/Leaflet harness; variant switching, routes, count, rejection with reason, history, speed edit, error without fallback.
- `npm test`: 112/112 PASS; raw node-tests.txt. `npm run test:contracts`: 6 schema definitions / 30 instances PASS; contracts.txt.
- v4.9 editor synthetic demo has six candidates and requests Top-5 for 2 additions; old city demo retained. Fixed city regression previously verified: 159.425990 km baseline, 108.556350 / 122.648320 additions, 92.228770 both, 228 m³.
- Browser smoke updated but not actually run for v4.9; Chromium policy gate remains open, mock harness does not certify rendering or browser events on real devices. Windows and GitHub Actions paused. Research and production unchanged.
