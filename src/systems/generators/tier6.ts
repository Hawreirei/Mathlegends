import {
  fracKey,
  fracStr,
  gcd,
  int,
  L,
  pick,
  reduce,
  rupiah,
  T,
  twoNames,
  type Family,
  type Frac,
  type Rng,
  type Spec,
} from './core.ts';

export const fracMulDiv: Family = {
  topic: 't6.frac_muldiv',
  tier: 6,
  makers: {
    fluency: (rng: Rng): Spec<number> | Spec<Frac> => {
      const form = int(rng, 0, 2);
      if (form === 0) {
        const b = int(rng, 2, 9);
        const a = int(rng, 1, b - 1);
        const n = b * int(rng, 2, 9);
        const ans = (a * n) / b;
        return {
          stem: T((l) => (l === 'id' ? `Berapa ${a}/${b} × ${n}?` : `What is ${a}/${b} × ${n}?`)),
          answer: ans,
          distractors: [a * n, n / b, ans + a],
          explanation: T((l) =>
            l === 'id'
              ? `${n} ÷ ${b} = ${n / b}, lalu × ${a} = ${ans}.`
              : `${n} ÷ ${b} = ${n / b}, then × ${a} = ${ans}.`,
          ),
        };
      }
      // Start from fractions already in simplest form.
      const simple = (): Frac => {
        for (;;) {
          const den = int(rng, 2, 9);
          const numr = int(rng, 1, den - 1);
          if (gcd(numr, den) === 1) return [numr, den];
        }
      };
      const [a, b] = simple();
      const [c, d] = simple();
      const mul = form === 1;
      const ans = reduce(mul ? [a * c, b * d] : [a * d, b * c]);
      const raw: Frac = mul ? [a * c, b * d] : [a * d, b * c];
      const simplified = fracStr(raw) !== fracStr(ans);
      const op = mul ? '×' : '÷';
      return {
        stem: T((l) =>
          l === 'id' ? `Berapa ${a}/${b} ${op} ${c}/${d}?` : `What is ${a}/${b} ${op} ${c}/${d}?`,
        ),
        answer: ans,
        distractors: (mul
          ? [
              [a * d, b * c],
              [a + c, b + d],
              [a * c, b + d],
            ]
          : [
              [a * c, b * d],
              [b * c, a * d],
              [a + d, b + c],
            ]) as Frac[],
        key: fracKey,
        render: fracStr,
        valid: (v: Frac) => v[0] > 0 && v[1] > 0,
        fill: (k: number): Frac => [ans[0] + k + 1, ans[1]],
        explanation: T((l) => {
          const tail = `${fracStr(raw)}${simplified ? ` = ${fracStr(ans)}` : ''}`;
          if (mul)
            return l === 'id'
              ? `Kalikan pembilang dengan pembilang dan penyebut dengan penyebut: ${a}×${c} / ${b}×${d} = ${tail}.`
              : `Multiply the numerators and multiply the denominators: ${a}×${c} / ${b}×${d} = ${tail}.`;
          return l === 'id'
            ? `Membagi dengan ${c}/${d} sama dengan mengalikan dengan ${d}/${c}: ${a}/${b} × ${d}/${c} = ${tail}.`
            : `Dividing by ${c}/${d} is the same as multiplying by ${d}/${c}: ${a}/${b} × ${d}/${c} = ${tail}.`;
        }),
      };
    },
  },
};

function ratioPair(rng: Rng): [number, number] {
  for (;;) {
    const x = int(rng, 1, 5);
    const y = int(rng, 1, 5);
    if (x !== y && gcd(x, y) === 1) return [x, y];
  }
}

export const ratio: Family = {
  topic: 't6.ratio',
  tier: 6,
  makers: {
    fluency: (rng: Rng): Spec<[number, number]> => {
      const [x, y] = ratioPair(rng);
      const k = int(rng, 2, 9);
      const half: [number, number] | null = k % 2 === 0 ? [(x * k) / 2, (y * k) / 2] : null;
      return {
        stem: T((l) =>
          l === 'id'
            ? `Sederhanakan perbandingan ${x * k} : ${y * k}.`
            : `Write the ratio ${x * k} : ${y * k} in its simplest form.`,
        ),
        answer: [x, y],
        distractors: [[y, x], ...(half ? [half] : []), [x + 1, y + 1]],
        key: (v) => `${v[0]}:${v[1]}`,
        render: (v) => `${v[0]} : ${v[1]}`,
        valid: (v) => v[0] > 0 && v[1] > 0,
        fill: (j) => [x + j + 2, y],
        explanation: T((l) =>
          l === 'id'
            ? `Bagi kedua bilangan dengan FPB-nya, yaitu ${k}: ${x * k} ÷ ${k} = ${x} dan ${y * k} ÷ ${k} = ${y}. Jadi ${x} : ${y}.`
            : `Divide both numbers by their HCF, ${k}: ${x * k} ÷ ${k} = ${x} and ${y * k} ÷ ${k} = ${y}. So ${x} : ${y}.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const [n, m] = twoNames(rng);
      const [x, y] = ratioPair(rng);
      const k = int(rng, 2, 12);
      const total = (x + y) * k;
      return {
        stem: T((l) =>
          l === 'id'
            ? `Perbandingan kelereng ${n} dan ${m} adalah ${x} : ${y}. Jumlah kelereng mereka ${total}. Berapa kelereng ${m}?`
            : `The ratio of ${n}'s marbles to ${m}'s marbles is ${x} : ${y}. Together they have ${total} marbles. How many marbles does ${m} have?`,
        ),
        answer: y * k,
        distractors: [x * k, total - y, k, y * k + k],
        valid: (v) => Number.isInteger(v) && (v as number) > 0,
        explanation: T((l) =>
          l === 'id'
            ? `Ada ${x} + ${y} = ${x + y} bagian. Satu bagian = ${total} ÷ ${x + y} = ${k}. Kelereng ${m} = ${y} × ${k} = ${y * k}.`
            : `There are ${x} + ${y} = ${x + y} parts. One part = ${total} ÷ ${x + y} = ${k}. ${m} has ${y} × ${k} = ${y * k}.`,
        ),
      };
    },
    multistep: (rng: Rng): Spec<number> => {
      const [n, m] = twoNames(rng);
      const [x, y] = ratioPair(rng);
      const k = 1000 * int(rng, 2, 10);
      const ans = (x + y) * k;
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `Perbandingan uang tabungan ${n} dan ${m} adalah ${x} : ${y}. Tabungan ${n} Rp${f(x * k)}. Berapa jumlah tabungan mereka berdua?`
            : `The ratio of ${n}'s savings to ${m}'s savings is ${x} : ${y}. ${n} has saved Rp${f(x * k)}. How much have they saved altogether?`,
        ),
        answer: ans,
        distractors: [y * k, x * k * y, ans + k],
        render: rupiah,
        valid: (v) => Number.isInteger(v) && (v as number) > 0,
        fill: (j) => ans + k * (j + 1),
        explanation: T((l, f) =>
          l === 'id'
            ? `Satu bagian = Rp${f(x * k)} ÷ ${x} = Rp${f(k)}. Tabungan ${m} = ${y} × Rp${f(k)} = Rp${f(y * k)}. Jumlah = Rp${f(x * k)} + Rp${f(y * k)} = Rp${f(ans)}.`
            : `One part = Rp${f(x * k)} ÷ ${x} = Rp${f(k)}. ${m} has ${y} × Rp${f(k)} = Rp${f(y * k)}. Altogether = Rp${f(x * k)} + Rp${f(y * k)} = Rp${f(ans)}.`,
        ),
      };
    },
  },
};

export const speedScale: Family = {
  topic: 't6.speed_scale',
  tier: 6,
  makers: {
    application: (rng: Rng): Spec<number> => {
      const form = int(rng, 0, 2);
      const v = pick(rng, [30, 40, 45, 50, 60, 70, 80]);
      const t = int(rng, 2, 6);
      if (form === 0) {
        return {
          stem: T((l) =>
            l === 'id'
              ? `Sebuah mobil melaju dengan kecepatan ${v} km/jam selama ${t} jam. Berapa km jarak yang ditempuh?`
              : `A car travels at ${v} km/h for ${t} hours. How many kilometres does it travel?`,
          ),
          answer: v * t,
          distractors: [v + t, v * (t - 1), v * (t + 1)],
          explanation: T((l) =>
            l === 'id'
              ? `Jarak = kecepatan × waktu = ${v} × ${t} = ${v * t} km.`
              : `Distance = speed × time = ${v} × ${t} = ${v * t} km.`,
          ),
        };
      }
      if (form === 1) {
        const d = v * t;
        return {
          stem: T((l) =>
            l === 'id'
              ? `Jarak kota A ke kota B ${d} km. Sebuah bus melaju dengan kecepatan ${v} km/jam. Berapa jam waktu tempuhnya?`
              : `Town A is ${d} km from Town B. A bus travels at ${v} km/h. How many hours does the journey take?`,
          ),
          answer: t,
          distractors: [t + 1, t - 1, d - v],
          valid: (x) => (x as number) > 0,
          explanation: T((l) =>
            l === 'id'
              ? `Waktu = jarak ÷ kecepatan = ${d} ÷ ${v} = ${t} jam.`
              : `Time = distance ÷ speed = ${d} ÷ ${v} = ${t} hours.`,
          ),
        };
      }
      const s = pick(rng, [100000, 200000, 500000]);
      const c = int(rng, 2, 9);
      const km = (c * s) / 100000;
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `Skala sebuah peta 1 : ${f(s)}. Jarak dua kota pada peta ${c} cm. Berapa km jarak sebenarnya?`
            : `A map has a scale of 1 : ${f(s)}. Two towns are ${c} cm apart on the map. What is the real distance in km?`,
        ),
        answer: km,
        distractors: [km * 10, km * 100, c + s / 100000],
        explanation: T((l, f) =>
          l === 'id'
            ? `${c} × ${f(s)} = ${f(c * s)} cm. 1 km = ${f(100000)} cm, jadi ${f(c * s)} cm = ${km} km.`
            : `${c} × ${f(s)} = ${f(c * s)} cm. 1 km = ${f(100000)} cm, so ${f(c * s)} cm = ${km} km.`,
        ),
      };
    },
  },
};

export const mixedOps: Family = {
  topic: 't6.mixed_ops',
  tier: 6,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      const form = int(rng, 0, 2);
      const b = int(rng, 2, 9);
      const c = int(rng, 2, 9);
      if (form === 0) {
        const a = int(rng, 2, 20);
        const ans = a + b * c;
        return {
          stem: T((l) =>
            l === 'id' ? `Berapa ${a} + ${b} × ${c}?` : `What is ${a} + ${b} × ${c}?`,
          ),
          answer: ans,
          distractors: [(a + b) * c, a * b + c, a + b + c],
          explanation: T((l) =>
            l === 'id'
              ? `Kerjakan perkalian dulu: ${b} × ${c} = ${b * c}. Lalu ${a} + ${b * c} = ${ans}.`
              : `Do the multiplication first: ${b} × ${c} = ${b * c}. Then ${a} + ${b * c} = ${ans}.`,
          ),
        };
      }
      if (form === 1) {
        const a = int(rng, b * c + 1, b * c + 40);
        const ans = a - b * c;
        return {
          stem: T((l) =>
            l === 'id' ? `Berapa ${a} - ${b} × ${c}?` : `What is ${a} - ${b} × ${c}?`,
          ),
          answer: ans,
          distractors: [(a - b) * c, a - b - c, ans + c],
          explanation: T((l) =>
            l === 'id'
              ? `Kerjakan perkalian dulu: ${b} × ${c} = ${b * c}. Lalu ${a} - ${b * c} = ${ans}.`
              : `Do the multiplication first: ${b} × ${c} = ${b * c}. Then ${a} - ${b * c} = ${ans}.`,
          ),
        };
      }
      const a = int(rng, 2, 30);
      const p = b * c;
      const ans = a + c;
      return {
        stem: T((l) => (l === 'id' ? `Berapa ${a} + ${p} ÷ ${b}?` : `What is ${a} + ${p} ÷ ${b}?`)),
        answer: ans,
        distractors: [(a + p) / b, a + p - b, a * c],
        valid: (v) => Number.isInteger(v) && (v as number) >= 0,
        explanation: T((l) =>
          l === 'id'
            ? `Kerjakan pembagian dulu: ${p} ÷ ${b} = ${c}. Lalu ${a} + ${c} = ${ans}.`
            : `Do the division first: ${p} ÷ ${b} = ${c}. Then ${a} + ${c} = ${ans}.`,
        ),
      };
    },
  },
};

export const volume: Family = {
  topic: 't6.volume',
  tier: 6,
  makers: {
    fluency: (rng: Rng): Spec<number> => {
      if (rng() < 0.4) {
        const s = int(rng, 2, 10);
        return {
          stem: T((l) =>
            l === 'id'
              ? `Sebuah kubus memiliki panjang rusuk ${s} cm. Berapa volumenya (cm³)?`
              : `A cube has edges ${s} cm long. What is its volume in cm³?`,
          ),
          answer: s ** 3,
          distractors: [3 * s, s * s, 6 * s * s],
          explanation: T((l) =>
            l === 'id'
              ? `Volume kubus = rusuk × rusuk × rusuk = ${s} × ${s} × ${s} = ${s ** 3} cm³.`
              : `Volume of a cube = edge × edge × edge = ${s} × ${s} × ${s} = ${s ** 3} cm³.`,
          ),
        };
      }
      const p = int(rng, 3, 12);
      const w = int(rng, 2, 10);
      const h = int(rng, 2, 10);
      return {
        stem: T((l) =>
          l === 'id'
            ? `Sebuah balok memiliki panjang ${p} cm, lebar ${w} cm, dan tinggi ${h} cm. Berapa volumenya (cm³)?`
            : `A cuboid is ${p} cm long, ${w} cm wide and ${h} cm high. What is its volume in cm³?`,
        ),
        answer: p * w * h,
        distractors: [p + w + h, p * w, 2 * (p * w + w * h + p * h)],
        explanation: T((l) =>
          l === 'id'
            ? `Volume balok = panjang × lebar × tinggi = ${p} × ${w} × ${h} = ${p * w * h} cm³.`
            : `Volume of a cuboid = length × width × height = ${p} × ${w} × ${h} = ${p * w * h} cm³.`,
        ),
      };
    },
    application: (rng: Rng): Spec<number> => {
      const p = 10 * int(rng, 2, 6);
      const w = 10 * int(rng, 1, 4);
      const h = 10 * int(rng, 1, 4);
      const cm3 = p * w * h;
      const litres = cm3 / 1000;
      return {
        stem: T((l, f) =>
          l === 'id'
            ? `Sebuah akuarium berbentuk balok berukuran ${p} cm × ${w} cm × ${h} cm diisi penuh air. Berapa liter air di dalamnya? (1 liter = ${f(1000)} cm³)`
            : `A fish tank shaped like a cuboid measures ${p} cm × ${w} cm × ${h} cm and is full of water. How many litres of water does it hold? (1 litre = ${f(1000)} cm³)`,
        ),
        answer: litres,
        distractors: [cm3, litres * 10, (p + w + h) / 10],
        valid: (v) => Number.isInteger(v) && (v as number) > 0,
        explanation: T((l, f) =>
          l === 'id'
            ? `Volume = ${p} × ${w} × ${h} = ${f(cm3)} cm³. ${f(cm3)} ÷ ${f(1000)} = ${f(litres)} liter.`
            : `Volume = ${p} × ${w} × ${h} = ${f(cm3)} cm³. ${f(cm3)} ÷ ${f(1000)} = ${f(litres)} litres.`,
        ),
      };
    },
  },
};

// Two-step volume and arrival-time problems (#12).
volume.makers.multistep = (rng: Rng): Spec<number> => {
  const p = 20 * int(rng, 2, 5);
  const w = 10 * int(rng, 3, 6);
  const h = 10 * int(rng, 3, 6);
  const full = (p * w * h) / 1000;
  const half = full / 2;
  return {
    stem: T((l, f) =>
      l === 'id'
        ? `Sebuah bak berbentuk balok berukuran ${p} cm × ${w} cm × ${h} cm. Bak itu diisi air sampai setengahnya. Berapa liter airnya? (1 liter = ${f(1000)} cm³)`
        : `A tank shaped like a cuboid measures ${p} cm × ${w} cm × ${h} cm. It is filled halfway with water. How many litres of water are in it? (1 litre = ${f(1000)} cm³)`,
    ),
    answer: half,
    distractors: [full, half * 10, (p * w * h) / 2],
    valid: (v) => Number.isInteger(v) && (v as number) > 0,
    explanation: T((l, f) =>
      l === 'id'
        ? `Volume penuh = ${p} × ${w} × ${h} = ${f(p * w * h)} cm³ = ${f(full)} liter. Setengahnya = ${f(half)} liter.`
        : `Full volume = ${p} × ${w} × ${h} = ${f(p * w * h)} cm³ = ${f(full)} litres. Half of it = ${f(half)} litres.`,
    ),
  };
};

const clock = (h: number) =>
  L(`${String(h).padStart(2, '0')}.00`, `${String(h).padStart(2, '0')}:00`);

speedScale.makers.multistep = (rng: Rng): Spec<number> => {
  const v = pick(rng, [40, 50, 60, 70, 80]);
  const t = int(rng, 2, 5);
  const start = int(rng, 6, 11);
  const d = v * t;
  const arrive = start + t;
  return {
    stem: T((l) =>
      l === 'id'
        ? `Sebuah bus berangkat pukul ${clock(start).id} dan menempuh jarak ${d} km dengan kecepatan ${v} km/jam. Pukul berapa bus itu tiba?`
        : `A bus leaves at ${clock(start).en} and travels ${d} km at ${v} km/h. What time does it arrive?`,
    ),
    answer: arrive,
    distractors: [arrive + 1, arrive - 1, t],
    render: clock,
    valid: (x) => (x as number) >= 0 && (x as number) <= 23,
    explanation: T((l) =>
      l === 'id'
        ? `Waktu tempuh = ${d} ÷ ${v} = ${t} jam. ${clock(start).id} + ${t} jam = ${clock(arrive).id}.`
        : `Travel time = ${d} ÷ ${v} = ${t} hours. ${clock(start).en} + ${t} hours = ${clock(arrive).en}.`,
    ),
  };
};

export const TIER6 = [fracMulDiv, ratio, speedScale, mixedOps, volume];
