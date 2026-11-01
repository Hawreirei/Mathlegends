import { describe, expect, it } from 'vitest';
import mapJson from '../src/data/map.json';
import {
  computeHudLayout,
  worldToMinimap,
  type HudLayout,
  type Rect,
} from '../src/systems/hudLayout';
import { logicalSize } from '../src/systems/layout';
import type { MapConfig } from '../src/systems/map';

const world = (mapJson as MapConfig).world;
const noSafe = { top: 0, right: 0, bottom: 0, left: 0 };
const notch = { top: 90, right: 0, bottom: 64, left: 0 };
const notchLandscape = { top: 0, right: 90, bottom: 40, left: 90 };

const SCREENS: [string, number, number, typeof noSafe][] = [
  ['desktop 1280x720', 1280, 720, noSafe],
  ['landscape phone 844x390', 844, 390, noSafe],
  ['landscape phone with notch', 844, 390, notchLandscape],
  ['portrait phone 390x844', 390, 844, noSafe],
  ['portrait phone with notch', 390, 844, notch],
  ['small portrait 360x640', 360, 640, noSafe],
];

type Shape =
  { kind: 'rect'; r: Rect } | { kind: 'circle'; c: { x: number; y: number }; rad: number };
const box = (s: Shape): Rect =>
  s.kind === 'rect' ? s.r : { x: s.c.x - s.rad, y: s.c.y - s.rad, w: 2 * s.rad, h: 2 * s.rad };
const inside = (r: Rect, w: number, h: number) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** True overlap test: circles are round (a diagonal neighbour's square corners may meet without the circles touching). */
function overlap(a: Shape, b: Shape): boolean {
  if (a.kind === 'circle' && b.kind === 'circle')
    return Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y) < a.rad + b.rad;
  if (a.kind === 'rect' && b.kind === 'rect') return rectsOverlap(a.r, b.r);
  const [c, r] =
    a.kind === 'circle'
      ? [a, (b as { r: Rect }).r]
      : [b as Extract<Shape, { kind: 'circle' }>, (a as { r: Rect }).r];
  const nx = Math.max(r.x, Math.min(c.c.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(c.c.y, r.y + r.h));
  return Math.hypot(c.c.x - nx, c.c.y - ny) < c.rad;
}

function shapes(l: HudLayout): [string, Shape][] {
  const rect = (r: Rect): Shape => ({ kind: 'rect', r });
  const out: [string, Shape][] = [
    ['quit', rect(l.quit)],
    ['timer', rect(l.timer)],
    ['nexusBlue', rect(l.nexusBlue)],
    ['nexusRed', rect(l.nexusRed)],
    ['heroPanel', rect(l.heroPanel)],
    ['minimap', rect(l.minimap)],
    ['questionCard', rect(l.questionCard)],
  ];
  if (l.touch) {
    out.push(['joystick', { kind: 'circle', c: l.touch.joystick, rad: l.touch.joystickRadius }]);
    out.push(['attack', { kind: 'circle', c: l.touch.attack, rad: l.touch.attackRadius }]);
    l.touch.skills.forEach((s, i) =>
      out.push([`skill${i + 1}`, { kind: 'circle', c: s, rad: l.touch!.skillRadius }]),
    );
  }
  return out;
}

describe('HUD layout (#25)', () => {
  for (const [name, sw, sh, safeCss] of SCREENS) {
    for (const touch of [true, false]) {
      it(`${name}${touch ? ' with touch controls' : ''}: everything on screen, nothing overlapping`, () => {
        const { width: w, height: h } = logicalSize(sw, sh);
        const k = w / sw;
        const safe = {
          top: safeCss.top * k,
          right: safeCss.right * k,
          bottom: safeCss.bottom * k,
          left: safeCss.left * k,
        };
        const l = computeHudLayout(w, h, safe, touch);
        const all = shapes(l);
        for (const [n, sh] of all) expect(inside(box(sh), w, h), `${n} off screen`).toBe(true);
        for (let i = 0; i < all.length; i++)
          for (let j = i + 1; j < all.length; j++)
            expect(overlap(all[i]![1], all[j]![1]), `${all[i]![0]} overlaps ${all[j]![0]}`).toBe(
              false,
            );
        // Notches: nothing interactive or informative in the unsafe strips.
        for (const [n, sh] of all) {
          const r = box(sh);
          expect(r.y, `${n} under the top notch`).toBeGreaterThanOrEqual(safe.top - 1e-6);
          expect(r.x, `${n} under the left notch`).toBeGreaterThanOrEqual(safe.left - 1e-6);
          expect(r.x + r.w, `${n} under the right notch`).toBeLessThanOrEqual(
            w - safe.right + 1e-6,
          );
          expect(r.y + r.h, `${n} under the home bar`).toBeLessThanOrEqual(h - safe.bottom + 1e-6);
        }
      });
    }
  }

  it('keeps text big enough to read on a 6-inch phone (at least 11 CSS px)', () => {
    for (const [, sw, sh] of SCREENS) {
      const { width: w, height: h } = logicalSize(sw, sh);
      const l = computeHudLayout(w, h, noSafe, true);
      expect(l.fontSize * (sw / w)).toBeGreaterThanOrEqual(11);
    }
  });
});

describe('mini-map', () => {
  it('maps the world corners to the mini-map corners and keeps the lane proportions', () => {
    const r = { x: 100, y: 50, w: 300, h: 96 };
    expect(worldToMinimap({ x: 0, y: 0 }, world, r)).toEqual({ x: 100, y: 50 });
    expect(worldToMinimap({ x: world.width, y: world.height }, world, r)).toEqual({
      x: 400,
      y: 146,
    });
    const mid = worldToMinimap({ x: world.width / 2, y: world.height / 2 }, world, r);
    expect(mid.x).toBeCloseTo(250);
    expect(mid.y).toBeCloseTo(98);
  });
});

describe('question card (#27)', () => {
  it('is big enough for a 2 x 2 grid of thumb-sized answers on every screen', () => {
    for (const [, sw, sh] of SCREENS) {
      const { width: w, height: h } = logicalSize(sw, sh);
      for (const touch of [true, false]) {
        const c = computeHudLayout(w, h, noSafe, touch).questionCard;
        // At least ~ 44 CSS px per answer button (Apple/Google touch-target guidance).
        const cssPerGame = sw / w;
        expect(((c.w - 3 * 16) / 2) * cssPerGame, `${sw}x${sh} width`).toBeGreaterThanOrEqual(120);
        expect(c.h * cssPerGame, `${sw}x${sh} height`).toBeGreaterThanOrEqual(200);
      }
    }
  });
});
