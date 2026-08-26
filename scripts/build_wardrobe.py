#!/usr/bin/env python3
"""Batch-extract every outfit in a folder against one base body.

Runs extract_clothing -> defringe for each clothed render and drops the
results into templates/wardrobe/<character>/, so a folder of renders becomes
a wearable wardrobe in one command instead of a dozen.

Two things it decides per garment rather than applying blindly:

Base choice matters more than any parameter. A base wearing dark underwear
cannot yield a dark garment over that area -- there is no colour difference
to detect -- which tore a hole through the black top and produced the 54.9%
IoU benchmark. Against a skin-toned base the same source recovered 169390 px
instead of 136728 (+24%). Pass the skin-toned base.

Defringe is skipped on dark garments. Its thin-structure rule keys on
skin-coloured pixels, and on a dark outfit against dark linework it ate
40896 px including real fabric (versus 23528 on blue jeans, where it worked
as intended). --dark-threshold controls where a garment counts as dark.
"""

from __future__ import annotations

import argparse
import colorsys
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

import defringe  # noqa: E402
import extract_clothing  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def dark_fraction(img: Image.Image, dark_v: float = 0.30) -> float:
    """Share of the garment's pixels that are dark.

    Deliberately not the mean: the raw layer still carries a light skin-toned
    fringe, which drags the average up enough to misclassify a genuinely black
    outfit. Measured on Kat's black tank+shorts -- mean 0.32 (indistinguishable
    from the blue jeans' 0.52 once tolerances are set), but median 0.15 and
    dark fraction 70%, against 15% for the jeans and 3% for the white dress.
    """
    px = img.convert("RGBA").load()
    w, h = img.size
    vals = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a:
                vals.append(colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[2])
    if not vals:
        return 0.0
    return sum(1 for v in vals if v < dark_v) / len(vals)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract every outfit in a folder against one base body")
    parser.add_argument("base", help="Base body render -- use the skin-toned one, not one in dark underwear")
    parser.add_argument("clothed", nargs="+", help="Clothed renders in the same pose")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--threshold", type=int, default=40)
    parser.add_argument("--min-blob", type=int, default=2000)
    parser.add_argument("--thin-radius", type=int, default=7)
    parser.add_argument("--dark-threshold", type=float, default=0.35, help="Dark-pixel share above which defringe is skipped as harmful")
    args = parser.parse_args()

    base = Image.open(args.base)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for path in args.clothed:
        p = Path(path)
        if p.resolve() == Path(args.base).resolve():
            continue
        raw = extract_clothing.extract(base, Image.open(p), args.threshold, align=True)
        garment = extract_clothing.largest_blobs(raw, args.min_blob)

        dark = dark_fraction(garment)
        if dark > args.dark_threshold:
            note = f"dark ({dark:.0%} dark px) -- defringe skipped"
        else:
            garment, dropped = defringe.drop_thin_skin(garment, args.thin_radius, 8.0, 48.0)
            note = f"{dark:.0%} dark px, defringe dropped {dropped}"

        kept = sum(1 for q in garment.getdata() if q[3] > 0)
        out_path = out_dir / f"{p.stem}.png"
        garment.save(out_path, "PNG")
        print(f"{p.stem:<34} {kept:>7} px  {note}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
