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

The stencil shape still comes from one reference body -- if the destination
body's proportions differ even slightly, the mask's own waist edge can sit
inside the true hip line, leaving a notch of bare skin at each hip corner
(the crop is narrower than the body under it). --snap-waist fixes the two
corners specifically, following a plan worked out with the user and a second
model (ChatGPT) rather than a blind global stretch: treat the left and right
waist panels independently (the pose is rarely symmetric -- mirroring one
side onto the other is wrong), anchor each side at the first row (top-down)
where that panel is already wide enough to be a reliable edge (the raw
topmost pixels of a diff-extracted mask are often a thin noise spike, not
real fabric -- confirmed on kat_16's shorts, where a spike survived up to 22
rows above both reliable anchors and had to be clipped, not extended), then
walk outward from the mask's edge to the body's own silhouette at each row,
blending the reach out to zero over --snap-zone px so it feathers into the
untouched lower two-thirds of the garment instead of stopping abruptly.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fit_garment as fg  # noqa: E402
import recolor_garment as rc  # noqa: E402


def _mask_row_span(mp, y: int, x0: int, x1: int) -> tuple[int, int] | None:
    cols = [x for x in range(x0, x1) if mp[x, y][3] > 0]
    return (min(cols), max(cols)) if cols else None


def _find_reliable_anchor(mp, x0: int, x1: int, y0: int, y1: int, min_width: int) -> int:
    """First row (top-down) whose panel is already wider than min_width.

    A diff-extracted mask's very top pixels are frequently a thin noise
    spike rather than real fabric -- anchoring on the literal top of the
    bounding box picks up that noise instead of a trustworthy edge.
    """
    for y in range(y0, y1):
        span = _mask_row_span(mp, y, x0, x1)
        if span and (span[1] - span[0]) >= min_width:
            return y
    return y0


def snap_waist_to_body(mask: Image.Image, body_sil: Image.Image, zone: int, max_reach: int, min_width: int = 12) -> Image.Image:
    """Extend the mask's top-left and top-right panels out to the body's own
    silhouette, independently per side, fading the effect out over `zone` px.

    Clips whatever sits above both anchors first (see min_width docstring
    above) -- that noise would otherwise survive untouched since it's above
    where the extension logic starts looking.
    """
    w, h = mask.size
    mp = mask.load()
    sp = body_sil.load()

    bbox = mask.getbbox()
    if bbox is None:
        return mask
    x_lo, y_lo, x_hi, y_hi = bbox
    cx_mid = (x_lo + x_hi) // 2
    scan_bottom = min(h, y_lo + zone + 40)

    anchor_left = _find_reliable_anchor(mp, x_lo, cx_mid, y_lo, scan_bottom, min_width)
    anchor_right = _find_reliable_anchor(mp, cx_mid, x_hi, y_lo, scan_bottom, min_width)

    out = mask.copy()
    op = out.load()

    for y in range(y_lo, min(anchor_left, anchor_right)):
        for x in range(x_lo, x_hi):
            if op[x, y][3]:
                op[x, y] = (0, 0, 0, 0)

    def extend_side(anchor_y: int, x0: int, x1: int, outward: int) -> None:
        for y in range(anchor_y, min(h, anchor_y + zone)):
            span = _mask_row_span(mp, y, x0, x1)
            if not span:
                continue
            m_edge = span[0] if outward < 0 else span[1]
            b_edge = m_edge
            for step in range(1, max_reach + 1):
                xx = m_edge + outward * step
                if 0 <= xx < w and sp[xx, y] > 127:
                    b_edge = xx
                else:
                    break
            t = 1.0 - (y - anchor_y) / zone
            new_edge = int(round(m_edge + (b_edge - m_edge) * t))
            fill = mp[m_edge, y]
            lo, hi = (new_edge, m_edge) if outward < 0 else (m_edge + 1, new_edge + 1)
            for x in range(lo, hi):
                op[x, y] = fill

    extend_side(anchor_left, x_lo, cx_mid, -1)
    extend_side(anchor_right, cx_mid, x_hi, +1)
    return out


def skin_to_fabric(body: Image.Image, mask: Image.Image, source_body: Image.Image | None, target_hsv, v_lo: float, v_hi: float, keep_sat: float, margin: int, snap_waist: bool = False, snap_zone: int = 55, snap_reach: int = 30) -> Image.Image:
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

    body_sil = fg.silhouette(body)

    if snap_waist:
        shifted_mask = snap_waist_to_body(shifted_mask, body_sil, snap_zone, snap_reach)

    # clothing can't exist where there's no body -- same rule fit_garment uses
    grown = body_sil.filter(ImageFilter.MaxFilter(margin))
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
    parser.add_argument("--snap-waist", action="store_true", help="Extend the mask's left/right waist panels out to the body's own silhouette, independently per side -- closes hip-corner notches from a mask cut on a different body")
    parser.add_argument("--snap-zone", type=int, default=55, help="How far down from the waist the snap effect fades out, px")
    parser.add_argument("--snap-reach", type=int, default=30, help="Max px the snap will extend the mask edge outward to find the body's silhouette")
    parser.add_argument("--preview-scale", type=float, default=0.5)
    args = parser.parse_args()

    body = Image.open(args.body)
    mask = Image.open(args.mask)
    source = Image.open(args.source_body) if args.source_body else None

    fabric = skin_to_fabric(body, mask, source, rc.parse_hex(args.color), args.v_lo, args.v_hi, args.keep_sat, args.margin, args.snap_waist, args.snap_zone, args.snap_reach)

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
