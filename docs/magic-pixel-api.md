# Magic Pixel AI — API (черновик интеграции)

> **Обновление:** рабочий путь генерации сейчас — MagicPixel **MCP-коннектор**
> в Claude-сессии (без ключа/base URL ниже), см.
> [`character-factory.md`](character-factory.md). Этот REST-черновик остаётся
> на случай, если понадобится прямой вызов API без Claude-сессии.

Ключ формата `mp_live_…` — **секрет**. Не коммитить в git и **не отправлять в чат агента** (лучше ротировать, если ключ уже светился).

## 1. Cursor Cloud Environment

1. Откройте **Environment** для репозитория `game-live-v3`.
2. **Secrets** → добавьте:
   - `MAGIC_PIXEL_API_KEY` — ваш `mp_live_…`
3. **Network / egress** → разрешите **домен API** из документации Magic Pixel (без этого Cloud Agent не достучится до API).
4. Перезапустите агента или сделайте новый run.

## 2. Локально

```bash
cp .env.example .env
# заполните .env
pip install -r requirements.txt
python3 scripts/magic_pixel.py --help
```

## 3. Скрипт

[`scripts/magic_pixel.py`](../scripts/magic_pixel.py) — минимальный клиент:

- читает `MAGIC_PIXEL_API_KEY` и `MAGIC_PIXEL_API_BASE` из окружения;
- когда известны пути API из доков, сюда добавим: генерацию, remove background, экспорт PNG в `templates/face/`.

## 4. Что нужно от вас

Чтобы довести интеграцию до конца, пришлите **ссылку на API docs** или **Base URL** из личного кабинета Magic Pixel (не ключ). Типичные заголовки: `Authorization: Bearer …` или `X-API-Key`.

## 5. Пайплайн с game-live-v3

```text
Magic Pixel API → PNG на диск → templates/face/ → face-compositor → face-assemble.json
```

Пока API не настроен — ручной экспорт PNG, как сейчас.
