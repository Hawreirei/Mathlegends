import { describe, expect, it } from 'vitest';
import ranksJson from '../src/data/ranks.json';
import { loadRanks } from '../src/systems/data';
import type { MinionType } from '../src/systems/economy';
import { loadQuestionBank } from '../src/systems/questionBank';
import {
  createQuestionEngine,
  nextQuestion,
  questionTypeFor,
  type QuestionEngine,
} from '../src/systems/questionEngine';

const ranks = loadRanks(ranksJson);
const bank = loadQuestionBank();
const MINIONS: MinionType[] = ['infantry', 'lancer', 'cannon'];

function draw(
  e: QuestionEngine,
  n: number,
  tierOf: (i: number) => number,
  minionOf: (i: number) => MinionType,
) {
  const out = [];
  let s = e;
  for (let i = 0; i < n; i++) {
    const r = nextQuestion(s, tierOf(i), minionOf(i));
    s = r.engine;
    out.push(r);
  }
  return out;
}

describe('question bank', () => {
  it('loads all 300 questions, validated', () => {
    expect(bank.length).toBe(300);
  });
});

describe('question type by minion', () => {
  it('Infantry = fluency, Lancer = application, Cannon = multistep', () => {
    expect(questionTypeFor('infantry')).toBe('fluency');
    expect(questionTypeFor('lancer')).toBe('application');
    expect(questionTypeFor('cannon')).toBe('multistep');
  });

  it('serves questions of that type', () => {
    const picks = draw(
      createQuestionEngine(bank, ranks, 1),
      300,
      () => 3,
      (i) => MINIONS[i % 3]!,
    );
    picks.forEach((p, i) => expect(p.question.type).toBe(questionTypeFor(MINIONS[i % 3]!)));
  });
});

describe('no repeats', () => {
  const window = ranks.questionEngine.repeatWindow;
  const assertNoRepeat = (ids: string[]) => {
    for (let i = 0; i < ids.length; i++) {
      const recent = ids.slice(Math.max(0, i - window + 1), i);
      expect(recent, `repeat of ${ids[i]} at draw ${i}`).not.toContain(ids[i]);
    }
  };

  it(`never repeats within ${window} questions in mixed play (2000 draws)`, () => {
    const picks = draw(
      createQuestionEngine(bank, ranks, 7),
      2000,
      (i) => 1 + (Math.floor(i / 97) % 6),
      (i) => MINIONS[(i * 7) % 5 === 0 ? 2 : i % 2]!,
    );
    assertNoRepeat(picks.map((p) => p.question.id));
  });

  for (const tier of [1, 2, 3, 4, 5, 6])
    for (const minion of MINIONS)
      it(`never repeats within ${window} even with only ${minion} at tier ${tier} (worst case)`, () => {
        const picks = draw(
          createQuestionEngine(bank, ranks, tier * 10),
          200,
          () => tier,
          () => minion,
        );
        assertNoRepeat(picks.map((p) => p.question.id));
      });
});

describe('70 / 20 / 10 mix', () => {
  for (const tier of [2, 3, 4, 5])
    it(`at tier ${tier}, 1000 draws land within 3% of the mix`, () => {
      const picks = draw(
        createQuestionEngine(bank, ranks, 100 + tier),
        1000,
        () => tier,
        (i) => MINIONS[i % 3]!,
      );
      const share = (band: string) => picks.filter((p) => p.band === band).length / picks.length;
      expect(Math.abs(share('onLevel') - ranks.questionMix.onLevel)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(share('review') - ranks.questionMix.review)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(share('stretch') - ranks.questionMix.stretch)).toBeLessThanOrEqual(0.03);
    });

  it('serves the band’s tier: on-level = tier, review = below, stretch = above', () => {
    const picks = draw(
      createQuestionEngine(bank, ranks, 3),
      1000,
      () => 4,
      () => 'infantry',
    );
    for (const p of picks) {
      if (p.band === 'onLevel') expect(p.question.tier).toBe(4);
      if (p.band === 'review') expect(p.question.tier).toBeLessThan(4);
      if (p.band === 'stretch') expect(p.question.tier).toBe(5);
    }
    const reviews = picks.filter((p) => p.band === 'review');
    const prev = reviews.filter((p) => p.question.tier === 3).length / reviews.length;
    expect(Math.abs(prev - ranks.questionEngine.reviewPreviousTierShare)).toBeLessThan(0.1);
  });

  it('Year 1 has nothing below: its review share becomes on-level', () => {
    const picks = draw(
      createQuestionEngine(bank, ranks, 9),
      1000,
      () => 1,
      () => 'infantry',
    );
    expect(picks.some((p) => p.band === 'review')).toBe(false);
    expect(picks.every((p) => p.question.tier <= 2)).toBe(true);
  });

  it('Year 6 stretch stays in Year 6', () => {
    const picks = draw(
      createQuestionEngine(bank, ranks, 11),
      500,
      () => 6,
      () => 'infantry',
    );
    for (const p of picks.filter((x) => x.band === 'stretch')) expect(p.question.tier).toBe(6);
  });
});

describe('determinism', () => {
  it('the same seed gives the same questions', () => {
    const a = draw(
      createQuestionEngine(bank, ranks, 42),
      50,
      () => 3,
      (i) => MINIONS[i % 3]!,
    ).map((p) => p.question.id);
    const b = draw(
      createQuestionEngine(bank, ranks, 42),
      50,
      () => 3,
      (i) => MINIONS[i % 3]!,
    ).map((p) => p.question.id);
    expect(a).toEqual(b);
  });
});
