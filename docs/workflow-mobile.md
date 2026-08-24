# Работа только с телефона / планшета + Cloud Agent

Репозиторий **не требует** Node, Vite или Magic Pixel API для основного сценария.

## Основной цикл

1. **Magic Pixel / Leonardo** — рисуете или экспортируете PNG.
2. **GitHub** (приложение или браузер) — файлы в:
   - `characters/kat/reference/` — черновики «на хранение»;
   - `templates/face/<слой>/` — для сборки лица;
   - `templates/parts/` — body / head / hair.
3. **Сборка в браузере** (GitHub Pages, без установки):
   - [face-compositor](https://48s97j7ht5-ux.github.io/game-live-v3/face-compositor/)
   - [compositor](https://48s97j7ht5-ux.github.io/game-live-v3/compositor/)
4. **Cloud Agent** — правки JSON, compositor, PR, доки.

## Что не нужно в Environment

| Пропустили | Эффект |
|------------|--------|
| `registry.npmjs.org` | Нет npm / Vite / `@magicpixelart/*` — **нормально** для этого репо. |
| `magicpixel.art` | Нет API/MCP из облака — **нормально**; экспорт PNG вручную. |
| `MAGICPIXEL_API_KEY` | То же. |

## Опционально (CLI `compose.py`)

Если агенту нужен **`python3 scripts/compose.py`** в облаке, добавьте egress **`pypi.org`** (и `files.pythonhosted.org`) — тогда `install` поставит Pillow из `requirements.txt`.

Без PyPI compositor в браузере и git по-прежнему работают.

## Magic Pixel MCP

Нужен **Cursor Desktop** + локальный `tools/cursor-mcp`. С **только мобильным Cursor + Cloud Agent** MCP Magic Pixel **не используем** — см. обсуждение в чате / `docs/magic-pixel-api.md`.
