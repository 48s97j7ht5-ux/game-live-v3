# Kat: content-adaptive downscaling experiment

This is an **independent experimental implementation**, not the authors' executable, an exact numerical reproduction, or a benchmark verdict about their method.

Primary sources:
- Kopf, Shamir, Peers (2013), [Content-Adaptive Image Downscaling](https://johanneskopf.de/publications/downscaling/)
- [Paper](https://johanneskopf.de/publications/downscaling/paper/downscaling.pdf)
- [Pseudocode](https://johanneskopf.de/publications/downscaling/paper/pseudocode.pdf)

## Implemented structure

Bilateral Gaussian kernels in spatial coordinates and CIELAB; per-kernel density normalization, per-input-pixel responsibility normalization (E step), weighted spatial means, full 2x2 covariance and colour means (M step). Correction uses four-neighbour mean smoothing, a quarter-cell movement limit, eigenvalue clamping and increased colour bandwidth for excessive directional extent. Edge-orientation correction is intentionally disabled, as in the authors' pixel-art examples (section 5.1).

## Explicit differences and assumptions

- Coordinates are measured in output-cell units; source pixel centres use the +0.5 convention. Covariance starts at I/3 and its eigenvalues are clamped to [0.05, 0.1] in these units. These are an explicit interpretation of scale units, not verified against author code.
- CIELAB D65 is divided by 100. Colour centres start from alpha-aware area averages, and colour bandwidth starts at 0.03, rather than the paper's uniform colour and 1e-4 initialization. Log-sum-exp stabilizes kernel normalization.
- Directional extent is integrated in output-cell area units. The threshold is 0.2; affected kernels and neighbours have bandwidth increased once by 10% per iteration. This normalized correction differs from a literal application of the pseudocode's unnormalized sum and repeated per-neighbour updates.
- Stop after three iterations with max colour change <0.0003, position change <0.001, and no bandwidth correction; hard limit 60 iterations. Actual stopping data is in assets/results.json. A capped run is **not claimed converged**.
- The publication describes colour images. Our extension excludes zero-alpha RGB and weights sample mass by alpha. Output transparency is independently computed by exact fractional-area coverage at threshold 0.5. **All three methods share this identical mask**. This isolates colour reconstruction and does not test adaptive silhouette reconstruction.
- The nearest-neighbour baseline samples source centres. If a centre has zero alpha but the common coverage mask retains its cell, its RGB falls back to the area average rather than exposing invisible source colours.
- One 48-entry median-cut source palette (source samples with alpha >127) is used across both sizes and all methods. Final colours are mapped to its nearest CIELAB entry without dithering. Actual used colour counts may be lower. This is not the authors' mean-shift post-process.
- No preprocessing resize, neural generation, manual anatomy edits, or cleanup of the source was performed. Source PNG is the existing 1024x1536 Kat attachment from ../png-lab/assets/kat-original.png.
- Output sizes are 139x208 and 171x256. Body height from crown to soles is not calibrated to 192 pixels in this experiment.

## Reproduction

From repository root with Python, numpy, scipy and Pillow:

```
pip install numpy==2.3.5 scipy==1.17.0 Pillow==12.3.0
OPENBLAS_NUM_THREADS=1 python3 scripts/cad_experiment.py
```

Each size has nearest-neighbour, fractional-area average and adaptive colour outputs, both before palette reduction and mapped to the shared palette. PNG files have binary transparency; RGB under transparent pixels is zero. Processing is precomputed; the browser viewer only loads and compares the files. Display enlargement uses nearest-neighbour sampling.

The mathematical method is reimplemented from the publication; no third-party implementation code is bundled. The Kat source remains a project image, not an image from the paper.
