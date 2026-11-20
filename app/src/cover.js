// Vice Cover Studio — cover painter, third build (round 5).
//
// A poster is a weighted grid of photo slots, a mood (colour grade), a
// headline, and an optional tagline — a second, movable line of type.
// drawCover() paints that poster onto any 2D canvas, so the on-screen
// preview and every exported PNG go through exactly the same code.
// Nothing here is Rockstar's: the lettering is Bebas Neue / Archivo Black
// (SIL OFL, bundled under app/fonts/) and every pixel is drawn from the
// person's own photos. Layouts are weighted grids, grades are hex stops,
// and photo filters are numeric recipes — change a table row and the look
// changes, without touching the painter.

// --- weighted grids: the layouts -----------------------------------------
//
// A layout splits the board into columns and rows of given weights, then
// hands each slot a span [column, row, columns-spanned, rows-spanned].
// Weights are fractions of the board, so a layout keeps its proportions at
// any export size and a new layout is one more row in this table.
export const GRID_LAYOUTS = {
  hero:   { label: 'Hero',   cols: [1],          rows: [1],       spans: [[0, 0, 1, 1]] },
  duo:    { label: 'Duo',    cols: [0.5, 0.5],   rows: [1],       spans: [[0, 0, 1, 1], [1, 0, 1, 1]] },
  trio:   { label: 'Trio',   cols: [0.62, 0.38], rows: [0.5, 0.5], spans: [[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]] },
  quad:   { label: 'Quad',   cols: [0.5, 0.5],   rows: [0.5, 0.5], spans: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1]] },
  strip:  { label: 'Strip',  cols: [0.5, 0.5],   rows: [0.55, 0.45], spans: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]] },
  column: { label: 'Column', cols: [1 / 3, 1 / 3, 1 / 3], rows: [1], spans: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1]] },
};

// --- hex moods: the colour grades ----------------------------------------
//
// A mood is a vertical tint ramp (hex stops with an alpha each), a flat
// wash laid over the whole slot, a three-colour bar for the headline, and
// a flag that says the photo goes grey before any tint touches it.
export const MOODS = {
  sunset: { label: 'Vice Sunset', grey: false,
    stops: [{ at: 0, hex: '#ff963c', a: 0 }, { at: 0.55, hex: '#ff6e46', a: 0.18 }, { at: 1, hex: '#d62882', a: 0.55 }],
    wash: { hex: '#ff7828', a: 0.10 }, bar: ['#ff2e88', '#ff7a18', '#22d3ee'] },
  neon: { label: 'Neon Nights', grey: false,
    stops: [{ at: 0, hex: '#ff00aa', a: 0.42 }, { at: 0.5, hex: '#7828dc', a: 0.18 }, { at: 1, hex: '#00d2ff', a: 0.42 }],
    wash: { hex: '#a000c8', a: 0.10 }, bar: ['#ff00aa', '#7b2ff7', '#00d2ff'] },
  dusk: { label: 'Palm Dusk', grey: false,
    stops: [{ at: 0, hex: '#00beaa', a: 0.30 }, { at: 0.55, hex: '#285ab4', a: 0.16 }, { at: 1, hex: '#6e28aa', a: 0.50 }],
    wash: { hex: '#1478a0', a: 0.10 }, bar: ['#2ee6c8', '#6a5cff', '#ff2e88'] },
  noir: { label: 'Mono Noir', grey: true,
    stops: [{ at: 0, hex: '#000000', a: 0 }, { at: 1, hex: '#000000', a: 0.28 }],
    wash: { hex: '#000000', a: 0.12 }, bar: ['#ffffff', '#9a92ad', '#55506a'] },
  gold: { label: 'Golden Hour', grey: false,
    stops: [{ at: 0, hex: '#ffd664', a: 0 }, { at: 0.5, hex: '#ffaa28', a: 0.16 }, { at: 1, hex: '#b45a00', a: 0.50 }],
    wash: { hex: '#ffbe3c', a: 0.10 }, bar: ['#ffd664', '#ffaa28', '#ff7a18'] },
  midnight: { label: 'Midnight Drive', grey: false,
    stops: [{ at: 0, hex: '#008cff', a: 0.32 }, { at: 0.5, hex: '#3c3cc8', a: 0.18 }, { at: 1, hex: '#080030', a: 0.55 }],
    wash: { hex: '#005adc', a: 0.10 }, bar: ['#00c2ff', '#4d7cfe', '#b45cff'] },
};

// --- numeric photo filters -------------------------------------------------
//
// A filter is a recipe of five numbers; the painter builds the canvas
// filter string from them, leaving out any step that would change nothing.
export const FILTERS = {
  none:  { label: 'Original', gray: 0, sepia: 0, sat: 1, con: 1, bright: 1 },
  mono:  { label: 'B&W',      gray: 1, sepia: 0, sat: 1, con: 1.08, bright: 1 },
  sepia: { label: 'Sepia',    gray: 0, sepia: 0.9, sat: 1, con: 1.05, bright: 1.02 },
  punch: { label: 'Punch',    gray: 0, sepia: 0, sat: 1.7, con: 1.18, bright: 1 },
};

// '#rrggbb' + alpha -> 'rgba(r,g,b,a)'.
function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function clampTo(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

// The gap between panels, in pixels: a hairline on small canvases, a
// visible gutter on posters.
function gutterPx(w, h) {
  return Math.max(3, Math.round(Math.min(w, h) * 0.008));
}

// Column weights -> pixel edges along one axis: [0, ..., total].
function weightedEdges(weights, total) {
  const edges = [0];
  let soFar = 0;
  for (const weight of weights) {
    soFar += weight;
    edges.push(soFar * total);
  }
  return edges;
}

// Grid spec -> pixel slots. A slot that touches the board edge stays flush
// with it; a slot on an interior edge gives up half a gutter, so the gap
// between two neighbours is exactly one gutter wide.
export function computeSlots(arrange, w, h) {
  const spec = GRID_LAYOUTS[arrange] || GRID_LAYOUTS.hero;
  const gap = gutterPx(w, h);
  const xs = weightedEdges(spec.cols, w);
  const ys = weightedEdges(spec.rows, h);
  const colCount = spec.cols.length;
  const rowCount = spec.rows.length;
  return spec.spans.map(([col, row, colSpan, rowSpan]) => {
    let x = xs[col];
    let y = ys[row];
    let x2 = xs[col + colSpan];
    let y2 = ys[row + rowSpan];
    if (col > 0) x += gap / 2;
    if (row > 0) y += gap / 2;
    if (col + colSpan < colCount) x2 -= gap / 2;
    if (row + rowSpan < rowCount) y2 -= gap / 2;
    return { x, y, w: x2 - x, h: y2 - y };
  });
}

// Zoom that makes the photo cover its slot (never letterboxed), times the
// person's own zoom on top.
function fitZoom(imgW, imgH, slotW, slotH, zoom) {
  return Math.max(slotW / imgW, slotH / imgH) * (zoom || 1);
}

// Build the canvas filter string for one slot: the slot's own filter,
// plus a grey wash when the mood asks for it.
function filterFor(slot, mood) {
  const recipe = FILTERS[slot.filter] || FILTERS.none;
  const parts = [];
  if (recipe.gray) parts.push(`grayscale(${recipe.gray})`);
  if (recipe.sepia) parts.push(`sepia(${recipe.sepia})`);
  if (recipe.sat !== 1) parts.push(`saturate(${recipe.sat})`);
  if (recipe.con !== 1) parts.push(`contrast(${recipe.con})`);
  if (recipe.bright !== 1) parts.push(`brightness(${recipe.bright})`);
  if (mood.grey) parts.push('grayscale(1) contrast(1.12) brightness(1.02)');
  return parts.join(' ');
}

// One slot: the photo (cover-fit, panned, zoomed, filtered), the mood's
// tint ramp and wash, a vignette, and the white poster frame. A slot with
// no photo yet gets a dashed frame and a prompt instead of a picture.
function drawSlot(ctx, slot, cell, mood) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.w, slot.h);
  ctx.clip();
  if (cell && cell.img) {
    const imgW = cell.img.naturalWidth;
    const imgH = cell.img.naturalHeight;
    const zoom = fitZoom(imgW, imgH, slot.w, slot.h, cell.zoom);
    const drawnW = imgW * zoom;
    const drawnH = imgH * zoom;
    const freeX = Math.max(0, (drawnW - slot.w) / 2);
    const freeY = Math.max(0, (drawnH - slot.h) / 2);
    const shiftX = clampTo(cell.ox || 0, -freeX, freeX);
    const shiftY = clampTo(cell.oy || 0, -freeY, freeY);
    const filter = filterFor(cell, mood);
    if (filter) ctx.filter = filter;
    ctx.drawImage(cell.img, slot.x + (slot.w - drawnW) / 2 + shiftX, slot.y + (slot.h - drawnH) / 2 + shiftY, drawnW, drawnH);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#241a30';
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(slot.x + 8, slot.y + 8, slot.w - 16, slot.h - 16);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${Math.round(Math.min(slot.w, slot.h) * 0.06)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD PHOTO', slot.x + slot.w / 2, slot.y + slot.h / 2);
  }
  // Mood: a vertical tint ramp blended in overlay, then the flat wash.
  const ramp = ctx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
  for (const stop of mood.stops) ramp.addColorStop(stop.at, hexA(stop.hex, stop.a));
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ramp;
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = hexA(mood.wash.hex, mood.wash.a);
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  // Vignette: pull the corners down so the slots read as one poster.
  const midX = slot.x + slot.w / 2;
  const midY = slot.y + slot.h / 2;
  const shade = ctx.createRadialGradient(midX, midY, Math.min(slot.w, slot.h) * 0.3, midX, midY, Math.max(slot.w, slot.h) * 0.72);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
  // White poster frame around the slot.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(slot.w, slot.h) * 0.004));
  ctx.strokeRect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2);
  ctx.restore();
}

// The headline: a scrim band at the top or the bottom, display type
// shrunk step by step until it fits the width, a heavy outline, and the
// mood's accent bar underneath.
function drawTitle(ctx, poster, w, h) {
  const words = (poster.title || '').trim().toUpperCase();
  if (!words) return;
  const mood = MOODS[poster.mood] || MOODS.sunset;
  const upTop = poster.titleAt === 'top';
  const bandH = h * 0.3;
  const bandY = upTop ? 0 : h - bandH;
  const scrim = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  scrim.addColorStop(upTop ? 0 : 1, 'rgba(5,3,10,0.72)');
  scrim.addColorStop(upTop ? 1 : 0, 'rgba(5,3,10,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY, w, bandH);
  // Start big, then shrink in 8% steps until the words fit 88% of the width.
  const face = (px) => `${px}px "Bebas Neue", "Archivo Black", "Arial Black", sans-serif`;
  let size = h * 0.13 * (poster.titleSize || 1);
  const limit = w * 0.88;
  ctx.font = face(size);
  while (ctx.measureText(words).width > limit && size > 16) {
    size = Math.floor(size * 0.92);
    ctx.font = face(size);
  }
  const baseline = upTop ? bandY + bandH * 0.62 : h - h * 0.045;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0a0612';
  ctx.lineWidth = Math.max(4, size * 0.1);
  ctx.fillStyle = poster.titleInk || '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.03;
  ctx.strokeText(words, w / 2, baseline);
  ctx.fillText(words, w / 2, baseline);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // The accent bar under the words, in the mood's own colours.
  const textW = ctx.measureText(words).width;
  const barH = Math.max(3, size * 0.045);
  const bar = ctx.createLinearGradient(w / 2 - textW / 2, 0, w / 2 + textW / 2, 0);
  const [first, mid, last] = mood.bar;
  bar.addColorStop(0, first);
  bar.addColorStop(0.5, mid);
  bar.addColorStop(1, last);
  ctx.fillStyle = bar;
  ctx.fillRect(w / 2 - textW / 2, baseline + size * 0.16, textW, barH);
}

// The tagline: a second line of type the person can park anywhere on the
// cover (fractions of the width and height), in Archivo Black so it reads
// as a different voice from the Bebas headline.
function drawTagline(ctx, poster, w, h) {
  const tag = poster.tagline;
  if (!tag) return;
  const words = (tag.text || '').trim().toUpperCase();
  if (!words) return;
  const size = Math.max(14, h * (tag.size || 0.045));
  const x = (tag.x ?? 0.5) * w;
  const y = (tag.y ?? 0.1) * h;
  ctx.save();
  ctx.font = `${size}px "Archivo Black", "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(5,3,10,0.85)';
  ctx.lineWidth = Math.max(3, size * 0.08);
  ctx.fillStyle = tag.ink || '#ffffff';
  ctx.strokeText(words, x, y);
  ctx.fillText(words, x, y);
  ctx.restore();
}

// Paints the whole poster for `poster` onto the canvas, at the canvas's own size.
export function drawCover(canvas, poster) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const mood = MOODS[poster.mood] || MOODS.sunset;
  ctx.fillStyle = '#0b0910';
  ctx.fillRect(0, 0, w, h);
  const slots = computeSlots(poster.arrange, w, h);
  const spec = GRID_LAYOUTS[poster.arrange] || GRID_LAYOUTS.hero;
  for (let i = 0; i < spec.spans.length; i++) {
    drawSlot(ctx, slots[i], poster.slots[i], mood);
  }
  drawTitle(ctx, poster, w, h);
  drawTagline(ctx, poster, w, h);
}
