/**
 * Anonymous answer log for research (#30). Pure TypeScript, no Phaser.
 *
 * One row per question that was shown and ended (correct, wrong or timeout); skipped last hits
 * never showed a question and are not logged. No names, no device ids, no network: the log stays
 * in this browser until someone exports it as CSV from the Settings screen.
 * The columns are documented in docs/DATA.md.
 */
import type { Lang } from './gameState';
import type { Resolution } from './questionSession';

export const LOG_VERSION = 1;
/** Most rows kept on the device; the oldest go first (about 1 MB of storage). */
export const LOG_MAX_ROWS = 5000;

export interface AnswerRow {
  /** Random id of the match, the same for all its rows. Not linked to a person. */
  matchId: string;
  /** When the match started (ISO 8601, UTC). */
  matchStart: string;
  /** 1 for the first question of the match, 2 for the next... */
  seq: number;
  /** Match clock (seconds) when the question appeared. */
  matchSec: number;
  playerTier: number;
  questionTier: number;
  questionType: string;
  topic: string;
  itemId: string;
  /** handwritten, generated or gensoal. */
  itemSource: string;
  /** onLevel, review, stretch or missed (a question missed in an earlier match). */
  band: string;
  minion: string;
  outcome: 'correct' | 'wrong' | 'timeout';
  correct: 0 | 1;
  /** Choice index picked (0-3, as in the bank, not the shuffled slot); empty on a timeout. */
  chosenIndex: number | null;
  answerIndex: number;
  /** Milliseconds from showing to answering; empty on a timeout. */
  responseMs: number | null;
  /** Seconds the player had. */
  timeLimitSec: number;
  lang: Lang;
}

export const COLUMNS: readonly (keyof AnswerRow)[] = [
  'matchId',
  'matchStart',
  'seq',
  'matchSec',
  'playerTier',
  'questionTier',
  'questionType',
  'topic',
  'itemId',
  'itemSource',
  'band',
  'minion',
  'outcome',
  'correct',
  'chosenIndex',
  'answerIndex',
  'responseMs',
  'timeLimitSec',
  'lang',
];

/** A random match id like "m-lx3k9a-4f7q2c". `rand` returns numbers in [0, 1). */
export function newMatchId(nowMs: number, rand: () => number = Math.random): string {
  const r = Math.floor(rand() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
  return `m-${nowMs.toString(36)}-${r}`;
}

export interface MatchLogInfo {
  matchId: string;
  matchStart: string;
  playerTier: number;
  lang: Lang;
}

/** The row for one resolution, or null when no question was shown (skipped). */
export function rowFor(
  res: Resolution,
  info: MatchLogInfo,
  seq: number,
  timeLimitSec: number,
): AnswerRow | null {
  const q = res.question;
  if (!q || res.outcome === 'skipped') return null;
  return {
    matchId: info.matchId,
    matchStart: info.matchStart,
    seq,
    matchSec: Math.round((res.shownAt ?? 0) * 10) / 10,
    playerTier: info.playerTier,
    questionTier: q.tier,
    questionType: q.type,
    topic: q.topic,
    itemId: q.id,
    itemSource: q.source ?? '',
    band: res.band ?? '',
    minion: res.kind,
    outcome: res.outcome,
    correct: res.outcome === 'correct' ? 1 : 0,
    chosenIndex: res.chosen,
    answerIndex: q.answerIndex,
    responseMs: res.responseSec === null ? null : Math.round(res.responseSec * 1000),
    timeLimitSec,
    lang: info.lang,
  };
}

/** Old rows plus new ones, keeping the newest `max`. */
export const appendRows = (
  log: readonly AnswerRow[],
  rows: readonly AnswerRow[],
  max = LOG_MAX_ROWS,
): AnswerRow[] => [...log, ...rows].slice(-max);

const isRow = (r: unknown): r is AnswerRow =>
  !!r &&
  typeof r === 'object' &&
  typeof (r as AnswerRow).matchId === 'string' &&
  typeof (r as AnswerRow).itemId === 'string' &&
  ['correct', 'wrong', 'timeout'].includes((r as AnswerRow).outcome);

/** The saved log from storage; anything malformed is dropped. */
export function parseLog(raw: unknown): AnswerRow[] {
  if (!raw || typeof raw !== 'object') return [];
  const rows = (raw as { rows?: unknown }).rows;
  return Array.isArray(rows) ? rows.filter(isRow).slice(-LOG_MAX_ROWS) : [];
}

export const serializeLog = (rows: readonly AnswerRow[]) => ({ version: LOG_VERSION, rows });

/** One CSV field: quoted when it holds a comma, quote or line break; empty for null. */
function field(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with a header row and CRLF line ends (opens cleanly in Excel and Sheets). */
export function toCsv(rows: readonly AnswerRow[]): string {
  const lines = [COLUMNS.join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => field(r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** File name like "mathlegends-answers-2026-11-01.csv". */
export const csvFileName = (now: Date) =>
  `mathlegends-answers-${now.toISOString().slice(0, 10)}.csv`;

/** Summary for the Settings screen. */
export function logSummary(rows: readonly AnswerRow[]): { answers: number; matches: number } {
  return { answers: rows.length, matches: new Set(rows.map((r) => r.matchId)).size };
}
