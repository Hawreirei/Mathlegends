import { describe, expect, it } from 'vitest';
import heroesJson from '../src/data/heroes.json';
import itemsJson from '../src/data/items.json';
import ranksJson from '../src/data/ranks.json';
import { DataError, loadHeroes, loadItems, loadRanks } from '../src/systems/data';

const hero = {
  id: 'test-hero',
  name: { id: 'Pahlawan Uji', en: 'Test Hero' },
  title: { id: 'Penguji', en: 'The Tester' },
  role: 'fighter',
  lore: { id: 'Hanya untuk tes.', en: 'Only for tests.' },
  look: { color: 'blue', emblem: 'moon' },
  base: {
    hp: 600,
    mana: 200,
    atk: 50,
    armor: 20,
    moveSpeed: 220,
    attackRange: 120,
    attackSpeed: 1,
    hpRegen: 2,
    manaRegen: 1,
  },
  growth: { hp: 60, mana: 15, atk: 4, armor: 2 },
  skills: [],
  sprite: 'hero-test-hero',
};

const item = {
  id: 'test-blade',
  name: { id: 'Pedang Uji', en: 'Test Blade' },
  description: { id: 'Menambah serangan.', en: 'Adds attack.' },
  category: 'attack',
  cost: 500,
  stats: { atk: 15 },
};

describe('committed data files', () => {
  it('load without errors', () => {
    expect(() => loadHeroes(heroesJson)).not.toThrow();
    expect(() => loadItems(itemsJson)).not.toThrow();
    expect(() => loadRanks(ranksJson)).not.toThrow();
  });

  it('ranks.json has 6 tiers of 5 stars and a valid question mix', () => {
    const r = loadRanks(ranksJson);
    expect(r.tiers.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.starsPerTier).toBe(5);
    expect(r.questionMix.onLevel + r.questionMix.review + r.questionMix.stretch).toBeCloseTo(1);
  });
});

describe('heroes loader', () => {
  it('accepts a valid hero', () => {
    expect(loadHeroes({ version: 1, heroes: [hero] }).heroes[0]?.id).toBe('test-hero');
  });

  it('throws a clear error naming the file and the field', () => {
    const bad = { version: 1, heroes: [{ ...hero, base: { ...hero.base, hp: 'lots' } }] };
    expect(() => loadHeroes(bad)).toThrow(DataError);
    expect(() => loadHeroes(bad)).toThrow(/heroes\.json: heroes\[0\]\.base\.hp/);
  });

  it('rejects unknown roles, missing languages, duplicate ids and unknown fields', () => {
    expect(() => loadHeroes({ version: 1, heroes: [{ ...hero, role: 'wizard' }] })).toThrow(/role/);
    expect(() => loadHeroes({ version: 1, heroes: [{ ...hero, name: { id: 'X' } }] })).toThrow(
      /name\.en/,
    );
    expect(() => loadHeroes({ version: 1, heroes: [hero, hero] })).toThrow(
      /duplicate id "test-hero"/,
    );
    expect(() => loadHeroes({ version: 1, heroes: [{ ...hero, hpp: 1 }] })).toThrow(/hpp/);
  });

  it('rejects more than 4 skills', () => {
    expect(() =>
      loadHeroes({ version: 1, heroes: [{ ...hero, skills: ['a', 'b', 'c', 'd', 'e'] }] }),
    ).toThrow(/skills/);
  });
});

describe('items loader', () => {
  it('accepts a valid item', () => {
    expect(loadItems({ version: 1, items: [item] }).items).toHaveLength(1);
  });

  it('rejects bad cost, unknown stats and unknown categories', () => {
    expect(() => loadItems({ version: 1, items: [{ ...item, cost: -5 }] })).toThrow(
      /items\[0\]\.cost/,
    );
    expect(() => loadItems({ version: 1, items: [{ ...item, stats: { luck: 3 } }] })).toThrow(
      /luck/,
    );
    expect(() => loadItems({ version: 1, items: [{ ...item, category: 'food' }] })).toThrow(
      /category/,
    );
  });

  it('rejects an item with no stats and no passive', () => {
    expect(() => loadItems({ version: 1, items: [{ ...item, stats: {} }] })).toThrow(
      /at least one stat or a passive/,
    );
  });

  it('rejects duplicate ids', () => {
    expect(() => loadItems({ version: 1, items: [item, item] })).toThrow(
      /duplicate id "test-blade"/,
    );
  });
});

describe('ranks loader', () => {
  const clone = () =>
    structuredClone(ranksJson) as unknown as Record<string, unknown> & typeof ranksJson;

  it('rejects a question mix that does not add up to 1', () => {
    const r = clone();
    r.questionMix.stretch = 0.5;
    expect(() => loadRanks(r)).toThrow(/questionMix must add up to 1/);
  });

  it('rejects tiers that are not 1, 2, 3, ... in order', () => {
    const r = clone();
    r.tiers[1]!.tier = 3;
    expect(() => loadRanks(r)).toThrow(/tiers must be numbered 1, 2, 3/);
  });
});
