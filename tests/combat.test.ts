import { describe, expect, it } from 'vitest';
import economy from '../src/data/economy.json';
import { damage, respawnSeconds, type EconomyConfig } from '../src/systems/economy';
import {
  ATTACK_BUFFER_SEC,
  canAttack,
  nearestEnemyInRange,
  regenerate,
  resolveAttack,
  tickRespawn,
  type Combatant,
} from '../src/systems/combat';

const cfg = economy as EconomyConfig;

const unit = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'u',
  team: 'blue',
  x: 0,
  y: 0,
  hp: 600,
  maxHp: 600,
  atk: 55,
  armor: 18,
  attackRange: 140,
  attackSpeed: 1,
  hpRegen: 3,
  level: 1,
  alive: true,
  nextAttackAt: 0,
  respawnAt: null,
  ...over,
});

describe('targeting', () => {
  it('picks the nearest living enemy within attack range', () => {
    const me = unit();
    const far = unit({ id: 'far', team: 'red', x: 130 });
    const near = unit({ id: 'near', team: 'red', x: 60 });
    const friend = unit({ id: 'friend', team: 'blue', x: 10 });
    const dead = unit({ id: 'dead', team: 'red', x: 5, alive: false });
    const out = unit({ id: 'out', team: 'red', x: 400 });
    expect(nearestEnemyInRange(me, [far, near, friend, dead, out])?.id).toBe('near');
  });

  it('returns null when no enemy is in range', () => {
    expect(nearestEnemyInRange(unit(), [unit({ team: 'red', x: 141 })])).toBeNull();
  });

  it('measures range in 2D', () => {
    expect(nearestEnemyInRange(unit(), [unit({ id: 'd', team: 'red', x: 98, y: 98 })])?.id).toBe(
      'd',
    ); // ~138.6
    expect(nearestEnemyInRange(unit(), [unit({ team: 'red', x: 100, y: 100 })])).toBeNull(); // ~141.4
  });
});

describe('attacks', () => {
  it('deal exactly the economy.json damage formula', () => {
    const a = unit({ atk: 55 });
    const t = unit({ team: 'red', armor: 18, hp: 600 });
    const r = resolveAttack(a, t, 10, cfg);
    const expected = damage(55, 18, cfg.combat.armorConstant, cfg.combat.minDamage);
    expect(expected).toBeCloseTo((55 * 100) / 118);
    expect(r.damage).toBeCloseTo(expected);
    expect(r.target.hp).toBeCloseTo(600 - expected);
    expect(r.killed).toBe(false);
  });

  it('respect attack speed (one hit per 1/attackSpeed seconds)', () => {
    const a = unit({ attackSpeed: 1.25 });
    const t = unit({ team: 'red' });
    const r = resolveAttack(a, t, 10, cfg);
    expect(r.attacker.nextAttackAt).toBeCloseTo(10.8);
    expect(canAttack(r.attacker, 10.79)).toBe(false);
    expect(canAttack(r.attacker, 10.8)).toBe(true);
  });

  it('kill when HP reaches 0, start the respawn timer and never go below 0 HP', () => {
    const a = unit({ atk: 1000 });
    const t = unit({ team: 'red', hp: 30, level: 4 });
    const r = resolveAttack(a, t, 20, cfg);
    expect(r.killed).toBe(true);
    expect(r.target.hp).toBe(0);
    expect(r.target.alive).toBe(false);
    expect(r.target.respawnAt).toBe(20 + respawnSeconds(cfg, 4));
  });

  it('cannot hit a dead target', () => {
    expect(() => resolveAttack(unit(), unit({ team: 'red', alive: false }), 1, cfg)).toThrow();
  });

  it('keep a short press buffer constant', () => {
    expect(ATTACK_BUFFER_SEC).toBeGreaterThan(0);
    expect(ATTACK_BUFFER_SEC).toBeLessThanOrEqual(0.6);
  });
});

describe('death and respawn', () => {
  it('respawns at the given base point with full HP when the timer ends', () => {
    const dead = unit({ alive: false, hp: 0, respawnAt: 30, x: 2000, y: 650 });
    expect(tickRespawn(dead, 29.9, { x: 520, y: 700 })).toBe(dead);
    const back = tickRespawn(dead, 30, { x: 520, y: 700 });
    expect(back.alive).toBe(true);
    expect(back.hp).toBe(back.maxHp);
    expect({ x: back.x, y: back.y }).toEqual({ x: 520, y: 700 });
    expect(back.respawnAt).toBeNull();
  });

  it('respawn time grows with level (from economy.json)', () => {
    expect(respawnSeconds(cfg, 10)).toBeGreaterThan(respawnSeconds(cfg, 1));
  });
});

describe('regeneration', () => {
  it('heals hpRegen per second up to max, and not while dead', () => {
    expect(regenerate(unit({ hp: 500 }), 2).hp).toBe(506);
    expect(regenerate(unit({ hp: 599 }), 2).hp).toBe(600);
    expect(regenerate(unit({ hp: 0, alive: false }), 2).hp).toBe(0);
  });
});
