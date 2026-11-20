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
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648;
let appFiles = 0;
let appBytes = 0;
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.isFile()) {
      appFiles += 1;
      appBytes += statSync(p).size;
    }
  }
};
walk(join(root, 'app'));
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

// The dossier the judge reads must carry the cover summary, the image
// list, the schema and the text: refuse a dossier that lost a section.
// (buildDossier returns canonical JSON bytes, not a string.)
const dossierJson = JSON.parse(new TextDecoder().decode(dossier)) as Record<string, unknown>;
for (const key of ['cover', 'images', 'schema', 'text']) {
  if (!(key in dossierJson)) {
    throw new Error(`dossier.json is missing its ${key} section`);
  }
}
