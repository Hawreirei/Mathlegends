import { describe, expect, it } from 'vitest';
import botJson from '../src/data/bot.json';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import itemsJson from '../src/data/items.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import skillsJson from '../src/data/skills.json';
import structuresJson from '../src/data/structures.json';
import {
  loadBot,
  loadHeroes,
  loadItems,
  loadMinions,
  loadSkills,
  loadStructures,
} from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { statsAtLevel } from '../src/systems/hero';
import { itemEffects, MAX_COOLDOWN_REDUCTION, withItems } from '../src/systems/items';
import { buildMap, type MapConfig } from '../src/systems/map';
import {
  createMatch,
  playerBuy,
  playerSell,
  stepMatch,
  type MatchConfig,
  type MatchEvent,
  type MatchInput,
  type MatchState,
} from '../src/systems/match';
import { spawnWave } from '../src/systems/minions';
import { applyLevel } from '../src/systems/progression';

const econ = economyJson as EconomyConfig;
const heroes = loadHeroes(heroesJson);
const items = loadItems(itemsJson);
const map = buildMap(mapJson as MapConfig);
const cfg: MatchConfig = {
  econ,
  map,
  minions: loadMinions(minionsJson),
  structures: loadStructures(structuresJson),
  playerHero: heroes.heroes.find((h) => h.id === heroes.playerHero)!,
  botHero: heroes.heroes.find((h) => h.id === heroes.botHero)!,
  bot: loadBot(botJson),
  skills: loadSkills(skillsJson),
  items,
};
const nova = cfg.playerHero;
const inv = (...ids: string[]) =>
  [...ids, ...Array(6 - ids.length).fill(null)] as (string | null)[];
const Y = map.heroSpawn.blue.y;

/** Quiet lane with rich player, silent towers, dead bot. */
function arena(extra: Partial<MatchState> = {}): MatchState {
  const s = createMatch(cfg);
  return {
    ...s,
    player: { ...s.player, x: 1200, y: Y },
    playerProgress: { ...s.playerProgress, gold: 10_000 },
    bot: { ...s.bot, alive: false, respawnAt: 999 },
    structures: s.structures.map((t) => ({ ...t, nextAttackAt: 999 })),
    ...extra,
  };
}
function buy(s: MatchState, ...ids: string[]): MatchState {
  for (const id of ids) {
    const r = playerBuy(s, id, cfg);
    if (!r.result.ok) throw new Error(`${id}: ${r.result.reason}`);
    s = r.state;
  }
  return s;
}
const dummy = (hp = 1e6, x = 1300) => ({
  ...spawnWave(1, 'red', map, econ, cfg.minions, 't')[0]!,
  id: 'dummy',
  x,
  y: Y,
  hp,
  maxHp: hp,
  armor: 0,
  atk: 0,
  moveSpeed: 0,
  nextAttackAt: 1e9,
});
function run(
  s: MatchState,
  sec: number,
  input: Partial<MatchInput> = {},
  first: Partial<MatchInput> = {},
) {
  const events: MatchEvent[] = [];
  for (let i = 0; i < Math.round(sec / 0.02); i++) {
    const r = stepMatch(
      s,
      { move: { x: 0, y: 0 }, attack: false, ...input, ...(i === 0 ? first : {}) },
      0.02,
      cfg,
    );
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
const damageTo = (events: MatchEvent[], id: string) =>
  events.reduce(
    (t, e) =>
      t + ((e.type === 'attack' || e.type === 'skillHit') && e.targetId === id ? e.damage : 0),
    0,
  );

describe('items.json (#36)', () => {
  it('has 8 items mixing attack, defense, speed and sustain, with passives', () => {
    expect(items.items).toHaveLength(8);
    const passives = items.items.filter((i) => i.passive);
    expect(passives.length).toBeGreaterThanOrEqual(4);
    for (const i of passives)
      expect(i.passive!.description.id && i.passive!.description.en).toBeTruthy();
  });
});

describe('stat stacking (#36)', () => {
  it('stats of every item add up, the same item twice counts twice', () => {
    const fx = itemEffects(
      inv('training-sword', 'training-sword', 'bamboo-vest', 'leaf-charm'),
      items,
    );
    expect(fx.stats.atk).toBe(24);
    expect(fx.stats.armor).toBe(15);
    expect(fx.stats.maxHp).toBe(100);
    expect(fx.stats.hpRegen).toBe(3);
    expect(fx.lifesteal).toBeCloseTo(0.06);
  });

  it('empty slots and unknown ids add nothing', () => {
    expect(itemEffects(inv(), items).stats).toEqual({});
    expect(itemEffects(inv('nope'), items).stats).toEqual({});
  });

  it('buying applies the stats at once, selling takes them away', () => {
    let s = arena();
    const base = s.player;
    s = buy(s, 'training-sword', 'wind-sandals');
    expect(s.player.atk).toBe(base.atk + 12);
    expect(s.player.moveSpeed).toBe(base.moveSpeed + 30);
    s = playerSell(s, 0, cfg).state;
    expect(s.player.atk).toBe(base.atk);
    expect(s.player.moveSpeed).toBe(base.moveSpeed + 30);
  });

  it('more max HP also adds current HP; selling it clamps HP to the new max', () => {
    let s = arena();
    s = { ...s, player: { ...s.player, hp: 400 } };
    s = buy(s, 'guardian-cloak');
    expect(s.player.maxHp).toBe(nova.base.hp + 250);
    expect(s.player.hp).toBe(650);
    s = { ...s, player: { ...s.player, hp: s.player.maxHp } };
    s = playerSell(s, 0, cfg).state;
    expect(s.player.hp).toBe(nova.base.hp);
  });

  it('items stay through a level-up, on top of the new level', () => {
    let s = buy(arena(), 'comet-spear');
    const up = applyLevel(s.player, nova, 5);
    const lv5 = statsAtLevel(nova, 5);
    expect(up.atk).toBeCloseTo(lv5.atk + 26);
    expect(up.attackSpeed).toBeCloseTo(lv5.attackSpeed + 0.15);
    s = { ...s, player: up };
    expect(withItems(s.player, nova, itemEffects(inv(), items)).atk).toBeCloseTo(lv5.atk);
  });
});

describe('passives (#36)', () => {
  it('a unique passive counts once, however many copies you own', () => {
    const one = itemEffects(inv('comet-spear'), items);
    const two = itemEffects(inv('comet-spear', 'comet-spear'), items);
    expect(two.onHitDamage).toBe(one.onHitDamage);
    expect(two.stats.atk).toBe(2 * one.stats.atk!);
    expect(two.passives).toEqual(['comet-strike']);
  });

  it('a non-unique passive adds up, and cooldown reduction is capped at 40%', () => {
    const raw = JSON.parse(JSON.stringify(itemsJson));
    const book = raw.items.find((i: { id: string }) => i.id === 'formula-book');
    book.passive.unique = false;
    book.passive.effect.amount = 0.15;
    const more = loadItems(raw);
    expect(itemEffects(inv('formula-book', 'formula-book'), more).cooldownReduction).toBeCloseTo(
      0.3,
    );
    expect(
      itemEffects(inv('formula-book', 'formula-book', 'formula-book', 'formula-book'), more)
        .cooldownReduction,
    ).toBe(MAX_COOLDOWN_REDUCTION);
  });

  it('Comet Spear: basic attacks deal extra damage', () => {
    const plain = run(arena({ minions: [dummy()] }), 3, { attack: true });
    const spear = run(buy(arena({ minions: [dummy()] }), 'comet-spear'), 3, { attack: true });
    const lv = statsAtLevel(nova, 1);
    // More damage than the ATK and speed alone would give.
    expect(damageTo(spear.events, 'dummy')).toBeGreaterThan(
      damageTo(plain.events, 'dummy') *
        ((lv.atk + 26) / lv.atk) *
        ((lv.attackSpeed + 0.15) / lv.attackSpeed),
    );
  });

  it('Leaf Charm: lifesteal heals the attacker', () => {
    const s0 = buy(arena({ minions: [dummy()] }), 'leaf-charm');
    const hurt = { ...s0, player: { ...s0.player, hp: 300, hpRegen: 0 } };
    const r = run(hurt, 2, { attack: true });
    const healedByRegen = 3 * 2;
    expect(r.state.player.hp - 300).toBeGreaterThan(healedByRegen);
  });

  it('Formula Book: shorter skill cooldowns', () => {
    const r = run(buy(arena({ minions: [dummy()] }), 'formula-book'), 0.02, {}, { skill: 0 });
    const toss = cfg.skills.skills.find((x) => x.id === 'nova-star-toss')!;
    expect(r.state.player.skillReadyAt[0]).toBeCloseTo(0.02 + toss.cooldown * 0.88);
  });

  it('Rainbow Wand: skills deal more damage', () => {
    const plain = run(arena({ minions: [dummy()] }), 1, {}, { skill: 0 });
    const wand0 = buy(arena({ minions: [dummy()] }), 'rainbow-wand');
    // Same ATK for a fair comparison: take the wand's ATK back off.
    const wand = run(
      { ...wand0, player: { ...wand0.player, atk: plain.state.player.atk } },
      1,
      {},
      { skill: 0 },
    );
    expect(damageTo(wand.events, 'dummy')).toBeCloseTo(damageTo(plain.events, 'dummy') * 1.15, 0);
  });

  it('Guardian Cloak: a shield below 30% HP, then a 30 s wait', () => {
    let s = buy(arena(), 'guardian-cloak');
    s = { ...s, player: { ...s.player, hp: s.player.maxHp * 0.25 } };
    s = run(s, 0.02).state;
    expect(s.player.shield).toBeCloseTo(s.player.maxHp * 0.15);
    const readyAt = s.player.passiveReadyAt;
    expect(readyAt).toBeCloseTo(s.now + 30, 1);
    s = run(s, 3.1).state;
    expect(s.player.shield).toBe(0);
    s = run(s, 1).state; // still low, still waiting
    expect(s.player.shield).toBe(0);
  });
});
