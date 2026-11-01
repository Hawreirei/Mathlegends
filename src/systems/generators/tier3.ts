import {
  distinctInts,
  fracKey,
  fracStr,
  int,
  list,
  pick,
  T,
  THINGS,
  twoNames,
  L,
  type Family,
  type Frac,
  type Rng,
  type Spec,
} from './core.ts';
import { noCarrySum, smallerFromLarger } from './tier2.ts';

const PLACE = [L('ratusan', 'hundreds'), L('puluhan', 'tens'), L('satuan', 'ones')];

export const place1000: Family = {
  topic: 't3.place1000',
  tier: 3,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const [h, t, u] = distinctInts(rng, 3, 1, 9) as [number, number, number];
      const n = h * 100 + t * 10 + u;
      const pos = int(rng, 0, 2);
      const d = [h, t, u][pos] as number;
      const place = [100, 10, 1][pos] as number;
      const ans = d * place;
      return {
        stem: T((l) =>
          l === 'id'
            ? `Pada bilangan ${n}, angka ${d} bernilai berapa?`
            : `In the number ${n}, what is the value of the digit ${d}?`,
        ),
        answer: ans,
        distractors: [d, d * 10, d * 100, [h, t, u][(pos + 1) % 3]! * place],
        explanation: T((l) =>
          l === 'id'
            ? `Angka ${d} ada di tempat ${PLACE[pos]!.id}, jadi nilainya ${d} × ${place} = ${ans}.`
            : `The digit ${d} is in the ${PLACE[pos]!.en} place, so its value is ${d} × ${place} = ${ans}.`,
        ),
      };
    },
  },
};

export const addsub1000: Family = {
  topic: 't3.addsub1000',
  tier: 3,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.5) {
        let a = 0;
        let b = 0;
        do {
          a = int(rng, 105, 599);
          b = int(rng, 105, 399);
        } while (a + b > 999 || noCarrySum(a, b) === a + b);
        return {
          stem: T((l) => (l === 'id' ? `Berapa ${a} + ${b}?` : `What is ${a} + ${b}?`)),
          answer: a + b,
          distractors: [noCarrySum(a, b), a + b + 10, a + b - 100],
          explanation: T((l) =>
            l === 'id'
              ? `Jumlahkan mulai dari satuan, lalu puluhan, lalu ratusan, dan jangan lupa menyimpan: ${a} + ${b} = ${a + b}.`
              : `Add the ones, then the tens, then the hundreds, and remember to carry: ${a} + ${b} = ${a + b}.`,
          ),
        };
      }
      let a = 0;
      let b = 0;
      do {
        a = int(rng, 300, 999);
        b = int(rng, 105, a - 50);
      } while (smallerFromLarger(a, b) === a - b);
      return {
        stem: T((l) => (l === 'id' ? `Berapa ${a} - ${b}?` : `What is ${a} - ${b}?`)),
        answer: a - b,
        distractors: [smallerFromLarger(a, b), a - b + 10, a - b + 100],
        explanation: T((l) =>
          l === 'id'
            ? `Kurangkan mulai dari satuan. Jika angka atas lebih kecil, pinjam dari tempat di kirinya: ${a} - ${b} = ${a - b}.`
            : `Subtract starting with the ones. If the top digit is smaller, exchange from the place to its left: ${a} - ${b} = ${a - b}.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      if (rng() < 0.5) {
        const a = int(rng, 120, 480);
        const b = int(rng, 120, 480);
        return {
          stem: T((l) =>
            l === 'id'
              ? `Sebuah sekolah punya ${a} siswa laki-laki dan ${b} siswa perempuan. Berapa jumlah semua siswa?`
              : `A school has ${a} boys and ${b} girls. How many students are there in total?`,
          ),
          answer: a + b,
          distractors: [noCarrySum(a, b), Math.abs(a - b), a + b + 100],
          explanation: T((l) =>
            l === 'id'
              ? `Jumlah semua berarti tambah: ${a} + ${b} = ${a + b}.`
              : `In total means add: ${a} + ${b} = ${a + b}.`,
          ),
        };
      }
      const t = pick(rng, THINGS);
      const a = int(rng, 300, 950);
      const b = int(rng, 110, a - 60);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Sebuah toko punya ${a} ${t.id}. Hari ini terjual ${b} ${t.id}. Berapa ${t.id} yang tersisa?`
            : `A shop has ${a} ${t.en}. Today it sells ${b} ${t.en}. How many ${t.en} are left?`,
        ),
        answer: a - b,
        distractors: [smallerFromLarger(a, b), a - b + 100, a - b - 10],
        explanation: T((l) =>
          l === 'id'
            ? `Terjual berarti berkurang: ${a} - ${b} = ${a - b}.`
            : `Sold means taken away: ${a} - ${b} = ${a - b}.`,
        ),
      };
    },
  },
};

export const muldiv100: Family = {
  topic: 't3.muldiv100',
  tier: 3,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const a = int(rng, 2, 10);
      const b = int(rng, 2, 10);
      if (rng() < 0.6) {
        return {
          stem: T((l) => (l === 'id' ? `Berapa ${a} × ${b}?` : `What is ${a} × ${b}?`)),
          answer: a * b,
          distractors: [a * (b + 1), a * (b - 1), a + b, (a + 1) * b],
          explanation: T((l) =>
            l === 'id'
              ? `${a} × ${b} artinya ${a} kelompok berisi ${b}, jadi ${a * b}.`
              : `${a} × ${b} means ${a} groups of ${b}, which is ${a * b}.`,
          ),
        };
      }
      const p = a * b;
      return {
        stem: T((l) => (l === 'id' ? `Berapa ${p} ÷ ${a}?` : `What is ${p} ÷ ${a}?`)),
        answer: b,
        distractors: [b + 1, b - 1, p - a],
        explanation: T((l) =>
          l === 'id'
            ? `${p} ÷ ${a} = ${b}, karena ${a} × ${b} = ${p}.`
            : `${p} ÷ ${a} = ${b}, because ${a} × ${b} = ${p}.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 10);
      const p = a * b;
      const t = pick(rng, THINGS);
      return {
        stem: T((l) =>
          l === 'id'
            ? `${p} ${t.id} dibagi sama rata kepada ${a} anak. Berapa ${t.id} yang didapat setiap anak?`
            : `${p} ${t.en} are shared equally between ${a} children. How many ${t.en} does each child get?`,
        ),
        answer: b,
        distractors: [b + 1, b - 1, p - a],
        explanation: T((l) =>
          l === 'id'
            ? `Dibagi sama rata berarti bagi: ${p} ÷ ${a} = ${b}.`
            : `Sharing equally means divide: ${p} ÷ ${a} = ${b}.`,
        ),
      };
    },
    multistep: (rng: Rng): Spec<number> => {
      const [n] = twoNames(rng);
      const a = int(rng, 2, 9);
      const b = int(rng, 3, 10);
      const c = int(rng, 1, a * b - 2);
      const ans = a * b - c;
      const sheets = rng() < 0.5;
      return {
        stem: T((l) =>
          sheets
            ? l === 'id'
              ? `${n} membeli ${a} lembar stiker. Setiap lembar berisi ${b} stiker. ${n} memberikan ${c} stiker kepada adiknya. Berapa stiker ${n} sekarang?`
              : `${n} buys ${a} sheets of stickers. Each sheet has ${b} stickers. ${n} gives ${c} stickers to a younger sibling. How many stickers does ${n} have now?`
            : l === 'id'
              ? `${n} membeli ${a} kotak pensil. Setiap kotak berisi ${b} pensil. ${n} memberikan ${c} pensil kepada temannya. Berapa pensil ${n} sekarang?`
              : `${n} buys ${a} boxes of pencils. Each box has ${b} pencils. ${n} gives ${c} pencils to a friend. How many pencils does ${n} have now?`,
        ),
        answer: ans,
        distractors: [a * b, a * b + c, a + b - c],
        explanation: T((l) =>
          l === 'id'
            ? `Pertama kalikan: ${a} × ${b} = ${a * b}. Lalu kurangi: ${a * b} - ${c} = ${ans}.`
            : `First multiply: ${a} × ${b} = ${a * b}. Then subtract: ${a * b} - ${c} = ${ans}.`,
        ),
      };
    },
  },
};

export const fractionCompare: Family = {
  topic: 't3.fraction_compare',
  tier: 3,
  makers: {
    fluency: (rng: Rng): Spec<Frac> => {
      const largest = rng() < 0.6;
      let fr: Frac[];
      let explain: (l: 'id' | 'en', best: string) => string;
      if (rng() < 0.5) {
        fr = distinctInts(rng, 4, 2, 10).map((d): Frac => [1, d]);
        explain = (l, best) =>
          l === 'id'
            ? `Pembilangnya sama (1). Penyebut yang lebih ${largest ? 'kecil' : 'besar'} berarti potongannya lebih ${largest ? 'besar' : 'kecil'}. Jadi ${best} paling ${largest ? 'besar' : 'kecil'}.`
            : `The numerators are the same (1). A ${largest ? 'smaller' : 'bigger'} denominator means ${largest ? 'bigger' : 'smaller'} pieces. So ${best} is the ${largest ? 'largest' : 'smallest'}.`;
      } else {
        const d = int(rng, 5, 12);
        fr = distinctInts(rng, 4, 1, d - 1).map((n): Frac => [n, d]);
        explain = (l, best) =>
          l === 'id'
            ? `Penyebutnya sama (${d}), jadi bandingkan pembilangnya. ${best} paling ${largest ? 'besar' : 'kecil'}.`
            : `The denominators are the same (${d}), so compare the numerators. ${best} is the ${largest ? 'largest' : 'smallest'}.`;
      }
      const val = (f: Frac) => f[0] / f[1];
      const sorted = [...fr].sort((x, y) => val(x) - val(y));
      const ans = (largest ? sorted[3] : sorted[0]) as Frac;
      const s = fr.map(fracStr);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Pecahan mana yang paling ${largest ? 'besar' : 'kecil'}: ${list(s, l, 'or')}?`
            : `Which fraction is the ${largest ? 'largest' : 'smallest'}: ${list(s, l, 'or')}?`,
        ),
        answer: ans,
        distractors: fr.filter((f) => f !== ans),
        key: fracKey,
        render: fracStr,
        valid: () => true,
        explanation: T((l) => explain(l, fracStr(ans))),
      };
    },
  },
};

const CONVERSIONS = [
  { from: 'm', to: 'cm', factor: 100 },
  { from: 'km', to: 'm', factor: 1000 },
  { from: 'kg', to: 'g', factor: 1000 },
  { from: 'cm', to: 'mm', factor: 10 },
] as const;
/** English unit names for the question text. */
const UNIT_EN: Record<string, string> = {
  mm: 'millimetres',
  cm: 'centimetres',
  m: 'metres',
  km: 'kilometres',
  g: 'grams',
  kg: 'kilograms',
};

export const stdUnits: Family = {
  topic: 't3.std_units',
  tier: 3,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const c = pick(rng, CONVERSIONS);
      const n = int(rng, 2, 9);
      const down = rng() < 0.7; // big unit -> small unit
      const [fromU, toU] = down ? [c.from, c.to] : [c.to, c.from];
      const value = down ? n : n * c.factor;
      const ans = down ? n * c.factor : n;
      const other = [10, 100, 1000].filter((f) => f !== c.factor);
      const wrong = down ? other.map((f) => n * f) : other.map((f) => (n * c.factor) / f);
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `${f(value)} ${fromU} sama dengan berapa ${toU}?`
            : `How many ${UNIT_EN[toU]} (${toU}) are in ${f(value)} ${fromU}?`,
        ),
        answer: ans,
        distractors: [...wrong, n + c.factor],
        valid: (v) => Number.isInteger(v) && (v as number) > 0,
        explanation: T((l, f) =>
          l === 'id'
            ? `1 ${c.from} = ${f(c.factor)} ${c.to}. Jadi ${f(value)} ${fromU} = ${f(ans)} ${toU}.`
            : `1 ${c.from} = ${f(c.factor)} ${c.to}. So ${f(value)} ${fromU} = ${f(ans)} ${toU}.`,
        ),
      };
    },
  },
};

// Two-step add then subtract within 1,000 (#12).
addsub1000.makers.multistep = (rng: Rng): Spec<number> => {
  const a = int(rng, 300, 650);
  const b = int(rng, 100, 999 - a);
  const c = int(rng, 20, 99);
  const ans = a + b - c;
  return {
    stem: T((l) =>
      l === 'id'
        ? `Perpustakaan sekolah punya ${a} buku. Datang ${b} buku baru, lalu ${c} buku yang rusak disingkirkan. Berapa buku di perpustakaan sekarang?`
        : `The school library has ${a} books. ${b} new books arrive, then ${c} damaged books are removed. How many books does the library have now?`,
    ),
    answer: ans,
    distractors: [a + b, a + b + c, a - b + c],
    explanation: T((l) =>
      l === 'id'
        ? `Buku baru berarti tambah: ${a} + ${b} = ${a + b}. Disingkirkan berarti kurang: ${a + b} - ${c} = ${ans}.`
        : `New books means add: ${a} + ${b} = ${a + b}. Removed means subtract: ${a + b} - ${c} = ${ans}.`,
    ),
  };
};

export const TIER3 = [place1000, addsub1000, muldiv100, fractionCompare, stdUnits];
