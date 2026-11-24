# SnowSite v4.2 — передача следующему агенту, 21.11.2026

**Вход:** `SnowSite-v4.2(4).zip` (SHA-256 `cbea40937cd4dc064e8eb4f3b0958306dd6a53c744c84842a18a4f3a2845a61c`), независимый аудит и новые сведения о местах складирования снега. Работай в отдельной ветке актуального SnowSite, не в «Севере». Этот пакет не содержит изменённого приложения.

## Что читать
1. В проекте: `AGENTS.md`, `docs/STATUS.md`, `docs/HANDOFF.md`, `docs/ALGORITHM.md`, `docs/API.md`, `docs/CODE_MAP.md`.
2. Здесь: `01_AUDIT.md`, `02_SITE_EVIDENCE.md`, `03_MASTER_TASK.md`, `04_ACCEPTANCE_AND_HANDOFF.md`.
3. `evidence/site_leads.json` и CSV — **реестр зацепок, не готовый вход оптимизатора**, `evidence/SOURCES.md` — происхождение.
4. `evidence/test.log`, `manifest-check.log`, `network-check.log`, `demo.result.json`, `repro.log` — независимый прогон. Для воспроизведения копируй `tests/reproduce-v42.mjs` в `tests/` корня проекта и запусти `node tests/reproduce-v42.mjs`. Это диагностический скрипт, а не новый acceptance test.

Старт: `npm run check`, `npm test`; Python зависит от окружения (`solver/requirements.txt`, `SNOW_PYTHON`, см. API). 54/54 теста на момент аудита. Существующие S0–S3 не повторять. Новые стадии после проверки. Важен headless backend; UI только минимальная интеграция и честная маркировка. Не обещай готовность к эксплуатации при неизвестных данных.
