# Gemini — промпты под pixel life-sim (Kat)

Цель: **жёсткий pixel art**, персонаж **~300 px по высоте** на экране — значит **генерируем сразу маленьким**, без 1024 «мягких» upscale.

Связь: [`face-compositor`](../face-compositor/), [`face-compositor.md`](face-compositor.md), референсы в [`characters/kat/reference/`](../characters/kat/reference/).

**Оптимальный master (400 px, как лист «ТЕСТ МАСШТАБА»):** [`character-scale-kat.md`](character-scale-kat.md) — для full-body лучше **Cursor GenerateImage** или ваш лист; Gemini **Refine** — для доработки старых кадров, не замена sharp master.

---

## Технические рамки (зафиксировать в каждом промпте)

| Параметр | Значение | Зачем |
|----------|----------|--------|
| Высота персонажа на картинке | **~280–320 px** (не выше) | Совпадает с игрой (2–3 героя на экране) |
| Размер **файла** (Gemini) | **512×512** или **384×512** | Не 1024 — меньше «мыла» и anti-alias |
| Ракурс | **3/4**, корпус слегка вправо, лицо читается | Один раз для всех слоёв |
| Сетка | **integer pixel grid**, **nearest-neighbor look** | Без сглаживания |
| Палитра **всего кадра** | **не больше 32 цветов** | Огранить «акварель» Gemini |
| Палитра **на зону** | **ровно 4 цвета**: outline, shadow, base, highlight | Кожа, hair, cloth отдельно |
| Контур | **1 px чёрный или тёмно-коричневый**, без двойных линий | Sel-out внутри — только темнее base |
| Фон | **#FFFFFF** сплошной | Key в compositor |
| Запреты | no anti-aliasing, no blur, no gradient, no soft shading, no realistic, no watercolor, no 3D, no watermark, no text |

**После экспорта:** если всё ещё мягко — один раз **512→256→512** только **Nearest** (Photoshop/Aseprite/скрипт), не больше.

**Compositors:** все слои одного персонажа — **одинаковый размер холста** (512×512). В JSON можно `"canvas": { "width": 512, "height": 512 }`. Масштаб слоя `1` = 1 pixel в 1 pixel.

---

## Блок «якорь стиля» (копировать в начало)

```
Strict retro pixel art sprite for a 2D life-simulation game.
512x512 PNG, solid white background #FFFFFF.
Character height exactly 300 pixels tall, centered horizontally and vertically with equal padding.
Three-quarter view facing slightly to the right.
Integer pixel grid, crisp hard edges, NO anti-aliasing, NO blur, NO gradients, NO soft shading.
Maximum 32 colors in the entire image.
Each material uses exactly 4 colors: dark outline, shadow, base, highlight.
1-pixel outer outline. Flat cel shading only. SNES / 16-bit RPG quality, not HD illustration.
```

## Блок «Kat DNA» (внешность)

```
Young woman, emo/goth-lite, tan skin, athletic-slim build.
Messy black shoulder-length hair (when hair is included).
Optional: spiked black choker and wristbands, dark bikini or simple clothes when outfit included.
Neutral calm expression when face is included.
Same character identity as the attached reference image.
```

## Блок «NEGATIVE» (отдельной строкой или в конце)

```
Avoid: anti-aliased edges, semi-transparent pixels, fuzzy outlines, painterly shading,
color bleeding, high resolution detail, 4k, 8k, illustration, concept art, smooth gradients,
photorealistic skin, depth of field, bloom, lens flare, watermark, logo, star icon,
crooked asymmetry, extra fingers, deformed feet, text, border, gray background, checkerboard.
```

---

## Промпты по типам ассетов

### 1. Head base (слой `head`) — без черт, без волос

```
[STYLE ANCHOR]
[KAT DNA]
Bald head and neck only, visible ear on near side, no eyes no eyebrows no nose no mouth.
Bare shoulders cut at collarbone, NO clothing NO jewelry NO hair.
Skin only 4-color cel shading. Character silhouette width typical for 300px-tall sprite.
```

Файл: `templates/face/head/kat_head_512.png`

---

### 2. Eyes (`eyes`)

```
[STYLE ANCHOR]
[KAT DNA]
ONLY the eyes layer for the same 3/4 head angle and same 512x512 canvas alignment.
Both eyes visible, simple pixel shapes, 4 colors for iris, 4 for whites/shadows.
No eyebrows, no nose, no mouth, no hair, no skin except minimal eye sockets if needed.
Rest of image pure white #FFFFFF.
```

---

### 3. Brows (`brows`)

```
[STYLE ANCHOR]
[KAT DNA]
ONLY eyebrows layer, same position as reference, black/dark brown, 4 colors max.
White background everywhere else. No other features.
```

---

### 4. Nose (`nose`)

```
[STYLE ANCHOR]
[KAT DNA]
ONLY nose layer, small 3/4 nose, 4 skin tones, minimal pixels, white background elsewhere.
```

---

### 5. Lips (`lips`)

```
[STYLE ANCHOR]
[KAT DNA]
ONLY closed neutral mouth / lips, 4 colors, same 3/4 head, white background elsewhere.
```

---

### 6. Hair (`hair`)

```
[STYLE ANCHOR]
[KAT DNA]
ONLY hair layer, messy black emo hair with bangs, 4 colors (outline, dark, base, highlight).
Transparent effect: draw hair only, white #FFFFFF everywhere else (no gray).
Same head position as reference. No face features drawn.
```

---

## Refine: попиксельно улучшить размытый арт (прозрачный фон)

**Задача:** прикрепить **ваш размытый PNG** → получить **ту же картинку** (та же одежда, поза, персонаж), но **чёткий pixel art на прозрачном фоне**.  
**Не пишите** в промпте про снятие одежды / nude / mannequin — иначе цензура. **Не пишите** enhance/upscale blur — лучше **redraw as pixel sprite**.

```
Recreate the attached image as strict retro pixel art for a 2D game.
Keep the EXACT same character design, outfit, accessories, pose, camera angle, and body proportions as the reference.
Do not add or remove clothing or items. Do not change the concept — only improve pixel clarity.

512x512 pixels. Fully transparent background (alpha channel), NO white backdrop, NO gray, NO checkerboard pattern baked in.
Character about 300 pixels tall, centered with padding, three-quarter view unless reference differs.

Integer pixel grid, hard edges, NO anti-aliasing, NO blur, NO soft shading, NO gradients, NO semi-transparent fringe pixels on the silhouette.
Maximum 32 colors in the entire sprite. Each area uses up to 4 flat cel-shading colors (outline, shadow, base, highlight).
1-pixel dark outer outline. SNES / Stardew Valley quality — sharp staircase edges when zoomed in.

Redraw from scratch as crisp pixels. Do NOT apply a soft filter or smooth upscale on top of the reference.
The result must look SHARPER and MORE PIXELATED than the attachment.

Avoid: watermark, star icon, text, logo, photorealistic rendering, 4k illustration look, fuzzy edges, color bleeding outside the silhouette.
```

**Куда класть:** `characters/kat/reference/kat-refined-512.png`  
**Compositors:** если фон реально прозрачный — можно **выключить key white** для этого слоя.

**Если Gemini отдаёт белый фон вместо alpha:** добавьте в конец: `Export PNG with transparent background only; every pixel outside the character must be 100% transparent.`

**Если всё ещё мягко:** пост-обработка 512→192→512 **Nearest** (вне Gemini).

---

## ~~Тест: только фигура~~ (убрано — цензура / не нужно)

Используйте блок **Refine** выше.

### 7–8. Full body / pregnant с одеждой

Не используем в промптах. База — только **«Тест: только фигура»** + размытый референс.

---

## Как работать в Gemini (телефон)

1. **Refine-тест:** размытый PNG + промпт **Refine** (прозрачный фон, тот же дизайн).
2. Первый **чёткий** результат → master reference для следующих слоёв.
3. Текст: без одежды/волос/украшений в промпте; внешность только через reference + «same character identity».
4. Если модель упрямится в 1024 — явно: `Output aspect ratio 1:1, smallest native resolution, sprite not poster`.
5. Проверка: zoom 400% — края **ступеньки**, не полупрозрачные пиксели.

---

## Чеклист перед git / compositor

- [ ] Высота персонажа ~300 px, не мелкая точка и не на весь 512 с пустотой
- [ ] Фон чисто белый
- [ ] Нет watermark / звёздочки UI
- [ ] Палитра «плоская», без грязных промежуточных оттенков по краю
- [ ] Тот же 512×512, что и у других слоёв Kat
- [ ] В face-compositor: **По центру (по содержимому)** → сохранить JSON

---

## Если Gemini всё равно размывает

1. Укоротить промпт: меньше слов «detailed, beautiful, cinematic».
2. Добавить: `like Stardew Valley character sprite sheet, limited palette`.
3. Пост: downscale to **192×192** nearest → upscale to **512×512** nearest (агрессивнее, чем 256).
4. Рассмотреть **ручную** правку 10 мин в Aseprite только по контуру head — всё равно дешевле, чем борьба с 1024 AI.

---

## Пример `face-assemble.json` под 512

```json
{
  "schema": "game-live-v3/face-assemble/1",
  "character_id": "kat",
  "canvas": { "width": 512, "height": 512 },
  "layers": [
    { "id": "head", "file": "templates/face/head/kat_head_512.png", "x": 0, "y": 0, "scale": 1, "key_white": true }
  ]
}
```

После первой подгонки координаты сохраняются; для 512 часто `x/y` ближе к 0, чем при 1024 с пустыми полями.
