import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import ranksJson from '../src/data/ranks.json';
import {
  appendRows,
  COLUMNS,
  csvFileName,
  logSummary,
  newMatchId,
  parseLog,
  rowFor,
  serializeLog,
  toCsv,
  type AnswerRow,
} from '../src/systems/answerLog';
import { loadRanks } from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { loadQuestionBank } from '../src/systems/questionBank';
import { createQuestionEngine } from '../src/systems/questionEngine';
import {
  answer,
  createSession,
  onLastHit,
  tick,
  timeLimit,
  type Resolution,
} from '../src/systems/questionSession';
import { loadJson, saveJson, type KeyValueStore } from '../src/utils/storage';

const econ = economyJson as EconomyConfig;
const bank = loadQuestionBank();
const reward = () => ({ gold: 14, exp: 30, at: { x: 0, y: 0 } });
const info = {
  matchId: 'm-abc-123456',
  matchStart: '2026-11-01T10:00:00.000Z',
  playerTier: 3,
  lang: 'id' as const,
};

/** Plays: correct, wrong, timeout, plus one skipped last hit. Returns every resolution. */
function play(): Resolution[] {
  const out: Resolution[] = [];
  let s = createSession(createQuestionEngine(bank, loadRanks(ranksJson), 3), econ);
  const push = (r: { session: typeof s; resolutions: Resolution[] }) => {
    out.push(...r.resolutions);
    s = r.session;
  };
  push(onLastHit(s, 'infantry', reward(), 10, 3));
  const slot = (right: boolean) => {
    const a = s.active!;
    const i = a.order.indexOf(a.question.answerIndex);
    return right ? i : (i + 1) % 4;
  };
  push(answer(s, slot(true), 11.25));
  push(onLastHit(s, 'lancer', reward(), 20, 3));
  push(answer(s, slot(false), 23.5));
  push(onLastHit(s, 'infantry', reward(), 30, 3));
  push(onLastHit(s, 'infantry', reward(), 30, 3));
  push(onLastHit(s, 'infantry', reward(), 30, 3)); // third: skipped (one shows, one waits)
  push(tick(s, 100)); // the shown one times out; the waiting one went stale: skipped
  return out;
}

describe('answer log rows (#30)', () => {
  it('logs every shown question and never a skipped last hit', () => {
    const res = play();
    expect(res.some((r) => r.outcome === 'skipped')).toBe(true);
    const rows = res
      .map((r, i) => rowFor(r, info, i + 1, r.question ? timeLimit(econ, r.question) : 0))
      .filter((r): r is AnswerRow => r !== null);
    expect(rows.map((r) => r.outcome)).toEqual(['correct', 'wrong', 'timeout']);
    const [right, wrong, timedOut] = rows;
    expect(right).toMatchObject({
      matchId: info.matchId,
      playerTier: 3,
      minion: 'infantry',
      questionType: 'fluency',
      correct: 1,
      responseMs: 1250,
      matchSec: 10,
      timeLimitSec: econ.questionSeconds.infantry,
      lang: 'id',
    });
    expect(right!.chosenIndex).toBe(right!.answerIndex);
    expect(wrong).toMatchObject({ correct: 0, minion: 'lancer', questionType: 'application' });
    expect(wrong!.chosenIndex).not.toBe(wrong!.answerIndex);
    expect(timedOut).toMatchObject({ correct: 0, chosenIndex: null, responseMs: null });
    for (const r of rows) {
      expect(['onLevel', 'review', 'stretch', 'missed']).toContain(r.band);
      expect(r.itemId).toBeTruthy();
      expect(r.questionTier).toBeGreaterThanOrEqual(1);
    }
  });

  it('holds no personal data: only the documented columns, and a random match id', () => {
    const r = play()
      .map((x, i) => rowFor(x, info, i + 1, 5))
      .find(Boolean)!;
    expect(Object.keys(r).sort()).toEqual([...COLUMNS].sort());
    const a = newMatchId(1_700_000_000_000, () => 0.5);
    expect(a).toMatch(/^m-[0-9a-z]+-[0-9a-z]{6}$/);
    expect(newMatchId(1_700_000_000_000, () => 0.1)).not.toBe(a);
  });
});

describe('answer log storage (#30)', () => {
  const row = (i: number): AnswerRow => ({
    ...info,
    seq: i,
    matchSec: i,
    questionTier: 1,
    questionType: 'fluency',
    topic: 't1.addsub20',
    itemId: `x${i}`,
    itemSource: 'generated',
    band: 'onLevel',
    minion: 'infantry',
    outcome: 'correct',
    correct: 1,
    chosenIndex: 0,
    answerIndex: 0,
    responseMs: 900,
    timeLimitSec: 5,
  });

  it('keeps only the newest rows', () => {
    const log = appendRows([row(1), row(2)], [row(3)], 2);
    expect(log.map((r) => r.seq)).toEqual([2, 3]);
  });

  it('round-trips through storage and drops malformed rows', () => {
    const mem = new Map<string, string>();
    const store: KeyValueStore = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
    };
    expect(saveJson(store, 'k', serializeLog([row(1), row(2)]))).toBe(true);
    expect(parseLog(loadJson(store, 'k'))).toEqual([row(1), row(2)]);
    expect(parseLog({ rows: [row(1), { itemId: 3 }, null, 'x'] })).toEqual([row(1)]);
    expect(parseLog('junk')).toEqual([]);
    mem.set('k', '{not json');
    expect(loadJson(store, 'k')).toBeNull();
    const blocked: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadJson(blocked, 'k')).toBeNull();
    expect(saveJson(blocked, 'k', [])).toBe(false);
    expect(saveJson(null, 'k', [])).toBe(false);
  });

  it('summarises answers and matches', () => {
    expect(logSummary([row(1), row(2), { ...row(3), matchId: 'm-2' }])).toEqual({
      answers: 3,
      matches: 2,
    });
  });
});

describe('CSV export (#30)', () => {
  it('has a header row in the documented column order and one line per answer', () => {
    const rows = play()
      .map((x, i) => rowFor(x, info, i + 1, 5))
      .filter((r): r is AnswerRow => r !== null);
    const csv = toCsv(rows);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe(COLUMNS.join(','));
    expect(lines).toHaveLength(rows.length + 1);
    expect(csv.endsWith('\r\n')).toBe(true);
    // Empty fields for a timeout's chosen index and response time.
    const t = lines[3]!.split(',');
    expect(t[COLUMNS.indexOf('chosenIndex')]).toBe('');
    expect(t[COLUMNS.indexOf('responseMs')]).toBe('');
  });

  it('quotes fields with commas, quotes or line breaks', () => {
    const r = { topic: 'a,b', itemId: 'say "hi"', band: 'x\ny' } as unknown as AnswerRow;
    const line = toCsv([r]).split('\r\n')[1]!;
    expect(line).toContain('"a,b"');
    expect(line).toContain('"say ""hi"""');
    expect(line).toContain('"x\ny"');
  });

  it('an empty log is just the header', () => {
    expect(toCsv([])).toBe(COLUMNS.join(',') + '\r\n');
  });

  it('names the file by date', () => {
    expect(csvFileName(new Date('2026-11-01T23:00:00Z'))).toBe(
      'mathlegends-answers-2026-11-01.csv',
    );
  });
});
