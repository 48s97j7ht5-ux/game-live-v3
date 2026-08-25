# Leonardo.ai — API интеграция

В отличие от MagicPixel (там есть готовый MCP-коннектор), для Leonardo
коннектора нет — работаем через прямой REST API,
[`scripts/leonardo.py`](../scripts/leonardo.py).

Подключаемость проверена вживую 2026-08-25: `cloud.leonardo.ai` отвечает
(до фикса egress этой сессии был 403 на CONNECT, после — честный `401`
без ключа, то есть хост реально доступен).

## 1. Получить ключ

В личном кабинете Leonardo — раздел **API Access** (часто отдельный от
обычной подписки/кредитов приложения — на части тарифов API нужно
включать/оплачивать отдельно, проверьте там же).

**Ключ не присылать в чат агенту.** Как и с MagicPixel — либо в секреты
облачного окружения, либо локально в `.env` (см. `.env.example` →
`LEONARDO_API_KEY`).

## 2. Проверка

```bash
pip install -r requirements.txt  # только Pillow, urllib — из стандартной библиотеки
export LEONARDO_API_KEY=...
python3 scripts/leonardo.py ping
```

`ping` → `GET /me`. Код `200` — ключ рабочий. `401` — ключ неверный/не
активирован. Сетевая ошибка (`CONNECT tunnel failed`, `403` на уровне
прокси) — не проблема ключа, это egress-политика окружения, см.
`docs/character-factory.md` §3.

## 3. Модели

```bash
python3 scripts/leonardo.py models
```

Возвращает доступные `platformModels`/кастомные модели с их `id` —
понадобится для `--model-id` в генерации (без него используется
дефолтная модель аккаунта).

## 4. Генерация

Leonardo генерирует асинхронно: `POST /generations` запускает задачу,
дальше опрос `GET /generations/{id}` пока `status != COMPLETE`.
`scripts/leonardo.py generate` делает это автоматически и скачивает
результат.

```bash
python3 scripts/leonardo.py generate \
  "pixel art girl character, flat cel shading, transparent background" \
  --width 512 --height 512 --out-dir output/leonardo
```

## 5. Дальше по пайплайну

Результат Leonardo, скорее всего, придёт **не** честным низкоцветным
пиксель-артом (та же история, что была с ChatGPT-рефренсами и MagicPixel
без доп. настроек — см. `docs/character-factory.md` §C). Прогнать через:

```bash
python3 scripts/flatten_to_sprite.py output/leonardo/<file>.png \
  -o characters/<id>/reference/<name>.png --downscale 3 --colors 32 --protect-outliers
```
