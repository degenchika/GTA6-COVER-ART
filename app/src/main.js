// Vice Cover Studio — page wiring, rewritten for round 3.
//
// Pick photos, arrange panels, set the caption and grade, export a PNG.
// A `?shot=` query sets up a fixed scene for a screenshot instead
// (./shots.js). Switching to a layout with more panels fills its empty
// panels from the samples, and the preview canvas follows the chosen
// export size. Keyboard: keys 1–4 pick a panel; double-click a panel to
// reset its crop.
import { drawCover, layoutRects, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const statusEl = document.getElementById('status');
const zoomInput = document.getElementById('zoom');
const panelLabel = document.getElementById('panelLabel');

function newSlot() {
  return { img: null, name: null, zoom: 1, ox: 0, oy: 0 };
}

const state = {
  layout: 'trio',
  grade: 'sunset',
  title: 'Sunset Heist',
  titleSize: 1,
  titlePos: 'bottom',
  titleColor: '#ffffff',
  exportSize: '1080x1080',
  slots: [newSlot(), newSlot(), newSlot(), newSlot()],
};
let selected = 0;

function panelCount() {
  return (LAYOUTS[state.layout] || LAYOUTS.hero).panels;
}

function redraw() {
  drawCover(canvas, state);
  // Selection outline on the preview only, never on an export or a shot.
  if (!document.body.classList.contains('shot-cover') && selected < panelCount()) {
    const ctx = canvas.getContext('2d');
    const r = layoutRects(state.layout, canvas.width, canvas.height)[selected];
    ctx.save();
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 8]);
    ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    ctx.restore();
  }
  document.querySelectorAll('[data-panel]').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.panel) === selected);
  });
  const slot = state.slots[selected];
  zoomInput.value = slot.zoom;
  panelLabel.textContent = `Panel ${selected + 1} — ${slot.name || 'no photo yet'}`;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function setSlotPhoto(i, url, name) {
  const img = await loadImage(url);
  state.slots[i] = { img, name, zoom: 1, ox: 0, oy: 0 };
  redraw();
}

function resetSlotCrop(i) {
  const slot = state.slots[i];
  slot.zoom = 1;
  slot.ox = 0;
  slot.oy = 0;
  redraw();
}

// Photo sources: the two free samples, or the person's own file.
document.getElementById('samplePier').addEventListener('click', () => {
  setSlotPhoto(selected, 'samples/pier.jpg', 'pier');
});
document.getElementById('sampleBoulevard').addEventListener('click', () => {
  setSlotPhoto(selected, 'samples/boulevard.jpg', 'boulevard');
});
document.getElementById('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  state.slots[selected] = { img, name: file.name, zoom: 1, ox: 0, oy: 0 };
  redraw();
  statusEl.textContent = `Loaded ${file.name} into panel ${selected + 1}.`;
});

// Panel selection and per-panel crop: click a panel to pick it, drag to pan,
// scroll to zoom, double-click to reset the crop, keys 1–4 to pick a panel.
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}
function panelAt(p) {
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  return rects.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
}
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(canvasPoint(e));
  if (hit < 0) return;
  selected = hit;
  const slot = state.slots[selected];
  drag = { x: canvasPoint(e).x, y: canvasPoint(e).y, ox: slot.ox, oy: slot.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const dx = p.x - drag.x;
  const dy = p.y - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  const slot = state.slots[selected];
  slot.ox = drag.ox + dx;
  slot.oy = drag.oy + dy;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('dblclick', () => resetSlotCrop(selected));
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = state.slots[selected];
  slot.zoom = Math.min(4, Math.max(1, slot.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
  redraw();
}, { passive: false });
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 4) {
    selected = n - 1;
    redraw();
  }
});
document.querySelectorAll('[data-panel]').forEach((b) => {
  b.addEventListener('click', () => {
    selected = Number(b.dataset.panel);
    redraw();
  });
});
zoomInput.addEventListener('input', () => {
  state.slots[selected].zoom = Number(zoomInput.value);
  redraw();
});
document.getElementById('resetCrop').addEventListener('click', () => resetSlotCrop(selected));

// When a layout grows, fill its empty panels from the samples so the cover
// never shows a bare "ADD A PHOTO" panel in the middle of a finished cover.
async function fillEmptyPanels() {
  const n = panelCount();
  for (let i = 0; i < n; i++) {
    if (!state.slots[i].img) {
      const name = i % 2 === 0 ? 'pier' : 'boulevard';
      await setSlotPhoto(i, `samples/${name}.jpg`, name);
    }
  }
}

// The preview canvas follows the chosen export size, so what you see is
// the shape you will get.
function applyExportSize() {
  const [w, h] = state.exportSize.split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  redraw();
}

function markActive(selector, el) {
  document.querySelectorAll(selector).forEach((x) => x.classList.toggle('active', x === el));
}

// Layout, grade, caption.
document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => {
    state.layout = b.dataset.layout;
    fillEmptyPanels();
    if (selected >= panelCount()) selected = 0;
    markActive('[data-layout]', b);
    redraw();
  });
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => {
    state.grade = b.dataset.grade;
    markActive('[data-grade]', b);
    redraw();
  });
});
captionInput.addEventListener('input', () => {
  state.title = captionInput.value;
  redraw();
});
document.getElementById('titleSize').addEventListener('input', (e) => {
  state.titleSize = Number(e.target.value);
  redraw();
});
document.querySelectorAll('[data-titlepos]').forEach((b) => {
  b.addEventListener('click', () => {
    state.titlePos = b.dataset.titlepos;
    markActive('[data-titlepos]', b);
    redraw();
  });
});
document.querySelectorAll('[data-titlecolor]').forEach((b) => {
  b.addEventListener('click', () => {
    state.titleColor = b.dataset.titlecolor;
    markActive('[data-titlecolor]', b);
    redraw();
  });
});
document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => {
    state.exportSize = b.dataset.size;
    markActive('[data-size]', b);
    document.getElementById('export').textContent = `Export PNG ${state.exportSize.replace('x', ' × ')}`;
    applyExportSize();
  });
});

// One-click preset: a finished-looking cover from the samples.
document.getElementById('quick').addEventListener('click', async () => {
  state.layout = 'trio';
  state.grade = 'sunset';
  state.title = 'Sunset Heist';
  state.titlePos = 'bottom';
  captionInput.value = 'Sunset Heist';
  document.querySelectorAll('[data-layout]').forEach((x) => x.classList.toggle('active', x.dataset.layout === 'trio'));
  document.querySelectorAll('[data-grade]').forEach((x) => x.classList.toggle('active', x.dataset.grade === 'sunset'));
  await setSlotPhoto(0, 'samples/pier.jpg', 'pier');
  await setSlotPhoto(1, 'samples/boulevard.jpg', 'boulevard');
  await setSlotPhoto(2, 'samples/pier.jpg', 'pier');
  selected = 0;
  statusEl.textContent = 'Quick cover ready — tweak it, then export.';
});

// Export: render the same state at the chosen post size and download the PNG.
async function exportPNG() {
  const [w, h] = state.exportSize.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${w}x${h}.png`;
  a.click();
  statusEl.textContent = `Saved vice-cover-${w}x${h}.png (${Math.round(blob.size / 1024)} KB).`;
  return { width: w, height: h, bytes: blob.size };
}
document.getElementById('export').addEventListener('click', exportPNG);

// Test handle: lets an automated check drive the export and read its size.
window.__app = { state, redraw, exportPNG };

// Fixed scenes for screenshots (?shot=cover / ?shot=editor).
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, async (q) => {
    if (q.get('layout') && LAYOUTS[q.get('layout')]) state.layout = q.get('layout');
    if (q.get('grade') && GRADES[q.get('grade')]) state.grade = q.get('grade');
    if (q.get('caption') !== null) {
      state.title = q.get('caption');
      captionInput.value = state.title;
    }
    if (q.get('titlepos') === 'top' || q.get('titlepos') === 'bottom') state.titlePos = q.get('titlepos');
    if (q.get('titlecolor')) state.titleColor = q.get('titlecolor');
    if (shot === 'cover') {
      canvas.width = Number(q.get('cw') || 1080);
      canvas.height = Number(q.get('ch') || 1080);
    }
    const photos = ['photo', 'photo2', 'photo3', 'photo4'];
    const n = panelCount();
    for (let i = 0; i < n; i++) {
      const name = q.get(photos[i]) || (i % 2 === 0 ? 'pier' : 'boulevard');
      await setSlotPhoto(i, `samples/${name}.jpg`, name);
    }
    selected = 0;
    redraw();
  }, redraw);
} else {
  // Load the bundled fonts before the first paint so the caption renders in
  // Bebas Neue, not the fallback.
  Promise.all([
    document.fonts.load('100px "Bebas Neue"'),
    document.fonts.load('100px "Archivo Black"'),
  ]).catch(() => {}).finally(redraw);
  redraw();
}
