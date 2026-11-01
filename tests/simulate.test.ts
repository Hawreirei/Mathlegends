import { describe, expect, it } from 'vitest';
import botJson from '../src/data/bot.json';
import skillsJson from '../src/data/skills.json';
import itemsJson from '../src/data/items.json';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import structuresJson from '../src/data/structures.json';
import {
  loadBot,
  loadSkills,
  loadItems,
  loadHeroes,
  loadMinions,
  loadStructures,
} from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { buildMap, type MapConfig } from '../src/systems/map';
import type { MatchConfig } from '../src/systems/match';
import { simulateMatch } from '../src/systems/simulate';

const heroes = loadHeroes(heroesJson);
const base = (econ: EconomyConfig): MatchConfig => ({
  econ,
  map: buildMap(mapJson as MapConfig),
  minions: loadMinions(minionsJson),
  structures: loadStructures(structuresJson),
  playerHero: heroes.heroes.find((h) => h.id === heroes.playerHero)!,
  botHero: heroes.heroes.find((h) => h.id === heroes.botHero)!,
  bot: loadBot(botJson),
  skills: loadSkills(skillsJson),
  items: loadItems(itemsJson),
});
const econ = economyJson as EconomyConfig;
const cap = econ.fairness.mathShareCap;

describe('math share in simulated 10-minute matches (#28)', () => {
  const runs = [0.3, 0.7, 1].map((accuracy) => ({
    accuracy,
    r: simulateMatch(base(econ), { accuracy, seed: 3, seconds: 600 }),
  }));

  it(`stays under the ${cap * 100}% cap at every accuracy (after the first 2 minutes)`, () => {
    for (const { accuracy, r } of runs) {
      expect(r.questions, `accuracy ${accuracy}`).toBeGreaterThan(10);
      expect(r.maxShareAfterSettle, `accuracy ${accuracy}`).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it('rewards accuracy: a higher accuracy earns a higher math share', () => {
    expect(runs[0]!.r.finalShare).toBeLessThan(runs[1]!.r.finalShare);
    expect(runs[1]!.r.finalShare).toBeLessThan(runs[2]!.r.finalShare);
  });

  it('when last-hit gold is set too high, the cap trims the bonus (the x1 guarantee keeps correct >= plain reward)', () => {
    const rich = structuredClone(econ);
    rich.lastHitGold = { infantry: 42, lancer: 72, cannon: 135 };
    const capped = simulateMatch(base(rich), { accuracy: 1, seed: 3, seconds: 600 });
    const noCap = structuredClone(rich);
    noCap.fairness.mathShareCap = 0.99;
    const uncapped = simulateMatch(base(noCap), { accuracy: 1, seed: 3, seconds: 600 });
    expect(capped.correctCapped).toBeGreaterThan(0);
    expect(capped.finalShare).toBeLessThan(uncapped.finalShare);
  });
});
