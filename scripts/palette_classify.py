#!/usr/bin/env python3
"""Classify every color in a sprite_formula.py palette (skin / hair-or-dark /
other), using each color's actual pixel count and HSV position -- not a
single sampled pixel, the whole finite palette at once.

Skin heuristic: hue in the typical flesh-tone band, moderate-to-high
saturation, not too dark. This is a heuristic, not a proof -- flag it as
such, don't claim certainty a formula can't back up.
"""

from __future__ import annotations

import argparse
import colorsys
import json
from pathlib import Path


def classify(r: int, g: int, b: int, a: int) -> str:
    if a == 0:
        return "transparent"
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hue_deg = h * 360
    if v < 0.12:
        return "near-black (outline/hair/clothing)"
    if 10 <= hue_deg <= 45 and 0.25 <= s <= 0.75 and v >= 0.35:
        return "skin (candidate)"
    if s < 0.15 and v < 0.3:
        return "dark neutral (hair/clothing)"
    return "other"


def main() -> int:
    parser = argparse.ArgumentParser(description="Classify a sprite_formula.py palette by color")
    parser.add_argument("sprite_json")
    args = parser.parse_args()

    data = json.loads(Path(args.sprite_json).read_text(encoding="utf-8"))
    palette = data["palette"]

    counts = [0] * len(palette)
    for row in data["rows_rle"]:
        for idx, run_len in row:
            counts[idx] += run_len

    rows = []
    for i, (color, count) in enumerate(zip(palette, counts)):
        r, g, b, a = color
        label = classify(r, g, b, a)
        rows.append((i, r, g, b, a, count, label))

    rows.sort(key=lambda x: -x[5])

    print(f"{'idx':>3} {'hex':>9} {'rgba':>16} {'pixels':>7} {'label'}")
    for i, r, g, b, a, count, label in rows:
        print(f"{i:>3} #{r:02x}{g:02x}{b:02x} {str((r, g, b, a)):>16} {count:>7} {label}")

    skin_idx = [i for i, *_rest, label in rows if label == "skin (candidate)"]
    print(f"\nskin candidate indices: {skin_idx}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
