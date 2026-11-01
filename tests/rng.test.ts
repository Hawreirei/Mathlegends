import { describe, expect, it } from 'vitest';
import { createRng } from '../src/utils/rng';
import { BASE } from '../vite.config';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays within [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('vite base', () => {
  it('matches the GitHub Pages path (case-sensitive repo name)', () => {
    expect(BASE).toBe('/Mathlegends/');
  });
});
