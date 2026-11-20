// Vice Cover Studio — poster renderer, rebuilt from scratch for round 4.
//
// A cover is a board: a layout (where the panels sit), a colour grade (the
// mood), a headline (the big words) and one photo per panel, each with its
// own crop and tone. renderPoster() paints that board onto any 2D canvas,
// so the on-screen preview and every exported PNG share exactly one code
// path. Everything here is our own work — the display type is Bebas Neue /
// Archivo Black (SIL OFL, bundled under app/fonts/) and there is no
// Rockstar logo, artwork or font anywhere in the entry.

// --- the catalogue: layouts, grades, photo tones --------------------------

// A layout is a list of fraction boxes [left, top, width, height] measured
// in canvas units, so adding a layout is one more row in this table and
// nothing else in the renderer has to change.
export const PANEL_LAYOUTS = {
  hero:   { cells: 1, label: 'Hero',   boxes: [[0, 0, 1, 1]] },
  duo:    { cells: 2, label: 'Duo',    boxes: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  trio:   { cells: 3, label: 'Trio',   boxes: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 0.5], [0.62, 0.5, 0.38, 0.5]] },
  quad:   { cells: 4, label: 'Quad',   boxes: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  strip:  { cells: 3, label: 'Strip',  boxes: [[0, 0, 1, 0.55], [0, 0.55, 0.5, 0.45], [0.5, 0.55, 0.5, 0.45]] },
  column: { cells: 3, label: 'Column', boxes: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
};

// A grade is a tint ramp (colour + opacity stops), a flat veil, and the
// three colours of the headline bar. `grey` grades wash the photo to
// black-and-white before the ramp goes on.
export const COLOUR_GRADES = {
  sunset: { label: 'Vice Sunset', grey: false,
    ramp: [[0, '255,150,60', 0], [0.55, '255,110,70', 0.18], [1, '214,40,130', 0.55]],
    veil: 'rgba(255,120,40,0.10)', accent: ['#ff2e88', '#ff7a18', '#22d3ee'] },
  neon: { label: 'Neon Nights', grey: false,
    ramp: [[0, '255,0,170', 0.42], [0.5, '120,40,220', 0.18], [1, '0,210,255', 0.42]],
    veil: 'rgba(160,0,200,0.10)', accent: ['#ff00aa', '#7b2ff7', '#00d2ff'] },
  dusk: { label: 'Palm Dusk', grey: false,
    ramp: [[0, '0,190,170', 0.30], [0.55, '40,90,180', 0.16], [1, '110,40,170', 0.50]],
    veil: 'rgba(20,120,160,0.10)', accent: ['#2ee6c8', '#6a5cff', '#ff2e88'] },
  noir: { label: 'Mono Noir', grey: true,
    ramp: [[0, '0,0,0', 0], [1, '0,0,0', 0.28]],
    veil: 'rgba(0,0,0,0.12)', accent: ['#ffffff', '#9a92ad', '#55506a'] },
  gold: { label: 'Golden Hour', grey: false,
    ramp: [[0, '255,214,100', 0], [0.5, '255,170,40', 0.16], [1, '180,90,0', 0.50]],
    veil: 'rgba(255,190,60,0.10)', accent: ['#ffd664', '#ffaa28', '#ff7a18'] },
  midnight: { label: 'Midnight Drive', grey: false,
    ramp: [[0, '0,140,255', 0.32], [0.5, '60,60,200', 0.18], [1, '8,0,48', 0.55]],
    veil: 'rgba(0,90,220,0.10)', accent: ['#00c2ff', '#4d7cfe', '#b45cff'] },
};

// Per-panel photo tones, applied when the photo is drawn (before the grade).
export const PHOTO_TONES = {
  none:  { label: 'Original', filter: '' },
  mono:  { label: 'B&W',      filter: 'grayscale(1) contrast(1.08)' },
  sepia: { label: 'Sepia',    filter: 'sepia(0.9) contrast(1.05) brightness(1.02)' },
  punch: { label: 'Punch',    filter: 'saturate(1.7) contrast(1.18)' },
};

function bound(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function paintGap(w, h) {
  return Math.max(3, Math.round(Math.min(w, h) * 0.008));
}

// Fraction boxes -> pixel boxes. Interior edges lose half a gutter each
// side; the outer edges stay flush with the canvas, like a poster bleed.
export function panelBoxes(layout, w, h) {
  const spec = PANEL_LAYOUTS[layout] || PANEL_LAYOUTS.hero;
  const g = paintGap(w, h);
  return spec.boxes.map(([fx, fy, fw, fh]) => {
    const x0 = fx * w;
    const y0 = fy * h;
    const x1 = (fx + fw) * w;
    const y1 = (fy + fh) * h;
    const left = fx > 0 ? x0 + g / 2 : x0;
    const top = fy > 0 ? y0 + g / 2 : y0;
    const right = fx + fw < 1 ? x1 - g / 2 : x1;
    const bottom = fy + fh < 1 ? y1 - g / 2 : y1;
    return { x: left, y: top, w: right - left, h: bottom - top };
  });
}

function coverFit(photoW, photoH, boxW, boxH, scale) {
  return Math.max(boxW / photoW, boxH / photoH) * (scale || 1);
}

// One panel: the photo (cover-fit, panned, zoomed, toned), the grade, a
// vignette, and the white poster frame. An empty panel gets a dashed
// "add photo" frame instead of a picture.
function paintPhoto(ctx, box, cell, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  if (cell && cell.photo) {
    const pw = cell.photo.naturalWidth;
    const ph = cell.photo.naturalHeight;
    const k = coverFit(pw, ph, box.w, box.h, cell.scale);
    const dw = pw * k;
    const dh = ph * k;
    const slackX = Math.max(0, (dw - box.w) / 2);
    const slackY = Math.max(0, (dh - box.h) / 2);
    const px = bound(cell.dx || 0, -slackX, slackX);
    const py = bound(cell.dy || 0, -slackY, slackY);
    const tone = PHOTO_TONES[cell.tone] || PHOTO_TONES.none;
    const fx = [tone.filter, grade.grey ? 'grayscale(1) contrast(1.12) brightness(1.02)' : '']
      .filter(Boolean).join(' ');
    if (fx) ctx.filter = fx;
    ctx.drawImage(cell.photo, box.x + (box.w - dw) / 2 + px, box.y + (box.h - dh) / 2 + py, dw, dh);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#241a30';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x + 8, box.y + 8, box.w - 16, box.h - 16);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${Math.round(Math.min(box.w, box.h) * 0.06)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD PHOTO', box.x + box.w / 2, box.y + box.h / 2);
  }
  // Grade: a vertical tint ramp in overlay, then the flat veil.
  const ramp = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  for (const [at, rgb, alpha] of grade.ramp) ramp.addColorStop(at, `rgba(${rgb},${alpha})`);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ramp;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grade.veil;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  // Vignette: darken the corners so the panels read as one poster.
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const shade = ctx.createRadialGradient(cx, cy, Math.min(box.w, box.h) * 0.3, cx, cy, Math.max(box.w, box.h) * 0.72);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
  // White poster frame around the panel.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(box.w, box.h) * 0.004));
  ctx.strokeRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
  ctx.restore();
}

// The headline: a scrim band, display type fitted to the width in one
// measurement, a heavy outline, and the grade's accent bar underneath.
function paintHeadline(ctx, board, w, h) {
  const words = (board.headline || '').trim().toUpperCase();
  if (!words) return;
  const grade = COLOUR_GRADES[board.grade] || COLOUR_GRADES.sunset;
  const onTop = board.headlineSpot === 'top';
  const band = h * 0.3;
  const bandY = onTop ? 0 : h - band;
  const scrim = ctx.createLinearGradient(0, bandY, 0, bandY + band);
  scrim.addColorStop(onTop ? 0 : 1, 'rgba(5,3,10,0.72)');
  scrim.addColorStop(onTop ? 1 : 0, 'rgba(5,3,10,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY, w, band);
  // Size the words to the canvas, then shrink once to fit 88% of the width.
  const face = (px) => `${px}px "Bebas Neue", "Archivo Black", "Arial Black", sans-serif`;
  let size = h * 0.13 * (board.headlineScale || 1);
  ctx.font = face(size);
  const tooWide = ctx.measureText(words).width / (w * 0.88);
  if (tooWide > 1) {
    size = Math.max(16, Math.floor(size / tooWide));
    ctx.font = face(size);
  }
  const base = onTop ? bandY + band * 0.62 : h - h * 0.045;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0a0612';
  ctx.lineWidth = Math.max(4, size * 0.1);
  ctx.fillStyle = board.headlineInk || '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.03;
  ctx.strokeText(words, w / 2, base);
  ctx.fillText(words, w / 2, base);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // The accent bar under the words, in the grade's own colours.
  const wide = ctx.measureText(words).width;
  const thick = Math.max(3, size * 0.045);
  const bar = ctx.createLinearGradient(w / 2 - wide / 2, 0, w / 2 + wide / 2, 0);
  const [c0, c1, c2] = grade.accent;
  bar.addColorStop(0, c0);
  bar.addColorStop(0.5, c1);
  bar.addColorStop(1, c2);
  ctx.fillStyle = bar;
  ctx.fillRect(w / 2 - wide / 2, base + size * 0.16, wide, thick);
}

// Paints the whole cover for `board` onto the canvas, at the canvas's own size.
export function renderPoster(canvas, board) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = COLOUR_GRADES[board.grade] || COLOUR_GRADES.sunset;
  ctx.fillStyle = '#0b0910';
  ctx.fillRect(0, 0, w, h);
  const boxes = panelBoxes(board.layout, w, h);
  const total = (PANEL_LAYOUTS[board.layout] || PANEL_LAYOUTS.hero).cells;
  for (let i = 0; i < total; i++) paintPhoto(ctx, boxes[i], board.cells[i], grade);
  paintHeadline(ctx, board, w, h);
}
