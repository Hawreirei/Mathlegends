/**
 * Hero state and movement (#17). Pure TypeScript, no Phaser: stats come from heroes.json,
 * movement is plain maths so it can be tested and simulated headless (#37).
 */
import type { Hero } from './data';
import type { Combatant } from './combat';
import type { LaneMap, Point, Team } from './map';

export interface HeroStats {
  maxHp: number;
  maxMana: number;
  atk: number;
  armor: number;
  moveSpeed: number;
  attackRange: number;
  attackSpeed: number;
  hpRegen: number;
  manaRegen: number;
}

/** A stat raised by a skill for a while (#33). `delta` was added to the stat and is removed at `until`. */
export interface ActiveBuff {
  stat: 'atk' | 'armor' | 'moveSpeed' | 'attackSpeed';
  delta: number;
  until: number;
}

/** A hero is a Combatant (src/systems/combat.ts) with mana, speed, skills and a hero id. */
export interface HeroState extends HeroStats, Combatant {
  heroId: string;
  mana: number;
  /** Last direction moved (unit vector); skills aim this way when no enemy is near (#33). */
  facing: Point;
  /** Match time each skill slot is ready again (#33). */
  skillReadyAt: number[];
  buffs: ActiveBuff[];
}

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Stats at a level: base + growth x (level - 1). Items and buffs are added later (#36). */
export function statsAtLevel(h: Hero, level: number): HeroStats {
  const n = Math.max(0, level - 1);
  return {
    maxHp: h.base.hp + n * h.growth.hp,
    maxMana: h.base.mana + n * h.growth.mana,
    atk: h.base.atk + n * h.growth.atk,
    armor: h.base.armor + n * h.growth.armor,
    moveSpeed: h.base.moveSpeed,
    attackRange: h.base.attackRange,
    attackSpeed: h.base.attackSpeed,
    hpRegen: h.base.hpRegen,
    manaRegen: h.base.manaRegen,
  };
}

export function createHeroState(h: Hero, spawn: Point, team: Team, level = 1): HeroState {
  const stats = statsAtLevel(h, level);
  return {
    id: `${team}-hero`,
    team,
    alive: true,
    nextAttackAt: 0,
    respawnAt: null,
    heroId: h.id,
    level,
    facing: { x: team === 'blue' ? 1 : -1, y: 0 },
    skillReadyAt: h.skills.map(() => 0),
    buffs: [],
    shield: 0,
    shieldUntil: 0,
    ...stats,
    hp: stats.maxHp,
    mana: stats.maxMana,
    x: spawn.x,
    y: spawn.y,
  };
}

/** Where heroes may walk: the lane band, kept `walkMargin` away from its edges and the world ends. */
export function walkableArea(map: LaneMap): Rect {
  const { lane, world } = map.config;
  const m = lane.walkMargin;
  return {
    left: m,
    right: world.width - m,
    top: lane.y - lane.thickness / 2 + m,
    bottom: lane.y + lane.thickness / 2 - m,
  };
}

export interface DirectionKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/** Unit vector from pressed keys; opposite keys cancel; diagonals are normalised. */
export function directionFromKeys(k: DirectionKeys): Point {
  const x = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  const y = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Moves a hero along `dir` for `dtSec` seconds at its moveSpeed, clamped to `area`.
 * `dir` longer than 1 is shortened, so analogue sticks (#18) cannot exceed full speed.
 */
export function moveHero(s: HeroState, dir: Point, dtSec: number, area: Rect): HeroState {
  const len = Math.hypot(dir.x, dir.y);
  if (len === 0 || dtSec <= 0) return s;
  const k = len > 1 ? 1 / len : 1;
  const step = s.moveSpeed * dtSec * k;
  return {
    ...s,
    facing: { x: dir.x / len, y: dir.y / len },
    x: clamp(s.x + dir.x * step, area.left, area.right),
    y: clamp(s.y + dir.y * step, area.top, area.bottom),
  };
}
