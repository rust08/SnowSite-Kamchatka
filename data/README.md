# Data boundaries

- `snapshots/pkgo-27233df581c6/city-network.json` is the immutable road snapshot with original SHA-256. See its adjacent `CITY_SOURCES.md` for provenance/attribution. Do not fetch or modify it during tests.
- `fixtures/scenario.demo.json` is fictional; not operational data. Other small synthetic graphs/inputs live in `examples/` and frozen benchmarks for historical reproducibility.
- `evidence/` contains source-scoped historical leads, not eligible sites. Capacity, access and approval require explicit evidence. See `docs/SITE_CATALOG.md`.
- schemas are in `packages/contracts/schemas/`. Files at the old `data/city-network.json`, `data/scenario.demo.json`, `data/scenario.schema.json` and `data/site-evidence/` paths were relocated, not duplicated; update operator-specified paths (default CLI and HTTP resolve canonical locations). Historical audit documents retain old paths and are reproducible via the corresponding Git revision.

Future evidence acquisition is deferred; see [acquisition and GIS plan](../docs/DEFERRED_SITE_DATA_PLAN.md). Store each new evidence snapshot separately with provenance/version/hash; never automatically promote leads or overwrite the frozen catalogue.
