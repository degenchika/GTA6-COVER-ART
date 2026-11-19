// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows the cover alone, at the size the query
// names (cw/ch). `photo`, `photo2`, `photo3`, `photo4` pick the sample for
// each panel, `caption` the words, `layout` and `grade` the look.
// window.__shotReady is set once the scene has painted with fonts loaded.
export async function runShot(shot, query, setup, redraw) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await setup(query);
  try {
    await Promise.all([
      document.fonts.load('100px "Bebas Neue"'),
      document.fonts.load('100px "Archivo Black"'),
    ]);
  } catch (e) { /* fall back to the system stack */ }
  redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
