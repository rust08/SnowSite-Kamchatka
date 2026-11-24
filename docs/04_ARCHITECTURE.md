> Историческая архитектура v0.1. Фактическая реализованная структура v4.8.1 — [ARCHITECTURE.md](ARCHITECTURE.md). Старые пути ниже сохраняются как свидетельство истории, не как инструкция к новому переносу.

# Техническая архитектура без лишнего стека

## Текущая структура

```text
SnowSite-Kamchatka/
  AGENTS.md
  README.md
  src/
    routing.mjs         # направленный Dijkstra, кэш shortest trees
    optimizer.mjs       # сценарное распределение, baseline-vs-candidate
    server.mjs          # Node HTTP, только localhost
  data/
    city-network.json   # OSM derived database snapshot, 5.4 MB
    scenario.demo.json  # все точки и параметры искусственные
    CITY_SOURCES.md     # provenance и лицензии
  public/
    index.html, app.js, style.css
    terrain-map.webp
    vendor/leaflet.*     # сохранена BSD лицензия
  tests/              # node:test, маленькие графы
  tools/check-data.mjs
  docs/               # индекс задач и доказательная политика
  .github/workflows/  # CI
```

## API 0.1 (локальное)

`GET /api/health` → `{ok, version, networkVersion}`

`GET /api/network` → OSM graph JSON с `nodes`, `edges`, attribution и версией. В локальном демо допустимо. Перед публичным размещением — кэш, размер, ограничения доступа.

`GET /api/demo` → синтетические исходные точки, грузовой парк и кандидаты.

`POST /api/compare` → JSON одного сценария с `demands`, `sites`, `truck`, `closedEdgeIds`, `snowDensityKgM3`. Возвращает `{baseline, variants, rankBasis, notice}`; каждая запись содержит `assignments` с двумя путями, `unservedM3`, `servedM3`, `trips`, `transportKm`, `estimatedDriveMinutes`, `estimatedCostRub` (nullable), `siteUtilization`.

**Endpoint не сохраняет входные данные и не выдаёт подтверждений о землепользовании.** Сервер прослушивает только `127.0.0.1`.

## Развитие после Day-1

Отделить доменные модели: `DemandPoint`, `CandidateSite`, `SiteEvidence`, `TruckProfile`, `RouteConstraint`, `Scenario`, `AssignmentResult`. Ввести версии сценариев, provenance каждой точки, экспорт GeoJSON, а затем интерфейс управления ограничениями.

Большие данные: 12k edges можно держать в памяти и рисовать canvas; если UI тормозит — рассмотреть vector tiles/Simplification/Grid bucketing, но не внедрять полный GIS сервер заранее.

Будущая временная модель: очереди, ограниченная пропускная способность постов разгрузки, погрузчики, диспетчеризация и разная загрузка дорог. Это НЕ свойства текущего solver.

## Проверки и безопасность

- Выходящие сети для запуска не нужны. Локальная демонстрация — основная цель.
- `POST` ограничен 1 МБ; >50 источников или >30 площадок не принимать без оптимизации.
- Не доверять клиентским данным о допустимости участка или официальном статусе площадки.
- HTML ввод рендерить через `textContent`, не внедрять `innerHTML` из пользовательского ввода.
- Конкретные данные чиновников и договоров с персональными контактами не отправлять в публичный репозиторий.
- Настройка для деплоя на общий сервер требует отдельного security audit: auth, limits, CSRF/CORS, logs и privacy.
