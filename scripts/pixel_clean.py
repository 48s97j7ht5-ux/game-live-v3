#!/usr/bin/env python3
"""Shared helper: recover a true low-res pixel grid from a noisy/upscaled
source (JPEG artifacts, or a "pixel-art styled" image that was never
actually indexed to a small palette).

Use BOX (area-average) downscaling, never NEAREST, for this: NEAREST would
just pick one already-noisy sample per cell; BOX averages every real pixel
in the cell, which cancels out both JPEG ringing and soft antialiasing at
once. Any per-pixel script in this repo (palette_swap.py, proportion_warp.py,
face_layer_extract.py) should call this first when the source isn't already
a clean low-color sprite -- check with `unique_color_count`.
"""

from __future__ import annotations

from PIL import Image


def unique_color_count(img: Image.Image) -> int:
    colors = img.convert("RGB").getcolors(maxcolors=4_000_000)
    return len(colors) if colors is not None else -1


def box_downscale(img: Image.Image, factor: int) -> Image.Image:
    if factor <= 1:
        return img
    w, h = img.size
    return img.resize((max(1, w // factor), max(1, h // factor)), Image.Resampling.BOX)
