// Vice Cover Studio — page wiring, third build (round 5).
//
// Pick photos, arrange slots, filter each photo, set the headline and a
// movable tagline, pick a mood, export a PNG. A `?shot=` query arranges a
// fixed scene for a screenshot instead (see ./shots.js). Growing to a
// layout with more slots fills its empty slots from the samples, and the
// preview canvas follows the chosen export size. Keys 1-4 pick a slot;
// double-click a slot to reset its crop.
//
// The controls are one declarative table: each row names a data attribute,
// how to read the poster's current value for it, and what setting it does.
// Wiring, active-marks and syncing all run off that one table, so a new
// control row is one more row — no more wiring code.
import { drawCover, computeSlots, GRID_LAYOUTS, MOODS, FILTERS } from './cover.js';
import { runScene } from './shots.js';

const stage = document.getElementById('stage');
const titleText = document.getElementById('titleText');
const noteEl = document.getElementById('note');
const zoomRange = document.getElementById('zoomRange');
const slotLabel = document.getElementById('slotLabel');
const saveBtn = document.getElementById('saveBtn');

function blankSlot() {
  return { img: null, name: null, zoom: 1, ox: 0, oy: 0, filter: 'none' };
}

const poster = {
  arrange: 'trio',
  mood: 'sunset',
  title: 'Sunset Heist',
  titleSize: 1,
  titleAt: 'bottom',
  titleInk: '#ffffff',
  exportSize: '1080x1080',
  tagline: { text: '', x: 0.5, y: 0.1, size: 0.045, ink: '#ffffff' },
  slots: [blankSlot(), blankSlot(), blankSlot(), blankSlot()],
};
let selected = 0;

function slotTotal() {
  return (GRID_LAYOUTS[poster.arrange] || GRID_LAYOUTS.hero).spans.length;
}

// Repaint the poster, then outline the picked slot and sync every control
// with the poster's current state. The pink dashed outline is preview-only
// and never lands on an export.
function redraw() {
  drawCover(stage, poster);
  outlineSelection();
  syncPanelUI();
}

function outlineSelection() {
  if (document.body.classList.contains('shot-cover')) return;
  if (selected >= slotTotal()) return;
  const ctx = stage.getContext('2d');
  const box = computeSlots(poster.arrange, stage.width, stage.height)[selected];
  ctx.save();
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 8]);
  ctx.strokeRect(box.x + 3, box.y + 3, box.w - 6, box.h - 6);
  ctx.restore();
}

function syncPanelUI() {
  markGroups();
  const slot = poster.slots[selected];
  zoomRange.value = slot.zoom;
  slotLabel.textContent = `Panel ${selected + 1} — ${slot.name || 'no photo yet'}`;
}

// One row per button group: the data attribute, the poster's current value
// for it, and what happens when a button in the group is pressed.
const CONTROL_GROUPS = [
  { key: 'slot', read: () => String(selected), set: (v) => { selected = Number(v); } },
  { key: 'arrange', read: () => poster.arrange, set: (v) => { poster.arrange = v; topUpSlots(); if (selected >= slotTotal()) selected = 0; } },
  { key: 'mood', read: () => poster.mood, set: (v) => { poster.mood = v; } },
  { key: 'title-at', read: () => poster.titleAt, set: (v) => { poster.titleAt = v; } },
  { key: 'title-ink', read: () => poster.titleInk, set: (v) => { poster.titleInk = v; } },
  { key: 'filter', read: () => poster.slots[selected].filter, set: (v) => { poster.slots[selected].filter = v; } },
  { key: 'tag-ink', read: () => poster.tagline.ink, set: (v) => { poster.tagline.ink = v; } },
  { key: 'export', read: () => poster.exportSize, set: (v) => { poster.exportSize = v; saveBtn.textContent = `Export PNG ${v.replace('x', ' × ')}`; matchPreview(); } },
];

function markGroups() {
  for (const group of CONTROL_GROUPS) {
    document.querySelectorAll(`[data-${group.key}]`).forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute(`data-${group.key}`) === group.read());
    });
  }
}

for (const group of CONTROL_GROUPS) {
  document.querySelectorAll(`[data-${group.key}]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      group.set(btn.getAttribute(`data-${group.key}`));
      redraw();
    });
  });
}

export function loadPicture(url) {
  return new Promise((resolve, reject) => {
    const pic = new Image();
    pic.onload = () => resolve(pic);
    pic.onerror = reject;
    pic.src = url;
  });
}

async function placePhoto(i, url, name) {
  const pic = await loadPicture(url);
  const keepFilter = poster.slots[i].filter;
  poster.slots[i] = { img: pic, name, zoom: 1, ox: 0, oy: 0, filter: keepFilter };
  redraw();
}

function resetCrop(i) {
  const slot = poster.slots[i];
  slot.zoom = 1;
  slot.ox = 0;
  slot.oy = 0;
  redraw();
}

// Photo sources: the two free samples, or the person's own file.
document.getElementById('pickPier').addEventListener('click', () => {
  placePhoto(selected, 'samples/pier.jpg', 'pier');
});
document.getElementById('pickBoulevard').addEventListener('click', () => {
  placePhoto(selected, 'samples/boulevard.jpg', 'boulevard');
});
document.getElementById('filePick').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const pic = await loadPicture(URL.createObjectURL(file));
  poster.slots[selected] = { img: pic, name: file.name, zoom: 1, ox: 0, oy: 0, filter: poster.slots[selected].filter };
  redraw();
  noteEl.textContent = `Loaded ${file.name} into panel ${selected + 1}.`;
});

// Picking a slot and cropping it: click a slot to pick it, drag to pan,
// scroll to zoom, double-click to reset the crop, keys 1-4 to pick a slot.
function stagePoint(e) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * stage.width,
    y: ((e.clientY - rect.top) / rect.height) * stage.height,
  };
}
function slotIndexAt(p) {
  const boxes = computeSlots(poster.arrange, stage.width, stage.height);
  return boxes.findIndex((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
}
let drag = null;
stage.addEventListener('pointerdown', (e) => {
  const hit = slotIndexAt(stagePoint(e));
  if (hit < 0) return;
  selected = hit;
  const slot = poster.slots[selected];
  const p = stagePoint(e);
  drag = { startX: p.x, startY: p.y, baseX: slot.ox, baseY: slot.oy, moved: false };
  stage.setPointerCapture(e.pointerId);
  redraw();
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = stagePoint(e);
  const shiftX = p.x - drag.startX;
  const shiftY = p.y - drag.startY;
  if (Math.abs(shiftX) + Math.abs(shiftY) > 3) drag.moved = true;
  const slot = poster.slots[selected];
  slot.ox = drag.baseX + shiftX;
  slot.oy = drag.baseY + shiftY;
  redraw();
});
stage.addEventListener('pointerup', () => { drag = null; });
stage.addEventListener('dblclick', () => resetCrop(selected));
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = poster.slots[selected];
  const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
  slot.zoom = Math.min(4, Math.max(1, slot.zoom * factor));
  redraw();
}, { passive: false });
document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.matches('input, textarea')) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 4 && n - 1 < slotTotal()) {
    selected = n - 1;
    redraw();
  }
});
zoomRange.addEventListener('input', () => {
  poster.slots[selected].zoom = Number(zoomRange.value);
  redraw();
});
document.getElementById('cropReset').addEventListener('click', () => resetCrop(selected));

// When a layout grows, fill its empty slots from the samples so the cover
// never shows a bare "ADD PHOTO" slot in the middle of a finished cover.
async function topUpSlots() {
  const total = slotTotal();
  for (let i = 0; i < total; i++) {
    if (poster.slots[i].img) continue;
    const name = i % 2 === 0 ? 'pier' : 'boulevard';
    await placePhoto(i, `samples/${name}.jpg`, name);
  }
}

// The preview canvas follows the chosen export size, so what you see is
// the shape you will get.
function matchPreview() {
  const [w, h] = poster.exportSize.split('x').map(Number);
  stage.width = w;
  stage.height = h;
  redraw();
}

// One-click preset: a finished-looking cover from the samples.
document.getElementById('quickCover').addEventListener('click', async () => {
  poster.arrange = 'trio';
  poster.mood = 'sunset';
  poster.title = 'Sunset Heist';
  poster.titleAt = 'bottom';
  titleText.value = 'Sunset Heist';
  await placePhoto(0, 'samples/pier.jpg', 'pier');
  await placePhoto(1, 'samples/boulevard.jpg', 'boulevard');
  await placePhoto(2, 'samples/pier.jpg', 'pier');
  selected = 0;
  noteEl.textContent = 'Quick cover ready — tweak it, then export.';
});

// Export: render the same poster at the chosen post size and download the PNG.
async function savePNG() {
  const [w, h] = poster.exportSize.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, poster);
  const blob = await new Promise((resolve, reject) => {
    off.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas did not produce a PNG'))), 'image/png');
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${w}x${h}.png`;
  a.click();
  noteEl.textContent = `Saved vice-cover-${w}x${h}.png (${Math.round(blob.size / 1024)} KB).`;
  return { width: w, height: h, bytes: blob.size };
}
saveBtn.addEventListener('click', savePNG);

// Headline inputs.
titleText.addEventListener('input', () => {
  poster.title = titleText.value;
  redraw();
});
document.getElementById('titleSizeRange').addEventListener('input', (e) => {
  poster.titleSize = Number(e.target.value);
  redraw();
});

// Tagline inputs: the words, where they sit, how big they are. The tagline
// is a second line of type that lives on the cover and ships in the export.
document.getElementById('tagText').addEventListener('input', (e) => {
  poster.tagline.text = e.target.value;
  redraw();
});
document.getElementById('tagX').addEventListener('input', (e) => {
  poster.tagline.x = Number(e.target.value) / 100;
  redraw();
});
document.getElementById('tagY').addEventListener('input', (e) => {
  poster.tagline.y = Number(e.target.value) / 100;
  redraw();
});
document.getElementById('tagSize').addEventListener('input', (e) => {
  poster.tagline.size = Number(e.target.value) / 100;
  redraw();
});

// Test handle: lets an automated check drive the export and read its size.
window.__app = { poster, redraw, savePNG, placePhoto, getSelected: () => selected };

// Fixed scenes for screenshots (?shot=cover / ?shot=editor).
const query = new URLSearchParams(location.search);
const shotName = query.get('shot');
if (shotName) {
  runScene(shotName, query, async (q) => {
    if (q.get('layout') && GRID_LAYOUTS[q.get('layout')]) poster.arrange = q.get('layout');
    if (q.get('grade') && MOODS[q.get('grade')]) poster.mood = q.get('grade');
    if (q.get('title') !== null) {
      poster.title = q.get('title');
      titleText.value = poster.title;
    }
    if (q.get('title-at') === 'top' || q.get('title-at') === 'bottom') poster.titleAt = q.get('title-at');
    if (q.get('title-ink')) poster.titleInk = q.get('title-ink');
    if (q.get('tagline') !== null) {
      poster.tagline.text = q.get('tagline');
      const tagTextEl = document.getElementById('tagText');
      if (tagTextEl) tagTextEl.value = poster.tagline.text;
    }
    if (q.get('tagx') !== null) poster.tagline.x = Number(q.get('tagx')) / 100;
    if (q.get('tagy') !== null) poster.tagline.y = Number(q.get('tagy')) / 100;
    if (q.get('tagsize') !== null) poster.tagline.size = Number(q.get('tagsize')) / 100;
    if (q.get('tagink')) poster.tagline.ink = q.get('tagink');
    if (shotName === 'cover') {
      stage.width = Number(q.get('cw') || 1080);
      stage.height = Number(q.get('ch') || 1080);
    }
    const keys = ['photo', 'photo2', 'photo3', 'photo4'];
    const total = slotTotal();
    for (let i = 0; i < total; i++) {
      const name = q.get(keys[i]) || (i % 2 === 0 ? 'pier' : 'boulevard');
      await placePhoto(i, `samples/${name}.jpg`, name);
      const filter = q.get(`filter${i + 1}`) || q.get('filter');
      if (filter && FILTERS[filter]) poster.slots[i].filter = filter;
    }
    selected = 0;
    redraw();
  }, redraw);
} else {
  // Load the bundled fonts before the first paint so the type renders in
  // Bebas Neue / Archivo Black, not the fallback stack.
  Promise.all([
    document.fonts.load('100px "Bebas Neue"'),
    document.fonts.load('100px "Archivo Black"'),
  ]).catch(() => {}).finally(redraw);
  redraw();
}
