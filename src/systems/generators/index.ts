/**
 * Bilingual procedural question generators (#11). Pure TypeScript, no Phaser.
 * Usage: generateQuestions(topic, type, count, seed) gives the same questions for the same seed.
 */
import { createRng } from '../../utils/rng';
import type { Question, QuestionType } from '../questions';
import { build, type Family } from './core';
import { TIER1 } from './tier1';
import { TIER2 } from './tier2';
import { TIER3 } from './tier3';
import { TIER4 } from './tier4';
import { TIER5 } from './tier5';
import { TIER6 } from './tier6';

export type { Family } from './core';

export const FAMILIES: readonly Family[] = [
  ...TIER1,
  ...TIER2,
  ...TIER3,
  ...TIER4,
  ...TIER5,
  ...TIER6,
];

export const familyFor = (topic: string): Family | undefined =>
  FAMILIES.find((f) => f.topic === topic);

export function supportedTypes(topic: string): QuestionType[] {
  const fam = familyFor(topic);
  return fam ? (Object.keys(fam.makers) as QuestionType[]) : [];
}

/**
 * Up to `count` questions with distinct stems. Fewer are returned only when the topic
 * cannot produce that many different questions (for example halves of small numbers).
 */
export function generateQuestions(
  topic: string,
  type: QuestionType,
  count: number,
  seed: number,
): Question[] {
  const fam = familyFor(topic);
  if (!fam) throw new Error(`no generator for topic ${topic}`);
  const rng = createRng(seed);
  const out: Question[] = [];
  const seen = new Set<string>();
  for (let tries = 0; out.length < count && tries < count * 50; tries++) {
    const q = build(rng, fam, type);
    if (seen.has(q.stem.en) || seen.has(q.stem.id)) continue;
    seen.add(q.stem.en);
    seen.add(q.stem.id);
    out.push(q);
  }
  return out;
}
