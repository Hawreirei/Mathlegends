import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import heroesJson from '../src/data/heroes.json';
import { loadHeroes, loadMinions } from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { createHeroState } from '../src/systems/hero';
import { buildMap, type MapConfig } from '../src/systems/map';
import {
  spawnWave,
  stepMinions,
  wavesDue,
  waveTime,
  hasCannon,
  type MinionState,
} from '../src/systems/minions';

const econ = economyJson as EconomyConfig;
const map = buildMap(mapJson as MapConfig);
const mcfg = loadMinions(minionsJson);
const heroes = loadHeroes(heroesJson);
const nova = heroes.heroes[0]!;
const mid = map.config.world.width / 2;

describe('minions.json', () => {
  it('loads and has all three types', () => {
    expect(Object.keys(mcfg.types).sort()).toEqual(['cannon', 'infantry', 'lancer']);
  });
});

describe('wave schedule', () => {
  it('spawns the first wave at firstWaveSeconds, then every waveIntervalSeconds', () => {
    expect(waveTime(0, econ)).toBe(econ.match.firstWaveSeconds);
    expect(waveTime(1, econ)).toBe(econ.match.firstWaveSeconds + econ.match.waveIntervalSeconds);
    expect(wavesDue(0, 14.9, econ)).toEqual([]);
    expect(wavesDue(14.9, 15, econ)).toEqual([0]);
    expect(wavesDue(15, 44.9, econ)).toEqual([]);
    expect(wavesDue(0, 76, econ)).toEqual([0, 1, 2]);
  });

  it('adds a Cannon every Nth wave', () => {
    const n = econ.match.cannonEveryNthWave;
    expect(hasCannon(0, econ)).toBe(false);
    expect(hasCannon(n - 1, econ)).toBe(true);
    expect(hasCannon(n, econ)).toBe(false);
    expect(hasCannon(2 * n - 1, econ)).toBe(true);
  });
});

describe('spawning', () => {
  it('spawns the configured mix on both sides, mirrored', () => {
    const blue = spawnWave(0, 'blue', map, econ, mcfg, 'w0');
    const red = spawnWave(0, 'red', map, econ, mcfg, 'w0');
    const kinds = (ms: MinionState[]) => ms.map((m) => m.kind).sort();
    expect(kinds(blue)).toEqual(kinds(red));
    expect(blue.filter((m) => m.kind === 'infantry')).toHaveLength(econ.match.wave.infantry);
    expect(blue.filter((m) => m.kind === 'lancer')).toHaveLength(econ.match.wave.lancer);
    expect(blue.some((m) => m.kind === 'cannon')).toBe(false);
    for (const b of blue) {
      const r = red.find((x) => x.slot === b.slot)!;
      expect(r.x).toBeCloseTo(map.config.world.width - b.x);
      expect(r.y).toBeCloseTo(b.y);
    }
    const cannonWave = spawnWave(econ.match.cannonEveryNthWave - 1, 'blue', map, econ, mcfg, 'w2');
    expect(cannonWave.filter((m) => m.kind === 'cannon')).toHaveLength(econ.match.wave.cannon);
  });

  it('uses each type’s stats and sprite', () => {
    const [m] = spawnWave(0, 'red', map, econ, mcfg, 'x').filter((x) => x.kind === 'lancer');
    expect(m!.maxHp).toBe(mcfg.types.lancer.hp);
    expect(m!.attackRange).toBe(mcfg.types.lancer.attackRange);
    expect(m!.sprite).toBe('minion-lancer-red');
    expect(new Set(spawnWave(0, 'blue', map, econ, mcfg, 'y').map((x) => x.id)).size).toBe(5);
  });
});

describe('behaviour', () => {
  const step = (
    ms: MinionState[],
    heroesIn = [] as ReturnType<typeof createHeroState>[],
    seconds = 1,
    from = 0,
  ) => {
    let s = { minions: ms, heroes: heroesIn };
    let t = from;
    const dt = 0.05;
    const events = [];
    for (let i = 0; i < seconds / dt; i++) {
      t += dt;
      const r = stepMinions(s.minions, s.heroes, dt, t, econ, map);
      s = { minions: r.minions, heroes: r.heroes };
      events.push(...r.events);
    }
    return { ...s, events, t };
  };

  it('marches towards the enemy base when nothing is near', () => {
    const blue = spawnWave(0, 'blue', map, econ, mcfg, 'b');
    const red = spawnWave(0, 'red', map, econ, mcfg, 'r');
    const after = step([...blue, ...red], [], 1);
    for (const m of after.minions) {
      const before = [...blue, ...red].find((x) => x.id === m.id)!;
      if (m.team === 'blue') expect(m.x).toBeGreaterThan(before.x + 100);
      else expect(m.x).toBeLessThan(before.x - 100);
    }
  });

  it('prefers an enemy minion over an enemy hero when both are in aggro range', () => {
    const [b] = spawnWave(0, 'blue', map, econ, mcfg, 'b').filter((m) => m.kind === 'infantry');
    const blue = { ...b!, x: 2000, y: 700 };
    const [r] = spawnWave(0, 'red', map, econ, mcfg, 'r').filter((m) => m.kind === 'infantry');
    const redMinion = { ...r!, x: 2300, y: 700 };
    const redHero = { ...createHeroState(nova, { x: 2080, y: 700 }, 'red') };
    const after = step([blue, redMinion], [redHero], 3);
    expect(after.events.some((e) => e.targetId === redMinion.id)).toBe(true);
    expect(after.events.some((e) => e.targetId === redHero.id)).toBe(false);
  });

  it('attacks an enemy hero when no enemy minion is near, and only within range', () => {
    const [l] = spawnWave(0, 'blue', map, econ, mcfg, 'b').filter((m) => m.kind === 'lancer');
    const lancer = { ...l!, x: 1500, y: 700 };
    const hero = createHeroState(nova, { x: 1750, y: 700 }, 'red');
    const after = step([lancer], [hero], 2);
    const hits = after.events.filter((e) => e.targetId === hero.id);
    expect(hits.length).toBeGreaterThan(0);
    const h = after.heroes[0]!;
    expect(h.hp).toBeLessThan(hero.maxHp);
    // A lancer attacks from range: it stops before reaching the hero.
    expect(Math.abs(after.minions[0]!.x - h.x)).toBeLessThanOrEqual(
      mcfg.types.lancer.attackRange + 1,
    );
    expect(Math.abs(after.minions[0]!.x - h.x)).toBeGreaterThan(mcfg.types.infantry.attackRange);
  });

  it('two equal waves meet and fight near the middle, losing units on both sides, and the dead stay dead', () => {
    const ms = [
      ...spawnWave(0, 'blue', map, econ, mcfg, 'b'),
      ...spawnWave(0, 'red', map, econ, mcfg, 'r'),
    ];
    const after = step(ms, [], 40);
    const first = after.events[0]!;
    const firstAttacker = ms.find((m) => m.id === first.attackerId)!;
    expect(firstAttacker).toBeTruthy();
    const deaths = after.events.filter((e) => e.killed);
    expect(deaths.length).toBeGreaterThan(2);
    const deadIds = new Set(deaths.map((e) => e.targetId));
    for (const id of deadIds) expect(after.minions.find((m) => m.id === id)).toBeUndefined();
    const contact = after.events
      .slice(0, 3)
      .map((e) => after.minions.concat(ms).find((m) => m.id === e.attackerId)!);
    expect(contact.length).toBeGreaterThan(0);
    const lost = (team: 'blue' | 'red') =>
      ms.filter((m) => m.team === team).length -
      after.minions.filter((m) => m.team === team).length;
    expect(lost('blue')).toBeGreaterThan(0);
    expect(lost('red')).toBeGreaterThan(0);
    expect(Math.abs(lost('blue') - lost('red'))).toBeLessThanOrEqual(1);
    // First blows land within 300 px of the middle.
    const pos = (id: string) => [...ms].find((m) => m.id === id)!;
    expect(pos(first.attackerId).team).toBeDefined();
    expect(Math.abs(first.x - mid)).toBeLessThan(300);
  });

  it('keeps friendly minions from stacking on one spot', () => {
    const ms = spawnWave(0, 'blue', map, econ, mcfg, 'b').map((m) => ({ ...m, x: 1000, y: 700 }));
    const after = step(ms, [], 0.5);
    for (let i = 0; i < after.minions.length; i++)
      for (let j = i + 1; j < after.minions.length; j++) {
        const a = after.minions[i]!;
        const b = after.minions[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius);
      }
  });
});

describe('fairness over a whole match', () => {
  const run = (blueFirst: boolean) => {
    let ms: MinionState[] = [];
    let t = 0;
    const dt = 0.05;
    const kills = { blue: 0, red: 0 };
    for (let i = 1; i <= 600 / dt; i++) {
      const prev = t;
      t = i * dt;
      for (const n of wavesDue(prev, t, econ)) {
        const b = spawnWave(n, 'blue', map, econ, mcfg, `w${n}`);
        const r = spawnWave(n, 'red', map, econ, mcfg, `w${n}`);
        ms.push(...(blueFirst ? [...b, ...r] : [...r, ...b]));
      }
      const before = ms;
      const r = stepMinions(ms, [], dt, t, econ, map);
      ms = r.minions;
      for (const e of r.events)
        if (e.killed)
          kills[before.find((m) => m.id === e.targetId)!.team === 'blue' ? 'red' : 'blue']++;
    }
    return { kills, ms };
  };

  it('10 minutes of mirrored waves stay even and hold the middle, whichever team is listed first', () => {
    for (const blueFirst of [true, false]) {
      const { kills, ms } = run(blueFirst);
      expect(kills.blue).toBeGreaterThan(50);
      expect(Math.abs(kills.blue - kills.red)).toBeLessThanOrEqual(1);
      const front = (team: 'blue' | 'red') => ms.filter((m) => m.team === team).map((m) => m.x);
      expect(Math.max(...front('blue'))).toBeLessThan(mid + 300);
      expect(Math.min(...front('red'))).toBeGreaterThan(mid - 300);
    }
  });
});

describe('heroes stay visible', () => {
  it('pushes minions off a hero’s body (the hero does not move)', () => {
    const hero = createHeroState(nova, { x: 2000, y: 700 }, 'blue');
    const ms = spawnWave(0, 'red', map, econ, mcfg, 'r').map((m, i) => ({
      ...m,
      x: 2000 + i,
      y: 700 + i,
    }));
    const r = stepMinions(ms, [hero], 0.05, 1, econ, map, [], mcfg.heroBodyRadius);
    expect(r.heroes[0]!.x).toBe(2000);
    for (const m of r.minions)
      expect(Math.hypot(m.x - hero.x, m.y - hero.y)).toBeGreaterThanOrEqual(
        m.radius + mcfg.heroBodyRadius - 1e-6,
      );
  });
});

describe('minion growth over match time (#68)', () => {
  const g = mcfg.growth!;
  const at = (sec: number) => (sec - econ.match.firstWaveSeconds) / econ.match.waveIntervalSeconds;
  const infantry = (n: number, team: 'blue' | 'red' = 'blue') =>
    spawnWave(n, team, map, econ, mcfg, 'g').find((m) => m.kind === 'infantry')!;

  it('is configured in minions.json', () => {
    expect(g).toBeDefined();
    for (const k of ['infantry', 'lancer', 'cannon'] as const) {
      expect(g.perMinute[k].hp).toBeGreaterThan(0);
      expect(g.perMinute[k].atk).toBeGreaterThan(0);
    }
  });

  it('a wave spawned at minute 6 is stronger than one at minute 1', () => {
    const early = infantry(Math.round(at(60)));
    const late = infantry(Math.round(at(360)));
    expect(late.maxHp).toBeGreaterThan(early.maxHp);
    expect(late.hp).toBe(late.maxHp);
    expect(late.atk).toBeGreaterThan(early.atk);
    expect(late.armor).toBeGreaterThanOrEqual(early.armor);
  });

  it('adds perMinute x minutes past startsAfterSec, and nothing before it', () => {
    const base = mcfg.types.infantry;
    const first = infantry(0);
    expect(waveTime(0, econ)).toBeLessThanOrEqual(g.startsAfterSec);
    expect(first.maxHp).toBe(base.hp);
    expect(first.atk).toBe(base.atk);
    const n = 15;
    const minutes = Math.min(g.maxMinutes, (waveTime(n, econ) - g.startsAfterSec) / 60);
    const m = infantry(n);
    expect(m.maxHp).toBeCloseTo(base.hp + g.perMinute.infantry.hp * minutes, 6);
    expect(m.atk).toBeCloseTo(base.atk + g.perMinute.infantry.atk * minutes, 6);
    expect(m.armor).toBeCloseTo(base.armor + g.perMinute.infantry.armor * minutes, 6);
  });

  it('stops growing after maxMinutes', () => {
    const capWave = Math.ceil(at(g.startsAfterSec + g.maxMinutes * 60));
    expect(infantry(capWave + 10).maxHp).toBe(infantry(capWave).maxHp);
    expect(infantry(capWave + 10).atk).toBe(infantry(capWave).atk);
  });

  it('is the same for blue and red at the same time', () => {
    for (const n of [0, 5, 12, 20]) {
      const b = spawnWave(n, 'blue', map, econ, mcfg, 'x');
      const r = spawnWave(n, 'red', map, econ, mcfg, 'x');
      expect(b.map((m) => [m.kind, m.maxHp, m.atk, m.armor])).toEqual(
        r.map((m) => [m.kind, m.maxHp, m.atk, m.armor]),
      );
    }
  });

  it('without a growth block, minions keep their base stats', () => {
    const flat = { ...mcfg, growth: undefined };
    const m = spawnWave(20, 'blue', map, econ, flat, 'f').find((x) => x.kind === 'cannon')!;
    expect(m.maxHp).toBe(mcfg.types.cannon.hp);
    expect(m.atk).toBe(mcfg.types.cannon.atk);
  });
});

describe('minion gold grows with its stats (#68)', () => {
  it('later minions carry a bigger goldScale, the first waves pay base gold', () => {
    const g = mcfg.growth!;
    expect(spawnWave(0, 'blue', map, econ, mcfg, 'a')[0]!.goldScale).toBe(1);
    const n = 15;
    const minutes = Math.min(g.maxMinutes, (waveTime(n, econ) - g.startsAfterSec) / 60);
    const m = spawnWave(n, 'red', map, econ, mcfg, 'b')[0]!;
    expect(m.goldScale).toBeCloseTo(1 + g.goldPerMinute * minutes, 9);
  });
});
