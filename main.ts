// Vice Grid Cover Studio — the entry program (round 2, Node 22, stdlib only).
//
// The app is plain static files in this directory's app/ folder: an offline
// cover maker (index.html, ES modules, OFL fonts and sample photos — no
// library, no network at run time). This program is what hands the entry in:
// it stages a copy of app/ and screenshots/ under /output and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library (vendor/makefun-app.ts, shipped unchanged by the kit).
//
// The app turns a person's own photos into a nine-panel Vice City poster:
// seven switchable layouts, eight sunset/neon grades, per-panel crop and
// zoom, a halftone title block in Anton / Archivo Black / Pacifico (all OFL,
// under app/fonts/), and one-click PNG export at 1080 x 1080, 1080 x 1350
// and 1920 x 1080 — individually or all three at once. Its sample photos
// (app/samples/) were made for make.fun with an image model and are free to
// use; every decoration is drawn by the app's own canvas code.
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

// Caps matching the gate (reference/gate.json): text_max_bytes is the only
// one that changes the dossier's bytes; the rest refuse an entry the scorer
// would refuse anyway — more than 4 screenshots or one over 256 KiB, more
// than 993 files or 48 MiB under app/, or a path under app/ over 1000 bytes
// (app/ shares /output's own 1000-entry cap with screenshots/ and dossier).
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
