/** @typedef {{ characterId: string, shotName: string }} Meta */

const BASE_APPEARANCE = {
  clothes: [],
  color_adjustments: {},
  eyebrows: "eyebrow001/eyebrow001.mhclo",
  eyelashes: "eyelashes01/eyelashes01.mhclo",
  eyes: "high-poly/high-poly.mhclo",
  eyes_material_settings: {},
  eyes_material_type: "MAKESKIN",
  hair: "",
  makeup: [],
  proxy: "",
  skin_material_settings: {},
  skin_material_type: "MAKESKIN",
  targets: [],
  teeth: "",
  tongue: "",
};

/** @type {Record<string, string>} */
const RIG_TO_POSE_FOLDER = {
  default_no_toes: "default_fk",
  default: "default_fk",
  game_engine: "game_engine_fk",
};

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function readMeta() {
  const characterId = /** @type {HTMLInputElement} */ ($("characterId")).value.trim() || "hero";
  const shotName = /** @type {HTMLInputElement} */ ($("shotName")).value.trim() || "portrait";
  return { characterId, shotName };
}

function normalizeRace(caucasian, asian, african) {
  const sum = caucasian + asian + african;
  if (sum <= 0) {
    return { caucasian: 1 / 3, asian: 1 / 3, african: 1 / 3 };
  }
  return {
    caucasian: caucasian / sum,
    asian: asian / sum,
    african: african / sum,
  };
}

function parseClothes(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildAppearance() {
  const gender = Number(/** @type {HTMLInputElement} */ ($("gender")).value);
  const race = normalizeRace(
    Number($("raceCaucasian").value),
    Number($("raceAsian").value),
    Number($("raceAfrican").value),
  );

  /** @type {typeof BASE_APPEARANCE & { phenotype: object, rig: string, skin_mhmat: string }} */
  const appearance = structuredClone(BASE_APPEARANCE);
  appearance.clothes = parseClothes(/** @type {HTMLInputElement} */ ($("clothes")).value);
  appearance.hair = /** @type {HTMLInputElement} */ ($("hair")).value.trim();
  appearance.rig = /** @type {HTMLSelectElement} */ ($("rig")).value;
  appearance.skin_mhmat = /** @type {HTMLSelectElement} */ ($("skinMhmat")).value;
  appearance.phenotype = {
    age: Number($("age").value),
    cupsize: 0.55,
    firmness: 0.55,
    gender,
    height: Number($("height").value),
    muscle: Number($("muscle").value),
    proportions: Number($("proportions").value),
    race,
    weight: Number($("weight").value),
  };

  return appearance;
}

function buildShot(meta) {
  const rig = /** @type {HTMLSelectElement} */ ($("rig")).value;
  const poseFolder = RIG_TO_POSE_FOLDER[rig] ?? "default_fk";
  const customPose = /** @type {HTMLInputElement} */ ($("customPose")).value.trim();
  const pose =
    customPose || /** @type {HTMLSelectElement} */ ($("pose")).value || "t-pose";
  const [width, height] = /** @type {HTMLSelectElement} */ ($("resolution"))
    .value.split("x")
    .map(Number);

  return {
    schema: "game-live-v3/shot/1",
    character_id: meta.characterId,
    shot_name: meta.shotName,
    output: `output/${meta.characterId}/${meta.shotName}.png`,
    rig,
    pose_folder: poseFolder,
    pose,
    camera: {
      distance_m: Number($("camDistance").value),
      height_m: Number($("camHeight").value),
      focal_length_mm: Number($("camFocal").value),
    },
    render: {
      engine: /** @type {HTMLSelectElement} */ ($("engine")).value,
      width,
      height,
    },
  };
}

function buildJob() {
  const meta = readMeta();
  return {
    schema: "game-live-v3/job/1",
    ...meta,
    paths: {
      appearance: `characters/${meta.characterId}/appearance.json`,
      shot: `characters/${meta.characterId}/shots/${meta.shotName}.json`,
    },
    appearance: buildAppearance(),
    shot: buildShot(meta),
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function refreshPreview() {
  const job = buildJob();
  /** @type {HTMLTextAreaElement} */ ($("preview")).value = JSON.stringify(job, null, 2);
}

function updateGenderLabel() {
  const v = Number($("gender").value);
  /** @type {HTMLOutputElement} */ ($("genderOut")).textContent =
    v < 0.25 ? "женский" : v > 0.75 ? "мужской" : "среднее";
}

function wireEvents() {
  const inputs = document.querySelectorAll("input, select, textarea");
  inputs.forEach((el) => {
    el.addEventListener("input", () => {
      updateGenderLabel();
      refreshPreview();
    });
  });

  $("btnDownloadAppearance").addEventListener("click", () => {
    const meta = readMeta();
    downloadJson("appearance.json", buildAppearance());
  });

  $("btnDownloadShot").addEventListener("click", () => {
    const meta = readMeta();
    downloadJson(`${meta.shotName}.json`, buildShot(meta));
  });

  $("btnDownloadJob").addEventListener("click", () => {
    const meta = readMeta();
    downloadJson(`${meta.characterId}-${meta.shotName}-job.json`, buildJob());
  });

  $("btnCopyJob").addEventListener("click", async () => {
    const text = JSON.stringify(buildJob(), null, 2);
    await navigator.clipboard.writeText(text);
    /** @type {HTMLButtonElement} */ ($("btnCopyJob")).textContent = "Скопировано";
    setTimeout(() => {
      /** @type {HTMLButtonElement} */ ($("btnCopyJob")).textContent =
        "Копировать job в буфер";
    }, 1500);
  });
}

updateGenderLabel();
wireEvents();
refreshPreview();
