import {
  int,
  pick,
  rupiah,
  T,
  THINGS,
  twoNames,
  L,
  type Family,
  type Rng,
  type Spec,
} from './core.ts';

export const place100: Family = {
  topic: 't2.place100',
  tier: 2,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const t = int(rng, 1, 9);
      let u = int(rng, 1, 9);
      while (u === t) u = int(rng, 1, 9);
      const n = t * 10 + u;
      const form = int(rng, 0, 2);
      if (form === 2) {
        return {
          stem: T((l) =>
            l === 'id'
              ? `${t} puluhan dan ${u} satuan adalah bilangan berapa?`
              : `What number is ${t} tens and ${u} ones?`,
          ),
          answer: n,
          distractors: [u * 10 + t, t + u, t * 10],
          explanation: T((l) =>
            l === 'id'
              ? `${t} puluhan = ${t * 10}, ditambah ${u} satuan = ${n}.`
              : `${t} tens = ${t * 10}, plus ${u} ones = ${n}.`,
          ),
        };
      }
      const tens = form === 0;
      const d = tens ? t : u;
      const ans = tens ? t * 10 : u;
      return {
        stem: T((l) =>
          l === 'id'
            ? `Pada bilangan ${n}, angka ${d} bernilai berapa?`
            : `In the number ${n}, what is the value of the digit ${d}?`,
        ),
        answer: ans,
        distractors: tens ? [t, u, u * 10] : [u * 10, t, t * 10],
        explanation: T((l) =>
          l === 'id'
            ? `Angka ${d} ada di tempat ${tens ? 'puluhan' : 'satuan'}, jadi nilainya ${ans}.`
            : `The digit ${d} is in the ${tens ? 'tens' : 'ones'} place, so its value is ${ans}.`,
        ),
      };
    },
  },
};

/** Column-wise "no carry" / "smaller from larger" mistakes. */
export function noCarrySum(a: number, b: number): number {
  let r = 0;
  for (let p = 1; a > 0 || b > 0; p *= 10, a = Math.floor(a / 10), b = Math.floor(b / 10))
    r += (((a % 10) + (b % 10)) % 10) * p;
  return r;
}
export function smallerFromLarger(a: number, b: number): number {
  let r = 0;
  for (let p = 1; a > 0 || b > 0; p *= 10, a = Math.floor(a / 10), b = Math.floor(b / 10))
    r += Math.abs((a % 10) - (b % 10)) * p;
  return r;
}

export const addsub100: Family = {
  topic: 't2.addsub100',
  tier: 2,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.5) {
        let a = 0;
        let b = 0;
        do {
          a = int(rng, 15, 69);
          b = int(rng, 12, 39);
        } while ((a % 10) + (b % 10) < 10 || a + b > 99);
        return {
          stem: T((l) => (l === 'id' ? `Berapa ${a} + ${b}?` : `What is ${a} + ${b}?`)),
          answer: a + b,
          distractors: [noCarrySum(a, b), a + b + 10, a + b + 1],
          explanation: T((l) =>
            l === 'id'
              ? `Satuan: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}, tulis ${((a % 10) + (b % 10)) % 10} simpan 1. Puluhan: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} + 1 = ${Math.floor((a + b) / 10)}. Jadi ${a + b}.`
              : `Ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}, write ${((a % 10) + (b % 10)) % 10} carry 1. Tens: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} + 1 = ${Math.floor((a + b) / 10)}. So ${a + b}.`,
          ),
        };
      }
      let a = 0;
      let b = 0;
      do {
        a = int(rng, 30, 99);
        b = int(rng, 11, a - 10);
      } while (a % 10 >= b % 10);
      return {
        stem: T((l) => (l === 'id' ? `Berapa ${a} - ${b}?` : `What is ${a} - ${b}?`)),
        answer: a - b,
        distractors: [smallerFromLarger(a, b), a - b + 10, a - b - 1],
        explanation: T((l) =>
          l === 'id'
            ? `${a % 10} lebih kecil dari ${b % 10}, jadi pinjam 1 puluhan: ${(a % 10) + 10} - ${b % 10} = ${(a - b) % 10}. Hasilnya ${a} - ${b} = ${a - b}.`
            : `${a % 10} is smaller than ${b % 10}, so exchange 1 ten: ${(a % 10) + 10} - ${b % 10} = ${(a - b) % 10}. So ${a} - ${b} = ${a - b}.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      if (rng() < 0.5) {
        const a = int(rng, 30, 95);
        const b = int(rng, 11, a - 5);
        return {
          stem: T((l) =>
            l === 'id'
              ? `Di perpustakaan ada ${a} buku. Sebanyak ${b} buku dipinjam. Berapa buku yang tersisa?`
              : `A library has ${a} books. ${b} books are borrowed. How many books are left?`,
          ),
          answer: a - b,
          distractors: [a + b > 99 ? smallerFromLarger(a, b) : a + b, a - b + 10, a - b - 1],
          explanation: T((l) =>
            l === 'id'
              ? `Dipinjam berarti berkurang: ${a} - ${b} = ${a - b}.`
              : `Borrowed means taken away: ${a} - ${b} = ${a - b}.`,
          ),
        };
      }
      const a = int(rng, 18, 40);
      const b = int(rng, 18, 40);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Kelas 2A punya ${a} siswa dan kelas 2B punya ${b} siswa. Berapa jumlah siswa kedua kelas?`
            : `Class 2A has ${a} students and Class 2B has ${b} students. How many students are there in both classes?`,
        ),
        answer: a + b,
        distractors: [noCarrySum(a, b), Math.abs(a - b), a + b + 1],
        explanation: T((l) =>
          l === 'id'
            ? `Jumlah berarti tambah: ${a} + ${b} = ${a + b}.`
            : `Altogether means add: ${a} + ${b} = ${a + b}.`,
        ),
      };
    },
  },
};

export const halfQuarter: Family = {
  topic: 't2.half_quarter',
  tier: 2,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.6) {
        const n = 2 * int(rng, 2, 20);
        return {
          stem: T((l) => (l === 'id' ? `Berapa setengah dari ${n}?` : `What is half of ${n}?`)),
          answer: n / 2,
          distractors: [n * 2, n / 4, n - 2],
          explanation: T((l) =>
            l === 'id'
              ? `Setengah berarti dibagi 2 sama besar: ${n} ÷ 2 = ${n / 2}.`
              : `Half means splitting into 2 equal parts: ${n} ÷ 2 = ${n / 2}.`,
          ),
        };
      }
      const n = 4 * int(rng, 1, 10);
      return {
        stem: T((l) =>
          l === 'id' ? `Berapa seperempat dari ${n}?` : `What is a quarter of ${n}?`,
        ),
        answer: n / 4,
        distractors: [n / 2, n * 4, n - 4],
        explanation: T((l) =>
          l === 'id'
            ? `Seperempat berarti dibagi 4 sama besar: ${n} ÷ 4 = ${n / 4}.`
            : `A quarter means splitting into 4 equal parts: ${n} ÷ 4 = ${n / 4}.`,
        ),
      };
    },
  },
};

const CONTAINERS = [
  L('piring', 'plates'),
  L('kotak', 'boxes'),
  L('kantong', 'bags'),
  L('keranjang', 'baskets'),
];

export const equalGroups: Family = {
  topic: 't2.equal_groups',
  tier: 2,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const k = int(rng, 2, 5);
      let b = int(rng, 2, 10);
      while (b === k) b = int(rng, 2, 10);
      const sum = Array(k).fill(b).join(' + ');
      return {
        stem: T((l) =>
          l === 'id'
            ? `${sum} = ... × ${b}. Berapa angka yang hilang?`
            : `${sum} = ... × ${b}. What is the missing number?`,
        ),
        answer: k,
        distractors: [b, k + 1, k * b],
        explanation: T((l) =>
          l === 'id'
            ? `Ada ${k} kali angka ${b} yang dijumlahkan, jadi ${sum} = ${k} × ${b}.`
            : `${b} is added ${k} times, so ${sum} = ${k} × ${b}.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const k = int(rng, 2, 5);
      const b = int(rng, 2, 10);
      const c = pick(rng, CONTAINERS);
      const t = pick(rng, THINGS);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Ada ${k} ${c.id}. Setiap ${c.id} berisi ${b} ${t.id}. Berapa ${t.id} semuanya?`
            : `There are ${k} ${c.en}. Each one has ${b} ${t.en}. How many ${t.en} are there altogether?`,
        ),
        answer: k * b,
        distractors: [k + b, k * b - b, k * b + b],
        explanation: T((l) =>
          l === 'id'
            ? `${k} kelompok berisi ${b}: ${Array(k).fill(b).join(' + ')} = ${k} × ${b} = ${k * b}.`
            : `${k} groups of ${b}: ${Array(k).fill(b).join(' + ')} = ${k} × ${b} = ${k * b}.`,
        ),
      };
    },
  },
};

const SHOP_ITEMS = [
  L('sebuah buku tulis', 'an exercise book'),
  L('sebotol air minum', 'a bottle of water'),
  L('sebungkus roti', 'a pack of bread'),
  L('sebuah penghapus', 'an eraser'),
  L('sekotak susu', 'a carton of milk'),
  L('sebuah pensil warna', 'a coloured pencil'),
];

export const moneyTime: Family = {
  topic: 't2.money_time',
  tier: 2,
  makers: {
    application: (rng: Rng): Spec<number> => {
      const [n] = twoNames(rng);
      const item = pick(rng, SHOP_ITEMS);
      const price = 500 * int(rng, 2, 19);
      const pay = price < 5000 ? pick(rng, [5000, 10000]) : 10000;
      const change = pay - price;
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `${n} membeli ${item.id} seharga Rp${f(price)} dan membayar dengan uang Rp${f(pay)}. Berapa uang kembaliannya?`
            : `${n} buys ${item.en} for Rp${f(price)} and pays with Rp${f(pay)}. How much change does ${n} get?`,
        ),
        answer: change,
        distractors: [change + 500, change - 500, price],
        render: rupiah,
        valid: (v) => (v as number) > 0,
        fill: (k) => change + 1000 * (k + 1),
        explanation: T((l, f) =>
          l === 'id'
            ? `Kembalian = uang dibayar - harga: Rp${f(pay)} - Rp${f(price)} = Rp${f(change)}.`
            : `Change = money paid - price: Rp${f(pay)} - Rp${f(price)} = Rp${f(change)}.`,
        ),
      };
    },
    multistep: (rng: Rng): Spec<number> => {
      const [n] = twoNames(rng);
      const a = pick(rng, SHOP_ITEMS);
      let b = pick(rng, SHOP_ITEMS);
      while (b === a) b = pick(rng, SHOP_ITEMS);
      const pa = 500 * int(rng, 2, 9);
      const pb = 500 * int(rng, 2, 9);
      const pay = pa + pb < 10000 ? 10000 : 20000;
      const change = pay - pa - pb;
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `${n} membeli ${a.id} seharga Rp${f(pa)} dan ${b.id} seharga Rp${f(pb)}. ${n} membayar dengan uang Rp${f(pay)}. Berapa uang kembaliannya?`
            : `${n} buys ${a.en} for Rp${f(pa)} and ${b.en} for Rp${f(pb)}. ${n} pays with Rp${f(pay)}. How much change does ${n} get?`,
        ),
        answer: change,
        distractors: [pay - pa, pa + pb, change + 500],
        render: rupiah,
        valid: (v) => (v as number) > 0,
        fill: (k) => change + 1000 * (k + 1),
        explanation: T((l, f) =>
          l === 'id'
            ? `Total belanja: Rp${f(pa)} + Rp${f(pb)} = Rp${f(pa + pb)}. Kembalian: Rp${f(pay)} - Rp${f(pa + pb)} = Rp${f(change)}.`
            : `Total cost: Rp${f(pa)} + Rp${f(pb)} = Rp${f(pa + pb)}. Change: Rp${f(pay)} - Rp${f(pa + pb)} = Rp${f(change)}.`,
        ),
      };
    },
  },
};

// Two-step subtraction (#12).
addsub100.makers.multistep = (rng: Rng): Spec<number> => {
  let a = 0;
  let b = 0;
  let c = 0;
  do {
    a = int(rng, 50, 99);
    b = int(rng, 10, 35);
    c = int(rng, 10, 35);
  } while (a - b - c < 5);
  const ans = a - b - c;
  return {
    stem: T((l) =>
      l === 'id'
        ? `Pedagang di pasar punya ${a} kg cabai. Pagi hari terjual ${b} kg dan sore hari terjual ${c} kg. Berapa kg cabai yang tersisa?`
        : `A market seller has ${a} kg of chillies. ${b} kg are sold in the morning and ${c} kg in the afternoon. How many kg of chillies are left?`,
    ),
    answer: ans,
    distractors: [a - b, b + c, a - b + c],
    explanation: T((l) =>
      l === 'id'
        ? `Terjual semuanya: ${b} + ${c} = ${b + c} kg. Sisa: ${a} - ${b + c} = ${ans} kg.`
        : `Sold altogether: ${b} + ${c} = ${b + c} kg. Left: ${a} - ${b + c} = ${ans} kg.`,
    ),
  };
};

export const TIER2 = [place100, addsub100, halfQuarter, equalGroups, moneyTime];
