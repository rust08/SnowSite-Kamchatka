# v4.7 A12b — finite-catalogue proof performance
Base `2c6f081` v4.6, local branch work/v4.7 restored from Git bundle, no push. Node 22.16.0 / Python 3.13 / SciPy 1.17.0. Baseline 97/97, pinned city check PASS. No change to graph, site data, model objective, legacy UI, default selection strategy, public exports, or architecture.

## Approach and proof
New explicit `bounded_enumeration`: same admissible sets as full enumeration; lexicographic lower bound using effective volume caps, reachable pairs and integer trip minimum conditional on full service. Sort by `(U_lb,L_lb,ID)`, prune only suffix dominated by K proved incumbents, only complete enumeration can certify `exact_top_k`. Independent full integer oracle validates small allocations/bounds. Full-service per-source trip-cover cuts and exact common divisor scaling enabled only for new strategy. Detailed derivation in ALGORITHM.

Initial spike without source cuts: 5s, 14 evaluations /13 proof, 0 pruned, provisional; found scores 74.2/79.6/80.6/81.8/82 km. Initial cut with unscaled distance rejected by unchanged independent objective checker (`Solver objective verification failed`); exact GCD scaling added and verified. First focused test incorrectly demanded pruning from capacity-constrained fixtures whose lower bounds were loose; scores/parity passed but assertion failed (log retained). Replaced that assertion with separate positive full-service pruning fixture and kept zero-demand tie test, all prior assertions. 72 independent fixed problems (seed470719: 0 demand/site, cap, slots, unreachable/zero/nonmultiple distances, partial service) passed and all policy-mode score parity, full-service filter, exclusions, tie and cancellation checks passed. `focused-pre-city.txt`.

## Benchmark (same immutable seed719, budget not raised)
`node tools/benchmark-v47.mjs bounded-final bounded_enumeration`: actual raw results and report under bounded-final; light development work concurrent, not a controlled statistical experiment. Matrix SHA `c559c139de390d08935a91ace555f9ef08288018673e8587f88cbf8f5d073fda`, same frozen input as v43–45. 20 sources, 30 sites, 2 fixed + 2 new, 378 sets; 168 m³ served in each alternative. Node RSS snapshots ~34–42 MB; not child peak memory, not memory limit. Response ~34.6 kB.
| Budget | wall time | solved/proved | bound-pruned | status | ordered km |
|---|---:|---:|---:|---|---|
| 5s cold | 1.962 s | 16/16 | 362 | exact_top_k | 74.2,79.6,80.6,81.8,81.8 |
| 5s warm | 1.960 s | 16/16 | 362 | exact_top_k | same |
| 15s | 1.834 s | 16/16 | 362 | exact_top_k | same |

Compared to historical v45 5s enumeration best 119 km, unified 74.2 km without full rank proof, now exact for this pinned case. Not claiming runtime improvement in all cases or real savings. Existing limits remain 1000 configurations/100000 nodes, 30 sites, 50 sources. If catalogue cannot be enumerated or bound is loose, provisional/incomplete remains possible. The unified strategy has not been accelerated itself. `prunedByBound` is not a count of MILP proofs.

City CLI: `node apps/cli/cli.mjs examples/v47/demo-bounded.json` actual output `city-bounded.json`, 228 m³, baseline 159.425990 / both 92.228770 km. Further regressions and complete non-pruning crosscheck recorded separately below when run.

## Numerical regression and complete reference
The first all-sets reference rejected an otherwise integral allocation for `[S00,S01,S02,S07]`: raw native objective when rescaled was `99999999.99997893`, the verified integer allocation cost `100000000` mm. This is a tiny floating-point discrepancy magnified by exact GCD scaling. `worker.py` now canonicalizes a near-integer **native** distance objective (tolerance 1e-5 native units, reject larger) before conversion to mm, preserves raw dual bound, and leaves strict independent JS checker unchanged. Added explicit regression for this exact configuration and a restricted-catalogue cap case. Historical failed run retained in reference-initial-error.txt.

`node tools/verify-v47-benchmark.mjs complete-reference-final` separately loops through every pair of 28 candidate sites with two fixed, no use of pruning or ranking code, uses strengthened fixed solver and independent allocation checker. All **378** fixed solves returned optimal; 29.575 s wall time. Full ranked scores in `complete-reference-final/reference.json`. This is independent enumeration plus the same MILP backend, not an independent solver; 72 small integer oracle cases provide the algorithm-independent validation. No per-request runtime guarantee.

After normalization, `node tools/benchmark-v47.mjs bounded-normalized bounded_enumeration`: cold **2.065s**, warm **1.785s**, long **1.809s**, all 16/16 proven, 362 pruned and `exact_top_k`. Full top5 matches non-pruning reference for all three, same frozen matrix SHA and 168m³ served. `bounded-normalized/` is the final run; earlier measurements retained. No default/model change. City all four values and HTTP/CLI/module parity passed in pre-normalization suite; final suite below covers all again.

Final math regression: `npm run check && npm test` **103/103 PASS**, all 97 prior and six new tests, graph SHA unchanged. See math-final-tests.txt. No Windows/remote or browser pass claimed.

## R4 verification automation (local contract gate)
`npm run test:contracts` PASS six schema definitions, 26 instance checks (all example requests, prior stored response, legacy scenario, registry, evidence catalogue, synthetic unlocated record, four fresh CLI responses on two graphs across all three strategies, negative enum/capacity/pruned checks). Offline Draft202012Validator, exact dev pins. Configured manual CI dispatch, Ubuntu/Windows unit/integration/schema and browser jobs with platform-specific Chromium install; not run remotely. Existing v4.6 Chromium administrator block still applies; no new E2E attempt or Windows pass claimed. No production/deployment change.
