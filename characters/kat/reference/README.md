# Kat — референс (хранение)

Сюда складываем **экспорты Leonardo**, пока не разложены по `templates/`.

## Файлы (загрузите PNG сюда)

| Файл | Описание |
|------|----------|
| `kat-fullbody-neutral-1024.png` | **Целиком:** одежда, волосы, поза ¾. Персонаж часто **по центру кадра** → на compositor X≈0. |
| `kat-head-base-1024.png` | **База головы/шеи:** лысая «кукла», без черт лица, серый фон. Фигура **смещена вправо** внутри квадрата — слева широкое пустое поле → в face-compositor визуальный центр часто **X ≈ −300…−400** (это нормально: центрируем по содержимому, не по краю PNG). |

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
