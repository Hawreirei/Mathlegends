/**
 * Skill framework (#33). Pure TypeScript, no Phaser.
 *
 * A hero's skills come from heroes.json `skills` (ids) and skills.json (definitions). Slot i is
 * the i-th id; the ultimate is last. One system handles every skill:
 *
 * - can it be cast? alive, unlocked at the hero's level, off cooldown, enough mana;
 * - aim: the enemy hero if it is within the skill's range, else the nearest enemy minion in
 *   range, else straight ahead (the way the hero last moved);
 * - effects in order: dash, aoe, projectile, buff, shield (src/data/skills.json).
 *
 * match.ts applies the results to the match; this file only has the rules and maths.
 */
import type { Skill, SkillEffect, SkillsFile } from './data';
import type { Combatant } from './combat';
import type { ActiveBuff, HeroState, Rect } from './hero';
import type { Point, Team } from './map';

export type CastProblem = 'noSkill' | 'dead' | 'locked' | 'cooldown' | 'mana';

/** The skill in `slot` for a hero, or null. */
export function skillInSlot(
  heroSkills: readonly string[],
  slot: number,
  skills: SkillsFile,
): Skill | null {
  const id = heroSkills[slot];
  return (id && skills.skills.find((s) => s.id === id)) || null;
}

/** Why the skill cannot be cast now, or null if it can. */
export function castProblem(
  h: HeroState,
  skill: Skill | null,
  slot: number,
  now: number,
): CastProblem | null {
  if (!skill) return 'noSkill';
  if (!h.alive) return 'dead';
  if (h.level < skill.unlockLevel) return 'locked';
  if (now < (h.skillReadyAt[slot] ?? 0) - 1e-9) return 'cooldown';
  if (h.mana < skill.mana) return 'mana';
  return null;
}

/** Seconds of cooldown left for a slot (0 when ready). */
export const cooldownLeft = (h: HeroState, slot: number, now: number): number =>
  Math.max(0, (h.skillReadyAt[slot] ?? 0) - now);

/** base + perLevel x (level - 1) + atkRatio x ATK + maxHpRatio x max HP. */
export function scaled(
  s: { base: number; perLevel: number; atkRatio?: number; maxHpRatio?: number },
  caster: { level: number; atk: number; maxHp: number },
): number {
  return (
    s.base +
    s.perLevel * Math.max(0, caster.level - 1) +
    (s.atkRatio ?? 0) * caster.atk +
    (s.maxHpRatio ?? 0) * caster.maxHp
  );
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The enemy hero if alive and in range, else the nearest living enemy minion in range. */
export function pickTarget<T extends Combatant>(
  caster: Combatant,
  range: number,
  enemyHero: T | null,
  minions: readonly T[],
): T | null {
  if (range <= 0) return null;
  if (
    enemyHero &&
    enemyHero.alive &&
    enemyHero.team !== caster.team &&
    dist(caster, enemyHero) <= range
  )
    return enemyHero;
  let best: T | null = null;
  let bestD = Infinity;
  for (const m of minions) {
    if (!m.alive || m.team === caster.team) continue;
    const d = dist(caster, m);
    if (d <= range && d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/** Unit vector from a to b, or `fallback` if they coincide. */
export function direction(a: Point, b: Point, fallback: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  return d < 1e-6 ? fallback : { x: dx / d, y: dy / d };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where a dash ends: towards the target, stopping `stopShort` pixels before it (so the hero
 * lands next to it, not on it), or the full distance along `aim`; always inside `area`.
 */
export function dashEnd(
  from: Point,
  aim: Point,
  distance: number,
  target: Point | null,
  stopShort: number,
  area: Rect,
): Point {
  const d = target ? Math.min(distance, Math.max(0, dist(from, target) - stopShort)) : distance;
  return {
    x: clamp(from.x + aim.x * d, area.left, area.right),
    y: clamp(from.y + aim.y * d, area.top, area.bottom),
  };
}

/** Adds a buff to a hero: the stat changes now and changes back at `until`. */
export function applyBuff(
  h: HeroState,
  e: Extract<SkillEffect, { kind: 'buff' }>,
  now: number,
): HeroState {
  const current = h[e.stat];
  const delta = current * ((e.mult ?? 1) - 1) + (e.add ?? 0);
  const buff: ActiveBuff = { stat: e.stat, delta, until: now + e.duration };
  return { ...h, [e.stat]: current + delta, buffs: [...h.buffs, buff] };
}

/** Removes buffs and shields whose time is up, putting the stats back. */
export function expireEffects(h: HeroState, now: number): HeroState {
  let out = h;
  if (h.buffs.some((b) => now >= b.until)) {
    out = { ...out };
    for (const b of h.buffs) if (now >= b.until) out[b.stat] -= b.delta;
    out.buffs = h.buffs.filter((b) => now < b.until);
  }
  if ((out.shield ?? 0) > 0 && now >= (out.shieldUntil ?? 0)) out = { ...out, shield: 0 };
  return out;
}

/** A skill projectile in flight. */
export interface ProjectileState {
  id: string;
  skillId: string;
  ownerId: string;
  team: Team;
  x: number;
  y: number;
  dir: Point;
  speed: number;
  /** Pixels it can still travel. */
  left: number;
  radius: number;
  /** Raw damage before the target's armour. */
  damage: number;
  pierce: boolean;
  /** Ids already hit (a piercing projectile hits each unit once). */
  hit: string[];
}

/** Distance from point p to the segment a-b. */
export function segmentDistance(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

/**
 * Moves a projectile for `dt` seconds. Returns the enemies it touched on the way (nearest first;
 * only the first unless it pierces) and the projectile, or null once it has hit or run out.
 * `bodyRadius(u)` is the size of a unit (a fast projectile is swept, so it cannot skip a target).
 */
export function stepProjectile<T extends Combatant>(
  p: ProjectileState,
  dt: number,
  enemies: readonly T[],
  bodyRadius: (u: T) => number,
): { projectile: ProjectileState | null; hits: T[] } {
  const travel = Math.min(p.left, p.speed * dt);
  const from = { x: p.x, y: p.y };
  const to = { x: p.x + p.dir.x * travel, y: p.y + p.dir.y * travel };
  const touched = enemies
    .filter(
      (u) =>
        u.alive &&
        u.team !== p.team &&
        !p.hit.includes(u.id) &&
        segmentDistance(u, from, to) <= p.radius + bodyRadius(u),
    )
    .sort((a, b) => dist(from, a) - dist(from, b));
  const hits = p.pierce ? touched : touched.slice(0, 1);
  const left = p.left - travel;
  const done = (!p.pierce && hits.length > 0) || left <= 1e-6;
  return {
    hits,
    projectile: done
      ? null
      : { ...p, x: to.x, y: to.y, left, hit: [...p.hit, ...hits.map((h) => h.id)] },
  };
}

/** What a skill button shows (#33). */
export interface SkillButtonState {
  /** No skill in this slot. */
  empty: boolean;
  ready: boolean;
  locked: boolean;
  unlockLevel: number;
  noMana: boolean;
  /** Seconds left and the fraction of the cooldown still to go (1 just cast, 0 ready). */
  cooldownLeft: number;
  cooldownFrac: number;
  ultimate: boolean;
}

export function skillButtonState(
  h: HeroState,
  skill: Skill | null,
  slot: number,
  now: number,
): SkillButtonState {
  if (!skill)
    return {
      empty: true,
      ready: false,
      locked: false,
      unlockLevel: 0,
      noMana: false,
      cooldownLeft: 0,
      cooldownFrac: 0,
      ultimate: false,
    };
  const left = cooldownLeft(h, slot, now);
  const problem = castProblem(h, skill, slot, now);
  return {
    empty: false,
    ready: problem === null,
    locked: h.level < skill.unlockLevel,
    unlockLevel: skill.unlockLevel,
    noMana: h.mana < skill.mana,
    cooldownLeft: left,
    cooldownFrac: Math.min(1, left / skill.cooldown),
    ultimate: skill.ultimate,
  };
}
