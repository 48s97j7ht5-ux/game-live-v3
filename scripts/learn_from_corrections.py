#!/usr/bin/env python3
"""Turn manual clean-up into machine-readable training signal, then fit the
extraction parameters to it.

The point: hand-fixing a layer teaches the pipeline nothing unless the fix is
captured. `record` stores the pair (what the script produced, what you
approved) plus the derived pixel verdicts; `tune` then searches the parameter
space for the settings that best reproduce YOUR version, so the next run needs
less fixing.

This is fitting, not neural training -- which is the point: it works from a
single corrected example, runs in seconds, and the result is a number you can
read and sanity-check rather than opaque weights. A learned pixel classifier
only becomes worthwhile once many corrections have piled up; `report` prints
whether the corpus is big enough to bother.

Workflow:
    python3 scripts/extract_clothing.py base.png clothed.png -o auto.png
    # ...hand-clean auto.png in any editor, save as fixed.png...
    python3 scripts/learn_from_corrections.py record --auto auto.png --fixed fixed.png \\
        --name kat_jeans --source-base base.png --source-clothed clothed.png
    python3 scripts/learn_from_corrections.py tune --name kat_jeans
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "characters" / "_corrections"


def alpha_mask(img: Image.Image) -> list[bool]:
    return [p[3] > 0 for p in img.convert("RGBA").getdata()]


def compare(auto: Image.Image, fixed: Image.Image) -> dict:
    """Pixels the human removed (false positives) and restored (false negatives)."""
    if auto.size != fixed.size:
        raise SystemExit(f"size mismatch: auto {auto.size} vs fixed {fixed.size}")
    a, f = alpha_mask(auto), alpha_mask(fixed)
    removed = sum(1 for i in range(len(a)) if a[i] and not f[i])
    restored = sum(1 for i in range(len(a)) if f[i] and not a[i])
    agreed = sum(1 for i in range(len(a)) if a[i] and f[i])
    return {"removed_by_human": removed, "restored_by_human": restored, "agreed": agreed}


def iou(a: Image.Image, b: Image.Image) -> float:
    ma, mb = alpha_mask(a), alpha_mask(b)
    inter = sum(1 for i in range(len(ma)) if ma[i] and mb[i])
    union = sum(1 for i in range(len(ma)) if ma[i] or mb[i])
    return inter / union if union else 0.0


def cmd_record(args: argparse.Namespace) -> None:
    auto = Image.open(args.auto).convert("RGBA")
    fixed = Image.open(args.fixed).convert("RGBA")
    stats = compare(auto, fixed)

    entry_dir = CORPUS / args.name
    entry_dir.mkdir(parents=True, exist_ok=True)
    auto.save(entry_dir / "auto.png")
    fixed.save(entry_dir / "fixed.png")

    # Store absolute paths: `tune` may run from a different working directory,
    # and a relative path recorded here would silently break there.
    meta = {
        "schema": "game-live-v3/correction/1",
        "name": args.name,
        "source_base": str(Path(args.source_base).resolve()) if args.source_base else None,
        "source_clothed": str(Path(args.source_clothed).resolve()) if args.source_clothed else None,
        "stats": stats,
        "agreement_iou": round(iou(auto, fixed), 4),
    }
    (entry_dir / "correction.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2))


def cmd_tune(args: argparse.Namespace) -> None:
    """Search extract+defringe parameters that best reproduce the human version."""
    import extract_clothing
    import defringe

    entry_dir = CORPUS / args.name
    meta = json.loads((entry_dir / "correction.json").read_text(encoding="utf-8"))
    fixed = Image.open(entry_dir / "fixed.png").convert("RGBA")

    base_path = meta.get("source_base")
    clothed_path = meta.get("source_clothed")
    if not base_path or not clothed_path:
        raise SystemExit("correction.json lacks source_base/source_clothed; re-record with those flags")

    def resolve(p: str) -> Path:
        path = Path(p)
        return path if path.is_absolute() else (ROOT / path)

    base = Image.open(resolve(base_path))
    clothed = Image.open(resolve(clothed_path))

    best = None
    for threshold in args.thresholds:
        raw = extract_clothing.extract(base, clothed, threshold, align=True)
        for min_blob in args.min_blobs:
            cleaned = extract_clothing.largest_blobs(raw, min_blob)
            for radius in args.thin_radii:
                candidate = cleaned if radius == 0 else defringe.drop_thin_skin(cleaned, radius, 8.0, 48.0)[0]
                score = iou(candidate, fixed)
                if best is None or score > best["iou"]:
                    best = {"iou": round(score, 4), "threshold": threshold, "min_blob": min_blob, "thin_radius": radius}
                print(f"  threshold={threshold:<4} min_blob={min_blob:<6} thin_radius={radius:<2} IoU={score:.4f}")

    print("\nbest parameters for this correction:")
    print(json.dumps(best, indent=2))
    (entry_dir / "tuned.json").write_text(json.dumps(best, indent=2), encoding="utf-8")
    print(f"saved to {entry_dir / 'tuned.json'}")


def cmd_report(_: argparse.Namespace) -> None:
    if not CORPUS.exists():
        print("no corrections recorded yet")
        return
    entries = sorted(p for p in CORPUS.iterdir() if (p / "correction.json").exists())
    print(f"{len(entries)} correction(s) recorded\n")
    for e in entries:
        m = json.loads((e / "correction.json").read_text(encoding="utf-8"))
        s = m["stats"]
        print(f"  {m['name']:<24} IoU {m['agreement_iou']:.3f}  human removed {s['removed_by_human']}, restored {s['restored_by_human']}")
    print()
    if len(entries) < 10:
        print(f"Parameter fitting works from one example. A learned pixel classifier needs")
        print(f"roughly 10-20 -- {len(entries)} recorded so far, so stick with `tune` for now.")
    else:
        print("Enough corrections recorded that training a pixel classifier is now worth trying.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture manual clean-ups and fit extraction parameters to them")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_rec = sub.add_parser("record", help="Store an auto/fixed pair as training signal")
    p_rec.add_argument("--auto", required=True)
    p_rec.add_argument("--fixed", required=True)
    p_rec.add_argument("--name", required=True)
    p_rec.add_argument("--source-base")
    p_rec.add_argument("--source-clothed")
    p_rec.set_defaults(func=cmd_record)

    p_tune = sub.add_parser("tune", help="Search parameters that best reproduce the corrected version")
    p_tune.add_argument("--name", required=True)
    p_tune.add_argument("--thresholds", type=int, nargs="+", default=[30, 40, 50, 60])
    p_tune.add_argument("--min-blobs", type=int, nargs="+", default=[500, 2000, 5000])
    p_tune.add_argument("--thin-radii", type=int, nargs="+", default=[0, 5, 7, 9])
    p_tune.set_defaults(func=cmd_tune)

    sub.add_parser("report", help="Show the correction corpus and whether it's large enough to learn from").set_defaults(func=cmd_report)

    args = parser.parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
