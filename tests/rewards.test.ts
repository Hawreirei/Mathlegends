import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import type { EconomyConfig } from '../src/systems/economy';
import { createProgress, addGold } from '../src/systems/progression';
import { mathShare, resolveLastHitGold } from '../src/systems/rewards';

const c = economyJson as EconomyConfig;
const cap = c.fairness.mathShareCap;
/** A player with plenty of other income, so the cap never bites. */
const rich = () => addGold(createProgress(c), 100_000, 'passive');

describe('reward resolver (#28): multipliers', () => {
  it('correct, first in a streak: x correct (1.5)', () => {
    expect(resolveLastHitGold(20, c.reward.correct, rich(), c)).toMatchObject({
      gold: 30,
      capped: false,
    });
  });

  it('correct with a streak: +5% per prior correct answer', () => {
    const m = c.reward.correct * (1 + 2 * c.reward.streakBonusPerCorrect);
    expect(resolveLastHitGold(20, m, rich(), c).gold).toBeCloseTo(20 * m);
  });

  it('streak bonus stops at +25%', () => {
    const m = c.reward.correct * (1 + c.reward.streakBonusCap);
    expect(resolveLastHitGold(20, m, rich(), c).gold).toBeCloseTo(20 * 1.875);
  });

  it('wrong and timeout: x 0.5', () => {
    expect(resolveLastHitGold(20, c.reward.wrong, rich(), c).gold).toBe(10);
    expect(resolveLastHitGold(20, c.reward.timeout, rich(), c).gold).toBe(10);
  });

  it('skipped (no question): x1', () => {
    expect(resolveLastHitGold(20, 1, rich(), c).gold).toBe(20);
  });
});

describe('reward resolver: math-share cap', () => {
  it('measures the math share as last-hit gold over all earned gold (starting gold excluded)', () => {
    let p = createProgress(c);
    expect(mathShare(p)).toBe(0);
    p = addGold(addGold(p, 60, 'passive'), 40, 'lastHit');
    expect(mathShare(p)).toBeCloseTo(0.4);
  });

  it('removes bonus that would push the share over the cap', () => {
    // 600 other gold, 390 math gold: 10 more math gold reaches exactly 40%.
    const p = addGold(addGold(createProgress(c), 600, 'passive'), 390, 'lastHit');
    const r = resolveLastHitGold(20, 1.5, p, c);
    expect(r.capped).toBe(true);
    expect(r.gold).toBe(20); // never below the plain reward for a correct answer
    // Room for some bonus: trimmed to land exactly on the cap.
    const p2 = addGold(addGold(createProgress(c), 1000, 'passive'), 560, 'lastHit');
    const r2 = resolveLastHitGold(100, 1.5, p2, c);
    expect(r2.capped).toBe(true);
    expect(r2.gold).toBeGreaterThan(100);
    expect(r2.gold).toBeLessThan(150);
    expect(mathShare(addGold(p2, r2.gold, 'lastHit'))).toBeCloseTo(cap, 9);
  });

  it('pays exactly x1 when even the plain reward would pass the cap (the x1 guarantee wins)', () => {
    const p = addGold(addGold(createProgress(c), 1000, 'passive'), 650, 'lastHit');
    expect(resolveLastHitGold(100, 1.5, p, c)).toMatchObject({
      gold: 100,
      multiplier: 1,
      capped: true,
    });
  });

  it('never cuts a correct answer below x1, even at the very start of a match', () => {
    const r = resolveLastHitGold(45, 1.5, createProgress(c), c);
    expect(r.gold).toBe(45);
    expect(r.capped).toBe(true);
  });

  it('never touches wrong or timeout pay (already below x1)', () => {
    const p = addGold(addGold(createProgress(c), 100, 'passive'), 500, 'lastHit');
    expect(resolveLastHitGold(20, 0.5, p, c)).toMatchObject({ gold: 10, capped: false });
  });

  it('reports the multiplier actually paid', () => {
    const p = addGold(addGold(createProgress(c), 1000, 'passive'), 560, 'lastHit');
    const r = resolveLastHitGold(100, 1.5, p, c);
    expect(r.multiplier).toBeCloseTo(r.gold / 100);
  });
});
