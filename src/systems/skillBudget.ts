/**
 * Skill damage budget (#34, rule in docs/ECONOMY.md "DPS budget"). Pure TypeScript, no Phaser.
 *
 * Over any `skillBudget.windowSec` (10 s), a hero's skill damage to one target must not exceed
 * `skillBudget.maxRatio` (1.5) x the damage of its basic attacks over the same window, at the
 * same level and with no items. The ultimate counts.
 *
 * Worst case, on purpose: every unlocked skill is ready at the start and cast again the moment
 * its cooldown ends (ceil(window / cooldown) casts), mana is ignored, every damage effect hits
 * the target, and attack-speed or ATK buffs count as skill damage (the extra basic damage they
 * add, in whole attacks rounded up). Armour reduces both sides alike, so raw damage is compared.
 */
import type { Hero, SkillsFile } from './data';
import type { EconomyConfig } from './economy';
import { statsAtLevel } from './hero';
import { scaled, skillInSlot } from './skills';

export interface BudgetRow {
  level: number;
  basic: number;
  skill: number;
  ratio: number;
}

export function skillBudgetAt(
  hero: Hero,
  skills: SkillsFile,
  level: number,
  econ: EconomyConfig,
): BudgetRow {
  const st = statsAtLevel(hero, level);
  const win = econ.skillBudget.windowSec;
  const caster = { level, atk: st.atk, maxHp: st.maxHp };
  const basic = st.atk * st.attackSpeed * win;
  let skill = 0;
  hero.skills.forEach((_, slot) => {
    const s = skillInSlot(hero.skills, slot, skills);
    if (!s || level < s.unlockLevel) return;
    const casts = Math.ceil(win / s.cooldown - 1e-9);
    for (const e of s.effects) {
      if (e.kind === 'projectile' || e.kind === 'aoe') skill += casts * scaled(e.damage, caster);
      if (e.kind === 'buff' && (e.stat === 'attackSpeed' || e.stat === 'atk')) {
        // Whole attacks, rounded up: a faster swing can squeeze in an extra hit.
        const d = Math.min(e.duration, win);
        const before = Math.floor(d * st.attackSpeed);
        if (e.stat === 'attackSpeed') {
          const faster = st.attackSpeed * (e.mult ?? 1) + (e.add ?? 0);
          skill += casts * st.atk * (Math.ceil(d * faster) - before);
        } else {
          const extraAtk = st.atk * ((e.mult ?? 1) - 1) + (e.add ?? 0);
          skill += casts * extraAtk * Math.ceil(d * st.attackSpeed);
        }
      }
    }
  });
  return { level, basic, skill, ratio: basic > 0 ? skill / basic : 0 };
}

/** Problems for every hero and level over the budget (checked at load and in CI). */
export function checkSkillBudget(
  heroes: readonly Hero[],
  skills: SkillsFile,
  econ: EconomyConfig,
  maxLevel: number,
): string[] {
  const out: string[] = [];
  for (const h of heroes)
    for (let level = 1; level <= maxLevel; level++) {
      const r = skillBudgetAt(h, skills, level, econ);
      if (r.ratio > econ.skillBudget.maxRatio + 1e-9)
        out.push(
          `${h.id} level ${level}: skill damage ${r.ratio.toFixed(2)}x basic attacks (limit ${econ.skillBudget.maxRatio}x)`,
        );
    }
  return out;
}
