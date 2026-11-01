import { describe, expect, it } from 'vitest';
import botJson from '../src/data/bot.json';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import skillsJson from '../src/data/skills.json';
import itemsJson from '../src/data/items.json';
import structuresJson from '../src/data/structures.json';
import { takeDamage } from '../src/systems/combat';
import {
  checkHeroSkills,
  loadBot,
  loadHeroes,
  loadMinions,
  loadSkills,
  loadItems,
  loadStructures,
} from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { walkableArea } from '../src/systems/hero';
import { buildMap, type MapConfig } from '../src/systems/map';
import {
  createMatch,
  stepMatch,
  type MatchConfig,
  type MatchEvent,
  type MatchInput,
  type MatchState,
} from '../src/systems/match';
import { spawnWave, type MinionState } from '../src/systems/minions';
import { applyLevel } from '../src/systems/progression';
import {
  castProblem,
  scaled,
  skillButtonState,
  skillInSlot,
  stepProjectile,
  type ProjectileState,
} from '../src/systems/skills';

const econ = economyJson as EconomyConfig;
const heroes = loadHeroes(heroesJson);
const skills = loadSkills(skillsJson);
const map = buildMap(mapJson as MapConfig);
const cfg: MatchConfig = {
  econ,
  map,
  minions: loadMinions(minionsJson),
  structures: loadStructures(structuresJson),
  playerHero: heroes.heroes.find((h) => h.id === heroes.playerHero)!,
  botHero: heroes.heroes.find((h) => h.id === heroes.botHero)!,
  bot: loadBot(botJson),
  skills,
  items: loadItems(itemsJson),
};
const DT = 0.02;
const LANE_Y = map.heroSpawn.blue.y;

/** A quiet lane: the player at x = 1200, the bot dead far away, towers silent, no minions unless added. */
function arena(level = 1, c: MatchConfig = cfg): MatchState {
  let s = createMatch(c);
  let player = { ...s.player, x: 1200, y: LANE_Y };
  if (level > 1) player = applyLevel(player, c.playerHero, level);
  s = {
    ...s,
    player: { ...player, mana: player.maxMana },
    bot: { ...s.bot, alive: false, respawnAt: 999, x: 3800 },
    // Towers hold fire so only skills touch the test minions.
    structures: s.structures.map((t) => ({ ...t, nextAttackAt: 999 })),
  };
  return s;
}

/** An enemy (red) minion at x with `hp`. */
function minion(x: number, hp = 400, id = 'm1'): MinionState {
  const m = spawnWave(1, 'red', map, econ, cfg.minions, 'test')[0]!;
  return { ...m, id, x, y: LANE_Y, hp, maxHp: Math.max(hp, m.maxHp), atk: 0, nextAttackAt: 999 };
}

function run(s: MatchState, seconds: number, first: Partial<MatchInput> = {}, c = cfg) {
  const events: MatchEvent[] = [];
  let st = s;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const input: MatchInput = { move: { x: 0, y: 0 }, attack: false, ...(i === 0 ? first : {}) };
    const r = stepMatch(st, input, DT, c);
    st = r.state;
    events.push(...r.events);
  }
  return { state: st, events };
}

describe('skills.json (#33)', () => {
  it('loads, and every hero has 3 skills plus an ultimate, all defined', () => {
    expect(checkHeroSkills(heroes, skills)).toEqual([]);
    for (const h of heroes.heroes) {
      expect(h.skills).toHaveLength(4);
      expect(skillInSlot(h.skills, 3, skills)?.ultimate).toBe(true);
    }
  });

  it('reports unknown skills and a misplaced ultimate', () => {
    const bad = {
      ...heroes,
      heroes: [{ ...heroes.heroes[0]!, skills: ['nova-starfall', 'nope'] }],
    };
    const problems = checkHeroSkills(bad, skills);
    expect(problems.join('\n')).toMatch(/"nope" is not in skills.json/);
    expect(problems.join('\n')).toMatch(/ultimate must be the last/);
  });

  it('rejects unknown effect kinds and fields', () => {
    const broken = JSON.parse(JSON.stringify(skillsJson));
    broken.skills[0].effects[0].kind = 'teleport';
    expect(() => loadSkills(broken)).toThrow(/skills.json/);
  });
});

describe('casting rules (#33)', () => {
  const s = arena();
  const def = cfg.playerHero;
  it('needs the unlock level, an expired cooldown, enough mana and a living hero', () => {
    expect(castProblem(s.player, skillInSlot(def.skills, 0, skills), 0, 0)).toBeNull();
    expect(castProblem(s.player, skillInSlot(def.skills, 3, skills), 3, 0)).toBe('locked');
    expect(
      castProblem(
        { ...s.player, skillReadyAt: [5, 0, 0, 0] },
        skillInSlot(def.skills, 0, skills),
        0,
        1,
      ),
    ).toBe('cooldown');
    expect(castProblem({ ...s.player, mana: 1 }, skillInSlot(def.skills, 0, skills), 0, 0)).toBe(
      'mana',
    );
    expect(
      castProblem({ ...s.player, alive: false }, skillInSlot(def.skills, 0, skills), 0, 0),
    ).toBe('dead');
    expect(castProblem(s.player, null, 5, 0)).toBe('noSkill');
  });

  it('scales with level, ATK and max HP', () => {
    expect(scaled({ base: 70, perLevel: 10, atkRatio: 0.5 }, { level: 3, atk: 60, maxHp: 0 })).toBe(
      120,
    );
    expect(
      scaled({ base: 90, perLevel: 0, maxHpRatio: 0.1 }, { level: 1, atk: 0, maxHp: 800 }),
    ).toBe(170);
  });

  it('spends mana, starts the cooldown, and a second press during it fails', () => {
    const s0 = { ...arena(), minions: [minion(1500)] };
    const a = run(s0, DT, { skill: 0 });
    const toss = skillInSlot(cfg.playerHero.skills, 0, skills)!;
    expect(a.state.player.mana).toBeCloseTo(s0.player.maxMana - toss.mana, 0);
    expect(a.state.player.skillReadyAt[0]).toBeCloseTo(DT + toss.cooldown);
    expect(a.events.some((e) => e.type === 'skill' && e.slot === 0)).toBe(true);
    const b = run(a.state, DT, { skill: 0 });
    expect(b.events).toContainEqual({
      type: 'skillFailed',
      by: 'player',
      slot: 0,
      reason: 'cooldown',
    });
  });

  it('mana comes back over time', () => {
    const s0 = { ...arena(), player: { ...arena().player, mana: 0 } };
    const r = run(s0, 2);
    expect(r.state.player.mana).toBeCloseTo(cfg.playerHero.base.manaRegen * 2, 1);
  });
});

describe('effects (#33)', () => {
  it('projectile: flies to the first enemy in its path and damages it', () => {
    const s0 = { ...arena(), minions: [minion(1500, 400, 'near'), minion(1650, 400, 'far')] };
    const r = run(s0, 1, { skill: 0 });
    const near = r.state.minions.find((m) => m.id === 'near')!;
    const far = r.state.minions.find((m) => m.id === 'far')!;
    expect(near.hp).toBeLessThan(400);
    expect(far.hp).toBe(400);
    expect(r.state.projectiles).toEqual([]);
    expect(r.events.filter((e) => e.type === 'skillHit')).toHaveLength(1);
  });

  it("a skill kill on a minion is the player's last hit, so a question comes (#27)", () => {
    const s0 = { ...arena(), minions: [minion(1500, 5)] };
    const r = run(s0, 1, { skill: 0 });
    expect(r.events.some((e) => e.type === 'lastHit')).toBe(true);
    expect(r.state.minions).toEqual([]);
  });

  it('dash + aoe: lands next to the target and hits everything around it', () => {
    const s0 = {
      ...arena(2),
      minions: [minion(1420, 400, 'a'), minion(1440, 400, 'b'), minion(1900, 400, 'c')],
    };
    const r = run(s0, DT, { skill: 1 });
    const cast = r.events.find((e) => e.type === 'skill')!;
    expect(cast.type === 'skill' && cast.dashTo).toBeTruthy();
    expect(r.state.player.x).toBeGreaterThan(1200);
    expect(r.state.player.x).toBeLessThan(1420);
    const hp = (id: string) => r.state.minions.find((m) => m.id === id)!.hp;
    expect(hp('a')).toBeLessThan(400);
    expect(hp('b')).toBeLessThan(400);
    expect(hp('c')).toBe(400);
  });

  it('dash stays inside the lane', () => {
    const s0 = arena(2);
    const r = run({ ...s0, player: { ...s0.player, x: 70, facing: { x: -1, y: 0 } } }, DT, {
      skill: 1,
    });
    expect(r.state.player.x).toBeGreaterThanOrEqual(walkableArea(map).left);
  });

  it('shield absorbs damage first and runs out after its duration', () => {
    const r = run(arena(3), DT, { skill: 2 });
    const p = r.state.player;
    expect(p.shield).toBeGreaterThan(0);
    const hit = takeDamage(p, 50, r.state.now, econ);
    expect(hit.target.hp).toBe(p.hp);
    expect(hit.target.shield).toBeCloseTo(p.shield! - 50);
    const later = run(r.state, 4.1);
    expect(later.state.player.shield).toBe(0);
    expect(takeDamage(later.state.player, 50, later.state.now, econ).target.hp).toBeCloseTo(
      later.state.player.hp - 50,
    );
  });

  it('buff: raises the stat, survives a level-up, and wears off', () => {
    const base = arena(3);
    const r = run(base, DT, { skill: 2 });
    expect(r.state.player.moveSpeed).toBeCloseTo(base.player.moveSpeed * 1.2);
    const lv = applyLevel(r.state.player, cfg.playerHero, 4);
    expect(lv.moveSpeed).toBeCloseTo(base.player.moveSpeed * 1.2);
    const later = run(r.state, 3.1);
    expect(later.state.player.moveSpeed).toBeCloseTo(base.player.moveSpeed);
    expect(later.state.player.buffs).toEqual([]);
  });

  it('ultimate (aoe at the target + attack speed buff) unlocks at level 4', () => {
    const s0 = { ...arena(4), minions: [minion(1500, 400, 'a'), minion(1560, 400, 'b')] };
    const r = run(s0, DT, { skill: 3 });
    expect(r.state.minions.every((m) => m.hp < 400)).toBe(true);
    expect(r.state.player.attackSpeed).toBeCloseTo(s0.player.attackSpeed * 1.3);
    const low = run({ ...arena(1), minions: [minion(1500)] }, DT, { skill: 3 });
    expect(low.events).toContainEqual({
      type: 'skillFailed',
      by: 'player',
      slot: 3,
      reason: 'locked',
    });
  });

  it('with no enemy in range a skill fires the way the hero faces', () => {
    const r = run(arena(), DT, { skill: 0 });
    expect(r.state.projectiles).toHaveLength(1);
    expect(r.state.projectiles[0]!.dir).toEqual({ x: 1, y: 0 });
  });
});

describe('projectiles (#33)', () => {
  const p: ProjectileState = {
    id: 'p',
    skillId: 's',
    ownerId: 'o',
    team: 'blue',
    x: 0,
    y: 0,
    dir: { x: 1, y: 0 },
    speed: 5000,
    left: 1000,
    radius: 10,
    damage: 50,
    pierce: false,
    hit: [],
  };
  const u = (id: string, x: number) => ({ id, team: 'red' as const, x, y: 0, alive: true });
  it('a fast projectile cannot skip over a target between frames', () => {
    const r = stepProjectile(p, 0.1, [u('a', 300) as never], () => 20);
    expect(r.hits.map((h) => (h as { id: string }).id)).toEqual(['a']);
    expect(r.projectile).toBeNull();
  });
  it('a piercing projectile hits everything on its path once', () => {
    const r = stepProjectile(
      { ...p, pierce: true },
      0.1,
      [u('b', 400), u('a', 200)] as never,
      () => 20,
    );
    expect(r.hits.map((h) => (h as { id: string }).id)).toEqual(['a', 'b']);
    expect(r.projectile?.hit).toEqual(['a', 'b']);
  });
  it('stops at its range', () => {
    const r = stepProjectile({ ...p, left: 100 }, 0.1, [], () => 20);
    expect(r.projectile).toBeNull();
  });
});

describe('a new skill needs JSON only (#33)', () => {
  it('a piercing ice lance defined in JSON can be given to the hero and cast', () => {
    const lance = {
      id: 'test-ice-lance',
      name: { id: 'Tombak Es', en: 'Ice Lance' },
      description: { id: 'Menembus semua musuh.', en: 'Pierces every enemy.' },
      ultimate: false,
      unlockLevel: 1,
      cooldown: 3,
      mana: 20,
      range: 600,
      effects: [
        {
          kind: 'projectile',
          damage: { base: 50, perLevel: 0 },
          speed: 1200,
          radius: 30,
          pierce: true,
        },
      ],
    };
    const moreSkills = loadSkills({ ...skillsJson, skills: [...skillsJson.skills, lance] });
    const hero = { ...cfg.playerHero, skills: ['test-ice-lance'] };
    const c2: MatchConfig = { ...cfg, skills: moreSkills, playerHero: hero };
    expect(checkHeroSkills({ ...heroes, heroes: [hero] }, moreSkills)).toEqual([]);
    const s0 = { ...arena(1, c2), minions: [minion(1500, 400, 'a'), minion(1650, 400, 'b')] };
    const r = run(s0, 1, { skill: 0 }, c2);
    expect(r.state.minions.every((m) => m.hp < 400)).toBe(true);
  });
});

describe('skill button state (#33)', () => {
  it('shows ready, cooldown fraction and seconds, locked level and missing mana', () => {
    const s = arena();
    const toss = skillInSlot(cfg.playerHero.skills, 0, skills)!;
    expect(skillButtonState(s.player, toss, 0, 0)).toMatchObject({
      ready: true,
      cooldownLeft: 0,
      cooldownFrac: 0,
    });
    const cd = skillButtonState(
      { ...s.player, skillReadyAt: [toss.cooldown, 0, 0, 0] },
      toss,
      0,
      toss.cooldown / 2,
    );
    expect(cd).toMatchObject({ ready: false, cooldownLeft: toss.cooldown / 2, cooldownFrac: 0.5 });
    const ult = skillInSlot(cfg.playerHero.skills, 3, skills)!;
    expect(skillButtonState(s.player, ult, 3, 0)).toMatchObject({
      locked: true,
      unlockLevel: 4,
      ultimate: true,
    });
    expect(skillButtonState({ ...s.player, mana: 0 }, toss, 0, 0)).toMatchObject({
      noMana: true,
      ready: false,
    });
    expect(skillButtonState(s.player, null, 0, 0).empty).toBe(true);
  });
});
