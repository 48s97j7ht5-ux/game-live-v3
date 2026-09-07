# Kat hybrid experiment

A mobile, Kat-only prototype for selecting complete-image methods independently for face, screen-left/right hands and lower legs. Open index.html through HTTP. The base supplies all pixels outside five fixed, non-overlapping rectangles. Choices are hard pixel replacements; final colors are never blended. Undo stores the last 100 selection states. Reload starts from the heuristic selection. Export is transparent 139×208 PNG without UI overlays.

## Candidates

All six candidates share the original fractional-area alpha threshold (0.5) and the same 48-color source palette from the CAD study, mapped in CIELAB. Transparent RGB is zero. This preserves a common silhouette but cannot repair missing geometry. Hard rectangle boundaries can create seams.

- Ordinary: nearest-neighbor source colors, area fallback for transparent centers.
- Retro: existing PNG Lab's reduced reconstruction implementation, not the proprietary Retro Diffusion model.
- Adaptive: prior CAD study's experimental 60-iteration result, not converged and not an official implementation.
- PixelOE half: upstream legacy weak outline expansion mixed 50% with its input before contrast-based downscaling.
- PixelOE weak: the same expansion at full strength.
- PixelOE + Retro: weak outline expansion followed by the PNG Lab reconstruction.

PixelOE upstream: https://github.com/KohakuBlueleaf/PixelOE , commit recorded in assets/manifest.json. Calls the legacy outline_expansion and contrast_based_downscale functions, not the modern Torch pipeline. Expansion arguments: erode=1, dilate=1, k=8, avg_scale=9, dist_scale=4. Input is bicubic resized to 1112×1664 and composited on cream (238,233,223); this matte can influence edge colors. Original coverage is restored afterwards. Reproduction script requires upstream PixelOE on PIXELOE_SRC, Python Pillow/NumPy/SciPy/OpenCV/Torch and Node pngjs. Run scripts/hybrid_candidates.py from repository root. Source image and CAD result stay in their existing directories.

The starter selection minimizes mean squared Lab error to area-averaged source plus a small penalty on bright silhouette pixels. It is a heuristic, not an aesthetic quality model; it can reward blur and cannot judge anatomical accuracy. The base is scored over the entire image. Scores, exact palette, rectangles, source hash and revision are in manifest.json. This run chooses CAD for face and left hand, half PixelOE for right hand, weak PixelOE for calves, ordinary elsewhere. Users can override every choice.

Tests verify compatible dimensions, palette and alpha, exact region replacement, mobile controls, undo, reset, and exported PNG pixels. Browser screenshots are CI artifacts. Existing v5 editor is unchanged.
