> PAUSED_BY_OWNER (v4.8.1): создание и публикация remote, Windows/CI и их приёмка не входят в активный план. Исторический чек-лист ниже не является очередью работ; восстановление Git history.bundle, текущие пути и лицензии описаны в README и docs/ARCHITECTURE.md.

# Готовность нового GitHub репозитория

- [ ] Отдельный `SnowSite-Kamchatka` создан под вашим GitHub аккаунтом.
- [ ] Visibility `Private` (пока вы осознанно не решили иначе).
- [ ] `main` создан из исходного ZIP и `git status` чистый.
- [ ] Существующий `Sever-GitHub` НЕ является remote нового проекта.
- [ ] Файлы `AGENTS.md`, `README.md`, `docs/00_CODEX_START_HERE.md`, `data/city-network.json` есть.
- [ ] `.github/workflows/check.yml` запускается без дополнительных секретов.
- [ ] `npm run check` и `npm test` зелёные.
- [ ] Инструмент доступен на `127.0.0.1:8793`.
- [ ] Нет личных телефонных номеров, заметок закрытых встреч и доступа к ЕИС с логином в git.
- [ ] Присутствует attribution OSM/Leaflet/Mapzen; перед публичным деплоем — review лицензий и документации.
- [ ] В GitHub issues оформлена одна из следующих задач: exact oracle, UX validation, road restrictions, legal screening evidence, true demand source.
- [ ] `README` отдельно показывает: что уже есть, чего нет, почему результаты сценарные.
