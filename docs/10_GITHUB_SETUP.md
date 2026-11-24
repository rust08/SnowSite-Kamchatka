# Создание отдельного репозитория SnowSite без потери истории

Предлагаемое имя: `SnowSite-Kamchatka`, Private. Не форкать/менять «Север». Удалённый репозиторий не создан и не подключён автоматически. До публикации владелец должен проверить историю, исходные данные, ODbL/атрибуцию, лицензию кода, отсутствие секретов и персональных данных. Даже удалённый из текущего дерева файл может оставаться в Git history.

1. В локальной папке клонировать актуальный bundle, а не инициализировать заново:

```sh
git clone -b work/v4.8 SnowSite-v4.8-history.bundle SnowSite-Kamchatka
cd SnowSite-Kamchatka
git log --oneline -10
git status --short
git remote -v
```

2. После проверки содержимого `npm run check && npm test`; сравнить с STATUS. Для проверки контрактов установите `python -m pip install -r tools/contract-requirements.txt` и выполните `npm run test:contracts`. GitHub Actions теперь можно запустить вручную (workflow_dispatch), после публикации и разрешения Actions; Linux/Windows и browser job должны реально пройти. `origin` после clone указывает на локальный bundle, а не GitHub. Для передачи агенту можно оставить его как read-only источник.
3. Владелец создаёт пустой Private repo в GitHub (без README/License/gitignore), затем, если явно разрешил публикацию **этого** независимого репозитория, подключает URL. Пример команд, не выполнявшийся автоматически:

```sh
git remote rename origin archive
git remote add origin <URL-of-your-new-private-repo>
git branch main  # только если main отсутствует, на проверенном HEAD
git push -u origin main
```

Перед push проверить `git remote -v`, `git log` и `git status`. Не force-push, не переписывать прошлые коммиты, не использовать чужой URL или токены в файлах. Сохранить текущую рабочую ветку для handoff; будущая разработка — отдельными ветками/PR. Защитить main после настройки CI, требовать review. Не утверждать Windows/CI/Playwright PASS до фактического запуска. Implemented repository architecture: ARCHITECTURE.md, workflow CONTRIBUTING.md.

В v4.8 Actions сохраняет scoped acceptance artifacts и при ошибке. Локально `python tools/acceptance.py --mode all --output runtime/acceptance-unique` после dev dependencies. `not_run` не PASS. Checkout с `core.autocrlf=true` проверен в Linux; это не Windows execution.
