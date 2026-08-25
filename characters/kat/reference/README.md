# Kat — референс (хранение)

Сюда складываем **экспорты (Gemini / Leonardo)**, пока не разложены по `templates/`.

**Промпты Gemini (512 px, ~300 px рост, палитра 32):** [`docs/gemini-pixel-prompts.md`](../../docs/gemini-pixel-prompts.md)

## Файлы (загрузите PNG сюда)

| Файл | Описание |
|------|----------|
| `kat-fullbody-neutral-512.png` | **Целиком:** референс пропорций, ¾, ~300 px высота в кадре 512×512. |
| `kat-head-base-512.png` | **Голова/шея без черт** — для слоя `head`. |
| `kat-body-pregnant-512.png` | Вариант тела (не face-compositor). |

Старые имена `*-1024.png` можно оставить как архив; для новых генераций — **512**.

GitHub → `characters/kat/reference/` → **Add file** → выберите PNG с телефона.

## Куда потом класть для сборки

| Назначение | Путь в репо |
|------------|-------------|
| Слой `head` в лице | `templates/face/head/` (например `kat_head_base.png`) |
| Тело | `templates/parts/body/` |
| Волосы | `templates/face/hair/` или `templates/parts/hair/` |

JSON координат: `characters/kat/face-assemble.json` — обновить поле `file` после переименования.

## Инструменты

- Лицо (7 слоёв): [face-compositor](https://48s97j7ht5-ux.github.io/game-live-v3/face-compositor/)
- Тело: [compositor](https://48s97j7ht5-ux.github.io/game-live-v3/compositor/)
