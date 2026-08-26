#!/usr/bin/env python3
"""Detect a "pseudo-pixel" export's real native grid, instead of guessing a
downscale factor.

A generator that draws at low resolution and upscales for export (soft
resample, not NEAREST) leaves a real signature behind: within a block the
size of one native pixel, colour barely varies -- it's mostly one flat
colour plus the resample's own blur. Shift the sampling grid by half a block
and every window now straddles two different native pixels, so variance
jumps. Off the true grid size, aligned and half-offset variance are within
noise of each other, because there's no real grid to misalign from.

Get the per-factor offset search right or the result is meaningless: an
earlier pass here picked one (factor, offset) pair by raw minimum variance
across ALL factors at once, which is biased toward small factors -- fewer
pixels per block just have less internal variance regardless of any real
grid alignment. Fixed by finding each factor's OWN best-fitting offset first,
then only comparing that offset's aligned vs. half-offset ratio -- this
flipped the answer on both test images from the biased version, which is why
the ratio table is worth reading in full rather than trusting a single
number: the real grid is the one with a ratio clearly above its neighbours in
the same table, not the one with the lowest raw variance.

Run on two Kat references this session: one showed a ratio spike at factor 6
(canvas 1024x1536 -> 170x256, ratio 1.308 vs. 1.03-1.08 for factors 5 and
7-11); a second, different generation spiked at factor 8 (887x1774 -> 110x221,
ratio 1.219 vs. 1.02-1.10 elsewhere). Neither result is a round number the
way a deliberately-authored 128x192 grid would be, which is a real reason for
caution before treating either as confirmed ground truth rather than a
statistical lean -- and the two images, despite looking like the same kind of
export, don't share a grid, so each file needs its own check.

This is diagnostic, not a general-purpose filter: it answers "what factor
should flatten_to_sprite.py --downscale actually use for this file", it does
not itself produce a sprite.
"""

from __future__ import annotations

import argparse

import numpy as np
from PIL import Image


def block_variance(arr: np.ndarray, factor: int, ox: int, oy: int, bg_thresh: float = 8.0) -> float | None:
    h, w, _ = arr.shape
    hh, ww = (h - oy) // factor, (w - ox) // factor
    if hh < 2 or ww < 2:
        return None
    crop = arr[oy : oy + hh * factor, ox : ox + ww * factor, :]
    blocks = crop.reshape(hh, factor, ww, factor, 3)
    mean = blocks.mean(axis=(1, 3))
    fg = ~((mean[..., 0] < bg_thresh) & (mean[..., 1] < bg_thresh) & (mean[..., 2] < bg_thresh))
    if fg.sum() == 0:
        return None
    var = blocks.var(axis=(1, 3)).sum(axis=-1)
    return float(var[fg].mean())


def find_grid(img: Image.Image, lo: int, hi: int) -> list[tuple[int, float]]:
    """For each candidate factor, the best (min-variance) offset's aligned
    variance vs. its own half-block offset. Returns (factor, ratio) sorted by
    ratio descending -- the real grid size stands out as a ratio well above 1
    with a gap to its neighbours, not by ratio alone (compare across the
    whole table, not just the top row).
    """
    arr = np.asarray(img.convert("RGB")).astype(np.float64)
    results = []
    for factor in range(lo, hi + 1):
        best = None
        for ox in range(factor):
            for oy in range(factor):
                v = block_variance(arr, factor, ox, oy)
                if v is not None and (best is None or v < best[0]):
                    best = (v, ox, oy)
        if best is None:
            continue
        v0, ox, oy = best
        v_off = block_variance(arr, factor, (ox + factor // 2) % factor, (oy + factor // 2) % factor)
        if v_off is None:
            continue
        results.append((factor, ox, oy, v_off / v0))
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect the real native pixel grid behind a soft-upscaled export")
    parser.add_argument("image")
    parser.add_argument("--lo", type=int, default=4, help="Smallest candidate factor")
    parser.add_argument("--hi", type=int, default=14, help="Largest candidate factor")
    args = parser.parse_args()

    img = Image.open(args.image)
    results = find_grid(img, args.lo, args.hi)

    print(f"{'factor':>6} {'offset':>10} {'aligned/half-offset ratio':>26}")
    for factor, ox, oy, ratio in results:
        marker = "  <-- likely native grid" if ratio == max(r[3] for r in results) else ""
        print(f"{factor:>6} {f'({ox},{oy})':>10} {ratio:>26.3f}{marker}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
