#!/usr/bin/env python3
"""Stack PNG layers using assemble.json (offsets, scale, optional white key)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def key_near_white_to_alpha(img: Image.Image, threshold: int = 248) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = (r, g, b, 0)
    return img


def resolve_path(raw: str, base_dir: Path) -> Path:
    p = Path(raw)
    if p.is_absolute():
        return p
    candidate = base_dir / p
    if candidate.is_file():
        return candidate
    return ROOT / p


def compose(spec: dict, base_dir: Path) -> Image.Image:
    canvas = spec.get("canvas", {})
    width = int(canvas.get("width", 512))
    height = int(canvas.get("height", 768))
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    for layer in spec.get("layers", []):
        path = resolve_path(layer["file"], base_dir)
        if not path.is_file():
            raise FileNotFoundError(f"Layer file not found: {path}")

        img = Image.open(path).convert("RGBA")
        if layer.get("key_white", True):
            img = key_near_white_to_alpha(img)

        scale = float(layer.get("scale", 1.0))
        if scale != 1.0:
            nw = max(1, int(img.width * scale))
            nh = max(1, int(img.height * scale))
            img = img.resize((nw, nh), Image.Resampling.NEAREST)

        x = int(layer.get("x", 0))
        y = int(layer.get("y", 0))
        out.alpha_composite(img, (x, y))

    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Compose sprite layers from assemble.json")
    parser.add_argument(
        "assemble",
        nargs="?",
        default=str(ROOT / "characters" / "test" / "assemble.json"),
        help="Path to assemble.json",
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Output PNG (default: output/<assemble.output> or output/composed.png)",
    )
    args = parser.parse_args()

    assemble_path = Path(args.assemble).resolve()
    if not assemble_path.is_file():
        print(f"Missing assemble file: {assemble_path}", file=sys.stderr)
        return 1

    spec = json.loads(assemble_path.read_text(encoding="utf-8"))
    base_dir = assemble_path.parent

    try:
        result = compose(spec, base_dir)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1

    out_path = args.output
    if not out_path:
        out_path = spec.get("output", "output/composed.png")
    out_path = Path(out_path)
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(out_path, "PNG")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
