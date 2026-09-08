# Second-image transfer test: white dress JPEG

User-supplied 1024×1536 JPEG, original bytes retained in assets/source.jpeg. Compare ordinary nearest sampling, legacy weak PixelOE, and the established source-guided body outline proposals. All are 139×208, have identical binary alpha and use one newly computed 48-color palette. Original first-image palette is unsuitable for white cloth. This is a transfer test of processing parameters, not proof of generalization and not a transparent-source benchmark.

## Preprocessing and limits

JPEG contains black background and compression artifacts, no alpha. Approximate mask: threshold max(R,G,B)>8, 3×3 binary closing, retain largest four-connected component; fill enclosed holes up to 16 source pixels and enclosed hair holes ending above source y=330. Keep larger negative spaces below that line, including the arm/dress gap. This image-specific mask preparation can lose dark outer hair/outline pixels and retain compression artifacts. It is not exact background recovery. The cutout preview is a 512×768 nearest-sampled proxy; computation uses original resolution. All methods share the resulting fractional-area coverage mask (threshold 0.5) so their alpha differences are zero.

Palette: median-cut of visible source RGB, 48 entries; map reconstructed colors by nearest CIELAB, no dithering. Weak PixelOE uses upstream legacy commit 341aa85048338d4d26c62fba23176e2b70d9f61b, cream matte (238,233,223), bicubic 1112×1664 input, outline_expansion(work,1,1,8,9,4) and contrast_based_downscale to139×208. Same parameters as first Kat. Nearest baseline falls back to fractional-area RGB where center alpha is zero.

Outline: reuse first Kat's exact body windows, source-dark L<0.28, dark coverage≥0.10, current L>0.30 and darkness gain>0.12. Original calf regions only horizontal endpoints; other regions four-connected boundary plus skin guard R>1.15G and R>1.2B. RGB-only changes, never geometry. This does not clean white cloth borders or reconstruct straps/folds. The larger proposal count is not a quality score: source JPEG and recovered alpha differ materially from the earlier PNG. All proposals can be rejected in the browser; weak-only is default. Full-source comparison retains its original black background. Export excludes highlights and includes the chosen patch subset.

## Reproduce

Run scripts/dress_study.py with PIXELOE_SRC pointing at upstream src, and NumPy/SciPy/Pillow/OpenCV/Torch installed. It reuses scripts/cad_experiment.py fractional-area sampling and Lab helpers. Source hash, palette, proposals and mask metadata live in manifest.json. Review sheet is temporary outside the repository. Tests check binary shared alpha, palette, source hash, patch before-values and boundary scope, a transparent arm/dress gap, selectable modes and exact browser PNG export with a rejected patch and highlights enabled.

Garment extraction and fitting are not performed in this comparison. Evaluate the processed cloth first; a true transparent PNG would permit a cleaner follow-up test without JPEG mask estimation.
