#!/usr/bin/env python3
"""Collapse a sprite onto the colours that actually describe its form, then
kill the specks that are left.

The problem this solves is the one sprite_audit.py measures: a soft-shaded
source quantised into 20+ colours where only a handful form real shapes. The
rest are antialiasing residue scattered one pixel at a time. Trying to keep
them "for detail" is backwards -- a shade that never forms a run of two cannot
read as a highlight or a fold at sprite scale, it reads as grain.

Two passes, in this order:

  1. anchor + remap. Pick the N colours with the most *anchored* pixels (ones
     with a 4-neighbour of their own colour, per sprite_audit.py), then map
     every other colour to its nearest anchor. Anchored count, not raw count,
     is what ranks a deliberate small detail above a larger smear -- on Kat's
     bikini sprite the cream highlight (94 px, 71 anchored) is real and
     #BD8268 (127 px, 49 anchored) is not, which raw count gets backwards.
  2. despeckle. After remapping, some pixels still sit alone. Replace each
     with the most common colour among its 8 neighbours -- the mode, never an
     average, so the result stays inside the anchor set and the palette cap
     holds. Snapshot the data first so neighbours are compared against the
     remap's output, not against already-corrected neighbours; otherwise the
     edits creep in whatever direction the scan happens to run.

Distance is redmean, matching pixel-editor/v5's own colour matching, so a
sprite cleaned here and a reference matched in the editor agree about which
shade is nearest.

Ordering matters. Despeckling before the remap would just relabel noise into
more noise; the remap has to shrink the palette first so the mode filter has
solid neighbours to vote with.

What this cannot do is invent shading. It removes what was never carrying
information; if the source's shading was already flat, the output is flat and
cleaner. Redrawing a proper ramp is a drawing job, not a filter.

Measured on characters/kat's 135x400 bikini sprite, which starts at 23 colours
and 9.3% orphaned (2461 px), at the default --min-share:

    --colors  8   ->  2.3% orphaned, despeckle rewrote 504 px
    --colors 10   ->  3.5% orphaned, despeckle rewrote 507 px
    --colors 14   ->  5.6% orphaned, despeckle rewrote 532 px
    --colors 18   ->  6.6% orphaned, despeckle rewrote 533 px

Which says something worth knowing about the two passes: the remap does nearly
all the cleaning -- dropping rare colours takes 9.3% to 2.3% on its own -- and
despeckle contributes a flat ~500 px whatever the palette size. Despeckle is
the finishing pass, not the engine.

The falling orphan rate is not a quality score, and this is the trap. Pushing
--colors down to 6 and --min-share to 0 drives it near zero, and the sprite is
visibly worse: at 6x the bangs go blobby, the eyebrows merge into the hair mass
and the mouth line breaks. Below roughly 14 colours the shading on this sprite
stops describing form. 14 with the default share is where it was measured to
look best; a 32x32 sprite would sit far lower, so re-measure per sprite rather
than carrying this number across.
"""

from __future__ import annotations

import argparse
import collections
import math

from PIL import Image

import sprite_audit


def redmean(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    rbar = (a[0] + b[0]) / 2
    dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return math.sqrt((2 + rbar / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rbar) / 256) * db * db)


def parse_hex(text: str) -> tuple[int, int, int]:
    s = text.lstrip("#")
    if len(s) != 6:
        raise argparse.ArgumentTypeError(f"expected a 6-digit hex colour, got {text!r}")
    return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def pick_anchors(img: Image.Image, count: int, keep: list[tuple[int, int, int]]) -> list[tuple[int, int, int]]:
    total, orphans = sprite_audit.orphan_map(img)
    ranked = sorted(total, key=lambda c: total[c] - orphans[c], reverse=True)
    anchors = list(keep)
    for colour in ranked:
        if len(anchors) >= count:
            break
        if colour not in anchors:
            anchors.append(colour)
    return anchors


def remap(img: Image.Image, anchors: list[tuple[int, int, int]]) -> Image.Image:
    out = img.copy()
    px = out.load()
    cache: dict[tuple[int, int, int], tuple[int, int, int]] = {a: a for a in anchors}
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            src = (r, g, b)
            hit = cache.get(src)
            if hit is None:
                hit = min(anchors, key=lambda c: redmean(src, c))
                cache[src] = hit
            px[x, y] = (*hit, a)
    return out


def despeckle(img: Image.Image, min_share: float = 0.6) -> tuple[Image.Image, int]:
    """Replace every pixel with no same-coloured 4-neighbour by the mode of its
    8 neighbours. Reads from a snapshot so the scan order cannot smear edits.

    min_share is what keeps this off one-pixel-wide detail. A speck sitting in
    a solid area has a lopsided neighbourhood and gets overruled; the tip of a
    hair strand has a split one -- part hair, part background, part skin -- and
    no colour clears the bar, so it survives. Measured on Kat: the remap pass
    causes zero hair/skin value flips, every one of them comes from here, which
    is why the guard belongs on this step and not on the remap.

    Expressed as a share of the opaque neighbours rather than an absolute
    count, so the bar means the same thing along the silhouette (where a pixel
    has three or four opaque neighbours) as it does in a solid interior. That
    was expected to matter more than it does: an absolute threshold of 5 and a
    share of 0.6 land within six pixels of each other on Kat, so the share form
    is the better-defined rule, not a measured improvement.
    """
    w, h = img.size
    snapshot = img.copy()
    src = snapshot.load()
    dst = img.load()

    def at(x: int, y: int):
        if x < 0 or y < 0 or x >= w or y >= h:
            return None
        c = src[x, y]
        return None if c[3] == 0 else c[:3]

    fixed = 0
    for y in range(h):
        for x in range(w):
            c = at(x, y)
            if c is None:
                continue
            n4 = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]
            if any(n == c for n in n4):
                continue
            n8 = [n for n in n4 + [at(x - 1, y - 1), at(x + 1, y - 1), at(x - 1, y + 1), at(x + 1, y + 1)] if n]
            if not n8:
                continue
            winner, votes = collections.Counter(n8).most_common(1)[0]
            if votes < min_share * len(n8):
                continue
            if winner != c:
                dst[x, y] = (*winner, dst[x, y][3])
                fixed += 1
    return img, fixed


def main() -> int:
    parser = argparse.ArgumentParser(description="Collapse a sprite to its load-bearing colours and despeckle")
    parser.add_argument("image")
    parser.add_argument("output")
    parser.add_argument("--colors", type=int, default=10, help="Anchor colours to keep")
    parser.add_argument(
        "--keep",
        type=parse_hex,
        action="append",
        default=[],
        help="Hex colour to anchor regardless of its rank, repeatable (e.g. an eye highlight too small to survive)",
    )
    parser.add_argument("--no-despeckle", action="store_true", help="Remap only, leave the specks in place")
    parser.add_argument(
        "--min-share",
        type=float,
        default=0.6,
        help="Share of a speck's opaque neighbours that must agree before it is rewritten; lower is more aggressive",
    )
    args = parser.parse_args()

    img = Image.open(args.image).convert("RGBA")
    before_total, before_orphans = sprite_audit.orphan_map(img)
    opaque = sum(before_total.values())
    if not opaque:
        print("image is fully transparent")
        return 1

    anchors = pick_anchors(img, args.colors, args.keep)
    out = remap(img, anchors)
    fixed = 0
    if not args.no_despeckle:
        out, fixed = despeckle(out, args.min_share)

    after_total, after_orphans = sprite_audit.orphan_map(out)
    print(f"colours   {len(before_total):>4} -> {len(after_total)}")
    print(
        f"orphans   {sum(before_orphans.values()):>4} ({sum(before_orphans.values()) / opaque * 100:.1f}%) -> "
        f"{sum(after_orphans.values())} ({sum(after_orphans.values()) / opaque * 100:.1f}%)"
    )
    if fixed:
        print(f"despeckle rewrote {fixed} px")
    out.save(args.output)
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
