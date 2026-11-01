import { describe, expect, it } from 'vitest';
import botJson from '../src/data/bot.json';
import skillsJson from '../src/data/skills.json';
import itemsJson from '../src/data/items.json';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import structuresJson from '../src/data/structures.json';
import { isUnsafe, thinkBot, createBrain } from '../src/systems/bot';
import {
  loadBot,
  loadSkills,
  loadItems,
  loadHeroes,
  loadMinions,
  loadStructures,
} from '../src/systems/data';
import { validateEconomy, type EconomyConfig } from '../src/systems/economy';
import { buildMap, type MapConfig } from '../src/systems/map';
import { spawnWave } from '../src/systems/minions';
import {
  applyLastHitReward,
  createMatch,
  stepMatch,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
} from '../src/systems/match';

const econ = economyJson as EconomyConfig;
const heroes = loadHeroes(heroesJson);
const cfg: MatchConfig = {
  econ,
  map: buildMap(mapJson as MapConfig),
  minions: loadMinions(minionsJson),
  structures: loadStructures(structuresJson),
  playerHero: heroes.heroes.find((h) => h.id === heroes.playerHero)!,
  botHero: heroes.heroes.find((h) => h.id === heroes.botHero)!,
  bot: loadBot(botJson),
  skills: loadSkills(skillsJson),
  items: loadItems(itemsJson),
};
const idle = { move: { x: 0, y: 0 }, attack: false };
const DT = 0.05;

function run(s: MatchState, seconds: number, input = idle) {
  const events: MatchEvent[] = [];
  let st = s;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const r = stepMatch(st, input, DT, cfg);
    st = r.state;
    events.push(...r.events);
  }
  return { state: st, events };
}

describe('bot.json', () => {
  it('loads, and economy.json is valid', () => {
    expect(cfg.bot.retreatHpFraction).toBeLessThan(cfg.bot.returnHpFraction);
    expect(validateEconomy(econ)).toEqual([]);
  });

  it('rejects a return threshold below the retreat threshold', () => {
    expect(() => loadBot({ ...botJson, base: { ...botJson.base, returnHpFraction: 0.2 } })).toThrow(
      /returnHpFraction/,
    );
  });
});

describe('bot decisions', () => {
  const world = (over: Partial<MatchState> = {}) => {
    const s = { ...createMatch(cfg), ...over };
    return {
      bot: s.bot,
      player: s.player,
      minions: s.minions,
      structures: s.structures,
      map: cfg.map,
    };
  };

  it('retreats home below retreatHpFraction and stays until healed to returnHpFraction', () => {
    const s0 = createMatch(cfg);
    const low = { ...s0.bot, x: 2300, hp: s0.bot.maxHp * 0.2 };
    let brain = thinkBot(createBrain(), { ...world(), bot: low }, 1, cfg.bot, econ);
    expect(brain.mode).toBe('retreat');
    expect(brain.moveTo).toEqual(cfg.map.heroSpawn.red);
    const half = { ...low, hp: low.maxHp * 0.6 };
    brain = thinkBot(brain, { ...world(), bot: half }, 2, cfg.bot, econ);
    expect(brain.mode).toBe('retreat');
    const healed = { ...low, hp: low.maxHp * 0.9 };
    brain = thinkBot(brain, { ...world(), bot: healed }, 3, cfg.bot, econ);
    expect(brain.mode).toBe('lane');
  });

  it('prefers a minion it can finish in one blow (last hit) over a healthier one', () => {
    const s0 = createMatch(cfg);
    const bot = { ...s0.bot, x: 2400, y: 700 };
    const [a, b] = spawnWave(0, 'blue', cfg.map, econ, cfg.minions, 'b');
    const healthy = { ...a!, x: 2300, y: 700 };
    const nearlyDead = { ...b!, x: 2320, y: 760, hp: 10 };
    const brain = thinkBot(
      createBrain(),
      { ...world(), bot, minions: [healthy, nearlyDead] },
      1,
      cfg.bot,
      econ,
    );
    expect(brain.targetId).toBe(nearlyDead.id);
  });

  it('fights the player when close and healthy, but not under the player’s tower', () => {
    const s0 = createMatch(cfg);
    const bot = { ...s0.bot, x: 2400, y: 700 };
    const open = { ...s0.player, x: 2200, y: 700 }; // middle of the lane, out of every tower's range
    expect(
      thinkBot(createBrain(), { ...world(), bot, player: open }, 1, cfg.bot, econ).targetId,
    ).toBe(open.id);
    const towerX = s0.structures.find((x) => x.id === 'tower-blue-1')!.x;
    const underTower = { ...s0.player, x: towerX + 100, y: 700 };
    const nearBot = { ...bot, x: towerX + 400 };
    const brain = thinkBot(
      createBrain(),
      { ...world(), bot: nearBot, player: underTower },
      1,
      cfg.bot,
      econ,
    );
    expect(brain.targetId).not.toBe(underTower.id);
    expect(
      isUnsafe(brain.moveTo!, 'red', { ...world(), bot: nearBot }, cfg.bot.towerSafetyMarginPx),
    ).toBe(false);
  });
});

describe('a full headless match', () => {
  it('runs 10 minutes with the bot farming and fighting, without errors or broken numbers', () => {
    const { state, events } = run(createMatch(cfg), 600);
    const bad = (n: number) => !Number.isFinite(n);
    for (const u of [state.player, state.bot, ...state.minions, ...state.structures]) {
      expect(bad(u.x) || bad(u.y) || bad(u.hp), u.id).toBe(false);
    }
    const botAttacks = events.filter((e) => e.type === 'attack' && e.by === 'bot');
    expect(botAttacks.length).toBeGreaterThan(50);
    expect(state.botProgress.goldBySource.lastHit).toBeGreaterThan(0);
    expect(state.botProgress.level).toBeGreaterThan(3);
    expect(events.filter((e) => e.type === 'spawn').length).toBeGreaterThan(80);
  });

  it('the bot attacks a player standing in the open lane and the player loses HP', () => {
    let s = createMatch(cfg);
    // Both in the untowered middle of the lane, within the bot's engage range.
    s = { ...s, player: { ...s.player, x: 2150, y: 700 }, bot: { ...s.bot, x: 2450, y: 700 } };
    const { state, events } = run(s, 8);
    expect(
      events.some((e) => e.type === 'attack' && e.by === 'bot' && e.targetId === s.player.id),
    ).toBe(true);
    expect(state.player.hp).toBeLessThan(s.player.maxHp);
  });

  it('a low bot walks home, heals in its base, then returns to the lane', () => {
    let s = createMatch(cfg);
    s = { ...s, bot: { ...s.bot, x: 2600, hp: s.bot.maxHp * 0.2 } };
    const nexus = cfg.map.slots.find((x) => x.kind === 'nexus' && x.team === 'red')!;
    let reachedBase = false;
    let healedInBase = false;
    let backInLane = false;
    for (let i = 0; i < 30 / DT; i++) {
      s = stepMatch(s, idle, DT, cfg).state;
      const inBase =
        Math.hypot(s.bot.x - nexus.x, s.bot.y - nexus.y) <= cfg.map.config.base.healRadius;
      if (inBase) reachedBase = true;
      if (inBase && s.bot.hp / s.bot.maxHp >= cfg.bot.returnHpFraction) healedInBase = true;
      if (healedInBase && s.brain.mode === 'lane') backInLane = true;
    }
    expect(reachedBase).toBe(true);
    expect(healedInBase).toBe(true);
    expect(backInLane).toBe(true);
  });

  it('a player last hit is held until the question is answered, then paid x the multiplier', () => {
    let s = createMatch(cfg);
    const [m] = spawnWave(0, 'red', cfg.map, econ, cfg.minions, 't');
    s = {
      ...s,
      player: { ...s.player, x: 2150, y: 700 },
      minions: [{ ...m!, x: 2230, y: 700, hp: 10 }],
    };
    const r = stepMatch(s, { move: { x: 0, y: 0 }, attack: true }, DT, cfg);
    const hit = r.events.find((e) => e.type === 'lastHit');
    expect(hit).toBeTruthy();
    expect(r.state.lastHits.infantry).toBe(1);
    // Not paid yet.
    expect(r.state.playerProgress.goldBySource.lastHit).toBe(0);
    expect(r.state.playerProgress.exp).toBe(0);
    if (hit?.type !== 'lastHit') throw new Error('no last hit');
    expect(hit.gold).toBe(econ.lastHitGold.infantry);
    expect(hit.exp).toBe(econ.exp.minion.infantry);
    // Paid on answer. On a fresh match there is almost no other income yet, so the fairness cap
    // (#28) trims the bonus: gold pays exactly x1, EXP keeps the full x1.5.
    const paid = applyLastHitReward(r.state, hit, 1.5, cfg);
    expect(paid.state.playerProgress.goldBySource.lastHit).toBe(econ.lastHitGold.infantry);
    expect(paid.capped).toBe(true);
    expect(paid.goldMultiplier).toBe(1);
    expect(paid.state.playerProgress.exp).toBe(econ.exp.minion.infantry * 1.5);
    // With other income already earned, the full x1.5 is paid.
    const later = {
      ...r.state,
      playerProgress: {
        ...r.state.playerProgress,
        goldBySource: { ...r.state.playerProgress.goldBySource, passive: 1000 },
      },
    };
    const full = applyLastHitReward(later, hit, 1.5, cfg);
    expect(full.goldMultiplier).toBe(1.5);
    expect(full.capped).toBe(false);
    expect(paid.events.some((e) => e.type === 'reward')).toBe(true);
  });

  it('a big last-hit reward can level the player up', () => {
    const s = createMatch(cfg);
    const paid = applyLastHitReward(s, { gold: 10, exp: 1000, at: { x: 0, y: 0 } }, 1, cfg);
    expect(paid.state.playerProgress.level).toBeGreaterThan(1);
    expect(paid.state.player.maxHp).toBeGreaterThan(s.player.maxHp);
    expect(paid.events.some((e) => e.type === 'levelUp')).toBe(true);
  });

  it('declares the winner when a Nexus falls and then stops producing events', () => {
    let s = createMatch(cfg);
    s = {
      ...s,
      structures: s.structures.map((x) => (x.team === 'red' ? { ...x, hp: 0, alive: false } : x)),
    };
    const r = stepMatch(s, idle, DT, cfg);
    expect(r.state.winner).toBe('blue');
    expect(r.events.some((e) => e.type === 'winner')).toBe(true);
    expect(stepMatch(r.state, idle, DT, cfg).events).toEqual([]);
  });
});

describe('shop in the match (#35)', () => {
  it('the player buys and sells while the match runs', async () => {
    const { playerBuy, playerSell } = await import('../src/systems/match');
    let s = createMatch(cfg);
    const gold = s.playerProgress.gold;
    const buy = playerBuy(s, 'training-sword', cfg);
    expect(buy.result.ok).toBe(true);
    s = buy.state;
    expect(s.playerProgress.gold).toBe(gold - 300);
    expect(s.playerItems[0]).toBe('training-sword');
    s = run(s, 1).state;
    const sell = playerSell(s, 0, cfg);
    expect(sell.result).toMatchObject({ ok: true, gold: 210 });
    expect(sell.state.playerItems[0]).toBeNull();
    expect(playerBuy(s, 'comet-spear', cfg).result).toEqual({ ok: false, reason: 'gold' });
  });
});
