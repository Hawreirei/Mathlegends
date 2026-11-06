import { describe, expect, it } from 'vitest';
import assetsDoc from '../docs/ASSETS.md?raw';
import heroes from '../src/data/heroes.json';
import ranks from '../src/data/ranks.json';
import theme from '../src/data/theme.json';
import { SPRITES, SPRITE_SIZES } from '../src/assets';
import { readTheme, renderSprites } from '../scripts/build-sprites';

const files = import.meta.glob<string>('../src/assets/sprites/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const committed = new Map(
  Object.entries(files).map(([p, text]) => [p.replace(/^.*\/(.+)\.svg$/, '$1'), text]),
);

describe('placeholder sprites (#14)', () => {
  it('include the full set: hero, bot hero, 3 minions + super minion per team, tower, Nexus, map tiles', () => {
    const needed = [...heroes.heroes.map((h) => h.sprite), 'tile-grass', 'tile-lane', 'tile-water'];
    for (const t of ['blue', 'red'])
      needed.push(
        `minion-infantry-${t}`,
        `minion-lancer-${t}`,
        `minion-cannon-${t}`,
        `minion-super-${t}`,
        `tower-${t}`,
        `nexus-${t}`,
      );
    for (const k of needed) expect(SPRITES[k], k).toBeTruthy();
  });

  it('include a badge for every rank tier in ranks.json', () => {
    for (const t of ranks.tiers) expect(SPRITES[t.badge], t.badge).toBeTruthy();
  });

  it('have a display size that matches the SVG', () => {
    for (const [key, text] of committed) {
      const size = SPRITE_SIZES[key];
      expect(size, key).toBeTruthy();
      expect(text).toContain(`width="${size!.width}" height="${size!.height}"`);
    }
  });

  it('are up to date with scripts/build-sprites.ts (run npm run build:sprites)', () => {
    const fresh = renderSprites(readTheme());
    expect([...committed.keys()].sort()).toEqual([...fresh.keys()].sort());
    for (const [k, text] of fresh) expect(committed.get(k), k).toBe(text);
  });

  it('are all listed in docs/ASSETS.md with a source and license', () => {
    for (const key of committed.keys()) {
      const line = assetsDoc
        .split('\n')
        .find(
          (l) =>
            l.includes(`${key}.svg`) ||
            l.includes(key.replace(/-\d$/, '-1') + '.svg') ||
            (key.startsWith('hero-') && l.includes('hero-<id>.svg')),
        );
      expect(line, `${key}.svg missing from docs/ASSETS.md`).toBeTruthy();
      expect(line).toMatch(/MIT|CC0|OFL/);
    }
  });
});

describe('theme.json', () => {
  it('uses #rrggbb colours everywhere', () => {
    const all = [
      ...Object.values(theme.colors),
      ...Object.values(theme.teams).flatMap(Object.values),
      ...Object.values(theme.map),
    ];
    for (const c of all) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('names the self-hosted fonts recorded in docs/ASSETS.md', () => {
    expect(assetsDoc).toContain(theme.fonts.display);
    expect(assetsDoc).toContain(theme.fonts.body);
  });
});
