/**
 * Draws the placeholder sprites (#14) as SVG from src/data/theme.json.
 * All art is original, made by this script for MathLegends (see docs/ASSETS.md).
 *
 *   npm run build:sprites
 *
 * tests/assets.test.ts fails if src/assets/sprites/ is out of date with this script.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type themeJson from '../src/data/theme.json';
import type heroesJson from '../src/data/heroes.json';

type Team = 'blue' | 'red';
type Theme = typeof themeJson;
type Emblem = 'sparkle' | 'flower' | 'moon' | 'leaf';
/** The part of heroes.json the sprites need (a test passes extra heroes). */
export interface HeroLooks {
  heroes: { sprite: string; look: { color: string; emblem: string } }[];
}

const root = fileURLToPath(new URL('..', import.meta.url));
export const SPRITE_DIR = join(root, 'src/assets/sprites');

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${body}\n</svg>\n`;

/** A 4-point sparkle, centred at (cx, cy). */
const sparkle = (cx: number, cy: number, r: number, fill: string) =>
  `<path d="M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r}Z" fill="${fill}"/>`;

/** A 6-petal flower with a gold centre, centred at (cx, cy). */
const flower = (cx: number, cy: number, r: number, fill: string, centre: string) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    const x = (cx + Math.cos(a) * r * 0.55).toFixed(1);
    const y = (cy + Math.sin(a) * r * 0.55).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${(r * 0.3).toFixed(1)}" fill="${fill}"/>`;
  }).join('') + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.3).toFixed(1)}" fill="${centre}"/>`;

/** A crescent moon, centred at (cx, cy). */
const moon = (cx: number, cy: number, r: number, fill: string, bg: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/><circle cx="${cx + r * 0.45}" cy="${cy - r * 0.25}" r="${r * 0.85}" fill="${bg}"/>`;

/** A leaf with a centre vein, centred at (cx, cy). */
const leaf = (cx: number, cy: number, r: number, fill: string, vein: string) =>
  `<path d="M${cx - r} ${cy + r} Q${cx - r} ${cy - r} ${cx + r} ${cy - r} Q${cx + r} ${cy + r} ${cx - r} ${cy + r}Z" fill="${fill}"/><path d="M${cx - r * 0.8} ${cy + r * 0.8} L${cx + r * 0.6} ${cy - r * 0.6}" stroke="${vein}" stroke-width="3" stroke-linecap="round"/>`;

function heroToken(t: Theme, team: Team, emblem: Emblem): string {
  const c = t.teams[team];
  const s = 96;
  const body = [
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient></defs>`,
    `<ellipse cx="48" cy="88" rx="30" ry="6" fill="${t.colors.ink}" opacity="0.25"/>`,
    `<circle cx="48" cy="46" r="42" fill="${t.colors.white}"/>`,
    `<circle cx="48" cy="46" r="36" fill="url(#g)"/>`,
    `<circle cx="48" cy="46" r="36" fill="none" stroke="${t.colors.gold}" stroke-width="3"/>`,
    {
      sparkle: () => sparkle(48, 46, 22, t.colors.white),
      flower: () => flower(48, 46, 26, t.colors.white, t.colors.gold),
      moon: () => moon(46, 46, 18, t.colors.white, c.main),
      leaf: () => leaf(48, 46, 16, t.colors.white, c.dark),
    }[emblem](),
  ].join('\n');
  return svg(s, s, body);
}

/** Minions: round tokens marked with + (infantry), × (lancer), ÷ (cannon, bigger). */
function minion(t: Theme, team: Team, kind: 'infantry' | 'lancer' | 'cannon'): string {
  const c = t.teams[team];
  const s = kind === 'cannon' ? 72 : 56;
  const m = s / 2;
  const r = m - 6;
  const w = t.colors.white;
  const k = r * 0.5;
  const symbol =
    kind === 'infantry'
      ? `<path d="M${m - k} ${m} H${m + k} M${m} ${m - k} V${m + k}" stroke="${w}" stroke-width="${r * 0.28}" stroke-linecap="round"/>`
      : kind === 'lancer'
        ? `<path d="M${m - k * 0.75} ${m - k * 0.75} L${m + k * 0.75} ${m + k * 0.75} M${m + k * 0.75} ${m - k * 0.75} L${m - k * 0.75} ${m + k * 0.75}" stroke="${w}" stroke-width="${r * 0.28}" stroke-linecap="round"/>`
        : `<path d="M${m - k} ${m} H${m + k}" stroke="${w}" stroke-width="${r * 0.24}" stroke-linecap="round"/><circle cx="${m}" cy="${m - k * 0.6}" r="${r * 0.14}" fill="${w}"/><circle cx="${m}" cy="${m + k * 0.6}" r="${r * 0.14}" fill="${w}"/>`;
  const body = [
    `<circle cx="${m}" cy="${m}" r="${r + 3}" fill="${c.dark}"/>`,
    `<circle cx="${m}" cy="${m - 1}" r="${r}" fill="${c.main}"/>`,
    symbol,
  ].join('\n');
  return svg(s, s, body);
}

/**
 * Super minion (#69): a bigger ÷ token with a gold ring and a three-point crown, so it differs
 * from the Cannon by shape and size, not only colour.
 */
function superMinion(t: Theme, team: Team): string {
  const c = t.teams[team];
  const s = 96;
  const m = s / 2;
  const r = 34;
  const w = t.colors.white;
  const g = t.colors.gold;
  const k = r * 0.5;
  const body = [
    `<path d="M${m - 22} 22 L${m - 22} 6 L${m - 11} 15 L${m} 3 L${m + 11} 15 L${m + 22} 6 L${m + 22} 22 Z" fill="${g}" stroke="${c.dark}" stroke-width="3" stroke-linejoin="round"/>`,
    `<circle cx="${m}" cy="${m + 6}" r="${r + 6}" fill="${c.dark}"/>`,
    `<circle cx="${m}" cy="${m + 6}" r="${r + 2}" fill="${g}"/>`,
    `<circle cx="${m}" cy="${m + 5}" r="${r - 2}" fill="${c.main}"/>`,
    `<path d="M${m - k} ${m + 5} H${m + k}" stroke="${w}" stroke-width="${r * 0.24}" stroke-linecap="round"/>`,
    `<circle cx="${m}" cy="${m + 5 - k * 0.6}" r="${r * 0.14}" fill="${w}"/>`,
    `<circle cx="${m}" cy="${m + 5 + k * 0.6}" r="${r * 0.14}" fill="${w}"/>`,
  ].join('\n');
  return svg(s, s, body);
}

/** Tower: arched gateway like the prototype; blue has a pointed roof, red a flat crown (shape differs, not only colour). */
function tower(t: Theme, team: Team): string {
  const c = t.teams[team];
  const roof =
    team === 'blue'
      ? `<path d="M48 4 L76 40 H20 Z" fill="${c.dark}"/>`
      : `<path d="M20 40 V18 L32 28 L48 12 L64 28 L76 18 V40 Z" fill="${c.dark}"/>`;
  const body = [
    `<ellipse cx="48" cy="150" rx="40" ry="8" fill="${t.colors.ink}" opacity="0.25"/>`,
    roof,
    `<path d="M16 150 V60 Q16 36 48 36 Q80 36 80 60 V150 Z" fill="${t.colors.paper}"/>`,
    `<path d="M24 146 V64 Q24 44 48 44 Q72 44 72 64 V146 Z" fill="${c.main}"/>`,
    `<circle cx="48" cy="74" r="9" fill="${t.colors.gold}"/>`,
    `<circle cx="48" cy="74" r="15" fill="${t.colors.gold}" opacity="0.3"/>`,
  ].join('\n');
  return svg(96, 160, body);
}

/** Nexus: a big crystal on a base. */
function nexus(t: Theme, team: Team): string {
  const c = t.teams[team];
  const body = [
    `<ellipse cx="80" cy="146" rx="62" ry="10" fill="${t.colors.ink}" opacity="0.25"/>`,
    `<path d="M24 146 L36 118 H124 L136 146 Z" fill="${t.colors.paper}"/>`,
    `<path d="M80 10 L118 64 L80 128 L42 64 Z" fill="${c.main}"/>`,
    `<path d="M80 10 L118 64 L80 64 Z" fill="${c.light}"/>`,
    `<path d="M80 128 L42 64 L80 64 Z" fill="${c.dark}"/>`,
    `<path d="M80 10 L118 64 L80 128 L42 64 Z" fill="none" stroke="${t.colors.white}" stroke-width="4" stroke-linejoin="round"/>`,
    sparkle(80, 64, 14, t.colors.gold),
  ].join('\n');
  return svg(160, 160, body);
}

function tile(kind: 'grass' | 'lane' | 'water', t: Theme): string {
  const m = t.map;
  const body =
    kind === 'grass'
      ? [
          `<rect width="64" height="64" fill="${m.grass}"/>`,
          `<circle cx="14" cy="18" r="3" fill="${m.grassDark}"/>`,
          `<circle cx="46" cy="40" r="3" fill="${m.grassDark}"/>`,
          `<circle cx="30" cy="54" r="2" fill="${m.grassDark}"/>`,
        ]
      : kind === 'lane'
        ? [
            `<rect width="64" height="64" fill="${m.lane}"/>`,
            `<path d="M0 64 L32 0 H40 L8 64 Z M32 64 L64 0 V12 L38 64 Z" fill="${m.laneDark}" opacity="0.5"/>`,
          ]
        : [
            `<rect width="64" height="64" fill="${m.water}"/>`,
            `<path d="M6 22 Q14 16 22 22 T38 22 M28 44 Q36 38 44 44 T60 44" stroke="${m.waterDark}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
          ];
  return svg(64, 64, body.join('\n'));
}

/**
 * Rank badge (#42): a shield with the Year number and that many sparkles in an arc, filled from
 * theme.json badges.fills (lighter to darker as Years rise). Number, sparkle count and lightness
 * all differ, so the Years are told apart without relying on colour.
 */
function badge(t: Theme, tier: number): string {
  const fill = t.badges.fills[tier - 1]!;
  // Arc over the number: wider for more sparkles, smaller sparkles when there are many.
  const spread = Math.min(2.7, 0.6 * (tier - 1));
  const size = tier > 4 ? 5 : 6;
  const sparkles = Array.from({ length: tier }, (_, i) => {
    const a = -Math.PI / 2 + (tier === 1 ? 0 : (i / (tier - 1) - 0.5) * spread);
    return sparkle(48 + Math.cos(a) * 30, 58 + Math.sin(a) * 30, size, t.colors.gold);
  });
  const body = [
    `<path d="M48 4 L88 18 V56 Q88 92 48 108 Q8 92 8 56 V18 Z" fill="${t.colors.gold}"/>`,
    `<path d="M48 12 L80 23 V56 Q80 85 48 99 Q16 85 16 56 V23 Z" fill="${fill}"/>`,
    ...sparkles,
    `<text x="48" y="84" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="40" fill="${t.colors.white}" stroke="${t.colors.ink}" stroke-width="5" paint-order="stroke">${tier}</text>`,
  ].join('\n');
  return svg(96, 112, body);
}

/** Every sprite: file name (without .svg) -> SVG text. */
export function renderSprites(theme: Theme, heroes: HeroLooks = readHeroes()): Map<string, string> {
  const out = new Map<string, string>();
  // One token per hero in heroes.json (#32): adding a hero needs no code.
  for (const h of heroes.heroes)
    out.set(h.sprite, heroToken(theme, h.look.color as Team, h.look.emblem as Emblem));
  for (const team of ['blue', 'red'] as const) {
    for (const kind of ['infantry', 'lancer', 'cannon'] as const)
      out.set(`minion-${kind}-${team}`, minion(theme, team, kind));
    out.set(`minion-super-${team}`, superMinion(theme, team));
    out.set(`tower-${team}`, tower(theme, team));
    out.set(`nexus-${team}`, nexus(theme, team));
  }
  for (const kind of ['grass', 'lane', 'water'] as const)
    out.set(`tile-${kind}`, tile(kind, theme));
  for (let tier = 1; tier <= 6; tier++) out.set(`badge-year-${tier}`, badge(theme, tier));
  return out;
}

export const readHeroes = (): typeof heroesJson =>
  JSON.parse(readFileSync(join(root, 'src/data/heroes.json'), 'utf8')) as typeof heroesJson;

export const readTheme = (): Theme =>
  JSON.parse(readFileSync(join(root, 'src/data/theme.json'), 'utf8')) as Theme;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPRITE_DIR, { recursive: true });
  const sprites = renderSprites(readTheme());
  for (const [name, text] of sprites) writeFileSync(join(SPRITE_DIR, `${name}.svg`), text);
  console.log(`${sprites.size} sprites written to src/assets/sprites/`);
}
