#!/usr/bin/env python3
"""Build a real hair-vs-skin mask from two aligned renders of the same
character/pose/outfit -- one with hair, one bald -- instead of guessing
from color alone (see skin_tone_adjust.py's --exclude: a color-only
approach hit a hard limit when hair and skin shadow share literal RGB
values). Wherever the bald render disagrees with the haired render by
more than --threshold in the head region, that's hair, whatever color
it happens to be. This is ground truth from geometry, not a heuristic.

apply_mask() then patches a recolored image: any pixel the mask marks as
hair gets its ORIGINAL color put back, undoing whatever a palette-level
tool like skin_tone_adjust.py did to it -- because the recolor works by
palette index (fast, but blind to position), while hair is a position
problem, not a color problem.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

from pixel_clean import box_downscale


def build_mask(bald: Image.Image, haired: Image.Image, head_frac: float, threshold: int) -> Image.Image:
    bald, haired = bald.convert("RGBA"), haired.convert("RGBA")
    w, h = haired.size
    bp, hp = bald.load(), haired.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()

    y_limit = int(h * head_frac)
    for y in range(y_limit):
        for x in range(w):
            hc = hp[x, y]
            if hc[3] < 10:
                continue
            bc = bp[x, y]
            dist = abs(hc[0] - bc[0]) + abs(hc[1] - bc[1]) + abs(hc[2] - bc[2])
            if bc[3] < 10 or dist > threshold:
                mp[x, y] = 255

    return mask


def downscale_mask(mask: Image.Image, factor: int, coverage: float = 0.5) -> Image.Image:
    small = box_downscale(mask.convert("L"), factor)
    return small.point(lambda v: 255 if v >= 255 * coverage else 0)


def apply_mask(recolored: Image.Image, original: Image.Image, mask: Image.Image) -> Image.Image:
    recolored, original = recolored.convert("RGBA"), original.convert("RGBA")
    out = recolored.copy()
    out_px, orig_px, mp = out.load(), original.load(), mask.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            if mp[x, y] > 0:
                out_px[x, y] = orig_px[x, y]
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Build/apply a hair mask from a bald + haired reference pair")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_build = sub.add_parser("build")
    p_build.add_argument("bald")
    p_build.add_argument("haired")
    p_build.add_argument("-o", "--output", required=True)
    p_build.add_argument("--head-frac", type=float, default=0.35, help="Fraction of image height to scan (top of frame)")
    p_build.add_argument("--threshold", type=int, default=90)
    p_build.add_argument("--downscale", type=int, default=1, help="Also box-downscale the mask by this factor")

    p_apply = sub.add_parser("apply")
    p_apply.add_argument("recolored")
    p_apply.add_argument("original")
    p_apply.add_argument("mask")
    p_apply.add_argument("-o", "--output", required=True)

    args = parser.parse_args()

    if args.cmd == "build":
        mask = build_mask(Image.open(args.bald), Image.open(args.haired), args.head_frac, args.threshold)
        if args.downscale > 1:
            mask = downscale_mask(mask, args.downscale)
        mask.save(args.output)
        print(f"Wrote {args.output} ({mask.size}), hair pixels: {sum(1 for v in mask.getdata() if v > 0)}")

    elif args.cmd == "apply":
        result = apply_mask(Image.open(args.recolored), Image.open(args.original), Image.open(args.mask))
        result.save(args.output)
        print(f"Wrote {args.output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
