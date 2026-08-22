const LAYER_DEFS = [
  { id: "body", label: "Body", fileHint: "body_base.png", keyDefault: false },
  { id: "head", label: "Head", fileHint: "head_base.png", keyDefault: true },
  { id: "hair", label: "Hair", fileHint: "hair_black.png", keyDefault: true },
];

/** @type {Record<string, { img: HTMLImageElement | null, x: number, y: number, scale: number, key: boolean, fileName: string }>} */
const state = {};

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("canvas"));
const ctx = canvas.getContext("2d", { willReadFrequently: true });
if (!ctx) throw new Error("No 2d context");

function initState() {
  for (const def of LAYER_DEFS) {
    state[def.id] = {
      img: null,
      x: def.id === "body" ? 156 : def.id === "head" ? 200 : 175,
      y: def.id === "body" ? 200 : def.id === "head" ? 40 : 10,
      scale: 1,
      key: def.keyDefault,
      fileName: `templates/parts/${def.fileHint}`,
    };
  }
}

function buildLayerUI() {
  const root = document.getElementById("layerControls");
  root.replaceChildren();

  for (const def of LAYER_DEFS) {
    const s = state[def.id];
    const block = document.createElement("div");
    block.className = "layer-block";
    block.innerHTML = `<h3>${def.label}</h3>`;
    root.appendChild(block);

    const fileLabel = document.createElement("label");
    fileLabel.className = "field";
    fileLabel.innerHTML = `<span>PNG</span>`;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/webp,image/jpeg";
    fileInput.addEventListener("change", () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        s.img = img;
        s.fileName = `templates/parts/${f.name}`;
        draw();
        refreshJson();
      };
      img.src = url;
    });
    fileLabel.appendChild(fileInput);
    block.appendChild(fileLabel);

    for (const [key, label, min, max, step] of [
      ["x", "X", -512, 512, 1],
      ["y", "Y", -512, 512, 1],
      ["scale", "Scale", 0.1, 3, 0.01],
    ]) {
      const lab = document.createElement("label");
      lab.className = "field";
      const val = /** @type {keyof typeof s} */ (key);
      lab.innerHTML = `<span>${label} <output id="out-${def.id}-${key}">${s[val]}</output></span>`;
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(s[val]);
      range.addEventListener("input", () => {
        /** @type {number} */ (s[val]) = Number(range.value);
        const out = document.getElementById(`out-${def.id}-${key}`);
        if (out) out.textContent = range.value;
        draw();
        refreshJson();
      });
      lab.appendChild(range);
      block.appendChild(lab);
    }

    const keyLab = document.createElement("label");
    keyLab.className = "field checkbox";
    const keyBox = document.createElement("input");
    keyBox.type = "checkbox";
    keyBox.checked = s.key;
    keyBox.addEventListener("change", () => {
      s.key = keyBox.checked;
      draw();
      refreshJson();
    });
    keyLab.appendChild(keyBox);
    keyLab.appendChild(document.createTextNode(" Key white для слоя"));
    block.appendChild(keyLab);
  }
}

function keyImageData(data, threshold) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    }
  }
}

function drawLayer(img, x, y, scale, keyLayer, globalKey) {
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  if (!octx) return;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(img, 0, 0, w, h);
  if (globalKey && keyLayer) {
    const id = octx.getImageData(0, 0, w, h);
    keyImageData(id.data, 248);
    octx.putImageData(id, 0, 0);
  }
  ctx.drawImage(off, x, y);
}

function draw() {
  const w = Number(document.getElementById("canvasW").value);
  const h = Number(document.getElementById("canvasH").value);
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  const globalKey = /** @type {HTMLInputElement} */ (document.getElementById("keyWhite")).checked;

  for (const def of LAYER_DEFS) {
    const s = state[def.id];
    if (!s.img) continue;
    drawLayer(s.img, s.x, s.y, s.scale, s.key, globalKey);
  }
}

function buildSpec() {
  const w = Number(document.getElementById("canvasW").value);
  const h = Number(document.getElementById("canvasH").value);
  return {
    schema: "game-live-v3/assemble/1",
    output: "output/test/composed.png",
    canvas: { width: w, height: h },
    layers: LAYER_DEFS.map((def) => {
      const s = state[def.id];
      return {
        id: def.id,
        file: s.fileName,
        x: Math.round(s.x),
        y: Math.round(s.y),
        scale: Math.round(s.scale * 1000) / 1000,
        key_white: s.key,
      };
    }),
  };
}

function refreshJson() {
  const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById("jsonOut"));
  ta.value = JSON.stringify(buildSpec(), null, 2);
}

function downloadBlob(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById("canvasW").addEventListener("change", () => {
  draw();
  refreshJson();
});
document.getElementById("canvasH").addEventListener("change", () => {
  draw();
  refreshJson();
});
document.getElementById("keyWhite").addEventListener("change", draw);

document.getElementById("btnRedraw").addEventListener("click", draw);

document.getElementById("btnJson").addEventListener("click", () => {
  const json = JSON.stringify(buildSpec(), null, 2);
  downloadBlob("assemble.json", new Blob([json], { type: "application/json" }));
});

document.getElementById("btnPng").addEventListener("click", () => {
  draw();
  canvas.toBlob((blob) => {
    if (blob) downloadBlob("composed.png", blob);
  }, "image/png");
});

initState();
buildLayerUI();
refreshJson();
draw();

export {};
