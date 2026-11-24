# Приёмка и передача следующему агенту

## Acceptance checklist
| ID | Сценарий | Ожидается |
|---|---|---|
| A00 | исходный проект | 54 прежних теста PASS или документированная причина изменения; pinned hash города сохранён |
| A01 | add 2 существующие + 2 из 6 | оба existing сохраняются в каждом наборе, минимум 15 комбинаций если нет иных ограничений; exact topK oracle на малом графе |
| A02 | relocate | точно заданная группа и число, неподвижный объект не переносится; неизвестная площадка не включается по умолчанию |
| A03 | exclude | исключение конкретного набора не исключает другие наборы с его отдельными местами; исключение места запрещает все наборы с ним; фиксированное место → conflict |
| A04 | одинаковые входы | неизменный input fingerprint при повторном расчёте с исключением; parent lineage проверена при наличии хранилища, иначе explicitly caller-supplied |
| A05 | finite catalogue | fewer-than-K объясняется, partial не exact; ties детерминированы согласно контракту |
| A06 | screening | banana/date invalid отвергаются в новых строгих валидаторах; historic evidence ≠ разрешение; prohibited/conflict не участвует |
| A07 | импорт | 10 исторических + 1 POI lead; ни один не становится активным автоматически; пункт 2 removed_2019; Tundra approximate не access node; null capacity не превращается в 0/∞ |
| A08 | геометрия | узел доступа отдельно от участка, сеть version/hash; zero sameNode flagged, verified operational запрещён без подтверждения доступа, учебный тест остаётся |
| A09 | пропускная способность | пример: ближний объект хранит 100 м³, но 1 рейс на горизонт; Q=10, спрос=30; остальное идёт на удалённый объект либо не обслужено; checker отклоняет превышение лимита; null → warning |
| A10 | маршруты | one-way, закрытый путь, отсутствие возврата, сценарная масса/ширина, гружёный ≠ порожний; ограничения с provenance; matrix/cache parity |
| A11 | городской regression | без новых ограничений исходные 159.425990 / 108.556350 / 122.648320 / 92.228770 км, 228 м³ |
| A12 | масштаб | 20×30, 2+2; записаны actual time, memory, catalogue coverage, count; не маркировать incomplete как exact |
| A13 | интеграция | CLI, HTTP, JS parity; второй конкретный граф; JSON schema tests; не зависеть от UI или «Севера» |
| A14 | UI минимум | legacy явно маркирован, exact отдельно, результаты не перепутаны; если отложено — status и инструкции; browser/Windows только фактически пройденные проверки |
| A15 | данные | экспорт evidence catalogue и synthetic scenarios, источники, правовые статусы, никаких неподтверждённых утверждений о действующих площадках |
| A16 | документация | STATUS/HANDOFF/ALGORITHM/API/CODE_MAP/CHANGELOG/AGENTS согласованы с фактической реализацией |

## Правила памяти
- `docs/STATUS.md` — одна страница, baseline commit/hash, Done/Partial/Open/WAIT_DATA, известные ограничения, результаты последних тестов, что запускать.
- `docs/HANDOFF.md` — следующая конкретная задача, файлы, входы, репродуктор, ожидаемый результат, известный риск; ссылки на логи.
- `CHANGELOG.md` — добавляй фактически завершённую итерацию с датой и commit SHA после коммита (или последующая запись, без самоссылки на ещё не созданный SHA); не удаляй предыдущие. Разделять fix, feature, data, risk, deferred.
- `docs/ALGORITHM.md`, `docs/API.md`, `docs/CODE_MAP.md` — текущее состояние; proof/limitations, wire versions, команды. Не копировать все архивы в AGENTS.md. `AGENTS.md` — короткий вход.
- `docs/benchmarks/v43/` — команда, версия окружения, input hashes, stdout test logs, factual result JSON, hardware/time, failures. Старые логи immutable.
- Каждый агент начинает со `git status` и `STATUS/HANDOFF`; завершает commit (если разрешено), changelog и новый handoff; не объединять ветки без согласования. При исчерпании лимита не оставлять незадокументированную полуработу.

### Шаблон handoff
```
Iteration ID / дата / branch / base SHA / head SHA:
Input and source versions:
Completed (files, evidence):
Tests run (command + result + log):
New API contracts / changes to math:
Known gaps and blocked data:
Next task (one atomic action):
Acceptance criteria and reproduction:
Not done / explicitly deferred:
```
