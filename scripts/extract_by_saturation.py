#!/usr/bin/env python3
"""Lift a garment off a single sprite when there is no pair to diff.

extract_clothing.py needs two renders of one pose differing by one element.
That is the better method and should be preferred whenever a pair exists,
because it makes no assumption about what the garment looks like. But a pair
is not always available -- the bald underwear base kat_22 arrived on its own,
and there is no nude render of that pose to subtract.

For that case the garment has to be identified by its own colour. Hue does not
do it: on kat_22 the underwear sits at hue 26.5-27.5 and the skin at 19.5-21.6,
overlapping once shading spreads each of them. Saturation separates cleanly --
every garment shade lands at 28.9-42.7 and every skin shade at 44.0-78.2, with
the outline highest of all at 78.2. So the rule is a saturation ceiling plus
extract_clothing's own blob filter, which drops whatever stray pixels clear the
threshold without belonging to a real garment shape.

That gap is comfortable but not guaranteed, and the assumption is doing real
work here: it holds because this garment is a desaturated neutral against warm
skin. A saturated garment -- red, blue, anything with more chroma than skin --
inverts the test, and a garment whose saturation sits inside the skin range
cannot be separated this way at all. Run --report first and read the two ranges
before trusting the split; if they touch, use a pair and diff instead.

Recovering the outline needs a second pass. A garment's contour is drawn in the
same near-black as the body's, so saturation puts it firmly on the skin side
and the first pass leaves the garment edgeless -- which reads as flat the moment
the piece is worn on another body. --outline adds back the dark pixels adjacent
to the kept mask. Where the garment meets the silhouette that is the body's
outline too, and taking it is correct: at that edge they are the same line.

Colour-based extraction cannot do what a diff does. It finds pixels that look
like the garment, not pixels that changed, so it cannot recover a garment that
shares the body's colouring, and it cannot tell a garment from a same-coloured
prop. It is the fallback, not the method.
"""

from __future__ import annotations

import argparse
import colorsys

from PIL import Image

import extract_clothing


def saturation_report(img: Image.Image) -> list[tuple[float, int, str]]:
    px = img.load()
    buckets: dict[tuple[int, int, int], int] = {}
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a:
                buckets[(r, g, b)] = buckets.get((r, g, b), 0) + 1
    rows = []
    for (r, g, b), n in buckets.items():
        sat = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1]
        rows.append((sat * 100, n, "#%02X%02X%02X" % (r, g, b)))
    rows.sort()
    return rows


def opaque_count(img: Image.Image) -> int:
    return sum(img.getchannel("A").histogram()[1:])


def select(img: Image.Image, max_sat: float) -> Image.Image:
    px = img.load()
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    op = out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a and colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1] < max_sat:
                op[x, y] = (r, g, b, 255)
    return out


def add_outline(mask: Image.Image, source: Image.Image, max_value: float) -> tuple[Image.Image, int]:
    """Pull the garment's own contour back in: dark pixels of the source that
    touch the kept mask. Runs off a snapshot of the mask so the outline cannot
    grow into itself pass after pass.
    """
    w, h = mask.size
    keep = [[mask.getpixel((x, y))[3] > 0 for x in range(w)] for y in range(h)]
    sp = source.load()
    mp = mask.load()
    added = 0
    for y in range(h):
        for x in range(w):
            if keep[y][x]:
                continue
            r, g, b, a = sp[x, y]
            if not a or colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[2] > max_value:
                continue
            if any(
                0 <= x + dx < w and 0 <= y + dy < h and keep[y + dy][x + dx]
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
            ):
                mp[x, y] = (r, g, b, 255)
                added += 1
    return mask, added


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract a garment from one sprite by saturation, when no pair exists")
    parser.add_argument("image")
    parser.add_argument("output", nargs="?")
    parser.add_argument("--max-sat", type=float, default=0.44, help="Keep colours below this saturation (0..1)")
    parser.add_argument("--min-blob", type=int, default=150, help="Drop connected pieces smaller than this")
    parser.add_argument("--outline", action="store_true", help="Add back dark pixels touching the kept mask")
    parser.add_argument("--outline-value", type=float, default=0.55, help="A pixel counts as outline below this value")
    parser.add_argument("--report", action="store_true", help="Print every colour by saturation and exit")
    args = parser.parse_args()

    img = Image.open(args.image).convert("RGBA")

    if args.report:
        try:
            print(f"{'sat%':>6} {'px':>6}  hex")
            for sat, n, hx in saturation_report(img):
                print(f"{sat:>6.1f} {n:>6}  {hx}")
        except BrokenPipeError:
            pass
        return 0

    if not args.output:
        parser.error("output is required unless --report is given")

    mask = select(img, args.max_sat)
    picked = opaque_count(mask)
    mask = extract_clothing.largest_blobs(mask, args.min_blob)
    kept = opaque_count(mask)
    print(f"saturation < {args.max_sat}: {picked} px, {kept} px after --min-blob {args.min_blob}")

    if args.outline:
        mask, added = add_outline(mask, img, args.outline_value)
        print(f"outline pass added {added} px")

    mask.save(args.output)
    print(f"wrote {args.output} (bbox {mask.getbbox()})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
