// Fixed scenes for screenshots (round 2).
// ?shot=cover shows the exported cover alone (controls hidden).
// ?shot=editor shows the editor with sample photos loaded.
// `photo` picks the first sample, `photo2` the second, `caption` the words,
// `kicker` the small line above it, `layout` and `grade` the look.
// window.__shotReady is set by main.js once the scene has painted.
import { LAYOUTS } from './cover.js';

export async function runShot(shot, query, state, renderPreview, loadImage, setStatus) {
  const photoName = query.get('photo') ?? 'pier';
  const secondPhoto = query.get('photo2') ?? 'boulevard';
  const caption = query.get('caption') ?? 'VICE GRID';
  const kicker = query.get('kicker') ?? 'VICE CITY';
  const sub = query.get('sub') ?? 'neon coast nights';
  state.layout = query.get('layout') ?? 'nine';
  state.grade = query.get('grade') ?? 'golden';
  state.sizeKey = query.get('size') ?? '1920x1080';
  state.kicker = kicker;
  state.caption = caption;
  state.subcaption = sub;
  state.captionSize = Number(query.get('capSize') ?? 1);
  state.captionY = Number(query.get('capY') ?? 0.55);
  state.halftone = query.get('halftone') !== 'off';
  state.frame = query.get('frame') !== 'off';

  const first = await loadImage(`samples/${photoName}.jpg`);
  const second = await loadImage(`samples/${secondPhoto}.jpg`);
  const count = (LAYOUTS[state.layout] || LAYOUTS.nine).panels;
  // Alternate the two samples across the panels; give the hero / first panel
  // a gentle zoom and a nudge down so a tall subject stays in frame.
  state.panels = state.panels.map((p, i) => {
    const hero = i === 0 && (state.layout === 'poster' || state.layout === 'mosaic');
    return {
      ...p,
      image: i % 2 === 0 ? first : second,
      zoom: hero ? 1.15 : 1,
      ox: 0,
      oy: hero ? 0.16 : 0,
    };
  });
  // Panels past the layout's count keep no photo.
  for (let i = count; i < state.panels.length; i += 1) {
    state.panels[i] = {};
  }
  state.selected = 0;

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.getElementById('kicker').value = kicker;
    document.getElementById('caption').value = caption;
    document.getElementById('subcaption').value = sub;
  }
  renderPreview();
  setStatus(`Shot scene “${shot}” ready — ${state.layout} layout, ${state.grade} grade, ${count} panels.`);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
