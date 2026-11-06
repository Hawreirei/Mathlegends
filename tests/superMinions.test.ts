/** Super minions (#69): after a side destroys the enemy's inner tower, its waves get them. */
import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import structuresJson from '../src/data/structures.json';
import { loadMinions, loadStructures } from '../src/systems/data';
import { validateEconomy, type EconomyConfig } from '../src/systems/economy';
import { buildMap, type MapConfig } from '../src/systems/map';
import { createMatch, stepMatch, type MatchState } from '../src/systems/match';
import { spawnWave, stepMinions, superMinionsFor, type MinionState } from '../src/systems/minions';
import { killRewards } from '../src/systems/progression';
import { createStructures, type StructureState } from '../src/systems/structures';
import { gameConfig } from '../src/systems/balanceSim';

const econ = economyJson as EconomyConfig;
const map = buildMap(mapJson as MapConfig);
const mcfg = loadMinions(minionsJson);
const sup = mcfg.super!;
const fresh = () => createStructures(map, loadStructures(structuresJson));
const kill = (all: StructureState[], ids: string[]) =>
  all.map((s) => (ids.includes(s.id) ? { ...s, hp: 0, alive: false } : s));

describe('super minion data', () => {
  it('is configured and much stronger than a Cannon', () => {
    expect(sup).toBeDefined();
    expect(sup.perWave).toBeGreaterThanOrEqual(1);
    const c = mcfg.types.cannon;
    expect(sup.hp).toBeGreaterThan(c.hp);
    expect(sup.atk).toBeGreaterThan(c.atk);
    expect(sup.armor).toBeGreaterThan(c.armor);
    expect(sup.radius).toBeGreaterThan(c.radius);
  });

  it('has its own last-hit reward in economy.json', () => {
    expect(econ.superMinionReward).toBeDefined();
    expect(econ.superMinionReward!.gold).toBeGreaterThan(econ.lastHitGold.cannon);
    expect(validateEconomy(econ)).toEqual([]);
    expect(validateEconomy({ ...econ, superMinionReward: { gold: 0, exp: 10 } })).not.toEqual([]);
  });
});

describe('who gets super minions', () => {
  it('nobody at the start', () => {
    expect(superMinionsFor('blue', fresh())).toBe(false);
    expect(superMinionsFor('red', fresh())).toBe(false);
  });

  it('not yet when only the outer tower has fallen', () => {
    expect(superMinionsFor('blue', kill(fresh(), ['tower-red-1']))).toBe(false);
  });

  it('the side that destroyed the enemy inner tower, and only that side', () => {
    const s = kill(fresh(), ['tower-red-1', 'tower-red-0']);
    expect(superMinionsFor('blue', s)).toBe(true);
    expect(superMinionsFor('red', s)).toBe(false);
    const m = kill(fresh(), ['tower-blue-1', 'tower-blue-0']);
    expect(superMinionsFor('red', m)).toBe(true);
    expect(superMinionsFor('blue', m)).toBe(false);
  });
});

describe('spawning super minions', () => {
  it('a normal wave has none', () => {
    expect(spawnWave(4, 'blue', map, econ, mcfg, 'w').some((m) => m.isSuper)).toBe(false);
  });

  it('adds perWave super minions at the front of the wave', () => {
    const normal = spawnWave(4, 'blue', map, econ, mcfg, 'w');
    const boosted = spawnWave(4, 'blue', map, econ, mcfg, 'w', { superMinions: true });
    expect(boosted).toHaveLength(normal.length + sup.perWave);
    const supers = boosted.filter((m) => m.isSuper);
    expect(supers).toHaveLength(sup.perWave);
    expect(supers.map((m) => m.slot)).toEqual(Array.from({ length: sup.perWave }, (_, i) => i));
    for (const m of supers) {
      expect(m.kind).toBe(sup.questionAs);
      expect(m.sprite).toBe('minion-super-blue');
      expect(m.radius).toBe(sup.radius);
      expect(m.maxHp).toBeGreaterThanOrEqual(sup.hp);
      expect(m.hp).toBe(m.maxHp);
    }
    expect(new Set(boosted.map((m) => m.id)).size).toBe(boosted.length);
  });

  it('super minions grow with match time too (#68)', () => {
    const early = spawnWave(0, 'red', map, econ, mcfg, 'a', { superMinions: true })[0]!;
    const late = spawnWave(16, 'red', map, econ, mcfg, 'b', { superMinions: true })[0]!;
    expect(late.maxHp).toBeGreaterThan(early.maxHp);
    expect(late.atk).toBeGreaterThan(early.atk);
  });
});

describe('a boosted wave beats a normal one', () => {
  it('the blue wave with super minions wipes out an equal red wave and survives', () => {
    const blue = spawnWave(4, 'blue', map, econ, mcfg, 'b', { superMinions: true });
    const red = spawnWave(4, 'red', map, econ, mcfg, 'r');
    let ms: MinionState[] = [...blue, ...red];
    let t = 0;
    const dt = 0.05;
    for (let i = 0; i < 60 / dt && ms.some((m) => m.team === 'red'); i++) {
      ms = stepMinions(ms, [], dt, t, econ, map).minions;
      t += dt;
    }
    expect(ms.filter((m) => m.team === 'red')).toHaveLength(0);
    expect(ms.filter((m) => m.team === 'blue').length).toBeGreaterThanOrEqual(3);
    expect(ms.some((m) => m.isSuper)).toBe(true);
  });
});

describe('in a match', () => {
  const cfg = gameConfig(3);
  const idle = { move: { x: 0, y: 0 }, attack: false };
  const run = (s: MatchState, seconds: number) => {
    const spawned: MinionState[] = [];
    for (let i = 0; i < seconds; i++) {
      const r = stepMatch(s, idle, 1, cfg);
      s = r.state;
      for (const e of r.events) if (e.type === 'spawn') spawned.push(e.minion);
    }
    return { s, spawned };
  };

  it('no super minions while both inner towers stand', () => {
    const { spawned } = run(createMatch(cfg), 120);
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.some((m) => m.isSuper)).toBe(false);
  });

  it("once red's inner tower is gone (destroyed or crumbled), blue waves bring them; red's do not", () => {
    const start = createMatch(cfg);
    const s = { ...start, structures: kill(start.structures, ['tower-red-1', 'tower-red-0']) };
    const { spawned } = run(s, 70);
    const blue = spawned.filter((m) => m.team === 'blue');
    const red = spawned.filter((m) => m.team === 'red');
    expect(blue.filter((m) => m.isSuper).length).toBeGreaterThanOrEqual(2 * sup.perWave);
    expect(red.some((m) => m.isSuper)).toBe(false);
  });
});

describe('last-hit reward', () => {
  it('a super minion pays superMinionReward (x goldScale), not the Cannon reward', () => {
    const heroes = [
      { id: 'p', team: 'blue' as const, x: 0, y: 0, alive: true },
      { id: 'b', team: 'red' as const, x: 9999, y: 0, alive: true },
    ];
    const v = {
      kind: 'minion' as const,
      minionKind: 'cannon' as const,
      isSuper: true,
      goldScale: 1.1,
      team: 'red' as const,
      x: 0,
      y: 0,
    };
    const [r] = killRewards(v, 'p', heroes, econ);
    expect(r!.gold).toBeCloseTo(econ.superMinionReward!.gold * 1.1, 9);
    expect(r!.exp).toBe(econ.superMinionReward!.exp);
  });
});
