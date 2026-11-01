import {
  fracKey,
  fracStr,
  gcd,
  int,
  lcm,
  list,
  pick,
  reduce,
  rupiah,
  shuffle,
  T,
  twoNames,
  L,
  type Family,
  type Frac,
  type Rng,
  type Spec,
} from './core';
import { roundingSpec } from './tier4';

export const bigNumbers: Family = {
  topic: 't5.big_numbers',
  tier: 5,
  makers: { fluency: (rng) => roundingSpec(rng, 10001, 999999, [1000, 10000, 100000]) },
};

const multiplesUpTo = (a: number, max: number) =>
  Array.from({ length: Math.floor(max / a) }, (_, i) => a * (i + 1));
const factors = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);

function lcmPair(rng: Rng): [number, number] {
  for (;;) {
    const a = int(rng, 2, 12);
    const b = int(rng, 2, 12);
    if (a !== b && lcm(a, b) <= 60 && a % b !== 0 && b % a !== 0) return [a, b];
  }
}

export const kpkFpb: Family = {
  topic: 't5.kpk_fpb',
  tier: 5,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.5) {
        const [a, b] = lcmPair(rng);
        const m = lcm(a, b);
        return {
          stem: T((l) =>
            l === 'id'
              ? `Berapa KPK dari ${a} dan ${b}?`
              : `What is the lowest common multiple (LCM) of ${a} and ${b}?`,
          ),
          answer: m,
          distractors: [a * b, gcd(a, b), a + b, m * 2],
          valid: (v) => (v as number) > 0,
          explanation: T((l) =>
            l === 'id'
              ? `Kelipatan ${a}: ${multiplesUpTo(a, m).join(', ')}. Kelipatan ${b}: ${multiplesUpTo(b, m).join(', ')}. Kelipatan persekutuan terkecil adalah ${m}.`
              : `Multiples of ${a}: ${multiplesUpTo(a, m).join(', ')}. Multiples of ${b}: ${multiplesUpTo(b, m).join(', ')}. The lowest common multiple is ${m}.`,
          ),
        };
      }
      let g = 0;
      let a = 0;
      let b = 0;
      do {
        g = int(rng, 2, 9);
        const x = int(rng, 2, 7);
        const y = int(rng, 2, 7);
        a = g * x;
        b = g * y;
        if (x === y || gcd(x, y) !== 1) a = 0;
      } while (a === 0 || a > 60 || b > 60);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Berapa FPB dari ${a} dan ${b}?`
            : `What is the highest common factor (HCF) of ${a} and ${b}?`,
        ),
        answer: g,
        distractors: [Math.min(a, b), 1, lcm(a, b), g * 2],
        valid: (v) => (v as number) > 0,
        explanation: T((l) =>
          l === 'id'
            ? `Faktor ${a}: ${factors(a).join(', ')}. Faktor ${b}: ${factors(b).join(', ')}. Faktor persekutuan terbesar adalah ${g}.`
            : `Factors of ${a}: ${factors(a).join(', ')}. Factors of ${b}: ${factors(b).join(', ')}. The highest common factor is ${g}.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const [a, b] = lcmPair(rng);
      const m = lcm(a, b);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Lampu merah menyala setiap ${a} detik dan lampu hijau menyala setiap ${b} detik. Keduanya baru saja menyala bersamaan. Setelah berapa detik keduanya akan menyala bersamaan lagi?`
            : `A red light flashes every ${a} seconds and a green light flashes every ${b} seconds. They have just flashed together. After how many seconds will they flash together again?`,
        ),
        answer: m,
        distractors: [a * b, a + b, gcd(a, b)],
        valid: (v) => (v as number) > 0,
        explanation: T((l) =>
          l === 'id'
            ? `Cari KPK dari ${a} dan ${b}. Kelipatan ${a}: ${multiplesUpTo(a, m).join(', ')}. Kelipatan ${b}: ${multiplesUpTo(b, m).join(', ')}. Jadi setelah ${m} detik.`
            : `Find the LCM of ${a} and ${b}. Multiples of ${a}: ${multiplesUpTo(a, m).join(', ')}. Multiples of ${b}: ${multiplesUpTo(b, m).join(', ')}. So after ${m} seconds.`,
        ),
      };
    },
  },
};

export const fracAddSub: Family = {
  topic: 't5.frac_addsub',
  tier: 5,
  makers: {
    fluency: (rng: Rng): Spec<Frac> => {
      const add = rng() < 0.55;
      let a = 0;
      let b = 0;
      let d1 = 0;
      let d2 = 0;
      for (;;) {
        d1 = pick(rng, [2, 3, 4, 5, 6, 8, 10]);
        d2 = rng() < 0.35 ? d1 : pick(rng, [2, 3, 4, 5, 6, 8, 10]);
        if (lcm(d1, d2) > 12 && d1 !== d2) continue;
        a = int(rng, 1, d1 - 1);
        b = int(rng, 1, d2 - 1);
        const v = add ? a / d1 + b / d2 : a / d1 - b / d2;
        if (v > 0 && v < 1) break;
      }
      const L2 = lcm(d1, d2);
      const a2 = (a * L2) / d1;
      const b2 = (b * L2) / d2;
      const num = add ? a2 + b2 : a2 - b2;
      const ans = reduce([num, L2]);
      const op = add ? '+' : '-';
      const naive: Frac = [add ? a + b : a - b, add ? d1 + d2 : d1 - d2];
      const simplified = ans[1] !== L2;
      return {
        stem: T((l) =>
          l === 'id'
            ? `Berapa ${a}/${d1} ${op} ${b}/${d2}?`
            : `What is ${a}/${d1} ${op} ${b}/${d2}?`,
        ),
        answer: ans,
        distractors: [naive, [add ? a + b : Math.abs(a - b), L2], [num + 1, L2], [num, L2 * 2]],
        key: fracKey,
        render: fracStr,
        valid: (v) => (v as Frac)[0] > 0 && (v as Frac)[1] > 0,
        fill: (k) => [num + k + 2, L2],
        explanation: T((l) => {
          const same = d1 === d2;
          const result = `${num}/${L2}${simplified ? ` = ${fracStr(ans)}` : ''}`;
          if (l === 'id')
            return same
              ? `Penyebutnya sama, jadi ${add ? 'jumlahkan' : 'kurangkan'} pembilangnya saja: ${a} ${op} ${b} = ${num}. Hasilnya ${result}.`
              : `Samakan penyebut menjadi ${L2}: ${a2}/${L2} ${op} ${b2}/${L2} = ${result}.`;
          return same
            ? `The denominators are the same, so just ${add ? 'add' : 'subtract'} the numerators: ${a} ${op} ${b} = ${num}. The answer is ${result}.`
            : `Make the denominators the same (${L2}): ${a2}/${L2} ${op} ${b2}/${L2} = ${result}.`;
        }),
      };
    },
  },
};

export const decimalPercent: Family = {
  topic: 't5.decimal_percent',
  tier: 5,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.6) {
        const p = pick(rng, [10, 20, 25, 50, 75]);
        const unit = 100 / gcd(p, 100);
        const n = unit * int(rng, 1, Math.floor(400 / unit));
        const ans = (n * p) / 100;
        return {
          stem: T((l) => (l === 'id' ? `Berapa ${p}% dari ${n}?` : `What is ${p}% of ${n}?`)),
          answer: ans,
          distractors: [n - p, ans * 10, n - ans, p],
          valid: (v) => Number.isInteger(v) && (v as number) > 0,
          explanation: T((l) =>
            l === 'id'
              ? `${p}% dari ${n} = ${p}/100 × ${n} = ${ans}.`
              : `${p}% of ${n} = ${p}/100 × ${n} = ${ans}.`,
          ),
        };
      }
      let p = int(rng, 1, 99);
      while (p % 10 === 0) p = int(rng, 1, 99);
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `${f(p / 100)} sama dengan berapa persen?`
            : `${f(p / 100)} is equal to what percentage?`,
        ),
        answer: p,
        distractors: [p / 10, p * 10, p / 100],
        render: (v) => L(`${String(v).replace('.', ',')}%`, `${v}%`),
        explanation: T((l, f) =>
          l === 'id' ? `${f(p / 100)} = ${p}/100 = ${p}%.` : `${f(p / 100)} = ${p}/100 = ${p}%.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const price = 10000 * int(rng, 2, 20);
      const p = pick(rng, [10, 20, 25, 50]);
      const off = (price * p) / 100;
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `Harga sebuah tas Rp${f(price)}. Tas itu mendapat diskon ${p}%. Berapa besar potongan harganya?`
            : `A bag costs Rp${f(price)}. It has a ${p}% discount. How much money is taken off the price?`,
        ),
        answer: off,
        distractors: [price - off, off * 2, p * 1000],
        render: rupiah,
        valid: (v) => (v as number) > 0,
        fill: (k) => off + 1000 * (k + 1),
        explanation: T((l, f) =>
          l === 'id'
            ? `Potongan = ${p}% × Rp${f(price)} = ${p}/100 × ${f(price)} = Rp${f(off)}.`
            : `Discount = ${p}% × Rp${f(price)} = ${p}/100 × ${f(price)} = Rp${f(off)}.`,
        ),
      };
    },
    multistep: (rng: Rng): Spec<number> => {
      const [n] = twoNames(rng);
      const price = 10000 * int(rng, 2, 20);
      const p = pick(rng, [10, 20, 25, 50]);
      const off = (price * p) / 100;
      const pay = price - off;
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `Harga sepasang sepatu Rp${f(price)}. Toko memberi diskon ${p}%. Berapa yang harus dibayar ${n}?`
            : `A pair of shoes costs Rp${f(price)}. The shop gives a ${p}% discount. How much does ${n} have to pay?`,
        ),
        answer: pay,
        distractors: [off, price - p * 1000, price],
        render: rupiah,
        valid: (v) => (v as number) > 0,
        fill: (k) => pay + 1000 * (k + 1),
        explanation: T((l, f) =>
          l === 'id'
            ? `Potongan: ${p}% × Rp${f(price)} = Rp${f(off)}. Dibayar: Rp${f(price)} - Rp${f(off)} = Rp${f(pay)}.`
            : `Discount: ${p}% × Rp${f(price)} = Rp${f(off)}. To pay: Rp${f(price)} - Rp${f(off)} = Rp${f(pay)}.`,
        ),
      };
    },
  },
};

export const dataMean: Family = {
  topic: 't5.data_mean',
  tier: 5,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const k = int(rng, 4, 6);
      const mode = int(rng, 2, 12);
      const others: number[] = [];
      while (others.length < k - 2) {
        const v = int(rng, 1, 15);
        if (v !== mode && !others.includes(v)) others.push(v);
      }
      const data = shuffle(rng, [mode, mode, ...others]);
      const s = data.map(String);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Berapa modus dari data: ${list(s, l)}?`
            : `What is the mode of this data: ${list(s, l)}?`,
        ),
        answer: mode,
        distractors: [Math.max(...data), Math.min(...data), data.length],
        explanation: T((l) =>
          l === 'id'
            ? `Modus adalah nilai yang paling sering muncul. ${mode} muncul 2 kali.`
            : `The mode is the value that appears most often. ${mode} appears twice.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const [n] = twoNames(rng);
      const k = int(rng, 3, 5);
      let data: number[];
      do data = Array.from({ length: k }, () => int(rng, 1, 12));
      while (data.reduce((x, y) => x + y, 0) % k !== 0 || new Set(data).size === 1);
      const sum = data.reduce((x, y) => x + y, 0);
      const mean = sum / k;
      const sorted = [...data].sort((x, y) => x - y);
      const s = data.map(String);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Banyak buku yang dibaca ${n} selama ${k} minggu: ${list(s, l)}. Berapa rata-rata buku yang dibaca setiap minggu?`
            : `The number of books ${n} read in ${k} weeks: ${list(s, l)}. What is the mean number of books per week?`,
        ),
        answer: mean,
        distractors: [sum, sorted[Math.floor(k / 2)] as number, Math.max(...data), mean + 1],
        explanation: T((l) =>
          l === 'id'
            ? `Rata-rata = jumlah ÷ banyak data = ${sum} ÷ ${k} = ${mean}.`
            : `Mean = total ÷ number of values = ${sum} ÷ ${k} = ${mean}.`,
        ),
      };
    },
  },
};

export const TIER5 = [bigNumbers, kpkFpb, fracAddSub, decimalPercent, dataMean];
