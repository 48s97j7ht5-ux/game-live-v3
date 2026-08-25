#!/usr/bin/env python3
"""Reshape body proportions on an EXISTING illustrated sprite by warping
pixel coordinates only. No new detail is synthesized — every source pixel
(face, fabric, print) just gets remapped to a new (x, y), the same way the
palette-swap script remaps color only. Here we remap position only, driven
by phenotype-style parameters (shoulder/waist/hip/leg width), matching the
sliders already in characters/<id>/appearance.json.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def detect_content_rows(img: Image.Image, bg: tuple[int, int, int], threshold: int = 18) -> list[tuple[int, int]]:
    """Per row: (min_x, max_x) of pixels differing from bg, or (-1, -1) if empty row."""
    w, h = img.size
    px = img.load()
    rows = []
    for y in range(h):
        min_x, max_x = -1, -1
        for x in range(w):
            r, g, b = px[x, y][:3]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > threshold:
                if min_x == -1:
                    min_x = x
                max_x = x
        rows.append((min_x, max_x))
    return rows


def band_scale(y_frac: float, bands: list[tuple[float, float]]) -> float:
    """bands: [(y_frac_center, scale), ...] sorted by y_frac_center. Linear interp."""
    if y_frac <= bands[0][0]:
        return bands[0][1]
    if y_frac >= bands[-1][0]:
        return bands[-1][1]
    for (y0, s0), (y1, s1) in zip(bands, bands[1:]):
        if y0 <= y_frac <= y1:
            t = (y_frac - y0) / (y1 - y0)
            return s0 + t * (s1 - s0)
    return 1.0


def warp(img: Image.Image, bg: tuple[int, int, int], bands: list[tuple[float, float]]) -> Image.Image:
    w, h = img.size
    src = img.convert("RGB")
    rows = detect_content_rows(src, bg)
    content_ys = [y for y, (a, b) in enumerate(rows) if a != -1]
    top, bottom = min(content_ys), max(content_ys)

    out = Image.new("RGB", (w, h), bg)
    src_px = src.load()
    out_px = out.load()

    for y in range(h):
        min_x, max_x = rows[y]
        if min_x == -1:
            continue
        center = (min_x + max_x) / 2
        y_frac = (y - top) / max(1, (bottom - top))
        scale = band_scale(y_frac, bands)
        for ox in range(w):
            sx = center + (ox - center) / scale
            sxi = round(sx)
            if 0 <= sxi < w:
                out_px[ox, y] = src_px[sxi, y]

    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Parametric proportion warp (position only, no new detail)")
    parser.add_argument("input")
    parser.add_argument("--out-dir", default=str(ROOT / "output" / "proportion_warp"))
    args = parser.parse_args()

    src = Image.open(args.input).convert("RGB")
    bg = src.getpixel((2, 2))

    presets = {
        "default": [(0.0, 1.0), (0.2, 1.0), (0.4, 1.0), (0.6, 1.0), (1.0, 1.0)],
        # y bands: 0=shoulders/chest, 0.2=waist, 0.4=hips, 0.6=thighs, 1.0=ankles
        "heavier": [(0.0, 1.15), (0.2, 1.35), (0.4, 1.3), (0.6, 1.15), (1.0, 1.0)],
        "slimmer_taller": [(0.0, 0.9), (0.2, 0.8), (0.4, 0.85), (0.6, 0.92), (1.0, 1.0)],
    }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, bands in presets.items():
        result = warp(src, bg, bands)
        path = out_dir / f"{name}.png"
        result.save(path, "PNG")
        print(f"Wrote {path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
