// Neon Coast Cover Studio — a gta6-cover-art-01 entry (Node 22, stdlib only).
//
// The app lives in this directory's app/ folder: plain static files that a
// desktop browser loads offline (app/index.html plus its ES modules, OFL fonts
// and sample photos; no library, no network request at run time). This program
// hands the entry in: it copies app/ and screenshots/ from beside this file
// into /output and writes /output/dossier.json, the summary the judge reads,
// using the vendored make.fun library (vendor/makefun-app.ts, unchanged).
//
// The app turns a person's own photos into a multi-panel GTA-style poster:
// three switchable layouts, a Vice City sunset/neon grade per panel, bold
// Anton + Pacifico lettering (both OFL, shipped under app/fonts/), and
// one-click PNG export at 1080 x 1080, 1080 x 1350 and 1920 x 1080.
// Its sample photos (app/samples/) were made for make.fun with an image model
// and are free to use; every decoration is drawn by the app's own code.
//
// Try it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps matching the gate (reference/gate.json): text_max_bytes is the only one
// that changes the dossier's bytes; the rest refuse an entry the scorer would
// refuse anyway — more than 4 screenshots or one over 256 KiB, more than 993
// files or 48 MiB under app/, or a path under app/ over 1000 bytes (app/
// shares /output's own 1000-entry cap with screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
