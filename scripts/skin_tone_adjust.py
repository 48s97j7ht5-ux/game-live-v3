#!/usr/bin/env python3
"""Retint skin tones in a sprite_formula.py palette, keeping the shading
structure intact. Every skin-classified palette entry (shadow through
highlight, see palette_classify.py) gets the SAME HSV transform, so the
relative darkness relationships survive -- only the palette array changes,
not a single pixel position (rows_rle is untouched).
"""

from __future__ import annotations

import argparse
import colorsys
import json
from pathlib import Path

from palette_classify import classify


def retint_skin(data: dict, value_mult: float, sat_delta: float, hue_shift_deg: float) -> tuple[dict, list[int]]:
    palette = data["palette"]
    skin_idx = []

    new_palette = []
    for i, (r, g, b, a) in enumerate(palette):
        label = classify(r, g, b, a)
        if label != "skin (candidate)":
            new_palette.append([r, g, b, a])
            continue

        skin_idx.append(i)
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        h = (h + hue_shift_deg / 360) % 1.0
        s = max(0.0, min(1.0, s + sat_delta))
        v = max(0.0, min(1.0, v * value_mult))
        nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
        new_palette.append([round(nr * 255), round(ng * 255), round(nb * 255), a])

    out = dict(data)
    out["palette"] = new_palette
    return out, skin_idx


def main() -> int:
    parser = argparse.ArgumentParser(description="Retint only the skin-classified colors in a sprite palette")
    parser.add_argument("sprite_json")
    parser.add_argument("-o", "--output")
    parser.add_argument("--value-mult", type=float, default=0.78, help="Multiply V (darker < 1.0 < lighter)")
    parser.add_argument("--sat-delta", type=float, default=0.06, help="Add to S (tan skin: usually more saturated)")
    parser.add_argument("--hue-shift", type=float, default=-4.0, help="Degrees to shift H (negative = warmer/browner)")
    args = parser.parse_args()

    data = json.loads(Path(args.sprite_json).read_text(encoding="utf-8"))
    new_data, skin_idx = retint_skin(data, args.value_mult, args.sat_delta, args.hue_shift)

    out_path = Path(args.output) if args.output else Path(args.sprite_json).with_name(
        Path(args.sprite_json).stem.replace(".sprite", "") + ".tan.sprite.json"
    )
    out_path.write_text(json.dumps(new_data), encoding="utf-8")
    print(f"Retinted {len(skin_idx)} skin colors (indices {skin_idx})")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
