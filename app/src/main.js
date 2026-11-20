// Vice Cover Studio — page wiring, rebuilt from scratch for round 4.
//
// Pick photos, arrange panels, tone each photo, set the caption and grade,
// export a PNG. A `?shot=` query sets up a fixed scene for a screenshot
// instead (./shots.js). Growing to a layout with more panels fills its
// empty panels from the samples, and the preview canvas follows the chosen
// export size. Keyboard: keys 1–4 pick a panel; double-click a panel to
// reset its crop.
import { renderPoster, panelBoxes, PANEL_LAYOUTS, COLOUR_GRADES, PHOTO_TONES } from './cover.js';
import { playScene } from './shots.js';

const sheet = document.getElementById('cover');
const wordsInput = document.getElementById('caption');
const noteEl = document.getElementById('status');
const zoomEl = document.getElementById('zoom');
const cellLabel = document.getElementById('panelLabel');

function freshCell() {
  return { photo: null, label: null, scale: 1, dx: 0, dy: 0, tone: 'none' };
}

const board = {
  layout: 'trio',
  grade: 'sunset',
  headline: 'Sunset Heist',
  headlineScale: 1,
  headlineSpot: 'bottom',
  headlineInk: '#ffffff',
  size: '1080x1080',
  cells: [freshCell(), freshCell(), freshCell(), freshCell()],
};
let activeCell = 0;

function cellCount() {
  return (PANEL_LAYOUTS[board.layout] || PANEL_LAYOUTS.hero).cells;
}

// Paint the board, then mark the active panel and sync every control row
// with it. The pink dashed frame is preview-only, never on an export.
function paint() {
  renderPoster(sheet, board);
  if (!document.body.classList.contains('shot-cover') && activeCell < cellCount()) {
    const ctx = sheet.getContext('2d');
    const box = panelBoxes(board.layout, sheet.width, sheet.height)[activeCell];
    ctx.save();
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 8]);
    ctx.strokeRect(box.x + 3, box.y + 3, box.w - 6, box.h - 6);
    ctx.restore();
  }
  document.querySelectorAll('[data-panel]').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.panel) === activeCell);
  });
  document.querySelectorAll('[data-tone]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tone === board.cells[activeCell].tone);
  });
  const cell = board.cells[activeCell];
  zoomEl.value = cell.scale;
  cellLabel.textContent = `Panel ${activeCell + 1} — ${cell.label || 'no photo yet'}`;
}

export function photoFrom(url) {
  return new Promise((resolve, reject) => {
    const pic = new Image();
    pic.onload = () => resolve(pic);
    pic.onerror = reject;
    pic.src = url;
  });
}

async function putPhoto(i, url, label) {
  const pic = await photoFrom(url);
  const keepTone = board.cells[i].tone;
  board.cells[i] = { photo: pic, label, scale: 1, dx: 0, dy: 0, tone: keepTone };
  paint();
}

function clearCrop(i) {
  const cell = board.cells[i];
  cell.scale = 1;
  cell.dx = 0;
  cell.dy = 0;
  paint();
}

// One delegated handler per button group: the button's data attribute names
// the value, the callback applies it, the group re-marks itself, and the
// board repaints. Keeps every control row wired the same way.
function wireGroup(attr, apply) {
  document.querySelectorAll(`[${attr}]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      apply(btn);
      document.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle('active', x === btn));
      paint();
    });
  });
}

wireGroup('data-panel', (btn) => { activeCell = Number(btn.dataset.panel); });
wireGroup('data-layout', (btn) => {
  board.layout = btn.dataset.layout;
  fillGaps();
  if (activeCell >= cellCount()) activeCell = 0;
});
wireGroup('data-grade', (btn) => { board.grade = btn.dataset.grade; });
wireGroup('data-titlepos', (btn) => { board.headlineSpot = btn.dataset.titlepos; });
wireGroup('data-titlecolor', (btn) => { board.headlineInk = btn.dataset.titlecolor; });
wireGroup('data-tone', (btn) => { board.cells[activeCell].tone = btn.dataset.tone; });
wireGroup('data-size', (btn) => {
  board.size = btn.dataset.size;
  document.getElementById('export').textContent = `Export PNG ${board.size.replace('x', ' × ')}`;
  resizePreview();
});

// Photo sources: the two free samples, or the person's own file.
document.getElementById('samplePier').addEventListener('click', () => {
  putPhoto(activeCell, 'samples/pier.jpg', 'pier');
});
document.getElementById('sampleBoulevard').addEventListener('click', () => {
  putPhoto(activeCell, 'samples/boulevard.jpg', 'boulevard');
});
document.getElementById('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const pic = await photoFrom(URL.createObjectURL(file));
  board.cells[activeCell] = { photo: pic, label: file.name, scale: 1, dx: 0, dy: 0, tone: board.cells[activeCell].tone };
  paint();
  noteEl.textContent = `Loaded ${file.name} into panel ${activeCell + 1}.`;
});

// Panel picking and per-panel crop: click a panel to pick it, drag to pan,
// scroll to zoom, double-click to reset the crop, keys 1–4 to pick a panel.
function sheetPoint(e) {
  const rect = sheet.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * sheet.width,
    y: ((e.clientY - rect.top) / rect.height) * sheet.height,
  };
}
function cellAt(p) {
  const boxes = panelBoxes(board.layout, sheet.width, sheet.height);
  return boxes.findIndex((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
}
let grab = null;
sheet.addEventListener('pointerdown', (e) => {
  const hit = cellAt(sheetPoint(e));
  if (hit < 0) return;
  activeCell = hit;
  const cell = board.cells[activeCell];
  grab = { x: sheetPoint(e).x, y: sheetPoint(e).y, dx: cell.dx, dy: cell.dy, moved: false };
  sheet.setPointerCapture(e.pointerId);
  paint();
});
sheet.addEventListener('pointermove', (e) => {
  if (!grab) return;
  const p = sheetPoint(e);
  const dx = p.x - grab.x;
  const dy = p.y - grab.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) grab.moved = true;
  const cell = board.cells[activeCell];
  cell.dx = grab.dx + dx;
  cell.dy = grab.dy + dy;
  paint();
});
sheet.addEventListener('pointerup', () => { grab = null; });
sheet.addEventListener('dblclick', () => clearCrop(activeCell));
sheet.addEventListener('wheel', (e) => {
  e.preventDefault();
  const cell = board.cells[activeCell];
  cell.scale = Math.min(4, Math.max(1, cell.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
  paint();
}, { passive: false });
document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.matches('input, textarea')) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 4 && n - 1 < cellCount()) {
    activeCell = n - 1;
    paint();
  }
});
zoomEl.addEventListener('input', () => {
  board.cells[activeCell].scale = Number(zoomEl.value);
  paint();
});
document.getElementById('resetCrop').addEventListener('click', () => clearCrop(activeCell));

// When a layout grows, fill its empty panels from the samples so the cover
// never shows a bare "ADD PHOTO" panel in the middle of a finished cover.
async function fillGaps() {
  const total = cellCount();
  for (let i = 0; i < total; i++) {
    if (!board.cells[i].photo) {
      const label = i % 2 === 0 ? 'pier' : 'boulevard';
      await putPhoto(i, `samples/${label}.jpg`, label);
    }
  }
}

// The preview canvas follows the chosen export size, so what you see is
// the shape you will get.
function resizePreview() {
  const [w, h] = board.size.split('x').map(Number);
  sheet.width = w;
  sheet.height = h;
  paint();
}

// One-click preset: a finished-looking cover from the samples.
document.getElementById('quick').addEventListener('click', async () => {
  board.layout = 'trio';
  board.grade = 'sunset';
  board.headline = 'Sunset Heist';
  board.headlineSpot = 'bottom';
  wordsInput.value = 'Sunset Heist';
  document.querySelectorAll('[data-layout]').forEach((x) => x.classList.toggle('active', x.dataset.layout === 'trio'));
  document.querySelectorAll('[data-grade]').forEach((x) => x.classList.toggle('active', x.dataset.grade === 'sunset'));
  await putPhoto(0, 'samples/pier.jpg', 'pier');
  await putPhoto(1, 'samples/boulevard.jpg', 'boulevard');
  await putPhoto(2, 'samples/pier.jpg', 'pier');
  activeCell = 0;
  noteEl.textContent = 'Quick cover ready — tweak it, then export.';
});

// Export: render the same board at the chosen post size and download the PNG.
async function exportPNG() {
  const [w, h] = board.size.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderPoster(off, board);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${w}x${h}.png`;
  a.click();
  noteEl.textContent = `Saved vice-cover-${w}x${h}.png (${Math.round(blob.size / 1024)} KB).`;
  return { width: w, height: h, bytes: blob.size };
}
document.getElementById('export').addEventListener('click', exportPNG);

// Caption inputs.
wordsInput.addEventListener('input', () => {
  board.headline = wordsInput.value;
  paint();
});
document.getElementById('titleSize').addEventListener('input', (e) => {
  board.headlineScale = Number(e.target.value);
  paint();
});

// Test handle: lets an automated check drive the export and read its size.
window.__app = { board, paint, exportPNG, putPhoto };

// Fixed scenes for screenshots (?shot=cover / ?shot=editor).
const params = new URLSearchParams(location.search);
const scene = params.get('shot');
if (scene) {
  playScene(scene, params, async (q) => {
    if (q.get('layout') && PANEL_LAYOUTS[q.get('layout')]) board.layout = q.get('layout');
    if (q.get('grade') && COLOUR_GRADES[q.get('grade')]) board.grade = q.get('grade');
    if (q.get('caption') !== null) {
      board.headline = q.get('caption');
      wordsInput.value = board.headline;
    }
    if (q.get('titlepos') === 'top' || q.get('titlepos') === 'bottom') board.headlineSpot = q.get('titlepos');
    if (q.get('titlecolor')) board.headlineInk = q.get('titlecolor');
    if (scene === 'cover') {
      sheet.width = Number(q.get('cw') || 1080);
      sheet.height = Number(q.get('ch') || 1080);
    }
    const keys = ['photo', 'photo2', 'photo3', 'photo4'];
    const total = cellCount();
    for (let i = 0; i < total; i++) {
      const label = q.get(keys[i]) || (i % 2 === 0 ? 'pier' : 'boulevard');
      await putPhoto(i, `samples/${label}.jpg`, label);
      const tone = q.get(`tone${i + 1}`) || q.get('tone');
      if (tone && PHOTO_TONES[tone]) board.cells[i].tone = tone;
    }
    activeCell = 0;
    paint();
  }, paint);
} else {
  // Load the bundled fonts before the first paint so the caption renders in
  // Bebas Neue, not the fallback.
  Promise.all([
    document.fonts.load('100px "Bebas Neue"'),
    document.fonts.load('100px "Archivo Black"'),
  ]).catch(() => {}).finally(paint);
  paint();
}
