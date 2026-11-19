// Neon Coast Cover Studio — the editor.
// Owns the state, the control panel, photo uploads, per-panel pan/zoom,
// the live preview and the PNG export. Photos never leave the machine.
import { drawCover, SIZES, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const statusEl = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subInput = document.getElementById('subcaption');

const state = {
  layout: 'poster',
  grade: 'sunset',
  sizeKey: '1920x1080',
  caption: 'SUNSET HEIST',
  subcaption: 'vice city nights',
  captionSize: 1,
  captionY: 0.55,
  selected: 0,
  panels: [{}, {}, {}, {}],
};

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function currentSize() {
  return SIZES[state.sizeKey];
}

function renderPreview() {
  const { w, h } = currentSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  drawCover(ctx, w, h, state, true);
  canvas.dataset.layout = state.layout;
  canvas.dataset.size = state.sizeKey;
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** Fill every panel with the given image (each panel keeps its own crop). */
function fillAllPanels(img) {
  state.panels = state.panels.map((p) => ({ ...p, image: img }));
  renderPreview();
}

async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  fillAllPanels(img);
  setStatus(`Sample ${name} loaded into all panels — pick a panel to change it.`);
}

function selectPanel(i) {
  state.selected = i;
  syncPanelControls();
  renderPreview();
}

function syncPanelControls() {
  const p = state.panels[state.selected] || {};
  document.getElementById('zoom').value = p.zoom || 1;
  document.getElementById('zoomVal').textContent = `${Math.round((p.zoom || 1) * 100)}%`;
  document.getElementById('fitToggle').textContent = p.fit === 'fit' ? 'Fit: contain' : 'Fit: fill';
  document.getElementById('panelLabel').textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
}

function buildOptionButtons(containerId, entries, current, onPick) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  Object.entries(entries).forEach(([key, info]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.dataset.key = key;
    b.innerHTML = `<strong>${info.name}</strong><span>${info.hint}</span>`;
    if (key === current) b.classList.add('active');
    b.addEventListener('click', () => {
      onPick(key);
      box.querySelectorAll('.opt').forEach((el) => el.classList.toggle('active', el.dataset.key === key));
    });
    box.appendChild(b);
  });
}

buildOptionButtons('layoutBox', LAYOUTS, state.layout, (key) => {
  state.layout = key;
  renderPreview();
});
buildOptionButtons('gradeBox', GRADES, state.grade, (key) => {
  state.grade = key;
  renderPreview();
});

// Export size radios.
const sizeBox = document.getElementById('sizeBox');
Object.entries(SIZES).forEach(([key, info]) => {
  const label = document.createElement('label');
  label.className = 'radio';
  label.innerHTML = `<input type="radio" name="size" value="${key}" ${key === state.sizeKey ? 'checked' : ''}> ${info.label}`;
  label.querySelector('input').addEventListener('change', () => {
    state.sizeKey = key;
    renderPreview();
  });
  sizeBox.appendChild(label);
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  renderPreview();
});
subInput.addEventListener('input', () => {
  state.subcaption = subInput.value;
  renderPreview();
});
document.getElementById('capSize').addEventListener('input', (e) => {
  state.captionSize = Number(e.target.value);
  document.getElementById('capSizeVal').textContent = `${Math.round(state.captionSize * 100)}%`;
  renderPreview();
});
document.getElementById('capY').addEventListener('input', (e) => {
  state.captionY = Number(e.target.value);
  renderPreview();
});

document.getElementById('zoom').addEventListener('input', (e) => {
  const p = state.panels[state.selected];
  p.zoom = Number(e.target.value);
  document.getElementById('zoomVal').textContent = `${Math.round(p.zoom * 100)}%`;
  renderPreview();
});
document.getElementById('fitToggle').addEventListener('click', () => {
  const p = state.panels[state.selected];
  p.fit = p.fit === 'fit' ? 'fill' : 'fit';
  syncPanelControls();
  renderPreview();
});
document.getElementById('fillAll').addEventListener('click', () => {
  const img = state.panels[state.selected].image;
  if (!img) { setStatus('Load a photo into the selected panel first.'); return; }
  fillAllPanels(img);
  setStatus('All panels now use the selected panel’s photo.');
});

document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  try {
    const imgs = await Promise.all(files.map((f) => loadImage(URL.createObjectURL(f))));
    imgs.forEach((img, k) => {
      const idx = (state.selected + k) % state.panels.length;
      state.panels[idx] = { ...state.panels[idx], image: img, zoom: 1, ox: 0, oy: 0 };
    });
    renderPreview();
    setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} loaded — drag a panel to pan, use Zoom to crop.`);
  } catch (err) {
    setStatus(`Could not read that file: ${err.message}`);
  }
  e.target.value = '';
});

document.querySelectorAll('[data-sample]').forEach((b) => {
  b.addEventListener('click', () => loadSample(b.dataset.sample).catch((err) => setStatus(err.message)));
});

// Click a panel to select it; drag to pan its photo.
let drag = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  drag = { pt, panel: state.selected, moved: false };
  canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const dx = (pt.x - drag.pt.x) / canvas.width;
  const dy = (pt.y - drag.pt.y) / canvas.height;
  if (Math.abs(dx) + Math.abs(dy) > 0.002) drag.moved = true;
  const p = state.panels[drag.panel];
  if (p && p.image && drag.moved) {
    p.ox = (p.ox || 0) + dx;
    p.oy = (p.oy || 0) + dy;
    p.ox = Math.max(-0.6, Math.min(0.6, p.ox));
    p.oy = Math.max(-0.6, Math.min(0.6, p.oy));
    drag.pt = pt;
    renderPreview();
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  if (!drag.moved) {
    // A plain click selects the panel under the pointer.
    import('./cover.js').then(({ layoutGeometry }) => {
      const { panels } = layoutGeometry(state.layout, canvas.width, canvas.height);
      const pt = canvasPoint(e);
      const hit = panels.findIndex((r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h);
      if (hit >= 0) selectPanel(hit);
    });
  }
  drag = null;
});

/** Render the cover at an export size and return a PNG data URL. */
export function exportPNG(sizeKey) {
  const { w, h } = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off.getContext('2d'), w, h, state, false);
  return off.toDataURL('image/png');
}

document.getElementById('export').addEventListener('click', () => {
  const dataUrl = exportPNG(state.sizeKey);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `neon-coast-cover-${state.sizeKey}.png`;
  a.click();
  setStatus(`Exported neon-coast-cover-${state.sizeKey}.png — ${SIZES[state.sizeKey].label}.`);
});

// Test / screenshot hooks.
window.__coverApp = {
  state,
  renderPreview,
  exportPNG,
  loadSample,
  selectPanel,
  setLayout: (layout) => { state.layout = layout; renderPreview(); },
  setGrade: (grade) => { state.grade = grade; renderPreview(); },
};

async function boot() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
  } catch { /* fonts fall back; canvas still draws */ }
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, state, renderPreview, loadImage, setStatus);
  } else {
    await loadSample('pier').catch(() => renderPreview());
    syncPanelControls();
    renderPreview();
  }
  window.__shotReady = true;
}

boot();
