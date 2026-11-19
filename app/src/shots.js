// Fixed scenes for screenshots (round 3).
// ?shot=cover shows the exported cover alone (controls hidden).
// ?shot=editor shows the editor with sample photos loaded.
// `photo` picks the first sample, `photo2` the second, `caption` the words,
// `kicker` the small line above it, `layout` and `grade` the look.
// window.__shotReady is set by main.js once the scene has painted.
import { COMPOSITIONS } from './cover.js';

export async function stageShot(shot, query, model, paintPreview, fetchImage, say) {
  const firstName = query.get('photo') ?? 'pier';
  const secondName = query.get('photo2') ?? 'boulevard';
  const caption = query.get('caption') ?? 'SUNSET TILT';
  const kicker = query.get('kicker') ?? 'VICE CITY';
  const sub = query.get('sub') ?? 'neon coast nights';
  model.layout = query.get('layout') ?? 'tilt';
  model.grade = query.get('grade') ?? 'solar';
  model.sizeKey = query.get('size') ?? '1920x1080';
  model.kicker = kicker;
  model.caption = caption;
  model.subcaption = sub;
  model.captionScale = Number(query.get('capSize') ?? 1);
  model.captionLift = Number(query.get('capY') ?? 0.55);
  model.halftone = query.get('halftone') !== 'off';
  model.frame = query.get('frame') !== 'off';
  model.filter = undefined;

  const first = await fetchImage(`samples/${firstName}.jpg`);
  const second = await fetchImage(`samples/${secondName}.jpg`);
  const slots = (COMPOSITIONS[model.layout] || COMPOSITIONS.tilt).slots;
  // Alternate the two samples across the slots. The hero slot gets a
  // gentle zoom and a nudge down so a tall subject stays in frame, and the
  // second slot gets the warm panel filter to show that feature off.
  model.panels = model.panels.map((p, i) => {
    const hero = i === 0;
    return {
      ...p,
      image: i % 2 === 0 ? first : second,
      zoom: hero ? 1.05 : 1,
      ox: 0,
      oy: hero ? 0.05 : 0,
      cover: true,
      filter: i === 1 ? 'warm' : 'none',
    };
  });
  // Slots past this layout's count keep no photo.
  for (let i = slots; i < model.panels.length; i += 1) {
    model.panels[i] = {};
  }
  model.selected = 0;

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.getElementById('kicker').value = kicker;
    document.getElementById('caption').value = caption;
    document.getElementById('subcaption').value = sub;
  }
  paintPreview();
  say(`Shot scene "${shot}" ready — ${model.layout} layout, ${model.grade} grade, ${slots} panels.`);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
