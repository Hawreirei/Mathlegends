/**
 * Touch-control maths (#18). Pure, no Phaser.
 */
import type { Point } from './map';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Movement vector from a virtual joystick: direction from `origin` to `thumb`, strength
 * 0..1 by distance (full at `radius`), and 0 inside the dead zone (a fraction of radius)
 * so a resting thumb does not drift.
 */
export function joystickVector(
  origin: Point,
  thumb: Point,
  radius: number,
  deadZone: number,
): Point {
  const dx = thumb.x - origin.x;
  const dy = thumb.y - origin.y;
  const dist = Math.hypot(dx, dy);
  const dead = radius * deadZone;
  if (dist <= dead) return { x: 0, y: 0 };
  const strength = Math.min(1, (dist - dead) / (radius - dead));
  return { x: (dx / dist) * strength, y: (dy / dist) * strength };
}

/** CSS safe-area insets (notches, rounded corners, home bar) converted to game pixels. */
export function safeAreaInGame(css: Insets, gamePxPerCssPx: number): Insets {
  const f = (v: number) => (Number.isFinite(v) && v > 0 ? v * gamePxPerCssPx : 0);
  return { top: f(css.top), right: f(css.right), bottom: f(css.bottom), left: f(css.left) };
}

/**
 * Skill buttons around the attack button: three on a quarter arc to its left and above it,
 * and the ultimate (#33) further out on the same diagonal, at `ultimateDistance`.
 */
export function skillButtonPositions(
  attack: Point,
  distance: number,
  ultimateDistance = distance * 1.7,
): Point[] {
  const at = (deg: number, d: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: attack.x + Math.cos(a) * d, y: attack.y + Math.sin(a) * d };
  };
  return [at(180, distance), at(225, distance), at(270, distance), at(225, ultimateDistance)];
}
