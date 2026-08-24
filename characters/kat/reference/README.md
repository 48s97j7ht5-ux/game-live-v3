# Kat — референс (хранение)

Сюда складываем **цельные спрайты** из Leonardo / экспорта, пока не нарезаны на слои.

## Файл

| Файл | Описание |
|------|----------|
| `kat-fullbody-neutral-1024.png` | Полное тело, нейтральная поза, ¾, ~1024×1024. Белая майка, серые шорты, чёрные волосы/носки. Персонаж **по центру кадра** (для этого экспорта X≈0 на body-compositor; у отдельных head/lips PNG отступы могут быть другими). |

Загрузите PNG в эту папку через GitHub (Add file) или с телефона в репо.

## Не путать с

- `templates/face/*` — модульное **лицо** (7 слоёв).
- `templates/parts/*` — body / head / hair для [`compositor/`](../../../compositor/).
- `characters/kat/face-assemble.json` — только координаты лица, не картинка.

## Дальше

- Body: [`compositor/`](https://48s97j7ht5-ux.github.io/game-live-v3/compositor/) или нарезка на `body_base` + волосы.
- Лицо: отдельные PNG в `templates/face/` + [`face-compositor/`](https://48s97j7ht5-ux.github.io/game-live-v3/face-compositor/).
