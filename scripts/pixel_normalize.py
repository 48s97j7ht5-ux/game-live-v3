#!/usr/bin/env python3
"""Normalize an illustrated character into a real low-resolution pixel sprite.

This is deliberately NOT an "upscale + pixel filter". The output sprite is
actually rendered on the requested low-resolution grid (192 px tall by default),
uses nearest-neighbour sampling only, a binary alpha channel, and a limited
palette.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.strip().lstrip("#")
    if len(value) != 6:
        raise argparse.ArgumentTypeError("colour must be RRGGBB, e.g. 000000")
    try:
        return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("invalid hex colour") from exc


def colour_distance_sq(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return sum((x - y) ** 2 for x, y in zip(a, b))


def make_binary_alpha(
    img: Image.Image,
    *,
    alpha_threshold: int,
    key_rgb: tuple[int, int, int] | None,
    key_tolerance: int,
) -> Image.Image:
    rgba = img.convert("RGBA")
    src = rgba.load()
    w, h = rgba.size
    out = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    dst = out.load()
    tol_sq = key_tolerance * key_tolerance * 3

    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            opaque = a >= alpha_threshold
            if opaque and key_rgb is not None:
                opaque = colour_distance_sq((r, g, b), key_rgb) > tol_sq
            dst[x, y] = (r, g, b, 255 if opaque else 0)
    return out


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    box = img.getchannel("A").getbbox()
    if box is None:
        raise ValueError("no visible pixels after background/alpha cleanup")
    return box


def crop_visible(img: Image.Image) -> Image.Image:
    return img.crop(content_bbox(img))


def resize_content_to_height(img: Image.Image, target_height: int) -> Image.Image:
    cropped = crop_visible(img)
    if cropped.height == target_height:
        return cropped
    target_width = max(1, round(cropped.width * target_height / cropped.height))
    return cropped.resize((target_width, target_height), Image.Resampling.NEAREST)


def force_exact_visible_height(img: Image.Image, target_height: int) -> Image.Image:
    """Nearest-neighbour resize can occasionally skip a sparse endpoint row.

    Re-crop the already-low-res result and perform one final nearest resize so
    the first and last visible rows are guaranteed to span exactly target_height.
    """
    cropped = crop_visible(img)
    if cropped.height == target_height:
        return cropped
    target_width = max(1, round(cropped.width * target_height / cropped.height))
    return cropped.resize((target_width, target_height), Image.Resampling.NEAREST)


def quantize_visible_rgba(img: Image.Image, colours: int) -> Image.Image:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(rgba.convert("RGB"), mask=alpha)
    indexed = rgb.quantize(
        colors=colours,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    out = indexed.convert("RGBA")
    out.putalpha(alpha)
    return out


def visible_colour_count(img: Image.Image) -> int:
    rgba = img.convert("RGBA")
    return len({(r, g, b) for r, g, b, a in rgba.getdata() if a > 0})


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a real low-resolution pixel sprite from a source PNG/JPEG."
    )
    parser.add_argument("input", help="source image")
    parser.add_argument("output", help="output PNG")
    parser.add_argument("--height", type=int, default=192,
                        help="visible sprite height in final pixels (default: 192)")
    parser.add_argument("--colours", "--colors", dest="colours", type=int, default=48,
                        help="maximum palette size (default: 48)")
    parser.add_argument("--key", choices=("none", "black", "white", "custom"),
                        default="black",
                        help="background colour to make transparent (default: black)")
    parser.add_argument("--key-rgb", type=parse_hex_rgb, default=(0, 0, 0),
                        help="custom key colour RRGGBB when --key=custom")
    parser.add_argument("--key-tolerance", type=int, default=12,
                        help="RGB distance tolerance for keyed background (default: 12)")
    parser.add_argument("--alpha-threshold", type=int, default=128,
                        help="alpha >= value becomes fully opaque; lower becomes transparent")
    args = parser.parse_args()

    if args.height < 1:
        parser.error("--height must be >= 1")
    if not 2 <= args.colours <= 256:
        parser.error("--colours must be between 2 and 256")
    if not 0 <= args.key_tolerance <= 255:
        parser.error("--key-tolerance must be 0..255")
    if not 0 <= args.alpha_threshold <= 255:
        parser.error("--alpha-threshold must be 0..255")

    key_rgb: tuple[int, int, int] | None
    if args.key == "none":
        key_rgb = None
    elif args.key == "black":
        key_rgb = (0, 0, 0)
    elif args.key == "white":
        key_rgb = (255, 255, 255)
    else:
        key_rgb = args.key_rgb

    src = Image.open(args.input)
    cleaned = make_binary_alpha(
        src,
        alpha_threshold=args.alpha_threshold,
        key_rgb=key_rgb,
        key_tolerance=args.key_tolerance,
    )

    sprite = resize_content_to_height(cleaned, args.height)
    sprite = quantize_visible_rgba(sprite, args.colours)

    alpha = sprite.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    sprite.putalpha(alpha)
    sprite = force_exact_visible_height(sprite, args.height)

    # The final resize cannot introduce new RGB colours or fractional alpha.
    alpha = sprite.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    sprite.putalpha(alpha)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(output, "PNG", optimize=False)

    box = content_bbox(sprite)
    visible_h = box[3] - box[1]
    colour_count = visible_colour_count(sprite)
    if visible_h != args.height:
        raise RuntimeError(f"visible height invariant failed: {visible_h} != {args.height}")
    if colour_count > args.colours:
        raise RuntimeError(f"palette invariant failed: {colour_count} > {args.colours}")

    print(
        f"Wrote {output}: canvas={sprite.width}x{sprite.height}, "
        f"visible_height={visible_h}px, visible_colours={colour_count}, "
        "alpha=binary, resampling=nearest, dithering=off"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
