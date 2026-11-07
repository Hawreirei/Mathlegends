import { describe, expect, it } from 'vitest';
import ranksJson from '../src/data/ranks.json';
import { loadRanks } from '../src/systems/data';
import { createGameState, parseProfile, recordMatch } from '../src/systems/gameState';
import { applyMatch, earnsBonus, type RankState } from '../src/systems/rank';

const ranks = loadRanks(ranksJson);
const at = (tier: number, stars: number, lossesAtZero = 0): RankState => ({
  tier,
  stars,
  lossesAtZero,
});
const WIN = { won: true, answered: 10, correct: 5 }; // 50%: no bonus
const WIN_BONUS = { won: true, answered: 10, correct: 8 }; // 80%: bonus
const LOSS = { won: false, answered: 10, correct: 9 };
const play = (r: RankState, ...outcomes: (typeof WIN)[]) =>
  outcomes.reduce((s, o) => applyMatch(s, o, ranks).after, r);

describe('rank config (#39)', () => {
  it('lives in ranks.json', () => {
    expect(ranks.starsPerTier).toBe(5);
    expect(ranks.tiers).toHaveLength(6);
    expect(ranks.stars).toMatchObject({
      win: 1,
      loss: -1,
      bonusAccuracy: 0.8,
      bonusStars: 1,
      demoteAfterLossesAtZero: 2,
      topTierUncapped: true,
    });
  });
});

describe('stars (#39)', () => {
  it('win +1, win with 80% or more correct +2, loss -1', () => {
    expect(applyMatch(at(2, 1), WIN, ranks)).toMatchObject({
      delta: 1,
      bonus: false,
      after: at(2, 2),
    });
    expect(applyMatch(at(2, 1), WIN_BONUS, ranks)).toMatchObject({
      delta: 2,
      bonus: true,
      after: at(2, 3),
    });
    expect(applyMatch(at(2, 3), LOSS, ranks)).toMatchObject({ delta: -1, after: at(2, 2) });
  });

  it('the bonus needs 80% and at least bonusMinAnswered answers, and a win', () => {
    expect(earnsBonus({ won: true, answered: 5, correct: 4 }, ranks)).toBe(true);
    expect(earnsBonus({ won: true, answered: 5, correct: 3 }, ranks)).toBe(false);
    expect(earnsBonus({ won: true, answered: 4, correct: 4 }, ranks)).toBe(false);
    expect(earnsBonus({ won: true, answered: 0, correct: 0 }, ranks)).toBe(false);
    expect(earnsBonus({ won: false, answered: 10, correct: 10 }, ranks)).toBe(false);
  });
});

describe('promotion (#39)', () => {
  it('the 5th star promotes at once to the next Year with 0 stars', () => {
    const c = applyMatch(at(2, 4), WIN, ranks);
    expect(c).toMatchObject({ promoted: true, after: at(3, 0) });
  });

  it('a 2-star win that crosses the line carries the extra star over (4 + 2 = next Year, 1 star)', () => {
    expect(applyMatch(at(2, 4), WIN_BONUS, ranks)).toMatchObject({
      delta: 2,
      promoted: true,
      after: at(3, 1),
    });
    // 3 + 2 lands exactly on 5: next Year with 0.
    expect(applyMatch(at(2, 3), WIN_BONUS, ranks).after).toEqual(at(3, 0));
  });

  it('climbs Year 1 to Year 6 one star at a time: 25 wins', () => {
    let r = at(1, 0);
    let wins = 0;
    while (r.tier < 6) {
      r = applyMatch(r, WIN, ranks).after;
      wins++;
    }
    expect(wins).toBe(25);
    expect(r).toEqual(at(6, 0));
  });

  it('promotes from Year 5 into Year 6 with carry-over too', () => {
    expect(applyMatch(at(5, 4), WIN_BONUS, ranks).after).toEqual(at(6, 1));
  });
});

describe('Year 6 has no star cap (#39)', () => {
  it('counts above 5 stars and never promotes', () => {
    let r = at(6, 4);
    r = play(r, WIN, WIN, WIN_BONUS);
    expect(r).toEqual(at(6, 8));
    const c = applyMatch(at(6, 22), WIN, ranks);
    expect(c).toMatchObject({ promoted: false, after: at(6, 23) });
  });

  it('a loss takes one star off the real total', () => {
    expect(applyMatch(at(6, 9), LOSS, ranks).after).toEqual(at(6, 8));
    expect(play(at(6, 9), LOSS, LOSS, LOSS)).toEqual(at(6, 6));
  });

  it('the demotion rule still applies at 0 stars', () => {
    expect(play(at(6, 1), LOSS, LOSS)).toEqual(at(6, 0, 1));
    expect(play(at(6, 1), LOSS, LOSS, LOSS)).toEqual(at(5, ranks.stars.starsAfterDemotion));
  });

  it('is saved uncapped, while lower Years reject 5 or more stars', () => {
    const save = { tier: 6, stars: 23, lossesAtZero: 0, matchesPlayed: 40 };
    expect(parseProfile(save, 6, 5).stars).toBe(23);
    expect(parseProfile({ ...save, tier: 4 }, 6, 5).tier).toBe(1); // broken save: new profile
  });
});

describe('demotion (#39)', () => {
  it('a loss at 0 stars takes nothing but counts; 2 in a row drop a Year', () => {
    const first = applyMatch(at(3, 0), LOSS, ranks);
    expect(first).toMatchObject({ delta: 0, demoted: false, after: at(3, 0, 1) });
    const second = applyMatch(first.after, LOSS, ranks);
    expect(second).toMatchObject({ demoted: true, after: at(2, ranks.stars.starsAfterDemotion) });
  });

  it('the loss that takes you down to 0 stars does not count', () => {
    expect(play(at(3, 1), LOSS, LOSS)).toEqual(at(3, 0, 1));
    expect(play(at(3, 1), LOSS, LOSS, LOSS).tier).toBe(2);
  });

  it('a win in between resets the count', () => {
    expect(play(at(3, 0), LOSS, WIN, LOSS, LOSS)).toEqual(at(3, 0, 1));
  });

  it('the floor is Year 1: losses at Year 1 with 0 stars change nothing', () => {
    const r = play(at(1, 0), LOSS, LOSS, LOSS, LOSS, LOSS);
    expect(r.tier).toBe(1);
    expect(r.stars).toBe(0);
    expect(r.lossesAtZero).toBeLessThanOrEqual(ranks.stars.demoteAfterLossesAtZero);
    expect(applyMatch(at(1, 0), LOSS, ranks).demoted).toBe(false);
  });
});

describe('a match updates the profile (#39)', () => {
  it('recordMatch applies the rank change and counts the match', () => {
    const s = createGameState('id');
    const rank = applyMatch(s.profile, WIN_BONUS, ranks);
    const next = recordMatch(s, {
      outcome: 'victory',
      durationSec: 400,
      answered: 10,
      correct: 8,
      missed: [],
      rank,
    });
    expect(next.profile).toMatchObject({ tier: 1, stars: 2, lossesAtZero: 0, matchesPlayed: 1 });
    expect(next.lastMatch?.rank?.delta).toBe(2);
  });
});
