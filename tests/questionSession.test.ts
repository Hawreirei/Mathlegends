import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import ranksJson from '../src/data/ranks.json';
import { loadRanks } from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { loadQuestionBank } from '../src/systems/questionBank';
import { createQuestionEngine } from '../src/systems/questionEngine';
import {
  answer,
  createSession,
  finalCounts,
  onLastHit,
  tick,
  type Resolution,
  type Session,
} from '../src/systems/questionSession';

const econ = economyJson as EconomyConfig;
const ranks = loadRanks(ranksJson);
const bank = loadQuestionBank();
const reward = (gold = 14, exp = 30) => ({ gold, exp, at: { x: 0, y: 0 } });
const fresh = (seed = 1) => createSession(createQuestionEngine(bank, ranks, seed), econ);

/** The display index of the correct answer for the active question. */
const correctSlot = (s: Session) => s.active!.order.indexOf(s.active!.question.answerIndex);
const wrongSlot = (s: Session) => [0, 1, 2, 3].find((i) => i !== correctSlot(s))!;

describe('question session (#27)', () => {
  it('a last hit shows a question with the timer for that minion type', () => {
    for (const kind of ['infantry', 'lancer', 'cannon'] as const) {
      const r = onLastHit(fresh(), kind, reward(), 10, 3);
      expect(r.session.active).not.toBeNull();
      expect(r.session.active!.deadline - r.session.active!.shownAt).toBe(
        econ.questionSeconds[kind],
      );
      expect(r.resolutions).toEqual([]);
    }
  });

  it('shuffles the answers: the display order is a permutation that still finds the right answer', () => {
    const seen = new Set<number>();
    let s = fresh(5);
    for (let i = 0; i < 40; i++) {
      s = onLastHit(s, 'infantry', reward(), i * 10, 3).session;
      expect([...s.active!.order].sort()).toEqual([0, 1, 2, 3]);
      seen.add(correctSlot(s));
      s = answer(s, correctSlot(s), i * 10 + 1).session;
    }
    expect(seen.size).toBe(4);
  });

  it('correct pays x correct multiplier and grows the streak; wrong pays x wrong and resets it', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 0, 3).session;
    let r = answer(s, correctSlot(s), 1);
    expect(r.resolutions[0]).toMatchObject({ outcome: 'correct', multiplier: econ.reward.correct });
    s = onLastHit(r.session, 'infantry', reward(), 5, 3).session;
    r = answer(s, correctSlot(s), 6);
    expect(r.resolutions[0]!.multiplier).toBeCloseTo(
      econ.reward.correct * (1 + econ.reward.streakBonusPerCorrect),
    );
    s = onLastHit(r.session, 'infantry', reward(), 10, 3).session;
    r = answer(s, wrongSlot(s), 11);
    expect(r.resolutions[0]).toMatchObject({ outcome: 'wrong', multiplier: econ.reward.wrong });
    expect(r.session.streak).toBe(0);
  });

  it('times out at the deadline and pays x timeout', () => {
    const s = onLastHit(fresh(), 'lancer', reward(), 20, 3).session;
    expect(tick(s, 20 + econ.questionSeconds.lancer - 0.01).resolutions).toEqual([]);
    const r = tick(s, 20 + econ.questionSeconds.lancer);
    expect(r.resolutions[0]).toMatchObject({ outcome: 'timeout', multiplier: econ.reward.timeout });
    expect(r.session.active).toBeNull();
  });

  it('only one question at a time: a second last hit waits, a third pays the normal reward without a question', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 0, 3).session;
    const firstId = s.active!.question.id;
    let r = onLastHit(s, 'lancer', reward(24, 40), 1, 3);
    expect(r.session.active!.question.id).toBe(firstId);
    expect(r.session.queued).not.toBeNull();
    r = onLastHit(r.session, 'infantry', reward(), 2, 3);
    expect(r.resolutions).toEqual([expect.objectContaining({ outcome: 'skipped', multiplier: 1 })]);
    // Answering the first brings the waiting one up with a fresh timer.
    s = r.session;
    const a = answer(s, correctSlot(s), 3);
    expect(a.session.active!.kind).toBe('lancer');
    // The waiting question appears after the reveal of the answer (#29), with its full timer.
    const shown = 3 + econ.questionRevealSeconds;
    expect(a.session.active!.shownAt).toBe(shown);
    expect(a.session.active!.deadline).toBe(shown + econ.questionSeconds.lancer);
    expect(a.session.queued).toBeNull();
  });

  it('drops a waiting question that went stale, paying the normal reward (no penalty)', () => {
    let s = onLastHit(fresh(), 'cannon', reward(), 0, 3).session;
    s = onLastHit(s, 'infantry', reward(), 1, 3).session;
    // The Cannon question takes its full 12 s; the Infantry one waited longer than its own 5 s.
    const r = tick(s, econ.questionSeconds.cannon);
    const outcomes = r.resolutions.map((x: Resolution) => x.outcome);
    expect(outcomes).toEqual(['timeout', 'skipped']);
    expect(r.resolutions[1]!.multiplier).toBe(1);
    expect(r.session.active).toBeNull();
  });

  it('a skipped question leaves the streak alone', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 0, 3).session;
    s = answer(s, correctSlot(s), 1).session;
    expect(s.streak).toBe(1);
    s = onLastHit(s, 'cannon', reward(), 2, 3).session;
    s = onLastHit(s, 'infantry', reward(), 2, 3).session;
    s = onLastHit(s, 'infantry', reward(), 2, 3).session; // overflow: skipped
    expect(s.streak).toBe(1);
  });

  it('ignores answers when no question is showing, and taps outside 0..3', () => {
    const s = fresh();
    expect(answer(s, 0, 1).resolutions).toEqual([]);
    const q = onLastHit(s, 'infantry', reward(), 0, 3).session;
    expect(answer(q, 7, 1).resolutions).toEqual([]);
  });

  it('counts answered and correct for the result screen', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 0, 3).session;
    s = answer(s, correctSlot(s), 1).session;
    s = onLastHit(s, 'infantry', reward(), 2, 3).session;
    s = answer(s, wrongSlot(s), 3).session;
    s = onLastHit(s, 'infantry', reward(), 4, 3).session;
    s = tick(s, 100).session;
    expect(s.asked).toBe(3);
    expect(s.correct).toBe(1);
  });
});

describe('final counts when the match ends', () => {
  it('a question still on screen was cut short: it is not counted as asked', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 10, 3).session;
    s = answer(s, correctSlot(s), 11).session;
    s = tick(s, 20).session;
    expect(finalCounts(s)).toEqual({ asked: 1, correct: 1 });
    const open = onLastHit(s, 'lancer', reward(), 21, 3).session;
    expect(open.active).not.toBeNull();
    expect(finalCounts(open)).toEqual({ asked: 1, correct: 1 });
  });
});
