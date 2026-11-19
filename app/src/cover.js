// Vice Cover Studio — the cover renderer.
//
// Draws a multi-panel GTA-poster-style cover on any 2D canvas: panels of one
// photo with different crops (or several photos), a colour grade, and a big
// display caption with a heavy outline. Every coordinate is derived from the
// canvas's own size, so the same state renders the preview and any export
// size. No Rockstar art, logo or font is used anywhere: the lettering is
// Bebas Neue / Archivo Black (OFL, bundled under app/fonts/) and the grades
// are our own gradients.

export const LAYOUTS = {
  hero: { panels: 1, name: 'Hero' },
  duo: { panels: 2, name: 'Duo' },
  trio: { panels: 3, name: 'Trio' },
  quad: { panels: 4, name: 'Quad' },
};

export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    stops: [[0, 'rgba(255,150,60,0)'], [0.55, 'rgba(255,110,70,0.18)'], [1, 'rgba(214,40,130,0.55)']],
    wash: 'rgba(255,120,40,0.10)',
  },
  neon: {
    name: 'Neon Nights',
    stops: [[0, 'rgba(255,0,170,0.42)'], [0.5, 'rgba(120,40,220,0.18)'], [1, 'rgba(0,210,255,0.42)']],
    wash: 'rgba(160,0,200,0.10)',
  },
  dusk: {
    name: 'Palm Dusk',
    stops: [[0, 'rgba(0,190,170,0.30)'], [0.55, 'rgba(40,90,180,0.16)'], [1, 'rgba(110,40,170,0.50)']],
    wash: 'rgba(20,120,160,0.10)',
  },
  noir: {
    name: 'Mono Noir',
    stops: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.28)']],
    wash: 'rgba(0,0,0,0.12)',
    gray: true,
  },
};

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** The panel rectangles for a layout, in canvas pixels, with a thin gutter. */
export function layoutRects(layout, w, h) {
  const g = Math.max(3, Math.round(Math.min(w, h) * 0.008));
  switch (layout) {
    case 'duo':
      return [
        { x: 0, y: 0, w: w / 2 - g / 2, h },
        { x: w / 2 + g / 2, y: 0, w: w / 2 - g / 2, h },
      ];
    case 'trio':
      return [
        { x: 0, y: 0, w: w * 0.62 - g / 2, h },
        { x: w * 0.62 + g / 2, y: 0, w: w * 0.38 - g / 2, h: h / 2 - g / 2 },
        { x: w * 0.62 + g / 2, y: h / 2 + g / 2, w: w * 0.38 - g / 2, h: h / 2 - g / 2 },
      ];
    case 'quad':
      return [
        { x: 0, y: 0, w: w / 2 - g / 2, h: h / 2 - g / 2 },
        { x: w / 2 + g / 2, y: 0, w: w / 2 - g / 2, h: h / 2 - g / 2 },
        { x: 0, y: h / 2 + g / 2, w: w / 2 - g / 2, h: h / 2 - g / 2 },
        { x: w / 2 + g / 2, y: h / 2 + g / 2, w: w / 2 - g / 2, h: h / 2 - g / 2 },
      ];
    default: // hero
      return [{ x: 0, y: 0, w, h }];
  }
}

function drawPanel(ctx, r, slot, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  if (slot && slot.img) {
    const iw = slot.img.naturalWidth;
    const ih = slot.img.naturalHeight;
    const base = Math.max(r.w / iw, r.h / ih) * (slot.zoom || 1);
    const dw = iw * base;
    const dh = ih * base;
    const maxOx = Math.max(0, (dw - r.w) / 2);
    const maxOy = Math.max(0, (dh - r.h) / 2);
    const ox = clamp(slot.ox || 0, -maxOx, maxOx);
    const oy = clamp(slot.oy || 0, -maxOy, maxOy);
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

function drawTitle(ctx, state, w, h) {
  const text = (state.title || '').trim().toUpperCase();
  if (!text) return;
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
  // Neon underline bar, the width of the caption.
  const tw = ctx.measureText(text).width;
  const barH = Math.max(3, size * 0.045);
  const barY = baseline + size * 0.16;
  const bar = ctx.createLinearGradient(w / 2 - tw / 2, 0, w / 2 + tw / 2, 0);
  bar.addColorStop(0, '#ff2e88');
  bar.addColorStop(0.5, '#ff7a18');
  bar.addColorStop(1, '#22d3ee');
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
  for (let i = 0; i < n; i++) drawPanel(ctx, rects[i], state.slots[i], grade);
  drawTitle(ctx, state, w, h);
}
