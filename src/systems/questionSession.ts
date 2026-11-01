/**
 * The questions of one match (#27). Pure TypeScript, no Phaser.
 *
 * - A player's last hit shows a question (or waits, if one is already showing). Only one question
 *   at a time; at most one waits. A further last hit, or a waiting question older than its own
 *   timer, is "skipped": it pays the normal reward (x1) with no penalty and no question.
 * - Timer per minion type from economy.json questionSeconds (Infantry 5, Lancer 8, Cannon 12 s).
 * - Answers are shown in a shuffled order; `answer` takes the slot the player tapped.
 * - Each resolution says how to pay the held last-hit reward: x correct (with streak bonus),
 *   x wrong, x timeout, or x1 when skipped. MatchScene applies it with applyLastHitReward.
 * - Feedback (#29): after an answer or a timeout the card shows the right answer for
 *   economy.json questionRevealSeconds (`reveal`). A waiting question appears after that, with its
 *   full timer. Wrong and timed-out questions are collected in `missed` for the Result screen and
 *   the review queue.
 */
import { rewardMultiplier, type EconomyConfig, type MinionType } from './economy';
import type { Point } from './map';
import { minionForType, nextQuestion, type Band, type QuestionEngine } from './questionEngine';
import type { Question } from './questions';
import type { MissedQuestion } from './reviewQueue';

export interface HeldReward {
  gold: number;
  exp: number;
  at: Point;
}

export interface ActiveQuestion {
  question: Question;
  band: Band;
  kind: MinionType;
  reward: HeldReward;
  /** order[slot] = index into question.choices shown in that slot. */
  order: number[];
  /** When it appears (after any reveal of the previous answer); taps before this are ignored. */
  shownAt: number;
  deadline: number;
}

/** The answered (or timed-out) question, shown with the right answer marked until `until`. */
export interface Reveal {
  question: Question;
  order: number[];
  outcome: 'correct' | 'wrong' | 'timeout';
  chosen: number | null;
  until: number;
}

interface Waiting {
  kind: MinionType;
  reward: HeldReward;
  tier: number;
  hitAt: number;
}

export type Outcome = 'correct' | 'wrong' | 'timeout' | 'skipped';

export interface Resolution {
  outcome: Outcome;
  multiplier: number;
  reward: HeldReward;
  kind: MinionType;
  /** Null when skipped (no question was shown). */
  question: Question | null;
  /** The choice index the player picked (correct/wrong only). */
  chosen: number | null;
  /** Seconds from showing to answering (correct/wrong only). */
  responseSec: number | null;
}

export interface Session {
  engine: QuestionEngine;
  econ: EconomyConfig;
  active: ActiveQuestion | null;
  queued: Waiting | null;
  reveal: Reveal | null;
  /** Wrong or timed-out questions this match, in order. */
  missed: MissedQuestion[];
  /** Correct answers in a row. */
  streak: number;
  asked: number;
  correct: number;
}

export const createSession = (engine: QuestionEngine, econ: EconomyConfig): Session => ({
  engine,
  econ,
  active: null,
  queued: null,
  reveal: null,
  missed: [],
  streak: 0,
  asked: 0,
  correct: 0,
});

type Result = { session: Session; resolutions: Resolution[] };

const skipped = (w: { kind: MinionType; reward: HeldReward }): Resolution => ({
  outcome: 'skipped',
  multiplier: 1,
  reward: w.reward,
  kind: w.kind,
  question: null,
  chosen: null,
  responseSec: null,
});

function show(
  s: Session,
  kind: MinionType,
  reward: HeldReward,
  tier: number,
  now: number,
): Session {
  const pick = nextQuestion(s.engine, tier, kind);
  // Shuffle the four answers for display with the engine's own random numbers.
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(pick.engine.rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  // The timer follows the question's own type: a review question can come on another minion.
  const q = pick.question;
  const seconds = q.timeSec ?? s.econ.questionSeconds[minionForType(q.type)];
  return {
    ...s,
    engine: pick.engine,
    asked: s.asked + 1,
    active: {
      question: pick.question,
      band: pick.band,
      kind,
      reward,
      order,
      shownAt: now,
      deadline: now + seconds,
    },
  };
}

/**
 * After the active question ends: mark the right answer for a moment, then bring up the waiting
 * question (or skip it if it went stale).
 */
function advance(s: Session, a: ActiveQuestion, chosen: number | null, now: number): Result {
  const right = chosen === a.question.answerIndex;
  const outcome = chosen === null ? 'timeout' : right ? 'correct' : 'wrong';
  const until = now + s.econ.questionRevealSeconds;
  const missed: MissedQuestion[] =
    outcome === 'correct' ? s.missed : [...s.missed, { question: a.question, outcome, chosen }];
  const cleared: Session = {
    ...s,
    active: null,
    queued: null,
    missed,
    reveal: { question: a.question, order: a.order, outcome, chosen, until },
  };
  const w = s.queued;
  if (!w) return { session: cleared, resolutions: [] };
  if (now - w.hitAt > s.econ.questionSeconds[w.kind])
    return { session: cleared, resolutions: [skipped(w)] };
  return { session: show(cleared, w.kind, w.reward, w.tier, until), resolutions: [] };
}

/** The player's last hit on a minion. `tier` is the player's Year. */
export function onLastHit(
  s: Session,
  kind: MinionType,
  reward: HeldReward,
  now: number,
  tier: number,
): Result {
  // During a reveal the new question waits until the reveal ends.
  const at = Math.max(now, s.reveal?.until ?? now);
  if (!s.active) return { session: show(s, kind, reward, tier, at), resolutions: [] };
  if (!s.queued)
    return { session: { ...s, queued: { kind, reward, tier, hitAt: now } }, resolutions: [] };
  return { session: s, resolutions: [skipped({ kind, reward })] };
}

/** The player tapped answer slot `slot` (0..3). */
export function answer(s: Session, slot: number, now: number): Result {
  const a = s.active;
  if (!a || now < a.shownAt || !Number.isInteger(slot) || slot < 0 || slot > 3)
    return { session: s, resolutions: [] };
  const chosen = a.order[slot]!;
  const right = chosen === a.question.answerIndex;
  const multiplier = rewardMultiplier(s.econ, right ? 'correct' : 'wrong', s.streak);
  const res: Resolution = {
    outcome: right ? 'correct' : 'wrong',
    multiplier,
    reward: a.reward,
    kind: a.kind,
    question: a.question,
    chosen,
    responseSec: now - a.shownAt,
  };
  const next = { ...s, streak: right ? s.streak + 1 : 0, correct: s.correct + (right ? 1 : 0) };
  const r = advance(next, a, chosen, now);
  return { session: r.session, resolutions: [res, ...r.resolutions] };
}

/** Call every frame: ends the active question at its deadline (timeout) and clears old reveals. */
export function tick(s: Session, now: number): Result {
  if (s.reveal && now >= s.reveal.until) s = { ...s, reveal: null };
  const a = s.active;
  if (!a || now < a.deadline) return { session: s, resolutions: [] };
  const res: Resolution = {
    outcome: 'timeout',
    multiplier: rewardMultiplier(s.econ, 'timeout', s.streak),
    reward: a.reward,
    kind: a.kind,
    question: a.question,
    chosen: null,
    responseSec: null,
  };
  const r = advance({ ...s, streak: 0 }, a, null, now);
  return { session: r.session, resolutions: [res, ...r.resolutions] };
}
