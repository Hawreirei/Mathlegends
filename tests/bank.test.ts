import { describe, expect, it } from 'vitest';
import curriculum from '../src/data/curriculum.json';
import t1 from '../src/data/questions/t1.json';
import t2 from '../src/data/questions/t2.json';
import t3 from '../src/data/questions/t3.json';
import t4 from '../src/data/questions/t4.json';
import t5 from '../src/data/questions/t5.json';
import t6 from '../src/data/questions/t6.json';
import spot from '../docs/QUESTION-SPOT-CHECK.md?raw';
import { buildBank, serialize, spotCheck, TARGET } from '../scripts/build-question-bank';
import {
  QUESTION_TYPES,
  topicTiersFromCurriculum,
  validateQuestions,
  type Question,
} from '../src/systems/questions';

const committed = new Map<number, Question[]>(
  [t1, t2, t3, t4, t5, t6].map((qs, i) => [i + 1, qs as Question[]]),
);
const all = [...committed.values()].flat();

describe('question bank (#12)', () => {
  it('is up to date with the handwritten files and generators (run npm run build:questions)', () => {
    const fresh = buildBank();
    for (const [tier, qs] of fresh)
      expect(serialize(committed.get(tier)!), `t${tier}.json`).toBe(serialize(qs));
    expect(spot).toBe(spotCheck(fresh));
  });

  it('has 270 or more valid questions', () => {
    expect(all.length).toBeGreaterThanOrEqual(270);
    expect(validateQuestions(all, topicTiersFromCurriculum(curriculum))).toEqual([]);
  });

  it('has at least 15 items in every tier x type cell (targets 20/15/15)', () => {
    for (const [tier, qs] of committed)
      for (const type of QUESTION_TYPES) {
        const n = qs.filter((q) => q.type === type).length;
        expect(n, `tier ${tier} ${type}`).toBeGreaterThanOrEqual(15);
        expect(n).toBe(TARGET[type]);
      }
  });

  it('includes every curriculum topic at least once', () => {
    const used = new Set(all.map((q) => q.topic));
    for (const t of curriculum.tiers)
      for (const topic of t.topics) expect(used.has(topic.id), topic.id).toBe(true);
  });

  it('does not lean on a single template for two-step questions', () => {
    for (const [tier, qs] of committed) {
      const firstWords = new Map<string, number>();
      for (const q of qs.filter((x) => x.type === 'multistep')) {
        const k = q.stem.en.split(' ').slice(0, 3).join(' ');
        firstWords.set(k, (firstWords.get(k) ?? 0) + 1);
      }
      expect(Math.max(...firstWords.values()), `tier ${tier}`).toBeLessThanOrEqual(10);
    }
  });

  it('puts the correct answer in every position', () => {
    for (const qs of committed.values()) expect(new Set(qs.map((q) => q.answerIndex)).size).toBe(4);
  });
});
