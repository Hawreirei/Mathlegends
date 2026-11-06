import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import { loadHeroes } from '../src/systems/data';
import { totalExpToLevel, type EconomyConfig } from '../src/systems/economy';
import { createHeroState, statsAtLevel } from '../src/systems/hero';
import {
  addExp,
  addGold,
  applyLevel,
  createProgress,
  killRewards,
  tickPassiveGold,
} from '../src/systems/progression';

const c = economyJson as EconomyConfig;
const nova = loadHeroes(heroesJson).heroes[0]!;

describe('gold', () => {
  it('starts with startingGold and earns passive gold per second', () => {
    const p = createProgress(c);
    expect(p.gold).toBe(c.startingGold);
    const later = tickPassiveGold(p, 10, c);
    expect(later.gold).toBeCloseTo(c.startingGold + 10 * c.passiveGoldPerSecond);
    expect(later.goldBySource.passive).toBeCloseTo(10 * c.passiveGoldPerSecond);
  });

  it('tracks gold by source', () => {
    const p = addGold(addGold(createProgress(c), 20, 'lastHit'), 150, 'heroKill');
    expect(p.goldBySource.lastHit).toBe(20);
    expect(p.goldBySource.heroKill).toBe(150);
    expect(p.gold).toBe(c.startingGold + 170);
  });
});

describe('EXP and levels', () => {
  it('levels up at the EXP curve thresholds and reports levels gained', () => {
    const r = addExp(createProgress(c), totalExpToLevel(c, 2), c);
    expect(r.progress.level).toBe(2);
    expect(r.levelsGained).toBe(1);
    const big = addExp(createProgress(c), totalExpToLevel(c, 5) + 1, c);
    expect(big.progress.level).toBe(5);
    expect(big.levelsGained).toBe(4);
  });

  it('stops at the level cap', () => {
    const r = addExp(createProgress(c), 1_000_000, c);
    expect(r.progress.level).toBe(c.exp.levelCap);
  });
});

describe('level-up applies stat growth', () => {
  it('raises max HP, mana, attack and armor by the growth values, and heals by the HP gained', () => {
    const s = { ...createHeroState(nova, { x: 0, y: 0 }, 'blue'), hp: 300 };
    const up = applyLevel(s, nova, 3);
    const l3 = statsAtLevel(nova, 3);
    expect(up.level).toBe(3);
    expect(up.maxHp).toBe(l3.maxHp);
    expect(up.atk).toBe(l3.atk);
    expect(up.armor).toBe(l3.armor);
    expect(up.maxMana).toBe(l3.maxMana);
    expect(up.hp).toBe(300 + (l3.maxHp - s.maxHp));
    expect(up.x).toBe(s.x);
    expect(up.nextAttackAt).toBe(s.nextAttackAt);
  });

  it('does nothing to a dead hero except remember the level', () => {
    const dead = { ...createHeroState(nova, { x: 0, y: 0 }, 'blue'), hp: 0, alive: false };
    const up = applyLevel(dead, nova, 2);
    expect(up.level).toBe(2);
    expect(up.hp).toBe(0);
  });
});

describe('kill rewards (values from economy.json)', () => {
  const blue = { id: 'blue-hero', team: 'blue' as const, x: 1000, y: 700, alive: true };
  const red = { id: 'red-hero', team: 'red' as const, x: 3400, y: 700, alive: true };

  it('last hit on a minion: the killer gets lastHitGold x multiplier and minion EXP x multiplier', () => {
    const r = killRewards(
      { kind: 'minion', minionKind: 'lancer', team: 'red', x: 1100, y: 700 },
      'blue-hero',
      [blue, red],
      c,
      1.5,
    );
    expect(r).toEqual([
      {
        heroId: 'blue-hero',
        gold: c.lastHitGold.lancer * 1.5,
        exp: c.exp.minion.lancer * 1.5,
        source: 'lastHit',
      },
    ]);
  });

  it('a minion killed by someone else gives nearby enemy heroes EXP only', () => {
    const r = killRewards(
      { kind: 'minion', minionKind: 'infantry', team: 'red', x: 1300, y: 700 },
      'w0-blue-0',
      [blue, red],
      c,
    );
    expect(r).toEqual([
      { heroId: 'blue-hero', gold: 0, exp: c.exp.minion.infantry, source: 'shareExp' },
    ]);
    const far = killRewards(
      {
        kind: 'minion',
        minionKind: 'infantry',
        team: 'red',
        x: 1000 + c.exp.shareRangePx + 1,
        y: 700,
      },
      'x',
      [blue, red],
      c,
    );
    expect(far).toEqual([]);
  });

  it('friendly minions and dead heroes give nothing', () => {
    expect(
      killRewards(
        { kind: 'minion', minionKind: 'infantry', team: 'blue', x: 1000, y: 700 },
        'x',
        [blue],
        c,
      ),
    ).toEqual([]);
    expect(
      killRewards(
        { kind: 'minion', minionKind: 'infantry', team: 'red', x: 1000, y: 700 },
        'x',
        [{ ...blue, alive: false }],
        c,
      ),
    ).toEqual([]);
  });

  it('hero kill: the killing hero gets heroKill gold and EXP', () => {
    const r = killRewards(
      { kind: 'hero', team: 'red', x: 2000, y: 700 },
      'blue-hero',
      [blue, red],
      c,
    );
    expect(r).toEqual([
      { heroId: 'blue-hero', gold: c.otherGold.heroKill, exp: c.exp.heroKill, source: 'heroKill' },
    ]);
    expect(
      killRewards({ kind: 'hero', team: 'red', x: 2000, y: 700 }, 'tower-blue-1', [blue, red], c),
    ).toEqual([]);
  });

  it('tower destroyed: every enemy hero gets tower gold, wherever they are', () => {
    const r = killRewards(
      { kind: 'tower', team: 'red', x: 2650, y: 700 },
      'w3-blue-1',
      [blue, red],
      c,
    );
    expect(r).toEqual([{ heroId: 'blue-hero', gold: c.otherGold.tower, exp: 0, source: 'tower' }]);
  });
});

describe('minion goldScale (#68)', () => {
  it('scales the last-hit gold, not the EXP', () => {
    const heroes = [
      { id: 'p', team: 'blue' as const, x: 0, y: 0, alive: true },
      { id: 'b', team: 'red' as const, x: 9999, y: 0, alive: true },
    ];
    const v = {
      kind: 'minion' as const,
      minionKind: 'infantry' as const,
      team: 'red' as const,
      x: 0,
      y: 0,
    };
    const [base] = killRewards(v, 'p', heroes, c);
    const [grown] = killRewards({ ...v, goldScale: 1.2 }, 'p', heroes, c);
    expect(grown!.gold).toBeCloseTo(base!.gold * 1.2, 9);
    expect(grown!.exp).toBe(base!.exp);
  });
});
