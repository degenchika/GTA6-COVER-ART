// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows the cover alone, at the size the query
// names (cw/ch). `photo`..`photo4` pick the sample for each slot, `filter`
// and `filter2`..`filter4` its photo filter, `title` the headline words,
// `layout` and `grade` the look, and `tagline` (+ tagx/tagy/tagsize/tagink)
// the second line of type. window.__shotReady is set once the scene has
// painted with fonts loaded; a bad scene reports itself instead of hanging.
export async function runScene(name, query, setup, repaint) {
  const known = name === 'cover' || name === 'editor';
  if (name === 'cover') document.body.classList.add('shot-cover');
  if (!known) {
    window.__shotError = `unknown shot: ${name}`;
    window.__shotReady = true;
    return;
  }
  try {
    await setup(query);
  } catch (err) {
    window.__shotError = String((err && err.message) || err);
    window.__shotReady = true;
    return;
  }
  try {
    await Promise.all([
      document.fonts.load('100px "Bebas Neue"'),
      document.fonts.load('100px "Archivo Black"'),
    ]);
  } catch { /* fall back to the system stack */ }
  repaint();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
