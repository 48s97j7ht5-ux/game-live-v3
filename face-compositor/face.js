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

/** @typedef {{ img: HTMLImageElement | null, x: number, y: number, scale: number, key: boolean, opacity: number, fileName: string, loadError: string | null }} LayerState */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("canvas"));
const ctx = canvas.getContext("2d", { willReadFrequently: true });
if (!ctx) throw new Error("No 2d context");

const previewStage = /** @type {HTMLDivElement} */ (document.getElementById("previewStage"));
let activeLayerId = "head";
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
      loadError: null,
    };
  }
}

/** URL from site root (face-compositor/ → ../templates/...) */
function assetUrl(filePath) {
  const clean = filePath.replace(/^\.\//, "");
  return new URL(`../${clean}`, window.location.href).href;
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

function updateLoadStatus(extraMessage) {
  const el = document.getElementById("loadStatus");
  if (!el) return;
  const loaded = LAYER_DEFS.filter((d) => state[d.id].img).length;
  const errors = LAYER_DEFS.filter((d) => state[d.id].loadError).map(
    (d) => `${d.label}: ${state[d.id].loadError}`,
  );
  let text = `Слоёв с картинкой: ${loaded} из ${LAYER_DEFS.length}.`;
  if (loaded === 0) {
    text +=
      " На каждой вкладке нажмите «PNG» и выберите файл с телефона. JSON задаёт только координаты — картинки он не подставляет.";
    el.classList.add("warn");
  } else {
    el.classList.remove("warn");
  }
  if (errors.length) text += ` Не найдено в репо: ${errors.join("; ")}.`;
  if (extraMessage) text += ` ${extraMessage}`;
  el.textContent = text;
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
    }
  }
}

function countVisiblePixels() {
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 3; i < id.data.length; i += 4) {
    if (id.data[i] > 8) n++;
  }
  return n;
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
    try {
      const id = octx.getImageData(0, 0, w, h);
      keyImageData(id.data, 248);
      octx.putImageData(id, 0, 0);
    } catch {
      /* blob / CORS — рисуем без key */
    }
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

  if (LAYER_DEFS.some((d) => state[d.id].img)) {
    try {
      const vis = countVisiblePixels();
      if (vis < 50) {
        updateLoadStatus("На холсте почти ничего не видно — выключите «убрать фон» или проверьте key для слоя.");
      }
    } catch {
      /* ignore */
    }
  }
}

function layerVisibleFraction(s, img) {
  const x0 = s.x;
  const y0 = s.y;
  const x1 = s.x + img.width * s.scale;
  const y1 = s.y + img.height * s.scale;
  const ix0 = Math.max(0, x0);
  const iy0 = Math.max(0, y0);
  const ix1 = Math.min(canvas.width, x1);
  const iy1 = Math.min(canvas.height, y1);
  const iw = Math.max(0, ix1 - ix0);
  const ih = Math.max(0, iy1 - iy0);
  const inter = iw * ih;
  const total = img.width * img.height * s.scale * s.scale;
  return total > 0 ? inter / total : 0;
}

function shouldAutoFitLayer(s, img) {
  if (s.x === 0 && s.y === 0 && s.scale === 1) return true;
  return layerVisibleFraction(s, img) < 0.08;
}

function centerActiveLayer() {
  const s = state[activeLayerId];
  if (!s?.img) return;
  fitLayerToCanvas(s, s.img);
  draw();
  refreshJson();
  renderLayerEditor();
  updateLoadStatus("Слой отцентрирован и вписан в холст.");
}

function fitLayerToCanvas(s, img) {
  const cw = canvas.width;
  const ch = canvas.height;
  const scale = Math.min(1, cw / img.width, ch / img.height);
  s.scale = Math.round(scale * 1000) / 1000;
  const dw = img.width * s.scale;
  const dh = img.height * s.scale;
  s.x = Math.round((cw - dw) / 2);
  s.y = Math.round((ch - dh) / 2);
}

/**
 * @param {string} layerId
 * @param {string} url
 * @param {{ autoFit?: boolean, fileName?: string }} opts
 */
function loadImageForLayer(layerId, url, opts = {}) {
  const s = state[layerId];
  if (!s) return Promise.resolve(false);

  return new Promise((resolve) => {
    const img = new Image();
    if (!url.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = async () => {
      try {
        if (img.decode) await img.decode();
      } catch {
        /* ok */
      }
      s.img = img;
      s.loadError = null;
      if (opts.fileName) s.fileName = opts.fileName;
      if (opts.autoFit && shouldAutoFitLayer(s, img)) {
        fitLayerToCanvas(s, img);
      }
      draw();
      refreshJson();
      renderLayerTabs();
      if (activeLayerId === layerId) renderLayerEditor();
      updateLoadStatus();
      resolve(true);
    };
    img.onerror = () => {
      s.loadError = "файл не найден";
      updateLoadStatus();
      resolve(false);
    };
    img.src = url;
  });
}

async function loadAllFromRepo(silent) {
  const tasks = LAYER_DEFS.map((def) => {
    const s = state[def.id];
    const url = assetUrl(s.fileName);
    return loadImageForLayer(def.id, url, { autoFit: true });
  });
  await Promise.all(tasks);
  draw();
  refreshJson();
  renderLayerTabs();
  renderLayerEditor();
  if (!silent) {
    updateLoadStatus("Обновлено из paths в JSON / templates/face/.");
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

async function applySpec(spec, loadImages) {
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
  refreshJson();
  renderLayerTabs();
  renderLayerEditor();
  if (loadImages) {
    await loadAllFromRepo(true);
  } else {
    draw();
    updateLoadStatus("JSON загружен. Нажмите «Из репо» или загрузите PNG на вкладках слоёв.");
  }
}

async function loadCharacterFromRepo(characterId) {
  const url = assetUrl(`characters/${characterId}/face-assemble.json`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const spec = await res.json();
    await applySpec(spec, true);
    updateLoadStatus(`Профиль ${characterId} из репо.`);
  } catch {
    updateLoadStatus(`Не найден characters/${characterId}/face-assemble.json — загрузите PNG вручную.`);
  }
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

  if (s.img) {
    const meta = document.createElement("p");
    meta.className = "layer-meta";
    meta.textContent = `${s.fileName} · ${s.img.width}×${s.img.height}px`;
    root.appendChild(meta);
  } else if (s.loadError) {
    const meta = document.createElement("p");
    meta.className = "layer-meta warn";
    meta.textContent = `Не загружено (${s.loadError}). Выберите PNG ниже.`;
    root.appendChild(meta);
  }

  const fileLab = document.createElement("label");
  fileLab.innerHTML = "<span>PNG с телефона / файлов</span>";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/webp,image/jpeg,image/*";
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    loadImageForLayer(def.id, url, {
      autoFit: true,
      fileName: `templates/face/${def.id}/${f.name}`,
    }).then((ok) => {
      if (!ok) window.alert(`Не удалось открыть «${f.name}». Попробуйте PNG или выключите key.`);
    });
  });
  fileLab.appendChild(fileInput);
  root.appendChild(fileLab);

  if (s.img) {
    const row = document.createElement("div");
    row.className = "layer-actions";
    const centerBtn = document.createElement("button");
    centerBtn.type = "button";
    centerBtn.className = "btn ghost";
    centerBtn.textContent = "По центру (вписать)";
    centerBtn.addEventListener("click", centerActiveLayer);
    row.appendChild(centerBtn);
    root.appendChild(row);
  }

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
  keyLab.appendChild(document.createTextNode(" Key белого фона для слоя"));
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

document.getElementById("keyWhite").addEventListener("change", () => {
  draw();
  updateLoadStatus();
});
document.getElementById("characterId").addEventListener("input", refreshJson);

document.getElementById("btnReloadRepo").addEventListener("click", () => {
  loadAllFromRepo(false);
});

document.getElementById("btnLoadJson").addEventListener("click", () => {
  /** @type {HTMLInputElement} */ (document.getElementById("jsonFile")).click();
});

document.getElementById("jsonFile").addEventListener("change", () => {
  const input = /** @type {HTMLInputElement} */ (document.getElementById("jsonFile"));
  const f = input.files?.[0];
  if (!f) return;
  f.text()
    .then(async (text) => {
      await applySpec(JSON.parse(text), true);
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
updateLoadStatus();

const bootParams = new URLSearchParams(window.location.search);
const bootId =
  bootParams.get("character") || bootParams.get("id") || /** @type {HTMLInputElement} */ (document.getElementById("characterId")).value.trim();
if (bootId) {
  loadCharacterFromRepo(bootId);
} else {
  loadAllFromRepo(true);
}

export {};
