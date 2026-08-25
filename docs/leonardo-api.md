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

## 4. Проверено вживую (2026-08-25)

- `ping` → `HTTP 200`, аккаунт `Chikisst`, 16 348 subscription tokens +
  3 251 api paid tokens, 10 слотов параллельных запросов.
- Полный цикл генерации (`POST /generations` → поллинг → скачивание)
  реально работает.
- **Модель по умолчанию аккаунта промпт полностью проигнорировала** —
  запросили «pixel art red apple», получили серо-красную мозаику в
  форме сердца, ничего общего с яблоком. С явным `--model-id` (Phoenix
  1.0, `de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3` — «exceptional prompt
  adherence») тот же промпт дал настоящее яблоко, пиксель-арт стиль,
  прозрачный фон. **Вывод: не полагаться на дефолтную модель, всегда
  указывать `--model-id` явно.** Phoenix 1.0 — дефолт в
  `scripts/leonardo.py generate` теперь, менять через `--model-id`.
- Сравнил Phoenix 1.0 с выделенной моделью **Pixel Art**
  (`e5a291b6-3990-495a-b1fa-7bd1864510a6`) на том же промпте: у Pixel Art
  крупнее/чётче блоки (визуально ближе к настоящему пиксель-арту), но
  она **проигнорировала «transparent background»** (сплошной
  коричневый фон вместо прозрачности) — критично для игровых спрайтов.
  Обе модели дают десятки тысяч цветов (32 102 у Phoenix, 25 027 у
  Pixel Art на кадр 512×512) — **ни одна не даёт честный
  индексированный пиксель-арт из коробки**, `flatten_to_sprite.py`
  всё равно обязателен после любой из них.
- Прогнал **одинаковый промпт персонажа** (full body, transparent
  background) по 6 подходящим моделям: Phoenix 1.0, Pixel Art,
  Character Portraits, RPG v5, RPG 4.0, Cute Characters.
  - **Phoenix 1.0** — единственная выполнила и `full body`, и
    `transparent background`. Не настоящий пиксель-арт по текстуре
    (плоская иллюстрация), но чистый силуэт/поза. Остаётся лучшим
    дефолтом для full-body персонажей.
  - **Pixel Art** (`e5a291b6-...`) — самая пиксельная фактура, но
    **игнорирует "full body"**, даёт только портрет по грудь
    (соответствует её же описанию «trained on headshots»). Подходит
    только для лицевых/портретных ассетов, не для полного роста.
  - **Character Portraits** (`6c95de60-...`) — тоже портрет, аниме-CG
    стиль, не пиксель-арт.
  - **RPG v5** (`f1929ea3-...`) — полный рост, но добавляет непрошеные
    декоративные иконки/баннеры в кадр.
  - **RPG 4.0** (`a097c2df-...`) — интересно: сама сгенерировала три
    ракурса одного персонажа (анфас/¾/профиль) в одном изображении, не
    пиксель-арт, но может пригодиться для поворотов спрайта.
  - **Cute Characters** (`50c4f43b-...`) — 3D-рендер, не 2D, не подходит
    жанру.

## 5. Генерация

Leonardo генерирует асинхронно: `POST /generations` запускает задачу,
дальше опрос `GET /generations/{id}` пока `status != COMPLETE`.
`scripts/leonardo.py generate` делает это автоматически и скачивает
результат.

```bash
python3 scripts/leonardo.py generate \
  "pixel art girl character, flat cel shading, transparent background" \
  --width 512 --height 512 --out-dir output/leonardo
```

## 6. Дальше по пайплайну

Результат Leonardo, скорее всего, придёт **не** честным низкоцветным
пиксель-артом (та же история, что была с ChatGPT-рефренсами и MagicPixel
без доп. настроек — см. `docs/character-factory.md` §C). Прогнать через:

```bash
python3 scripts/flatten_to_sprite.py output/leonardo/<file>.png \
  -o characters/<id>/reference/<name>.png --downscale 3 --colors 32 --protect-outliers
```
