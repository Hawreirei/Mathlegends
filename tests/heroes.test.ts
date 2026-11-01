import { describe, expect, it } from 'vitest';
import botJson from '../src/data/bot.json';
import economyJson from '../src/data/economy.json';
import heroesJson from '../src/data/heroes.json';
import mapJson from '../src/data/map.json';
import minionsJson from '../src/data/minions.json';
import structuresJson from '../src/data/structures.json';
import { readTheme, renderSprites } from '../scripts/build-sprites';
import {
  DataError,
  loadBot,
  loadHeroes,
  loadMinions,
  loadStructures,
  type Hero,
} from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import { buildMap, type MapConfig } from '../src/systems/map';
import { createMatch, stepMatch, type MatchConfig } from '../src/systems/match';

const file = loadHeroes(heroesJson);
const byId = (id: string | undefined) => file.heroes.find((h) => h.id === id)!;
const player = byId(file.playerHero);
const bot = byId(file.botHero);

/** Damage output x effective health at a level: equal values mean an even 1v1. */
function power(h: Hero, level: number): number {
  const l = level - 1;
  const atk = h.base.atk + h.growth.atk * l;
  const hp = h.base.hp + h.growth.hp * l;
  const armor = h.base.armor + h.growth.armor * l;
  return atk * h.base.attackSpeed * hp * (1 + armor / 100);
}

describe('the heroes (#32)', () => {
  it('heroes.json has the player hero and the bot hero, both Fighters', () => {
    expect(player.id).toBe('nova');
    expect(bot.id).toBe('mira');
    expect(player.role).toBe('fighter');
    expect(bot.role).toBe('fighter');
    expect(player.look.color).toBe('blue');
    expect(bot.look.color).toBe('red');
  });

  it('have a name, title and lore in both languages', () => {
    for (const h of [player, bot])
      for (const f of [h.name, h.title, h.lore]) {
        expect(f.id.trim().length).toBeGreaterThan(0);
        expect(f.en.trim().length).toBeGreaterThan(0);
      }
    expect(player.lore.en.length).toBeGreaterThan(60);
  });

  it('are balanced: within 1% of each other at every level from 1 to 15', () => {
    for (let level = 1; level <= 15; level++) {
      const ratio = power(bot, level) / power(player, level);
      expect(Math.abs(ratio - 1), `level ${level}`).toBeLessThan(0.01);
    }
    // ...but not copies: different stat shapes.
    expect(bot.base).not.toEqual(player.base);
  });

  it('use original names, not heroes from well-known MOBA games', () => {
    // A guard against accidental reuse (AGENTS.md rule 5); not a full trademark check (#60).
    const taken = [
      'miya',
      'layla',
      'alucard',
      'zilong',
      'nana',
      'tigreal',
      'balmond',
      'saber',
      'alice',
      'eudora',
      'franco',
      'bruno',
      'clint',
      'lancelot',
      'fanny',
      'gusion',
      'kagura',
      'chou',
      'harith',
      'lunox',
      'ling',
      'valir',
      'lesley',
      'hanabi',
      'estes',
      'rafaela',
      'aurora',
      'cyclops',
      'gord',
      'moskov',
      'karrie',
      'irithel',
      'odette',
      'lylia',
      'angela',
    ];
    for (const h of file.heroes) expect(taken).not.toContain(h.name.en.toLowerCase());
  });
});

describe('adding a hero needs JSON only (#32)', () => {
  const zara = {
    ...heroesJson.heroes[0]!,
    id: 'zara',
    name: { id: 'Zara', en: 'Zara' },
    title: { id: 'Penjaga Bulan', en: 'Moon Warden' },
    look: { color: 'blue', emblem: 'moon' },
    sprite: 'hero-zara',
  };
  const withZara = { ...heroesJson, playerHero: 'zara', heroes: [...heroesJson.heroes, zara] };

  it('loads, and the sprite script draws its token from look', () => {
    const loaded = loadHeroes(withZara);
    expect(loaded.heroes.map((h) => h.id)).toContain('zara');
    const sprites = renderSprites(readTheme(), loaded);
    expect(sprites.get('hero-zara')).toContain('<svg');
    expect(sprites.get('hero-zara')).not.toBe(sprites.get('hero-nova'));
    for (const emblem of ['sparkle', 'flower', 'moon', 'leaf'])
      expect(
        renderSprites(readTheme(), {
          heroes: [{ sprite: 'x', look: { color: 'red', emblem } }],
        }).get('x'),
      ).toContain('<svg');
  });

  it('plays a match as the player hero with its own stats', () => {
    const loaded = loadHeroes(withZara);
    const cfg: MatchConfig = {
      econ: economyJson as EconomyConfig,
      map: buildMap(mapJson as MapConfig),
      minions: loadMinions(minionsJson),
      structures: loadStructures(structuresJson),
      playerHero: loaded.heroes.find((h) => h.id === loaded.playerHero)!,
      botHero: loaded.heroes.find((h) => h.id === loaded.botHero)!,
      bot: loadBot(botJson),
    };
    let s = createMatch(cfg);
    expect(s.player.heroId ?? s.player.id).toBeTruthy();
    expect(s.player.maxHp).toBe(zara.base.hp);
    for (let i = 0; i < 60; i++)
      s = stepMatch(s, { move: { x: 1, y: 0 }, attack: true }, 0.1, cfg).state;
    expect(s.now).toBeCloseTo(6);
  });

  it('rejects a sprite name that does not match the id', () => {
    expect(() =>
      loadHeroes({ ...withZara, heroes: [...heroesJson.heroes, { ...zara, sprite: 'zara' }] }),
    ).toThrow(DataError);
  });
});
