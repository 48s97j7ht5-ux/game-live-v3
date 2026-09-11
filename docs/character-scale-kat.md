# Kat — тест масштаба персонажа (референс)

Целевой арт-direction из вашего листа **«ТЕСТ МАСШТАБА ПЕРСОНАЖА»** — ориентир качества **выше Gemini refine** для full-body.

## Персонаж (Kat / Lera)

| Поле | Значение |
|------|----------|
| Возраст | 20 |
| Рост (лore) | 164 см |
| Телосложение | худое |
| Волосы | тёмные, messy ponytail |
| Пирсинг | septum, уши, пупок |
| Кожа | лёгкий «downy trail» ниже пупка, слегка sweaty sheen, **синяки на коленях** |
| Одежда (база) | чёрный sports bra / crop, тёмные шорты с белой отделкой, **босиком** |
| Ракурс | ¾, стоя |

## Масштаб спрайта (высота персонажа в пикселях)

| Высота | Вердикт |
|--------|---------|
| **200 px** | мелко для деталей лица/пирсинга |
| **300 px** | **минимум комфортный** для life-sim (2–3 на экране) |
| **400 px** | **оптимально** для одежды/тела/DNA; рекомендуется для системы гардероба |

**Для game-live-v3:** генерировать **master в 400 px**, в игре **downscale** до 300 px при необходимости; не рисовать сразу 1024 soft.

## Стиль

- **High-fidelity pixel art** (не mushy upscale): читаемые глаза, пирсинг, складки ткани.
- Фон персонажа: **прозрачный** или белый; **без** baked checkerboard.
- Сцены внизу листа — **UI mock** (кухня, подъезд, двор): фон painterly, персонаж — pixel overlay **400 px**.

## Где хранить

- Лист-макет (ваш): `characters/kat/reference/scale-test-master.png`.
- Лист-макет (Cursor, черновик): `characters/kat/reference/kat-scale-test-sheet-cursor.png`.
- Спрайт 400 px (Cursor): `characters/kat/reference/kat-fullbody-400px-cursor.png`.
- Рабочий спрайт для compositor: `templates/parts/body/kat_body_400.png` (скопировать/обрезать из 400 px master).
- База тела faceless: `characters/kat/reference/kat-pixel-base-reference-512.png`.

## Промпт для Cursor / Gemini (full character, как на листе)

Не «refine blur» — **новая генерация** по описанию + ваш лист как **reference image**:

```
High-fidelity pixel art game character, single figure, three-quarter view.
Young woman 20, slim, 164cm look, dark messy ponytail, brown eyes, septum and ear piercings.
Black sports bra, dark athletic shorts white trim, barefoot, hands relaxed at sides or on hips.
Subtle knee bruises, light sweat sheen on skin. Sharp pixel edges, rich but controlled palette.
Character exactly 400 pixels tall on 512x512 canvas, centered, transparent or white background.
Same quality as professional visual novel pixel sprite, not soft AI illustration.
```

Для **Gemini refine** старого кадра — по-прежнему [`gemini-pixel-prompts.md`](gemini-pixel-prompts.md) → **Refine**, но **master** лучше брать с листа 400 px.

## Связь с compositor

- **400 px body** → `compositor/` (body + позже face PNG).
- **Лицо модульно** → `face-compositor/`; масштаб лица согласовать с **400 px** телом (один zoom при первой стыковке).
