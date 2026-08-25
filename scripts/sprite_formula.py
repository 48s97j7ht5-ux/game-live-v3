#!/usr/bin/env python3
"""Encode a flat-palette sprite as an explicit mathematical object instead
of an opaque PNG blob: a palette (list of colors) + a grid of palette
indices, one per (x, y). Row-wise run-length encoded, since a real
flat-shaded sprite (see flatten_to_sprite.py) has long runs of one color.

This is the literal endpoint of "a pixel is x, y, and a color number":
the .sprite.json IS that formula, and decode(encode(img)) is pixel-exact
identical to the source -- proven by --verify below, not just claimed.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def encode(img: Image.Image) -> dict:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    palette: list[tuple[int, int, int, int]] = []
    index_of: dict[tuple[int, int, int, int], int] = {}
    rows: list[list[list[int]]] = []

    for y in range(h):
        run_color = None
        run_len = 0
        row_rle: list[list[int]] = []
        for x in range(w):
            c = px[x, y]
            if c not in index_of:
                index_of[c] = len(palette)
                palette.append(c)
            idx = index_of[c]

            if idx == run_color:
                run_len += 1
            else:
                if run_color is not None:
                    row_rle.append([run_color, run_len])
                run_color, run_len = idx, 1
        row_rle.append([run_color, run_len])
        rows.append(row_rle)

    return {
        "schema": "game-live-v3/sprite-formula/1",
        "width": w,
        "height": h,
        "palette": palette,
        "rows_rle": rows,  # per row: [[palette_index, run_length], ...]
    }


def decode(data: dict) -> Image.Image:
    w, h = data["width"], data["height"]
    palette = [tuple(c) for c in data["palette"]]
    img = Image.new("RGBA", (w, h))
    px = img.load()

    for y, row_rle in enumerate(data["rows_rle"]):
        x = 0
        for idx, run_len in row_rle:
            color = palette[idx]
            for _ in range(run_len):
                px[x, y] = color
                x += 1

    return img


def main() -> int:
    parser = argparse.ArgumentParser(description="Encode/decode a sprite as an explicit palette + coordinate formula")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_enc = sub.add_parser("encode")
    p_enc.add_argument("input")
    p_enc.add_argument("-o", "--output")
    p_enc.add_argument("--verify", action="store_true", help="Decode the result back and assert pixel-exact equality")

    p_dec = sub.add_parser("decode")
    p_dec.add_argument("input")
    p_dec.add_argument("-o", "--output")

    args = parser.parse_args()

    if args.cmd == "encode":
        img = Image.open(args.input)
        data = encode(img)
        out_path = Path(args.output) if args.output else Path(args.input).with_suffix(".sprite.json")
        out_path.write_text(json.dumps(data), encoding="utf-8")

        png_bytes = Path(args.input).stat().st_size
        json_bytes = out_path.stat().st_size
        print(f"palette size: {len(data['palette'])} colors")
        print(f"{args.input} ({png_bytes}B) -> {out_path} ({json_bytes}B)")

        if args.verify:
            roundtrip = decode(data)
            src_rgba = img.convert("RGBA")
            identical = list(roundtrip.getdata()) == list(src_rgba.getdata())
            print(f"round-trip pixel-exact: {identical}")
            if not identical:
                return 1

    elif args.cmd == "decode":
        data = json.loads(Path(args.input).read_text(encoding="utf-8"))
        img = decode(data)
        out_path = Path(args.output) if args.output else Path(args.input).with_suffix(".png")
        img.save(out_path, "PNG")
        print(f"Wrote {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
