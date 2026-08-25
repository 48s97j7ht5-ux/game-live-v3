#!/usr/bin/env python3
"""Verlet-integrated hair strands settling under gravity around a capsule
head -- proof that "real physics sim" isn't some unreachable wizardry, just
a rope simulation (points + distance constraints + collision) applied per
strand, then rendered with the same capsule-SDF shading as matrix_rig_demo.py.
Not proposing this replace AI art for the game -- it's an honest answer to
"you can't build a real engine, can you", not a production hair renderer.
"""

from __future__ import annotations

import argparse
import colorsys
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
W, H = 80, 100
HEAD_C = (40.0, 26.0)
HEAD_R = 13.0
GRAVITY = (0.0, 0.35)
SEGMENT_LEN = 5.0
STRANDS = 14
POINTS_PER_STRAND = 9
ITERATIONS = 80
CONSTRAINT_PASSES = 4


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def make_strand(anchor, outward_angle_deg):
    """Points start laid out straight along the initial outward direction."""
    ang = math.radians(outward_angle_deg)
    dx, dy = math.sin(ang), math.cos(ang)
    pts = [anchor]
    for i in range(1, POINTS_PER_STRAND):
        pts.append((anchor[0] + dx * SEGMENT_LEN * i * 0.3, anchor[1] + dy * SEGMENT_LEN * i * 0.3))
    return pts


def simulate(strands, iterations):
    prev = [list(p) for p in strands]
    curr = [list(p) for p in strands]

    for _ in range(iterations):
        for i in range(len(curr)):
            if i == 0:
                continue  # anchored to scalp
            vx = curr[i][0] - prev[i][0]
            vy = curr[i][1] - prev[i][1]
            prev[i] = curr[i][:]
            curr[i][0] += vx * 0.98 + GRAVITY[0]
            curr[i][1] += vy * 0.98 + GRAVITY[1]

        for _pass in range(CONSTRAINT_PASSES):
            for i in range(len(curr) - 1):
                a, b = curr[i], curr[i + 1]
                d = dist(a, b) or 1e-6
                diff = (d - SEGMENT_LEN) / d
                if i == 0:
                    b[0] -= (b[0] - a[0]) * diff
                    b[1] -= (b[1] - a[1]) * diff
                else:
                    a[0] += (b[0] - a[0]) * diff * 0.5
                    a[1] += (b[1] - a[1]) * diff * 0.5
                    b[0] -= (b[0] - a[0]) * diff * 0.5
                    b[1] -= (b[1] - a[1]) * diff * 0.5

            for i in range(1, len(curr)):
                dx, dy = curr[i][0] - HEAD_C[0], curr[i][1] - HEAD_C[1]
                d = math.hypot(dx, dy)
                if d < HEAD_R and d > 1e-6:
                    curr[i][0] = HEAD_C[0] + dx / d * HEAD_R
                    curr[i][1] = HEAD_C[1] + dy / d * HEAD_R

    return curr


def capsule_sdf(px, py, ax, ay, bx, by, r):
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    ab_len2 = abx * abx + aby * aby
    t = 0.0 if ab_len2 == 0 else max(0.0, min(1.0, (apx * abx + apy * aby) / ab_len2))
    cx, cy = ax + t * abx, ay + t * aby
    dx, dy = px - cx, py - cy
    d = math.hypot(dx, dy)
    nx, ny = (dx / d, dy / d) if d > 1e-6 else (0.0, -1.0)
    return d - r, nx, ny


def shade(base_hex, level):
    r, g, b = (int(base_hex[i : i + 2], 16) / 255 for i in (0, 2, 4))
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    v = max(0.0, min(1.0, v + level * 0.2))
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (round(r * 255), round(g * 255), round(b * 255), 255)


def render(all_strands):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    light = (-0.6, -0.8)

    shapes = [(HEAD_C, HEAD_C, HEAD_R, "e8b48c")]
    for strand in all_strands:
        for i in range(len(strand) - 1):
            shapes.append((tuple(strand[i]), tuple(strand[i + 1]), 1.6, "2b2320"))

    for y in range(H):
        for x in range(W):
            best = None
            for a, b, r, color in shapes:
                d, nx, ny = capsule_sdf(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1], r)
                if d <= 0:
                    best = (nx, ny, color)
            if best is None:
                continue
            nx, ny, color = best
            dot = nx * light[0] + ny * light[1]
            level = -1 if dot < -0.15 else (1 if dot > 0.35 else 0)
            px[x, y] = shade(color, level)

    return img


def main() -> int:
    parser = argparse.ArgumentParser(description="Verlet hair-strand physics demo")
    parser.add_argument("--out", default=str(ROOT / "output" / "hair_physics" / "hair_sim.png"))
    parser.add_argument("--scale", type=int, default=6)
    parser.add_argument("--seed", type=int, default=3)
    args = parser.parse_args()

    random.seed(args.seed)
    strands = []
    for i in range(STRANDS):
        t = i / (STRANDS - 1)
        angle_around = -70 + t * 140  # scalp anchors from left side to right side, over the top
        rad = math.radians(angle_around)
        anchor = (HEAD_C[0] + math.sin(rad) * HEAD_R, HEAD_C[1] - math.cos(rad) * HEAD_R)
        outward = angle_around + random.uniform(-8, 8)
        strands.append(make_strand(anchor, outward))

    settled = [simulate(s, ITERATIONS) for s in strands]

    img = render(settled)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    preview = img.resize((W * args.scale, H * args.scale), Image.Resampling.NEAREST)
    preview.save(out_path.with_name(out_path.stem + "_preview.png"), "PNG")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
