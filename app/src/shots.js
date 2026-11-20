// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows the cover alone, at the size the query
// names (cw/ch). `photo`..`photo4` pick the sample for each panel, `tone`
// and `tone2`..`tone4` its photo filter, `caption` the words, `layout` and
// `grade` the look. window.__shotReady is set once the scene has painted
// with fonts loaded; a bad scene reports itself instead of hanging.
export async function playScene(scene, query, configure, paint) {
  if (scene === 'cover') document.body.classList.add('shot-cover');
  if (scene !== 'cover' && scene !== 'editor') {
    window.__shotError = `unknown shot: ${scene}`;
    window.__shotReady = true;
    return;
  }
  try {
    await configure(query);
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
  paint();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
