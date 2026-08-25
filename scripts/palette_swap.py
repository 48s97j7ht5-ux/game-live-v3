#!/usr/bin/env python3
"""Recolor a sprite by rewriting each pixel's color via a formula (e.g. hue
rotation) while every (x, y) position stays exactly where it is. No shapes,
no AI, no 3D — just f(x, y) -> color, recomputed.
"""

from __future__ import annotations

import argparse
import colorsys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def hue_rotate(img: Image.Image, degrees: float) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out_px = out.load()

    # Build a lookup cache: same input color always maps to the same output
    # color, so on a 21-color sprite we do at most 21 real conversions.
    cache: dict[tuple[int, int, int, int], tuple[int, int, int, int]] = {}
    shift = degrees / 360.0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            key = (r, g, b, a)
            if key not in cache:
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                hh = (hh + shift) % 1.0
                nr, ng, nb = colorsys.hsv_to_rgb(hh, ss, vv)
                cache[key] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
            out_px[x, y] = cache[key]

    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Hue-rotate a sprite, pixel positions untouched")
    parser.add_argument("input", help="Source PNG")
    parser.add_argument("--out-dir", default=str(ROOT / "output" / "palette_swap"))
    parser.add_argument("--degrees", type=float, nargs="+", default=[0, 40, 140, 260], help="Hue shifts to render")
    parser.add_argument("--scale", type=int, default=3, help="Nearest-neighbor preview upscale")
    args = parser.parse_args()

    src = Image.open(args.input).convert("RGBA")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for deg in args.degrees:
        variant = hue_rotate(src, deg)
        native_path = out_dir / f"variant_hue{int(deg):03d}.png"
        variant.save(native_path, "PNG")

        preview = variant.resize((variant.width * args.scale, variant.height * args.scale), Image.Resampling.NEAREST)
        preview_path = out_dir / f"variant_hue{int(deg):03d}_preview.png"
        preview.save(preview_path, "PNG")
        print(f"Wrote {native_path} + {preview_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
