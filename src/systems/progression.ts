/**
 * Gold, EXP and levelling (#22). Pure TypeScript, no Phaser; every number comes from
 * economy.json. Question multipliers (#28) feed into killRewards' `multiplier`.
 */
import type { Hero } from './data';
import { levelForExp, type EconomyConfig, type MinionType } from './economy';
import { NO_ITEMS, heroStats } from './items';
import type { HeroState } from './hero';
import type { Team } from './map';

export type GoldSource = 'start' | 'passive' | 'lastHit' | 'heroKill' | 'tower';

export interface Progress {
  gold: number;
  exp: number;
  level: number;
  /** Lifetime gold by where it came from (math share and the simulator use this). */
  goldBySource: Record<GoldSource, number>;
}

export function createProgress(c: EconomyConfig): Progress {
  return {
    gold: c.startingGold,
    exp: 0,
    level: 1,
    goldBySource: { start: c.startingGold, passive: 0, lastHit: 0, heroKill: 0, tower: 0 },
  };
}

export function addGold(p: Progress, amount: number, source: GoldSource): Progress {
  if (amount <= 0) return p;
  return {
    ...p,
    gold: p.gold + amount,
    goldBySource: { ...p.goldBySource, [source]: p.goldBySource[source] + amount },
  };
}

export const tickPassiveGold = (p: Progress, dtSec: number, c: EconomyConfig): Progress =>
  addGold(p, c.passiveGoldPerSecond * dtSec, 'passive');

/** Adds EXP and works out the new level (capped). */
export function addExp(
  p: Progress,
  amount: number,
  c: EconomyConfig,
): { progress: Progress; levelsGained: number } {
  const exp = p.exp + Math.max(0, amount);
  const level = Math.max(p.level, levelForExp(c, exp));
  return { progress: { ...p, exp, level }, levelsGained: level - p.level };
}

/**
 * Recomputes a hero's stats for `level` from heroes.json growth. A living hero keeps its
 * missing HP/mana and gains the extra max HP/mana as current HP/mana.
 */
export function applyLevel(s: HeroState, def: Hero, level: number): HeroState {
  // Items (#36) and active skill buffs (#33) stay on top of the new level's stats.
  const next = heroStats(def, level, s.items ?? NO_ITEMS, s);
  const out = { ...s, ...next, level };
  if (!s.alive) return { ...out, hp: s.hp, mana: s.mana };
  return {
    ...out,
    hp: Math.min(next.maxHp, s.hp + (next.maxHp - s.maxHp)),
    mana: Math.min(next.maxMana, s.mana + (next.maxMana - s.maxMana)),
  };
}

export interface Victim {
  kind: 'minion' | 'hero' | 'tower' | 'nexus';
  minionKind?: MinionType;
  /** Minion last-hit gold multiplier from match-time growth (#68). */
  goldScale?: number;
  team: Team;
  x: number;
  y: number;
}

export interface HeroRef {
  id: string;
  team: Team;
  x: number;
  y: number;
  alive: boolean;
}

export interface Reward {
  heroId: string;
  gold: number;
  exp: number;
  source: 'lastHit' | 'shareExp' | 'heroKill' | 'tower';
}

/**
 * Who earns what when something dies.
 * - Minion: the hero who landed the killing blow gets lastHitGold (x the minion's goldScale, #68)
 *   and minion EXP, both x multiplier
 *   (the question result, #28); other enemy heroes within exp.shareRangePx get the minion EXP.
 * - Hero: the enemy hero who landed the killing blow gets heroKill gold and EXP.
 * - Tower: every enemy hero gets the tower gold (team reward).
 */
export function killRewards(
  v: Victim,
  killerId: string,
  heroes: readonly HeroRef[],
  c: EconomyConfig,
  multiplier = 1,
): Reward[] {
  const enemies = heroes.filter((h) => h.team !== v.team && h.alive);
  if (v.kind === 'minion' && v.minionKind) {
    const out: Reward[] = [];
    for (const h of enemies) {
      const exp = c.exp.minion[v.minionKind];
      if (h.id === killerId)
        out.push({
          heroId: h.id,
          gold: c.lastHitGold[v.minionKind] * (v.goldScale ?? 1) * multiplier,
          exp: exp * multiplier,
          source: 'lastHit',
        });
      else if (Math.hypot(h.x - v.x, h.y - v.y) <= c.exp.shareRangePx)
        out.push({ heroId: h.id, gold: 0, exp, source: 'shareExp' });
    }
    return out;
  }
  if (v.kind === 'hero') {
    const killer = enemies.find((h) => h.id === killerId);
    return killer
      ? [{ heroId: killer.id, gold: c.otherGold.heroKill, exp: c.exp.heroKill, source: 'heroKill' }]
      : [];
  }
  if (v.kind === 'tower')
    return enemies.map((h) => ({
      heroId: h.id,
      gold: c.otherGold.tower,
      exp: 0,
      source: 'tower' as const,
    }));
  return [];
}
