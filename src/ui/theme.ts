import theme from '../data/theme.json';
import type { Settings } from '../systems/settings';

export { theme };

const BASE_COLORS = { ...theme.colors };
let scale = 1;

/**
 * Applies the accessibility settings (#31): the colour-blind-safe right/wrong pair replaces
 * theme.colors.correct/wrong (everything reads colours from theme.colors at draw time), and the
 * text scale is used by the reading parts through `ts`.
 */
export function applyAccessibility(s: Settings): void {
  const { correct, wrong } = theme.colorBlind;
  Object.assign(theme.colors, BASE_COLORS, s.colorBlind ? { correct, wrong } : {});
  scale = s.textScale;
}

/** A font size x the player's text size setting. */
export const ts = (size: number): number => Math.round(size * scale);
export const textScale = (): number => scale;
/** "#rrggbb" -> 0xrrggbb for Phaser fills. */
export const hex = (c: string): number => Number.parseInt(c.slice(1), 16);

export const displayFont = (size: number, color = theme.colors.white, weight = '700') => ({
  fontFamily: theme.fonts.display,
  fontStyle: weight,
  fontSize: `${size}px`,
  color,
});

export const bodyFont = (size: number, color = theme.colors.white, weight = '700') => ({
  fontFamily: theme.fonts.body,
  fontStyle: weight,
  fontSize: `${size}px`,
  color,
});
