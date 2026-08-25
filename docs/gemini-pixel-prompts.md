# Gemini — промпты под pixel life-sim (Kat)

Цель: **жёсткий pixel art**, персонаж **~300 px по высоте** на экране — значит **генерируем сразу маленьким**, без 1024 «мягких» upscale.

Связь: [`face-compositor`](../face-compositor/), [`face-compositor.md`](face-compositor.md), референсы в [`characters/kat/reference/`](../characters/kat/reference/).

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

## Тест: тело целиком (скопировать в Gemini)

Проверка **резкости и пропорций** перед нарезкой на слои. Прикрепите **лучший прошлый кадр Kat** как reference.

```
Strict retro pixel art sprite for a 2D life-simulation game.
512x512 pixels, solid white background #FFFFFF only.
One full-body character, exactly 300 pixels tall from feet to top of hair, centered in the frame with equal padding on all sides.
Three-quarter view, body facing slightly to the right, head turned same direction.
Integer pixel grid, crisp hard edges, NO anti-aliasing, NO blur, NO gradients, NO soft shading, NO semi-transparent edge pixels.
Maximum 32 colors in the entire image total.
Each area uses exactly 4 flat colors only: dark outline, shadow, mid base, highlight (skin, hair, swimsuit, shoes separately).
1-pixel black or dark brown outer silhouette outline. SNES / Stardew Valley sprite quality, not illustration.

Character: young woman, emo goth-lite style, tan skin, messy black shoulder-length hair with jagged bangs.
Neutral calm face, simple pixel eyes and mouth, not anime huge eyes.
Standing pose, hands on hips, elbows out.
Outfit: plain dark navy bikini. Black spiked choker, black spiked wristbands on both wrists.
Feet: simple black low-top sneakers with white soles and white laces (Vans-style), not barefoot.

Avoid: anti-aliasing, fuzzy edges, painterly shading, color bleeding, smooth gradients, photorealistic, 3D, 4k, 8k, cinematic lighting, watermark, star icon, text, gray background, checkerboard, extra limbs, deformed hands.

Same character as the attached reference image if provided. Match pixel crispness of reference; do not make image softer or higher resolution.
```

**Куда класть:** `characters/kat/reference/kat-fullbody-test-512.png`  
**Проверка:** zoom 400% — контур должен быть **лесенкой**; персонаж **~300 px** высотой, не точка и не на весь 512 без полей.

---

### 7. Full body — neutral (референс, не слой лица)

См. блок **«Тест: тело целиком»** выше для полного текста. Краткая версия:

```
[STYLE ANCHOR]
[KAT DNA]
Full body standing, hands on hips, black sneakers white soles, dark bikini, spiked choker and wristbands.
Full character exactly 300px tall in 512x512 canvas, centered.
```


Файл: `characters/kat/reference/kat-fullbody-neutral-512.png`

---

### 8. Body variant — pregnant (отдельный body, не face-compositor)

```
[STYLE ANCHOR]
[KAT DNA]
Same character, same pose and canvas, visibly pregnant belly, otherwise identical proportions.
Faceless OR neutral face — prefer faceless for modular pipeline.
No extra clothing beyond simple dark bikini bottom. 300px character height, 32 colors max.
```

Файл: `characters/kat/reference/kat-body-pregnant-512.png`

---

## Как работать в Gemini (телефон)

1. **Первый удачный кадр** → сохранить как **master reference**, всегда **прикреплять** к следующим запросам.
2. Текст промпта: **STYLE ANCHOR + NEGATIVE + конкретный слой**; в конце: `Match pixel crispness and exact canvas layout of the attached reference. Do not increase softness.`
3. Просить **один слой за раз**; не «full character with everything» для modular.
4. Если модель упрямится в 1024 — явно: `Output aspect ratio 1:1, smallest native resolution, sprite not poster`.
5. Проверка: zoom 400% — края должны быть **ступеньки**, не полупрозрачные пиксели.

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
