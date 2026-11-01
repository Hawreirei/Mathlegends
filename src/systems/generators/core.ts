/**
 * Shared helpers for procedural question generators (#11). Pure TypeScript, no Phaser.
 * Every generator is deterministic for a given RNG, so a fixed seed gives the same questions.
 */
import type { Choice, LocalizedText, Question, QuestionType } from '../questions.ts';

export type Rng = () => number;
export type Lang = 'id' | 'en';
export type Frac = [number, number];

/** Integer in [min, max], inclusive. */
export const int = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] as T;

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** `count` distinct integers from [min, max]. */
export function distinctInts(rng: Rng, count: number, min: number, max: number): number[] {
  const out = new Set<number>();
  while (out.size < count) out.add(int(rng, min, max));
  return [...out];
}

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;

export function reduce([n, d]: Frac): Frac {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}

/** Number formatting: Indonesian uses "." for thousands and "," for decimals; English the reverse. */
export function fmt(n: number, lang: Lang): string {
  const neg = n < 0;
  const [intPart = '0', frac] = String(Number(Math.abs(n).toFixed(6))).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'id' ? '.' : ',');
  return (neg ? '-' : '') + grouped + (frac ? (lang === 'id' ? ',' : '.') + frac : '');
}

export const L = (id: string, en: string): LocalizedText => ({ id, en });

/** Build both languages from one template; `n(x)` inside formats a number for that language. */
export function T(make: (lang: Lang, n: (x: number) => string) => string): LocalizedText {
  return L(
    make('id', (x) => fmt(x, 'id')),
    make('en', (x) => fmt(x, 'en')),
  );
}

/** A number as a choice: plain JSON number when it reads the same in both languages, else localized text. */
export const numChoice = (n: number): Choice =>
  Number.isInteger(n) && Math.abs(n) < 1000 ? n : L(fmt(n, 'id'), fmt(n, 'en'));

export const rupiah = (n: number): Choice => L(`Rp${fmt(n, 'id')}`, `Rp${fmt(n, 'en')}`);
export const fracStr = ([n, d]: Frac): string => (d === 1 ? String(n) : `${n}/${d}`);
export const fracKey = (f: Frac): string => fracStr(reduce(f));

/** "a, b, c dan d" / "a, b, c and d". */
export function list(items: string[], lang: Lang, word: 'and' | 'or' = 'and'): string {
  const joiner = { id: { and: 'dan', or: 'atau' }, en: { and: 'and', or: 'or' } }[lang][word];
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${joiner} ${items[items.length - 1]}`;
}

/** What a generator returns before choices are shuffled. */
export interface Spec<V> {
  stem: LocalizedText;
  explanation: LocalizedText;
  answer: V;
  /** Most plausible wrong answers first (common mistakes). */
  distractors: V[];
  tags?: string[];
  /** Equality key; values with the same key count as the same answer. Default: numeric value. */
  key?(v: V): string;
  /** How a value is shown. Default: numChoice. */
  render?(v: V): Choice;
  /** Extra candidates if fewer than 3 distractors survive. Default: answer + small offsets. */
  fill?(k: number): V;
  /** Reject impossible distractors. Default: finite and >= 0. */
  valid?(v: V): boolean;
}

const OFFSETS = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 4, -4, 20, -20, 100, -100];

export function pickChoices<V>(rng: Rng, s: Spec<V>): { choices: Choice[]; answerIndex: number } {
  const key = s.key ?? ((v: V) => String(Number((v as number).toFixed(6))));
  const render = s.render ?? ((v: V) => numChoice(v as number));
  const valid =
    s.valid ?? ((v: V) => typeof v === 'number' && Number.isFinite(v) && (v as number) >= 0);
  const fill = s.fill ?? ((k: number) => ((s.answer as number) + (OFFSETS[k] ?? k * 7)) as V);
  const seen = new Set([key(s.answer)]);
  const wrong: V[] = [];
  const consider = (v: V) => {
    if (wrong.length >= 3 || !valid(v)) return;
    const k = key(v);
    if (seen.has(k)) return;
    seen.add(k);
    wrong.push(v);
  };
  s.distractors.forEach(consider);
  for (let k = 0; wrong.length < 3 && k < 40; k++) consider(fill(k));
  if (wrong.length < 3) throw new Error(`could not build 3 distractors for "${s.stem.en}"`);
  const order = shuffle(rng, [0, 1, 2, 3]);
  const all = [s.answer, ...wrong];
  return { choices: order.map((i) => render(all[i] as V)), answerIndex: order.indexOf(0) };
}

/** FNV-1a hash in base 36: a short stable id suffix from the English stem. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

export type Maker = (rng: Rng) => Spec<unknown>;

export interface Family {
  topic: string;
  tier: number;
  makers: Partial<Record<QuestionType, Maker>>;
}

export function build(rng: Rng, fam: Family, type: QuestionType): Question {
  const maker = fam.makers[type];
  if (!maker) throw new Error(`${fam.topic} has no ${type} generator`);
  const spec = maker(rng);
  const { choices, answerIndex } = pickChoices(rng, spec);
  const q: Question = {
    id: `${fam.topic}.g${hash(spec.stem.en)}`,
    tier: fam.tier,
    type,
    topic: fam.topic,
    stem: spec.stem,
    choices,
    answerIndex,
    explanation: spec.explanation,
    source: 'generated',
  };
  if (spec.tags) q.tags = spec.tags;
  return q;
}

/** Word-problem names and objects (Indonesian contexts). Names avoid gendered pronouns in English. */
export const NAMES = [
  'Ani',
  'Budi',
  'Citra',
  'Dedi',
  'Eka',
  'Fajar',
  'Gita',
  'Hadi',
  'Intan',
  'Joko',
  'Kartika',
  'Lukman',
  'Maya',
  'Nanda',
  'Putri',
  'Rina',
  'Sari',
  'Tono',
  'Wati',
  'Yusuf',
] as const;

export const THINGS: readonly LocalizedText[] = [
  L('kelereng', 'marbles'),
  L('apel', 'apples'),
  L('buku', 'books'),
  L('pensil', 'pencils'),
  L('permen', 'sweets'),
  L('kue', 'cakes'),
  L('stiker', 'stickers'),
  L('balon', 'balloons'),
  L('jeruk', 'oranges'),
  L('kartu', 'cards'),
];

/** Two different names. */
export function twoNames(rng: Rng): [string, string] {
  const a = pick(rng, NAMES);
  let b = pick(rng, NAMES);
  while (b === a) b = pick(rng, NAMES);
  return [a, b];
}
