/**
 * App icons for installing the game (#51): Nova's star token on the game's night blue, drawn as
 * SVG from src/data/theme.json and rendered to PNG with Playwright's Chromium (a dev dependency).
 * All original (docs/ASSETS.md). Writes public/icons/; run again after changing the theme:
 *
 *   npm run build:icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const theme = JSON.parse(readFileSync(join(root, 'src/data/theme.json'), 'utf8')) as {
  colors: Record<string, string>;
  teams: { blue: { light: string; main: string; dark: string } };
};
const c = theme.colors;
const blue = theme.teams.blue;

/**
 * The icon on a 512 x 512 canvas. `maskable`: Android may crop the icon to a circle or squircle,
 * so the token stays inside the central 80% "safe zone" and the background fills to the edges.
 */
export function iconSvg(maskable: boolean): string {
  const s = 512;
  const m = s / 2;
  const r = maskable ? 150 : 196;
  const k = r / 36; // the hero token is drawn at radius 36
  const sp = 22 * k;
  const q = sp * 0.18;
  const sparkle = `M${m} ${m - sp} Q${m + q} ${m - q} ${m + sp} ${m} Q${m + q} ${m + q} ${m} ${m + sp} Q${m - q} ${m + q} ${m - sp} ${m} Q${m - q} ${m - q} ${m} ${m - sp}Z`;
  const bg = maskable
    ? `<rect width="${s}" height="${s}" fill="${c.ink}"/>`
    : `<rect width="${s}" height="${s}" rx="112" fill="${c.ink}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${blue.light}"/><stop offset="1" stop-color="${blue.dark}"/></linearGradient></defs>
${bg}
<circle cx="${m}" cy="${m}" r="${r + 6 * k}" fill="${c.white}"/>
<circle cx="${m}" cy="${m}" r="${r}" fill="url(#g)"/>
<circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${c.gold}" stroke-width="${3 * k}"/>
<path d="${sparkle}" fill="${c.white}"/>
</svg>
`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'icon.svg'), iconSvg(false));
const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    const svg = iconSvg(icon.maskable).replace(
      'width="512" height="512"',
      `width="${icon.size}" height="${icon.size}"`,
    );
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg}</body></html>`,
    );
    writeFileSync(join(out, icon.file), await page.screenshot({ omitBackground: true }));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`${ICONS.length} icons + icon.svg written to public/icons/`);
