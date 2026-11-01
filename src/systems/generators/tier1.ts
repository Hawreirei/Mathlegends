import {
  distinctInts,
  int,
  list,
  pick,
  T,
  THINGS,
  twoNames,
  type Family,
  type Rng,
  type Spec,
} from './core.ts';

export const count20: Family = {
  topic: 't1.count20',
  tier: 1,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const form = int(rng, 0, 2);
      if (form === 0) {
        const n = int(rng, 1, 19);
        return {
          stem: T((l) =>
            l === 'id'
              ? `Bilangan berapa yang tepat sesudah ${n}?`
              : `Which number comes just after ${n}?`,
          ),
          answer: n + 1,
          distractors: [n - 1, n, n + 2],
          explanation: T((l) =>
            l === 'id'
              ? `Sesudah ${n} adalah ${n + 1}, karena ${n} + 1 = ${n + 1}.`
              : `After ${n} comes ${n + 1}, because ${n} + 1 = ${n + 1}.`,
          ),
        };
      }
      if (form === 1) {
        const n = int(rng, 2, 20);
        return {
          stem: T((l) =>
            l === 'id'
              ? `Bilangan berapa yang tepat sebelum ${n}?`
              : `Which number comes just before ${n}?`,
          ),
          answer: n - 1,
          distractors: [n + 1, n, n - 2],
          explanation: T((l) =>
            l === 'id'
              ? `Sebelum ${n} adalah ${n - 1}, karena ${n} - 1 = ${n - 1}.`
              : `Before ${n} comes ${n - 1}, because ${n} - 1 = ${n - 1}.`,
          ),
        };
      }
      const nums = distinctInts(rng, 4, 1, 20);
      const max = Math.max(...nums);
      const s = nums.map(String);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Bilangan mana yang paling besar: ${list(s, l, 'or')}?`
            : `Which number is the largest: ${list(s, l, 'or')}?`,
        ),
        answer: max,
        distractors: nums.filter((x) => x !== max),
        explanation: T((l) =>
          l === 'id'
            ? `${max} paling besar karena letaknya paling jauh pada garis bilangan.`
            : `${max} is the largest because it is furthest along the number line.`,
        ),
      };
    },
  },
};

export const addsub20: Family = {
  topic: 't1.addsub20',
  tier: 1,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.5) {
        const a = int(rng, 2, 10);
        const b = int(rng, 2, 20 - a > 10 ? 10 : 20 - a);
        return {
          stem: T((l) => (l === 'id' ? `Berapa ${a} + ${b}?` : `What is ${a} + ${b}?`)),
          answer: a + b,
          distractors: [a + b - 1, a + b + 1, Math.abs(a - b)],
          explanation: T((l) =>
            l === 'id'
              ? `Mulai dari ${a}, hitung maju ${b}: ${a} + ${b} = ${a + b}.`
              : `Start at ${a} and count on ${b}: ${a} + ${b} = ${a + b}.`,
          ),
        };
      }
      const a = int(rng, 6, 20);
      const b = int(rng, 2, a - 1);
      return {
        stem: T((l) => (l === 'id' ? `Berapa ${a} - ${b}?` : `What is ${a} - ${b}?`)),
        answer: a - b,
        distractors: [a - b + 1, a - b - 1, a + b],
        explanation: T((l) =>
          l === 'id'
            ? `Mulai dari ${a}, hitung mundur ${b}: ${a} - ${b} = ${a - b}.`
            : `Start at ${a} and count back ${b}: ${a} - ${b} = ${a - b}.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const [n, m] = twoNames(rng);
      const t = pick(rng, THINGS);
      if (rng() < 0.5) {
        const a = int(rng, 3, 12);
        const b = int(rng, 2, 20 - a);
        return {
          stem: T((l) =>
            l === 'id'
              ? `${n} punya ${a} ${t.id}. ${m} memberi ${n} ${b} ${t.id} lagi. Berapa ${t.id} ${n} sekarang?`
              : `${n} has ${a} ${t.en}. ${m} gives ${n} ${b} more ${t.en}. How many ${t.en} does ${n} have now?`,
          ),
          answer: a + b,
          distractors: [Math.abs(a - b), a + b + 1, a + b - 1],
          explanation: T((l) =>
            l === 'id'
              ? `Mendapat lagi berarti tambah: ${a} + ${b} = ${a + b}.`
              : `Getting more means add: ${a} + ${b} = ${a + b}.`,
          ),
        };
      }
      const a = int(rng, 8, 20);
      const b = int(rng, 2, a - 2);
      return {
        stem: T((l) =>
          l === 'id'
            ? `${n} punya ${a} ${t.id}. ${n} memberi ${b} ${t.id} kepada ${m}. Berapa ${t.id} ${n} sekarang?`
            : `${n} has ${a} ${t.en}. ${n} gives ${b} ${t.en} to ${m}. How many ${t.en} does ${n} have now?`,
        ),
        answer: a - b,
        distractors: [a + b, a - b + 1, a - b - 1],
        explanation: T((l) =>
          l === 'id'
            ? `Memberi berarti berkurang: ${a} - ${b} = ${a - b}.`
            : `Giving away means take away: ${a} - ${b} = ${a - b}.`,
        ),
      };
    },
    multistep: (rng: Rng): Spec<number> => {
      const a = int(rng, 4, 10);
      const b = int(rng, 2, 20 - a);
      const c = int(rng, 1, a + b - 1);
      const ans = a + b - c;
      return {
        stem: T((l) =>
          l === 'id'
            ? `Di dalam bus ada ${a} penumpang. Di halte pertama ${b} orang naik. Di halte kedua ${c} orang turun. Berapa penumpang di bus sekarang?`
            : `A bus has ${a} passengers. At the first stop ${b} people get on. At the second stop ${c} people get off. How many passengers are on the bus now?`,
        ),
        answer: ans,
        distractors: [a + b, a + b + c, ans + 1],
        explanation: T((l) =>
          l === 'id'
            ? `Naik berarti tambah: ${a} + ${b} = ${a + b}. Turun berarti kurang: ${a + b} - ${c} = ${ans}.`
            : `Getting on means add: ${a} + ${b} = ${a + b}. Getting off means subtract: ${a + b} - ${c} = ${ans}.`,
        ),
      };
    },
  },
};

export const pattern: Family = {
  topic: 't1.pattern',
  tier: 1,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const up = rng() < 0.6;
      const step = int(rng, 1, 5);
      const start = up ? int(rng, 0, 10) : int(rng, 4 * step + 1, 4 * step + 15);
      const s = up ? step : -step;
      const terms = [0, 1, 2, 3].map((i) => start + i * s);
      const next = start + 4 * s;
      const last = terms[3] as number;
      return {
        stem: T((l) =>
          l === 'id'
            ? `${terms.join(', ')}, ... Bilangan berikutnya adalah?`
            : `${terms.join(', ')}, ... What number comes next?`,
        ),
        answer: next,
        distractors: [next + s, next + 1, next - 1],
        explanation: T((l) =>
          l === 'id'
            ? `Setiap langkah ${up ? 'bertambah' : 'berkurang'} ${step}. Jadi ${last} ${up ? '+' : '-'} ${step} = ${next}.`
            : `Each step ${up ? 'adds' : 'takes away'} ${step}. So ${last} ${up ? '+' : '-'} ${step} = ${next}.`,
        ),
      };
    },
  },
};

// Second two-step template (#12), so Year 1 Cannon questions are not all about buses.
const busStep = addsub20.makers.multistep!;
addsub20.makers.multistep = (rng: Rng): Spec<unknown> => {
  if (rng() < 0.5) return busStep(rng);
  const [n, m] = twoNames(rng);
  const t = pick(rng, THINGS);
  const a = int(rng, 3, 10);
  const b = int(rng, 2, 20 - a);
  const c = int(rng, 1, a + b - 1);
  const ans = a + b - c;
  return {
    stem: T((l) =>
      l === 'id'
        ? `${n} punya ${a} ${t.id}. ${m} memberi ${n} ${b} ${t.id} lagi. Lalu ${n} memberikan ${c} ${t.id} kepada adiknya. Berapa ${t.id} ${n} sekarang?`
        : `${n} has ${a} ${t.en}. ${m} gives ${n} ${b} more ${t.en}. Then ${n} gives ${c} ${t.en} to a younger sibling. How many ${t.en} does ${n} have now?`,
    ),
    answer: ans,
    distractors: [a + b, a + b + c, ans + 1],
    explanation: T((l) =>
      l === 'id'
        ? `Mendapat berarti tambah: ${a} + ${b} = ${a + b}. Memberikan berarti kurang: ${a + b} - ${c} = ${ans}.`
        : `Getting more means add: ${a} + ${b} = ${a + b}. Giving away means subtract: ${a + b} - ${c} = ${ans}.`,
    ),
  };
};

export const TIER1 = [count20, addsub20, pattern];
