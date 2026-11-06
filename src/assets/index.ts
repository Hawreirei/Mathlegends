/**
 * Asset manifest (#14). Vite turns each file into a hashed URL under the Pages base path.
 * Every file here must be listed in docs/ASSETS.md (checked by tests/assets.test.ts).
 */
import heroes from '../data/heroes.json';

const files = import.meta.glob<string>('./sprites/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Sprite key (file name without .svg) -> URL. */
export const SPRITES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\/(.+)\.svg$/, '$1'), url]),
);

/** Display size in pixels for each sprite, from its SVG width/height. */
export const SPRITE_SIZES: Record<string, { width: number; height: number }> = {
  // One 96 x 96 token per hero in heroes.json (#32).
  ...Object.fromEntries(heroes.heroes.map((h) => [h.sprite, { width: 96, height: 96 }])),
  'tile-grass': { width: 64, height: 64 },
  'tile-lane': { width: 64, height: 64 },
  'tile-water': { width: 64, height: 64 },
  ...Object.fromEntries(
    (['blue', 'red'] as const).flatMap((t) => [
      [`minion-infantry-${t}`, { width: 56, height: 56 }],
      [`minion-lancer-${t}`, { width: 56, height: 56 }],
      [`minion-cannon-${t}`, { width: 72, height: 72 }],
      [`minion-super-${t}`, { width: 96, height: 96 }],
      [`tower-${t}`, { width: 96, height: 160 }],
      [`nexus-${t}`, { width: 160, height: 160 }],
    ]),
  ),
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((n) => [`badge-year-${n}`, { width: 96, height: 112 }]),
  ),
};
