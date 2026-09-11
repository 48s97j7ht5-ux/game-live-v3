# Kat — референс (хранение)

Сюда складываем **экспорты (Gemini / Leonardo)**, пока не разложены по `templates/`.

**Масштаб и стиль (400 px master):** [`docs/character-scale-kat.md`](../../../docs/character-scale-kat.md)  
**Промпты Gemini (512 px, refine):** [`docs/gemini-pixel-prompts.md`](../../../docs/gemini-pixel-prompts.md)

## Файлы в репо (Cursor)

| Файл | Описание |
|------|----------|
| `kat-scale-test-sheet-cursor.png` | Лист **200 / 300 / 400 px** + mock сцен (как ваш «ТЕСТ МАСШТАБА»). |
| `kat-fullbody-400px-cursor.png` | Один спрайт **400 px**, sports bra + шорты, прозрачный/белый фон. |
| `kat-pixel-base-reference-512.png` | База тела (faceless), 512 canvas. |

## Файлы (загрузите PNG сюда)

| Файл | Описание |
|------|----------|
| `scale-test-master.png` | Ваш оригинальный лист-макет (если отличается от cursor). |
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
