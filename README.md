# game-live-v3

2D персонажи ¾: части из **Gemini** / Leonardo → нормализация в реальный low-res pixel sprite → сборка в браузере или скриптом.

**Промпты Gemini (300 px рост, 512 canvas, 32 цвета):** [`docs/gemini-pixel-prompts.md`](docs/gemini-pixel-prompts.md)

## True pixel normalize (192 px)

AI-рендер не считаем готовым pixel art. Перед добавлением в шаблоны его можно прогнать через [`scripts/pixel_normalize.py`](scripts/pixel_normalize.py).

```bash
pip install -r requirements.txt
python3 scripts/pixel_normalize.py input.png output.png \
  --height 192 \
  --colours 48 \
  --key black
```

Что гарантирует нормализатор:

- видимая фигура в итоговом PNG имеет **ровно 192 реальных пикселя по высоте**;
- ресемплинг только **Nearest Neighbor**;
- максимум **48 видимых RGB-цветов**;
- **без dithering**;
- alpha только `0` или `255`, без полупрозрачной бахромы;
- фон вырезается по black / white / custom key;
- выходной файл — настоящий низкоразрешённый PNG, а не HD-рендер с наложенной «пиксельной сеткой».

Для прозрачного исходника используйте `--key none`. Для белого фона — `--key white`. Для другого цвета — `--key custom --key-rgb RRGGBB`.

## Compose (body + head + hair)

1. Положите PNG в [`templates/parts/`](templates/parts/):
   - `body/body_base.png`, `head/head_base.png`, `hair/hair_black.png`
2. **Телефон / браузер:** откройте [`compositor/index.html`](compositor/index.html) (или GitHub Pages → «Сборка спрайта»).
   - Загрузите три файла, подгоните X / Y / Scale.
   - Скачайте `assemble.json` и `composed.png`.
3. Положите `assemble.json` в `characters/<id>/assemble.json` и обновите пути `file` при необходимости.
4. **CLI:**

```bash
pip install -r requirements.txt
python3 scripts/compose.py characters/test/assemble.json
```

Результат: [`output/test/composed.png`](output/test/composed.png).

Слой **body** часто без key (серый фон); **head/hair** — включите «key white», если фон белый.

## Композитор лица (7 слоёв)

1. PNG в [`templates/face/`](templates/face/) (см. README там) или загрузка файлов в браузере.
2. **Телефон / браузер:** [`face-compositor/index.html`](face-compositor/index.html) (GitHub Pages → «Лицо»).
   - Слои: head → eyes → brows → nose → lips → cosmetics → hair.
   - Выберите слой, **тащите на превью** (масштаб превью до **3×** для прицеливания).
   - Скачайте `face-assemble.json` и `face-<id>.png`.
3. Пример: [`characters/kat/face-assemble.json`](characters/kat/face-assemble.json).

Спецификация и стыковка с телом (`anchor_neck`) — **[`docs/face-compositor.md`](docs/face-compositor.md)**.

Опционально: **[`docs/magic-pixel-api.md`](docs/magic-pixel-api.md)** — только если позже включите API/Vite.

**Телефон + Cloud Agent:** **[`docs/workflow-mobile.md`](docs/workflow-mobile.md)**.

## MPFB configurator (legacy)

[`configurator/`](configurator/) — JSON для старого MPFB-пайплайна, если понадобится.

## GitHub Pages

Workflow `pages-configurator.yml` публикует `site/` (face-compositor, compositor, configurator).

## Схема assemble

| Поле | Назначение |
|------|------------|
| `canvas` | размер холста |
| `layers[]` | порядок: body → head → hair |
| `x`, `y`, `scale` | позиция слоя |
| `key_white` | убрать белый фон (и в браузере — общий toggle) |
