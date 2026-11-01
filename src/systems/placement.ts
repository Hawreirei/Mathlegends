/**
 * Adaptive placement quiz (#38). Pure TypeScript, no Phaser.
 *
 * A staircase over Year 1-6: the first question is from `placement.firstTier` (Year 3); a right
 * answer moves the next question one Year up, a wrong answer or a timeout one Year down
 * (staying within Year 1-6). After `placement.questions` (10) answers:
 *
 *   mastery    = the highest Year with at least one right answer and no more wrong than right
 *                answers there (Year 1 if none);
 *   start Year = mastery + startOffset (-1), kept within Year 1 .. maxStartTier (5).
 *
 * The result depends only on the sequence of right/wrong answers, so the same answers always
 * give the same Year. All numbers come from ranks.json `placement`.
 */
import type { RanksFile } from './data';
import type { Question } from './questions';
import { createRng } from '../utils/rng';

export interface PlacementAnswer {
  tier: number;
  questionId: string;
  correct: boolean;
}

export interface PlacementState {
  /** The Year of the next question. */
  tier: number;
  answers: PlacementAnswer[];
  /** Ids already asked (never asked twice). */
  asked: string[];
  rng: () => number;
}

export const createPlacement = (ranks: RanksFile, seed: number): PlacementState => ({
  tier: clampTier(ranks.placement.firstTier, ranks),
  answers: [],
  asked: [],
  rng: createRng(seed),
});

const clampTier = (t: number, ranks: RanksFile) => Math.max(1, Math.min(ranks.tiers.length, t));

export const placementDone = (s: PlacementState, ranks: RanksFile): boolean =>
  s.answers.length >= ranks.placement.questions;

/** The next question: placement type, the current Year, not asked before in this quiz. */
export function nextPlacementQuestion(
  s: PlacementState,
  bank: readonly Question[],
  ranks: RanksFile,
): Question {
  const type = ranks.placement.questionType;
  const pool = bank.filter((q) => q.tier === s.tier && q.type === type);
  const fresh = pool.filter((q) => !s.asked.includes(q.id));
  const from = fresh.length ? fresh : pool;
  if (!from.length) throw new Error(`no ${type} questions for Year ${s.tier}`);
  return from[Math.floor(s.rng() * from.length)]!;
}

/** Records an answer (a timeout is `correct: false`) and moves the staircase. */
export function recordPlacementAnswer(
  s: PlacementState,
  q: Question,
  correct: boolean,
  ranks: RanksFile,
): PlacementState {
  return {
    ...s,
    tier: clampTier(s.tier + (correct ? 1 : -1), ranks),
    answers: [...s.answers, { tier: q.tier, questionId: q.id, correct }],
    asked: [...s.asked, q.id],
  };
}

/** The Year the player has shown they can do (see the file comment). */
export function estimateMastery(answers: readonly PlacementAnswer[]): number {
  let best = 1;
  const tiers = new Set(answers.map((a) => a.tier));
  for (const t of tiers) {
    const right = answers.filter((a) => a.tier === t && a.correct).length;
    const wrong = answers.filter((a) => a.tier === t && !a.correct).length;
    if (right >= 1 && right >= wrong && t > best) best = t;
  }
  return best;
}

/** The starting Year from the answers. */
export function placementTier(answers: readonly PlacementAnswer[], ranks: RanksFile): number {
  const p = ranks.placement;
  return Math.max(1, Math.min(p.maxStartTier, estimateMastery(answers) + p.startOffset));
}

/** Plays the staircase for a fixed right/wrong sequence; returns the Years asked and the result. */
export function simulatePlacement(
  results: readonly boolean[],
  ranks: RanksFile,
): { tiers: number[]; start: number } {
  let tier = clampTier(ranks.placement.firstTier, ranks);
  const answers: PlacementAnswer[] = [];
  const tiers: number[] = [];
  for (const correct of results.slice(0, ranks.placement.questions)) {
    tiers.push(tier);
    answers.push({ tier, questionId: `q${answers.length}`, correct });
    tier = clampTier(tier + (correct ? 1 : -1), ranks);
  }
  return { tiers, start: placementTier(answers, ranks) };
}
