// Vice Cover Studio — the entrypoint for gta6-cover-art-01 (Node 22,
// standard library only).
//
// The app lives in app/ beside this file: plain static files a desktop
// browser loads offline, no library and no network request. This program
// hands it in: it copies app/ and screenshots/ into the grader's output
// directory and writes /output/dossier.json with the vendored make.fun
// library, the summary the judge reads. It writes the same bytes on every
// run and touches nothing outside the repository and the output directory.
// Before the dossier is written it refuses a broken entry: every screenshot
// must exist and fit the scorer's 256 KiB cap.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from a clean output directory: a failed earlier run must never
// leave stale files behind for the dossier to pick up.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'app'), join(outDir, 'app'), { recursive: true });

const shotsOut = join(outDir, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), shotsOut, { recursive: true });
}

// Refuse a broken entry before the dossier is written: the app must be
// there, and every screenshot must exist and fit the scorer's caps
// (at most 4 screenshots, each at most 256 KiB).
const SCREENSHOT_MAX_BYTES = 262144;
const SCREENSHOT_MAX_COUNT = 4;
if (!existsSync(join(root, 'app'))) {
  throw new Error('app/ is missing from the repository');
}
const shotsDir = join(root, 'screenshots');
if (!existsSync(shotsDir)) {
  throw new Error('screenshots/ is missing from the repository');
}
const shotFiles = readdirSync(shotsDir).filter((f) => !f.startsWith('.'));
if (shotFiles.length === 0) {
  throw new Error('screenshots/ is empty');
}
if (shotFiles.length > SCREENSHOT_MAX_COUNT) {
  throw new Error(`too many screenshots: ${shotFiles.length} (max ${SCREENSHOT_MAX_COUNT})`);
}
for (const f of shotFiles) {
  const bytes = statSync(join(shotsDir, f)).size;
  if (bytes > SCREENSHOT_MAX_BYTES) {
    throw new Error(`screenshot ${f} is ${bytes} bytes, over the ${SCREENSHOT_MAX_BYTES} cap`);
  }
}

// All screenshots together must stay under 1,000,000 bytes — tighter than
// four files at the per-file cap, so this check can actually bite when the
// set as a whole gets too heavy.
const SCREENSHOTS_TOTAL_MAX_BYTES = 1000000;
const shotsTotalBytes = shotFiles.reduce((sum, f) => sum + statSync(join(shotsDir, f)).size, 0);
if (shotsTotalBytes > SCREENSHOTS_TOTAL_MAX_BYTES) {
  throw new Error(`screenshots/ total ${shotsTotalBytes} bytes, over the ${SCREENSHOTS_TOTAL_MAX_BYTES} cap`);
}

// A screenshot must actually be a JPEG, not a renamed file: refuse one
// whose first bytes are not the JPEG magic (FF D8 FF).
for (const f of shotFiles) {
  const head = readFileSync(join(shotsDir, f)).subarray(0, 3);
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
    throw new Error(`screenshot ${f} is not a JPEG file`);
  }
}

// Every shot shots.json declares must have its file on disk, so a renamed
// shot can never ship a cover the dossier does not show.
let declared: { name?: unknown }[];
try {
  declared = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
} catch {
  throw new Error('shots.json is missing or not valid JSON');
}
for (const shot of declared) {
  if (typeof shot.name !== 'string' || !existsSync(join(shotsDir, shot.name))) {
    throw new Error(`shots.json declares ${String(shot.name)} but it is not in screenshots/`);
  }
}

// The app itself must fit the scorer's caps too: at most 993 files and
// 48 MiB in all, so a stray build artefact can never ship inside the app.
// No file under app/ may be empty either: a zero-byte font or script would
// load as nothing and break the app in the grader's browser.
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648;
let appFiles = 0;
let appBytes = 0;
const emptyAppFiles = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.isFile()) {
      appFiles += 1;
      const size = statSync(p).size;
      appBytes += size;
      if (size === 0) emptyAppFiles.push(p);
    }
  }
};
walk(join(root, 'app'));
if (emptyAppFiles.length > 0) {
  throw new Error(`app/ has ${emptyAppFiles.length} empty file(s): ${emptyAppFiles.join(', ')}`);
}
if (appFiles > APP_MAX_FILES) {
  throw new Error(`app/ has ${appFiles} files, over the ${APP_MAX_FILES} cap`);
}
if (appBytes > APP_MAX_BYTES) {
  throw new Error(`app/ is ${appBytes} bytes, over the ${APP_MAX_BYTES} cap`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB
// of app files, in all, or a path under app/ over 1000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// The dossier on disk must be the one we just wrote: read it back, parse
// it, and refuse it when its image list does not match the screenshots we
// shipped or its cover summary is empty.
const written = JSON.parse(readFileSync(join(outDir, 'dossier.json'), 'utf8')) as Record<string, unknown>;
if (!Array.isArray(written.images) || written.images.length !== shotFiles.length) {
  throw new Error(`dossier.json lists ${Array.isArray(written.images) ? written.images.length : 0} images, but screenshots/ has ${shotFiles.length}`);
}
if (typeof written.cover !== 'number' || written.cover < 0 || written.cover >= written.images.length) {
  throw new Error(`dossier.json cover index ${String(written.cover)} does not point at one of its ${written.images.length} images`);
}
