# game-live-v3

2D персонажи ¾: части из **Gemini** / Leonardo → сборка в браузере или скриптом.

**Промпты Gemini (300 px рост, 512 canvas, 32 цвета):** [`docs/gemini-pixel-prompts.md`](docs/gemini-pixel-prompts.md)

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

**Фабрика персонажей (автогенерация — MagicPixel AI или чистая процедурная геометрия без AI):** **[`docs/character-factory.md`](docs/character-factory.md)**.

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
