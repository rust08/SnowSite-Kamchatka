SnowSite v4.10.1 — read README.md first.

Windows: extract archive to an ordinary folder, install Node.js >=22, double-click START.bat for the local map (exact by default; explicit legacy option). Do not run from inside ZIP. Server opens http://127.0.0.1:8793. Exact solver requires Python 3.13 + pinned dependencies:
  python -m pip install -r workers/milp-python/requirements.txt
  node apps/cli/cli.mjs examples/v47/demo-bounded.json
  node examples/v45/integration.mjs
  npm run check
  npm test
  npm start
Main exact map: http://127.0.0.1:8793/. Extended demo: click «Демо: 2 + 2 из 6», confirm replacement. Advanced JSON page: http://127.0.0.1:8793/exact.html. All sites/volumes are synthetic; roads are OSM snapshot. No real site approval.
Continue development: AGENTS.md, docs/STATUS.md, docs/HANDOFF.md, docs/ARCHITECTURE.md. Clone the supplied history.bundle to preserve Git history; do not git init over this project.
Active plan and remaining blockers: docs/07_IMPLEMENTATION_PLAN.md. Windows/CI paused by owner; no real data research in this release.

Stabilization R01–R05: REVIEW_FIX_REPORT.md; for local history restore use SnowSite-v4.10.1-history.bundle (branch work/v4.10.1).
