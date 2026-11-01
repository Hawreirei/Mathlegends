/**
 * Picks the game's logical canvas size for a screen (#15). Pure, no Phaser.
 * Landscape keeps a 720 px tall canvas and portrait a 720 px wide one; the long side
 * stretches to the screen's shape (within limits) so Phaser's FIT mode fills the
 * screen with no cropping and little or no letterboxing.
 */
export const BASE_SHORT = 720;
export const BASE_LONG = 1280;
export const MAX_LONG = 1700;

export interface LogicalSize {
  width: number;
  height: number;
  portrait: boolean;
}

export function logicalSize(screenW: number, screenH: number): LogicalSize {
  const portrait = screenH > screenW;
  const ratio = portrait ? screenH / screenW : screenW / screenH;
  const long = Math.round(Math.min(MAX_LONG, Math.max(BASE_LONG, BASE_SHORT * ratio)));
  return portrait
    ? { width: BASE_SHORT, height: long, portrait }
    : { width: long, height: BASE_SHORT, portrait };
}
