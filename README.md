# SnowSite — оптимизация размещения снегоприёмных площадок

[![CI](https://github.com/rust08/SnowSite-Kamchatka/actions/workflows/check.yml/badge.svg)](https://github.com/rust08/SnowSite-Kamchatka/actions/workflows/check.yml)

Самостоятельный локальный продукт: выбор площадок из конечного каталога, целочисленное распределение снега, проверяемый пробег и альтернативы. Не реестр действующих полигонов, не правовое заключение, не VRP/расписание парка. Все входные объёмы/площадки демо синтетические; сеть Камчатки — фиксированный снимок OSM. **«Север» не нужен для запуска.**

**v4.10.1 (стабилизация R01–R05; математическое ядро без изменений)** · API JSON v1.0 · Node.js 22+ · Python 3.13 + SciPy. [Статус](docs/STATUS.md) · [Архитектура репозитория](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Алгоритм](docs/ALGORITHM.md) · [История](CHANGELOG.md) · [Handoff](docs/HANDOFF.md) · [Актуальный план и блокеры](docs/07_IMPLEMENTATION_PLAN.md).

## Быстрый старт

Распакуйте проект в обычную папку. Из корня проекта:

```sh
node -v
python -m pip install -r workers/milp-python/requirements.txt
npm run check
npm test
npm start
```

Linux/macOS: при необходимости `python3` вместо `python`; для venv укажите путь к Python через `SNOW_PYTHON`. Windows PowerShell: `$env:SNOW_PYTHON='C:\path\to\python.exe'`. `START.bat` запускает локальный сайт; для точного режима по умолчанию и полных тестов требуется Python. Без Python вручную выберите legacy. Сервер слушает 127.0.0.1:8793; при занятом порте задайте `PORT`.

- `http://127.0.0.1:8793/` — основная карта с точным Top-K по умолчанию, выбором количества площадок, переносом, отклонениями и экспортом результатов. Legacy — отдельный явно приблизительный режим. Исторические скриншоты и walkthrough: [LEGACY_UI_GUIDE](docs/LEGACY_UI_GUIDE.md).
- `http://127.0.0.1:8793/exact.html` — отдельный точный JSON-интерфейс (safe preset), без подмены solver эвристикой.
- `POST /api/v1/optimize` — независимый API; `GET /api/v1/networks` — доступные ID/version/hash.

## CLI и библиотека

```sh
node apps/cli/cli.mjs examples/demo-v1.json
node apps/cli/cli.mjs examples/v47/demo-bounded.json
node apps/cli/cli.mjs --network examples/v43/network.json --network-id synthetic-v43 examples/v44/add-2-plus-2.json
node examples/v45/integration.mjs
```

Публичные Node exports внутри приватного пакета: `snowsite-kamchatka` (optimize, safeRequest, exclusionRerun, inputFingerprint, DomainError), `snowsite-kamchatka/catalog` (каталог и evidence), `snowsite-kamchatka/network-file` (локальный доверенный файловый адаптер). Внутри проекта и в интеграционном примере работают через package self-reference; внешняя публикация npm не выполнена. Пример использует уже загруженный snapshot, без HTTP и браузера. API v1.0 сохраняется, пакет 0.3.0 не равен номеру выпуска продукта.

Для нескольких графов зарегистрируйте их при старте, не передавайте в запросе путь или URL. Linux/macOS: `SNOW_NETWORK_REGISTRY=examples/v44/registry.json npm start`. PowerShell: `$env:SNOW_NETWORK_REGISTRY='examples/v44/registry.json'; npm start`. Пример запроса: `examples/v44/add-2-plus-2.json`. Интеграционный контракт, ошибки, параметры и примеры в [API](docs/API.md).

## Возможности и ограничения

| Возможность | Реализация |
|---|---|
| Распределение и поездки | Целочисленные объёмы, число рейсов, минимум остатка затем пробега |
| Выбор площадок | add/relocate/greenfield/evaluate/frontier, фиксированные/исключённые, группы переноса, Top-K |
| Стратегии | enumeration (default), unified_milp или bounded_enumeration (доказуемое отсечение по нижней границе); проверяемый partial при timeout |
| Физические ограничения | ёмкость, лимит рейсов, снеговые типы, supplied loaded/empty profiles, подтверждённый внутриплощадочный пробег |
| Каталог | 11 исторических зацепок, 0 автоматически допущенных; локальные GeoJSON Polygon и scoped evidence |
| Интеграция | JS facade, CLI, HTTP, реестр версий графов; независимый checker |

В точном городском демо 228 м³ обслужено; точная база 159.425990 км, база + C1 108.556350, + C2 122.648320, + обе 92.228770 км. Это одна конфигурация 2+2 и синтетический результат, не экономия города. Смотрите неизменяемый аудит и фактические benchmark files. Не сравнивайте километры при разных обслуженных объёмах. Никакой автоматической юридической сертификации. Нет реального реестра площадок, очередей/смен/погрузки, полной модели стоимости и проверенного грузового допуска; неизвестное не заменяется нулём. Границы площадок не дают автоматически площадь/ёмкость/въезд/допуск. На фиксированном синтетическом benchmark seed719 (20 источников, 30 площадок, 378 наборов) `bounded_enumeration` доказал полный Top-5 за 1,79–2,06 с в трёх прогонах; 16 решённых + 362 отсечённых. Это не гарантия для произвольного графа/каталога. Читайте `solver.status`, `search.rankingStatus`, `search.proven`, `search.prunedByBound` и stage bounds. Старый default не менялся; новые стратегии opt-in.

## Отложенный сбор фактических данных

По текущей оценке владельца, готовый реестр площадок и геометрия пока не будут предоставлены. Самостоятельный поиск и проверку открытых источников, перечень полей, правила геопривязки, будущие GIS-задачи и критерии приёмки зафиксировали в [DEFERRED_SITE_DATA_PLAN](docs/DEFERRED_SITE_DATA_PLAN.md). Статус A08-DATA / S5-SITES — WAIT_DATA / DEFERRED_RESEARCH, возвращаемся по отдельному запросу. Это не блокирует техническую разработку на синтетике. Новых реальных объектов не добавлено.

## Разработка и устройство проекта

```text
apps/
  api/             # HTTP, registry, isolated request worker
  cli/             # JSON command-line adapter
  web/             # exact map, explicit legacy mode, advanced JSON UI
packages/
  contracts/       # domain constraints, hashes, schemas/
  optimization/    # exact and legacy solver orchestration; independent checker
  routing/         # directed graph, matrix/cache, operator file adapter
  catalog/         # evidence, geometry and explicit SiteRecord adapter
workers/
  milp-python/     # local SciPy/HiGHS, pinned dependencies, process adapter
data/
  snapshots/       # immutable OSM snapshot and attribution
  fixtures/        # synthetic demo
  evidence/        # source-scoped historical leads (not approved sites)
examples/          # synthetic requests, integrations and second graph
tests/             # independent oracle, regression, contracts and boundaries
tools/             # checks, benchmark, import, browser and release tools
docs/              # architecture, handoff, immutable audits and benchmark logs
src/               # compatibility import / command wrappers only
solver/            # compatibility requirements and worker launcher
```

[ARCHITECTURE](docs/ARCHITECTURE.md) describes the **implemented** R1–R4 modular monolith and outstanding requirements. [CODE_MAP](docs/CODE_MAP.md) locates canonical implementations; [CONTRIBUTING](CONTRIBUTING.md) describes the review/release workflow. Public Node imports, HTTP URLs and old `node src/cli.mjs`, `node src/server.mjs`, `START.bat` and `python -m pip install -r solver/requirements.txt` commands remain available. Direct paths to raw data and schemas moved (see [data index](data/README.md)); no duplicate snapshots.

Linux regression v4.7: 103/103 tests (97 prior + six v4.7). The v4.6 migration had 97/97 and four architecture tests. 24 relocated payload files (UI/data/schemas/MILP worker and pins) match v4.5 byte-for-byte. Browser smoke повторно запущен в v4.8, Chromium navigation blocked by environment policy; фактическая браузерная приёмка BLOCKED_ENVIRONMENT; Windows и GitHub Actions приостановлены владельцем. CI defines Ubuntu/Windows matrices for unit/integration/schema and actual browser smoke, plus manual dispatch; remote CI not executed. `npm run check:manifest` verifies packaged release bytes. `node tools/benchmark-v47.mjs <unique-label> bounded_enumeration` воспроизводит новый benchmark (без аргумента стратегии — все три). Результаты v4.6 исторические; актуальная проверка v4.10.1 в [STATUS](docs/STATUS.md) и [benchmarks/v4101](docs/benchmarks/v4101/acceptance.md).

## GitHub и история

SnowSite размещается как независимый компонент `shared/snowsite/` общего репозитория algorithms-kamchatka. Для автономной разработки используйте отдельную копию SnowSite. Восстановите текущую ветку из history.bundle (не `git init`). См. [GITHUB_SETUP](docs/10_GITHUB_SETUP.md); Интеграционные изменения отправлять отдельными PR, не перезаписывать чужие файлы. Внутри ZIP сохранены CHANGELOG и полный журнал сессий; Git bundle передаётся отдельно. Проверяйте отсутствие закрытых данных и лицензии перед отправкой. Не используйте репо «Север».

## Лицензии и происхождение данных

Дорожные данные: © OpenStreetMap contributors, ODbL 1.0; [CITY_SOURCES](data/snapshots/pkgo-27233df581c6/CITY_SOURCES.md), [DATA_PROVENANCE](docs/05_DATA_PROVENANCE.md). Leaflet BSD-2-Clause, `apps/web/vendor/leaflet-LICENSE.txt`. Подложка рельефа и векторный слой `apps/web/city-context.js` из ранее подготовленных материалов «Севера», атрибуции Mapzen/Tilezen и исходных данных в CITY_SOURCES. До публикации соблюсти обязательства повторного распространения; лицензия исходного кода SnowSite определяется владельцем отдельно. Нет доступа к закрытой БД/телематике.

### Дополнительная проверка контрактов и браузера

```sh
python -m pip install -r tools/contract-requirements.txt
npm run test:contracts
python -m pip install -r tools/browser-requirements.txt
python -m playwright install chromium
npm run test:browser
```

`test:contracts` проверяет все шесть локальных JSON Schema и 30 положительных/отрицательных проверок экземпляров, включая свежие ответы CLI на двух графах, без загрузки сторонних схем. Это dev/CI зависимости, не требуется для solver. В Linux пройдено; фактическая Windows/браузерная приёмка остаётся открытой. В Linux CI Playwright использует `--with-deps`; Windows — обычную установку Chromium. После размещения репозитория владелец может запустить workflow вручную, сохранить реальные логи и только затем отметить соответствующую внешнюю проверку пройденной. Пока Windows/CI не входят в активный план.

### Единый отчёт приёмки (v4.8)

После установки dev-зависимостей из шагов выше:

```sh
python tools/acceptance.py --mode core --output runtime/acceptance-core
python tools/acceptance.py --mode browser --output runtime/acceptance-browser
```

Можно выбрать `--mode all` для обоих наборов. У каждого запуска должен быть новый каталог; существующие отчёты не перезаписываются. `report.json` содержит версии среды, статусы и ссылки на сырые логи. `not_run` не означает PASS; любой сбой выбранного gate возвращает ненулевой exit code. В CI отчёты сохраняются отдельными artifacts для Linux/Windows, даже при ошибке. Скрипт ничего не скачивает и не публикует. Перед релизом проверяется манифест именно текущих байтов. `.gitattributes` защищает их от автоматической конвертации строк Git, включая исходные исторические файлы.

Проверена установка приватного SDK из локального npm-архива в независимый проект без доступа к registry; пример и команды: [external SDK smoke](examples/v48/README.md).

**Историческая приёмка v4.8:** локальная приёмка 104/104 теста, граф, 6 схем / 26 экземпляров, внешний SDK и checkout с имитацией autocrlf=true успешно проверены. Подробные отчёты: [v4.8 acceptance](docs/benchmarks/v48/acceptance.md). Реальная Windows/браузерная приёмка остаётся открытой, R5 ожидает требований, S5 — данных. Математическая модель и конечный каталог синтетики не изменены.

## Актуальный план и оставшиеся блокеры (v4.10.1)

План [07_IMPLEMENTATION_PLAN](docs/07_IMPLEMENTATION_PLAN.md) сводит исходные задачи S0–S5, R0–R5 и критерии обоих аудитов; новые задачи не добавлены. Дополнительно проверены HTTP cancellation (B07), missing Python failure и recovery (B21), компактное назначение миллиона рейсов и превышение лимита (B09). См. [фактический отчёт](docs/benchmarks/v481/acceptance.md).

Отложено: Windows/GitHub Actions (решение владельца; его локальный Windows запуск — по его сообщению, не формальный PASS), фактические browser interactions (Chromium policy), S5/A08-DATA и GIS (без исследования), R5 (нет требований к развёртыванию, в том числе лимитам Python RSS). Согласованная синхронизация карты с точным API завершена в v4.9, UX-доводка по запросу владельца — в v4.10. Не начинать новых задач без решения владельца.

**Итог v4.8.1:** 107/107 тестов, 6 схем и 26 проверок, pinned graph PASS. Предыдущие интеграционные и математические эталоны сохранены.

### Демонстрация точной карты (v4.10.1)
1. Откройте `/` после установки Python-зависимостей; исходный сценарий автоматически рассчитает Top-K для одной новой площадки.
2. Установите число новых площадок 2, нажмите «Пересчитать». Для выбора из шести условных кандидатов нажмите «Демо: 2 + 2 из 6» и подтвердите замену сценария. Top-5 рассчитывается автоматически. То же демо можно импортировать из `examples/v49/map-editor-2plus2.json` через «Изменить условия → Файл».
3. Переключайте варианты, отклоняйте кандидата или конкретную комбинацию с причиной и скачивайте историю. В редакторе задавайте альтернативу существующей площадке. Для greenfield удалите все existing и выберите число активных мест.
4. Advanced JSON, грузовые профили и полная модель evidence — `/exact.html`, пример `examples/v49/map-api-2plus2.json`. Карта не отбрасывает расширенные условия молча. Ограничения карты сценарные, статус земли unknown. Нет автоматического fallback при ошибке/таймауте MILP. Браузерная визуальная приёмка остаётся открытой.

Локальная регрессия v4.10: 114/114 Node tests, 6 JSON Schema / 30 проверок экземпляров, городской граф прежний. Реальный HTTP и harness событий DOM/Leaflet — PASS; визуальная проверка размеров, интерактивного Leaflet и доступности в настоящем Chromium ещё не выполнена. [Отчёт](docs/benchmarks/v410/acceptance.md).

Пересчёт и отмена находятся перед результатами, карта остаётся рядом при прокрутке на широком экране; на узком экране панели идут последовательно. Выбор альтернатив клавишами стрелок, Enter/Space; активный вариант сохраняет фокус. Номера предварительного рейтинга не равны доказанному Top-K. На JSON-странице можно скачать исходный результат API.

### Стабилизация v4.10.1

Legacy API и модуль отклоняют unsupported advanced constraints с `422 unsupported_model` и путём поля; 0 и пустой список допустимых типов снега не считаются отсутствием ограничения. Для таких сценариев нужен точный v1 API. Импорт карты сверяет явно заданные root/meta networkVersion и networkHash с текущим snapshot, не изменяя сценарий/настройки/результат при отказе. У старых файлов без полной привязки проверяются узлы на текущем графе и явно показывается неопределённость. Экспорт связывается с текущим графом, отдельно записывается статус исходной привязки. Скорость 0.1–200 км/ч, целые объём кузова/нагрузка/плотность 1–1e6, тариф 0–1e7, payload+density вместе либо оба пусты, ID не длиннее 200. См. [REVIEW_FIX_REPORT](REVIEW_FIX_REPORT.md) и [приёмку](docs/benchmarks/v4101/acceptance.md).
