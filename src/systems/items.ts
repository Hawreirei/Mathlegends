/**
 * What items do to a hero (#36). Pure TypeScript, no Phaser.
 *
 * - Stats stack: every item in the 6 slots adds its stats (two Training Swords = +24 ATK).
 * - Passives: a unique passive counts once however many copies you own; a non-unique one adds
 *   up. Cooldown reduction from all sources is capped at 40%.
 * - A hero's stats are always: base + growth x (level - 1) + item stats + active skill buffs.
 *   withItems() applies a new set of items to a hero; level-ups keep them (progression.ts).
 */
import type { Hero, ItemsFile, PassiveEffect } from './data';
import { statsAtLevel, type HeroState, type HeroStats } from './hero';
import type { Inventory } from './inventory';

export const ITEM_STAT_KEYS = [
  'hp',
  'mana',
  'atk',
  'armor',
  'moveSpeed',
  'attackSpeed',
  'hpRegen',
  'manaRegen',
] as const;

/** Item stat names -> hero stat names. */
const HERO_KEY: Record<(typeof ITEM_STAT_KEYS)[number], keyof HeroStats> = {
  hp: 'maxHp',
  mana: 'maxMana',
  atk: 'atk',
  armor: 'armor',
  moveSpeed: 'moveSpeed',
  attackSpeed: 'attackSpeed',
  hpRegen: 'hpRegen',
  manaRegen: 'manaRegen',
};

/** Most skill cooldown reduction from items together. */
export const MAX_COOLDOWN_REDUCTION = 0.4;

export interface ItemEffects {
  /** Added to the hero's stats. */
  stats: Partial<HeroStats>;
  /** Fraction of basic-attack damage healed back. */
  lifesteal: number;
  onHitDamage: number;
  cooldownReduction: number;
  skillPower: number;
  lowHpShield: Extract<PassiveEffect, { kind: 'lowHpShield' }> | null;
  /** Passive ids in effect (each unique one once), for display. */
  passives: string[];
}

export const NO_ITEMS: ItemEffects = {
  stats: {},
  lifesteal: 0,
  onHitDamage: 0,
  cooldownReduction: 0,
  skillPower: 0,
  lowHpShield: null,
  passives: [],
};

/** Everything the items in `inv` add up to. */
export function itemEffects(inv: Inventory, items: ItemsFile): ItemEffects {
  const out: ItemEffects = { ...NO_ITEMS, stats: {}, passives: [] };
  const uniqueSeen = new Set<string>();
  for (const id of inv) {
    const item = id ? items.items.find((i) => i.id === id) : undefined;
    if (!item) continue;
    for (const k of ITEM_STAT_KEYS) {
      const v = item.stats[k];
      if (v) out.stats[HERO_KEY[k]] = (out.stats[HERO_KEY[k]] ?? 0) + v;
    }
    out.lifesteal += item.stats.lifesteal ?? 0;
    const p = item.passive;
    if (!p) continue;
    if (p.unique) {
      if (uniqueSeen.has(p.id)) continue;
      uniqueSeen.add(p.id);
    }
    out.passives.push(p.id);
    const e = p.effect;
    if (e.kind === 'onHitDamage') out.onHitDamage += e.amount;
    else if (e.kind === 'cooldownReduction') out.cooldownReduction += e.amount;
    else if (e.kind === 'skillPower') out.skillPower += e.amount;
    else if (e.kind === 'lowHpShield')
      out.lowHpShield =
        !out.lowHpShield || e.maxHpRatio > out.lowHpShield.maxHpRatio ? e : out.lowHpShield;
  }
  out.cooldownReduction = Math.min(MAX_COOLDOWN_REDUCTION, out.cooldownReduction);
  out.lifesteal = Math.min(1, out.lifesteal);
  return out;
}

/** The hero's stats from level, items and active buffs (in that order). */
export function heroStats(def: Hero, level: number, fx: ItemEffects, h?: HeroState): HeroStats {
  const st = statsAtLevel(def, level);
  for (const [k, v] of Object.entries(fx.stats)) st[k as keyof HeroStats] += v;
  for (const b of h?.buffs ?? []) st[b.stat] += b.delta;
  return st;
}

/**
 * Gives a hero a new set of items: stats are recomputed; more max HP or mana also fills the
 * current amount by the same number (like a level-up), less is clamped.
 */
export function withItems(h: HeroState, def: Hero, fx: ItemEffects): HeroState {
  const next = heroStats(def, h.level, fx, h);
  const hp = h.alive ? Math.min(next.maxHp, h.hp + Math.max(0, next.maxHp - h.maxHp)) : h.hp;
  const mana = Math.min(next.maxMana, h.mana + Math.max(0, next.maxMana - h.maxMana));
  return { ...h, ...next, hp: Math.min(hp, next.maxHp), mana, items: fx };
}
