/**
 * Picks the question for a last hit (#26). Pure TypeScript, no Phaser.
 *
 * - The minion decides the type: Infantry = fluency, Lancer = application, Cannon = multistep.
 * - The band follows ranks.json questionMix: on-level (the player's tier), review (a lower tier,
 *   usually the one just below) or stretch (the tier above). Year 1 has no review, so that share
 *   goes to on-level; at the top tier stretch stays on the top tier.
 * - Nothing asked in the last `repeatWindow` questions is asked again. When the bank has nothing
 *   fresh left for a pick, a new question is generated (src/systems/generators) instead.
 * - Review (#29): questions missed in earlier matches come back. At most one in every
 *   `reviewEvery` questions is a review item of the same type as the minion; an item on its last
 *   match (matchesLeft 1) may come on any last hit, with the timer of its own type.
 */
import type { RanksFile } from './data';
import type { MinionType } from './economy';
import { FAMILIES, generateQuestions, supportedTypes } from './generators';
import type { Question, QuestionType } from './questions';
import type { ReviewItem } from './reviewQueue';
import { createRng } from '../utils/rng';

/** `missed`: a question the player missed in an earlier match (#29). */
export type Band = 'onLevel' | 'review' | 'stretch' | 'missed';

const TYPE_BY_MINION: Record<MinionType, QuestionType> = {
  infantry: 'fluency',
  lancer: 'application',
  cannon: 'multistep',
};

export const questionTypeFor = (m: MinionType): QuestionType => TYPE_BY_MINION[m];

/** The minion whose timer fits a question type (Infantry for fluency, and so on). */
export const minionForType = (t: QuestionType): MinionType =>
  (Object.keys(TYPE_BY_MINION) as MinionType[]).find((m) => TYPE_BY_MINION[m] === t)!;

export interface QuestionEngine {
  readonly pools: ReadonlyMap<string, readonly Question[]>;
  readonly ranks: RanksFile;
  readonly topTier: number;
  /** Ids of recently asked questions, oldest first (at most repeatWindow - 1 kept). */
  readonly recent: readonly string[];
  readonly rng: () => number;
  /** Missed questions from earlier matches still waiting to be asked this match (#29). */
  readonly review: readonly ReviewItem[];
  /** Questions asked since the last review question. */
  readonly sinceReview: number;
}

export interface Pick {
  engine: QuestionEngine;
  question: Question;
  band: Band;
  source: 'bank' | 'generated' | 'review';
}

const key = (tier: number, type: QuestionType) => `${tier}:${type}`;

export function createQuestionEngine(
  bank: readonly Question[],
  ranks: RanksFile,
  seed: number,
  review: readonly ReviewItem[] = [],
): QuestionEngine {
  const pools = new Map<string, Question[]>();
  for (const q of bank) {
    const k = key(q.tier, q.type);
    pools.set(k, [...(pools.get(k) ?? []), q]);
  }
  return {
    pools,
    ranks,
    topTier: ranks.tiers.length,
    recent: [],
    rng: createRng(seed),
    review: [...review],
    sinceReview: 0,
  };
}

function chooseBand(e: QuestionEngine, tier: number): Band {
  const mix = e.ranks.questionMix;
  const r = e.rng();
  if (r < mix.stretch) return 'stretch';
  if (r < mix.stretch + mix.review) return tier > 1 ? 'review' : 'onLevel';
  return 'onLevel';
}

function tierForBand(e: QuestionEngine, tier: number, band: Band): number {
  if (band === 'onLevel') return tier;
  if (band === 'stretch') return Math.min(e.topTier, tier + 1);
  if (tier === 2 || e.rng() < e.ranks.questionEngine.reviewPreviousTierShare) return tier - 1;
  return 1 + Math.floor(e.rng() * (tier - 1));
}

/** A fresh generated question for this tier and type that was not asked recently, or null. */
function generateFresh(
  e: QuestionEngine,
  tier: number,
  type: QuestionType,
  recent: Set<string>,
): Question | null {
  const families = FAMILIES.filter(
    (f) => f.tier === tier && supportedTypes(f.topic).includes(type),
  );
  for (let attempt = 0; attempt < 20 && families.length; attempt++) {
    const fam = families[Math.floor(e.rng() * families.length)]!;
    const q = generateQuestions(fam.topic, type, 1, Math.floor(e.rng() * 2 ** 31))[0];
    if (q && !recent.has(q.id)) return q;
  }
  return null;
}

/** The review item to ask now, if any (see the file comment). */
function pickReview(e: QuestionEngine, type: QuestionType): ReviewItem | undefined {
  if (!e.review.length) return undefined;
  const urgent = e.review.filter((r) => r.matchesLeft <= 1);
  const due = e.sinceReview >= e.ranks.questionEngine.reviewEvery - 1;
  return (
    urgent.find((r) => r.question.type === type) ??
    urgent[0] ??
    (due ? e.review.find((r) => r.question.type === type) : undefined)
  );
}

const remember = (e: QuestionEngine, id: string) =>
  [...e.recent, id].slice(-(e.ranks.questionEngine.repeatWindow - 1));

export function nextQuestion(e: QuestionEngine, playerTier: number, minion: MinionType): Pick {
  const type = questionTypeFor(minion);
  const rev = pickReview(e, type);
  if (rev)
    return {
      engine: {
        ...e,
        recent: remember(e, rev.question.id),
        review: e.review.filter((r) => r !== rev),
        sinceReview: 0,
      },
      question: rev.question,
      band: 'missed',
      source: 'review',
    };

  const tier = Math.max(1, Math.min(e.topTier, playerTier));
  const band = chooseBand(e, tier);
  const qTier = tierForBand(e, tier, band);
  const recent = new Set(e.recent);
  const pool = e.pools.get(key(qTier, type)) ?? [];
  const fresh = pool.filter((q) => !recent.has(q.id));

  let question: Question | undefined;
  let source: Pick['source'] = 'bank';
  if (fresh.length) question = fresh[Math.floor(e.rng() * fresh.length)];
  else {
    const g = generateFresh(e, qTier, type, recent);
    if (g) {
      question = g;
      source = 'generated';
    } else {
      // Last resort: the question asked longest ago.
      question = [...pool].sort((a, b) => e.recent.indexOf(a.id) - e.recent.indexOf(b.id))[0];
    }
  }
  if (!question) throw new Error(`no questions at all for tier ${qTier} ${type}`);

  return {
    engine: { ...e, recent: remember(e, question.id), sinceReview: e.sinceReview + 1 },
    question,
    band,
    source,
  };
}
