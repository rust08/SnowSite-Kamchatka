# SnowSite v4.10.1 — отчёт разработчика по R01–R05

**Вердикт разработки:** FIXED_LOCAL, передать на независимое ревью. Не считать этот отчёт самостоятельным внешним аудитом или подтверждением реальной эксплуатации. База v4.10, SHA-256 исходного ZIP `474ab2d08c9d4604bb51851da9e634c87cbe2ee953eae81dc52f6f8c3ebbd9b1`; восстановлена оригинальная история, родитель `7fbf0de40b6d874b411e7cf2dba201b26ff49d03`. Архив совпал с деревом родителя, 355/355 manifest. Рабочая ветка локальной сборки `work/v4.10.1`. Идентичность релиза (commit/tree/SHA) указана в отдельном release identity. Remote PR не проверялся.

## R01–R05: изменение, доказательство, статус

| ID | Пути | Изменение и подтверждение | Статус |
|---|---|---|---|
| R01 | `packages/contracts/validate.mjs` | `rejectUnsupportedLegacy` в canonical `validateLegacy`: typed 422 `unsupported_model`, path. 0 и `[]` значимы, known snow types запрещены в legacy, null/unknown нейтральны. Non-null advanced envelope/policy/map settings, profiles, screening, internal-distance/evidence и поля выбора/доступа отклоняются; описательные метаданные не изменяют эвристику. Module+actual HTTP: три исходных контрпримера 422 против прежних 200/228/26; exact 200/0/0 по всем трём, обычный legacy 200/228/26. | PASS_LOCAL |
| R02 | `apps/web/lib/exact-map.js`, `apps/web/app.js` | Общий `validateMapNetworkBinding` проверяет корневые и вложенные version/hash (включая конфликт, явное пустое/некорректное значение), hash сверяется с trusted active health. `sanitizeScenario` сохраняет предоставленную подтверждённую привязку, не выдумывает её для старых файлов. Санитизация и `normalizeSettings` до mutation; import error не изменяет scenario/settings/result. DOM+HTTP harness проверил отказ и сохранение состояния, успешный import current, статус исходной привязки, экспорт. | PASS_LOCAL_HARNESS |
| R03 | `apps/web/lib/core.js` | `JSON.stringify([demandId,siteId])`, пары с `|`, кавычками и Unicode различимы, повторные рейсы корректно агрегируются. Исходный repro возвращает 2 строки, а не 1. | PASS_LOCAL |
| R04 | `apps/web/lib/core.js` | При безопасном max — обычный monotonic max+1, при MAX_SAFE_INTEGER — ограниченный поиск среди N+1 номеров для N занятых строк. Subprocess с timeout=1200 ms для исходного и более плотного каталога: завершается, ID уникален. | PASS_LOCAL |
| R05 | `packages/contracts/validate.mjs`, `apps/web/lib/contracts/validate.mjs`, `apps/web/lib/core.js`, `apps/web/lib/exact-map.js`, `apps/web/app.js`, `apps/web/index.html` | Канонические truck bounds и `truckCapacity`, без изменения правил v1; браузер пользуется существующим allowlist, Node — относительным bridge. HTML min/max/step; скорость 0.1–200, кузов/нагрузка/плотность целые 1–1e6, тариф 0–1e7, paired null и capacity >=1. Ввод не отправляется до полной проверки. ID <=200, не обрезаются. Табличные тесты минимум/максимум, за границами/пусто, IDs 200/201, paired fields и harness. | PASS_LOCAL_HARNESS |

`tests/v4101-stabilization.test.mjs`: новый набор из 7 тестов. Добавлен до изменения production source, все 7 падали на исходниках (exit 1); после изменения все 7 PASS (exit 0). Старые 114 тестов сохранены. Исходный независимый `reproduce.mjs` повторён до и после, лог не заменён. Тесты включают отличные от исходного репродуктора случаи (14 типов advanced input, конфликт root/meta version/hash, кавычки и Unicode, плотный каталог, табличные truck bounds, атомарность import в served DOM harness).

## Фактический gate

| Проверка | Итог |
|---|---|
| `npm test` | 121/121 PASS, 0 fail, 0 skip, exit 0, 44.026 s |
| `npm run check` | 9983/12354, pinned snapshot и SHA совпали, PASS |
| `npm run test:contracts` | 6 схем / 30 instance checks, PASS |
| `node apps/cli/cli.mjs examples/v49/map-api-2plus2.json` | exact_top_k, 15 конфигураций, 228 м³, baseline 159.425990 км, Top-5 70.508430 / 71.054490 / 78.682230 / 84.600400 / 90.254310 км, all 228 м³ |
| Оригинальные репродукторы | Все 5 групп, 7 JSONL строк — после фикса ожидаемое поведение |
| `git diff --check`, `node tools/generate-manifest.mjs`, `npm run check:manifest` | Release-only checks зафиксированы отдельно в release evidence/identity; manifest генерируется из staged files и проверяется на извлечённом ZIP. |

Среда Linux, Node 22.16.0 / Python 3.13.5 / NumPy 2.3.5 / SciPy 1.17.0. Полные логи: `docs/benchmarks/v4101/evidence/`; описание команд и ограничения: `docs/benchmarks/v4101/acceptance.md`. Числа CLI относятся к прежнему синтетическому fixture, не к реальному городу.

## Scope и ограничения

Без изменения algorithms/MILP, routing, graph, worker, SDK exports, JSON schemas, data/fixtures, каталога, зависимостей, workflow, «Севера», других команд. Обновлены живые docs, CHANGELOG и manifest. Старые логи/аудиты не переписаны. Legacy по-прежнему heuristic; v1 default и no-fallback сохранены. Map-only положительный объём источников и уникальный узел площадки — прежние ограничения редактора, не претензия на полную поддержку всех входов v1. Связь экспортируемого файла с текущим snapshot не доказывает прежнее происхождение документа или правовой допуск площадки.

## Remaining blockers / stop

- Actual browser `BLOCKED_ENVIRONMENT`: настоящий Chromium не запускался, harness не подменяет визуальную/браузерную проверку.
- Windows/CI/publish `PAUSED_BY_OWNER`. Remote HEAD/PR не сверялись, push/merge не выполнялись.
- S5/A08-DATA `WAIT_DATA / DEFERRED_RESEARCH`; R5 `WAIT_REQUIREMENTS`. Реальных данных не добавлено и не исследовано.
- R01–R05 NOT_DONE: нет среди заявленных локальных критериев; независимое review pending. Не открывать новые задачи, не создавать новую версию без решения ревью/владельца.

## Передача

Полный ZIP v4.10.1, минимальный incremental diff от точной v4.10, history bundle с реальной историей, отдельный review handoff с исходным ТЗ/repro/evidence + новой evidence/identity, обновлённый Master Context. Для локального восстановления: `git clone -b work/v4.10.1 SnowSite-v4.10.1-history.bundle SnowSite-Kamchatka`. Если интегрировать в командный репозиторий, сначала проверить фактический текущий PR, чистое состояние, идентичность базовых файлов и `git apply --check --index --directory=shared/snowsite <incremental.patch>`. Старый cumulative v4.8.1→v4.10 повторно не накладывать. Независимое ревью: SHA/manifest/diff, исходный repro, новые контрпримеры, core/contract/city gate, per-ID вердикт. Не push/merge автоматически.
