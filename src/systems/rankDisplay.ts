/**
 * What the rank badge shows (#42). Pure TypeScript, no Phaser.
 *
 * - Always 5 star icons (starsPerTier), filled up to the stars held (at most 5).
 * - Year 6 (no star cap, decided 2026-11-01): from the 6th star on a gold "×N" shows the real
 *   total, e.g. 5 filled icons plus "×9" for 9 stars.
 * - Below Year 6 a progress bar shows stars / 5 towards the next Year, with "N more stars to
 *   Year X".
 */
import type { RanksFile } from './data';
import type { Point } from './map';

export interface RankView {
  tier: number;
  /** The real star total (uncapped in Year 6). */
  total: number;
  /** Star icons drawn filled (0..starsPerTier). */
  filled: number;
  icons: number;
  /** The "×N" number, or null when not shown (5 stars or fewer, or below Year 6). */
  times: number | null;
  /** Stars still needed for the next Year, or null at the top Year. */
  toNext: number | null;
  nextTier: number | null;
  /** 0..1 towards the next Year; 1 at the top Year. */
  progress: number;
}

export function rankView(tier: number, stars: number, ranks: RanksFile): RankView {
  const per = ranks.starsPerTier;
  const top = ranks.tiers.length;
  const atTop = tier >= top;
  return {
    tier,
    total: stars,
    filled: Math.min(stars, per),
    icons: per,
    times: atTop && stars > per ? stars : null,
    toNext: atTop ? null : per - stars,
    nextTier: atTop ? null : tier + 1,
    progress: atTop ? 1 : Math.min(1, stars / per),
  };
}

/** Corner points of a star centred on (cx, cy), first point straight up. */
export function starPoints(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points = 5,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/**
 * Which star icons animate after a match: `gained` pop in, `lost` fades out (indices 0-4).
 * On a promotion the new Year's stars (carry-over) pop in; on a demotion nothing animates.
 */
export function starChanges(
  before: { tier: number; stars: number },
  after: { tier: number; stars: number },
  ranks: RanksFile,
): { gained: number[]; lost: number[] } {
  const per = ranks.starsPerTier;
  const range = (a: number, b: number) =>
    Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i).filter((i) => i < per);
  if (after.tier > before.tier) return { gained: range(0, after.stars), lost: [] };
  if (after.tier < before.tier) return { gained: [], lost: [] };
  if (after.stars > before.stars) return { gained: range(before.stars, after.stars), lost: [] };
  return { gained: [], lost: range(after.stars, before.stars) };
}
