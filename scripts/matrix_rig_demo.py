#!/usr/bin/env python3
"""Proof of concept: pose a character by rotating joint coordinates with
trig (a 2D rotation matrix), not by warping a raster image.

Each body part is a capsule SDF: distance from pixel (x, y) to a line
segment, minus a radius. The segment's endpoints are computed fresh from
joint angles every frame, so edges stay pixel-crisp at any pose. Per-pixel
shading comes from the SDF's local gradient (= surface normal) dotted with
a fixed light direction, then quantized into flat cel-shading bands.
Occlusion ("hide pixels") is a z-order draw list: later shapes overwrite
earlier ones where they overlap.
"""

from __future__ import annotations

import argparse
import colorsys
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
W, H = 64, 96
LIGHT = (-0.6, -0.8)  # normalized, pointing from upper-left


def hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def shade(base_hex: str, level: int) -> tuple[int, int, int, int]:
    """level: -1 shadow, 0 base, +1 highlight."""
    r, g, b = hex_to_rgb(base_hex)
    hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
    vv = max(0.0, min(1.0, vv + level * 0.22))
    ss = max(0.0, min(1.0, ss - level * 0.05))
    r, g, b = colorsys.hsv_to_rgb(hh, ss, vv)
    return (round(r * 255), round(g * 255), round(b * 255), 255)


def capsule_sdf(px: float, py: float, ax: float, ay: float, bx: float, by: float, r: float) -> tuple[float, float, float]:
    """Returns (signed_distance, nx, ny) where (nx, ny) is the outward normal."""
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    ab_len2 = abx * abx + aby * aby
    t = 0.0 if ab_len2 == 0 else max(0.0, min(1.0, (apx * abx + apy * aby) / ab_len2))
    cx, cy = ax + t * abx, ay + t * aby
    dx, dy = px - cx, py - cy
    dist = math.hypot(dx, dy)
    nx, ny = (dx / dist, dy / dist) if dist > 1e-6 else (0.0, -1.0)
    return dist - r, nx, ny


def rotate(vx: float, vy: float, degrees: float) -> tuple[float, float]:
    """2D rotation matrix applied to a vector."""
    t = math.radians(degrees)
    c, s = math.cos(t), math.sin(t)
    return (vx * c - vy * s, vx * s + vy * c)


def joints(shoulder_angle: float, elbow_angle: float) -> dict:
    """All joint positions, driven purely by angles (no image warping)."""
    down = (0.0, 1.0)

    shoulder_r = (43.0, 44.0)
    upper_r = rotate(*down, shoulder_angle)
    elbow_r = (shoulder_r[0] + upper_r[0] * 14, shoulder_r[1] + upper_r[1] * 14)
    fore_r = rotate(*down, shoulder_angle + elbow_angle)
    hand_r = (elbow_r[0] + fore_r[0] * 13, elbow_r[1] + fore_r[1] * 13)

    return {
        "shoulder_r": shoulder_r,
        "elbow_r": elbow_r,
        "hand_r": hand_r,
    }


def build_scene(shoulder_angle: float, elbow_angle: float, arm_in_front: bool) -> list[tuple]:
    """z-ordered list of (a, b, radius, color_hex) capsules, back to front."""
    j = joints(shoulder_angle, elbow_angle)

    torso = ((32, 40), (32, 62), 10, "#3a5a8c")
    head = ((32, 26), (32, 27), 10, "#e8b48c")  # near-zero-length capsule = circle
    left_leg = ((26, 62), (25, 88), 6, "#33323a")
    right_leg = ((38, 62), (39, 88), 6, "#33323a")
    left_arm = ((21, 44), (16, 64), 5, "#e8b48c")
    right_upper = (j["shoulder_r"], j["elbow_r"], 5, "#e8b48c")
    right_fore = (j["elbow_r"], j["hand_r"], 4.5, "#e8b48c")

    back = [left_leg, right_leg, torso, left_arm, head]
    arm = [right_upper, right_fore]
    return (back + arm) if arm_in_front else (arm + back)


def render(scene: list[tuple]) -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()

    for y in range(H):
        for x in range(W):
            best = None  # (dist, nx, ny, color_hex) of the topmost shape containing this pixel
            for (ax, ay), (bx, by), r, color in scene:
                d, nx, ny = capsule_sdf(x + 0.5, y + 0.5, ax, ay, bx, by, r)
                if d <= 0:
                    best = (nx, ny, color)  # later shapes in z-order overwrite earlier ones
            if best is None:
                continue
            nx, ny, color = best
            dot = nx * LIGHT[0] + ny * LIGHT[1]
            level = -1 if dot < -0.15 else (1 if dot > 0.35 else 0)
            px[x, y] = shade(color, level)

    return img


def main() -> int:
    parser = argparse.ArgumentParser(description="Matrix/trig-posed capsule character demo")
    parser.add_argument("--out-dir", default=str(ROOT / "output" / "matrix_rig"))
    parser.add_argument("--scale", type=int, default=6)
    args = parser.parse_args()

    poses = [
        ("01_relaxed", 10, 5, True),
        ("02_across_chest", 90, 90, True),
        ("03_raised", 180, 0, False),
    ]

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, shoulder_angle, elbow_angle, arm_in_front in poses:
        scene = build_scene(shoulder_angle, elbow_angle, arm_in_front)
        img = render(scene)
        native_path = out_dir / f"{name}.png"
        img.save(native_path, "PNG")
        preview = img.resize((W * args.scale, H * args.scale), Image.Resampling.NEAREST)
        preview.save(out_dir / f"{name}_preview.png", "PNG")
        print(f"Wrote {native_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
