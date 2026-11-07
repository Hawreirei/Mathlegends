/**
 * Bundle size budget (#48): run after `npm run build` (CI does). Fails if the files a player
 * downloads on a first visit grow past the budget in docs/PERF.md.
 *
 *   node scripts/check-bundle.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Budgets in KB. Raw = on disk; gzip = what is sent over the network (GitHub Pages compresses). */
const BUDGET = {
  /** The issue's limit for the whole build. */
  totalRawKB: 5 * 1024,
  /** About 4.6 s to the Menu on slow 4G today; 700 KB keeps first load under 5 s on 4G. */
  firstLoadGzipKB: 700,
  /** The game's own code, which every update re-downloads (Phaser is a separate, cached file). */
  appJsGzipKB: 200,
};

const dir = join(import.meta.dirname, '..', 'dist');
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(dir);

const kb = (n: number) => Math.round(n / 102.4) / 10;
const gz = (p: string) => gzipSync(readFileSync(p)).length;
const raw = files.reduce((t, p) => t + statSync(p).size, 0);
// First visit: the page, scripts, styles, the woff2 fonts and the sprites (not the .woff fallbacks).
const firstLoad = files.filter((p) => /\.(html|js|css|woff2|svg)$/.test(p));
const firstGzip = firstLoad.reduce((t, p) => t + gz(p), 0);
const appJs = files.filter((p) => /assets\/index-.*\.js$/.test(p));
const appGzip = appJs.reduce((t, p) => t + gz(p), 0);

const rows: [string, number, number][] = [
  ['Whole build (raw)', kb(raw), BUDGET.totalRawKB],
  ['First visit download (gzip)', kb(firstGzip), BUDGET.firstLoadGzipKB],
  ['Game code, re-downloaded after an update (gzip)', kb(appGzip), BUDGET.appJsGzipKB],
];
let failed = false;
for (const [name, value, budget] of rows) {
  const ok = value <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'OK  ' : 'OVER'} ${name}: ${value} KB (budget ${budget} KB)`);
}
if (failed) {
  console.error('Bundle over budget: see docs/PERF.md.');
  process.exit(1);
}
