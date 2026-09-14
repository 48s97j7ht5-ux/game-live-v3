#!/usr/bin/env python3
"""Close a sprite's outline and take the jaggies off its silhouette.

palette_discipline.py fixes the palette; it does not fix the shape, and on a
flattened render the shape is where the remaining mess lives. Measured on
kat_23 at 37x128: of 411 silhouette-boundary pixels, 245 -- 59.6% -- were not
dark. The source art has a contour all the way round, but it is one pixel wide
at the target scale, so BOX averaging blends it halfway into the skin and the
remap then sends those blends to a skin anchor. The result is a figure with an
outline on roughly two fifths of its edge and bare skin on the rest, which is
exactly what reads as "unclean" before you can say why.

Three passes, each measurable and each off by default so the caller opts in:

  --outline   every boundary pixel becomes the outline colour. This replaces
              the pixel rather than growing the silhouette outward: the canvas
              and the figure's footprint stay put, at the cost of one pixel of
              body all round. On a sprite this small that is the right trade --
              a closed contour reads far better than one extra pixel of thigh --
              but it is a real change to the shape, not a neutral cleanup.
  --jaggies   drop pixels hanging off the silhouette by a single corner, and
              fill one-pixel bites out of it. Both are artifacts of resampling
              a curve, never deliberate at this scale. kat_23 had 1 and 3.
  --despeckle the interior pass from palette_discipline, for when polishing is
              run on its own.

What this cannot do is make the sprite correct. It enforces consistency --
every edge dark, no single-pixel spurs -- which is not the same as good. A
contour that should break for a highlight, an eyelash that should jut, a curve
whose steps should be 2-3-2 rather than 1-4-1: those are drawing decisions, and
a filter that cannot tell them from noise will flatten them along with it. At
37x128 nearly every pixel carries meaning, so treat the output as a cleaned
starting point for hand work, not as a finished sprite.
"""

from __future__ import annotations

import argparse
import collections
import colorsys

from PIL import Image

import palette_discipline


def parse_hex(text: str) -> tuple[int, int, int]:
    s = text.lstrip("#")
    if len(s) != 6:
        raise argparse.ArgumentTypeError(f"expected a 6-digit hex colour, got {text!r}")
    return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def solid_map(img: Image.Image) -> list[list[bool]]:
    px = img.load()
    return [[px[x, y][3] > 0 for x in range(img.width)] for y in range(img.height)]


def neighbours4(x: int, y: int):
    return ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))


def darkest_colour(img: Image.Image) -> tuple[int, int, int]:
    px = img.load()
    best = None
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[2]
            if best is None or v < best[0]:
                best = (v, (r, g, b))
    return best[1] if best else (0, 0, 0)


def fix_jaggies(img: Image.Image) -> tuple[Image.Image, int, int]:
    """Remove single-corner spurs and fill one-pixel bites, both read off one
    snapshot so the scan order cannot cascade edits along an edge.
    """
    w, h = img.size
    solid = solid_map(img)
    px = img.load()

    def inside(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h and solid[y][x]

    dropped = filled = 0
    for y in range(h):
        for x in range(w):
            count = sum(1 for nx, ny in neighbours4(x, y) if inside(nx, ny))
            if solid[y][x] and count <= 1:
                px[x, y] = (0, 0, 0, 0)
                dropped += 1
            elif not solid[y][x] and count >= 3:
                votes = collections.Counter(
                    px[nx, ny][:3] for nx, ny in neighbours4(x, y) if inside(nx, ny)
                )
                px[x, y] = (*votes.most_common(1)[0][0], 255)
                filled += 1
    return img, dropped, filled


def close_outline(img: Image.Image, colour: tuple[int, int, int]) -> tuple[Image.Image, int, int]:
    """Recolour every boundary pixel, then give back the middle of anything the
    contour swallowed whole.

    A structure only one or two pixels across -- the neck here, and fingers on a
    bigger sprite -- is *all* boundary, so recolouring every boundary pixel
    turns the whole thing into a dark bar. On kat_23 that was 23 px, and the
    neck was the visible one. The repair keeps at least one core pixel in any
    run the outline filled completely, in both axes, restored from the image as
    it was before this pass.
    """
    before = img.copy()
    bp = before.load()
    solid = solid_map(img)
    w, h = img.size
    px = img.load()

    def inside(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h and solid[y][x]

    changed = 0
    for y in range(h):
        for x in range(w):
            if not solid[y][x]:
                continue
            if any(not inside(nx, ny) for nx, ny in neighbours4(x, y)) and px[x, y][:3] != colour:
                px[x, y] = (*colour, 255)
                changed += 1

    restored = 0
    for axis in (0, 1):
        outer, inner = (h, w) if axis == 0 else (w, h)
        for a in range(outer):
            def at(b: int) -> tuple[int, int]:
                return (b, a) if axis == 0 else (a, b)

            b = 0
            while b < inner:
                if not solid[at(b)[1]][at(b)[0]]:
                    b += 1
                    continue
                start = b
                while b < inner and solid[at(b)[1]][at(b)[0]]:
                    b += 1
                run = range(start, b)
                if all(px[at(i)][:3] == colour for i in run):
                    mid = at((start + b - 1) // 2)
                    if bp[mid][:3] != colour:
                        px[mid] = bp[mid]
                        restored += 1
    return img, changed, restored


def boundary_report(img: Image.Image, dark_below: float = 0.45) -> tuple[int, int]:
    solid = solid_map(img)
    w, h = img.size
    px = img.load()

    def inside(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h and solid[y][x]

    total = undark = 0
    for y in range(h):
        for x in range(w):
            if not solid[y][x] or all(inside(nx, ny) for nx, ny in neighbours4(x, y)):
                continue
            total += 1
            r, g, b, _ = px[x, y]
            if colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[2] > dark_below:
                undark += 1
    return total, undark


def main() -> int:
    parser = argparse.ArgumentParser(description="Close a sprite's outline and remove silhouette jaggies")
    parser.add_argument("image")
    parser.add_argument("output")
    parser.add_argument(
        "--outline",
        nargs="?",
        const="auto",
        help="Force every boundary pixel to this hex colour; bare flag uses the sprite's own darkest",
    )
    parser.add_argument("--jaggies", action="store_true", help="Drop single-corner spurs and fill one-pixel bites")
    parser.add_argument("--despeckle", action="store_true", help="Also run the interior speck pass")
    args = parser.parse_args()

    img = Image.open(args.image).convert("RGBA")
    total, undark = boundary_report(img)
    print(f"before: {total} boundary px, {undark} not dark ({undark / total * 100:.1f}%)")

    if args.jaggies:
        img, dropped, filled = fix_jaggies(img)
        print(f"jaggies: dropped {dropped} spurs, filled {filled} bites")

    if args.outline:
        colour = darkest_colour(img) if args.outline == "auto" else parse_hex(args.outline)
        img, changed, restored = close_outline(img, colour)
        print("outline: #%02X%02X%02X applied to %d px, %d core px given back" % (*colour, changed, restored))

    if args.despeckle:
        img, fixed = palette_discipline.despeckle(img)
        print(f"despeckle rewrote {fixed} px")

    total, undark = boundary_report(img)
    print(f"after:  {total} boundary px, {undark} not dark ({undark / total * 100:.1f}%)")
    img.save(args.output)
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
