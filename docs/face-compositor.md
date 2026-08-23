# Композитор лица (face compositor)

Зафиксированная модель сборки персонажа **лицом вперёд**: сначала настраиваем и экспортируем **лицо**, затем (отдельным этапом) стыкуем с **телом**.

Связанные инструменты:

- **Сейчас:** [`compositor/`](../compositor/) — сборка full-body (body / head / hair), legacy.
- **План:** `face-compositor/` — четыре слоя лица по схеме ниже.
- **CLI:** [`scripts/compose.py`](../scripts/compose.py) — общий движок склейки PNG по JSON (подойдёт и для `face-assemble.json`).

---

## Порядок слоёв (снизу вверх)

| # | ID слоя | Содержимое | Примечание |
|---|---------|------------|------------|
| 1 | `head` | **Голова** — силуэт, кожа, ухо, шея до линии стыка с телом | Без черт или с минимумом; «манекен» |
| 2 | `face` | **Черты лица** — глаза, брови, нос, рот | Эмоции = варианты этого слоя (или набор мелких PNG) |
| 3 | `cosmetics` | **Косметика и украшения** — румяна, помада, тени, пирсинг, серьги | Часто с прозрачностью; можно несколько файлов позже |
| 4 | `hair` | **Волосы** | Поверх лба; cutout под лицо, если один PNG |

Склейка: **1 → 2 → 3 → 4** (нижний слой рисуется первым).

### Расширения (когда появятся ассеты)

| ID | Позиция | Зачем |
|----|---------|--------|
| `hair_back` | **перед** `head` или **между** `head` и `face` | Объём hair сзади |
| `accessories_front` | **после** `hair` | Очки, шапка, поверх причёски |
| `makeup` vs `jewelry` | оба в группе слоя 3 | При необходимости разнести в JSON двумя записями с одним `z` |

**Серьги:** если прядь закрывает ухо — порядок 3 → 4; если серьга поверх волос — отдельный слой `accessories_front`.

---

## Эмоции и «уникальные лица»

- **Эмоция** не отдельная «голова целиком», а правило: меняются элементы **слоя 2** (брови, рот, иногда глаза).
- **Разные NPC** (комбинации без бесконечного Leonardo-combine):
  - несколько **`head` archetype** (форма);
  - варианты **`face`** (глаза/брови);
  - **`cosmetics` / extras**;
  - **`hair`** + позже тело/одежда.

Leonardo генерирует **PNG в папки**; комбинации — **compositor + JSON**, не один промпт «сделай всё».

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
      "id": "face",
      "file": "templates/face/emotions/neutral.png",
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
  features/       # слой 2 — eyes, mouth, … или emotions/*.png
  cosmetics/      # слой 3 — makeup, jewelry
  hair/           # слой 4
  hair_back/      # опционально
  accessories/    # опционально — поверх hair
```

Эмоциональный лист **4×4** → после нарезки кладётся в `templates/face/emotions/` (или `features/`).

---

## Два этапа пайплайна

```text
[Face compositor]  head + face + cosmetics + hair  →  face.png + face-assemble.json
[Body compositor]  body + face.png (по anchor_neck)  →  full_character.png
```

Full-body [`compositor/`](../compositor/) остаётся до появления face-compositor и body-anchor; новая работа по лицу ведётся по **этому документу**.

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
