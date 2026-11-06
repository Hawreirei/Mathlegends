import { describe, expect, it } from 'vitest';
import botJson from '../src/data/bot.json';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import itemsJson from '../src/data/items.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import skillsJson from '../src/data/skills.json';
import structuresJson from '../src/data/structures.json';
import { createBrain, nextRandom, thinkBot } from '../src/systems/bot';
import {
  botForTier,
  loadBotFile,
  loadHeroes,
  loadItems,
  loadMinions,
  loadSkills,
  loadStructures,
  newPlayerBot,
} from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { buildMap, type MapConfig } from '../src/systems/map';
import { createMatch, stepMatch, type MatchConfig, type MatchState } from '../src/systems/match';
import { spawnWave } from '../src/systems/minions';
import { applyLevel } from '../src/systems/progression';
import { simulateMatch } from '../src/systems/simulate';

const econ = economyJson as EconomyConfig;
const file = loadBotFile(botJson);
const heroes = loadHeroes(heroesJson);
const map = buildMap(mapJson as MapConfig);
const cfgFor = (tier: number): MatchConfig => ({
  econ,
  map,
  minions: loadMinions(minionsJson),
  structures: loadStructures(structuresJson),
  playerHero: heroes.heroes.find((h) => h.id === heroes.playerHero)!,
  botHero: heroes.heroes.find((h) => h.id === heroes.botHero)!,
  bot: botForTier(file, tier),
  skills: loadSkills(skillsJson),
  items: loadItems(itemsJson),
});
const TIERS = [1, 2, 3, 4, 5, 6];

describe('bot.json difficulty steps (#43)', () => {
  it('has six steps, one per Year, and the Year picks the step (clamped to 1..6)', () => {
    expect(file.tiers.map((t) => t.tier)).toEqual(TIERS);
    expect(botForTier(file, 1).decisionIntervalSec).toBe(file.tiers[0]!.decisionIntervalSec);
    expect(botForTier(file, 9)).toEqual(botForTier(file, 6));
    expect(botForTier(file, 0)).toEqual(botForTier(file, 1));
    expect(botForTier(file, 3).towerSafetyMarginPx).toBe(file.base.towerSafetyMarginPx);
  });

  it('gets harder every Year: faster reactions, surer last hits, more skills, earlier items, bolder', () => {
    const b = TIERS.map((t) => botForTier(file, t));
    for (let i = 1; i < 6; i++) {
      expect(b[i]!.decisionIntervalSec).toBeLessThan(b[i - 1]!.decisionIntervalSec);
      expect(b[i]!.lastHitAccuracy).toBeGreaterThan(b[i - 1]!.lastHitAccuracy);
      expect(b[i]!.skillUseChance).toBeGreaterThan(b[i - 1]!.skillUseChance);
      expect(b[i]!.itemDelaySec).toBeLessThan(b[i - 1]!.itemDelaySec);
      expect(b[i]!.engageRange).toBeGreaterThan(b[i - 1]!.engageRange);
    }
  });

  it('rejects a step whose return threshold is below its retreat threshold', () => {
    const bad = structuredClone(botJson);
    bad.tiers[2]!.retreatHpFraction = 0.9;
    expect(() => loadBotFile(bad)).toThrow(/returnHpFraction/);
  });
});

/** A quiet lane: bot at x, player far away and harmless, towers silent. */
function lane(
  tier: number,
  botX = 2600,
  level = 1,
  silentTowers = true,
): { s: MatchState; cfg: MatchConfig } {
  const cfg = cfgFor(tier);
  const s0 = createMatch(cfg, 5);
  const y = map.heroSpawn.red.y;
  return {
    cfg,
    s: {
      ...s0,
      bot: { ...applyLevel({ ...s0.bot, x: botX, y }, cfg.botHero, level), mana: 999 },
      player: { ...s0.player, x: botX - 300, y, atk: 1 },
      structures: silentTowers
        ? s0.structures.map((t) => ({ ...t, nextAttackAt: 1e9 }))
        : s0.structures,
    },
  };
}

describe('bot behaviour (#43)', () => {
  it('uses its skills', () => {
    const { s, cfg } = lane(6, 2600, 4);
    let st = s;
    const casts = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const r = stepMatch(st, { move: { x: 0, y: 0 }, attack: false }, 0.05, cfg);
      st = r.state;
      for (const e of r.events) if (e.type === 'skill' && e.by === 'bot') casts.add(e.skillId);
    }
    expect(casts.size).toBeGreaterThanOrEqual(2);
  });

  it('buys its build order, a Year 1 bot much later than a Year 6 bot', () => {
    const boughtAt = (tier: number) => {
      const { s, cfg } = lane(tier, 3600, 1, false);
      let st = { ...s, botProgress: { ...s.botProgress, gold: 5000 } };
      for (let i = 0; i < 6000 && !st.winner; i++) {
        st = stepMatch(st, { move: { x: 0, y: 0 }, attack: false }, 0.05, cfg).state;
        if (st.botItems[0]) return { at: st.now, item: st.botItems[0], atk: st.bot.atk };
      }
      return null;
    };
    const y1 = boughtAt(1)!;
    const y6 = boughtAt(6)!;
    expect(y1.item).toBe(file.buildOrder[0]);
    expect(y6.at).toBeCloseTo(botForTier(file, 6).itemDelaySec, 0);
    expect(y1.at).toBeCloseTo(botForTier(file, 1).itemDelaySec, 0);
  });

  it("bought items change the bot's stats", () => {
    const { s, cfg } = lane(6, 3600);
    let st = { ...s, botProgress: { ...s.botProgress, gold: 5000 } };
    const armor = st.bot.armor;
    for (let i = 0; i < 200; i++)
      st = stepMatch(st, { move: { x: 0, y: 0 }, attack: false }, 0.05, cfg).state;
    expect(st.botItems.filter(Boolean).length).toBeGreaterThan(1);
    expect(st.bot.armor).toBeGreaterThan(armor);
  });

  it('last-hit accuracy: a sure bot always takes the kill, a 0% bot never does', () => {
    const { s, cfg } = lane(3);
    const minion = {
      ...spawnWave(1, 'blue', map, econ, cfg.minions, 't')[0]!,
      id: 'weak',
      x: s.bot.x - 80,
      y: s.bot.y,
      hp: 1,
    };
    const world = {
      bot: s.bot,
      player: s.player,
      minions: [minion],
      structures: s.structures,
      map,
    };
    for (let seed = 1; seed < 30; seed++) {
      const sure = thinkBot(createBrain(seed), world, 1, { ...cfg.bot, lastHitAccuracy: 1 }, econ);
      const never = thinkBot(createBrain(seed), world, 1, { ...cfg.bot, lastHitAccuracy: 0 }, econ);
      expect(sure.targetId).toBe('weak');
      expect(never.targetId).not.toBe('weak');
    }
  });

  it('the same seed gives the same decisions', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
    expect(nextRandom(42).value).not.toBe(nextRandom(43).value);
    const a = simulateMatch(cfgFor(4), {
      accuracy: 0.6,
      seed: 9,
      seconds: 120,
      player: newPlayerBot(file),
    });
    const b = simulateMatch(cfgFor(4), {
      accuracy: 0.6,
      seed: 9,
      seconds: 120,
      player: newPlayerBot(file),
    });
    expect(a.state.botProgress).toEqual(b.state.botProgress);
  });
});

describe('difficulty in simulated 10-minute matches (#43)', () => {
  /**
   * The new player (60% correct answers) against each Year's bot, 12 matches each. (6 was too
   * few once minions grew with time, #68: neighbouring Years swapped places on noise alone.)
   */
  const results = TIERS.map((tier) => {
    let push = 0;
    let gold = 0;
    const seeds = Array.from({ length: 12 }, (_, i) => i + 1);
    for (const seed of seeds) {
      const s = simulateMatch(cfgFor(tier), {
        accuracy: 0.6,
        seed,
        seconds: 600,
        player: newPlayerBot(file),
      }).state;
      // Structure damage done minus taken (a destroyed tower counts 1).
      const dmg = (team: string) =>
        s.structures
          .filter((x) => x.team === team)
          .reduce((t, x) => t + (x.maxHp - x.hp) / x.maxHp, 0);
      const earned = (p: typeof s.playerProgress) =>
        Object.values(p.goldBySource).reduce((a, b) => a + b, 0);
      push += dmg('red') - dmg('blue');
      gold += earned(s.playerProgress) - earned(s.botProgress);
    }
    return { tier, push: push / seeds.length, gold: gold / seeds.length };
  });

  it('Year 1 bot is beatable by a new player: they push harder and earn more', () => {
    expect(results[0]!.push).toBeGreaterThan(0.2);
    expect(results[0]!.gold).toBeGreaterThan(150);
  });

  it('Year 6 bot is a real challenge: the new player falls behind', () => {
    expect(results[5]!.push).toBeLessThan(-0.2);
    expect(results[5]!.gold).toBeLessThan(-150);
  });

  it("the new player's gold lead shrinks Year by Year", () => {
    for (let i = 1; i < 6; i++)
      expect(results[i]!.gold, `Year ${i + 1}`).toBeLessThan(results[i - 1]!.gold);
  });
});
