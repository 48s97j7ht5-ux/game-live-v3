#!/usr/bin/env python3
"""Pure-math pixel character generator: no AI, no network, no external art.

Every body part is a geometric primitive (ellipse / polygon / rectangle)
with explicit pixel coordinates and a flat fill color, drawn with PIL's
default (non-antialiased) rasterizer -> hard pixel edges for free.
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]

W, H = 32, 48  # native sprite size
CX = W // 2

PALETTES = [
    {"skin": "#e8b48c", "hair": "#2b2320", "shirt": "#3a5a8c", "pants": "#33323a", "shoes": "#1a1a1a"},
    {"skin": "#c98a5e", "hair": "#111111", "shirt": "#7a2f3b", "pants": "#28303a", "shoes": "#171717"},
    {"skin": "#f0c8a0", "hair": "#8a5a2b", "shirt": "#2f6b4f", "pants": "#3a2f28", "shoes": "#1a1a1a"},
    {"skin": "#8a5a3c", "hair": "#1a1a1a", "shirt": "#c48a2f", "pants": "#2a2a2a", "shoes": "#111111"},
]

OUTLINE = "#1a120b"
EYE = "#1a1a1a"


def _rgba(hex_color: str) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    return (r, g, b, 255)


def draw_character(colors: dict) -> Image.Image:
    skin = _rgba(colors["skin"])
    hair = _rgba(colors["hair"])
    shirt = _rgba(colors["shirt"])
    pants = _rgba(colors["pants"])
    shoes = _rgba(colors["shoes"])
    outline = _rgba(OUTLINE)
    eye = _rgba(EYE)

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # legs (two rectangles, small gap at center)
    d.rectangle([9, 33, 14, 42], fill=pants, outline=outline)
    d.rectangle([18, 33, 23, 42], fill=pants, outline=outline)
    # shoes
    d.rectangle([8, 42, 15, 46], fill=shoes, outline=outline)
    d.rectangle([17, 42, 24, 46], fill=shoes, outline=outline)

    # torso (trapezoid: shoulders wider than waist)
    d.polygon([(7, 20), (25, 20), (23, 33), (9, 33)], fill=shirt, outline=outline)

    # arms (short sleeves -> skin forearm)
    d.rectangle([3, 21, 7, 30], fill=skin, outline=outline)
    d.rectangle([25, 21, 29, 30], fill=skin, outline=outline)

    # neck
    d.rectangle([14, 16, 18, 21], fill=skin, outline=outline)

    # head
    d.ellipse([9, 2, 23, 18], fill=skin, outline=outline)

    # eyes
    d.rectangle([12, 10, 13, 11], fill=eye)
    d.rectangle([19, 10, 20, 11], fill=eye)

    # hair cap (covers top of head)
    d.pieslice([8, 0, 24, 16], start=180, end=360, fill=hair, outline=outline)
    d.rectangle([8, 6, 10, 14], fill=hair, outline=outline)
    d.rectangle([22, 6, 24, 14], fill=hair, outline=outline)

    return img


def main() -> int:
    parser = argparse.ArgumentParser(description="Procedural pixel character generator (no AI)")
    parser.add_argument("--out", default=str(ROOT / "output" / "procedural"), help="Output directory")
    parser.add_argument("--count", type=int, default=1, help="How many random variants to generate")
    parser.add_argument("--scale", type=int, default=8, help="Nearest-neighbor upscale factor for preview PNGs")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducible batches")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    for i in range(args.count):
        colors = random.choice(PALETTES)
        img = draw_character(colors)

        native_path = out_dir / f"char_{i:02d}_{W}x{H}.png"
        img.save(native_path, "PNG")

        preview = img.resize((W * args.scale, H * args.scale), Image.Resampling.NEAREST)
        preview_path = out_dir / f"char_{i:02d}_preview.png"
        preview.save(preview_path, "PNG")

        meta_path = out_dir / f"char_{i:02d}.json"
        meta_path.write_text(json.dumps({"colors": colors, "size": [W, H]}, indent=2), encoding="utf-8")

        print(f"Wrote {native_path} + {preview_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
