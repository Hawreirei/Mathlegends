import { defineConfig, type Plugin } from 'vitest/config';

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

export default defineConfig({
  base: BASE,
  plugins: [preloadFonts()],
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
