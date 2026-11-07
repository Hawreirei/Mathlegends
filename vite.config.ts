import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import idStrings from './src/data/i18n/id.json' with { type: 'json' };
import theme from './src/data/theme.json' with { type: 'json' };
import { cacheVersion, manifest, precacheList, serviceWorker } from './scripts/pwa.ts';

// GitHub Pages serves the site at /<repo-name>/ and the path is case-sensitive.
// The repo is Hawreirei/Mathlegends, so keep this as '/Mathlegends/'.
export const BASE = '/Mathlegends/';

/**
 * First load (#48): the fonts used to start downloading only after the game's JavaScript had
 * arrived and run. Preload links in index.html let the browser fetch them at the same time.
 * (Sprites are not preloaded: Phaser fetches images its own way, so a preloaded copy would be
 * downloaded twice.)
 */
function preloadFonts(): Plugin {
  return {
    name: 'mathlegends-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {});
        return files
          .filter((f) => f.endsWith('.woff2'))
          .map((f) => ({
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `${BASE}${f}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
            injectTo: 'head' as const,
          }));
      },
    },
  };
}

/** Every file in public/ (copied as-is into the build), relative to it. */
function publicFiles(dir = 'public'): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split('\\').join('/'));
    }
  };
  walk(dir);
  return out;
}

/**
 * Installable and offline (#51): writes manifest.webmanifest (name and description from the
 * Indonesian strings) and sw.js, the service worker that stores every file of this build on the
 * first visit. Rules and the worker's code: scripts/pwa.ts.
 */
function pwa(): Plugin {
  return {
    name: 'mathlegends-pwa',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: manifest({
          base: BASE,
          name: 'MathLegends',
          description: idStrings['menu.tagline'],
          lang: 'id',
          background: theme.colors.ink,
          theme: theme.colors.ink,
        }),
      });
      const files = precacheList([
        ...Object.keys(bundle),
        'manifest.webmanifest',
        ...publicFiles(),
      ]);
      const index = bundle['index.html'];
      const html = index && index.type === 'asset' ? String(index.source) : '';
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorker(BASE, files, cacheVersion(files, html)),
      });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [preloadFonts(), pwa()],
  build: {
    chunkSizeWarningLimit: 2000,
    // Phaser cannot decode Vite's inline (non-base64) SVG data URLs, so always emit SVGs as files.
    assetsInlineLimit: (file: string) => (file.endsWith('.svg') ? false : undefined),
    rollupOptions: {
      output: {
        // Phaser in its own file (#48): it rarely changes, so after an update returning players
        // download only the game's own code again.
        manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Coverage gate (#46): the game rules in src/systems must stay at least 80% covered.
    // `npm run test:coverage` (CI) fails below it; the report shows what is not covered.
    coverage: {
      provider: 'v8',
      include: ['src/systems/**/*.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
