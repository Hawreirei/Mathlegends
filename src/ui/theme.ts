import theme from '../data/theme.json';

export { theme };
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
