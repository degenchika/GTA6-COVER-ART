// Vice Cover Studio — the cover renderer, rewritten for round 3.
//
// Renders a multi-panel GTA-poster-style cover on any 2D canvas: one photo
// per panel with its own crop, a colour grade, and a big display caption
// with a heavy outline. Every coordinate is derived from the canvas's own
// size, so the preview and every export size share one code path. No
// Rockstar art, logo or font anywhere: the lettering is Bebas Neue /
// Archivo Black (OFL, bundled under app/fonts/) and the grades are our own
// gradients.
//
// Layouts: Hero, Duo, Trio, Quad, Strip and Column. Grades: Vice Sunset,
// Neon Nights, Palm Dusk, Mono Noir, Golden Hour and Midnight Drive.

export const LAYOUTS = {
  hero: { panels: 1, name: 'Hero' },
  duo: { panels: 2, name: 'Duo' },
  trio: { panels: 3, name: 'Trio' },
  quad: { panels: 4, name: 'Quad' },
  strip: { panels: 3, name: 'Strip' },
  column: { panels: 3, name: 'Column' },
};

export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    stops: [[0, 'rgba(255,150,60,0)'], [0.55, 'rgba(255,110,70,0.18)'], [1, 'rgba(214,40,130,0.55)']],
    wash: 'rgba(255,120,40,0.10)',
    bar: ['#ff2e88', '#ff7a18', '#22d3ee'],
  },
  neon: {
    name: 'Neon Nights',
    stops: [[0, 'rgba(255,0,170,0.42)'], [0.5, 'rgba(120,40,220,0.18)'], [1, 'rgba(0,210,255,0.42)']],
    wash: 'rgba(160,0,200,0.10)',
    bar: ['#ff00aa', '#7b2ff7', '#00d2ff'],
  },
  dusk: {
    name: 'Palm Dusk',
    stops: [[0, 'rgba(0,190,170,0.30)'], [0.55, 'rgba(40,90,180,0.16)'], [1, 'rgba(110,40,170,0.50)']],
    wash: 'rgba(20,120,160,0.10)',
    bar: ['#2ee6c8', '#6a5cff', '#ff2e88'],
  },
  noir: {
    name: 'Mono Noir',
    stops: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.28)']],
    wash: 'rgba(0,0,0,0.12)',
    gray: true,
    bar: ['#ffffff', '#9a92ad', '#55506a'],
  },
  gold: {
    name: 'Golden Hour',
    stops: [[0, 'rgba(255,214,100,0)'], [0.5, 'rgba(255,170,40,0.16)'], [1, 'rgba(180,90,0,0.50)']],
    wash: 'rgba(255,190,60,0.10)',
    bar: ['#ffd664', '#ffaa28', '#ff7a18'],
  },
  midnight: {
    name: 'Midnight Drive',
    stops: [[0, 'rgba(0,140,255,0.32)'], [0.5, 'rgba(60,60,200,0.18)'], [1, 'rgba(8,0,48,0.55)']],
    wash: 'rgba(0,90,220,0.10)',
    bar: ['#00c2ff', '#4d7cfe', '#b45cff'],
  },
};

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Gutter between panels, in canvas pixels: thin, but never invisible. */
function gutter(w, h) {
  return Math.max(3, Math.round(Math.min(w, h) * 0.008));
}

/** The panel rectangles for a layout, in canvas pixels. */
export function layoutRects(layout, w, h) {
  const g = gutter(w, h);
  const half = (n) => n / 2 - g / 2;
  switch (layout) {
    case 'duo':
      return [
        { x: 0, y: 0, w: half(w), h },
        { x: w / 2 + g / 2, y: 0, w: half(w), h },
      ];
    case 'trio':
      return [
        { x: 0, y: 0, w: w * 0.62 - g / 2, h },
        { x: w * 0.62 + g / 2, y: 0, w: w * 0.38 - g / 2, h: half(h) },
        { x: w * 0.62 + g / 2, y: h / 2 + g / 2, w: w * 0.38 - g / 2, h: half(h) },
      ];
    case 'quad':
      return [
        { x: 0, y: 0, w: half(w), h: half(h) },
        { x: w / 2 + g / 2, y: 0, w: half(w), h: half(h) },
        { x: 0, y: h / 2 + g / 2, w: half(w), h: half(h) },
        { x: w / 2 + g / 2, y: h / 2 + g / 2, w: half(w), h: half(h) },
      ];
    case 'strip': {
      // A wide strip across the top, two panels side by side below it.
      const topH = h * 0.55 - g / 2;
      const botH = h * 0.45 - g / 2;
      return [
        { x: 0, y: 0, w, h: topH },
        { x: 0, y: topH + g, w: half(w), h: botH },
        { x: w / 2 + g / 2, y: topH + g, w: half(w), h: botH },
      ];
    }
    case 'column': {
      // Three equal vertical columns, for tall portraits side by side.
      const cw = (w - 2 * g) / 3;
      return [
        { x: 0, y: 0, w: cw, h },
        { x: cw + g, y: 0, w: cw, h },
        { x: 2 * (cw + g), y: 0, w: cw, h },
      ];
    }
    default: // hero
      return [{ x: 0, y: 0, w, h }];
  }
}

/** Cover-fit scale for a photo inside a panel rectangle. */
function coverScale(imgW, imgH, rectW, rectH, zoom) {
  return Math.max(rectW / imgW, rectH / imgH) * (zoom || 1);
}

/** One panel: the photo (cover-fit, panned, zoomed), the grade, a vignette. */
function paintPanel(ctx, r, slot, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  if (slot && slot.img) {
    const iw = slot.img.naturalWidth;
    const ih = slot.img.naturalHeight;
    const scale = coverScale(iw, ih, r.w, r.h, slot.zoom);
    const dw = iw * scale;
    const dh = ih * scale;
    // Pan is clamped so the photo can never slide out of its panel.
    const ox = clamp(slot.ox || 0, -Math.max(0, (dw - r.w) / 2), Math.max(0, (dw - r.w) / 2));
    const oy = clamp(slot.oy || 0, -Math.max(0, (dh - r.h) / 2), Math.max(0, (dh - r.h) / 2));
    if (grade.gray) ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.02)';
    ctx.drawImage(slot.img, r.x + (r.w - dw) / 2 + ox, r.y + (r.h - dh) / 2 + oy, dw, dh);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#241a30';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `${Math.round(Math.min(r.w, r.h) * 0.07)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', r.x + r.w / 2, r.y + r.h / 2);
  }
  // Colour grade: a tinted gradient in overlay, then a soft wash.
  const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  for (const [stop, color] of grade.stops) grad.addColorStop(stop, color);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grad;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Vignette so the panels read as one poster.
  const vg = ctx.createRadialGradient(
    r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.35,
    r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  // Thin white poster border around the panel.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(r.w, r.h) * 0.004));
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.restore();
}

/** The big caption: scrim, fitted display type with a heavy outline, grade bar. */
function paintTitle(ctx, state, w, h) {
  const text = (state.title || '').trim().toUpperCase();
  if (!text) return;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const top = state.titlePos === 'top';
  const bandH = h * 0.3;
  const y0 = top ? 0 : h - bandH;
  const scrim = ctx.createLinearGradient(0, y0, 0, y0 + bandH);
  if (top) {
    scrim.addColorStop(0, 'rgba(5,3,10,0.72)');
    scrim.addColorStop(1, 'rgba(5,3,10,0)');
  } else {
    scrim.addColorStop(0, 'rgba(5,3,10,0)');
    scrim.addColorStop(1, 'rgba(5,3,10,0.72)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, y0, w, bandH);
  // Fit the caption to 88% of the width, then draw it with a heavy outline.
  let size = h * 0.13 * (state.titleSize || 1);
  const font = (s) => `${s}px "Bebas Neue", "Archivo Black", "Arial Black", sans-serif`;
  ctx.font = font(size);
  while (ctx.measureText(text).width > w * 0.88 && size > 16) {
    size -= 2;
    ctx.font = font(size);
  }
  const baseline = top ? y0 + bandH * 0.62 : h - h * 0.045;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0a0612';
  ctx.lineWidth = Math.max(4, size * 0.1);
  ctx.fillStyle = state.titleColor || '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.03;
  ctx.strokeText(text, w / 2, baseline);
  ctx.fillText(text, w / 2, baseline);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // Underline bar, the width of the caption. It takes its colours from the
  // active grade, so the caption always matches the poster's mood.
  const tw = ctx.measureText(text).width;
  const barH = Math.max(3, size * 0.045);
  const barY = baseline + size * 0.16;
  const barColors = grade.bar || ['#ff2e88', '#ff7a18', '#22d3ee'];
  const bar = ctx.createLinearGradient(w / 2 - tw / 2, 0, w / 2 + tw / 2, 0);
  bar.addColorStop(0, barColors[0]);
  bar.addColorStop(0.5, barColors[1]);
  bar.addColorStop(1, barColors[2]);
  ctx.fillStyle = bar;
  ctx.fillRect(w / 2 - tw / 2, barY, tw, barH);
}

/** Draws the whole cover for `state` onto the canvas, at the canvas's own size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.fillStyle = '#0b0910';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutRects(state.layout, w, h);
  const n = (LAYOUTS[state.layout] || LAYOUTS.hero).panels;
  for (let i = 0; i < n; i++) paintPanel(ctx, rects[i], state.slots[i], grade);
  paintTitle(ctx, state, w, h);
}
