import { fmt, gcd, int, L, pick, T, type Family, type Lang, type Rng, type Spec } from './core';

const PLACES: Record<number, { id: string; en: string }> = {
  10: L('puluhan', 'ten'),
  100: L('ratusan', 'hundred'),
  1000: L('ribuan', 'thousand'),
  10000: L('puluh ribuan', 'ten thousand'),
  100000: L('ratus ribuan', 'hundred thousand'),
};

export const roundTo = (n: number, place: number) => Math.round(n / place) * place;

/** Shared rounding question (used for Year 4 and Year 5 number sense). */
export function roundingSpec(rng: Rng, min: number, max: number, places: number[]): Spec<number> {
  const place = pick(rng, places);
  let n = int(rng, min, max);
  while (
    n % place === 0 ||
    roundTo(n, place) === roundTo(n, places.find((p) => p !== place) ?? place)
  )
    n = int(rng, min, max);
  const ans = roundTo(n, place);
  const digit = Math.floor((n % place) / (place / 10));
  const up = digit >= 5;
  const name = PLACES[place] ?? L(String(place), String(place));
  const near = (l: Lang) => (l === 'id' ? `${name.id} terdekat` : `nearest ${name.en}`);
  return {
    stem: T((l, f) =>
      l === 'id' ? `Bulatkan ${f(n)} ke ${near(l)}.` : `Round ${f(n)} to the ${near(l)}.`,
    ),
    answer: ans,
    distractors: [
      up ? ans - place : ans + place,
      ...places.filter((p) => p !== place).map((p) => roundTo(n, p)),
    ],
    fill: (k) => ans + place * (k + 2) * (k % 2 ? -1 : 1),
    explanation: T((l) =>
      l === 'id'
        ? `Lihat angka di sebelah kanan tempat ${name.id}: ${digit}. ${up ? 'Karena 5 atau lebih, bulatkan ke atas' : 'Karena kurang dari 5, bulatkan ke bawah'}, jadi ${fmt(ans, l)}.`
        : `Look at the digit to the right of the ${name.en}s place: ${digit}. ${up ? 'It is 5 or more, so round up' : 'It is less than 5, so round down'}, which gives ${fmt(ans, l)}.`,
    ),
  };
}

export const place10000: Family = {
  topic: 't4.place10000',
  tier: 4,
  makers: { fluency: (rng) => roundingSpec(rng, 1001, 9999, [10, 100, 1000]) },
};

/** Multiplication mistake: write only the ones digit of each partial product (forgetting to carry). */
export function noCarryProduct(a: number, b: number): number {
  let r = 0;
  for (let p = 1; a > 0; p *= 10, a = Math.floor(a / 10)) r += (((a % 10) * b) % 10) * p;
  return r;
}

export const multidigit: Family = {
  topic: 't4.multidigit',
  tier: 4,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.6) {
        const a = int(rng, 12, 99);
        const b = int(rng, 3, 9);
        return {
          stem: T((l) => (l === 'id' ? `Berapa ${a} × ${b}?` : `What is ${a} × ${b}?`)),
          answer: a * b,
          distractors: [noCarryProduct(a, b), a * b + a, a * b - a, a * b + 10],
          valid: (v) => (v as number) >= a,
          explanation: T((l) =>
            l === 'id'
              ? `Pecah ${a} menjadi ${Math.floor(a / 10) * 10} + ${a % 10}: ${Math.floor(a / 10) * 10} × ${b} = ${Math.floor(a / 10) * 10 * b} dan ${a % 10} × ${b} = ${(a % 10) * b}. Jumlahnya ${a * b}.`
              : `Split ${a} into ${Math.floor(a / 10) * 10} + ${a % 10}: ${Math.floor(a / 10) * 10} × ${b} = ${Math.floor(a / 10) * 10 * b} and ${a % 10} × ${b} = ${(a % 10) * b}. Together that is ${a * b}.`,
          ),
        };
      }
      const d = int(rng, 2, 9);
      const q = int(rng, 12, Math.floor(999 / d));
      const p = d * q;
      return {
        stem: T((l) => (l === 'id' ? `Berapa ${p} ÷ ${d}?` : `What is ${p} ÷ ${d}?`)),
        answer: q,
        distractors: [q + 10, q - 1, q + 1, q - 10],
        explanation: T((l) =>
          l === 'id'
            ? `${p} ÷ ${d} = ${q}, karena ${d} × ${q} = ${p}.`
            : `${p} ÷ ${d} = ${q}, because ${d} × ${q} = ${p}.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const a = int(rng, 12, 99);
      const b = int(rng, 3, 9);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Satu kardus berisi ${a} buku. Berapa buku dalam ${b} kardus?`
            : `One carton holds ${a} books. How many books are in ${b} cartons?`,
        ),
        answer: a * b,
        distractors: [noCarryProduct(a, b), a * b - a, a * b + a],
        valid: (v) => (v as number) >= a,
        explanation: T((l) =>
          l === 'id'
            ? `${b} kardus masing-masing ${a} buku: ${a} × ${b} = ${a * b}.`
            : `${b} cartons of ${a} books each: ${a} × ${b} = ${a * b}.`,
        ),
      };
    },
  },
};

export const equivFractions: Family = {
  topic: 't4.equiv_fractions',
  tier: 4,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const b = int(rng, 2, 6);
      let a = int(rng, 1, b - 1);
      while (gcd(a, b) !== 1) a = int(rng, 1, b - 1);
      const k = int(rng, 2, 5);
      if (rng() < 0.6) {
        return {
          stem: T((l) =>
            l === 'id'
              ? `Lengkapi: ${a}/${b} = .../${b * k}`
              : `Complete: ${a}/${b} = .../${b * k}`,
          ),
          answer: a * k,
          distractors: [a + (b * k - b), a * k + 1, a * k - 1, a * b],
          explanation: T((l) =>
            l === 'id'
              ? `Penyebut ${b} dikali ${k} menjadi ${b * k}, jadi pembilang juga dikali ${k}: ${a} × ${k} = ${a * k}.`
              : `The denominator ${b} was multiplied by ${k} to make ${b * k}, so multiply the numerator by ${k} too: ${a} × ${k} = ${a * k}.`,
          ),
        };
      }
      return {
        stem: T((l) =>
          l === 'id' ? `Lengkapi: ${a}/${b} = ${a * k}/...` : `Complete: ${a}/${b} = ${a * k}/...`,
        ),
        answer: b * k,
        distractors: [b + (a * k - a), b * k + 1, b * k - 1, a * k * b],
        explanation: T((l) =>
          l === 'id'
            ? `Pembilang ${a} dikali ${k} menjadi ${a * k}, jadi penyebut juga dikali ${k}: ${b} × ${k} = ${b * k}.`
            : `The numerator ${a} was multiplied by ${k} to make ${a * k}, so multiply the denominator by ${k} too: ${b} × ${k} = ${b * k}.`,
        ),
      };
    },
  },
};

export const decimalsIntro: Family = {
  topic: 't4.decimals_intro',
  tier: 4,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.5) {
        const n = int(rng, 1, 9);
        return {
          stem: T((l) =>
            l === 'id' ? `Tulis ${n}/10 dalam bentuk desimal.` : `Write ${n}/10 as a decimal.`,
          ),
          answer: n / 10,
          distractors: [n / 100, n, (n + 1) / 10, n + 0.1],
          explanation: T((l, f) =>
            l === 'id'
              ? `${n}/10 berarti ${n} persepuluhan, ditulis ${f(n / 10)}.`
              : `${n}/10 means ${n} tenths, written ${f(n / 10)}.`,
          ),
        };
      }
      let n = int(rng, 11, 99);
      while (n % 10 === 0) n = int(rng, 11, 99);
      return {
        stem: T((l) =>
          l === 'id' ? `Tulis ${n}/100 dalam bentuk desimal.` : `Write ${n}/100 as a decimal.`,
        ),
        answer: n / 100,
        distractors: [n / 10, n / 1000, n],
        fill: (k) => n / 100 + (k + 1) / 100,
        explanation: T((l, f) =>
          l === 'id'
            ? `${n}/100 berarti ${n} perseratusan, ditulis ${f(n / 100)}.`
            : `${n}/100 means ${n} hundredths, written ${f(n / 100)}.`,
        ),
      };
    },
  },
};

export const perimArea: Family = {
  topic: 't4.perim_area',
  tier: 4,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const p = int(rng, 4, 15);
      let w = int(rng, 2, 12);
      while (w === p) w = int(rng, 2, 12);
      const area = rng() < 0.5;
      const A = p * w;
      const K = 2 * (p + w);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Sebuah persegi panjang memiliki panjang ${p} cm dan lebar ${w} cm. Berapa ${area ? 'luasnya (cm²)' : 'kelilingnya (cm)'}?`
            : `A rectangle is ${p} cm long and ${w} cm wide. What is its ${area ? 'area in cm²' : 'perimeter in cm'}?`,
        ),
        answer: area ? A : K,
        distractors: area ? [K, p + w, 2 * p + w] : [A, p + w, 2 * p + w],
        explanation: T((l) =>
          area
            ? l === 'id'
              ? `Luas = panjang × lebar = ${p} × ${w} = ${A} cm².`
              : `Area = length × width = ${p} × ${w} = ${A} cm².`
            : l === 'id'
              ? `Keliling = 2 × (panjang + lebar) = 2 × (${p} + ${w}) = ${K} cm.`
              : `Perimeter = 2 × (length + width) = 2 × (${p} + ${w}) = ${K} cm.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const p = int(rng, 5, 20);
      let w = int(rng, 3, 15);
      while (w === p) w = int(rng, 3, 15);
      const K = 2 * (p + w);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Sebuah kebun berbentuk persegi panjang berukuran ${p} m × ${w} m. Kebun itu akan dipagari di sekelilingnya. Berapa meter pagar yang diperlukan?`
            : `A rectangular garden is ${p} m by ${w} m. A fence will go all the way around it. How many metres of fence are needed?`,
        ),
        answer: K,
        distractors: [p * w, p + w, 2 * p + w],
        explanation: T((l) =>
          l === 'id'
            ? `Pagar mengelilingi kebun, jadi hitung keliling: 2 × (${p} + ${w}) = ${K} m.`
            : `The fence goes around the garden, so find the perimeter: 2 × (${p} + ${w}) = ${K} m.`,
        ),
      };
    },
    multistep: (rng: Rng): Spec<number> => {
      const p = int(rng, 2, 6);
      const w = int(rng, 2, 6);
      const k = int(rng, 2, 9);
      const ans = p * w * k;
      return {
        stem: T((l) =>
          l === 'id'
            ? `Lantai sebuah kamar berukuran ${p} m × ${w} m. Setiap meter persegi memerlukan ${k} ubin. Berapa ubin yang diperlukan untuk seluruh lantai?`
            : `A room floor is ${p} m by ${w} m. Each square metre needs ${k} tiles. How many tiles are needed for the whole floor?`,
        ),
        answer: ans,
        distractors: [2 * (p + w) * k, p * w, p * w + k],
        explanation: T((l) =>
          l === 'id'
            ? `Luas lantai: ${p} × ${w} = ${p * w} m². Ubin: ${p * w} × ${k} = ${ans}.`
            : `Floor area: ${p} × ${w} = ${p * w} m². Tiles: ${p * w} × ${k} = ${ans}.`,
        ),
      };
    },
  },
};

export const TIER4 = [place10000, multidigit, equivFractions, decimalsIntro, perimArea];
