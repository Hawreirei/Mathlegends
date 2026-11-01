/**
 * Loads the bundled question bank (#12) and validates it at load time (AGENTS.md rule 4).
 * The files are built by scripts/build-question-bank.ts; see docs/QUESTIONS.md.
 */
import curriculum from '../data/curriculum.json';
import t1 from '../data/questions/t1.json';
import t2 from '../data/questions/t2.json';
import t3 from '../data/questions/t3.json';
import t4 from '../data/questions/t4.json';
import t5 from '../data/questions/t5.json';
import t6 from '../data/questions/t6.json';
import { assertValidQuestions, topicTiersFromCurriculum, type Question } from './questions';

/** Topic id -> Year, from curriculum.json (for validating questions outside the bank). */
export const curriculumTopicTiers = () => topicTiersFromCurriculum(curriculum);

export function loadQuestionBank(): Question[] {
  const all: unknown[] = [...t1, ...t2, ...t3, ...t4, ...t5, ...t6];
  assertValidQuestions(all, curriculumTopicTiers(), 'question bank');
  return all;
}
