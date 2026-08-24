# Композитор лица (face compositor)

Зафиксированная модель сборки персонажа **лицом вперёд**: сначала настраиваем и экспортируем **лицо**, затем (отдельным этапом) стыкуем с **телом**.

Связанные инструменты:

- **Сейчас:** [`face-compositor/`](../face-compositor/) — модульное лицо (7 слоёв, drag, zoom превью до 3×).
- **Сейчас:** [`compositor/`](../compositor/) — сборка full-body (body / head / hair).
- **CLI:** [`scripts/compose.py`](../scripts/compose.py) — общий движок склейки PNG по JSON (подойдёт и для `face-assemble.json`).

---

## Порядок слоёв (снизу вверх)

| # | ID слоя | Содержимое | Примечание |
|---|---------|------------|------------|
| 1 | `head` | **Голова** — силуэт, кожа, ухо, шея до линии стыка с телом | Без черт или с минимумом; «манекен» |
| 2 | **Черты лица** (отдельные файлы) | см. таблицу ниже | Не один PNG «face», а **4+ файла** |
| 3 | `cosmetics` | **Косметика и украшения** — румяна, помада, тени, пирсинг, серьги | Часто с прозрачностью; можно несколько файлов позже |
| 4 | `hair` | **Волосы** | Поверх лба; cutout под лицо, если один PNG |

### Слой 2 — отдельные файлы (порядок склейки)

Каждая черта — **свой PNG** на общем холсте (один ракурс ¾, одна сетка координат).

| Порядок | ID | Файлы (пример) | Примечание |
|---------|-----|----------------|------------|
| 2a | `eyes` | `templates/face/eyes/brown_neutral.png` | Форма + радужка; варианты цвета/формы |
| 2b | `brows` | `templates/face/brows/medium_neutral.png` | Поверх глаз |
| 2c | `nose` | `templates/face/nose/default_3q.png` | Обычно один archetype на персонажа |
| 2d | `lips` | `templates/face/lips/neutral_closed.png` | **Губы / рот**; эмоции чаще всего меняют **brows + lips** |

Полная цепочка склейки:

**head → eyes → brows → nose → lips → cosmetics → hair**

У каждого слоя в JSON свои `x`, `y`, `scale` (после первой подгонки часто одинаковые `0, 0, 1`).

### Эмоции при модульных чертах

- Не обязательно 16 полных «лиц» — достаточно набора **`lips_*`** и **`brows_*`** (и при необходимости **`eyes_*`**).
- Эмоциональный лист **4×4** можно **нарезать по зонам** (если нарисован целиком) или постепенно заменить отдельными файлами из Leonardo.
- В DNA персонажа: `"lips": "smile_open"`, `"brows": "angry"`, `"eyes": "neutral"`.


### Расширения (когда появятся ассеты)

| ID | Позиция | Зачем |
|----|---------|--------|
| `hair_back` | **перед** `head` или **между** `head` и `face` | Объём hair сзади |
| `accessories_front` | **после** `hair` | Очки, шапка, поверх причёски |
| `makeup` vs `jewelry` | оба в группе слоя 3 | При необходимости разнести в JSON двумя записями с одним `z` |

**Серьги:** если прядь закрывает ухо — порядок 3 → 4; если серьга поверх волос — отдельный слой `accessories_front`.

---

## Эмоции и «уникальные лица»

- **Эмоция** = комбинация **`brows` + `lips`** (± **`eyes`**), не монолитный слой `face`.
- **Разные NPC** (комбинации без бесконечного Leonardo-combine):
  - несколько **`head` archetype** (форма);
  - варианты **`eyes` / `brows` / `nose` / `lips`**;
  - **`cosmetics` / extras**;
  - **`hair`** + позже тело/одежда.

Leonardo генерирует **PNG в папки**; комбинации — **compositor + JSON**, не один промпт «сделай всё».

### Пример DNA (лицо)

```json
{
  "head": "archetype_01",
  "eyes": "green_wide",
  "brows": "thin_neutral",
  "nose": "default_3q",
  "lips": "smirk",
  "cosmetics": ["blush_light", "septum"],
  "hair": "black_messy"
}
```


---

## Схема JSON (`game-live-v3/face-assemble/1`)

```json
{
  "schema": "game-live-v3/face-assemble/1",
  "character_id": "kat",
  "output": "output/kat/face_neutral.png",
  "canvas": { "width": 1024, "height": 1024 },
  "anchor_neck": { "x": 512, "y": 920 },
  "layers": [
    {
      "id": "head",
      "file": "templates/face/head/archetype_01.png",
      "x": 0,
      "y": 0,
      "scale": 1,
      "key_white": true
    },
    {
      "id": "eyes",
      "file": "templates/face/eyes/brown_neutral.png",
      "x": 0,
      "y": 0,
      "scale": 1,
      "key_white": true
    },
    {
      "id": "brows",
      "file": "templates/face/brows/medium_neutral.png",
      "x": 0,
      "y": 0,
      "scale": 1,
      "key_white": true
    },
    {
      "id": "nose",
      "file": "templates/face/nose/default_3q.png",
      "x": 0,
      "y": 0,
      "scale": 1,
      "key_white": true
    },
    {
      "id": "lips",
      "file": "templates/face/lips/neutral_closed.png",
      "x": 0,
      "y": 0,
      "scale": 1,
      "key_white": true
    },
    {
      "id": "cosmetics",
      "file": "templates/face/cosmetics/none.png",
      "x": 0,
      "y": 0,
      "scale": 1,
      "key_white": true,
      "opacity": 1
    },
    {
      "id": "hair",
      "file": "templates/face/hair/black_messy.png",
      "x": 0,
      "y": 0,
      "scale": 1,
      "key_white": true
    }
  ]
}
```

- **`anchor_neck`** — точка низа шеи на итоговом PNG; для будущей стыковки с телом (body compositor совмещает с `anchor` на body).
- **`key_white`** — убрать белый / светло-серый фон (см. [`scripts/compose.py`](../scripts/compose.py)).

---

## Папки ассетов (целевая структура)

```text
templates/face/
  head/           # слой 1 — archetype_*.png
  eyes/           # слой 2a
  brows/          # слой 2b
  nose/           # слой 2c
  lips/           # слой 2d (губы / рот)
  cosmetics/      # слой 3 — makeup, jewelry (можно несколько PNG в JSON)
  hair/           # слой 4
  hair_back/      # опционально
  accessories/    # опционально — поверх hair
  emotions/       # опционально: целые листы до нарезки на brows/lips/…
```

Старый вариант «один файл `face`» **не используем** — только модульные **eyes, brows, nose, lips**.


---

## Два этапа пайплайна

```text
[Face compositor]  head + eyes + brows + nose + lips + cosmetics + hair  →  face.png + face-assemble.json
[Body compositor]  body + face.png (по anchor_neck)  →  full_character.png
```

Full-body [`compositor/`](../compositor/) остаётся до появления face-compositor и body-anchor; новая работа по лицу ведётся по **этому документу**.

### Управление на телефоне

В [`compositor/`](../compositor/) (и в будущем **face-compositor**): выбор активного слоя + **перетаскивание пальцем / стилусом** на превью (Pointer Events). Масштаб — слайдер **Scale** (pinch можно добавить позже).

---

## Прозрачность и фон

- Предпочтительно: PNG с **alpha** из редактора / remove.bg.
- Если фон **белый или серый** — `key_white: true` в compositor / compose.
- **Шахматка**, «запечённая» в файл, key **не** убирает — нужен перэкспорт или remove bg.

---

## История решения

| Дата | Решение |
|------|---------|
| 2026-08-23 | Зафиксирован порядок слоёв: **1 head → 2 face → 3 cosmetics → 4 hair**; face-first, тело позже. |
| 2026-08-23 | Слой **face** = отдельные файлы: **eyes → brows → nose → lips** (порядок склейки). |
