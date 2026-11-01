/**
 * Reward resolver (#28): how much gold a last hit pays once its question is answered.
 * Pure, no Phaser; every number comes from economy.json.
 *
 * - Multiplier: correct `reward.correct` x (1 + streak bonus, capped), wrong `reward.wrong`,
 *   timeout `reward.timeout`, skipped 1 (rewardMultiplier in economy.ts, questionSession.ts).
 * - Fairness cap: math-derived gold (last hits) may not push the player's share of earned gold
 *   above `fairness.mathShareCap`. The cap only removes BONUS: a correct answer always pays at
 *   least the plain reward (x1), and wrong/timeout pay (x0.5) is never touched. Otherwise the
 *   first correct answers of a match, when other income is still tiny, would feel like a penalty.
 * - The cap is on gold only; EXP keeps the full multiplier.
 */
import type { EconomyConfig } from './economy';
import type { Progress } from './progression';

/** Last-hit gold over all earned gold (starting gold excluded). 0 before any income. */
export function mathShare(p: Progress): number {
  const s = p.goldBySource;
  const earned = s.passive + s.lastHit + s.heroKill + s.tower;
  return earned > 0 ? s.lastHit / earned : 0;
}

export interface GoldResolution {
  gold: number;
  /** The multiplier actually paid (gold / base). */
  multiplier: number;
  /** True when the cap removed some of the bonus. */
  capped: boolean;
}

export function resolveLastHitGold(
  base: number,
  multiplier: number,
  p: Progress,
  c: EconomyConfig,
): GoldResolution {
  const wanted = base * multiplier;
  if (multiplier <= 1 || base <= 0) return { gold: wanted, multiplier, capped: false };
  const s = p.goldBySource;
  const other = s.passive + s.heroKill + s.tower;
  const cap = c.fairness.mathShareCap;
  // Largest g with (math + g) / (math + g + other) <= cap.
  const room = (cap * other) / (1 - cap) - s.lastHit;
  const gold = Math.max(base, Math.min(wanted, room));
  return { gold, multiplier: gold / base, capped: gold < wanted };
}
