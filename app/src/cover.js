// Neon Coast Cover Studio — the cover renderer.
// Draws a multi-panel GTA-style poster onto any 2D canvas: photos in panels,
// a Vice City sunset/neon grade per panel, code-drawn sun / skyline / palm
// silhouettes, halftone + grain, and bold display lettering. No Rockstar art,
// no Rockstar font: Anton + Pacifico are OFL files under app/fonts/.

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape · 1920 × 1080' },
};

export const LAYOUTS = {
  poster: { name: 'Poster', hint: 'Hero + three panels' },
  strip: { name: 'Strip', hint: 'Three tall panels' },
  grid: { name: 'Grid', hint: 'Four panels, 2 × 2' },
};

export const GRADES = {
  sunset: { name: 'Sunset', hint: 'Magenta → orange' },
  neon: { name: 'Neon Night', hint: 'Cyan → magenta' },
  pastel: { name: 'Pastel Vice', hint: 'Soft pink + lilac' },
  noir: { name: 'Noir', hint: 'High-contrast mono' },
};

const GRADE_TOP = {
  sunset: 'rgba(255, 0, 110, 0.20)',
  neon: 'rgba(0, 229, 255, 0.22)',
  pastel: 'rgba(255, 150, 220, 0.20)',
  noir: 'rgba(120, 120, 140, 0.10)',
};
const GRADE_BOTTOM = {
  sunset: 'rgba(255, 150, 40, 0.26)',
  neon: 'rgba(255, 0, 170, 0.26)',
  pastel: 'rgba(190, 150, 255, 0.22)',
  noir: 'rgba(0, 0, 0, 0.22)',
};
const GRADE_VIGNETTE = { sunset: 0.34, neon: 0.38, pastel: 0.20, noir: 0.55 };

// Seeded random so every render of the same state is byte-identical.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Panel rectangles and the caption band for a layout, in canvas pixels. */
export function layoutGeometry(layout, w, h) {
  const m = Math.round(w * 0.02);
  const g = Math.round(w * 0.014);
  if (layout === 'strip') {
    const pw = Math.round((w - 2 * m - 2 * g) / 3);
    const panels = [0, 1, 2].map((i) => ({
      x: m + i * (pw + g), y: m, w: pw, h: h - 2 * m,
    }));
    return { panels, band: { x: 0, y: Math.round(h * 0.78), w, h: Math.round(h * 0.22) }, overlay: true };
  }
  if (layout === 'grid') {
    const pw = Math.round((w - 2 * m - g) / 2);
    const ph = Math.round((h * 0.76 - 2 * m - g) / 2);
    const panels = [
      { x: m, y: m, w: pw, h: ph },
      { x: m + pw + g, y: m, w: pw, h: ph },
      { x: m, y: m + ph + g, w: pw, h: ph },
      { x: m + pw + g, y: m + ph + g, w: pw, h: ph },
    ];
    return { panels, band: { x: 0, y: Math.round(h * 0.78), w, h: Math.round(h * 0.22) }, overlay: false };
  }
  // poster: hero on top, caption band, three small panels at the foot.
  const heroH = Math.round(h * 0.52);
  const bandH = Math.round(h * 0.17);
  const bandY = m + heroH + g;
  const pw = Math.round((w - 2 * m - 2 * g) / 3);
  const smallY = bandY + bandH + g;
  const panels = [
    { x: m, y: m, w: w - 2 * m, h: heroH },
    { x: m, y: smallY, w: pw, h: h - smallY - m },
    { x: m + pw + g, y: smallY, w: pw, h: h - smallY - m },
    { x: m + 2 * (pw + g), y: smallY, w: pw, h: h - smallY - m },
  ];
  return { panels, band: { x: 0, y: bandY, w, h: bandH }, overlay: false };
}

function drawPhotoInto(ctx, img, rect, panel) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const zoom = panel.zoom || 1;
  let scale;
  if (panel.fit === 'fit') scale = Math.min(rect.w / iw, rect.h / ih) * zoom;
  else scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const pw = iw * scale;
  const ph = ih * scale;
  const cx = rect.x + rect.w / 2 + (panel.ox || 0) * rect.w;
  const cy = rect.y + rect.h / 2 + (panel.oy || 0) * rect.h;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
}

function gradePanel(ctx, rect, grade) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grad.addColorStop(0, GRADE_TOP[grade] || GRADE_TOP.sunset);
  grad.addColorStop(1, GRADE_BOTTOM[grade] || GRADE_BOTTOM.sunset);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  // Warm wash for sunset, cool wash for neon.
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade === 'neon' ? 'rgba(40, 0, 90, 0.55)' : 'rgba(255, 120, 40, 0.30)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function vignette(ctx, rect, strength) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = Math.hypot(rect.w, rect.h) / 2;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, `rgba(10, 2, 24, ${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function drawEmptyPanel(ctx, rect) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grad.addColorStop(0, '#3b1d5e');
  grad.addColorStop(1, '#1c0b33');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 10, rect.y + 10, rect.w - 20, rect.h - 20);
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `${Math.max(14, Math.round(rect.w * 0.045))}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
}

// A synthwave sun: gradient disc with horizontal slats cut out of its lower half.
function drawSun(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  grad.addColorStop(0, '#ffe259');
  grad.addColorStop(0.55, '#ff7e5f');
  grad.addColorStop(1, '#ff2e88');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = '#160a2e';
  let y = cy + r * 0.05;
  let th = r * 0.045;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, th);
    y += th + r * 0.13;
    th *= 1.5;
  }
  ctx.restore();
}

// A black skyline silhouette across the bottom of a band.
function drawSkyline(ctx, band) {
  const rng = mulberry32(20261119);
  ctx.fillStyle = '#12081f';
  let x = band.x;
  const base = band.y + band.h;
  while (x < band.x + band.w) {
    const bw = band.w * (0.03 + rng() * 0.05);
    const bh = band.h * (0.35 + rng() * 0.55);
    ctx.fillRect(x, base - bh, bw, bh);
    if (rng() > 0.6) ctx.fillRect(x + bw * 0.35, base - bh - band.h * 0.12, bw * 0.08, band.h * 0.12);
    x += bw + band.w * 0.008;
  }
}

// A palm silhouette: curved trunk, six drooping fronds.
function drawPalm(ctx, x, baseY, s, lean) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(lean, 1);
  ctx.strokeStyle = '#12081f';
  ctx.fillStyle = '#12081f';
  ctx.lineWidth = Math.max(3, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.08, -s * 0.55, s * 0.02, -s);
  ctx.stroke();
  const topX = s * 0.02;
  const topY = -s;
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI * (0.08 + i * 0.17);
    const ex = topX + Math.cos(a) * s * 0.62;
    const ey = topY + Math.sin(a) * s * 0.42 + s * 0.22;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * s * 0.35, topY + Math.sin(a) * s * 0.3 - s * 0.12, ex, ey);
    ctx.quadraticCurveTo(topX + Math.cos(a) * s * 0.3, topY + Math.sin(a) * s * 0.34, topX, topY);
    ctx.fill();
  }
  ctx.restore();
}

function drawHalftone(ctx, band) {
  const rng = mulberry32(77);
  const step = Math.max(9, band.h * 0.11);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  for (let y = band.y + step * 0.5; y < band.y + band.h * 0.45; y += step) {
    for (let x = band.x + step * 0.5; x < band.x + band.w; x += step) {
      const r = step * 0.16 * (0.6 + rng() * 0.8);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCaptionBand(ctx, band, state, w) {
  const { caption, subcaption, captionSize, captionY } = state;
  // Sunset band gradient.
  const grad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  grad.addColorStop(0, '#2a1150');
  grad.addColorStop(0.45, '#c81d6b');
  grad.addColorStop(1, '#ff7e2e');
  ctx.fillStyle = grad;
  ctx.fillRect(band.x, band.y, band.w, band.h);
  drawHalftone(ctx, band);
  // Decorations stay inside the band: clip so the sun never bleeds onto panels.
  ctx.save();
  ctx.beginPath();
  ctx.rect(band.x, band.y, band.w, band.h);
  ctx.clip();
  const sunR = band.h * 0.92;
  drawSun(ctx, band.x + band.w * 0.82, band.y + band.h * 0.62, sunR);
  drawSkyline(ctx, band);
  drawPalm(ctx, band.x + band.w * 0.045, band.y + band.h, band.h * 0.95, 1);
  drawPalm(ctx, band.x + band.w * 0.955, band.y + band.h, band.h * 0.8, -1);
  ctx.restore();

  const text = (caption || '').trim().toUpperCase();
  if (!text) return;
  let size = band.h * 0.48 * (captionSize || 1);
  ctx.font = `${size}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
  while (ctx.measureText(text).width > band.w * 0.86 && size > 12) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  const cx = band.x + band.w / 2;
  const subSize = Math.max(14, band.h * 0.2);
  // Keep the whole caption block (display line + script line) inside the band.
  let cy = band.y + band.h * (0.18 + 0.62 * (captionY ?? 0.55));
  cy = Math.min(cy, band.y + band.h - subSize * 1.1 - size * 0.62);
  cy = Math.max(cy, band.y + size * 0.55);
  const fill = ctx.createLinearGradient(0, cy - size, 0, cy + size * 0.25);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.55, '#ffe259');
  fill.addColorStop(1, '#ff7e2e');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Drop shadow, then outline, then gradient fill.
  ctx.save();
  ctx.fillStyle = 'rgba(10, 2, 24, 0.6)';
  ctx.fillText(text, cx + size * 0.045, cy + size * 0.06);
  ctx.restore();
  ctx.strokeStyle = '#160a2e';
  ctx.lineWidth = Math.max(3, size * 0.085);
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, cy);
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }

  const sub = (subcaption || '').trim();
  if (sub) {
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 46, 136, 0.9)';
    ctx.shadowBlur = subSize * 0.35;
    ctx.fillText(sub, cx, cy + size * 0.62 + subSize * 0.4);
    ctx.shadowBlur = 0;
  }
}

function drawGrain(ctx, w, h, seed) {
  const rng = mulberry32(seed);
  const count = Math.round((w * h) / 260);
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const v = rng();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rng() * w, rng() * h, 1.4, 1.4);
  }
  ctx.restore();
}

/**
 * Draws the whole cover. `state` holds layout, grade, caption, subcaption,
 * captionSize, captionY and panels (each { image, zoom, ox, oy, fit }).
 * `preview` adds a selection outline around the selected panel (editor only,
 * never in an export).
 */
export function drawCover(ctx, w, h, state, preview) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1b1035');
  bg.addColorStop(0.5, '#5b1a63');
  bg.addColorStop(1, '#ff7e2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const { panels, band, overlay } = layoutGeometry(state.layout || 'poster', w, h);
  const grade = state.grade || 'sunset';

  panels.forEach((rect, i) => {
    const panel = (state.panels || [])[i] || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (panel.image) {
      if (grade === 'noir') ctx.filter = 'grayscale(1) contrast(1.18) brightness(1.02)';
      drawPhotoInto(ctx, panel.image, rect, panel);
      ctx.filter = 'none';
      gradePanel(ctx, rect, grade);
    } else {
      drawEmptyPanel(ctx, rect);
    }
    vignette(ctx, rect, GRADE_VIGNETTE[grade] ?? 0.34);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  });

  if (overlay) {
    // Strip layout: a scrim fades the panels into the caption band.
    const scrim = ctx.createLinearGradient(0, band.y - band.h * 0.35, 0, band.y + band.h);
    scrim.addColorStop(0, 'rgba(22, 10, 46, 0)');
    scrim.addColorStop(1, 'rgba(22, 10, 46, 0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(band.x, band.y - band.h * 0.35, band.w, band.h * 1.35);
  }
  drawCaptionBand(ctx, band, state, w);

  drawGrain(ctx, w, h, 4242);
  vignette(ctx, { x: 0, y: 0, w, h }, 0.22);

  if (preview) {
    const sel = panels[state.selected || 0];
    if (sel) {
      ctx.save();
      ctx.strokeStyle = '#ffe259';
      ctx.lineWidth = Math.max(3, w * 0.004);
      ctx.setLineDash([14, 8]);
      ctx.strokeRect(sel.x - 3, sel.y - 3, sel.w + 6, sel.h + 6);
      ctx.restore();
    }
  }
}
