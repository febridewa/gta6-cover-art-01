// Vice Grid Cover Studio — the cover renderer (round 2).
//
// Draws a multi-panel Vice City poster onto any 2D canvas: up to nine photo
// panels, an eight-grade sunset/neon colour treatment, code-drawn sun,
// skyline and palm silhouettes, a halftone title block and bold display
// lettering. Everything is original art drawn by this file — no Rockstar
// logo, artwork, character or font. The fonts (Anton, Archivo Black,
// Pacifico) are OFL files shipped under app/fonts/.

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape · 1920 × 1080' },
};

export const LAYOUTS = {
  nine: { name: 'Nine Grid', hint: '3 × 3, nine panels', panels: 9 },
  poster: { name: 'Poster Nine', hint: 'Hero + eight panels', panels: 9 },
  mosaic: { name: 'Mosaic', hint: 'One big + six small', panels: 7 },
  strip: { name: 'Strip Four', hint: 'Four tall panels', panels: 4 },
  quad: { name: 'Quad', hint: 'Four panels, 2 × 2', panels: 4 },
  triptych: { name: 'Triptych', hint: 'Wide centre, two sides', panels: 3 },
  duo: { name: 'Duo', hint: 'Two big panels', panels: 2 },
};

export const GRADES = {
  sunset: {
    name: 'Sunset', hint: 'Magenta → orange',
    top: 'rgba(255, 0, 110, 0.20)', bottom: 'rgba(255, 150, 40, 0.26)',
    wash: 'rgba(255, 120, 40, 0.30)', filter: 'saturate(1.2)',
    vignette: 0.34, band: ['#2a1150', '#c81d6b', '#ff7e2e'], accent: '#ffe259',
  },
  neon: {
    name: 'Neon Night', hint: 'Cyan → magenta',
    top: 'rgba(0, 229, 255, 0.22)', bottom: 'rgba(255, 0, 170, 0.26)',
    wash: 'rgba(40, 0, 90, 0.55)', filter: 'saturate(1.35) contrast(1.05)',
    vignette: 0.38, band: ['#0b1035', '#7a1fa2', '#ff2e88'], accent: '#00e5ff',
  },
  pastel: {
    name: 'Pastel Vice', hint: 'Soft pink + lilac',
    top: 'rgba(255, 150, 220, 0.20)', bottom: 'rgba(190, 150, 255, 0.22)',
    wash: 'rgba(255, 170, 220, 0.25)', filter: 'saturate(0.85) brightness(1.06)',
    vignette: 0.20, band: ['#4a2d72', '#c86dd7', '#ffb3d9'], accent: '#ffffff',
  },
  noir: {
    name: 'Noir', hint: 'High-contrast mono',
    top: 'rgba(120, 120, 140, 0.10)', bottom: 'rgba(0, 0, 0, 0.22)',
    wash: 'rgba(0, 0, 0, 0.25)', filter: 'grayscale(1) contrast(1.18) brightness(1.02)',
    vignette: 0.55, band: ['#101018', '#3a3a48', '#8a8a9a'], accent: '#f5f5f5',
  },
  golden: {
    name: 'Golden Hour', hint: 'Warm amber dusk',
    top: 'rgba(255, 170, 0, 0.18)', bottom: 'rgba(255, 90, 0, 0.28)',
    wash: 'rgba(255, 160, 30, 0.32)', filter: 'saturate(1.3) sepia(0.25)',
    vignette: 0.30, band: ['#3d1c05', '#a34a12', '#ffb347'], accent: '#fff3b0',
  },
  magenta: {
    name: 'Magenta Dusk', hint: 'Deep pink twilight',
    top: 'rgba(255, 0, 140, 0.24)', bottom: 'rgba(120, 0, 120, 0.28)',
    wash: 'rgba(180, 0, 120, 0.35)', filter: 'saturate(1.3) hue-rotate(-15deg)',
    vignette: 0.36, band: ['#2e0a3d', '#8e1a6b', '#ff4da6'], accent: '#ff8fd1',
  },
  chrome: {
    name: 'Cyan Chrome', hint: 'Cool blue chrome',
    top: 'rgba(0, 200, 255, 0.22)', bottom: 'rgba(0, 80, 200, 0.26)',
    wash: 'rgba(0, 90, 160, 0.35)', filter: 'saturate(0.8) brightness(1.08) contrast(1.05)',
    vignette: 0.32, band: ['#04122e', '#0e4d8f', '#29b6f6'], accent: '#b3e5fc',
  },
  duotone: {
    name: 'Duotone', hint: 'Teal + orange print',
    top: 'rgba(0, 180, 180, 0.18)', bottom: 'rgba(255, 110, 20, 0.24)',
    wash: 'rgba(255, 120, 40, 0.28)', filter: 'saturate(0.4) contrast(1.15) brightness(1.05)',
    vignette: 0.40, band: ['#062a2e', '#0f6f6a', '#ff8c42'], accent: '#ffe259',
  },
};

export const MAX_PANELS = 9;

// Deterministic pseudo-random stream so identical state renders identically.
function seededStream(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Panel rectangles plus the caption band for a layout, in canvas pixels.
 * `overlay` layouts paint the band on top of the bottom panels behind a
 * scrim; the rest reserve a band strip below the panels.
 */
export function layoutGeometry(layout, w, h) {
  const m = Math.max(8, Math.round(w * 0.018));
  const g = Math.max(6, Math.round(w * 0.012));
  const innerW = w - 2 * m;
  const bandH = Math.round(h * 0.2);
  const lowerBand = { x: 0, y: h - bandH, w, h: bandH };

  if (layout === 'nine') {
    const pw = Math.round((innerW - 2 * g) / 3);
    const ph = Math.round((h - 2 * m - 2 * g) / 3);
    const panels = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        panels.push({ x: m + c * (pw + g), y: m + r * (ph + g), w: pw, h: ph });
      }
    }
    return { panels, band: { x: 0, y: Math.round(h * 0.76), w, h: Math.round(h * 0.24) }, overlay: true };
  }

  if (layout === 'poster') {
    const heroH = Math.round(h * 0.46);
    const band = { x: 0, y: m + heroH + g, w, h: Math.round(h * 0.15) };
    const top = band.y + band.h + g;
    const pw = Math.round((innerW - 3 * g) / 4);
    const ph = Math.round((h - top - m - g) / 2);
    const panels = [{ x: m, y: m, w: innerW, h: heroH }];
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        panels.push({ x: m + c * (pw + g), y: top + r * (ph + g), w: pw, h: ph });
      }
    }
    return { panels, band, overlay: false };
  }

  if (layout === 'mosaic') {
    const areaH = lowerBand.y - m;
    const bigW = Math.round((innerW - g) * 0.56);
    const rightX = m + bigW + g;
    const rightW = w - m - rightX;
    const sw = Math.round((rightW - g) / 2);
    const sh = Math.round((areaH - 2 * g) / 3);
    const panels = [{ x: m, y: m, w: bigW, h: areaH }];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 2; c += 1) {
        panels.push({ x: rightX + c * (sw + g), y: m + r * (sh + g), w: sw, h: sh });
      }
    }
    return { panels, band: lowerBand, overlay: false };
  }

  if (layout === 'strip') {
    const pw = Math.round((innerW - 3 * g) / 4);
    const panels = [0, 1, 2, 3].map((i) => ({
      x: m + i * (pw + g), y: m, w: pw, h: h - 2 * m,
    }));
    return { panels, band: { x: 0, y: Math.round(h * 0.76), w, h: Math.round(h * 0.24) }, overlay: true };
  }

  if (layout === 'duo') {
    const areaH = lowerBand.y - m;
    const pw = Math.round((innerW - g) / 2);
    const panels = [
      { x: m, y: m, w: pw, h: areaH },
      { x: m + pw + g, y: m, w: pw, h: areaH },
    ];
    return { panels, band: lowerBand, overlay: false };
  }

  if (layout === 'triptych') {
    const areaH = lowerBand.y - m;
    const sideW = Math.round((innerW - 2 * g) * 0.26);
    const centreW = innerW - 2 * g - 2 * sideW;
    const panels = [
      { x: m, y: m, w: sideW, h: areaH },
      { x: m + sideW + g, y: m, w: centreW, h: areaH },
      { x: m + sideW + g + centreW + g, y: m, w: sideW, h: areaH },
    ];
    return { panels, band: lowerBand, overlay: false };
  }

  // quad: 2 x 2 above the band.
  const areaH = lowerBand.y - m;
  const pw = Math.round((innerW - g) / 2);
  const ph = Math.round((areaH - g) / 2);
  return {
    panels: [
      { x: m, y: m, w: pw, h: ph },
      { x: m + pw + g, y: m, w: pw, h: ph },
      { x: m, y: m + ph + g, w: pw, h: ph },
      { x: m + pw + g, y: m + ph + g, w: pw, h: ph },
    ],
    band: lowerBand,
    overlay: false,
  };
}

function paintPhoto(ctx, img, rect, panel) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const zoom = panel.zoom || 1;
  const scale = panel.fit === 'fit'
    ? Math.min(rect.w / iw, rect.h / ih) * zoom
    : Math.max(rect.w / iw, rect.h / ih) * zoom;
  const pw = iw * scale;
  const ph = ih * scale;
  // Clamp the pan so the photo always covers the panel: no bare background
  // can show at an edge, whatever the zoom or the nudge.
  const maxOx = Math.max(0, (pw - rect.w) / 2);
  const maxOy = Math.max(0, (ph - rect.h) / 2);
  const oxPx = Math.max(-maxOx, Math.min(maxOx, (panel.ox || 0) * rect.w));
  const oyPx = Math.max(-maxOy, Math.min(maxOy, (panel.oy || 0) * rect.h));
  const cx = rect.x + rect.w / 2 + oxPx;
  const cy = rect.y + rect.h / 2 + oyPx;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
}

function gradeOverlay(ctx, rect, grade) {
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(1, grade.bottom);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function shadeEdges(ctx, rect, strength) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = Math.hypot(rect.w, rect.h) / 2;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, `rgba(10, 2, 24, ${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function paintEmptyPanel(ctx, rect) {
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

// A synthwave sun: gradient disc with horizontal slats cut from its lower half.
function paintSun(ctx, cx, cy, r) {
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
function paintSkyline(ctx, band) {
  const rng = seededStream(20261119);
  ctx.fillStyle = '#12081f';
  let x = band.x;
  const base = band.y + band.h;
  while (x < band.x + band.w) {
    const bw = band.w * (0.03 + rng() * 0.05);
    // Keep the skyline low — a base the lettering stands above, not a wall
    // that swallows it.
    const bh = band.h * (0.22 + rng() * 0.30);
    ctx.fillRect(x, base - bh, bw, bh);
    if (rng() > 0.6) {
      ctx.fillRect(x + bw * 0.35, base - bh - band.h * 0.10, bw * 0.08, band.h * 0.10);
    }
    x += bw + band.w * 0.008;
  }
}

// A palm silhouette: curved trunk, six drooping fronds.
function paintPalm(ctx, x, baseY, s, lean) {
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

// Rows of halftone dots across the top of the title band.
function paintHalftone(ctx, band) {
  const rng = seededStream(77);
  const step = Math.max(9, band.h * 0.11);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  for (let y = band.y + step * 0.5; y < band.y + band.h * 0.38; y += step) {
    for (let x = band.x + step * 0.5; x < band.x + band.w; x += step) {
      const r = step * 0.16 * (0.6 + rng() * 0.8);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintTitleBand(ctx, band, state, grade) {
  const grad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  grad.addColorStop(0, grade.band[0]);
  grad.addColorStop(0.45, grade.band[1]);
  grad.addColorStop(1, grade.band[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(band.x, band.y, band.w, band.h);
  // Neon rule along the top edge of the band.
  ctx.fillStyle = grade.accent;
  ctx.fillRect(band.x, band.y, band.w, Math.max(3, band.h * 0.03));

  if (state.halftone !== false) paintHalftone(ctx, band);
  ctx.save();
  ctx.beginPath();
  ctx.rect(band.x, band.y, band.w, band.h);
  ctx.clip();
  const sunR = band.h * 0.8;
  paintSun(ctx, band.x + band.w * 0.84, band.y + band.h * 0.58, sunR);
  paintSkyline(ctx, band);
  paintPalm(ctx, band.x + band.w * 0.045, band.y + band.h, band.h * 0.95, 1);
  paintPalm(ctx, band.x + band.w * 0.955, band.y + band.h, band.h * 0.8, -1);
  ctx.restore();

  const text = (state.caption || '').trim().toUpperCase();
  const kicker = (state.kicker || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim();
  const cx = band.x + band.w / 2;
  const subSize = Math.max(13, band.h * 0.17);
  const kickSize = Math.max(11, band.h * 0.11);

  // The caption block (kicker + display line + script line) sits in the top
  // 82% of the band, above the skyline; captionY slides it within that zone.
  let size = band.h * 0.48 * (state.captionSize || 1);
  ctx.font = `${size}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
  if (text) {
    while (ctx.measureText(text).width > band.w * 0.84 && size > 12) {
      size -= 2;
      ctx.font = `${size}px Anton, sans-serif`;
    }
  }
  // A lone caption with no kicker or script line gets room to grow.
  if (text && !kicker && !sub) {
    size = Math.min(size * 1.3, band.h * 0.62);
    ctx.font = `${size}px Anton, sans-serif`;
    while (ctx.measureText(text).width > band.w * 0.84 && size > 12) {
      size -= 2;
      ctx.font = `${size}px Anton, sans-serif`;
    }
  }
  const blockH = (kicker ? kickSize * 1.35 : 0) + size + (sub ? subSize * 1.45 : 0);
  const zoneH = band.h * 0.82;
  let top = band.y + band.h * 0.08 + (zoneH - blockH) / 2
    + (band.h * 0.28 * ((state.captionY ?? 0.55) - 0.5));
  top = Math.max(band.y + band.h * 0.05, Math.min(top, band.y + band.h * 0.97 - blockH));
  let cy = top + (kicker ? kickSize * 1.35 : 0) + size * 0.5;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (kicker) {
    ctx.font = `${kickSize}px "Archivo Black", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(kickSize * 0.32)}px`; } catch { /* ignore */ }
    ctx.fillStyle = grade.accent;
    ctx.fillText(kicker, cx, top + kickSize * 0.67);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }

  if (text) {
    const fill = ctx.createLinearGradient(0, cy - size, 0, cy + size * 0.25);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.55, '#ffe259');
    fill.addColorStop(1, '#ff7e2e');
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
  }

  if (sub) {
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 46, 136, 0.9)';
    ctx.shadowBlur = subSize * 0.35;
    ctx.fillText(sub, cx, cy + size * 0.5 + subSize * 0.72);
    ctx.shadowBlur = 0;
  }
}

function paintGrain(ctx, w, h, seed) {
  const rng = seededStream(seed);
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
 * Draws the whole cover. `state` holds layout, grade, kicker, caption,
 * subcaption, captionSize, captionY, halftone, frame and panels
 * (each { image, zoom, ox, oy, fit }). `preview` adds a selection outline
 * around the selected panel (editor only, never in an export).
 */
export function drawCover(ctx, w, h, state, preview) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1b1035');
  bg.addColorStop(0.5, '#5b1a63');
  bg.addColorStop(1, '#ff7e2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const { panels, band, overlay } = layoutGeometry(state.layout || 'nine', w, h);

  panels.forEach((rect, i) => {
    const panel = (state.panels || [])[i] || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (panel.image) {
      ctx.filter = grade.filter || 'none';
      paintPhoto(ctx, panel.image, rect, panel);
      ctx.filter = 'none';
      gradeOverlay(ctx, rect, grade);
    } else {
      paintEmptyPanel(ctx, rect);
    }
    shadeEdges(ctx, rect, grade.vignette);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  });

  if (overlay) {
    // The band sits on top of the bottom panels: fade them into it.
    const scrim = ctx.createLinearGradient(0, band.y - band.h * 0.35, 0, band.y + band.h);
    scrim.addColorStop(0, 'rgba(22, 10, 46, 0)');
    scrim.addColorStop(1, 'rgba(22, 10, 46, 0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(band.x, band.y - band.h * 0.35, band.w, band.h * 1.35);
  }
  paintTitleBand(ctx, band, state, grade);

  paintGrain(ctx, w, h, 4242);
  shadeEdges(ctx, { x: 0, y: 0, w, h }, 0.22);

  if (state.frame !== false) {
    ctx.save();
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(4, w * 0.004);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.0015);
    const inset = Math.max(10, w * 0.009);
    ctx.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset);
    ctx.restore();
  }

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
