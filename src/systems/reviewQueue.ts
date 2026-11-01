/**
 * The review queue (#29). Pure TypeScript, no Phaser.
 *
 * A question the player got wrong, or let time out on, comes back in one of the next
 * `reviewMatches` matches (ranks.json questionEngine, 3). Each item counts down the matches it
 * has left. The question engine serves review items during a match (see questionEngine.ts); an
 * item that is served leaves the queue, and if it is missed again it is queued afresh.
 */
import type { RanksFile } from './data';
import { validateQuestions, type Question } from './questions';

export interface ReviewItem {
  question: Question;
  /** Matches left to ask it in, counting the next one. 1 = the next match is its last chance. */
  matchesLeft: number;
}

export interface MissedQuestion {
  question: Question;
  outcome: 'wrong' | 'timeout';
  /** The choice index the player picked; null on a timeout. */
  chosen: number | null;
}

/**
 * The queue after a match: items not served this match lose one match (and drop out at 0),
 * then every question missed this match is added with the full `reviewMatches`.
 * A question is never in the queue twice; the newest entry wins.
 */
export function updateReviewQueue(
  unserved: readonly ReviewItem[],
  missed: readonly MissedQuestion[],
  ranks: RanksFile,
): ReviewItem[] {
  const { reviewMatches, reviewQueueMax } = ranks.questionEngine;
  const byId = new Map<string, ReviewItem>();
  for (const it of unserved)
    if (it.matchesLeft > 1)
      byId.set(it.question.id, { question: it.question, matchesLeft: it.matchesLeft - 1 });
  for (const m of missed) {
    byId.delete(m.question.id);
    byId.set(m.question.id, { question: m.question, matchesLeft: reviewMatches });
  }
  // Oldest first; if the queue is full the oldest go.
  return [...byId.values()].slice(-reviewQueueMax);
}

/** Saved queue from storage: keeps only well-formed items with a valid question. */
export function parseReviewQueue(
  raw: unknown,
  ranks: RanksFile,
  topicTiers: Map<string, number>,
): ReviewItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: ReviewItem[] = [];
  const max = ranks.questionEngine.reviewMatches;
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const { question, matchesLeft } = it as Partial<ReviewItem>;
    if (!Number.isInteger(matchesLeft) || matchesLeft! < 1 || matchesLeft! > max) continue;
    if (validateQuestions([question], topicTiers).length) continue;
    if (out.some((o) => o.question.id === question!.id)) continue;
    out.push({ question: question!, matchesLeft: matchesLeft! });
  }
  return out.slice(-ranks.questionEngine.reviewQueueMax);
}

export const serializeReviewQueue = (items: readonly ReviewItem[]) => ({ version: 1, items });
