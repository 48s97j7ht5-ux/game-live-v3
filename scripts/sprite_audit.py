#!/usr/bin/env python3
"""Measure whether a sprite's palette is doing work or just carrying noise.

A colour count alone says nothing. Kat's 135x400 bikini sprite has 23 opaque
colours, which sounds like a disciplined palette -- until you ask, per colour,
how many of its pixels have *no* 4-neighbour of the same colour. That single
number splits the palette clean in half:

    #F4B991  5308 px    4.7% orphaned      #AD765C   251 px   47.8% orphaned
    #FCC69D  4973 px    3.0% orphaned      #9A5C48   170 px   54.7% orphaned
    #E6A680  4936 px    3.1% orphaned      #BD8268   127 px   61.4% orphaned
    #090404  4325 px    1.6% orphaned      #764A42    69 px   82.6% orphaned

Four colours (three skin tones plus the outline) cover 74% of the sprite and
sit in solid shapes. The other nineteen are mostly scattered single pixels --
antialiasing residue from a soft source, promoted to full palette entries by
whatever quantised the image. They read as grain, not as shading: a shade that
never forms a run of two cannot describe a highlight or a fold.

So the useful audit metric is not "how many colours" but "how many colours
survive the coherence test", and the useful per-colour metric is not its pixel
count but its *anchored* count -- pixels that do have a matching 4-neighbour.
Anchored count ranks a small deliberate detail above a larger smear: the cream
bikini highlight (94 px, 71 anchored) outranks #BD8268 (127 px, 49 anchored),
which raw count gets backwards. palette_discipline.py picks its anchors on
exactly this number.

Read the anchored column for the cliff. On this sprite it falls at 4 (>4000),
then 8 (>600), then 10 (>270), then a long tail of near-noise.

One caveat the metric cannot express on its own: an isolated pixel is not
automatically wrong. The eye highlight is a single pixel and belongs there, and
so do the tips of hair strands. What is diagnostic is a colour whose pixels are
*mostly* orphaned -- #764A42 at 82.6% is grain, #F5E2D5 at 24.5% is a highlight
that happens to be small. Judge the per-colour orphan share, not the sprite
total, and never treat driving the total to zero as the goal: palette_discipline.py
can do that on request and the result looks worse.

Diagnostic only; it changes nothing. palette_discipline.py does the collapsing.
"""

from __future__ import annotations

import argparse
import collections
import colorsys

from PIL import Image


def orphan_map(img: Image.Image) -> tuple[collections.Counter, collections.Counter]:
    """Per colour: total opaque pixels, and how many of them have no
    4-neighbour of the same colour. Diagonals deliberately do not count -- a
    pixel touching its own colour only at a corner still reads as a speck.
    """
    w, h = img.size
    px = img.load()

    def at(x: int, y: int):
        if x < 0 or y < 0 or x >= w or y >= h:
            return None
        c = px[x, y]
        return None if c[3] == 0 else c[:3]

    total: collections.Counter = collections.Counter()
    orphans: collections.Counter = collections.Counter()
    for y in range(h):
        for x in range(w):
            c = at(x, y)
            if c is None:
                continue
            total[c] += 1
            if not any(at(*n) == c for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))):
                orphans[c] += 1
    return total, orphans


def main() -> int:
    parser = argparse.ArgumentParser(description="Report a sprite's palette and how much of it is orphan noise")
    parser.add_argument("image")
    parser.add_argument(
        "--anchored-floor",
        type=int,
        default=100,
        help="Colours below this many anchored pixels are summarised as the tail rather than listed",
    )
    args = parser.parse_args()

    img = Image.open(args.image).convert("RGBA")
    total, orphans = orphan_map(img)
    opaque = sum(total.values())
    if not opaque:
        print("image is fully transparent")
        return 1

    rows = []
    for colour, n in total.items():
        anchored = n - orphans[colour]
        r, g, b = colour
        hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        rows.append((anchored, n, orphans[colour], "#%02X%02X%02X" % colour, hue * 360, sat * 100, val * 100))
    rows.sort(reverse=True)

    print(f"{img.width}x{img.height}, {opaque} opaque px, {len(rows)} colours")
    print(f"orphaned overall: {sum(orphans.values())} px ({sum(orphans.values()) / opaque * 100:.1f}%)")
    print()
    print(f"{'hex':<8} {'px':>6} {'share':>7} {'anchored':>9} {'orphan':>7} {'hue':>6} {'sat':>5} {'val':>5}")
    tail = 0
    for anchored, n, orph, hx, hue, sat, val in rows:
        if anchored < args.anchored_floor:
            tail += 1
            continue
        print(
            f"{hx:<8} {n:>6} {n / opaque * 100:>6.2f}% {anchored:>9} {orph / n * 100:>6.1f}% "
            f"{hue:>6.1f} {sat:>5.1f} {val:>5.1f}"
        )
    if tail:
        print(f"... and {tail} colours below {args.anchored_floor} anchored px (the noise tail)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
