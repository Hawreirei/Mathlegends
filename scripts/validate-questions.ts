/**
 * Validates the question bank. Exits 1 on any problem, so CI fails.
 *
 *   npm run validate:questions                    # all files in src/data/questions/
 *   node scripts/validate-questions.ts a.json b   # specific files or folders
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUESTION_TYPES,
  formatQuestionErrors,
  topicTiersFromCurriculum,
  validateQuestions,
} from '../src/systems/questions.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const targets = args.length ? args : [join(root, 'src/data/questions')];

const files = targets.flatMap((t) =>
  statSync(t).isDirectory()
    ? readdirSync(t)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => join(t, f))
    : [t],
);

const curriculum = JSON.parse(readFileSync(join(root, 'src/data/curriculum.json'), 'utf8'));
const topics = topicTiersFromCurriculum(curriculum);

const items: unknown[] = [];
const origin: string[] = [];
let failed = false;

for (const file of files) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`${file}: not valid JSON (${(e as Error).message})`);
    failed = true;
    continue;
  }
  if (!Array.isArray(data)) {
    console.error(`${file}: must contain a JSON array of questions`);
    failed = true;
    continue;
  }
  for (const item of data) {
    items.push(item);
    origin.push(file.replace(root, ''));
  }
}

// Validate everything together so duplicate ids/stems across files are caught.
const errors = validateQuestions(items, topics);
for (const e of errors) {
  console.error(formatQuestionErrors([e], origin[e.index] ?? '?'));
}

// Coverage table: items per tier x type (target for #12 is 15 each).
const count = new Map<string, number>();
items.forEach((q) => {
  const { tier, type } = (q ?? {}) as { tier?: unknown; type?: unknown };
  const key = `${String(tier)}:${String(type)}`;
  count.set(key, (count.get(key) ?? 0) + 1);
});
const tiers = [...new Set(topics.values())].sort((a, b) => a - b);
console.log(`\n${items.length} questions in ${files.length} file(s)`);
console.log(['tier', ...QUESTION_TYPES].map((s) => s.padEnd(12)).join(''));
for (const t of tiers) {
  console.log(
    [String(t), ...QUESTION_TYPES.map((ty) => String(count.get(`${t}:${ty}`) ?? 0))]
      .map((s) => s.padEnd(12))
      .join(''),
  );
}

if (failed || errors.length) {
  console.error(`\nFAILED: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log('\nOK: all questions valid');
