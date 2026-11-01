import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import ranksJson from '../src/data/ranks.json';
import { loadRanks } from '../src/systems/data';
import type { EconomyConfig, MinionType } from '../src/systems/economy';
import { curriculumTopicTiers, loadQuestionBank } from '../src/systems/questionBank';
import { createQuestionEngine, nextQuestion } from '../src/systems/questionEngine';
import {
  answer,
  createSession,
  onLastHit,
  tick,
  type Session,
} from '../src/systems/questionSession';
import type { Question } from '../src/systems/questions';
import {
  parseReviewQueue,
  serializeReviewQueue,
  updateReviewQueue,
  type MissedQuestion,
  type ReviewItem,
} from '../src/systems/reviewQueue';
import { createRng } from '../src/utils/rng';

const econ = economyJson as EconomyConfig;
const ranks = loadRanks(ranksJson);
const bank = loadQuestionBank();
const reveal = econ.questionRevealSeconds;
const reward = () => ({ gold: 14, exp: 30, at: { x: 0, y: 0 } });
const fresh = (seed = 1, review: ReviewItem[] = []) =>
  createSession(createQuestionEngine(bank, ranks, seed, review), econ);
const correctSlot = (s: Session) => s.active!.order.indexOf(s.active!.question.answerIndex);
const wrongSlot = (s: Session) => [0, 1, 2, 3].find((i) => i !== correctSlot(s))!;
const ofType = (type: Question['type'], tier = 2) =>
  bank.filter((q) => q.type === type && q.tier === tier);
const missedOf = (qs: Question[]): MissedQuestion[] =>
  qs.map((question) => ({ question, outcome: 'wrong', chosen: null }));

describe('answer feedback (#29)', () => {
  it('marks the right answer for a moment after a wrong answer, then clears', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 0, 3).session;
    const q = s.active!.question;
    const slot = wrongSlot(s);
    const chosen = s.active!.order[slot]!;
    s = answer(s, slot, 2).session;
    expect(s.active).toBeNull();
    expect(s.reveal).toMatchObject({ question: q, outcome: 'wrong', chosen, until: 2 + reveal });
    expect(tick(s, 2 + reveal / 2).session.reveal).not.toBeNull();
    expect(tick(s, 2 + reveal).session.reveal).toBeNull();
  });

  it('reveals correct answers and timeouts too', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 0, 3).session;
    s = answer(s, correctSlot(s), 1).session;
    expect(s.reveal?.outcome).toBe('correct');
    s = onLastHit(tick(s, 5).session, 'infantry', reward(), 5, 3).session;
    s = tick(s, 5 + econ.questionSeconds.infantry).session;
    expect(s.reveal).toMatchObject({ outcome: 'timeout', chosen: null });
  });

  it('a last hit during the reveal shows its question after it, and early taps do nothing', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 0, 3).session;
    s = answer(s, correctSlot(s), 1).session;
    s = onLastHit(s, 'lancer', reward(), 1.2, 3).session;
    expect(s.active!.shownAt).toBe(1 + reveal);
    expect(s.active!.deadline).toBe(1 + reveal + econ.questionSeconds.lancer);
    // A tap meant for the old card must not answer the new one.
    expect(answer(s, 0, 1.3).resolutions).toEqual([]);
    expect(answer(s, correctSlot(s), 1 + reveal).resolutions[0]!.outcome).toBe('correct');
  });

  it('collects wrong and timed-out questions for the Result screen, in order', () => {
    let s = onLastHit(fresh(), 'infantry', reward(), 0, 3).session;
    const q1 = s.active!.question;
    const slot = wrongSlot(s);
    const chosen = s.active!.order[slot]!;
    s = answer(s, slot, 1).session;
    s = onLastHit(tick(s, 5).session, 'infantry', reward(), 5, 3).session;
    s = answer(s, correctSlot(s), 6).session;
    s = onLastHit(tick(s, 10).session, 'lancer', reward(), 10, 3).session;
    const q3 = s.active!.question;
    s = tick(s, 30).session;
    expect(s.missed).toEqual([
      { question: q1, outcome: 'wrong', chosen },
      { question: q3, outcome: 'timeout', chosen: null },
    ]);
  });
});

describe('review queue (#29)', () => {
  it('adds missed questions with the full number of matches', () => {
    const qs = ofType('fluency').slice(0, 2);
    const q = updateReviewQueue([], missedOf(qs), ranks);
    expect(q.map((i) => [i.question.id, i.matchesLeft])).toEqual(
      qs.map((x) => [x.id, ranks.questionEngine.reviewMatches]),
    );
  });

  it('counts down unserved items and drops them after their last match', () => {
    const [a, b] = ofType('fluency');
    const q = updateReviewQueue(
      [
        { question: a!, matchesLeft: 3 },
        { question: b!, matchesLeft: 1 },
      ],
      [],
      ranks,
    );
    expect(q).toEqual([{ question: a, matchesLeft: 2 }]);
  });

  it('a question missed again starts over, and is never queued twice', () => {
    const [a] = ofType('fluency');
    const q = updateReviewQueue([{ question: a!, matchesLeft: 2 }], missedOf([a!, a!]), ranks);
    expect(q).toEqual([{ question: a, matchesLeft: ranks.questionEngine.reviewMatches }]);
  });

  it('keeps at most reviewQueueMax items, dropping the oldest', () => {
    const max = ranks.questionEngine.reviewQueueMax;
    const qs = bank.slice(0, max + 5);
    const q = updateReviewQueue([], missedOf(qs), ranks);
    expect(q).toHaveLength(max);
    expect(q[0]!.question.id).toBe(qs[5]!.id);
  });

  it('round-trips through storage and drops anything malformed', () => {
    const tiers = curriculumTopicTiers();
    const items = updateReviewQueue([], missedOf(bank.slice(0, 3)), ranks);
    const saved = JSON.parse(JSON.stringify(serializeReviewQueue(items)));
    expect(parseReviewQueue(saved, ranks, tiers)).toEqual(items);
    const broken = {
      items: [
        items[0],
        { question: { ...bank[1], answerIndex: 9 }, matchesLeft: 2 },
        { question: bank[2], matchesLeft: 0 },
        { question: bank[3], matchesLeft: 'x' },
        items[0],
        null,
      ],
    };
    expect(parseReviewQueue(broken, ranks, tiers)).toEqual([items[0]]);
    expect(parseReviewQueue('nonsense', ranks, tiers)).toEqual([]);
    expect(parseReviewQueue(null, ranks, tiers)).toEqual([]);
  });
});

describe('review questions in the match (#29)', () => {
  const every = ranks.questionEngine.reviewEvery;

  it('asks at most one review question in every reviewEvery questions, of the minion type', () => {
    const review = ofType('fluency', 1)
      .slice(0, 5)
      .map((question) => ({ question, matchesLeft: 3 }));
    let e = createQuestionEngine(bank, ranks, 7, review);
    const bands: string[] = [];
    for (let i = 0; i < 15; i++) {
      const p = nextQuestion(e, 4, 'infantry');
      bands.push(p.band);
      e = p.engine;
    }
    const at = bands.flatMap((b, i) => (b === 'missed' ? [i] : []));
    expect(at).toHaveLength(5);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(every);
    expect(e.review).toEqual([]);
  });

  it('waits for a matching minion unless it is the last match', () => {
    const [multi] = ofType('multistep');
    let e = createQuestionEngine(bank, ranks, 7, [{ question: multi!, matchesLeft: 2 }]);
    for (let i = 0; i < 10; i++) {
      const p = nextQuestion(e, 2, 'infantry');
      expect(p.band).not.toBe('missed');
      e = p.engine;
    }
    e = createQuestionEngine(bank, ranks, 7, [{ question: multi!, matchesLeft: 1 }]);
    const p = nextQuestion(e, 2, 'infantry');
    expect(p).toMatchObject({ band: 'missed', source: 'review', question: multi });
  });

  it('a review question keeps the timer of its own type when it comes on another minion', () => {
    const [multi] = ofType('multistep');
    const s = onLastHit(
      fresh(1, [{ question: multi!, matchesLeft: 1 }]),
      'infantry',
      reward(),
      0,
      2,
    ).session;
    expect(s.active!.question).toBe(multi);
    expect(s.active!.deadline).toBe(econ.questionSeconds.cannon);
  });

  /**
   * Plays a match of `hits` last hits (Infantry : Lancer : Cannon about 3 : 2 : 1/3, like the
   * waves), answering with `answerRight(q)`. Returns the ids asked and the queue afterwards.
   */
  function playMatch(
    queue: ReviewItem[],
    seed: number,
    hits: number,
    answerRight: (q: Question) => boolean,
    tier = 3,
  ) {
    const rng = createRng(seed);
    let s = fresh(seed, queue);
    let now = 0;
    const asked: string[] = [];
    for (let i = 0; i < hits; i++) {
      const r = rng() * (3 + 2 + 1 / 3);
      const kind: MinionType = r < 3 ? 'infantry' : r < 5 ? 'lancer' : 'cannon';
      s = onLastHit(tick(s, now).session, kind, reward(), now, tier).session;
      const a = s.active!;
      asked.push(a.question.id);
      const slot = answerRight(a.question) ? correctSlot(s) : wrongSlot(s);
      s = answer(s, slot, a.shownAt + 1).session;
      now = a.shownAt + 1 + reveal + 5;
    }
    return { asked, queue: updateReviewQueue(s.engine.review, s.missed, ranks) };
  }

  it('every missed question returns within the next 3 matches', () => {
    // A poor first match (a third missed), then only 15 last hits per match (real matches have 24+).
    for (const seed of [1, 2, 3, 4, 5]) {
      const first = playMatch([], seed, 40, (q) => q.id.length % 3 !== 0);
      const missedIds = new Set(first.queue.map((i) => i.question.id));
      expect(missedIds.size).toBeGreaterThan(5);
      let queue = first.queue;
      const seen = new Set<string>();
      for (let m = 1; m <= ranks.questionEngine.reviewMatches; m++) {
        const r = playMatch(queue, seed * 10 + m, 15, () => true);
        r.asked.forEach((id) => seen.add(id));
        queue = r.queue;
      }
      for (const id of missedIds) expect(seen.has(id), id).toBe(true);
      expect(queue).toEqual([]);
    }
  });

  it('a question missed again stays in the queue for another 3 matches', () => {
    const [a] = ofType('fluency', 3);
    const r = playMatch([{ question: a!, matchesLeft: 1 }], 9, 10, (q) => q.id !== a!.id);
    expect(r.asked).toContain(a!.id);
    expect(r.queue).toEqual([{ question: a, matchesLeft: ranks.questionEngine.reviewMatches }]);
  });
});
