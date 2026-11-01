import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import ranksJson from '../src/data/ranks.json';
import { loadRanks, type RanksFile } from '../src/systems/data';
import type { EconomyConfig, MinionType } from '../src/systems/economy';
import { loadQuestionBank } from '../src/systems/questionBank';
import {
  createQuestionEngine,
  harderType,
  nextQuestion,
  questionTypeFor,
  type Pick,
} from '../src/systems/questionEngine';
import { createSession, onLastHit, tick } from '../src/systems/questionSession';

const ranks = loadRanks(ranksJson);
const econ = economyJson as EconomyConfig;
const bank = loadQuestionBank();
const KINDS: MinionType[] = ['infantry', 'infantry', 'infantry', 'lancer', 'lancer', 'cannon'];

function draw(tier: number, n: number, r: RanksFile = ranks, seed = 5) {
  let e = createQuestionEngine(bank, r, seed);
  const out: (Pick & { kind: MinionType })[] = [];
  for (let i = 0; i < n; i++) {
    const kind = KINDS[i % KINDS.length]!;
    const p = nextQuestion(e, tier, kind);
    out.push({ ...p, kind });
    e = p.engine;
  }
  return out;
}

describe('rank drives the question mix (#40)', () => {
  it('a Year 4 player gets Year 4 questions, review from Years 1-3 and stretch from Year 5', () => {
    const picks = draw(4, 3000);
    const tiersOf = (band: string) =>
      new Set(picks.filter((p) => p.band === band).map((p) => p.question.tier));
    expect(tiersOf('onLevel')).toEqual(new Set([4]));
    expect(tiersOf('review')).toEqual(new Set([1, 2, 3]));
    expect(tiersOf('stretch')).toEqual(new Set([5]));
    const share = (band: string) => picks.filter((p) => p.band === band).length / picks.length;
    expect(share('onLevel')).toBeCloseTo(ranks.questionMix.onLevel, 1);
    expect(share('review')).toBeCloseTo(ranks.questionMix.review, 1);
    expect(share('stretch')).toBeCloseTo(ranks.questionMix.stretch, 1);
    // Below the top Year the minion always decides the type.
    for (const p of picks) expect(p.question.type).toBe(questionTypeFor(p.kind));
  });

  it('every Year gets questions from its own Year most of the time', () => {
    for (let tier = 1; tier <= 6; tier++) {
      const picks = draw(tier, 600, ranks, tier);
      const own = picks.filter((p) => p.question.tier === tier).length / picks.length;
      expect(own, `Year ${tier}`).toBeGreaterThan(0.65);
      // Never above the Year above, never below Year 1.
      for (const p of picks) expect(p.question.tier).toBeLessThanOrEqual(Math.min(6, tier + 1));
    }
  });

  it('Year 6 stretch draws harder Year 6 items: the next harder question type', () => {
    expect(ranks.questionEngine.topTierStretch).toBe('harderType');
    expect(harderType('fluency')).toBe('application');
    expect(harderType('application')).toBe('multistep');
    expect(harderType('multistep')).toBe('multistep');
    const picks = draw(6, 3000);
    const stretch = picks.filter((p) => p.band === 'stretch');
    expect(stretch.length).toBeGreaterThan(200);
    for (const p of stretch) {
      expect(p.question.tier).toBe(6);
      expect(p.question.type).toBe(harderType(questionTypeFor(p.kind)));
    }
    // On-level Year 6 questions keep the minion's type.
    for (const p of picks.filter((x) => x.band === 'onLevel'))
      expect(p.question.type).toBe(questionTypeFor(p.kind));
  });

  it('a harder Year 6 question gets the timer of its own type', () => {
    let s = createSession(createQuestionEngine(bank, ranks, 9), econ);
    let checked = 0;
    for (let i = 0; i < 400 && checked < 5; i++) {
      s = onLastHit(s, 'infantry', { gold: 14, exp: 30, at: { x: 0, y: 0 } }, i * 100, 6).session;
      const a = s.active!;
      if (a.band === 'stretch') {
        expect(a.question.type).toBe('application');
        expect(a.deadline - a.shownAt).toBe(econ.questionSeconds.lancer);
        checked++;
      }
      s = tick(s, i * 100 + 50).session; // time out, clear the reveal
      s = tick(s, i * 100 + 99).session;
    }
    expect(checked).toBe(5);
  });

  it('with topTierStretch "sameType" Year 6 stretch keeps the minion type', () => {
    const same = {
      ...ranks,
      questionEngine: { ...ranks.questionEngine, topTierStretch: 'sameType' as const },
    };
    for (const p of draw(6, 600, same).filter((x) => x.band === 'stretch'))
      expect(p.question.type).toBe(questionTypeFor(p.kind));
  });
});
