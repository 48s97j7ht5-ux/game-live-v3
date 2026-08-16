# game-live-v3

Станок статичных образов персонажей (MPFB2) без локального Blender.

## Настройка через HTML

Откройте [`configurator/index.html`](configurator/index.html) в браузере или опубликуйте **GitHub Pages** (workflow `pages-configurator.yml`).

1. Настройте внешность и позу в форме.
2. Скачайте `appearance.json` и `shot.json` (или один `job.json`).
3. Положите их в репозиторий:
   - `characters/<id>/appearance.json`
   - `characters/<id>/shots/<имя>.json`

Пример: [`characters/hero/`](characters/hero/).

## Рендер (следующий шаг)

GitHub Actions + Docker (Blender 4.2+, MPFB2, system assets) читает JSON из `characters/` и пишет PNG в `output/`. Workflow рендера будет добавлен отдельно.

## Схемы

| Файл | Назначение |
|------|------------|
| `appearance.json` | Пресет MPFB2 (внешность) |
| `shot.json` | Поза, камера, разрешение (`game-live-v3/shot/1`) |
| `job.json` | Объединённый экспорт из HTML (`game-live-v3/job/1`) |
