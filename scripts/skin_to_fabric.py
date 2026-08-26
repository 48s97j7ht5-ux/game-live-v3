#!/usr/bin/env python3
"""Turn a coverage mask into clothing by recolouring the body's OWN pixels,
instead of transplanting a garment cut from a different render.

Where this earns its keep: skin-tight clothing (leggings, bodysuits, fitted
tanks) has almost no silhouette of its own -- its shape IS the body's shape.
fit_garment.py transplants a garment layer as a rigid (or, at best, locally
warped) object, which works fine for loose clothing but hits a hard ceiling
on anything skin-tight: a chest-hugging top cut from an arms-up pose left an
un-closeable gap when worn on an arms-down body (see character-layers.md,
"chest-gap" section) because the needed pixels literally don't exist in any
reference. Shift, rotate, and local warp all reduced it, none closed it.

The fix is to stop transplanting shape at all. A coverage mask (built the
same way as any other garment -- extract_clothing.py against an acid-colour
tight outfit) only says WHERE clothing exists, not what colour it is. Use its
alpha as a stencil on the destination body, sample that body's OWN pixels
under the stencil, and recolour those (via recolor_garment.recolor, which
already remaps luminance while preserving shading). The result is pose-native
by construction -- there is no cross-pose mismatch to fix, because the shape
was never borrowed from anywhere else. Verified on the kat_16 shorts mask
worn on the arms-down body: real knee/calf shading and a waistband that
actually follows the hip curve, not a flat colour block.

Needed the same percentile fix as recolor_garment.py, more severely: skin
value distributions are far narrower than typical fabric (median v=0.97,
p1-p99 spanning roughly 0.13-0.99 on one leg), so true min/max compressed all
of it into an invisible sliver near v_hi.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fit_garment as fg  # noqa: E402
import recolor_garment as rc  # noqa: E402


def skin_to_fabric(body: Image.Image, mask: Image.Image, source_body: Image.Image | None, target_hsv, v_lo: float, v_hi: float, keep_sat: float, margin: int) -> Image.Image:
    body = body.convert("RGBA")
    mask = mask.convert("RGBA")
    w, h = body.size

    dx = dy = 0
    if source_body is not None:
        sb, sc = fg.feet_anchor(fg.silhouette(source_body))
        db, dc = fg.feet_anchor(fg.silhouette(body))
        dx, dy = dc - sc, db - sb

    shifted_mask = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shifted_mask.paste(mask, (dx, dy))

    # clothing can't exist where there's no body -- same rule fit_garment uses
    grown = fg.silhouette(body).filter(ImageFilter.MaxFilter(margin))
    gp = grown.load()
    smp = shifted_mask.load()
    for y in range(h):
        for x in range(w):
            if smp[x, y][3] and gp[x, y] == 0:
                smp[x, y] = (0, 0, 0, 0)

    bp = body.load()
    stencil_patch = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    stp = stencil_patch.load()
    for y in range(h):
        for x in range(w):
            if smp[x, y][3]:
                stp[x, y] = bp[x, y]

    return rc.recolor(stencil_patch, target_hsv, v_lo, v_hi, keep_sat)


def main() -> int:
    parser = argparse.ArgumentParser(description="Recolour a body's own pixels under a coverage mask, instead of transplanting a garment")
    parser.add_argument("body", help="Destination body render")
    parser.add_argument("mask", help="Coverage mask -- a garment layer from extract_clothing.py, used only for its alpha shape")
    parser.add_argument("-o", "--output", required=True)
    parser.add_argument("--source-body", help="Body the mask was cut against; enables feet-anchor alignment onto a different pose")
    parser.add_argument("--color", required=True, help="Target colour, hex e.g. #1a1a1a")
    parser.add_argument("--v-lo", type=float, default=0.05)
    parser.add_argument("--v-hi", type=float, default=0.55, help="Skin's real shading range is narrow, so this usually wants to be wider than recolor_garment's fabric default")
    parser.add_argument("--keep-sat", type=float, default=0.05)
    parser.add_argument("--margin", type=int, default=9)
    parser.add_argument("--preview-scale", type=float, default=0.5)
    args = parser.parse_args()

    body = Image.open(args.body)
    mask = Image.open(args.mask)
    source = Image.open(args.source_body) if args.source_body else None

    fabric = skin_to_fabric(body, mask, source, rc.parse_hex(args.color), args.v_lo, args.v_hi, args.keep_sat, args.margin)

    out = body.convert("RGBA").copy()
    out.alpha_composite(fabric)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path, "PNG")
    print(f"Wrote {out_path}")

    if args.preview_scale and args.preview_scale != 1:
        pw = max(1, int(out.width * args.preview_scale))
        ph = max(1, int(out.height * args.preview_scale))
        prev = out.resize((pw, ph))
        bg = Image.new("RGBA", prev.size, (45, 45, 52, 255))
        pp = out_path.with_name(out_path.stem + "_preview.png")
        Image.alpha_composite(bg, prev).save(pp)
        print(f"Wrote {pp}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
