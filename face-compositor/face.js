const LAYER_DEFS = [
  { id: "head", label: "Голова", path: "head/archetype.png", keyDefault: true },
  { id: "eyes", label: "Глаза", path: "eyes/neutral.png", keyDefault: true },
  { id: "brows", label: "Брови", path: "brows/neutral.png", keyDefault: true },
  { id: "nose", label: "Нос", path: "nose/default_3q.png", keyDefault: true },
  { id: "lips", label: "Губы", path: "lips/neutral.png", keyDefault: true },
  { id: "cosmetics", label: "Косметика", path: "cosmetics/none.png", keyDefault: true, opacityDefault: 0.85 },
  { id: "hair", label: "Волосы", path: "hair/default.png", keyDefault: true },
];

/** @type {Record<string, LayerState>} */
const state = {};

/** @typedef {{ img: HTMLImageElement | null, x: number, y: number, scale: number, key: boolean, opacity: number, fileName: string }} LayerState */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("canvas"));
const ctx = canvas.getContext("2d", { willReadFrequently: true });
if (!ctx) throw new Error("No 2d context");

const previewStage = /** @type {HTMLDivElement} */ (document.getElementById("previewStage"));
let activeLayerId = "eyes";
/** @type {DragState | null} */
let drag = null;
let displayZoom = 2;

/** @typedef {{ layerId: string, startPx: number, startPy: number, startX: number, startY: number }} DragState */

function initState() {
  for (const def of LAYER_DEFS) {
    state[def.id] = {
      img: null,
      x: 0,
      y: 0,
      scale: 1,
      key: def.keyDefault,
      opacity: def.opacityDefault ?? 1,
      fileName: `templates/face/${def.path}`,
    };
  }
}

function applyDisplayZoom(z) {
  displayZoom = z;
  previewStage.style.transform = "none";
  const w = canvas.width * z;
  const h = canvas.height * z;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  previewStage.style.width = `${w}px`;
  previewStage.style.height = `${h}px`;
  document.querySelectorAll(".zoom-buttons button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.getAttribute("data-zoom")) === z);
  });
}

function updateActiveLayerLabel() {
  const def = LAYER_DEFS.find((d) => d.id === activeLayerId);
  const el = document.getElementById("activeLayerLabel");
  if (!el || !def) return;
  el.innerHTML = `Слой для drag:<span>${def.label}</span>`;
}

function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function keyImageData(data, threshold) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
      continue;
    }
    if (Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r >= 200) {
      data[i + 3] = 0;
    }
  }
}

function drawLayer(img, x, y, scale, keyLayer, globalKey, opacity) {
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
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(off, x, y);
  ctx.restore();
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const globalKey = /** @type {HTMLInputElement} */ (document.getElementById("keyWhite")).checked;

  for (const def of LAYER_DEFS) {
    const s = state[def.id];
    if (!s.img) continue;
    drawLayer(s.img, s.x, s.y, s.scale, s.key, globalKey, s.opacity);
  }
}

function buildSpec() {
  const characterId =
    /** @type {HTMLInputElement} */ (document.getElementById("characterId")).value.trim() || "kat";
  return {
    schema: "game-live-v3/face-assemble/1",
    character_id: characterId,
    output: `output/${characterId}/face.png`,
    canvas: { width: canvas.width, height: canvas.height },
    anchor_neck: { x: Math.round(canvas.width / 2), y: Math.round(canvas.height * 0.92) },
    layers: LAYER_DEFS.map((def) => {
      const s = state[def.id];
      const layer = {
        id: def.id,
        file: s.fileName,
        x: Math.round(s.x),
        y: Math.round(s.y),
        scale: Math.round(s.scale * 1000) / 1000,
        key_white: s.key,
      };
      if (def.id === "cosmetics" && s.opacity < 1) {
        layer.opacity = Math.round(s.opacity * 100) / 100;
      }
      return layer;
    }),
  };
}

function refreshJson() {
  /** @type {HTMLTextAreaElement} */ (document.getElementById("jsonOut")).value = JSON.stringify(
    buildSpec(),
    null,
    2,
  );
}

function downloadBlob(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function setActiveLayer(id) {
  activeLayerId = id;
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.getAttribute("data-id") === id);
  });
  updateActiveLayerLabel();
  renderLayerEditor();
}

function applySpec(spec) {
  if (spec.character_id) {
    /** @type {HTMLInputElement} */ (document.getElementById("characterId")).value = spec.character_id;
  }
  if (spec.canvas?.width && spec.canvas?.height) {
    canvas.width = spec.canvas.width;
    canvas.height = spec.canvas.height;
    applyDisplayZoom(displayZoom);
  }
  for (const layer of spec.layers ?? []) {
    const s = state[layer.id];
    if (!s) continue;
    s.x = layer.x ?? s.x;
    s.y = layer.y ?? s.y;
    s.scale = layer.scale ?? s.scale;
    if (typeof layer.key_white === "boolean") s.key = layer.key_white;
    if (typeof layer.opacity === "number") s.opacity = layer.opacity;
    if (layer.file) s.fileName = layer.file;
  }
  draw();
  refreshJson();
  renderLayerTabs();
  renderLayerEditor();
}

function renderLayerTabs() {
  const root = document.getElementById("layerTabs");
  root.replaceChildren();
  for (const def of LAYER_DEFS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.dataset.id = def.id;
    btn.textContent = def.label;
    if (state[def.id].img) btn.classList.add("has-image");
    if (def.id === activeLayerId) btn.classList.add("active");
    btn.addEventListener("click", () => setActiveLayer(def.id));
    root.appendChild(btn);
  }
}

function renderLayerEditor() {
  const root = document.getElementById("layerEditor");
  root.replaceChildren();
  const def = LAYER_DEFS.find((d) => d.id === activeLayerId);
  if (!def) return;
  const s = state[def.id];

  const fileLab = document.createElement("label");
  fileLab.innerHTML = "<span>PNG</span>";
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
      s.fileName = `templates/face/${def.id}/${f.name}`;
      draw();
      refreshJson();
      renderLayerTabs();
    };
    img.src = url;
  });
  fileLab.appendChild(fileInput);
  root.appendChild(fileLab);

  for (const [key, label, min, max, step] of [
    ["x", "X (или двигайте на превью)", -1024, 1024, 1],
    ["y", "Y", -1024, 1024, 1],
    ["scale", "Масштаб слоя", 0.1, 3, 0.01],
  ]) {
    const lab = document.createElement("label");
    const val = /** @type {"x" | "y" | "scale"} */ (key);
    lab.innerHTML = `<span>${label}: <output id="out-${key}">${s[val]}</output></span>`;
    const range = document.createElement("input");
    range.type = "range";
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(s[val]);
    range.addEventListener("input", () => {
      s[val] = Number(range.value);
      const out = document.getElementById(`out-${key}`);
      if (out) out.textContent = range.value;
      draw();
      refreshJson();
    });
    lab.appendChild(range);
    root.appendChild(lab);
  }

  if (def.id === "cosmetics") {
    const lab = document.createElement("label");
    lab.innerHTML = `<span>Прозрачность косметики: <output id="out-opacity">${s.opacity}</output></span>`;
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0.1";
    range.max = "1";
    range.step = "0.05";
    range.value = String(s.opacity);
    range.addEventListener("input", () => {
      s.opacity = Number(range.value);
      const out = document.getElementById("out-opacity");
      if (out) out.textContent = range.value;
      draw();
      refreshJson();
    });
    lab.appendChild(range);
    root.appendChild(lab);
  }

  const keyLab = document.createElement("label");
  keyLab.className = "toggle";
  const keyBox = document.createElement("input");
  keyBox.type = "checkbox";
  keyBox.checked = s.key;
  keyBox.addEventListener("change", () => {
    s.key = keyBox.checked;
    draw();
    refreshJson();
  });
  keyLab.appendChild(keyBox);
  keyLab.appendChild(document.createTextNode(" Key фона для слоя"));
  root.appendChild(keyLab);
}

function setupCanvasDrag() {
  canvas.addEventListener("pointerdown", (e) => {
    const s = state[activeLayerId];
    if (!s?.img) return;
    const p = canvasPoint(e.clientX, e.clientY);
    drag = {
      layerId: activeLayerId,
      startPx: p.x,
      startPy: p.y,
      startX: s.x,
      startY: s.y,
    };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const s = state[drag.layerId];
    if (!s) return;
    const p = canvasPoint(e.clientX, e.clientY);
    s.x = Math.round(drag.startX + (p.x - drag.startPx));
    s.y = Math.round(drag.startY + (p.y - drag.startPy));
    renderLayerEditor();
    draw();
    refreshJson();
    e.preventDefault();
  });

  const endDrag = (e) => {
    if (!drag) return;
    drag = null;
    canvas.classList.remove("dragging");
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
}

document.querySelectorAll(".zoom-buttons button").forEach((btn) => {
  btn.addEventListener("click", () => {
    applyDisplayZoom(Number(btn.getAttribute("data-zoom")));
  });
});

document.getElementById("keyWhite").addEventListener("change", draw);
document.getElementById("characterId").addEventListener("input", refreshJson);

document.getElementById("btnLoadJson").addEventListener("click", () => {
  /** @type {HTMLInputElement} */ (document.getElementById("jsonFile")).click();
});

document.getElementById("jsonFile").addEventListener("change", () => {
  const input = /** @type {HTMLInputElement} */ (document.getElementById("jsonFile"));
  const f = input.files?.[0];
  if (!f) return;
  f.text()
    .then((text) => {
      applySpec(JSON.parse(text));
    })
    .catch(() => {
      window.alert("Не удалось прочитать JSON");
    })
    .finally(() => {
      input.value = "";
    });
});

document.getElementById("btnJson").addEventListener("click", () => {
  const id =
    /** @type {HTMLInputElement} */ (document.getElementById("characterId")).value.trim() || "kat";
  downloadBlob(`face-${id}-assemble.json`, new Blob([JSON.stringify(buildSpec(), null, 2)], { type: "application/json" }));
});

document.getElementById("btnPng").addEventListener("click", () => {
  draw();
  canvas.toBlob((blob) => {
    if (blob) {
      const id =
        /** @type {HTMLInputElement} */ (document.getElementById("characterId")).value.trim() || "kat";
      downloadBlob(`face-${id}.png`, blob);
    }
  }, "image/png");
});

initState();
applyDisplayZoom(2);
setupCanvasDrag();
renderLayerTabs();
renderLayerEditor();
updateActiveLayerLabel();
refreshJson();
draw();

export {};
