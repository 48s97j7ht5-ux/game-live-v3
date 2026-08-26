#!/usr/bin/env python3
"""Put an extracted garment onto a body render, including one in a different
pose than the garment was cut from.

Measured on the Kat set, aligning by feet + leg-centre rather than by the full
bounding box (arms-up raises the bbox top to the hands, which silently rescales
the body if you normalize on total height):

    zone (upward from feet)   arms-down vs arms-UP   arms-down vs arms-down
    legs   0-30%                    90.0%                  80.9%
    hips   30-45%                   85.7%                  86.7%
    torso  45-70%                   63.9%                  89.3%
    shoulders/head 70-100%          56.0%                  72.3%

The legs matching *better* across arm poses than between two same-pose renders
is what makes cross-pose fitting viable at all. The low torso number turned out
to be an artifact of the metric, not of reality: silhouette IoU counts hanging
arms as part of the torso band, so it punishes arm movement rather than torso
mismatch. In practice a full outfit -- top included -- transfers cleanly; only
garments that actually wrap the arms (sleeves, jackets) genuinely need a
matching arm pose.

Ghost limbs are the real cross-pose artifact: the garment layer carries the
dark outline of wherever the source arms hung. Masking against the destination
body's (slightly grown) silhouette removes them, on the principle that clothing
cannot exist where there is no body.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageFilter


def silhouette(img: Image.Image, threshold: int = 30) -> Image.Image:
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    bg = px[2, 2]
    m = Image.new("L", (w, h), 0)
    mp = m.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > threshold:
                mp[x, y] = 255
    return m


def feet_anchor(mask: Image.Image) -> tuple[int, int]:
    """Bottom-most row plus horizontal centre of the lowest quarter.

    Deliberately ignores everything above the legs so the anchor doesn't move
    when the arms do.
    """
    w, h = mask.size
    mp = mask.load()
    bottom = 0
    for y in range(h - 1, -1, -1):
        if any(mp[x, y] > 127 for x in range(0, w, 2)):
            bottom = y
            break
    y0 = int(bottom * 0.75)
    xs = [x for y in range(y0, bottom + 1) for x in range(w) if mp[x, y] > 127]
    if not xs:
        raise SystemExit("could not locate legs for anchoring")
    return bottom, sum(xs) // len(xs)


def fit(body: Image.Image, garment: Image.Image, source_body: Image.Image | None, margin: int, mask_out: bool, nudge_y: int = 0) -> tuple[Image.Image, int]:
    dx = dy = 0
    if source_body is not None:
        sb, sc = feet_anchor(silhouette(source_body))
        db, dc = feet_anchor(silhouette(body))
        dx, dy = dc - sc, db - sb
    dy += nudge_y

    body = body.convert("RGBA")
    garment = garment.convert("RGBA")
    w, h = body.size

    shifted = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shifted.paste(garment, (dx, dy))

    dropped = 0
    if mask_out:
        grown = silhouette(body).filter(ImageFilter.MaxFilter(margin))
        gp = grown.load()
        sp = shifted.load()
        for y in range(h):
            for x in range(w):
                p = sp[x, y]
                if p[3] and gp[x, y] == 0:
                    sp[x, y] = (0, 0, 0, 0)
                    dropped += 1

    out = body.copy()
    out.alpha_composite(shifted, (0, 0))
    return out, dropped


def main() -> int:
    parser = argparse.ArgumentParser(description="Fit an extracted garment onto a body render, across poses if needed")
    parser.add_argument("body", help="Destination body render")
    parser.add_argument("garment", help="Garment layer from extract_clothing.py")
    parser.add_argument("-o", "--output", required=True)
    parser.add_argument("--source-body", help="Body the garment was cut from; enables feet/leg-centre re-anchoring")
    parser.add_argument("--margin", type=int, default=9, help="How far outside the body silhouette clothing may still sit")
    parser.add_argument("--no-mask", action="store_true", help="Skip silhouette masking (keeps ghost limbs)")
    parser.add_argument("--nudge-y", type=int, default=0, help="Extra vertical shift in px, on top of feet-anchoring (negative = up). Whole garment moves together, not just the neckline.")
    parser.add_argument("--preview-scale", type=float, default=0.5)
    args = parser.parse_args()

    body = Image.open(args.body)
    garment = Image.open(args.garment)
    source = Image.open(args.source_body) if args.source_body else None

    out, dropped = fit(body, garment, source, args.margin, not args.no_mask, args.nudge_y)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path, "PNG")
    print(f"Wrote {out_path}" + (f" -- masked away {dropped} px outside the body" if dropped else ""))

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
