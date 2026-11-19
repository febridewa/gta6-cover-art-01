// Fixed scenes for screenshots.
// ?shot=cover shows the exported cover alone (controls hidden).
// ?shot=editor shows the editor with sample photos loaded.
// `photo` picks the sample, `caption` the words, `layout` and `grade` the look.
// window.__shotReady is set by main.js once the scene has painted.
export async function runShot(shot, query, state, renderPreview, loadImage, setStatus) {
  const photoName = query.get('photo') ?? 'pier';
  const secondPhoto = query.get('photo2') ?? 'boulevard';
  const caption = query.get('caption') ?? 'SUNSET HEIST';
  const sub = query.get('sub') ?? 'vice city nights';
  state.layout = query.get('layout') ?? 'poster';
  state.grade = query.get('grade') ?? 'sunset';
  state.sizeKey = query.get('size') ?? '1920x1080';
  state.caption = caption;
  state.subcaption = sub;
  state.captionSize = Number(query.get('capSize') ?? 1);
  state.captionY = Number(query.get('capY') ?? 0.55);

  const first = await loadImage(`samples/${photoName}.jpg`);
  const second = await loadImage(`samples/${secondPhoto}.jpg`);
  // Hero gets the first photo; the small panels alternate, like a real poster.
  // The poster hero is a wide slice of a square photo, so nudge it down to keep
  // the subject's head in frame instead of cropping it at the top edge.
  // Other layouts use near-square panels, so no nudge there.
  const heroNudge = state.layout === 'poster' ? 0.18 : 0;
  state.panels = state.panels.map((p, i) => ({
    ...p,
    image: i === 0 ? first : (i % 2 === 0 ? second : first),
    zoom: 1, ox: 0, oy: i === 0 ? heroNudge : 0,
  }));
  state.selected = 0;

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.getElementById('caption').value = caption;
    document.getElementById('subcaption').value = sub;
  }
  renderPreview();
  setStatus(`Shot scene “${shot}” ready — ${state.layout} layout, ${state.grade} grade.`);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
