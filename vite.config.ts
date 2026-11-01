import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site at /<repo-name>/ and the path is case-sensitive.
// The repo is Hawreirei/Mathlegends, so keep this as '/Mathlegends/'.
export const BASE = '/Mathlegends/';

export default defineConfig({
  base: BASE,
  build: {
    chunkSizeWarningLimit: 2000,
    // Phaser cannot decode Vite's inline (non-base64) SVG data URLs, so always emit SVGs as files.
    assetsInlineLimit: (file: string) => (file.endsWith('.svg') ? false : undefined),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
