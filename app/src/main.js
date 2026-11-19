// Sunset Tilt Cover Studio — the editor (round 3, written fresh).
//
// Owns the model, the control panel, photo uploads, per-panel pan / zoom /
// filter, undo + redo, the live preview and the PNG exports. Photos never
// leave the machine: uploads are read with object URLs and the samples are
// local files under app/samples/.
import { renderPoster, FORMATS, COMPOSITIONS, TONES, PANEL_FILTERS, SLOT_COUNT, compositionCells } from './cover.js';
import { stageShot } from './shots.js';

const preview = document.getElementById('preview');
const statusLine = document.getElementById('status');
const captionField = document.getElementById('caption');
const kickerField = document.getElementById('kicker');
const subField = document.getElementById('subcaption');

// The model the renderer reads. Panel entries hold a photo (an <img>), a
// crop (zoom + offsets), a fit mode and one of the panel filters.
const model = {
  layout: 'grid9',
  grade: 'solar',
  sizeKey: '1920x1080',
  kicker: 'VICE CITY',
  caption: 'SUNSET TILT',
  subcaption: 'neon coast nights',
  captionScale: 1,
  captionLift: 0.55,
  halftone: true,
  frame: true,
  selected: 0,
  panels: Array.from({ length: SLOT_COUNT }, () => ({})),
};

// Photos the user loaded, in load order — shuffle and fill-all draw on it,
// and undo snapshots remember panels by index into this list.
const shelf = [];

export function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function chosenFormat() {
  return FORMATS[model.sizeKey] || FORMATS['1920x1080'];
}

function slotCount() {
  return (COMPOSITIONS[model.layout] || COMPOSITIONS.grid9).slots;
}

function paintPreview() {
  const { w, h } = chosenFormat();
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
  renderPoster(preview.getContext('2d'), w, h, model);
  preview.dataset.layout = model.layout;
  preview.dataset.size = model.sizeKey;
}

function say(text) {
  statusLine.textContent = text;
}

// --- undo / redo ---------------------------------------------------------
// A snapshot is the whole model minus the <img> objects: panels remember
// their photo as an index into `shelf`, so a snapshot round-trips cleanly.
const past = [];
const future = [];

function snapshot() {
  return JSON.stringify({
    layout: model.layout,
    grade: model.grade,
    sizeKey: model.sizeKey,
    kicker: model.kicker,
    caption: model.caption,
    subcaption: model.subcaption,
    captionScale: model.captionScale,
    captionLift: model.captionLift,
    halftone: model.halftone,
    frame: model.frame,
    selected: model.selected,
    panels: model.panels.map((p) => ({
      img: p.image ? shelf.indexOf(p.image) : -1,
      zoom: p.zoom || 1,
      ox: p.ox || 0,
      oy: p.oy || 0,
      cover: p.cover !== false,
      filter: p.filter || 'none',
    })),
  });
}

function restore(text) {
  const snap = JSON.parse(text);
  Object.assign(model, {
    layout: snap.layout,
    grade: snap.grade,
    sizeKey: snap.sizeKey,
    kicker: snap.kicker,
    caption: snap.caption,
    subcaption: snap.subcaption,
    captionScale: snap.captionScale,
    captionLift: snap.captionLift,
    halftone: snap.halftone,
    frame: snap.frame,
    selected: snap.selected,
  });
  model.panels = snap.panels.map((p) => ({
    image: p.img >= 0 ? shelf[p.img] : undefined,
    zoom: p.zoom,
    ox: p.ox,
    oy: p.oy,
    cover: p.cover,
    filter: p.filter,
  }));
  syncInputs();
  paintPreview();
}

function remember() {
  past.push(snapshot());
  if (past.length > 60) past.shift();
  future.length = 0;
  refreshHistoryButtons();
}

function undo() {
  if (!past.length) return;
  future.push(snapshot());
  restore(past.pop());
  refreshHistoryButtons();
  say('Undid that change.');
}

function redo() {
  if (!future.length) return;
  past.push(snapshot());
  restore(future.pop());
  refreshHistoryButtons();
  say('Redid that change.');
}

function refreshHistoryButtons() {
  document.getElementById('undoBtn').disabled = past.length === 0;
  document.getElementById('redoBtn').disabled = future.length === 0;
}

// --- panel helpers -------------------------------------------------------
function selectedPanel() {
  return model.panels[model.selected] || {};
}

function choosePanel(i) {
  model.selected = Math.max(0, Math.min(SLOT_COUNT - 1, i));
  document.getElementById('panelLabel').textContent = `Panel ${model.selected + 1} of ${slotCount()}`;
  const p = selectedPanel();
  document.getElementById('zoom').value = p.zoom || 1;
  document.getElementById('zoomVal').textContent = `${Math.round((p.zoom || 1) * 100)}%`;
  document.getElementById('fitToggle').textContent = `Fit: ${p.cover === false ? 'fit' : 'fill'}`;
  document.getElementById('panelFilter').value = p.filter || 'none';
}

function fillPanelsWith(img, alternate) {
  model.panels = model.panels.map((p, i) => ({
    ...p,
    image: alternate ? (i % 2 === 0 ? img : alternate) : img,
    zoom: 1,
    ox: 0,
    oy: 0,
    cover: true,
    filter: p.filter || 'none',
  }));
}

function syncInputs() {
  kickerField.value = model.kicker;
  captionField.value = model.caption;
  subField.value = model.subcaption;
  document.getElementById('capSize').value = model.captionScale;
  document.getElementById('capSizeVal').textContent = `${Math.round(model.captionScale * 100)}%`;
  document.getElementById('capY').value = model.captionLift;
  document.getElementById('halftoneToggle').textContent = `Halftone titles: ${model.halftone ? 'on' : 'off'}`;
  document.getElementById('frameToggle').textContent = `Neon frame: ${model.frame ? 'on' : 'off'}`;
  document.querySelectorAll('#layoutBox .opt').forEach((el) => el.classList.toggle('active', el.dataset.key === model.layout));
  document.querySelectorAll('#gradeBox .opt').forEach((el) => el.classList.toggle('active', el.dataset.key === model.grade));
  document.querySelectorAll('#sizeBox input').forEach((el) => { el.checked = el.value === model.sizeKey; });
  choosePanel(model.selected);
}

// --- option buttons ------------------------------------------------------
function buildPickers(containerId, entries, current, onPick) {
  const box = document.getElementById(containerId);
  Object.entries(entries).forEach(([key, info]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `opt${key === current ? ' active' : ''}`;
    b.dataset.key = key;
    b.title = info.blurb || info.label || '';
    b.textContent = info.name;
    b.addEventListener('click', () => {
      remember();
      onPick(key);
      box.querySelectorAll('.opt').forEach((el) => el.classList.toggle('active', el.dataset.key === key));
      paintPreview();
    });
    box.appendChild(b);
  });
}

buildPickers('layoutBox', COMPOSITIONS, model.layout, (key) => {
  model.layout = key;
  choosePanel(model.selected);
  say(`Layout: ${COMPOSITIONS[key].name} — ${COMPOSITIONS[key].slots} panels.`);
});
buildPickers('gradeBox', TONES, model.grade, (key) => {
  model.grade = key;
  say(`Grade: ${TONES[key].name}.`);
});

const sizeBox = document.getElementById('sizeBox');
Object.entries(FORMATS).forEach(([key, info]) => {
  const label = document.createElement('label');
  label.className = 'size';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'size';
  input.value = key;
  input.checked = key === model.sizeKey;
  input.addEventListener('change', () => {
    remember();
    model.sizeKey = key;
    paintPreview();
    say(`Export size: ${info.label}.`);
  });
  label.appendChild(input);
  label.appendChild(document.createTextNode(info.label));
  sizeBox.appendChild(label);
});

// --- export --------------------------------------------------------------
function exportPNG(sizeKey) {
  const fmt = FORMATS[sizeKey] || FORMATS['1920x1080'];
  const off = document.createElement('canvas');
  off.width = fmt.w;
  off.height = fmt.h;
  renderPoster(off.getContext('2d'), fmt.w, fmt.h, model);
  return off.toDataURL('image/png');
}

function downloadPNG(sizeKey) {
  const fmt = FORMATS[sizeKey] || FORMATS['1920x1080'];
  const a = document.createElement('a');
  a.href = exportPNG(sizeKey);
  a.download = `sunset-tilt-cover-${sizeKey}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return fmt;
}

document.getElementById('export').addEventListener('click', () => {
  const fmt = downloadPNG(model.sizeKey);
  say(`Exported ${fmt.label} PNG — check your downloads.`);
});

document.getElementById('exportAll').addEventListener('click', () => {
  ['1080x1080', '1080x1350', '1920x1080'].forEach((key) => downloadPNG(key));
  say('Exported all 3 sizes at once — 1080×1080, 1080×1350, 1920×1080.');
});

document.getElementById('exportStory').addEventListener('click', () => {
  downloadPNG('1080x1920');
  say('Exported the 1080×1920 story size.');
});

// --- title + panel controls ----------------------------------------------
kickerField.addEventListener('input', () => { model.kicker = kickerField.value; paintPreview(); });
captionField.addEventListener('input', () => { model.caption = captionField.value; paintPreview(); });
subField.addEventListener('input', () => { model.subcaption = subField.value; paintPreview(); });
document.getElementById('capSize').addEventListener('input', (e) => {
  model.captionScale = Number(e.target.value);
  document.getElementById('capSizeVal').textContent = `${Math.round(model.captionScale * 100)}%`;
  paintPreview();
});
document.getElementById('capY').addEventListener('input', (e) => {
  model.captionLift = Number(e.target.value);
  paintPreview();
});
document.getElementById('halftoneToggle').addEventListener('click', (e) => {
  remember();
  model.halftone = !model.halftone;
  e.target.textContent = `Halftone titles: ${model.halftone ? 'on' : 'off'}`;
  paintPreview();
});
document.getElementById('frameToggle').addEventListener('click', (e) => {
  remember();
  model.frame = !model.frame;
  e.target.textContent = `Neon frame: ${model.frame ? 'on' : 'off'}`;
  paintPreview();
});
document.getElementById('zoom').addEventListener('input', (e) => {
  const p = selectedPanel();
  p.zoom = Number(e.target.value);
  document.getElementById('zoomVal').textContent = `${Math.round(p.zoom * 100)}%`;
  paintPreview();
});
document.getElementById('fitToggle').addEventListener('click', (e) => {
  remember();
  const p = selectedPanel();
  p.cover = p.cover === false;
  e.target.textContent = `Fit: ${p.cover === false ? 'fit' : 'fill'}`;
  paintPreview();
});
document.getElementById('panelFilter').addEventListener('change', (e) => {
  remember();
  selectedPanel().filter = e.target.value;
  paintPreview();
  say(`Panel ${model.selected + 1} filter: ${PANEL_FILTERS[e.target.value].name}.`);
});
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

// --- photos ---------------------------------------------------------------
async function loadSamples(mixed) {
  const pier = await fetchImage('samples/pier.jpg');
  const boulevard = await fetchImage('samples/boulevard.jpg');
  if (!shelf.includes(pier)) shelf.push(pier);
  if (!shelf.includes(boulevard)) shelf.push(boulevard);
  if (mixed) fillPanelsWith(pier, boulevard);
  else fillPanelsWith(pier);
  paintPreview();
  say(mixed ? 'Both samples loaded across the panels.' : 'Pier sample loaded into every panel.');
}

async function loadSample(name) {
  const img = await fetchImage(`samples/${name}.jpg`);
  if (!shelf.includes(img)) shelf.push(img);
  fillPanelsWith(img);
  paintPreview();
  say(`${name} sample loaded into every panel.`);
}

document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  remember();
  const imgs = await Promise.all(files.map((f) => fetchImage(URL.createObjectURL(f))));
  imgs.forEach((img) => { if (!shelf.includes(img)) shelf.push(img); });
  imgs.forEach((img, k) => {
    const slot = k % SLOT_COUNT;
    model.panels[slot] = { image: img, zoom: 1, ox: 0, oy: 0, cover: true, filter: 'none' };
  });
  paintPreview();
  say(`${imgs.length} photo${imgs.length > 1 ? 's' : ''} loaded — click a panel, then drag to crop it.`);
});

document.querySelectorAll('[data-sample]').forEach((b) => {
  b.addEventListener('click', () => {
    remember();
    loadSample(b.dataset.sample).catch((err) => say(err.message));
  });
});
document.getElementById('mixSamples').addEventListener('click', () => {
  remember();
  loadSamples(true).catch((err) => say(err.message));
});
document.getElementById('fillAll').addEventListener('click', () => {
  if (!shelf.length) { say('Load a photo first.'); return; }
  remember();
  fillPanelsWith(shelf[shelf.length - 1]);
  paintPreview();
  say('Every panel now shows the latest photo.');
});
document.getElementById('shuffle').addEventListener('click', () => {
  if (shelf.length < 2) { say('Load at least two photos to shuffle.'); return; }
  remember();
  model.panels = model.panels.map((p) => ({
    ...p,
    image: shelf[Math.floor(Math.random() * shelf.length)],
  }));
  paintPreview();
  say('Photos shuffled across the panels.');
});
document.getElementById('resetPanels').addEventListener('click', () => {
  remember();
  model.panels = Array.from({ length: SLOT_COUNT }, () => ({}));
  paintPreview();
  say('Panels cleared — load a photo to start again.');
});

// --- drag to pan the selected panel ---------------------------------------
let drag = null;
function canvasCellAt(e) {
  const box = preview.getBoundingClientRect();
  const px = (e.clientX - box.left) * (preview.width / box.width);
  const py = (e.clientY - box.top) * (preview.height / box.height);
  const { cells } = compositionCells(model.layout, preview.width, preview.height);
  const hit = cells.findIndex((c) => px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h);
  return { px, py, hit };
}
preview.addEventListener('pointerdown', (e) => {
  const { px, py, hit } = canvasCellAt(e);
  if (hit < 0) return;
  choosePanel(hit);
  drag = { px, py, ox: selectedPanel().ox || 0, oy: selectedPanel().oy || 0, moved: false };
  preview.setPointerCapture(e.pointerId);
});
preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { px, py } = canvasCellAt(e);
  const p = selectedPanel();
  p.ox = drag.ox + (px - drag.px) / preview.width;
  p.oy = drag.oy + (py - drag.py) / preview.height;
  if (Math.abs(px - drag.px) + Math.abs(py - drag.py) > 4) drag.moved = true;
  paintPreview();
});
preview.addEventListener('pointerup', () => {
  if (drag && drag.moved) remember();
  drag = null;
});

// --- test / screenshot hooks ----------------------------------------------
window.__coverApp = {
  state: model,
  setLayout(key) { remember(); model.layout = key; syncInputs(); paintPreview(); },
  setGrade(key) { remember(); model.grade = key; syncInputs(); paintPreview(); },
  setFilter(key) { remember(); selectedPanel().filter = key; paintPreview(); },
  exportPNG,
  undo,
  redo,
};

// --- boot -----------------------------------------------------------------
(async () => {
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  paintPreview();
  choosePanel(0);
  refreshHistoryButtons();
  try {
    if (shot) {
      await stageShot(shot, query, model, paintPreview, fetchImage, say);
      syncInputs();
    } else {
      await loadSamples(true);
    }
  } catch (err) {
    say(err.message);
  }
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* fonts are optional for the first paint */ }
    paintPreview();
  }
  window.__shotReady = true;
})();
