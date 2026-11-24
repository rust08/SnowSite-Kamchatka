# Snow Control — agent entry point (AgentOps 02 proposal)

**Current active authority:** read `agent-workflow/START_HERE.md` and `agent-workflow/state/current.json`, then `agent-workflow/state/task.json`. The immutable accepted H01 source is separate from this organizational overlay. No code GO at migration. Historical instructions below describe earlier versions; old GO, commands and Git restoration are not permission to restart tasks. If current files or owner instruction conflict, stop and report. Do not assume Git HEAD from a ZIP.

Read the applicable skill in `.agents/skills/` on demand. Run executable checkpoints in `agent-workflow/hooks/gate.py`. Never claim native hooks ran unless observed. Review and engineering are separate roles; only owner approves new scope. Do not publish private notes or data. Do not change historical decisions or tests to manufacture a PASS.

---
Historical original AGENTS.md preserved below, subordinate to current approved scope:

# SnowSite — рабочие правила для Codex (read this first)

**Миссия:** самостоятельный продукт для сравнения логистики снеговывоза и потенциальных снегоприёмных площадок. **Не менять «Север» и не зависеть от его рабочего сервера/БД.**

0. Для v4.10.1 сначала `docs/STATUS.md` → `docs/HANDOFF.md` → `docs/07_IMPLEMENTATION_PLAN.md` → `CHANGELOG.md`, затем `docs/backend-review-v42/00_START_HERE.md` и релевантное ТЗ. Сверить код/тесты/git; не повторять завершённые S0–S3. Не смешивать legacy и exact. Структура apps/packages/workers уже реализована; src/ — адаптеры совместимости. Перед рефакторингом читать docs/ARCHITECTURE.md и CONTRIBUTING.md.
1. Первый вход (исторический): `docs/00_CODEX_START_HERE.md` → `docs/07_IMPLEMENTATION_PLAN.md` → относящиеся к задаче документы. Не читать все docs и старые ZIP без причины.
2. Источники: `data/snapshots/pkgo-27233df581c6/city-network.json` — копия OSM-снимка «Севера» (версия `pkgo-27233df581c6`, 19.11.2026), а не полный официальный дорожный паспорт. `npm run check` контролирует точную копию.
3. **Никаких вымышленных фактов:** реальные полигоны, координаты, вместимость, цены, скорости, названия подрядчиков и правовой допуск без документов не придумывать. Вымышленное помечать `scenario_only`.
4. Два результата считать отдельно: **логистическое качество** и **документальная допустимость**. Дорожная близость не доказывает, что территория подходит для хранения снега. JSON-поле `legalStatus` не может подтвердить допуск.
5. Сохранить базовые инварианты: направленный путь туда и обратно, запреты `routable:false` и ручные перекрытия; грузоподъёмность, плотность, объём кузова; суммарные объёмы; объяснение нераспределённого снега. Сравнивать одинаковые входные данные и набор закрытых дорог.
6. Сначала запуск `npm run check && npm test && npm start`. После любых изменений — тесты и контрольный реальный городской граф.
7. Уже есть рабочий **стартовый**, не производственный solver (`packages/routing/engine.mjs`, `packages/optimization/legacy.mjs`) и UI. **Не переписывать с нуля**, если можно расширить; тестировать замену solver против малого точного oracle.
8. Возможны готовые решения: Leaflet уже vendored; OR-Tools/NetworkX/OSRM/GraphHopper/Turf/Geospatial только при измеримой пользе и после проверки лицензии, требований, доступности и reproducibility. Не внедрять Python+Node+Postgres+Docker одновременно ради моды.
9. У проекта нет доступа к контрактам, закрытым телематическим данным или сведениям кадастрового обследования. Не добывать персональные данные; не публиковать закрытые заметки интервью.
10. Перед каждым PR: перечислить изменения, оставшиеся допущения, команды тестов, демонстрационный сценарий и ограничения. Обновлять `docs/11_DECISIONS.md` при существенном решении.
11. UI: карта — центральный элемент, кандидаты и источники должны быть визуально различимы, юридический статус всегда явно виден. Никаких ложных утверждений «сэкономлено X рублей городу».
12. Репозиторий отдельный, рекомендуется private. Публикация под ODbL требует атрибуции и выполнения обязательств распространяемой дорожной базы.

13. A08-DATA / S5-SITES: отложенный поиск фактических площадок и GIS — `docs/DEFERRED_SITE_DATA_PLAN.md`. Возобновлять по явному запросу владельца, не считать отсутствие внешних данных блокером остальных технических задач.

14. С v4.8.1 режим владельца: новые задачи не добавлять, закрытые не повторять. Windows/GitHub Actions PAUSED_BY_OWNER, браузер BLOCKED_ENVIRONMENT, исследование WAIT_DATA/DEFERRED_RESEARCH, R5 WAIT_REQUIREMENTS. Остаточные критерии B07/B09/B21 проверены локально. Не создавать ещё одну версию без воспроизводимого дефекта либо явного снятия существующего блокера.

15. v4.9: основная карта использует точный API и bounded_enumeration по умолчанию; legacy только явный выбор, не fallback. Advanced evidence-bearing JSON — exact.html. Сохранить независимую проверку геометрии, не заявлять настоящий E2E на основе DOM harness. PR обновляет только shared/snowsite/.

16. v4.10: UX по разрешению владельца, без смены математического ядра. Карта/легенда, ранний пересчёт, список альтернатив, демо из existing fixture, JSON tool. Не повторять косметические итерации без воспроизводимого дефекта/запроса владельца. Browser visual gate открыт; Windows/CI не запускались. Следующий PR должен включить v4.9 + v4.10 от объединённой v4.8.1, не накладывать оба патча.

17. v4.10.1: только точечная стабилизация R01–R05 по независимому аудиту v4.10. После проверок остановиться и передать сборку на независимое ревью. Legacy явно отклоняет значимые неподдерживаемые ограничения (422 unsupported_model), импорт проверяет исходный snapshot до commit состояния, формы используют канонические truck limits. Не применять cumulative v4.10 patch поверх v4.10. Новые платформенные задачи и реальные данные не открывать автоматически.
