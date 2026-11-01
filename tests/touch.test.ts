import { describe, expect, it } from 'vitest';
import { joystickVector, safeAreaInGame, skillButtonPositions } from '../src/systems/touch';

const R = 100;
const DZ = 0.15;

describe('joystick vector', () => {
  it('is zero inside the dead zone', () => {
    expect(joystickVector({ x: 0, y: 0 }, { x: 10, y: 5 }, R, DZ)).toEqual({ x: 0, y: 0 });
  });

  it('points the way the thumb moved, with strength by distance', () => {
    const half = joystickVector({ x: 0, y: 0 }, { x: 60, y: 0 }, R, DZ);
    expect(half.y).toBe(0);
    expect(half.x).toBeGreaterThan(0.4);
    expect(half.x).toBeLessThan(0.6);
    const up = joystickVector({ x: 100, y: 100 }, { x: 100, y: 0 }, R, DZ);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(-1);
  });

  it('caps at full strength beyond the radius', () => {
    const v = joystickVector({ x: 0, y: 0 }, { x: 300, y: 400 }, R, DZ);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x / v.y).toBeCloseTo(300 / 400);
  });
});

describe('safe area', () => {
  it('converts CSS inset pixels to game pixels', () => {
    // Canvas shown 390 CSS px wide for a 720 px wide game: 1 CSS px = 720/390 game px.
    const s = safeAreaInGame({ top: 47, right: 0, bottom: 34, left: 0 }, 720 / 390);
    expect(s.top).toBeCloseTo(47 * (720 / 390));
    expect(s.bottom).toBeCloseTo(34 * (720 / 390));
    expect(s.left).toBe(0);
  });

  it('treats missing or bad values as 0', () => {
    expect(safeAreaInGame({ top: Number.NaN, right: -4, bottom: 0, left: 0 }, 2)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe('skill button layout', () => {
  it('places 3 skill buttons on an arc left of and above the attack button, not overlapping it', () => {
    const attack = { x: 1000, y: 600 };
    const ps = skillButtonPositions(attack, 170);
    expect(ps).toHaveLength(3);
    for (const p of ps) {
      expect(Math.hypot(p.x - attack.x, p.y - attack.y)).toBeCloseTo(170);
      expect(p.x).toBeLessThanOrEqual(attack.x + 1e-9);
      expect(p.y).toBeLessThanOrEqual(attack.y + 1e-9);
    }
  });
});
