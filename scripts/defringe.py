#!/usr/bin/env python3
"""Remove the body-outline fringe that diff-based extraction leaves behind.

The junk along a garment's edges is not random noise -- it is a systematic
artifact: two independently generated renders never line up to the pixel, so
the diff picks up a thin ribbon of the body's own outline and skin. Because
it is systematic, a rule kills it; no training data required.

Two rules, in order of how much they catch (measured on the Kat tank+jeans
extraction):

  edge-band  -- drop skin-coloured pixels sitting in the band between the
                base body's silhouette and its erosion. Caught 7.7k pixels.
                Limited, because the fringe traces the *clothed* render's
                outline, which after alignment still differs from the base's.
  thin       -- drop skin-coloured pixels that do not survive a morphological
                opening. Real garment area is thick and survives; a one-to-
                few-pixel ribbon does not. Caught 23.5k pixels, and is the
                rule that actually clears the fringe.

What neither rule removes is the character's *dark* outline, since it is not
skin-coloured. Extending the thin-structure test to dark pixels would also
eat the garment's own outline, so that one is left for manual cleanup.

Dropping pixels can also fragment what was one solid blob (already past
extract_clothing's --min-blob filter) into several disconnected shards, each
now individually below that size threshold -- orphans that the original
filter pass never saw. Found on kat_16's shorts: a dark leg-contour leak from
knee to toe survived extraction as part of one >2000px blob, then the
thin-structure rule ate the middle of it and left ~15 disconnected fragments
(89-265px each) scattered down the leg, invisible in the pixel-count total
but visible as noise once the garment moved to a body with a different leg
line. A second largest_blobs pass after defringe -- not before -- catches
these; run automatically here unless --no-refilter is given.
"""

from __future__ import annotations

import argparse
import colorsys
import sys
from pathlib import Path

from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))

import extract_clothing  # noqa: E402


def is_skinlike(r: int, g: int, b: int, hue_lo: float, hue_hi: float) -> bool:
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return hue_lo <= h * 360 <= hue_hi and 0.12 <= s <= 0.85 and v >= 0.28


def skin_mask(img: Image.Image, hue_lo: float, hue_hi: float) -> Image.Image:
    w, h = img.size
    px = img.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and is_skinlike(r, g, b, hue_lo, hue_hi):
                mp[x, y] = 255
    return mask


def drop_thin_skin(img: Image.Image, radius: int, hue_lo: float, hue_hi: float) -> tuple[Image.Image, int]:
    """Morphological opening on the skin-coloured subset; thin ribbons vanish."""
    w, h = img.size
    px = img.load()
    skin = skin_mask(img, hue_lo, hue_hi)
    opened = skin.filter(ImageFilter.MinFilter(radius)).filter(ImageFilter.MaxFilter(radius))
    sp, op = skin.load(), opened.load()

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = out.load()
    dropped = 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0:
                continue
            if sp[x, y] == 255 and op[x, y] == 0:
                dropped += 1
                continue
            o[x, y] = p
    return out, dropped


def drop_edge_band(img: Image.Image, base: Image.Image, band: int, hue_lo: float, hue_hi: float) -> tuple[Image.Image, int]:
    w, h = img.size
    px = img.load()
    base_rgb = base.convert("RGB")
    bp = base_rgb.load()
    bg = bp[2, 2]

    sil = Image.new("L", (w, h), 0)
    sp = sil.load()
    for y in range(h):
        for x in range(w):
            r, g, b = bp[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 30:
                sp[x, y] = 255
    ep = sil.filter(ImageFilter.MinFilter(band)).load()

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = out.load()
    dropped = 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0:
                continue
            if sp[x, y] == 255 and ep[x, y] == 0 and is_skinlike(p[0], p[1], p[2], hue_lo, hue_hi):
                dropped += 1
                continue
            o[x, y] = p
    return out, dropped


def main() -> int:
    parser = argparse.ArgumentParser(description="Strip body-outline fringe from an extracted garment layer")
    parser.add_argument("garment", help="Layer produced by extract_clothing.py")
    parser.add_argument("-o", "--output", required=True)
    parser.add_argument("--base", help="Base-body render; enables the edge-band rule as well")
    parser.add_argument("--thin-radius", type=int, default=7, help="Opening radius; larger removes thicker ribbons (and risks eating thin garment parts)")
    parser.add_argument("--band", type=int, default=9, help="Edge-band width for the --base rule")
    parser.add_argument("--hue-lo", type=float, default=8.0, help="Skin hue range, degrees")
    parser.add_argument("--hue-hi", type=float, default=48.0)
    parser.add_argument("--no-refilter", action="store_true", help="Skip the post-defringe largest_blobs pass (keeps orphaned fragments defringe can create)")
    parser.add_argument("--refilter-min-blob", type=int, default=2000, help="Size threshold for the post-defringe re-filter")
    parser.add_argument("--preview-scale", type=float, default=0.5)
    args = parser.parse_args()

    img = Image.open(args.garment).convert("RGBA")

    total = 0
    if args.base:
        img, n = drop_edge_band(img, Image.open(args.base), args.band, args.hue_lo, args.hue_hi)
        print(f"edge-band rule dropped {n}")
        total += n

    img, n = drop_thin_skin(img, args.thin_radius, args.hue_lo, args.hue_hi)
    print(f"thin-structure rule dropped {n}")
    total += n

    if not args.no_refilter:
        before = sum(1 for p in img.getdata() if p[3] > 0)
        img = extract_clothing.largest_blobs(img, args.refilter_min_blob)
        after = sum(1 for p in img.getdata() if p[3] > 0)
        if before != after:
            print(f"post-defringe re-filter dropped {before - after} orphaned fragments")
            total += before - after

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    kept = sum(1 for p in img.getdata() if p[3] > 0)
    print(f"Wrote {out_path} -- dropped {total}, kept {kept}")

    if args.preview_scale and args.preview_scale != 1:
        pw = max(1, int(img.width * args.preview_scale))
        ph = max(1, int(img.height * args.preview_scale))
        prev = img.resize((pw, ph))
        bg = Image.new("RGBA", prev.size, (60, 60, 70, 255))
        pp = out_path.with_name(out_path.stem + "_preview.png")
        Image.alpha_composite(bg, prev).save(pp)
        print(f"Wrote {pp}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
