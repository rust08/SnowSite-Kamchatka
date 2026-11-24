# ADR / Журнал решений SnowSite

## ADR-001: отдельный репозиторий, не монорепозиторий

Статус: принято для стартового комплекта 20.11.2026.

Причина: «Север» проходит финализацию, нельзя ломать его backend, а SnowSite должен показать независимую математическую задачу. Решение: отдельная папка/remote, только узкие заимствования вендор/данных с происхождением.

## ADR-002: локальная демонстрация без облачных сервисов

Причина: ограничения времени и подключения. Node + Leaflet + city graph уже достаточно для демонстрационного MVP. Развитие infra — после измерения потребностей.

## ADR-003: два независимых статуса

Логистическая пригодность ≠ земельная/санитарная/экологическая допустимость. Ни одна пользовательская запись JSON не является юридической проверкой.

## ADR-004: исходные данные сценарные

Пока нет официальной карты действующих площадок и замеров, все seed-факты — `scenario_only`, даже при привязке к реальным узлам OSM. Интервью нельзя превращать в утверждённый каталог.

## ADR-005: greed-first prototype, exact oracle позже

Существующий алгоритм — воспроизводимый heuristic baseline, не глобально оптимальный. Следующая научно-техническая задача — построить малый точный oracle и контрпримеры. Альтернативный solver принимать только с тестами и объяснением изменения результатов.

## ADR-006: отсутствие реального CAPEX, трафика и очередей

Первое сравнение оценивает транспортный километраж и время движения при одинаковом сценарии. Не выдавать оценку как полный финансовый эффект/стоимость строительства/вместимость действующих площадок.

## 2026-11-21 — точный oracle и контрпример к greedy
- Добавлен `tests/helpers/oracle.mjs` (полный перебор, только тесты; объёмы кратны вместимости рейса).
- Зафиксирован контрпример: при одинаковом `unserved` (10 м³) greedy даёт 6 км, оптимум 4 км (`tests/oracle.test.mjs`).
- Solver пока НЕ заменён: сначала нужен улучшающий алгоритм (min-cost flow / обмены рейсов), который пройдёт эти тесты.
- Контрольные значения демо (168.779 / 101.829 / 110.286 км) относятся к текущему greedy.

## 2026-11-21 — ADR-007: жадный проход + локальный поиск
- Solver = regret-first greedy + локальный поиск (перенос и обмен рейсов, включая необслуженные). Цель лексикографическая: нераспределённый объём, затем км. Ухудшить результат greedy он не может (тест).
- На 300 случайных малых графах (сид 7) greedy не оптимален в 123 случаях, с локальным поиском — в 0 против точного перебора. Это доказательство только для малых тестов (объёмы кратны вместимости рейса), не для городской задачи.
- Контрольные значения демо не изменились: 168.779 / 101.829 / 110.286 км. Время расчёта ~0.1 с.
- `compareSites(network, scenario, {improve:false})` возвращает чистый greedy — для тестов и сравнения.
- Формулы вместимости рейса сверены с `backend/haul.mjs` «Севера»: min(кузов, floor(грузоподъёмность/плотность)).

## 2026-11-21 — ADR-008: подложка карты как в «Севере»
- Причина: старая подложка 1792x2048 растягивалась и давала «мыло», дороги почти не были видны.
- Решение: рельеф 2560x2560 с береговой линией и векторный слой деталей `city-context.js` (ленивая загрузка, от zoom 11.5) из «Севера»; дороги графа рисуются чётче. Логика расчёта не менялась.

## 2026-11-21 — ADR-009: демо-сценарий без нулевых рейсов (METHOD-01)
- Узлы D1, D3, D5 были теми же, что у C1, S0, C2: 5/10/9 рейсов с нулевым километражом выглядели как «бесплатный» вывоз. Узлы источников заменены на разные дорожные узлы в 1–2 км кругового пути от площадки; все 9 узлов демо уникальны.
- Новые контрольные значения: baseline 167.098 км / 26; C 108.556 км / 25; D 122.648 км / 25. Тест `METHOD-01` фиксирует их и запрещает рейсы с 0 км.
- Фиксированной «условной длины» маршрута не вводилось.

## ADR-008 — SciPy/HiGHS для exact fixed allocation (accepted)
Python 3.13.5 + SciPy 1.17.0 + NumPy 2.3.5 проверены локально, sparse MILP, JSON-lines child, две фазы. Альтернатива CP-SAT не нужна в первой версии. Отдельная зависимость только v1; legacy UI Node-only. Windows setup/CI ещё не проверены. Лицензии SciPy/NumPy BSD, HiGHS MIT (проверить включённые notices при распространении бинарников).

## ADR-009 — каталог и изолированный HTTP worker (accepted)
Точный конечный перебор вместо integrated MILP с z для текущего малого каталога. Общая матрица, bounded enumeration, keep topK, одна Python-сессия. HTTP Node worker изолирует матричную работу; deadline ограничивает Python child, отмена при disconnect. Без внешнего API и без нового UI. P1 registry/cache/shortlist позже.

## ADR-010 — opt-in safe preset and evidence isolation (accepted)
Keep documented v1 behavior for existing integrations, explicitly opt into preserve_existing for new requests; no breaking change to valid v1. Historical lead import has no direct promotion. Strict adapter checks scoped evidence supplied by authorized caller, not official legal approval. Unknown is null, no automatic geocoding or capacity.

## ADR-011 — independent trip cap and full-load route restrictions (accepted)
Sparse additional row on trip variables, separate from m³ capacity. Optional gross/width and direction-specific blocks operate on pinned graph, unknown physical legal limits not guessed. Objective unchanged. Full-load profile conservative; actual queues, temporal feasibility, partially loaded paths and legal certification deferred until data/model available.

## ADR-012 — distance-only matrix, measured stop before unified solver (accepted)
Use same shortest path mathematics with two directional trees per unique node of smaller side; bounded cloned in-process cache. A 5s 20×30 benchmark demonstrates per-configuration solves are the bottleneck, not matrix. Integrated z solver is justified next but not merged without independent oracle. Old enumeration remains reference and provisional is honest. No cross-HTTP persistence; isolated worker design retained.

## ADR v4.4-S4.3a: keep optional unified MILP and exact enumeration side by side
Accepted: reuse SciPy 1.17.0/HiGHS and JSON-lines process; no new engine/dependencies. Three lexicographic stages avoid unsafe combined distance+tie units. Use exact-set no-good cuts and validate every incumbent in independent JS. JSON-escape tie incompatibility explicitly falls back to bounded enumeration to preserve old v1 ordering. Reject making unified default yet: same 5s synthetic budget can find shorter incumbent, but cannot prove full Top-K consistently; several strong-LP and GCD experiments preserved in v44 benchmarks. Retain aggregate capacity linking (ceil-affine row forces unused trips to zero when x=0); rejected additional per-pair LP links for this release because observed 5s proof worsened rather than improved. No cap increases, no production scaling claims, no silent fallback after timeout. Revisit measured performance with longer/cold/warm benchmarks and more robust incumbent delivery before default change.

## ADR v4.4-S4.3b: operator snapshot registry, no request file access
Accepted: register bounded local snapshots once at startup, keyed by ID/version with exact raw SHA, keep legacy endpoints city-only. Alternative request-upload/URL or hot reload rejected: would couple solver to untrusted file/network input and complicate memory/security and snapshot reproducibility. Metadata-only discovery for integration. Retain isolated worker and single concurrency, no public-service security claim.

## ADR v4.4-A08a: explicit per-trip internal roundtrip cost
Accepted: include only supplied integer total internal roundtrip length, with exact horizon, snapshot, truck/access profile and value/basis binding. Do not reinterpret ambiguous historical positive access distances or double them. Preserve legacy road-only requests and model fingerprint; new inputs opt into v1.2-intrasite. Unknown is omitted with warning rather than asserted zero. No synthetic polygon-to-distance heuristic or actual site speed/scheduling claims. Separate polygon and source connector work later.

## ADR v4.5-A12a: preserve completed phases, not false proof
Accepted: private checkpoint frame after a completed objective phase, retain last per-request frame until final response/hard timeout; explicit abort discards, worker errors propagate. Independent verification applies even on deadline. SciPy has no streaming incumbent callback here; no dependency change or rank-performance claim. Multiple before/after measurements use pinned seed and separate files; full proof remains OPEN.

## ADR v4.5-A08b: bounded local polygon is metadata
Accepted: GeoJSON Polygon on documented 1e-7° grid, exact planar topology, source/horizon/value scoped; rejects unsupported global/complex geometries instead of repair. Access node, capacity, screening and internal travel remain independently supplied. No geodesic area or land rights inference. Geometry hash is representation hash, not parcel identity.

## ADR v4.5-R0: private stable library facade before folder migration
Accepted: retain deployable modular monolith and expose Node package exports, evidence/IO subpath boundaries, v1 HTTP unchanged. Document staged target apps/packages/workers with compatibility gates. Reject immediate tree-wide move and mandatory DB/queue/microservices until requirements/measurements justify; owner-controlled private repo and history preservation. See ARCHITECTURE.

### v4.6 — accepted: actual modular monolith layout (R1–R4)
Move canonical code under apps/packages/workers and datasets under snapshot/fixture/evidence boundaries, one acceptance-tested commit at a time. Keep root private Node package and old thin launch/import wrappers rather than introducing package installation or duplicate code. Static boundary tests reject upward imports; checker independent. No math changes in path migration. 97/97 tests, 24 matching payload files. Browser/Windows remain open. Separate A12b performance and any R5 deployment changes from this decision.

## ADR v4.7-A12b: exact bound-first finite catalogue search
Accepted optional bounded enumeration with analytically admissible lexicographic bounds and deterministic ID tie. Cut only remaining suffix that cannot improve K proved incumbents; full enumeration still required. Preserve old default, unified and checker. Valid integer-cover constraints after proved U=0; exact GCD scaling and native integer objective normalization before multiplying back, raw solver bound retained. No threshold relaxation in independent checker. Full non-pruning reference and small oracle validate this version; no general arbitrary-catalogue runtime claim. Reject raising time/size caps or unproved ranking. No new dependency or architecture change.

## ADR v4.8-R4: byte-stable release and scoped acceptance (accepted)
Preserve tracked byte representation across Git checkout settings to keep immutable evidence and manifest valid. Fix local static server crash rather than rework transport. Common Python standard-library acceptance runner uses the active interpreter, separate named gates/logs and new output directory; CI stores output on success/failure. Report scope and unrun stages explicitly; Linux checkout with autocrlf=true is a portability regression test, not Windows proof. No public service, fake browser pass, new production package or changed contract.

## ADR v4.9: exact map default (accepted)
Owner requested UI/backend parity. Keep existing map layout; use safe exact v1 requests and compact results, canonical routing for geometry with distance verification. Explicit legacy mode only, advanced full v1 stays separate to prevent dropped constraints. No solver rewrite, production persistence or GIS extension. UI harness is not browser E2E.

## v4.10 — presentation, not solver redesign (accepted)
Use existing vanilla DOM/Leaflet and canonical API; earlier solve action and clearer alternative list are preferable to introducing another frontend framework. Confirm before replacing editor state with the existing synthetic 2+2 fixture; do not duplicate graph or data. Actual visual acceptance remains open.

## ADR v4.10.1 — fail-closed legacy and atomic import (accepted locally)
Keep legacy heuristic and exact MILP separate. Reject meaningful unsupported legacy constraints centrally in validateLegacy rather than introducing incomplete physical support. Verify explicitly supplied root/meta snapshot constraints before mutating editor state; absent binding remains unknown. Use the canonical browser-safe truck domain validator and bounds through the existing allowlist, not a duplicate contract or new dependency. Correct only R01–R05, then stop for independent review; not a browser or production certification.
