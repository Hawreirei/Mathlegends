import doc from '../docs/CURRICULUM.md?raw';
import { describe, expect, it } from 'vitest';
import curriculum from '../src/data/curriculum.json';

const ELEMENTS = ['bilangan', 'aljabar', 'pengukuran', 'geometri', 'data'];
const FASE: Record<number, string> = { 1: 'A', 2: 'A', 3: 'B', 4: 'B', 5: 'C', 6: 'C' };
const topics = curriculum.tiers.flatMap((t) =>
  t.topics.map((topic) => ({ ...topic, tier: t.tier })),
);

describe('curriculum.json', () => {
  it('covers tiers 1 to 6 with the right Fase', () => {
    expect(curriculum.tiers.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const t of curriculum.tiers) expect(t.fase).toBe(FASE[t.tier]);
  });

  it('has 4 to 6 topics per tier', () => {
    for (const t of curriculum.tiers) {
      expect(t.topics.length).toBeGreaterThanOrEqual(4);
      expect(t.topics.length).toBeLessThanOrEqual(6);
    }
  });

  it('uses unique ids prefixed by tier', () => {
    const ids = topics.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of topics) expect(t.id).toMatch(new RegExp(`^t${t.tier}\\.[a-z0-9_]+$`));
  });

  it('names every topic in Indonesian and English', () => {
    for (const t of topics) {
      expect(t.name.id.trim()).not.toBe('');
      expect(t.name.en.trim()).not.toBe('');
      expect(ELEMENTS).toContain(t.element);
    }
  });

  it('has at least 12 generator-ready topic families (needed by #11)', () => {
    expect(topics.filter((t) => t.generator).length).toBeGreaterThanOrEqual(12);
  });

  it('is fully listed in docs/CURRICULUM.md', () => {
    for (const t of topics) expect(doc).toContain(`\`${t.id}\``);
  });
});
