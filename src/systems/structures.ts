/**
 * Towers and Nexus (#21). Pure TypeScript, no Phaser.
 * Each side has an outer tower (index 1), an inner tower (index 0) and a Nexus. A structure can
 * only be attacked once the ones in front of it have fallen: outer, then inner, then Nexus.
 * Destroying the enemy Nexus wins the match.
 */
import { canAttack, resolveAttack, type Combatant } from './combat';
import type { StructuresFile } from './data';
import type { EconomyConfig } from './economy';
import type { HeroState } from './hero';
import type { LaneMap, Point, Team } from './map';
import type { AttackEvent, MinionState } from './minions';

export interface StructureState extends Combatant {
  kind: 'tower' | 'nexus';
  /** Towers: 0 = inner, 1 = outer. Nexus: 0. */
  index: number;
}

export function createStructures(map: LaneMap, s: StructuresFile): StructureState[] {
  return map.slots.map((slot) => {
    const tower = slot.kind === 'tower';
    return {
      id: `${slot.kind}-${slot.team}-${slot.index}`,
      kind: slot.kind,
      index: slot.index,
      team: slot.team,
      x: slot.x,
      y: slot.y,
      hp: tower ? s.tower.hp : s.nexus.hp,
      maxHp: tower ? s.tower.hp : s.nexus.hp,
      atk: tower ? s.tower.atk : 0,
      armor: tower ? s.tower.armor : s.nexus.armor,
      // A Nexus never attacks: zero range means nothing is ever in range.
      attackRange: tower ? s.tower.attackRange : 0,
      attackSpeed: tower ? s.tower.attackSpeed : 1,
      hpRegen: 0,
      level: 1,
      alive: true,
      nextAttackAt: 0,
      respawnAt: null,
    };
  });
}

/** Alive, and every structure in front of it on its side has fallen. */
export function isTargetable(s: StructureState, all: readonly StructureState[]): boolean {
  if (!s.alive) return false;
  const sameSide = all.filter((o) => o.team === s.team && o.alive);
  if (s.kind === 'nexus') return !sameSide.some((o) => o.kind === 'tower');
  return !sameSide.some((o) => o.kind === 'tower' && o.index > s.index);
}

/** The team that destroyed the other team's Nexus, or null while both stand. */
export function winner(all: readonly StructureState[]): Team | null {
  const dead = all.find((s) => s.kind === 'nexus' && !s.alive);
  if (!dead) return null;
  return dead.team === 'blue' ? 'red' : 'blue';
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function nearestInRange<T extends Combatant>(from: Combatant, list: readonly T[]): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const o of list) {
    if (!o.alive || o.team === from.team) continue;
    const d = dist(from, o);
    if (d <= from.attackRange && d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

export interface TowerStepResult {
  structures: StructureState[];
  minions: MinionState[];
  heroes: HeroState[];
  events: AttackEvent[];
}

/**
 * Every standing tower shoots the nearest enemy minion in range, or the nearest enemy hero
 * if no minion is in range. Shots land at once (no projectile travel in the rules).
 */
export function stepTowers(
  structuresIn: readonly StructureState[],
  minionsIn: readonly MinionState[],
  heroesIn: readonly HeroState[],
  now: number,
  c: EconomyConfig,
): TowerStepResult {
  const structures = structuresIn.map((s) => ({ ...s }));
  let minions = minionsIn.map((m) => ({ ...m }));
  const heroes = heroesIn.map((h) => ({ ...h }));
  const events: AttackEvent[] = [];
  structures.forEach((t, i) => {
    if (t.kind !== 'tower' || !canAttack(t, now)) return;
    const target = nearestInRange(t, minions) ?? nearestInRange(t, heroes);
    if (!target) return;
    const r = resolveAttack(t, target, now, c);
    structures[i] = r.attacker;
    const mi = minions.findIndex((m) => m.id === target.id);
    if (mi >= 0) minions[mi] = r.target as MinionState;
    else {
      const hi = heroes.findIndex((h) => h.id === target.id);
      heroes[hi] = r.target as HeroState;
    }
    events.push({
      attackerId: t.id,
      targetId: target.id,
      damage: r.damage,
      killed: r.killed,
      x: t.x,
      y: t.y,
    });
  });
  minions = minions.filter((m) => m.alive);
  return { structures, minions, heroes, events };
}
