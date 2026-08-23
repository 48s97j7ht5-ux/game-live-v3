# game-live-v3

2D персонажи ¾: части из Leonardo → сборка в браузере или скриптом.

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

## Композитор лица (спецификация)

Порядок слоёв **head → face → cosmetics → hair**, face-first, затем стыковка с телом — см. **[`docs/face-compositor.md`](docs/face-compositor.md)**.

## MPFB configurator (legacy)

[`configurator/`](configurator/) — JSON для старого MPFB-пайплайна, если понадобится.

## GitHub Pages

Workflow `pages-configurator.yml` публикует `site/` (ссылки на compositor и configurator).

## Схема assemble

| Поле | Назначение |
|------|------------|
| `canvas` | размер холста |
| `layers[]` | порядок: body → head → hair |
| `x`, `y`, `scale` | позиция слоя |
| `key_white` | убрать белый фон (и в браузере — общий toggle) |
