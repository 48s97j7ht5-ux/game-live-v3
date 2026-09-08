# Source-guided calf contour experiment

A Kat-only follow-up to the weak PixelOE candidate. No new rescaling or palette reduction. Browser composes precomputed, individually rejectable pixel patches onto the original weak candidate. Default is outline-only, not shape cleanup. Modes: unchanged weak, outline, silhouette, both. Compare either calf against weak or the full-resolution source; download exact transparent 139×208 PNG. Overlay marks never enter export. Choices reset on reload.

## Reproduce

From repository root: `OPENBLAS_NUM_THREADS=1 python3 scripts/contour_experiment.py` with NumPy, SciPy and Pillow. Uses existing source, weak PNG and palette. Outputs patches.json plus a temporary review sheet one directory above the repository. Metadata contains source/base hashes, exact before/after values and source alpha/dark coverage for every proposal.

## Independent proposed algorithm

This is a small custom experiment, not an implementation of Snakes or Depixelizing Pixel Art, nor an anatomical model.

Silhouette: use the original source's exact fractional-area alpha coverage at 139×208. Extract left/right horizontal endpoints over each 40-row calf window (y=148..187); require a single continuous foreground span per row. Dynamic programming chooses endpoints at original x or x±1. First/last rows are pinned. Cost: increase in fractional-area disagreement + 0.12 per moved pixel + 0.22 times absolute second difference of row endpoints. Row jumps above two pixels are disallowed. This regularizes step changes while retaining source support. It can still produce aesthetically worse shapes. New pixels use palette-mapped source dark color where dark coverage ≥0.10, otherwise source area-average color. Removed pixels become transparent black.

Outline: only original left/right endpoint pixels in those calf windows can change. Source pixels qualify as dark when normalized Lab L<0.28 and alpha>127. Their area coverage must be ≥0.10 of the target cell. Repair only if the weak candidate L>0.30 and the palette-mapped dark source mean is darker by >0.12. This tests local missing dark edge samples, not the entire inner/outer boundary. No interior shading changes.

The run proposes five silhouette pixels and three outline pixels. All changes use the existing 48-entry palette. In combined mode shape runs first and outline cannot resurrect a removed pixel. The UI lets users reject any patch. No general claim that these eight edits improve the artwork. Knees, feet, face, clothing and everything outside the specified windows remain untouched.

## Verification

Tests check source/base hashes and patch before-values; palette and binary alpha; exact edit bounds; shape edits within one pixel of the original boundary; connected components and holes unchanged for the full proposal; all modes and disabled patch behavior. Mobile browser CI verifies controls, source comparison, per-pixel rejection and exported PNG byte content with overlay enabled. CI screenshots are review artifacts.
