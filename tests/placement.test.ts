import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import ranksJson from '../src/data/ranks.json';
import { placementRow } from '../src/systems/answerLog';
import { loadRanks } from '../src/systems/data';
import {
  applyPlacement,
  createGameState,
  NEW_PROFILE,
  parseProfile,
  resetPlacement,
  serializeProfile,
} from '../src/systems/gameState';
import {
  createPlacement,
  estimateMastery,
  nextPlacementQuestion,
  placementDone,
  placementTier,
  recordPlacementAnswer,
  simulatePlacement,
} from '../src/systems/placement';
import { loadQuestionBank } from '../src/systems/questionBank';
import { createRng } from '../src/utils/rng';

const ranks = loadRanks(ranksJson);
const bank = loadQuestionBank();
const P = ranks.placement;
const right = (n: number) => Array<boolean>(n).fill(true);
const wrong = (n: number) => Array<boolean>(n).fill(false);

/** Plays the real quiz with a student who answers right iff `knows(tier)`. */
function play(knows: (tier: number, i: number) => boolean, seed = 1) {
  let s = createPlacement(ranks, seed);
  const asked: string[] = [];
  while (!placementDone(s, ranks)) {
    const q = nextPlacementQuestion(s, bank, ranks);
    asked.push(q.id);
    s = recordPlacementAnswer(s, q, knows(q.tier, s.answers.length), ranks);
  }
  return { start: placementTier(s.answers, ranks), state: s, asked };
}

describe('placement staircase (#38)', () => {
  it('starts at Year 3 and moves one Year up on a right answer, one down on a wrong one', () => {
    expect(P.firstTier).toBe(3);
    expect(simulatePlacement([true, true, false, false, false, true], ranks).tiers).toEqual([
      3, 4, 5, 4, 3, 2,
    ]);
  });

  it('stays within Year 1 to 6', () => {
    expect(simulatePlacement(right(10), ranks).tiers).toEqual([3, 4, 5, 6, 6, 6, 6, 6, 6, 6]);
    expect(simulatePlacement(wrong(10), ranks).tiers).toEqual([3, 2, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('asks exactly 10 questions', () => {
    expect(P.questions).toBe(10);
    expect(play(() => true).state.answers).toHaveLength(10);
  });

  it('the same answers always give the same Year (deterministic)', () => {
    const rng = createRng(42);
    for (let k = 0; k < 200; k++) {
      const seq = Array.from({ length: 10 }, () => rng() < 0.6);
      const a = simulatePlacement(seq, ranks).start;
      expect(simulatePlacement(seq, ranks).start).toBe(a);
      // The real quiz with different questions (other seeds) gives the same Year for the same answers.
      expect(play((_, i) => seq[i]!, k + 1).start).toBe(a);
      expect(play((_, i) => seq[i]!, k + 1000).start).toBe(a);
    }
  });

  it('places a student who knows up to Year L at Year L - 1 (never above Year 5, never below 1)', () => {
    for (let level = 0; level <= 6; level++) {
      const { start } = play((tier) => tier <= level);
      expect(start, `knows up to Year ${level}`).toBe(Math.max(1, Math.min(5, level - 1)));
    }
  });

  it('a few slips do not change a strong student a lot', () => {
    // Knows Year 5; slips on the 2nd and 6th question.
    const { start } = play((tier, i) => tier <= 5 && i !== 1 && i !== 5);
    expect(start).toBeGreaterThanOrEqual(3);
    expect(start).toBeLessThanOrEqual(4);
  });

  it('mastery is the highest Year with at least as many right as wrong answers', () => {
    const a = (tier: number, correct: boolean) => ({ tier, questionId: 'x', correct });
    expect(estimateMastery([])).toBe(1);
    expect(estimateMastery([a(3, true), a(4, false), a(3, true), a(4, true)])).toBe(4);
    expect(estimateMastery([a(3, true), a(4, false), a(4, false), a(4, true)])).toBe(3);
    expect(estimateMastery([a(3, false), a(2, false), a(1, false)])).toBe(1);
    expect(placementTier([a(6, true)], ranks)).toBe(5);
    expect(placementTier([a(1, false)], ranks)).toBe(1);
  });

  it('asks fluency questions of the current Year and never the same one twice', () => {
    const { state, asked } = play((tier) => tier <= 4, 7);
    expect(new Set(asked).size).toBe(asked.length);
    for (const [i, ans] of state.answers.entries()) {
      const q = bank.find((x) => x.id === ans.questionId)!;
      expect(q.type).toBe(P.questionType);
      expect(q.tier).toBe(
        simulatePlacement(
          state.answers.map((x) => x.correct),
          ranks,
        ).tiers[i],
      );
    }
  });

  it('takes under 3 minutes even if every question times out', () => {
    const worst = P.questions * (P.secondsPerQuestion + economyJson.questionRevealSeconds);
    expect(worst).toBeLessThan(180);
  });
});

describe('profile and placement (#38)', () => {
  it('a new player is not placed yet', () => {
    expect(createGameState('id').profile).toEqual(NEW_PROFILE);
    expect(NEW_PROFILE.placed).toBe(false);
  });

  it('placement sets the Year with 0 stars; retaking clears the flag only', () => {
    const s = createGameState('id', [], undefined, { ...NEW_PROFILE, stars: 3, matchesPlayed: 4 });
    const placed = applyPlacement(s, 4);
    expect(placed.profile).toEqual({ ...NEW_PROFILE, placed: true, tier: 4, matchesPlayed: 4 });
    expect(resetPlacement(placed).profile).toEqual({ ...placed.profile, placed: false });
    expect(s.profile.placed).toBe(false);
  });

  it('round-trips through storage and rejects broken saves', () => {
    const p = { placed: true, tier: 4, stars: 2, lossesAtZero: 1, matchesPlayed: 7 };
    expect(parseProfile(JSON.parse(JSON.stringify(serializeProfile(p))), 6)).toEqual(p);
    expect(parseProfile({ ...p, tier: 9 }, 6)).toEqual(NEW_PROFILE);
    expect(parseProfile({ ...p, stars: -1 }, 6)).toEqual(NEW_PROFILE);
    expect(parseProfile('junk', 6)).toEqual(NEW_PROFILE);
    expect(parseProfile({ ...p, placed: 'yes' }, 6).placed).toBe(false);
  });

  it('logs placement answers with band "placement" (#30)', () => {
    const q = bank[0]!;
    const info = { matchId: 'p-1-000000', matchStart: 'x', playerTier: 1, lang: 'en' as const };
    expect(placementRow(q, info, 1, 2, q.answerIndex, 3.2, 15)).toMatchObject({
      band: 'placement',
      minion: 'none',
      outcome: 'correct',
      responseMs: 3200,
      timeLimitSec: 15,
    });
    expect(placementRow(q, info, 2, 2, null, null, 15)).toMatchObject({
      outcome: 'timeout',
      correct: 0,
      responseMs: null,
    });
  });
});
