#!/usr/bin/env python3
"""Turn a soft-shaded AI export (smooth gradients, thousands of colors) into
a real limited-palette sprite: box-downscale to a target size, then quantize
to a small flat palette. Two separate problems, two separate fixes (see
pixel_clean.py for why BOX and not NEAREST):

- Downscaling alone fixes noise/oversampling but does NOT flatten genuine
  continuous shading (a real gradient stays a gradient at any resolution).
- Quantization forces a small flat palette, which is what turns that
  gradient into cel-shading bands -- the actual "pixel art" look, and what
  docs/gemini-pixel-prompts.md's 32-color budget assumes.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

from pixel_clean import box_downscale, unique_color_count

ROOT = Path(__file__).resolve().parents[1]


def color_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def flatten_with_outliers(
    img: Image.Image,
    downscale: int,
    colors: int,
    alpha_threshold: int = 128,
    outlier_threshold: int = 60,
    max_outlier_colors: int = 12,
    cluster_bucket: int = 20,
) -> Image.Image:
    """Like flatten(), but pixels whose color is far from every quantized
    palette entry (e.g. a 3-pixel pure-white catchlight surrounded by tens
    of thousands of brown/tan pixels) keep their (clustered) original color
    instead of being merged into the nearest quantize() bucket. A normal
    quantizer optimizes total error across ALL pixels, so a handful of
    outlier pixels never "win" a slot on their own -- see the
    sprite_formula.py / palette_classify.py discussion: even --colors 255
    didn't save a 3-pixel white cluster out of 174592.

    First attempt grouped outlier candidates by EXACT source RGB before
    ranking by frequency -- and missed the real eye highlight anyway: box
    downscaling doesn't produce one repeated color, it produces a dozen
    near-white shades a few units apart (248,248,247 / 247,246,245 / ...),
    each individually too rare to make the top-N cut even though the
    *cluster* is significant. Fixed by bucketing colors to the nearest
    `cluster_bucket` per channel before counting/ranking, then outputting
    each kept pixel at its cluster's average color (not its single-pixel
    exact value, which would silently reinflate the palette back toward
    "thousands of near-duplicate colors" -- the original problem this
    whole module exists to fix).
    """
    img = img.convert("RGBA")
    small = box_downscale(img, downscale)
    alpha = small.split()[3].point(lambda a: 255 if a >= alpha_threshold else 0)

    rgb = small.convert("RGB")
    quantized = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    quantized_rgb = quantized.convert("RGB")

    w, h = small.size
    src_px, q_px, a_px = rgb.load(), quantized_rgb.load(), alpha.load()

    def bucket_of(c: tuple[int, int, int]) -> tuple[int, int, int]:
        return tuple((v // cluster_bucket) * cluster_bucket for v in c)

    out = Image.new("RGBA", (w, h))
    out_px = out.load()
    # bucket -> [pixel_count, r_sum, g_sum, b_sum]
    clusters: dict[tuple[int, int, int], list[int]] = {}

    for y in range(h):
        for x in range(w):
            if a_px[x, y] == 0:
                out_px[x, y] = (0, 0, 0, 0)
                continue
            src_c = src_px[x, y]
            q_c = q_px[x, y]
            if color_dist(src_c, q_c) > outlier_threshold:
                b = bucket_of(src_c)
                acc = clusters.setdefault(b, [0, 0, 0, 0])
                acc[0] += 1
                acc[1] += src_c[0]
                acc[2] += src_c[1]
                acc[3] += src_c[2]
            out_px[x, y] = (*q_c, 255)

    kept_buckets = sorted(clusters.items(), key=lambda kv: -kv[1][0])[:max_outlier_colors]
    representative = {bucket: (round(n[1] / n[0]), round(n[2] / n[0]), round(n[3] / n[0])) for bucket, n in kept_buckets}

    for y in range(h):
        for x in range(w):
            if a_px[x, y] == 0:
                continue
            src_c = src_px[x, y]
            q_c = q_px[x, y]
            if color_dist(src_c, q_c) > outlier_threshold:
                b = bucket_of(src_c)
                if b in representative:
                    out_px[x, y] = (*representative[b], 255)

    if representative:
        print(f"Preserved {len(representative)} outlier color clusters instead of quantizing them: {list(representative.values())}")

    return out


def flatten(img: Image.Image, downscale: int, colors: int, alpha_threshold: int = 128) -> Image.Image:
    img = img.convert("RGBA")
    small = box_downscale(img, downscale)

    # Binarize alpha first: a real pixel-art sprite has no semi-transparent
    # fringe (docs/gemini-pixel-prompts.md's "no anti-aliasing" rule applies
    # to the silhouette edge too, not just shading). Left soft, every edge
    # pixel gets its own near-duplicate RGBA entry -- see sprite_formula.py,
    # which turned a "32 color" sprite into a 1155-entry palette until this
    # was fixed.
    alpha = small.split()[3].point(lambda a: 255 if a >= alpha_threshold else 0)

    rgb = small.convert("RGB")
    quantized = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    quantized = quantized.convert("RGBA")
    quantized.putalpha(alpha)

    # Collapse every fully-transparent pixel's RGB to one value, so "invisible"
    # doesn't silently multiply the palette with near-black edge-blend variants.
    px = quantized.load()
    w, h = quantized.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                px[x, y] = (0, 0, 0, 0)

    return quantized


def main() -> int:
    parser = argparse.ArgumentParser(description="Box-downscale + palette-quantize an AI sprite export")
    parser.add_argument("input")
    parser.add_argument("-o", "--output", help="Output PNG path (native size)")
    parser.add_argument("--downscale", type=int, default=6, help="Box downscale factor before quantizing")
    parser.add_argument("--colors", type=int, default=32, help="Target palette size (project spec: <=32; tested safe floor ~12-16, breaks around 4)")
    parser.add_argument("--preview-scale", type=int, default=3, help="Nearest-neighbor upscale factor for a *_preview.png")
    parser.add_argument(
        "--protect-outliers",
        action="store_true",
        help="Keep rare, high-contrast pixels (e.g. a 3-pixel eye catchlight) at their exact color instead of "
        "letting quantize() merge them into the nearest bucket. Adds up to --max-outliers extra palette entries "
        "on top of --colors -- see flatten_with_outliers() for why plain quantization can't fix this at any color count.",
    )
    parser.add_argument("--outlier-threshold", type=int, default=60, help="Min color distance (sum of |dR|+|dG|+|dB|) to count as an outlier; tested on Kat: eye highlight sat at 130, shorts trim (warm off-white, not pure white) at only 69-93 -- 100 missed the trim, 60 catches both")
    parser.add_argument("--max-outliers", type=int, default=12, help="Max number of extra outlier colors to preserve (6 was enough for just the eye/hair highlight, not enough once the shorts trim needed its own slots too)")
    args = parser.parse_args()

    src = Image.open(args.input)
    before = unique_color_count(src)
    if args.protect_outliers:
        result = flatten_with_outliers(src, args.downscale, args.colors, outlier_threshold=args.outlier_threshold, max_outlier_colors=args.max_outliers)
    else:
        result = flatten(src, args.downscale, args.colors)
    after = unique_color_count(result)
    print(f"{src.size} ({before} colors) -> {result.size} ({after} colors)")

    out_path = Path(args.output) if args.output else ROOT / "output" / "flatten" / "sprite.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(out_path, "PNG")
    print(f"Wrote {out_path}")

    if args.preview_scale > 1:
        preview = result.resize((result.width * args.preview_scale, result.height * args.preview_scale), Image.Resampling.NEAREST)
        preview_path = out_path.with_name(out_path.stem + "_preview.png")
        preview.save(preview_path, "PNG")
        print(f"Wrote {preview_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
