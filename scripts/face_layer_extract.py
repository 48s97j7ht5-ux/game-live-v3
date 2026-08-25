#!/usr/bin/env python3
"""Slice a grid of composed face portraits into individual heads, then pull
eyes/lips out of one head as standalone transparent layers — the exact
format characters/<id>/face-assemble.json expects (templates/face/eyes/,
templates/face/lips/).

Two purely mathematical steps, no ML model:
1. Grid slicing: divide the canvas into equal cells (rows x cols).
2. Feature isolation: within a proportional band of the head's bounding
   box (e.g. "eyes live at 40-62% down the face"), keep only pixels whose
   color differs enough from the sampled skin tone; everything else -> alpha 0.

Nose is intentionally NOT attempted here: it is shaded, not colored,
differently from skin, so a color-distance mask does not isolate it
(documented as a known limitation, not silently skipped).
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

from pixel_clean import box_downscale, unique_color_count

ROOT = Path(__file__).resolve().parents[1]


def content_bbox(img: Image.Image, bg: tuple[int, int, int], threshold: int = 20) -> tuple[int, int, int, int]:
    w, h = img.size
    px = img.load()
    minx, maxx, miny, maxy = w, 0, h, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > threshold:
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
    return minx, miny, maxx, maxy


def sample_skin(img: Image.Image, bbox: tuple[int, int, int, int]) -> tuple[int, int, int]:
    minx, miny, maxx, maxy = bbox
    bw, bh = maxx - minx, maxy - miny
    # left cheek: below eye height, beside the nose, away from hair/eyes/mouth
    x = minx + round(bw * 0.20)
    y = miny + round(bh * 0.52)
    return img.getpixel((x, y))[:3]


def isolate_band(
    img: Image.Image,
    bbox: tuple[int, int, int, int],
    y0_frac: float,
    y1_frac: float,
    skin: tuple[int, int, int],
    threshold: int,
    x0_frac: float = 0.0,
    x1_frac: float = 1.0,
) -> Image.Image:
    minx, miny, maxx, maxy = bbox
    bw, bh = maxx - minx, maxy - miny
    y0 = miny + round(bh * y0_frac)
    y1 = miny + round(bh * y1_frac)
    x0 = minx + round(bw * x0_frac)
    x1 = minx + round(bw * x1_frac)

    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    src = img.convert("RGB")
    src_px = src.load()
    out_px = out.load()

    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = src_px[x, y]
            diff = abs(r - skin[0]) + abs(g - skin[1]) + abs(b - skin[2])
            if diff > threshold:
                out_px[x, y] = (r, g, b, 255)

    return out.crop((x0, y0, x1, y1))


def main() -> int:
    parser = argparse.ArgumentParser(description="Slice a face-expression grid and extract eyes/lips layers")
    parser.add_argument("input")
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--cell", type=int, default=0, help="Which cell (0-indexed, row-major) to extract layers from")
    parser.add_argument("--out-dir", default=str(ROOT / "output" / "face_layers"))
    parser.add_argument(
        "--downscale",
        type=int,
        default=1,
        help="Box-filter downscale factor to run BEFORE slicing/extraction, to recover a true "
        "low-res pixel grid from a noisy JPEG / soft-antialiased source (see pixel_clean.py). "
        "Try 8 if the source is a ~1024px 'pixel art styled' export.",
    )
    args = parser.parse_args()

    grid = Image.open(args.input).convert("RGB")
    if args.downscale > 1:
        before = unique_color_count(grid)
        grid = box_downscale(grid, args.downscale)
        after = unique_color_count(grid)
        print(f"Downscaled /{args.downscale}: {grid.size}, unique colors {before} -> {after}")
    gw, gh = grid.size
    cw, ch = gw // args.cols, gh // args.rows
    bg = grid.getpixel((2, 2))

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    row, col = divmod(args.cell, args.cols)
    cell_img = grid.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
    cell_img.save(out_dir / f"head_{args.cell:02d}.png")

    bbox = content_bbox(cell_img, bg)
    skin = sample_skin(cell_img, bbox)
    print(f"head bbox={bbox} skin={skin}")

    eyes = isolate_band(cell_img, bbox, 0.55, 0.70, skin, threshold=45, x0_frac=0.12, x1_frac=1.0)
    eyes.save(out_dir / f"eyes_{args.cell:02d}.png")

    lips = isolate_band(cell_img, bbox, 0.80, 0.90, skin, threshold=25, x0_frac=0.15, x1_frac=0.85)
    lips.save(out_dir / f"lips_{args.cell:02d}.png")

    print(f"Wrote {out_dir}/head_{args.cell:02d}.png, eyes_{args.cell:02d}.png, lips_{args.cell:02d}.png")
    print("Nose skipped: shading-only feature, color-distance masking doesn't isolate it (see module docstring).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
