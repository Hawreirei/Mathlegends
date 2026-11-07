import { describe, expect, it } from 'vitest';
import {
  createGameState,
  formatDuration,
  NEW_PROFILE,
  parseProfile,
  recordMatch,
} from '../src/systems/gameState';

describe('game state', () => {
  it('starts at Year 1 with 0 stars and no match yet', () => {
    const s = createGameState('id');
    expect(s.lang).toBe('id');
    expect(s.profile).toEqual({
      tier: 1,
      stars: 0,
      lossesAtZero: 0,
      matchesPlayed: 0,
    });
    expect(s.lastMatch).toBeNull();
  });

  it('records a finished match without mutating the old state', () => {
    const s = createGameState('en');
    const next = recordMatch(s, {
      outcome: 'victory',
      durationSec: 512,
      answered: 10,
      correct: 8,
      missed: [],
    });
    expect(next.lastMatch?.outcome).toBe('victory');
    expect(next.profile.matchesPlayed).toBe(1);
    expect(s.lastMatch).toBeNull();
    expect(s.profile.matchesPlayed).toBe(0);
  });

  it('keeps the review queue after a match (#29)', () => {
    const s = createGameState('id');
    expect(s.review).toEqual([]);
    const result = {
      outcome: 'defeat' as const,
      durationSec: 1,
      answered: 0,
      correct: 0,
      missed: [],
    };
    expect(recordMatch(s, result).review).toBe(s.review);
    const queue = [{ question: {} as never, matchesLeft: 3 }];
    expect(recordMatch(s, result, queue).review).toBe(queue);
  });

  it('formats match time as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(600.9)).toBe('10:00');
  });
});

describe('no placement quiz: everyone starts in Year 1', () => {
  it('a new player is in Year 1 with 0 stars', () => {
    expect(NEW_PROFILE).toEqual({ tier: 1, stars: 0, lossesAtZero: 0, matchesPlayed: 0 });
  });

  it('a save from before the quiz was removed keeps its Year and stars', () => {
    const old = { placed: true, tier: 4, stars: 2, lossesAtZero: 1, matchesPlayed: 7 };
    expect(parseProfile(old, 6)).toEqual({ tier: 4, stars: 2, lossesAtZero: 1, matchesPlayed: 7 });
  });

  it('a save from a player who never finished the quiz loads as Year 1', () => {
    const old = { placed: false, tier: 1, stars: 0, lossesAtZero: 0, matchesPlayed: 0 };
    expect(parseProfile(old, 6)).toEqual(NEW_PROFILE);
  });
});

describe('malformed saved profiles', () => {
  it('fall back to a new profile', () => {
    for (const bad of [
      null,
      'Year 3',
      42,
      { tier: 'x', stars: 0, matchesPlayed: 0 },
      { tier: 9, stars: 0, matchesPlayed: 0 },
    ])
      expect(parseProfile(bad, 6)).toEqual(NEW_PROFILE);
  });

  it('drop a broken loss counter but keep the rest', () => {
    const p = { tier: 2, stars: 1, lossesAtZero: -3, matchesPlayed: 4 };
    expect(parseProfile(p, 6)).toEqual({ ...p, lossesAtZero: 0 });
  });
});
