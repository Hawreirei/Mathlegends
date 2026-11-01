import { describe, expect, it } from 'vitest';
import curriculum from '../src/data/curriculum.json';
import sample from '../src/data/questions/t1.json';
import broken from './fixtures/broken-questions.json';
import {
  assertValidQuestions,
  topicTiersFromCurriculum,
  validateQuestions,
  type Question,
} from '../src/systems/questions';

const topics = topicTiersFromCurriculum(curriculum);

const good = (): Question => ({
  id: 't3.muldiv100.test.001',
  tier: 3,
  type: 'fluency',
  topic: 't3.muldiv100',
  stem: { id: 'Berapa 6 × 7?', en: 'What is 6 × 7?' },
  choices: [42, 36, 48, 13],
  answerIndex: 0,
  explanation: { id: '6 × 7 = 42.', en: '6 × 7 = 42.' },
});

const errorsFor = (items: unknown[]) => validateQuestions(items, topics).map((e) => e.message);

describe('question validator', () => {
  it('accepts a valid item', () => {
    expect(validateQuestions([good()], topics)).toEqual([]);
  });

  it('accepts the committed bank files', () => {
    expect(validateQuestions(sample, topics)).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    const b = good();
    b.stem = { id: 'Berapa 7 × 6?', en: 'What is 7 × 6?' };
    expect(errorsFor([good(), b]).join()).toMatch(/duplicate id/);
  });

  it('rejects duplicate stems', () => {
    const b = good();
    b.id = 't3.muldiv100.test.002';
    expect(errorsFor([good(), b]).join()).toMatch(/duplicate stem/);
  });

  it('rejects a bad answerIndex', () => {
    expect(errorsFor([{ ...good(), answerIndex: 4 }]).join()).toMatch(/answerIndex/);
    expect(errorsFor([{ ...good(), answerIndex: 1.5 }]).join()).toMatch(/answerIndex/);
  });

  it('rejects a missing explanation or a missing language', () => {
    const noExpl: Partial<Question> = good();
    delete noExpl.explanation;
    expect(errorsFor([noExpl]).join()).toMatch(/explanation/);
    expect(errorsFor([{ ...good(), stem: { id: 'Berapa 6 × 7?', en: '' } }]).join()).toMatch(
      /stem.en/,
    );
    expect(errorsFor([{ ...good(), explanation: { en: '42' } }]).join()).toMatch(/explanation.id/);
  });

  it('requires exactly 4 distinct choices', () => {
    expect(errorsFor([{ ...good(), choices: [42, 36, 48] }]).join()).toMatch(/4 choices/);
    expect(errorsFor([{ ...good(), choices: [42, 42, 48, 13] }]).join()).toMatch(/distinct/);
  });

  it('checks the topic exists and belongs to the item tier', () => {
    expect(errorsFor([{ ...good(), topic: 't3.nope' }]).join()).toMatch(/unknown topic/);
    expect(errorsFor([{ ...good(), tier: 4 }]).join()).toMatch(/tier 3/);
  });

  it('checks tier, type, timeSec and tags', () => {
    expect(errorsFor([{ ...good(), tier: 7 }]).join()).toMatch(/tier/);
    expect(errorsFor([{ ...good(), type: 'easy' }]).join()).toMatch(/type/);
    expect(errorsFor([{ ...good(), timeSec: 0 }]).join()).toMatch(/timeSec/);
    expect(errorsFor([{ ...good(), tags: 'x' }]).join()).toMatch(/tags/);
  });

  it('flags every item in the deliberately broken fixture', () => {
    const errs = validateQuestions(broken, topics);
    const badIndexes = new Set(errs.map((e) => e.index));
    expect(badIndexes.size).toBe(broken.length);
  });

  it('assertValidQuestions throws a readable error', () => {
    expect(() => assertValidQuestions(broken, topics, 'broken.json')).toThrow(/broken\.json/);
  });
});
