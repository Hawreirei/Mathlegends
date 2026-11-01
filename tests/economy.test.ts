import { describe, expect, it } from 'vitest';
import economy from '../src/data/economy.json';
import {
  damage,
  expToNext,
  totalExpToLevel,
  rewardMultiplier,
  respawnSeconds,
  estimateMatch,
  validateEconomy,
  type EconomyConfig,
} from '../src/systems/economy';

const cfg = economy as EconomyConfig;

describe('economy.json', () => {
  it('passes validation', () => {
    expect(validateEconomy(cfg)).toEqual([]);
  });

  it('reports a clear error on bad data', () => {
    const bad = structuredClone(cfg);
    bad.reward.correct = 0.4;
    bad.lastHitGold.cannon = -1;
    const errors = validateEconomy(bad);
    expect(errors.join('\n')).toMatch(/reward.correct/);
    expect(errors.join('\n')).toMatch(/lastHitGold.cannon/);
  });
});

describe('damage formula', () => {
  it('is ATK x 100 / (100 + ARMOR)', () => {
    expect(damage(100, 0)).toBe(100);
    expect(damage(100, 100)).toBe(50);
    expect(damage(60, 20)).toBe(50);
  });

  it('never goes below 1 for positive attack', () => {
    expect(damage(1, 10_000)).toBe(1);
  });
});

describe('reward multiplier', () => {
  it('pays correct, wrong and timeout from config', () => {
    expect(rewardMultiplier(cfg, 'correct', 0)).toBe(1.5);
    expect(rewardMultiplier(cfg, 'wrong', 0)).toBe(0.5);
    expect(rewardMultiplier(cfg, 'timeout', 0)).toBe(0.5);
  });

  it('adds +5% per prior correct answer, capped at +25%', () => {
    expect(rewardMultiplier(cfg, 'correct', 2)).toBeCloseTo(1.5 * 1.1);
    expect(rewardMultiplier(cfg, 'correct', 5)).toBeCloseTo(1.5 * 1.25);
    expect(rewardMultiplier(cfg, 'correct', 50)).toBeCloseTo(1.5 * 1.25);
  });

  it('gives no streak bonus to wrong answers', () => {
    expect(rewardMultiplier(cfg, 'wrong', 5)).toBe(0.5);
  });
});

describe('EXP curve and respawn', () => {
  it('grows each level and stops at the cap', () => {
    expect(expToNext(cfg, 1)).toBe(cfg.exp.baseToLevel2);
    expect(expToNext(cfg, 2)).toBeGreaterThan(expToNext(cfg, 1));
    expect(expToNext(cfg, cfg.exp.levelCap)).toBe(Infinity);
    expect(totalExpToLevel(cfg, 1)).toBe(0);
  });

  it('respawn time grows with level', () => {
    expect(respawnSeconds(cfg, 1)).toBeLessThan(respawnSeconds(cfg, 15));
  });
});

describe('fairness target (math share of income)', () => {
  it('lands at 30-40% for a typical student (70% accuracy)', () => {
    const est = estimateMatch(cfg, 0.7);
    expect(est.mathShare).toBeGreaterThanOrEqual(0.3);
    expect(est.mathShare).toBeLessThanOrEqual(0.4);
  });

  it('never exceeds the cap even at 100% accuracy', () => {
    expect(estimateMatch(cfg, 1).mathShare).toBeLessThanOrEqual(cfg.fairness.mathShareCap + 1e-9);
  });

  it('still pays a weak student (30% accuracy) a real share', () => {
    expect(estimateMatch(cfg, 0.3).mathShare).toBeGreaterThan(0.2);
  });

  it('reaches roughly level 11-14 in a 10 minute match', () => {
    const lvl = estimateMatch(cfg, 0.7).level;
    expect(lvl).toBeGreaterThanOrEqual(11);
    expect(lvl).toBeLessThanOrEqual(14);
  });
});
