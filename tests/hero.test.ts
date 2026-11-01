import { describe, expect, it } from 'vitest';
import heroesJson from '../src/data/heroes.json';
import mapJson from '../src/data/map.json';
import { loadHeroes } from '../src/systems/data';
import { buildMap, type MapConfig } from '../src/systems/map';
import {
  createHeroState,
  directionFromKeys,
  moveHero,
  statsAtLevel,
  walkableArea,
} from '../src/systems/hero';

const heroes = loadHeroes(heroesJson);
const map = buildMap(mapJson as MapConfig);
const nova = heroes.heroes.find((h) => h.id === heroes.playerHero)!;
const area = walkableArea(map);

describe('heroes.json', () => {
  it('names an existing player hero and bot hero', () => {
    expect(heroes.heroes.map((h) => h.id)).toContain(heroes.playerHero);
    expect(heroes.heroes.map((h) => h.id)).toContain(heroes.botHero);
    expect(heroes.playerHero).not.toBe(heroes.botHero);
  });
});

describe('hero stats', () => {
  it('come from heroes.json at level 1', () => {
    const s = createHeroState(nova, map.heroSpawn.blue, 'blue');
    expect(s.maxHp).toBe(nova.base.hp);
    expect(s.hp).toBe(nova.base.hp);
    expect(s.maxMana).toBe(nova.base.mana);
    expect(s.atk).toBe(nova.base.atk);
    expect(s.armor).toBe(nova.base.armor);
    expect(s.moveSpeed).toBe(nova.base.moveSpeed);
    expect({ x: s.x, y: s.y }).toEqual(map.heroSpawn.blue);
  });

  it('grow by the growth values for each level above 1', () => {
    const l5 = statsAtLevel(nova, 5);
    expect(l5.maxHp).toBe(nova.base.hp + 4 * nova.growth.hp);
    expect(l5.atk).toBe(nova.base.atk + 4 * nova.growth.atk);
    expect(l5.armor).toBe(nova.base.armor + 4 * nova.growth.armor);
    expect(l5.moveSpeed).toBe(nova.base.moveSpeed);
  });
});

describe('keyboard direction', () => {
  it('maps WASD/arrows to a unit vector', () => {
    expect(directionFromKeys({ up: false, down: false, left: false, right: true })).toEqual({
      x: 1,
      y: 0,
    });
    expect(directionFromKeys({ up: true, down: false, left: false, right: false })).toEqual({
      x: 0,
      y: -1,
    });
    const d = directionFromKeys({ up: true, down: false, left: true, right: false });
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(d.x).toBeLessThan(0);
    expect(d.y).toBeLessThan(0);
  });

  it('cancels opposite keys', () => {
    expect(directionFromKeys({ up: true, down: true, left: true, right: true })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('movement', () => {
  it('moves moveSpeed pixels per second', () => {
    const s = createHeroState(nova, map.heroSpawn.blue, 'blue');
    const next = moveHero(s, { x: 1, y: 0 }, 0.5, area);
    expect(next.x - s.x).toBeCloseTo(nova.base.moveSpeed * 0.5);
    expect(next.y).toBe(s.y);
  });

  it('is not faster diagonally', () => {
    const s = createHeroState(nova, map.heroSpawn.blue, 'blue');
    const d = directionFromKeys({ up: false, down: true, left: false, right: true });
    const next = moveHero(s, d, 0.1, area);
    expect(Math.hypot(next.x - s.x, next.y - s.y)).toBeCloseTo(nova.base.moveSpeed * 0.1);
  });

  it('stays inside the walkable lane area', () => {
    const s = createHeroState(nova, map.heroSpawn.blue, 'blue');
    const farUp = moveHero(s, { x: 0, y: -1 }, 10, area);
    expect(farUp.y).toBe(area.top);
    const farLeft = moveHero(s, { x: -1, y: 0 }, 60, area);
    expect(farLeft.x).toBe(area.left);
    const farRight = moveHero(s, { x: 1, y: 0 }, 600, area);
    expect(farRight.x).toBe(area.right);
  });

  it('does not move with no input, and never mutates the old state', () => {
    const s = createHeroState(nova, map.heroSpawn.blue, 'blue');
    expect(moveHero(s, { x: 0, y: 0 }, 1, area)).toEqual(s);
    moveHero(s, { x: 1, y: 0 }, 1, area);
    expect(s.x).toBe(map.heroSpawn.blue.x);
  });

  it('keeps the walkable area on the lane', () => {
    const lane = map.config.lane;
    expect(area.top).toBeGreaterThanOrEqual(lane.y - lane.thickness / 2);
    expect(area.bottom).toBeLessThanOrEqual(lane.y + lane.thickness / 2);
  });
});
