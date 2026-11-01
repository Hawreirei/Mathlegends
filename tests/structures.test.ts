import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import structuresJson from '../src/data/structures.json';
import { loadHeroes, loadMinions, loadStructures } from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { createHeroState } from '../src/systems/hero';
import { buildMap, type MapConfig } from '../src/systems/map';
import { spawnWave, stepMinions } from '../src/systems/minions';
import {
  createStructures,
  isTargetable,
  stepTowers,
  winner,
  type StructureState,
} from '../src/systems/structures';

const econ = economyJson as EconomyConfig;
const map = buildMap(mapJson as MapConfig);
const scfg = loadStructures(structuresJson);
const mcfg = loadMinions(minionsJson);
const nova = loadHeroes(heroesJson).heroes[0]!;
const fresh = () => createStructures(map, scfg);
const get = (all: StructureState[], team: 'blue' | 'red', kind: 'tower' | 'nexus', index = 0) =>
  all.find((s) => s.team === team && s.kind === kind && s.index === index)!;
const kill = (all: StructureState[], id: string) =>
  all.map((s) => (s.id === id ? { ...s, hp: 0, alive: false } : s));

describe('structures', () => {
  it('creates 2 towers and a Nexus per side at the map slots, with stats from structures.json', () => {
    const all = fresh();
    expect(all).toHaveLength(6);
    for (const s of all) {
      const slot = map.slots.find(
        (x) => x.team === s.team && x.kind === s.kind && x.index === s.index,
      )!;
      expect({ x: s.x, y: s.y }).toEqual({ x: slot.x, y: slot.y });
      expect(s.maxHp).toBe(s.kind === 'tower' ? scfg.tower.hp : scfg.nexus.hp);
    }
  });

  it('protects inner towers until the outer one falls, and the Nexus until both towers fall', () => {
    let all = fresh();
    const outer = get(all, 'red', 'tower', 1);
    const inner = get(all, 'red', 'tower', 0);
    const nexus = get(all, 'red', 'nexus');
    expect(isTargetable(outer, all)).toBe(true);
    expect(isTargetable(inner, all)).toBe(false);
    expect(isTargetable(nexus, all)).toBe(false);
    all = kill(all, outer.id);
    expect(isTargetable(get(all, 'red', 'tower', 0), all)).toBe(true);
    expect(isTargetable(get(all, 'red', 'nexus'), all)).toBe(false);
    all = kill(all, inner.id);
    expect(isTargetable(get(all, 'red', 'nexus'), all)).toBe(true);
  });

  it('reports the winner when a Nexus falls', () => {
    let all = fresh();
    expect(winner(all)).toBeNull();
    all = kill(all, get(all, 'red', 'nexus').id);
    expect(winner(all)).toBe('blue');
    expect(winner(kill(fresh(), get(fresh(), 'blue', 'nexus').id))).toBe('red');
  });
});

describe('towers', () => {
  const nearRedOuter = (dx: number) => ({
    x: get(fresh(), 'red', 'tower', 1).x - dx,
    y: map.config.lane.y,
  });

  it('shoot the nearest enemy minion in range before a hero', () => {
    const tower = get(fresh(), 'red', 'tower', 1);
    const [m] = spawnWave(0, 'blue', map, econ, mcfg, 'b');
    const minion = { ...m!, ...nearRedOuter(380) };
    const hero = createHeroState(nova, nearRedOuter(150), 'blue');
    const r = stepTowers(fresh(), [minion], [hero], 1, econ);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.attackerId).toBe(tower.id);
    expect(r.events[0]!.targetId).toBe(minion.id);
    expect(r.heroes[0]!.hp).toBe(hero.hp);
  });

  it('shoot a hero when no enemy minion is in range, and nothing out of range', () => {
    const hero = createHeroState(nova, nearRedOuter(300), 'blue');
    const r = stepTowers(fresh(), [], [hero], 1, econ);
    expect(r.heroes[0]!.hp).toBeLessThan(hero.hp);
    const far = createHeroState(nova, nearRedOuter(scfg.tower.attackRange + 50), 'blue');
    expect(stepTowers(fresh(), [], [far], 1, econ).events).toHaveLength(0);
  });

  it('respect their attack speed', () => {
    const hero = createHeroState(nova, nearRedOuter(200), 'blue');
    let s = fresh();
    let h = [hero];
    let shots = 0;
    for (let t = 0; t <= 5; t += 0.05) {
      const r = stepTowers(s, [], h, t, econ);
      s = r.structures;
      h = r.heroes;
      shots += r.events.length;
    }
    expect(shots).toBe(Math.floor(5 * scfg.tower.attackSpeed) + 1);
  });

  it('a Nexus never attacks; destroyed towers stop shooting', () => {
    const all = kill(fresh(), get(fresh(), 'red', 'tower', 1).id);
    const hero = createHeroState(nova, nearRedOuter(200), 'blue');
    expect(stepTowers(all, [], [hero], 1, econ).events).toHaveLength(0);
    const nexus = get(fresh(), 'red', 'nexus');
    const atNexus = createHeroState(nova, { x: nexus.x - 100, y: nexus.y }, 'blue');
    const r = stepTowers(fresh(), [], [atNexus], 1, econ);
    expect(r.events.every((e) => e.attackerId !== nexus.id)).toBe(true);
  });
});

describe('minions and structures', () => {
  it('minions attack an enemy tower they reach, but not a protected one', () => {
    const outer = get(fresh(), 'red', 'tower', 1);
    const inner = get(fresh(), 'red', 'tower', 0);
    const [m] = spawnWave(0, 'blue', map, econ, mcfg, 'b').filter((x) => x.kind === 'infantry');
    const atOuter = { ...m!, x: outer.x - 80, y: outer.y };
    const r = stepMinions([atOuter], [], 0.05, 5, econ, map, fresh());
    expect(r.events.map((e) => e.targetId)).toContain(outer.id);
    expect(r.structures.find((s) => s.id === outer.id)!.hp).toBeLessThan(outer.maxHp);
    const atInner = { ...m!, id: 'x', x: inner.x - 80, y: inner.y };
    const r2 = stepMinions([atInner], [], 0.05, 5, econ, map, fresh());
    expect(r2.events.map((e) => e.targetId)).not.toContain(inner.id);
  });

  it('prefer an enemy minion, then a structure, over a hero', () => {
    const outer = get(fresh(), 'red', 'tower', 1);
    const [m] = spawnWave(0, 'blue', map, econ, mcfg, 'b').filter((x) => x.kind === 'infantry');
    const minion = { ...m!, x: outer.x - 80, y: outer.y };
    const hero = createHeroState(nova, { x: outer.x - 120, y: outer.y + 20 }, 'red');
    const r = stepMinions([minion], [hero], 0.05, 5, econ, map, fresh());
    expect(r.events[0]!.targetId).toBe(outer.id);
  });
});
