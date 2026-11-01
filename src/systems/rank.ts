/**
 * Rank model (#39): 6 Years x 5 stars. Pure TypeScript, no Phaser. Numbers in ranks.json `stars`.
 *
 * Decided with the project owner (2026-11-01, docs/GDD.md section 7):
 * - Win +1 star; win with at least 80% correct answers +1 bonus star (needs bonusMinAnswered
 *   answered questions); loss -1 star.
 * - Reaching starsPerTier (5) promotes at once to the next Year with 0 stars; extra stars carry
 *   over (4 + 2 = next Year with 1 star).
 * - The top Year (6) has no star cap: stars keep counting, and a loss takes one off the total.
 * - At 0 stars a loss takes nothing, but after demoteAfterLossesAtZero (2) straight losses at
 *   0 stars the player drops one Year, landing on starsAfterDemotion (3) stars. Never below Year 1.
 */
import type { RanksFile } from './data';

export interface RankState {
  tier: number;
  stars: number;
  /** Losses in a row while already at 0 stars. */
  lossesAtZero: number;
}

export interface MatchOutcome {
  won: boolean;
  answered: number;
  correct: number;
}

export interface RankChange {
  /** Stars earned (+1, +2) or lost (-1, or 0 at 0 stars). */
  delta: number;
  bonus: boolean;
  promoted: boolean;
  demoted: boolean;
  before: RankState;
  after: RankState;
}

/** True if this win earns the accuracy bonus star. */
export function earnsBonus(o: MatchOutcome, ranks: RanksFile): boolean {
  const s = ranks.stars;
  return (
    o.won &&
    o.answered >= Math.max(1, s.bonusMinAnswered) &&
    o.correct / o.answered >= s.bonusAccuracy
  );
}

export function applyMatch(r: RankState, o: MatchOutcome, ranks: RanksFile): RankChange {
  const s = ranks.stars;
  const per = ranks.starsPerTier;
  const top = ranks.tiers.length;
  const before = { tier: r.tier, stars: r.stars, lossesAtZero: r.lossesAtZero };

  if (o.won) {
    const bonus = earnsBonus(o, ranks);
    const delta = s.win + (bonus ? s.bonusStars : 0);
    let tier = r.tier;
    let stars = r.stars + delta;
    // Promote while a full set of stars is reached (carry the rest over), except at the top Year.
    while (stars >= per && (tier < top || !s.topTierUncapped)) {
      if (tier >= top) {
        stars = per - 1; // Capped top Year (only if topTierUncapped is false).
        break;
      }
      tier += 1;
      stars -= per;
    }
    return {
      delta,
      bonus,
      promoted: tier > r.tier,
      demoted: false,
      before,
      after: { tier, stars, lossesAtZero: 0 },
    };
  }

  // Loss.
  if (r.stars > 0) {
    const stars = Math.max(0, r.stars + s.loss);
    return {
      delta: stars - r.stars,
      bonus: false,
      promoted: false,
      demoted: false,
      before,
      after: { tier: r.tier, stars, lossesAtZero: 0 },
    };
  }
  const losses = r.lossesAtZero + 1;
  if (losses >= s.demoteAfterLossesAtZero && r.tier > 1)
    return {
      delta: 0,
      bonus: false,
      promoted: false,
      demoted: true,
      before,
      after: { tier: r.tier - 1, stars: s.starsAfterDemotion, lossesAtZero: 0 },
    };
  return {
    delta: 0,
    bonus: false,
    promoted: false,
    demoted: false,
    before,
    // Year 1 is the floor: the count stops at the limit.
    after: { tier: r.tier, stars: 0, lossesAtZero: Math.min(losses, s.demoteAfterLossesAtZero) },
  };
}
