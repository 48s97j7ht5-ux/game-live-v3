#!/usr/bin/env python3
"""Turn a soft-shaded AI export (smooth gradients, thousands of colors) into
a real limited-palette sprite: box-downscale to a target size, then quantize
to a small flat palette. Two separate problems, two separate fixes (see
pixel_clean.py for why BOX and not NEAREST):

- Downscaling alone fixes noise/oversampling but does NOT flatten genuine
  continuous shading (a real gradient stays a gradient at any resolution).
- Quantization forces a small flat palette, which is what turns that
  gradient into cel-shading bands -- the actual "pixel art" look, and what
  docs/gemini-pixel-prompts.md's 32-color budget assumes.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

from pixel_clean import box_downscale, unique_color_count

ROOT = Path(__file__).resolve().parents[1]


def flatten(img: Image.Image, downscale: int, colors: int) -> Image.Image:
    img = img.convert("RGBA")
    small = box_downscale(img, downscale)

    rgb = small.convert("RGB")
    quantized = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    quantized = quantized.convert("RGBA")
    quantized.putalpha(small.split()[3])
    return quantized


def main() -> int:
    parser = argparse.ArgumentParser(description="Box-downscale + palette-quantize an AI sprite export")
    parser.add_argument("input")
    parser.add_argument("-o", "--output", help="Output PNG path (native size)")
    parser.add_argument("--downscale", type=int, default=6, help="Box downscale factor before quantizing")
    parser.add_argument("--colors", type=int, default=32, help="Target palette size (project spec: <=32; tested safe floor ~12-16, breaks around 4)")
    parser.add_argument("--preview-scale", type=int, default=3, help="Nearest-neighbor upscale factor for a *_preview.png")
    args = parser.parse_args()

    src = Image.open(args.input)
    before = unique_color_count(src)
    result = flatten(src, args.downscale, args.colors)
    after = unique_color_count(result)
    print(f"{src.size} ({before} colors) -> {result.size} ({after} colors)")

    out_path = Path(args.output) if args.output else ROOT / "output" / "flatten" / "sprite.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(out_path, "PNG")
    print(f"Wrote {out_path}")

    if args.preview_scale > 1:
        preview = result.resize((result.width * args.preview_scale, result.height * args.preview_scale), Image.Resampling.NEAREST)
        preview_path = out_path.with_name(out_path.stem + "_preview.png")
        preview.save(preview_path, "PNG")
        print(f"Wrote {preview_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
