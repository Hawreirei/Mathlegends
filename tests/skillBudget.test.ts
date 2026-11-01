import { describe, expect, it } from 'vitest';
import botJson from '../src/data/bot.json';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import skillsJson from '../src/data/skills.json';
import structuresJson from '../src/data/structures.json';
import {
  loadBot,
  loadHeroes,
  loadMinions,
  loadSkills,
  loadStructures,
  type Hero,
} from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { buildMap, type MapConfig } from '../src/systems/map';
import { createMatch, stepMatch, type MatchConfig, type MatchState } from '../src/systems/match';
import { spawnWave } from '../src/systems/minions';
import { applyLevel } from '../src/systems/progression';
import { checkSkillBudget, skillBudgetAt } from '../src/systems/skillBudget';
import { castProblem, skillInSlot } from '../src/systems/skills';

const econ = economyJson as EconomyConfig;
const heroes = loadHeroes(heroesJson);
const skills = loadSkills(skillsJson);
const map = buildMap(mapJson as MapConfig);
const LEVEL_CAP = econ.exp.levelCap;

describe('skill damage budget (#34)', () => {
  it('is set in economy.json: 1.5x basic attacks over 10 s', () => {
    expect(econ.skillBudget).toEqual({ windowSec: 10, maxRatio: 1.5 });
  });

  it('every hero stays within it at every level, ultimate included', () => {
    expect(checkSkillBudget(heroes.heroes, skills, econ, LEVEL_CAP)).toEqual([]);
    for (const h of heroes.heroes)
      for (let level = 1; level <= LEVEL_CAP; level++)
        expect(
          skillBudgetAt(h, skills, level, econ).ratio,
          `${h.id} level ${level}`,
        ).toBeLessThanOrEqual(1.5);
  });

  it('skills still matter: at least 0.9x basic attacks once the ultimate is unlocked', () => {
    for (const h of heroes.heroes)
      for (let level = 4; level <= LEVEL_CAP; level++)
        expect(skillBudgetAt(h, skills, level, econ).ratio).toBeGreaterThanOrEqual(0.9);
  });

  it('catches a skill that is too strong', () => {
    const strong = JSON.parse(JSON.stringify(skillsJson));
    strong.skills[0].effects[0].damage.base = 900;
    const problems = checkSkillBudget(heroes.heroes, loadSkills(strong), econ, LEVEL_CAP);
    expect(problems[0]).toMatch(/nova level 1: skill damage .*x basic attacks \(limit 1.5x\)/);
  });

  it('counts attack-speed buffs as skill damage', () => {
    const nova = heroes.heroes.find((h) => h.id === 'nova')!;
    const noBuff = JSON.parse(JSON.stringify(skillsJson));
    const ult = noBuff.skills.find((s: { id: string }) => s.id === 'nova-starfall');
    ult.effects = ult.effects.filter((e: { kind: string }) => e.kind !== 'buff');
    const a = skillBudgetAt(nova, skills, 10, econ).skill;
    const b = skillBudgetAt(nova, loadSkills(noBuff), 10, econ).skill;
    expect(a).toBeGreaterThan(b);
  });
});

describe('the budget holds in real fights (#34)', () => {
  /** 10 s against a big dummy minion: basic attacks only, or attacks plus every ready skill. */
  function fight(hero: Hero, level: number, useSkills: boolean): number {
    const cfg: MatchConfig = {
      econ,
      map,
      minions: loadMinions(minionsJson),
      structures: loadStructures(structuresJson),
      playerHero: hero,
      botHero: heroes.heroes.find((h) => h.id === heroes.botHero)!,
      bot: loadBot(botJson),
      skills,
    };
    let s: MatchState = createMatch(cfg);
    const y = map.heroSpawn.blue.y;
    const p = applyLevel({ ...s.player, x: 1200, y }, hero, level);
    const dummy = {
      ...spawnWave(1, 'red', map, econ, cfg.minions, 't')[0]!,
      id: 'dummy',
      x: 1300,
      y,
      hp: 1e7,
      maxHp: 1e7,
      armor: 0,
      atk: 0,
      moveSpeed: 0,
      nextAttackAt: 1e9,
    };
    s = {
      ...s,
      player: { ...p, mana: 1e6, maxMana: 1e6 },
      bot: { ...s.bot, alive: false, respawnAt: 999 },
      structures: s.structures.map((t) => ({ ...t, nextAttackAt: 1e9 })),
      minions: [dummy],
    };
    let dealt = 0;
    const dt = 0.02;
    for (let i = 0; i < Math.round(econ.skillBudget.windowSec / dt); i++) {
      let skill: number | null = null;
      if (useSkills)
        for (let slot = 0; slot < hero.skills.length && skill === null; slot++)
          if (!castProblem(s.player, skillInSlot(hero.skills, slot, skills), slot, s.now + dt))
            skill = slot;
      const r = stepMatch(s, { move: { x: 0, y: 0 }, attack: true, skill }, dt, cfg);
      s = r.state;
      for (const e of r.events)
        if ((e.type === 'attack' || e.type === 'skillHit') && e.targetId === 'dummy')
          dealt += e.damage;
    }
    return dealt;
  }

  for (const level of [1, 4, 10, 15])
    it(`level ${level}: extra damage from skills <= 1.5x basic attacks, for both heroes`, () => {
      for (const h of heroes.heroes) {
        const basic = fight(h, level, false);
        const withSkills = fight(h, level, true);
        const ratio = (withSkills - basic) / basic;
        expect(ratio, `${h.id} level ${level}`).toBeLessThanOrEqual(econ.skillBudget.maxRatio);
        expect(ratio).toBeGreaterThan(0);
        // The worst-case formula is never below what really happens.
        expect(ratio).toBeLessThanOrEqual(skillBudgetAt(h, skills, level, econ).ratio + 0.02);
      }
    });
});
