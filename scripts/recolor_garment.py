#!/usr/bin/env python3
"""Recolour an extracted garment layer to an arbitrary target colour.

Enables the "chroma-key wardrobe" trick: render the outfit in an acid colour
so it contrasts hard against both skin and the character's dark outline,
extract it cleanly (extraction quality is driven by colour distance -- a black
outfit on a dark-outlined character scored 54.9% against ground truth, while
the white dress and blue jeans came out clean), then paint it whatever colour
the design actually calls for.

Shading is preserved by remapping the garment's own luminance range onto a
target range instead of flat-filling: the fabric's relative light and shadow
survive, only hue/saturation/level change. Compressing a bright garment into
a very dark target inevitably squeezes that range, so --v-lo/--v-hi control
how much tonal room the result keeps.
"""

from __future__ import annotations

import argparse
import colorsys
from pathlib import Path

from PIL import Image


def parse_hex(s: str) -> tuple[float, float, float]:
    s = s.lstrip("#")
    r, g, b = (int(s[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hsv(r, g, b)


def recolor(img: Image.Image, target_hsv: tuple[float, float, float], v_lo: float, v_hi: float, keep_sat: float) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    values = [colorsys.rgb_to_hsv(*(c / 255 for c in px[x, y][:3]))[2] for y in range(h) for x in range(w) if px[x, y][3] > 0]
    if not values:
        raise SystemExit("garment layer is empty")
    vmin, vmax = min(values), max(values)
    span = (vmax - vmin) or 1e-6

    th, ts, _ = target_hsv
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # remap this pixel's position within the garment's own tonal range
            t = (v - vmin) / span
            nv = v_lo + t * (v_hi - v_lo)
            # blend original saturation in so fabric detail that lived in
            # saturation (seams, prints) isn't flattened away
            ns = ts * (1 - keep_sat) + s * keep_sat
            nr, ng, nb = colorsys.hsv_to_rgb(th, min(1.0, ns), min(1.0, nv))
            op[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)

    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Recolour an extracted garment, preserving its shading")
    parser.add_argument("garment")
    parser.add_argument("-o", "--output", required=True)
    parser.add_argument("--color", required=True, help="Target colour, hex e.g. #1a1a1a")
    parser.add_argument("--v-lo", type=float, default=0.06, help="Darkest level in the result")
    parser.add_argument("--v-hi", type=float, default=0.30, help="Brightest level in the result")
    parser.add_argument("--keep-sat", type=float, default=0.25, help="How much of the original saturation to retain (0-1)")
    parser.add_argument("--preview-scale", type=float, default=0.5)
    args = parser.parse_args()

    src = Image.open(args.garment)
    out = recolor(src, parse_hex(args.color), args.v_lo, args.v_hi, args.keep_sat)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path, "PNG")
    print(f"Wrote {out_path}")

    if args.preview_scale and args.preview_scale != 1:
        pw = max(1, int(out.width * args.preview_scale))
        ph = max(1, int(out.height * args.preview_scale))
        prev = out.resize((pw, ph))
        bg = Image.new("RGBA", prev.size, (110, 110, 120, 255))
        pp = out_path.with_name(out_path.stem + "_preview.png")
        Image.alpha_composite(bg, prev).save(pp)
        print(f"Wrote {pp}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
