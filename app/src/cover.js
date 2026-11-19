// Sunset Tilt Cover Studio — poster renderer (round 3, written fresh).
//
// Everything the cover shows is drawn here on a 2D canvas: the panel grid,
// the Vice City sunset title band (sun, skyline, palms, halftone dots), the
// colour grade and the grain. No image leaves the machine and no font or
// picture comes from the network — the only pictures are the user's own
// photos plus the two image-model samples shipped under app/samples/.
//
// A "model" is the plain object main.js keeps: layout, grade, kicker,
// caption, subcaption, captionScale, captionLift, halftone, frame, and one
// panel entry per slot { image, zoom, ox, oy, cover, filter }.

export const FORMATS = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
  '1080x1920': { w: 1080, h: 1920, label: 'Story · 1080 × 1920' },
};

export const COMPOSITIONS = {
  grid9: { name: 'Nine Grid', blurb: 'Classic 3 × 3 poster grid', slots: 9 },
  heroNine: { name: 'Hero Nine', blurb: 'One hero panel, eight small', slots: 9 },
  mosaic: { name: 'Mosaic', blurb: 'One big panel, six small', slots: 7 },
  strip4: { name: 'Strip Four', blurb: 'Four tall vertical strips', slots: 4 },
  quad: { name: 'Quad', blurb: 'Four even squares', slots: 4 },
  triptych: { name: 'Triptych', blurb: 'Three tall panels', slots: 3 },
  duo: { name: 'Duo', blurb: 'Two panels, hero left', slots: 2 },
  tilt: { name: 'Tilted Snapshot', blurb: 'One tilted hero + three snaps', slots: 4 },
  heroThree: { name: 'Hero + Three', blurb: 'Wide hero over three below', slots: 4 },
};

export const TONES = {
  sunset: { name: 'Sunset', blurb: 'Orange-to-pink dusk', wash: ['#ff9a3c', '#ff5e7a', '#7a2ea6'], ink: '#fff3d6' },
  neon: { name: 'Neon Night', blurb: 'Magenta + cyan after dark', wash: ['#ff2e88', '#7b2ff7', '#00e5ff'], ink: '#eafcff' },
  pastel: { name: 'Pastel Vice', blurb: 'Soft candy pastels', wash: ['#ffd6a5', '#ff9ebb', '#a5b4fc'], ink: '#fff7ed' },
  noir: { name: 'Noir', blurb: 'High-contrast black + amber', wash: ['#3a3a3a', '#111111', '#f5a623'], ink: '#f5f5f0' },
  golden: { name: 'Golden Hour', blurb: 'Warm honey light', wash: ['#ffd166', '#f4842b', '#b4652a'], ink: '#fff8e1' },
  magenta: { name: 'Magenta Dusk', blurb: 'Deep pink evening', wash: ['#ff5c8a', '#c2185b', '#311b92'], ink: '#ffe3ee' },
  cyan: { name: 'Cyan Chrome', blurb: 'Cool chrome blue', wash: ['#67e8f9', '#0ea5e9', '#1e3a8a'], ink: '#ecfeff' },
  duotone: { name: 'Duotone', blurb: 'Two-tone ink print', wash: ['#f97316', '#111827', '#f97316'], ink: '#fff7ed' },
  solar: { name: 'Solar Flare', blurb: 'Blazing white-hot noon', wash: ['#fff7ae', '#ffb703', '#fb8500'], ink: '#fffbe6' },
  ultraviolet: { name: 'Ultraviolet', blurb: 'Violet haze, electric edge', wash: ['#c084fc', '#7c3aed', '#0f0524'], ink: '#f3e8ff' },
};

export const PANEL_FILTERS = {
  none: { name: 'As shot', css: 'none' },
  warm: { name: 'Warm', css: 'sepia(0.35) saturate(1.45) brightness(1.02)' },
  cool: { name: 'Cool', css: 'saturate(1.15) hue-rotate(-18deg) brightness(1.06)' },
  mono: { name: 'Mono', css: 'grayscale(1) contrast(1.12) brightness(1.03)' },
  pop: { name: 'Pop', css: 'saturate(1.85) contrast(1.18)' },
};

export const SLOT_COUNT = 9;

// A tiny deterministic random stream so the grain looks the same on every
// export of the same cover instead of shimmering between sizes.
function stream(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rect(x, y, w, h, tilt = 0) {
  return { x, y, w, h, tilt };
}

// Cells live in the photo zone above the title band; the band always owns
// the bottom strip of the poster. `gap` is the white gutter between cells.
export function compositionCells(kind, w, h) {
  const top = 0;
  const bandTop = Math.round(h * 0.76);
  const zoneH = bandTop - top;
  const g = Math.max(6, Math.round(w * 0.006));
  const cells = [];
  const grid = (cols, rows, x0, y0, w0, h0) => {
    const cw = (w0 - g * (cols - 1)) / cols;
    const ch = (h0 - g * (rows - 1)) / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        cells.push(rect(x0 + c * (cw + g), y0 + r * (ch + g), cw, ch));
      }
    }
  };
  if (kind === 'grid9') {
    grid(3, 3, 0, top, w, zoneH);
  } else if (kind === 'heroNine') {
    const heroW = Math.round(w * 0.58);
    cells.push(rect(0, top, heroW, zoneH));
    grid(2, 4, heroW + g, top, w - heroW - g, zoneH);
  } else if (kind === 'mosaic') {
    const bigW = Math.round(w * 0.62);
    const bigH = Math.round(zoneH * 0.62);
    cells.push(rect(0, top, bigW, bigH));
    grid(2, 2, bigW + g, top, w - bigW - g, bigH);
    grid(4, 1, 0, top + bigH + g, w, zoneH - bigH - g);
  } else if (kind === 'strip4') {
    grid(4, 1, 0, top, w, zoneH);
  } else if (kind === 'quad') {
    grid(2, 2, 0, top, w, zoneH);
  } else if (kind === 'triptych') {
    grid(3, 1, 0, top, w, zoneH);
  } else if (kind === 'duo') {
    const leftW = Math.round(w * 0.56);
    cells.push(rect(0, top, leftW, zoneH));
    cells.push(rect(leftW + g, top, w - leftW - g, zoneH));
  } else if (kind === 'tilt') {
    // One big hero tipped a few degrees, three small snaps stacked at right.
    cells.push(rect(Math.round(w * 0.02), Math.round(zoneH * 0.04), Math.round(w * 0.6), Math.round(zoneH * 0.88), -0.07));
    grid(1, 3, Math.round(w * 0.68), top, w - Math.round(w * 0.68), zoneH);
  } else if (kind === 'heroThree') {
    const heroH = Math.round(zoneH * 0.6);
    cells.push(rect(0, top, w, heroH));
    grid(3, 1, 0, top + heroH + g, w, zoneH - heroH - g);
  } else {
    grid(3, 3, 0, top, w, zoneH);
  }
  return {
    cells,
    band: rect(0, bandTop, w, h - bandTop),
    gap: g,
  };
}

function drawPhotoInto(ctx, img, cell, panel) {
  const zoom = panel.zoom || 1;
  const ox = panel.ox || 0;
  const oy = panel.oy || 0;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = panel.cover === false
    ? Math.min(cell.w / iw, cell.h / ih)
    : Math.max(cell.w / iw, cell.h / ih);
  const dw = iw * scale * zoom;
  const dh = ih * scale * zoom;
  const dx = cell.x + (cell.w - dw) / 2 + ox * cell.w;
  const dy = cell.y + (cell.h - dh) / 2 + oy * cell.h;
  ctx.save();
  if (cell.tilt) {
    ctx.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
    ctx.rotate(cell.tilt);
    ctx.translate(-(cell.x + cell.w / 2), -(cell.y + cell.h / 2));
  }
  ctx.beginPath();
  ctx.rect(cell.x, cell.y, cell.w, cell.h);
  ctx.clip();
  const filter = PANEL_FILTERS[panel.filter || 'none'];
  if (filter && filter.css !== 'none') ctx.filter = filter.css;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

function drawEmptyCell(ctx, cell, tone, index) {
  const grad = ctx.createLinearGradient(cell.x, cell.y, cell.x + cell.w, cell.y + cell.h);
  grad.addColorStop(0, tone.wash[0]);
  grad.addColorStop(1, tone.wash[2]);
  ctx.save();
  if (cell.tilt) {
    ctx.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
    ctx.rotate(cell.tilt);
    ctx.translate(-(cell.x + cell.w / 2), -(cell.y + cell.h / 2));
  }
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.35 + (index % 3) * 0.12;
  ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(2, cell.w * 0.008);
  ctx.strokeRect(cell.x + 4, cell.y + 4, cell.w - 8, cell.h - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `700 ${Math.max(14, cell.w * 0.06)}px "Archivo Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+ PHOTO ${index + 1}`, cell.x + cell.w / 2, cell.y + cell.h / 2);
  ctx.restore();
}

function drawSunDisc(ctx, cx, cy, r, tone) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.9);
  glow.addColorStop(0, tone.wash[0]);
  glow.addColorStop(0.55, tone.wash[1]);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
  ctx.fill();
  const disc = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  disc.addColorStop(0, '#fff7cc');
  disc.addColorStop(0.5, tone.wash[0]);
  disc.addColorStop(1, tone.wash[1]);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Synthwave slats cut across the lower half of the sun.
  ctx.fillStyle = 'rgba(20,8,40,0.85)';
  for (let i = 0; i < 4; i += 1) {
    const y = cy + r * (0.08 + i * 0.2);
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    ctx.fillRect(cx - half, y, half * 2, r * 0.055);
  }
}

function drawSkylineRow(ctx, band, tone) {
  const base = band.y + band.h * 0.98;
  const rnd = stream(20261119);
  ctx.fillStyle = 'rgba(24,8,44,0.92)';
  let x = band.x;
  while (x < band.x + band.w) {
    const bw = band.w * (0.04 + rnd() * 0.05);
    const bh = band.h * (0.28 + rnd() * 0.5);
    ctx.fillRect(x, base - bh, bw, bh);
    if (rnd() > 0.6) {
      ctx.fillStyle = tone.wash[0];
      ctx.fillRect(x + bw * 0.3, base - bh - band.h * 0.08, bw * 0.12, band.h * 0.08);
      ctx.fillStyle = 'rgba(24,8,44,0.92)';
    }
    x += bw + band.w * 0.012;
  }
  ctx.fillRect(band.x, base - 2, band.w, 2);
}

function drawPalmTree(ctx, x, baseY, size, lean) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(lean);
  ctx.strokeStyle = 'rgba(20,6,36,0.95)';
  ctx.lineWidth = Math.max(3, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.55, size * 0.16, -size * 0.95);
  ctx.stroke();
  ctx.fillStyle = 'rgba(20,6,36,0.95)';
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI * (0.08 + i * 0.16);
    const len = size * (0.42 + (i % 2) * 0.1);
    ctx.save();
    ctx.translate(size * 0.16, -size * 0.95);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(len / 2, 0, len / 2, size * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawHalftoneDots(ctx, band, tone) {
  const rnd = stream(77);
  const step = Math.max(10, band.h * 0.09);
  ctx.fillStyle = tone.ink;
  for (let y = band.y + step; y < band.y + band.h * 0.55; y += step) {
    for (let x = band.x + step / 2; x < band.x + band.w; x += step) {
      const r = (step * 0.16) * (0.5 + rnd() * 0.8);
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawTitleBand(ctx, band, model, tone, w) {
  const bg = ctx.createLinearGradient(band.x, band.y, band.x, band.y + band.h);
  bg.addColorStop(0, tone.wash[1]);
  bg.addColorStop(0.55, tone.wash[0]);
  bg.addColorStop(1, '#1c0a38');
  ctx.fillStyle = bg;
  ctx.fillRect(band.x, band.y, band.w, band.h);

  const sunR = band.h * 0.42;
  drawSunDisc(ctx, band.x + band.w * 0.86, band.y + band.h * 0.46, sunR, tone);
  drawSkylineRow(ctx, band, tone);
  drawPalmTree(ctx, band.x + band.w * 0.07, band.y + band.h * 0.98, band.h * 0.72, -0.12);
  drawPalmTree(ctx, band.x + band.w * 0.94, band.y + band.h * 0.98, band.h * 0.6, 0.14);
  if (model.halftone !== false) drawHalftoneDots(ctx, band, tone);

  const lift = (model.captionLift ?? 0.55) * band.h;
  const cx = band.x + band.w * 0.5;
  const scale = model.captionScale || 1;
  const kickSize = Math.max(16, band.h * 0.12 * scale);
  const capSize = Math.max(30, band.h * 0.36 * scale);
  const scriptSize = Math.max(16, band.h * 0.16 * scale);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Kicker — small caps with flanking rules, clear of the caption below.
  ctx.font = `700 ${kickSize}px "Archivo Black", sans-serif`;
  ctx.fillStyle = tone.ink;
  const kickY = band.y + lift * 0.18;
  const kickText = (model.kicker || 'VICE CITY').toUpperCase();
  const kickW = ctx.measureText(kickText).width;
  ctx.fillText(kickText, cx, kickY);
  ctx.strokeStyle = tone.ink;
  ctx.lineWidth = Math.max(2, kickSize * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - kickW / 2 - band.w * 0.06, kickY);
  ctx.lineTo(cx - kickW / 2 - band.w * 0.015, kickY);
  ctx.moveTo(cx + kickW / 2 + band.w * 0.015, kickY);
  ctx.lineTo(cx + kickW / 2 + band.w * 0.06, kickY);
  ctx.stroke();

  // Caption — sunset-gradient Anton with a dark outline and drop shadow.
  const capY = band.y + lift * 0.92;
  ctx.font = `${capSize}px Anton, "Archivo Black", sans-serif`;
  const caption = (model.caption || 'SUNSET TILT').toUpperCase();
  ctx.save();
  ctx.shadowColor = 'rgba(20,4,40,0.75)';
  ctx.shadowBlur = capSize * 0.14;
  ctx.shadowOffsetY = capSize * 0.05;
  const grad = ctx.createLinearGradient(cx, capY - capSize * 0.5, cx, capY + capSize * 0.5);
  grad.addColorStop(0, '#fffbe6');
  grad.addColorStop(0.45, tone.wash[0]);
  grad.addColorStop(1, tone.wash[1]);
  ctx.fillStyle = grad;
  ctx.lineWidth = Math.max(3, capSize * 0.07);
  ctx.strokeStyle = 'rgba(26,6,46,0.9)';
  ctx.strokeText(caption, cx, capY);
  ctx.fillText(caption, cx, capY);
  ctx.restore();

  // Script sub-caption in Pacifico, tucked under the caption.
  if (model.subcaption) {
    ctx.font = `${scriptSize}px Pacifico, cursive`;
    ctx.fillStyle = tone.ink;
    ctx.fillText(model.subcaption, cx, band.y + lift * 1.32);
  }

  // Neon frame around the whole poster.
  if (model.frame !== false) {
    ctx.strokeStyle = tone.wash[0];
    ctx.lineWidth = Math.max(4, w * 0.004);
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(band.x + ctx.lineWidth, 2, w - ctx.lineWidth * 2, band.y + band.h - 4);
    ctx.globalAlpha = 1;
  }
}

function drawToneWash(ctx, w, h, tone) {
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, tone.wash[0]);
  wash.addColorStop(0.5, tone.wash[1]);
  wash.addColorStop(1, tone.wash[2]);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // Vignette: darken the corners so the panels read as one poster.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,2,26,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function drawGrainSpeckles(ctx, w, h, seed) {
  const rnd = stream(seed);
  const count = Math.round((w * h) / 2600);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < count; i += 1) {
    const s = 1 + rnd() * 2;
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
  ctx.restore();
}

// The one call main.js and the export path use. `preview` keeps the
// on-screen canvas at its working size; exports pass the target size.
export function renderPoster(ctx, w, h, model) {
  const tone = TONES[model.grade] || TONES.sunset;
  const kind = COMPOSITIONS[model.layout] ? model.layout : 'grid9';
  const { cells, band, gap } = compositionCells(kind, w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#160a2e';
  ctx.fillRect(0, 0, w, h);
  cells.forEach((cell, i) => {
    const panel = (model.panels && model.panels[i]) || {};
    if (panel.image) drawPhotoInto(ctx, panel.image, cell, panel);
    else drawEmptyCell(ctx, cell, tone, i);
  });
  // White gutters: redraw cell outlines so tilted cells stay crisp.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = gap;
  cells.forEach((cell) => {
    ctx.save();
    if (cell.tilt) {
      ctx.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
      ctx.rotate(cell.tilt);
      ctx.translate(-(cell.x + cell.w / 2), -(cell.y + cell.h / 2));
    }
    ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
    ctx.restore();
  });
  ctx.restore();
  drawTitleBand(ctx, band, model, tone, w);
  drawToneWash(ctx, w, h, tone);
  drawGrainSpeckles(ctx, w, h, 90210);
}
