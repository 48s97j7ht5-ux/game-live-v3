#!/usr/bin/env python3
"""Extract a garment as a standalone layer by diffing a clothed render
against a base-body render of the same character.

This is the same "diff two renders that differ by one thing" trick used
for hair (hair_mask.py) and face features, applied to wardrobe: with the
body identical underneath, whatever changed between "underwear" and
"wearing a dress" IS the dress.

Unlike the earlier hair/face pairs -- which were generated as explicit
one-feature-apart pairs and landed pixel-aligned -- a batch of separately
generated outfit renders drifts in scale and position (the Kat dataset
varies by up to ~70px in subject height, and not every file is even the
same canvas size). So alignment is normalized on the content bounding box
first, otherwise the diff returns the character's silhouette rather than
the garment.

Residual sub-pixel misalignment still leaves a thin fringe along body
edges; the connected-component filter drops the specks, and --min-blob
tunes how aggressively.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def content_bbox(img: Image.Image, threshold: int = 25, step: int = 1) -> tuple[int, int, int, int]:
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    bg = px[2, 2]
    minx, maxx, miny, maxy = w, 0, h, 0
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > threshold:
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
    return minx, miny, maxx, maxy


def align_to(src: Image.Image, ref_bbox: tuple[int, int, int, int], canvas: tuple[int, int]) -> Image.Image:
    """Scale+translate src so its content bbox matches ref_bbox on `canvas`."""
    sx0, sy0, sx1, sy1 = content_bbox(src)
    rx0, ry0, rx1, ry1 = ref_bbox
    src_h = max(1, sy1 - sy0)
    ref_h = max(1, ry1 - ry0)
    scale = ref_h / src_h

    cropped = src.convert("RGB").crop((sx0, sy0, sx1, sy1))
    new_size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    resized = cropped.resize(new_size, Image.Resampling.LANCZOS)

    out = Image.new("RGB", canvas, src.convert("RGB").getpixel((2, 2)))
    # centre horizontally on the reference bbox, align tops
    ref_cx = (rx0 + rx1) // 2
    out.paste(resized, (ref_cx - resized.width // 2, ry0))
    return out


def largest_blobs(img: Image.Image, min_blob: int) -> Image.Image:
    w, h = img.size
    px = img.load()
    visited = bytearray(w * h)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()

    for sy in range(h):
        for sx in range(w):
            if px[sx, sy][3] == 0 or visited[sy * w + sx]:
                continue
            stack = [(sx, sy)]
            visited[sy * w + sx] = 1
            comp = []
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not visited[ny * w + nx] and px[nx, ny][3] > 0:
                            visited[ny * w + nx] = 1
                            stack.append((nx, ny))
            if len(comp) >= min_blob:
                for x, y in comp:
                    op[x, y] = px[x, y]
    return out


def extract(base: Image.Image, clothed: Image.Image, threshold: int, align: bool) -> Image.Image:
    if align:
        ref = content_bbox(base)
        clothed = align_to(clothed, ref, base.size)

    base_rgb, clothed_rgb = base.convert("RGB"), clothed.convert("RGB")
    w, h = base_rgb.size
    bp, cp = base_rgb.load(), clothed_rgb.load()

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            ca, cb = bp[x, y], cp[x, y]
            if abs(ca[0] - cb[0]) + abs(ca[1] - cb[1]) + abs(ca[2] - cb[2]) > threshold:
                op[x, y] = (*cb, 255)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract a garment layer by diffing clothed vs base-body renders")
    parser.add_argument("base", help="Base-body render (underwear/nude base) -- the 'without garment' side")
    parser.add_argument("clothed", help="Render of the same character wearing the garment")
    parser.add_argument("-o", "--output", required=True)
    parser.add_argument("--threshold", type=int, default=40, help="Per-pixel color distance to count as changed")
    parser.add_argument("--min-blob", type=int, default=2000, help="Drop connected regions smaller than this (edge fringe)")
    parser.add_argument("--no-align", action="store_true", help="Skip bbox normalization (only if renders are already pixel-aligned)")
    parser.add_argument("--preview-scale", type=float, default=0.5)
    args = parser.parse_args()

    base = Image.open(args.base)
    clothed = Image.open(args.clothed)

    raw = extract(base, clothed, args.threshold, align=not args.no_align)
    cleaned = largest_blobs(raw, args.min_blob)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.save(out_path, "PNG")

    kept = sum(1 for p in cleaned.getdata() if p[3] > 0)
    total = sum(1 for p in raw.getdata() if p[3] > 0)
    print(f"Wrote {out_path} -- kept {kept} of {total} changed pixels")

    if args.preview_scale and args.preview_scale != 1:
        pw = max(1, int(cleaned.width * args.preview_scale))
        ph = max(1, int(cleaned.height * args.preview_scale))
        prev = cleaned.resize((pw, ph))
        bg = Image.new("RGBA", prev.size, (60, 60, 70, 255))
        preview_path = out_path.with_name(out_path.stem + "_preview.png")
        Image.alpha_composite(bg, prev).save(preview_path)
        print(f"Wrote {preview_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
