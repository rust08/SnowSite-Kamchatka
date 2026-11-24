# Журнал сессии и передача работы (2026-11-21)

## Задача
Самостоятельный продукт SnowSite-Kamchatka (не «Север»): сравнение сценарных площадок снеговывоза на реальном OSM-графе Петропавловска-Камчатского. Все площадки, объёмы, скорости и тарифы сценарные; юридическая допустимость участков не проверяется.

## Что проверено на старте
- `npm run check`: PASS, 9983 узла, 12354 ребра, версия `pkgo-27233df581c6`, sha256 `0e0a464f...f7ad2`.
- `npm test`: 11/11. `npm start` и API (`/api/health`, `/api/demo`, `POST /api/compare`) работают.
- Контроль демо совпал с `docs/08`: baseline 168.779 км / 26 рейсов / 0 м³ не распределено; C 101.829 км / 25; D 110.286 км / 25.
- UI в Chromium 1366×768: карта, точки, легенда, атрибуция OSM видны; ошибок консоли нет.

## Что сделано
1. `tests/helpers/oracle.mjs` — точный перебор (только тесты; объёмы и вместимости кратны вместимости рейса).
2. Найден и зафиксирован контрпример к greedy (A16): при одинаковых 10 м³ не распределено greedy 6 км, оптимум 4 км.
3. `tests/invariants.test.mjs` — A01, A05–A08, A09, A10, A11, A15, A19, A20.
4. `src/optimizer.mjs` — локальный поиск (перенос/обмен рейсов, включая необслуженные) после регрет-greedy. Лексикографическая цель: нераспределённый объём, затем км. Опция `compareSites(network, scenario, {improve:false})` даёт чистый greedy.
5. На 300 случайных малых графах (сид 7): greedy не оптимален в 123, с локальным поиском — в 0. Контрольные цифры демо не изменились.
6. `docs/11_DECISIONS.md`: ADR-007 и запись об oracle.
7. Сверка с «Севером» (`backend/haul.mjs`): формула вместимости рейса совпадает. Тариф в «Севере» 2400 ₽/ч, в SnowSite 2100 ₽/ч (оба сценарные).

Итог: 22/22 тестов, `npm run check` PASS.

## Не сделано
- UI: отдельные «вывезено/не распределено», причины недоступности, окно кандидата, версия/дата сети в экспорте, понятная ошибка импорта (A17), респонсив на телефоне, проверка XSS в браузере.
- README: быстрый старт для Windows, скриншоты, 3-минутный демо-сценарий, перечень ограничений.
- CI уже есть в `.github/workflows/check.yml` — проверить.
- Тесты A02–A04, A12–A14, A18, A21, A22 частично покрыты старыми тестами; остальное добить.
- Проверка на ноутбуке с Windows — только вручную.
- GitHub: репозиторий не опубликован. Токен в среде недействителен.

## Коммит (на вашем компьютере, PowerShell, в папке проекта)
```powershell
git init
git branch -M main
git add .
git commit -m "feat: SnowSite prototype with exact oracle and local-search solver"
git remote add origin https://github.com/rust08/<имя-вашего-репо>.git
git remote -v      # убедиться, что это НЕ Sever-GitHub
git push -u origin main
```
Репозиторий оставьте Private.

## Допущения
Все данные сценарные; граф OSM не паспорт дорог; эвристика не доказана оптимальной для городской задачи; никаких утверждений об экономии бюджета.

## Этап 2 (UI) — сделано
- Solver возвращает `unservedReasons` (`no_round_trip_route` / `capacity_exhausted`); UI показывает причины и таблицу «вывезено / не распределено / км / рейсов / сопоставим с baseline».
- Название кандидата редактируется; везде виден правовой статус «не проверен».
- Экспорт содержит `meta` (дата, версия сети). Импорт строгий (узлы, ID, числа, тип площадки), `legalStatus` принудительно `unverified`, ошибка не стирает сценарий, при другой версии сети — предупреждение.
- Проверено в Chromium: XSS-имя не исполняется, плохой JSON отклонён, телефон 390 px без горизонтальной прокрутки. 23 теста зелёные.

## Этап 3 (README/демо) — сделано
- README переписан: возможности, запуск на Windows (PowerShell), 3-минутный сценарий, полный перечень ограничений, 3 скриншота (`docs/screenshots/`, сценарий, сравнение, нехватка вместимости).
- Сценарий нехватки (A,B по 20 м³): baseline вывезено 40 м³ / не распределено 188; кандидаты 140 / 88 — помечены «несопоставимо» по км.
- CI (`.github/workflows/check.yml`: `npm run check` + `npm test`, Node 24) проверен по содержимому; на GitHub ещё не запускался.

## v4.1, этап A (по ТЗ SnowSite_v4_Codex_Implementation_Prompt) — сделано
- BUG-01: форма и модель синхронны (`input` → валидация → `scenario`), `render()` больше не перезаписывает поля; ошибки у полей.
- BUG-02: `nextId` (public/lib/core.js) не зависит от длины массива.
- BUG-03: `createRequestGate` (revision + requestId + AbortController); статусы «Считаем / Изменено — пересчитайте / Готово / Ошибка».
- BUG-04: сброс в два клика; импорт с другой `networkVersion` отклоняется.
- METHOD-01: демо без нулевых рейсов; контрольные значения 167.098 / 108.556 / 122.648 км.
- Тесты: 34 в `npm test`; браузерная проверка `tools/e2e.cjs` (12 проверок, нужен Playwright).

## v4.1, этапы B и C — сделано
- Новая раскладка (public/index.html, style.css, app.js): карта + панель результата, легенда, выбор варианта кнопками, агрегированные маршруты, карточки точек, drawer «Изменить условия», диалог «Как работает».
- Чистая логика в `public/lib/core.js` (nextId, createRequestGate, validateTruckField, aggregateTrips, headline…), 16 новых юнит-тестов (итого 39).
- Браузерная проверка `tools/e2e.cjs`: 22 проверки, включая BUG-01…04, клавиатуру, недовывоз.
- Документы: README (демо за 3 минуты, скриншоты), docs/UX_CHANGELOG.md, docs/18_FINAL_REPORT.md.

## v4.2 — S0
Воспроизведение аудита, общая валидация и лимит legacy; 41/41, graph PASS. См. STATUS и CHANGELOG.

## v4.2 — S1
Exact MILP, checker, 60 oracle cases и четыре demo optimum; 45/45, graph PASS.

## v4.2 — S2
Поиск конфигураций, topK, exclusions, frontier; 51/51, graph PASS.

## v4.2 — S3
Versioned API/CLI и schemas, typed errors, checker; 54/54, graph PASS, HTTP parity; браузерный E2E и Windows не проверены. Stop rule, S4 OPEN, S5 WAIT_DATA.

### 2026-11-21 — v4.3 S3.1
Original history restored; audit reproductions and baseline passed. Explicit safe policy preset and screening/date validation, fingerprint, legacy label and exact JSON page. 57/57 tests; pinned graph PASS. S4.1 next; browser/Windows not verified.

### 2026-11-21 — v4.3 S4.1
11 evidence leads/9 records imported, none eligible; dry-run parity, explicit conditional adapter, six-candidate examples 2+2/3+1/relocate/greenfield/frontier. 61/61 tests. Next S4.2 trip capacity and profiles; real data WAIT_DATA.

### 2026-11-21 — v4.3 S4.2
65/65 tests. Trip limit independent of storage, distinct conservative loaded/empty access, known snow incompatibility, matrix hash and legs. Counterfactual verified. S4.3 next; no operational time or legal proof.

### 2026-11-21 — v4.3 S4.3 partial
69/69 tests and network check; benchmark parity and bounded in-process cache; large 20×30 only 16 proven /378 at 5s, provisional. Strict evidence claims hardened, HTTP/CLI negative tests. Next unified z solver with rank proof; no further UI redesign or real data guesses. Acceptance and benchmark recorded. Browser/Windows not executed.

### 2026-11-21 — v4.4 S4.3a
Branch work/v4.4 from d86dfc0, historical commits retained. Optional unified MILP for site sets + no-good + lex tie proof, 76/76 tests and graph/schema pass; all 15 small ranks, 24 catalogue oracle cases. 5s comparison 74.2 km unified incumbent vs 119 km enumeration, not full rank proof; retain both methods, record unsuccessful experiments too. Next trusted multi-network API registry. See v44 acceptance and handoff.

### 2026-11-21 — v4.4 S4.3b
Trusted multi-network startup registry, metadata discovery and HTTP parity on second graph; all 79 tests, graph PASS, negative registry/API checks; no legacy change or public deployment. Next A08 in-site roundtrip contract. See v44 benchmark/acceptance.

### 2026-11-21 — v4.4 A08a
Explicit in-site per-trip roundtrip cost, evidence exact value/basis and scope binding, independent checker and cache invalidation; both solvers verified rank reversal 6→15 km vs 12. 84/84 tests and graph/schema PASS. Polygon and real site survey remain open, large Top-K proof performance still open. No browser/Windows. Release after three atomic iterations. Preserve Git bundle and logs for next agent.

## v4.5 iteration A12a (2026-11-21)
Recovered v4.4 history from bundle; source matches ZIP, baseline 84/84 and data PASS. Added completed-phase checkpoint protocol with distinct deadline vs explicit cancel; focused 4/4 PASS after adjusting an initial too-short fixture deadline under concurrent benchmark load. Baseline and original fixture failure preserved under benchmarks/v45. Full regression and paired after benchmark pending. Next A08b metadata-only geometry, repository architecture and release checks.

## v4.5 iteration A08b (2026-11-21)
Added optional local Polygon metadata and source-scoped validation without changing optimization routing inputs; 4/4 focused topology and adapter tests PASS. No production data promotion. Geometry set/hash is not a physical uniqueness or survey proof. Next architecture, README, full regression, benchmark acceptance.

## v4.5 iteration R0 / release candidate (2026-11-21)
Public library facade and separate catalog/network-file adapters added, standalone module exact_top_k best 56 km. Consolidated current README, preserved historical UI guide, added independent repository target architecture/migration gates/CONTRIBUTING, GitHub instructions preserve history rather than new init. No remote publication. Repeated frozen 20×30 benchmark saved before/after: unified 5s 74.2 km/0 proven ranks; 15s 74.2/79.6, 1 proved rank, all rankings provisional. Final Linux graph PASS, 93/93 tests (84 old + 9 new); schemas and 13 response payloads PASS. Windows, browser, actual connector measurements and real data remain open. Stop at working state: next A12b, then R1 behind gates, handoff above.

## v4.6 / R1
Contracts/schema and optimization/checker physically moved to packages/contracts and packages/optimization; src imports delegate, schema bytes unchanged.
Tests 93/93; graph PASS. Next: R2 routing and catalog extraction.

## v4.6 / R2
Routing engine, matrix and trusted file loader moved to packages/routing; site evidence and geometry to packages/catalog. Legacy import identity preserved.
Tests 93/93; graph PASS. Next: R3 worker runtime extraction.

## v4.6 / R3
Python MILP runtime and Node subprocess adapter moved to workers/milp-python; old solver/requirements.txt and worker launcher delegate to single canonical runtime. Protocol, pins and mathematical worker unchanged.
Tests 93/93; graph PASS. Next: R4 API, CLI and web extraction.

## v4.6 / R4
API registry and HTTP thread in apps/api, CLI in apps/cli and byte-identical web assets in apps/web. npm start/optimize use canonical entrypoints; src/server.mjs and src/cli.mjs still launch. Existing path-based tests point to canonical UI/server source; assertions unchanged.
Tests 93/93; graph PASS. Next: organize data and enforce package boundaries, run browser smoke and release integrity.

## v4.6 / R4-data
Immutable snapshot moved to data/snapshots/pkgo-27233df581c6; synthetic demo in data/fixtures, historical evidence in data/evidence, legacy schema in packages/contracts/schemas. All data bytes unchanged, default consumers and benchmark paths updated.
Tests 93/93; graph PASS. Next: boundary regression, browser smoke, final documentation and release.

## v4.6 / R4 acceptance
New public exports resolve directly to canonical packages; four architecture regression tests passed. 24 UI/schema/data/worker files match base v4.5 byte-for-byte. All six schema definitions and selected actual city response/catalog/registry/request validated. Python Playwright/Chromium started, but local navigation was blocked by environment policy; browser smoke source and log retained, actual E2E remains OPEN.
Tests 97/97; graph PASS. Next: release manifest, fresh unpack, then A12b proof-performance task (separate from path-only migration).

## v4.6 release
Packaged source from checked release commit; standalone Git bundle includes earlier history. Use root README, status and handoff. Browser/Windows/remote CI unverified, A12b remains OPEN. No deployment or publication. Manifest check and fresh archive validation performed before delivery (see external release summary).

## v4.7 / A12b
Base 2c6f081, local work/v4.7. 97/97 initial tests, graph PASS. Bound-first finite enumeration exact on pinned 378-set fixture (16 proved + 362 dominated), full unpruned 378/378 reference validates identical Top-5; 72 per-unit independent oracle cases. Initial numerical failures and corrections logged. No model/data/strategy-default change. See benchmarks/v47; next R4 actual cross-platform/browser and contract acceptance, then only evidence-driven connectors/deployment. No push.
Final math gate 103/103 PASS, graph unchanged.

## v4.7 / R4 verification automation
A12b commit a921f19. Added offline schema+live CLI gate, six schema definitions + 26 instance checks PASS. CI matrix prepared for Linux/Windows (unit/contract/browser), manual dispatch, no remote execution. Actual Windows/browser and S5 evidence remain open; no new deployment. See STATUS/HANDOFF and benchmarks/v47/contract-gate.txt. Next release manifest and fresh unpack gate.

## v4.7 release
A12b a921f19 and R4 verification automation b79cb8c; package with release manifest and Git bundle from checked source. Read latest STATUS and HANDOFF. Next externally executable gate is actual Windows/Ubuntu CI and browser acceptance; actual survey/operational data WAIT_DATA. No remote push. See external release report for post-extraction verification.


## v4.7.1 / Deferred site data decision
Base 7bebd19. Owner expects no supplied catalogue/geometry for now; detailed future independent evidence research and GIS backlog saved in DEFERRED_SITE_DATA_PLAN.md. No new site records or data collection, code unchanged. Resume only on explicit owner request; R4 actual platform acceptance and other engineering remain independent. README/STATUS/HANDOFF/AGENTS/technical docs updated.

Verification: npm test 103/103, npm run check PASS, plan links PASS.

## v4.8 R4 transport atom (2026-11-21)
Restored v4.7.1 bundle; original `GET /vendor/` on local API terminated Node with ERR_HTTP_HEADERS_SENT (benchmarks/v48/static-before.txt). Fixed static path/type/read ordering and guarded headers in server. Focused regression PASS; `.gitattributes` checkout byte policy added. No changes to mathematics/data. Full validation follows.
- Added unified scoped acceptance tool and CI artifact upload. Core checks include manifest; browser remains separate. Baseline regression 103/103, contract baseline PASS six schemas + 26 instances. New full acceptance run follows.
- External private SDK packaging verified using npm pack/install offline outside the repo; bundled worker produced exact_top_k, identical rank IDs/U/L/hash to in-tree result. Browser attempted again, navigation blocked by administrator; no workaround. Linux autocrlf=true clone preserved manifest, CRLF historical files unchanged.
- Final local gate at e45bb8e passed 104/104 tests, graph/manifest/contracts; actual browser report failed due to policy. Release docs and external SDK example added, no code changes after tested commit. Status and handoff show remaining blockers explicitly. Bundle retains all history.

## v4.8.1 / residual B07/B09/B21, existing-plan closure
Base dd1b56a; prior bundle restored, 328 manifest entries and 104 tests PASS. Verified actual HTTP cancellation and child exit with stalled POSIX subprocess fixture; busy 503 and subsequent exact reuse. Missing Python → typed HTTP 500, CLI 1; health and legacy intact; exact recovery. Synthetic million-trip solution compact (1 row / 2988 bytes), excess rejected. GNU time max RSS 123776 KiB, no OS native limit claim. 107/107 final tests, graph PASS, six schemas and 26 checks PASS. No runtime changes, no research, no new tasks. Updated active 07/08 plans and README/STATUS/HANDOFF; Windows/CI explicitly paused by owner, browser blocked, A08-DATA/S5 deferred, R5 waits for actual requirements. Next action owner review of remaining gates only. See benchmarks/v481.

## v4.9 / exact map integration
Owner explicitly reopened UI parity after v4.8.1. Implemented adapter, exact default, Top-K, relocation/greenfield, exclusion lineage, session/result export, verified route reconstruction, explicit legacy, advanced JSON separation. Focused tests and full Linux test gate 112/112, 6 schemas / 30 checks. City graph, core solver, underlying contract unchanged. DOM events verified with real HTTP but mocked DOM/Leaflet; actual browser gate not passed. Previous PR merged per owner; scoped delta for next PR, no remote mutation. See benchmarks/v49.

## v4.10 — owner-requested workspace UX
Base 7a690a5; retained exact map and legacy compatibility. Added early solve/cancel, responsive workspace, clearer alternatives/focus, confirmed existing demo shortcut, JSON response download. 114/114, graph and 30 instance checks PASS locally; no actual Chromium verification. Integration patch cumulative from merged v4.8.1, only shared/snowsite; four omitted historical logs restored. No research/CI/Windows/solver/data work.
