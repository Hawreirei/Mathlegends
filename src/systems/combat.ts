/**
 * Combat rules shared by heroes, minions (#20) and towers (#21). Pure, no Phaser.
 * Times are match seconds. Damage uses the economy.json formula (docs/ECONOMY.md).
 */
import { damage, respawnSeconds, type EconomyConfig } from './economy';
import type { Point, Team } from './map';

export interface Combatant {
  id: string;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  armor: number;
  /** Pixels, centre to centre. */
  attackRange: number;
  /** Attacks per second. */
  attackSpeed: number;
  /** HP per second while alive. */
  hpRegen: number;
  level: number;
  alive: boolean;
  /** Match time when the next attack is allowed. */
  nextAttackAt: number;
  /** Match time to come back to life; null while alive (or for units that never respawn). */
  respawnAt: number | null;
  /** Damage absorbed before HP (#33 shield skills), until `shieldUntil`. Heroes only. */
  shield?: number;
  shieldUntil?: number;
}

/**
 * Takes `dmg` from a unit: an active shield absorbs first, then HP (#33). Returns the new copy,
 * the damage that reached HP and whether it died. Used by basic attacks and skills alike.
 */
export function takeDamage<T extends Combatant>(
  target: T,
  dmg: number,
  now: number,
  cfg: EconomyConfig,
): { target: T; killed: boolean } {
  let rest = dmg;
  let shield = target.shield ?? 0;
  if (shield > 0 && now < (target.shieldUntil ?? 0)) {
    const absorbed = Math.min(shield, rest);
    shield -= absorbed;
    rest -= absorbed;
  }
  const hp = Math.max(0, target.hp - rest);
  const killed = hp === 0;
  const out = {
    ...target,
    hp,
    alive: !killed,
    respawnAt: killed ? now + respawnSeconds(cfg, target.level) : target.respawnAt,
  };
  if (target.shield !== undefined) out.shield = killed ? 0 : shield;
  return { target: out, killed };
}

/** An attack pressed during the cooldown still fires if the cooldown ends within this time. */
export const ATTACK_BUFFER_SEC = 0.4;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Nearest living enemy whose centre is within the attacker's range, or null. */
export function nearestEnemyInRange<T extends Combatant>(
  a: Combatant,
  others: readonly T[],
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const o of others) {
    if (!o.alive || o.team === a.team) continue;
    const d = dist(a, o);
    if (d <= a.attackRange + 1e-9 && d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

export const canAttack = (a: Combatant, now: number): boolean =>
  a.alive && now >= a.nextAttackAt - 1e-9;

export interface AttackResult<A extends Combatant, T extends Combatant> {
  attacker: A;
  target: T;
  damage: number;
  killed: boolean;
}

/** One basic attack. Returns new copies; never mutates. */
export function resolveAttack<A extends Combatant, T extends Combatant>(
  attacker: A,
  target: T,
  now: number,
  cfg: EconomyConfig,
): AttackResult<A, T> {
  if (!target.alive) throw new Error(`cannot attack ${target.id}: already dead`);
  const dmg = damage(attacker.atk, target.armor, cfg.combat.armorConstant, cfg.combat.minDamage);
  const hit = takeDamage(target, dmg, now, cfg);
  return {
    attacker: { ...attacker, nextAttackAt: now + 1 / attacker.attackSpeed },
    target: hit.target,
    damage: dmg,
    killed: hit.killed,
  };
}

/** Brings a dead unit back at `base` with full HP once its respawn time has come. */
export function tickRespawn<T extends Combatant>(c: T, now: number, base: Point): T {
  if (c.alive || c.respawnAt === null || now < c.respawnAt) return c;
  return {
    ...c,
    alive: true,
    hp: c.maxHp,
    x: base.x,
    y: base.y,
    respawnAt: null,
    nextAttackAt: now,
  };
}

export function regenerate<T extends Combatant>(c: T, dtSec: number): T {
  if (!c.alive || c.hp >= c.maxHp) return c;
  return { ...c, hp: Math.min(c.maxHp, c.hp + c.hpRegen * dtSec) };
}
