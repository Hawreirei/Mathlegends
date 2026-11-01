/**
 * Question bank schema and validator. Pure TypeScript, no Phaser (AGENTS.md rule 2).
 * Used at load time in the game and by scripts/validate-questions.ts in CI (rule 4).
 * Format reference: docs/QUESTIONS.md.
 */

export const QUESTION_TYPES = ['fluency', 'application', 'multistep'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Text in both game languages. */
export interface LocalizedText {
  id: string;
  en: string;
}

/** A choice is a number, a language-neutral string (like "3/4"), or text in both languages. */
export type Choice = number | string | LocalizedText;

export interface Question {
  id: string;
  tier: number;
  type: QuestionType;
  topic: string;
  stem: LocalizedText;
  choices: Choice[];
  answerIndex: number;
  explanation: LocalizedText;
  /** Optional override; normally the timer comes from economy.json questionSeconds. */
  timeSec?: number;
  tags?: string[];
  source?: 'generated' | 'handwritten' | 'gensoal';
}

export interface QuestionError {
  index: number;
  id?: string;
  message: string;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const SOURCES = ['generated', 'handwritten', 'gensoal'];
const MAX_TIME_SEC = 60;

/** Map topic id -> tier, built from src/data/curriculum.json. */
export function topicTiersFromCurriculum(c: {
  tiers: { tier: number; topics: { id: string }[] }[];
}): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of c.tiers) for (const topic of t.topics) m.set(topic.id, t.tier);
  return m;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function checkLocalized(v: unknown, field: string, push: (m: string) => void): void {
  if (!isObj(v)) {
    push(`${field} is missing (needs { "id": ..., "en": ... })`);
    return;
  }
  if (!nonEmpty(v.id)) push(`${field}.id (Indonesian) is missing or empty`);
  if (!nonEmpty(v.en)) push(`${field}.en (English) is missing or empty`);
}

/** Choice keys used for the "distinct" check, one per language. */
function choiceKeys(c: unknown): [string, string] | null {
  if (typeof c === 'number' && Number.isFinite(c)) return [String(c), String(c)];
  if (nonEmpty(c)) return [norm(c), norm(c)];
  if (isObj(c) && nonEmpty(c.id) && nonEmpty(c.en)) return [norm(c.id), norm(c.en)];
  return null;
}

/**
 * Validates a list of items (possibly from several files: pass them all at once so
 * duplicates across files are caught). Returns every problem found; empty = valid.
 */
export function validateQuestions(
  items: unknown[],
  topicTiers: Map<string, number>,
): QuestionError[] {
  const errors: QuestionError[] = [];
  const seenIds = new Map<string, number>();
  const seenStems = new Map<string, number>();
  const tiers = new Set(topicTiers.values());

  items.forEach((raw, index) => {
    const id = isObj(raw) && typeof raw.id === 'string' ? raw.id : undefined;
    const push = (message: string) => errors.push({ index, id, message });

    if (!isObj(raw)) {
      push('item is not an object');
      return;
    }
    const q = raw;

    if (!nonEmpty(q.id) || !ID_PATTERN.test(q.id)) {
      push('id must be lowercase letters, digits, ".", "_" or "-"');
    } else if (seenIds.has(q.id)) {
      push(`duplicate id (also item ${seenIds.get(q.id)})`);
    } else {
      seenIds.set(q.id, index);
    }

    if (!Number.isInteger(q.tier) || !tiers.has(q.tier as number)) {
      push(`tier must be one of ${[...tiers].sort().join(', ')} (got ${String(q.tier)})`);
    }
    if (!QUESTION_TYPES.includes(q.type as QuestionType)) {
      push(`type must be one of ${QUESTION_TYPES.join(', ')} (got ${String(q.type)})`);
    }
    if (!nonEmpty(q.topic) || !topicTiers.has(q.topic)) {
      push(`unknown topic "${String(q.topic)}" (not in curriculum.json)`);
    } else if (topicTiers.get(q.topic) !== q.tier) {
      push(
        `topic ${q.topic} belongs to tier ${topicTiers.get(q.topic)}, but item tier is ${String(q.tier)}`,
      );
    }

    checkLocalized(q.stem, 'stem', push);
    if (isObj(q.stem)) {
      for (const lang of ['id', 'en'] as const) {
        const s = q.stem[lang];
        if (!nonEmpty(s)) continue;
        const key = `${lang}:${norm(s)}`;
        if (seenStems.has(key)) push(`duplicate stem (${lang}) also in item ${seenStems.get(key)}`);
        else seenStems.set(key, index);
      }
    }

    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      push('needs exactly 4 choices');
    } else {
      const keys = q.choices.map(choiceKeys);
      keys.forEach((k, i) => {
        if (!k) push(`choices[${i}] must be a number, a non-empty string, or { "id", "en" } text`);
      });
      const valid = keys.filter((k): k is [string, string] => k !== null);
      for (const lang of [0, 1]) {
        if (new Set(valid.map((k) => k[lang])).size !== valid.length) {
          push('choices must be distinct');
          break;
        }
      }
    }

    if (
      !Number.isInteger(q.answerIndex) ||
      (q.answerIndex as number) < 0 ||
      (q.answerIndex as number) > 3
    ) {
      push(`answerIndex must be 0, 1, 2 or 3 (got ${String(q.answerIndex)})`);
    }

    checkLocalized(q.explanation, 'explanation', push);

    if (q.timeSec !== undefined) {
      if (typeof q.timeSec !== 'number' || q.timeSec <= 0 || q.timeSec > MAX_TIME_SEC) {
        push(`timeSec must be between 1 and ${MAX_TIME_SEC} seconds when set`);
      }
    }
    if (q.tags !== undefined && !(Array.isArray(q.tags) && q.tags.every(nonEmpty))) {
      push('tags must be a list of non-empty strings');
    }
    if (q.source !== undefined && !SOURCES.includes(q.source as string)) {
      push(`source must be one of ${SOURCES.join(', ')}`);
    }
  });

  return errors;
}

export function formatQuestionErrors(errors: QuestionError[], label = 'questions'): string {
  return errors
    .map((e) => `${label} item ${e.index}${e.id ? ` (${e.id})` : ''}: ${e.message}`)
    .join('\n');
}

/** Throws one readable error listing every problem. Use when loading the bank in the game. */
export function assertValidQuestions(
  items: unknown[],
  topicTiers: Map<string, number>,
  label = 'questions',
): asserts items is Question[] {
  const errors = validateQuestions(items, topicTiers);
  if (errors.length) {
    throw new Error(
      `Invalid question bank (${errors.length} problems):\n${formatQuestionErrors(errors, label)}`,
    );
  }
}
