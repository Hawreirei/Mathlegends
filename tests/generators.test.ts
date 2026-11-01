import { describe, expect, it } from 'vitest';
import curriculum from '../src/data/curriculum.json';
import { FAMILIES, generateQuestions, supportedTypes } from '../src/systems/generators';
import { fmt, gcd, lcm, reduce } from '../src/systems/generators/core';
import {
  topicTiersFromCurriculum,
  validateQuestions,
  type Choice,
  type Question,
} from '../src/systems/questions';

const topics = topicTiersFromCurriculum(curriculum);
const genFlag = new Map(
  curriculum.tiers.flatMap((t) => t.topics.map((x) => [x.id, x.generator] as const)),
);
const SEED = 20261101;
const PER_TYPE = 40;

/** Every (family, type) batch, generated once. */
const batches = FAMILIES.flatMap((f) =>
  supportedTypes(f.topic).map((type) => ({
    topic: f.topic,
    type,
    qs: generateQuestions(f.topic, type, PER_TYPE, SEED),
  })),
);
const all: Question[] = batches.flatMap((b) => b.qs);

/** Numeric value of a choice, reading the English form ("1,250" -> 1250, "3/4" -> 0.75, "Rp2,500" -> 2500). */
function value(c: Choice): number {
  const s = typeof c === 'number' ? String(c) : typeof c === 'string' ? c : c.en;
  const clean = s.replace(/^Rp/, '').replace(/%$/, '').replace(/,/g, '').trim();
  const ratio = clean.match(/^(\d+) : (\d+)$/);
  if (ratio) return Number(ratio[1]) / Number(ratio[2]);
  if (/^\d+\/\d+$/.test(clean)) {
    const [n, d] = clean.split('/').map(Number) as [number, number];
    return n / d;
  }
  return Number(clean);
}

const answerOf = (q: Question) => value(q.choices[q.answerIndex] as Choice);

describe('generator coverage', () => {
  it('has at least 12 topic families covering all 6 tiers', () => {
    expect(FAMILIES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(FAMILIES.map((f) => f.tier))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('only targets curriculum topics marked generator: true, with the right tier', () => {
    for (const f of FAMILIES) {
      expect(topics.get(f.topic), f.topic).toBe(f.tier);
      expect(genFlag.get(f.topic), f.topic).toBe(true);
    }
  });

  it(`makes at least 15 distinct questions per family and type (target for #12)`, () => {
    for (const b of batches) expect(b.qs.length, `${b.topic} ${b.type}`).toBeGreaterThanOrEqual(15);
  });
});

describe('generated questions', () => {
  it('all pass the question validator (ids, both languages, 4 distinct choices)', () => {
    const errors = validateQuestions(all, topics);
    expect(errors.slice(0, 5)).toEqual([]);
  });

  it('never contain undefined, NaN or Infinity in any text', () => {
    const bad = /undefined|NaN|Infinity|\[object/;
    for (const q of all) {
      const texts = [
        q.stem.id,
        q.stem.en,
        q.explanation.id,
        q.explanation.en,
        ...q.choices.map((c) => JSON.stringify(c)),
      ];
      for (const t of texts) expect(t, q.id).not.toMatch(bad);
    }
  });

  it('have no negative numeric choices', () => {
    for (const q of all)
      for (const c of q.choices)
        expect(value(c), `${q.id} ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(0);
  });

  it('spread the correct answer across all four positions', () => {
    const positions = new Set(all.map((q) => q.answerIndex));
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });

  it('are deterministic for a fixed seed and differ for another seed', () => {
    const a = generateQuestions('t3.muldiv100', 'fluency', 10, 7);
    const b = generateQuestions('t3.muldiv100', 'fluency', 10, 7);
    const c = generateQuestions('t3.muldiv100', 'fluency', 10, 8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('format numbers the Indonesian way in Indonesian text', () => {
    const q = generateQuestions('t5.big_numbers', 'fluency', 1, 3)[0] as Question;
    expect(q.stem.id).toMatch(/\d\.\d{3}/);
    expect(q.stem.en).toMatch(/\d,\d{3}/);
  });
});

describe('answers are mathematically correct', () => {
  const evalFrac = (s: string) => {
    const [n, d] = s.split('/').map(Number) as [number, number];
    return n / d;
  };

  it('for every "What is A op B?" question (re-computed from the stem)', () => {
    let checked = 0;
    for (const q of all) {
      const m = q.stem.en.match(/^What is ([\d,/]+) ([+\-×÷]) ([\d,/]+)\?$/);
      if (!m) continue;
      const a = m[1]!.includes('/') ? evalFrac(m[1]!) : Number(m[1]!.replace(/,/g, ''));
      const b = m[3]!.includes('/') ? evalFrac(m[3]!) : Number(m[3]!.replace(/,/g, ''));
      const expected = { '+': a + b, '-': a - b, '×': a * b, '÷': a / b }[
        m[2] as '+' | '-' | '×' | '÷'
      ];
      expect(answerOf(q), q.stem.en).toBeCloseTo(expected, 9);
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('for mixed operations (multiplication and division before addition and subtraction)', () => {
    let checked = 0;
    for (const q of all.filter((x) => x.topic === 't6.mixed_ops')) {
      const m = q.stem.en.match(/^What is (\d+) ([+-]) (\d+) ([×÷]) (\d+)\?$/);
      expect(m, q.stem.en).not.toBeNull();
      const [a, b, c] = [Number(m![1]), Number(m![3]), Number(m![5])];
      const right = m![4] === '×' ? b * c : b / c;
      expect(answerOf(q)).toBe(m![2] === '+' ? a + right : a - right);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('for word problems, spot-checked by topic', () => {
    for (const q of all) {
      const en = q.stem.en;
      let m: RegExpMatchArray | null;
      if (
        (m = en.match(
          /^A bus has (\d+) passengers\. At the first stop (\d+) .* At the second stop (\d+)/,
        ))
      )
        expect(answerOf(q)).toBe(+m[1]! + +m[2]! - +m[3]!);
      if (
        (m = en.match(/lowest common multiple \(LCM\) of (\d+) and (\d+)/)) ||
        (m = en.match(/every (\d+) seconds .* every (\d+) seconds/))
      )
        expect(answerOf(q)).toBe(lcm(+m[1]!, +m[2]!));
      if ((m = en.match(/highest common factor \(HCF\) of (\d+) and (\d+)/)))
        expect(answerOf(q)).toBe(gcd(+m[1]!, +m[2]!));
      if ((m = en.match(/^What is (\d+)% of (\d+)\?$/)))
        expect(answerOf(q)).toBe((+m[1]! * +m[2]!) / 100);
      if ((m = en.match(/travels at (\d+) km\/h for (\d+) hours/)))
        expect(answerOf(q)).toBe(+m[1]! * +m[2]!);
      if (
        (m = en.match(
          /^A rectangle is (\d+) cm long and (\d+) cm wide\. What is its (area|perimeter)/,
        ))
      )
        expect(answerOf(q)).toBe(m[3] === 'area' ? +m[1]! * +m[2]! : 2 * (+m[1]! + +m[2]!));
      if ((m = en.match(/^A cuboid is (\d+) cm long, (\d+) cm wide and (\d+) cm high/)))
        expect(answerOf(q)).toBe(+m[1]! * +m[2]! * +m[3]!);
      if (
        (m = en.match(
          /^Round ([\d,]+) to the nearest (ten|hundred|thousand|ten thousand|hundred thousand)\.$/,
        ))
      ) {
        const place = {
          ten: 10,
          hundred: 100,
          thousand: 1000,
          'ten thousand': 10000,
          'hundred thousand': 100000,
        }[m[2]!]!;
        const n = Number(m[1]!.replace(/,/g, ''));
        expect(answerOf(q)).toBe(Math.round(n / place) * place);
      }
      if ((m = en.match(/^Complete: (\d+)\/(\d+) = \.\.\.\/(\d+)$/)))
        expect(answerOf(q)).toBe((+m[1]! * +m[3]!) / +m[2]!);
      if ((m = en.match(/ratio of .* is (\d+) : (\d+)\. Together they have (\d+) marbles/)))
        expect(answerOf(q)).toBe((+m[3]! / (+m[1]! + +m[2]!)) * +m[2]!);
    }
  });

  it('fraction answers are in simplest form', () => {
    for (const q of all.filter((x) => ['t5.frac_addsub', 't6.frac_muldiv'].includes(x.topic))) {
      const c = q.choices[q.answerIndex];
      if (typeof c !== 'string' || !c.includes('/')) continue;
      const [n, d] = c.split('/').map(Number) as [number, number];
      expect(reduce([n, d]), q.stem.en).toEqual([n, d]);
    }
  });
});

describe('number formatting', () => {
  it('uses . for thousands and , for decimals in Indonesian; the reverse in English', () => {
    expect(fmt(1234567, 'id')).toBe('1.234.567');
    expect(fmt(1234567, 'en')).toBe('1,234,567');
    expect(fmt(0.75, 'id')).toBe('0,75');
    expect(fmt(0.75, 'en')).toBe('0.75');
    expect(fmt(999, 'id')).toBe('999');
  });
});
