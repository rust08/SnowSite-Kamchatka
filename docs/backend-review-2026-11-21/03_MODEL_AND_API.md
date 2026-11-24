# Модель SnowSite и интеграционный контракт (предлагаемая спецификация v1)

## Целевая задача

Вход — сеть любого города, спрос по источникам снега, каталог площадок, характеристики одной условной модели самосвала, известные ограничения, запрос выбора. Выход — ранжированные конфигурации мест и распределение объёмов. Это задача capacitated facility location + integer fixed-charge transportation, а не VRP. Минимум км не означает минимум общей стоимости строительства или законность. Сценарная модель одного рейса i→j→i; нет смен, очередей, графика разновременных загрузок. Время рассчитано только из движения; массо-габаритная доступность дорог — лишь по явно переданным данным.

## Входные сущности (предлагаемая модель; не путать с текущим API)

- `NetworkSnapshot {id,version,contentSha256,coordinateSystem:'EPSG:4326',nodes,edges,provenance}`. Узлы ID, [lon,lat]; ребро ID, from/to, положительная конечная длина, направленность, разрешённость, опционально документированные ограничения и период. Уникальные ребра, известные endpoints. Не полагаться на ID Камчатки в core.
- `Demand {id,nodeId,volumeM3,sourceStatus,observedAt?,sourceRef?}`. Объём целый в модели v1; если дробный нужен позднее — единая минимальная единица для всех данных, не округлять без описания. Горизонт объёма обязателен в сценарии. Жалобы и объём снегопада не считаются вывезенными м³.
- `Site {id,accessNodeId,location?,geometryRef?,availableCapacityM3,role:'fixed'|'optional'|'excluded',origin:'existing'|'candidate',replacementGroup?,screening,provenance}`. `location` — предполагаемая точка земли/въезда с координатами отдельно от узла. `availableCapacityM3` — доступный за расчётный горизонт объём, не площадь и не пожизненная ёмкость. Unknown capacity не принимать за infinite или zero; нужно задать сценарное допущение с явным статусом либо исключить из расчёта. Уникальность физического объекта и группы замены обязательна; два ID в одной геометрии не должны удваивать одну физическую ёмкость. Различные объекты у одного дорожного узла возможны только при явном обосновании/разделении.
- `TruckProfile {bodyM3,payloadKg?,snowDensityKgM3?,driveKmh,rateRubPerHour?,tareKg?,widthM?,...}`. Плотность/грузоподъёмность в паре; если проверка массы отсутствует, явно `mass_not_checked`. Дороги loaded vs empty: профиль и ключ кеша отдельные при наличии ограничений. Q константа в первом solver; если лимит зависит от пути, понадобится отдельная модель классов загрузки, а не тихое применение Q для всех маршрутов.
- `SearchPolicy {mode, fixedSiteIds, includeSiteIds?, excludedSiteIds, excludedConfigurations, exactNewSites?, exactActiveSites?, replacementGroups, topK, objective, screeningPolicy, timeLimitMs}`. Режимы add / relocate / greenfield / evaluate / frontier. `replacementGroups` = набор альтернатив, выбирается максимум/ровно один по явно заданной политике. Existing = текущий статус объекта, fixed = обязателен **в этом запуске**. Не смешивать. Запрет/forced недоступность — объяснённая `infeasible`, не игнорировать.

## Математика v1

Индексы: i — источник, j — объект-кандидат, Q — максимальный объём одного рейса. D_i и C_j — объёмы за один горизонт. L_ij = d_loaded(i,j)+d_empty(j,i) из направленного графа; если одна сторона недоступна, пара отсутствует. Пока loaded/empty профили одинаковы, явно указать это ограничение. Использовать целое расстояние в мм (1e-6 км) или другую документированную единицу, проверить переполнение целых чисел. Не использовать округлённые итоговые км для оптимизации.

Переменные:
- z_j ∈ {0,1}: площадка активна;
- x_ij ∈ Z≥0: вывозимый объём, м³;
- n_ij ∈ Z≥0: количество рейсов;
- u_i ∈ Z≥0: остаток.

Ограничения:
```
∀i: sum_j x_ij + u_i = D_i
∀j: sum_i x_ij <= C_j * z_j
∀(i,j) reachable: x_ij <= Q*n_ij
∀(i,j) reachable: x_ij >= Q*n_ij - Q + 1
0 <= x_ij <= min(D_i,C_j)*z_j
0 <= n_ij <= ceil(min(D_i,C_j)/Q)*z_j
fixed: z=1; excluded: z=0
sum_{j in new} z_j = exactNewSites   (когда задано)
sum_j z_j = exactActiveSites        (когда задано)
∀ group: lower <= sum_{j in group} z_j <= upper
```
Последнее неравенство на x/n делает n = ceil(x/Q) даже при стоимости 0, включая x=0. Для недостижимых пар x=n=0. Группы замен задаются явно, перед solve проверяются конфликтующие фильтры/дубли.

Цель задана лексикографически, два независимых запуска:
1. min U = sum u_i;
2. при фиксированном **доказанном** минимуме U*, min L = sum L_ij*n_ij.
При равных U,L можно минимизировать число рейсов (явный третий tie-break) и стабильный ключ конфигурации отсортированных ID. Не менять смысл цели без версии. Для статуса оптимальности использовать обе фазы, не только последнюю. Если на первой фазе FEASIBLE, не утверждать U*, а сохранять приближённый incumbent и bounds, или вернуть честный partial. Стоимость движения при единой скорости и тарифе пропорциональна L, при иных данных отдельная политика цели; CAPEX/OPEX добавлять только с единицами и горизонтом. Возврат порожнего учтён, внутриплощадочный проезд и время работы не учитываются пока явно не добавлены.

## Несколько площадок и Top-K

**Быстрый точный вариант:** для небольшого N перечислить все сочетания подходящих кандидатов заданного количества k, учитывая fixed и replacementGroup. Для каждой конфигурации решить точное распределение. Матрица общая для всех. Сортировать по (U,L,stable id). Всего C(N,k) до учёта фильтров, задать лимит и сообщать число рассмотренных/всего. Когда exact solver и перебор завершены, topK точен **только в этом каталоге, графе и модели**, не во всём городе. Если один из наборов ещё не решён/таймаут — порядок provisional.

**Масштабируемая версия:** бинарные z_j в одном MILP/CP-SAT. После каждого optimum добавить no-good cut, исключающий **сам набор** z, а не отдельную аллокацию:
```
sum_{j:z*_j=1}(1-z_j) + sum_{j:z*_j=0} z_j >= 1
```
Для следующего ранга повторно минимизировать U затем L под новым ограничением. Не фиксировать U первого варианта для всех рангов, иначе пропадут альтернативы с меньшим обслуживанием (их можно оставить отдельно как deficit). Если требуется только полный вывоз — явный `requireAllServed=true`, вернуть fewer/no feasible, не вводить это молча. Детерминированный tie-break или канонический порядок идентификаторов; при невозможности доказать порядок равных решениям присвоить общий score/tie, не обещать строгую нумерацию.

Ручное отклонение одного земельного кандидата: `excludedSiteIds` исключает его из всех конфигураций. Отклонение связки кандидатов: `excludedConfigurations` запрещает только точный набор. Не блокировать хорошие объекты только за использование в одном отклонённом наборе. Если отклоняется площадка из fixed/mandatory — требуется зафиксированное изменение политики, ошибка конфликта до solve. Сохранить reason/source/reviewer/time отдельно, не менять данные исходной задачи. Новый результат связан с `parentScenarioHash` и новым хешем. При одинаковом наборе данных, новом exclusion и числе новых объектов оптимум не может улучшиться в модели (допустимое множество сужается); добиться полного вывоза может стать невозможно.

### Количество площадок
- 2 существующие + 2 новые: обе существующие `fixed`, `exactNewSites:2`, shortlist N (например 8, условно); 28 сочетаний до ограничений. N=2 — одно сочетание; точно так и сообщить.
- Перенос: существующая площадка optional, её текущее место и альтернативы входят в replacementGroup. Выбрать ровно один либо максимум один, если допустимо закрытие, явно. Отдельный exactNewSites по политике, не забывать, что перенос — не чистое добавление.
- С нуля: fixed пуст, exactActiveSites=2/3/4. Без existing не требовать фиктивной базы; baseline допускается null.
- Frontier: отдельные решения для k=0,1,2,3. Если добавление не имеет цены и использование необязательно, больший каталог не ухудшает минимальный U/L, поэтому из этой цели нельзя вывести экономически оптимальное количество объектов. Вывести предельный логистический эффект и оставшиеся неизвестные затраты. При одинаковом обслуженном объёме delta; если baseline deficit — не заявлять экономию километров на разных объёмах.

## Правовые/территориальные ограничения

Оптимизация и screening — независимые уровни. Не присваивать автоматически `approved`, даже при оптимальном маршруте. Проектный документ `docs/06_LEGAL_SCREENING.md` — стартовый чек-лист, не правовое заключение. Проверки: статус и назначение земли, права, актуальная редакция ПЗЗ, правила санитарного размещения снега, водные/охранные зоны и источники водоснабжения, наличие реагентов, инженерное покрытие/сток, въезды для тяжёлого транспорта, свободная ёмкость. Применимость конкретного требования проверяет специалист; не изобретать минимальные буферы метров. Слой данных имеет source/date/version/coverage, status `unknown|needs_review|documented|conflict|inapplicable`, решения reviewed_by/date. Режим exploratory — допускает unknown с яркой отметкой «требует проверки», запрещённые исключает. Strict — только предоставленный уполномоченным специалистом разрешённый набор, иначе no eligible sites. Скриннинг по одной доступной GIS-карте не заменяет комплект документов. Для rejected сохранять причину/область действия/срок и источник.

## Предложенный архитектурный разрез (не обязательны точные имена файлов)

```
src/
  routing.mjs               # сохраняется адаптер текущей сети
  optimizer.mjs             # старый compareSites, legacy heuristic
  core/
    validate.mjs            # схема + доменные проверки
    network.mjs             # нормализация snapshot, registry
    matrix.mjs              # построение и кеш L_ij
    model.mjs               # независимая доменная постановка
    optimize.mjs            # policy, topK, исключения, objective stages
    verify-result.mjs        # проверка инвариантов независимо от solver
    explain.mjs             # причины, сравнение, provenance
  solvers/
    heuristic.mjs           # прежний метод, marked fallback
    exact-adapter.mjs       # JSON к проверенному solver/worker
  server.mjs                # HTTP transport, не математика
  cli.mjs                   # независимый вход/выход JSON
solver/                     # при использовании Python: worker, pinned deps, tests
schemas/                    # JSON Schema request/response, версии
```
Математическое ядро не читает DOM, storage, URL и файлы внешнего окружения, принимает data. HTTP/CLI загружают dataset, проверяют и вызывают ядро. Из другого сервиса можно вызвать JSON API или библиотеку. Не требуется авторизация/БД/OAuth для локального MVP; при сетевом развёртывании отдельно auth, rate limits, безопасная конфигурация, отсутствие SSRF и произвольных путей. Сохранить bind localhost. Для тяжёлого solve отдельный worker/subprocess, ограничение времени, корректное завершение при отмене; не блокировать event loop. Не передавать произвольные команды через JSON.

### Маршрутная матрица и производительность

Один раз построить outgoing и incoming (reverse graph) для версии сети/закрытий/профиля. Для каждого источника Dijkstra outgoing даёт i→j, Dijkstra reverse даёт j→i, пути восстановимы с правильной ориентацией. Если разные профили — соответствующие отдельные матрицы. Complexity примерно O(|D|*(|E|+|V|)log|V|) для 2 направлений; можно оптимизировать по меньшему множеству источников/площадок. Не хранить все геометрии во всех комбинациях. Для solver — sparse cost matrix + reachability. Ключ кеша: graph hash, profile hash, closures and validity period, ordered nodes, distance units/algorithm version. TTL/memory bounds. Граф не `null` и не недостоверные расстояния 0. При coincident nodes — explicit same_node flag или disallow по политике, объяснить, что реальная длина подъезда не учтена. Сохранять raw/source coordinates и snap distance, не сливать кандидатов произвольно.

## HTTP / CLI v1 (проект контракта)

Сохранить GET `/api/health`, `/api/demo`, `/api/network`, POST `/api/compare` как legacy (документировать подход). Новый endpoint POST `/api/v1/optimize` принимает версионированный JSON, не путь к произвольному файлу. Сеть по зарегистрированному `networkId` + `networkVersion` + `networkHash`. Сеть можно заранее загрузить/зарегистрировать через CLI. Для разных систем — versioned schema.

Ниже **пример запроса**, идентификаторы берутся из старого учебного сценария; capacities намеренно условны. Для ровно двух новых есть всего одна комбинация. Добавить больше проверенных кандидатов для осмысленного topK.

```json
{
  "schemaVersion":"1.0",
  "networkId":"pkgo","networkVersion":"pkgo-27233df581c6",
  "networkHash":"0e0a464f7d92057fa5bbad634c083ad0c1923294597d989ead386b393acf7ad2",
  "scenario":{"id":"demo-two-additions","mode":"scenario_only","horizon":{"type":"event","label":"учебный снегопад"},"demands":[{"id":"D1","nodeId":"12829246567","volumeM3":46,"sourceStatus":"synthetic"}],"sites":[{"id":"S0","accessNodeId":"2415413202","availableCapacityM3":150,"origin":"existing","role":"fixed","screening":{"status":"unknown"}},{"id":"S1","accessNodeId":"2024634569","availableCapacityM3":130,"origin":"existing","role":"fixed","screening":{"status":"unknown"}},{"id":"C1","accessNodeId":"13610177839","availableCapacityM3":100,"origin":"candidate","role":"optional","screening":{"status":"unknown"}},{"id":"C2","accessNodeId":"5883116640","availableCapacityM3":100,"origin":"candidate","role":"optional","screening":{"status":"unknown"}}],"truck":{"bodyM3":10,"payloadKg":5000,"snowDensityKgM3":500,"driveKmh":20},"closedEdgeIds":[]},
  "policy":{"mode":"add","exactNewSites":2,"topK":5,"excludedSiteIds":[],"excludedConfigurations":[],"screeningPolicy":"exploratory","objective":"min_unserved_then_distance","timeLimitMs":5000}
}
```

Выход (поля, не поддельный результат):
```
{
  schemaVersion, scenarioHash, parentScenarioHash?, networkVersion, networkHash,
  solver: {name, version, status, stages, timeMs, gap?, bounds?, limits},
  search: {catalogSize, eligibleSize, configurationsTotal?, evaluated, proven, topKRequested, topKReturned, rankingStatus, coverage},
  baseline: Solution | null,
  alternatives: [Solution],
  excludedSites: [{id,reason,sourceRef?}],
  assumptions: [string], warnings: [{code,message}]
}
Solution = {
  configurationId, activeSiteIds, newSiteIds, relocatedGroups,
  status, servedM3, unservedM3, transportDistanceMm, transportKm, trips,
  assignments: [{demandId,siteId,volumeM3,trips,tripCapacityM3,roundtripMm,routeRef}],
  siteUtilization, unservedReasons, estimatedDriveMinutes, estimatedDriveCostRub?,
  screeningStatus, unresolvedChecks, comparableToBaseline, deltaKm?, deltaKmPercent?
}
```
`coverage`: finite_catalogue | restricted_catalogue | sampled. `rankingStatus`: exact_top_k | provisional | infeasible | incomplete; solver status: optimal | feasible | infeasible | time_limit | invalid | error | no_solution. `optimal` только при доказанном полном поиске и обеих ступенях в заявленной модели; solver может сообщить локальный exact assignment при неполном переборе, тогда общий ranking provisional. `gap` и bounds уточнять для каждой ступени (пара U,L не один произвольный %). Цвета/UI не должны преобразовать `feasible` в `optimal`. `topKReturned<requested` — причина: finite set exhausted, rejected, timeout, no full-service solutions.

Errors: HTTP 400 syntax, 415 media type, 413 size, 422 domain/schema violation with path/code, 409 network version mismatch, 429/503 busy if bounded, 500 internal; timeout either typed incomplete result or defined job status (not fake success); `infeasible` valid mathematical result not exception. CLI accepts same JSON; outputs JSON on stdout, debug stderr, exit codes documented. Keep v1 response small; route geometry endpoint/function by routeRef+network hash if required. For safety, no network fetch or arbitrary file paths in user request.

## Независимая verification после solver

Для каждой config проверить fixed/exclusions/groups/counts, sums D/C, x≤Qn, x≥Qn−Q+1, reachability, distance from matrix, aggregate trips/km/cost, exact statuses, same input hash. Проверить finite values и safe integers. Solver stderr/error не превращать в 0 km. Валидация результата независима от алгоритма. Сохранить вход, версию модели, solver/options, контрольную сумму, результат и screening в отчёте. Reproduce with same versions, seed, deterministic rounding; при timeout exact order не гарантировать.
