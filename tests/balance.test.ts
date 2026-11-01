import { describe, expect, it } from 'vitest';
import botJson from '../src/data/bot.json';
import structuresJson from '../src/data/structures.json';
import {
  aggregate,
  CSV_COLUMNS,
  gameConfig,
  runMatch,
  summarize,
  toCsvRows,
  type MatchSummary,
} from '../src/systems/balanceSim';
import { loadBotFile, loadStructures, newPlayerBot } from '../src/systems/data';
import { createMatch, suddenDeathMultiplier } from '../src/systems/match';
import { winner } from '../src/systems/structures';

const file = loadBotFile(botJson);
const SECONDS = 1200;
const mirror = gameConfig(3);
const runs = (n: number, accuracy: number, cfg = mirror, player = mirror.bot) =>
  Array.from({ length: n }, (_, i) =>
    runMatch({ name: 't', cfg, player, accuracy }, i + 1, SECONDS),
  );

describe('sudden death (#37)', () => {
  const sd = loadStructures(structuresJson).suddenDeath;
  it('is configured in structures.json', () => {
    expect(sd).toMatchObject({ enabled: true, afterSec: 420 });
  });

  it('structures take x1 before it, then +1x per minute', () => {
    expect(suddenDeathMultiplier(sd.afterSec - 1, mirror)).toBe(1);
    expect(suddenDeathMultiplier(sd.afterSec + 60, mirror)).toBeCloseTo(
      1 + sd.extraDamagePerMinute,
    );
    const off = {
      ...mirror,
      structures: { ...mirror.structures, suddenDeath: { ...sd, enabled: false } },
    };
    expect(suddenDeathMultiplier(sd.afterSec + 600, off)).toBe(1);
  });

  it('if both Nexus fall in the same step, the side ahead on score wins', () => {
    const s = createMatch(mirror);
    const both = s.structures.map((x) => (x.kind === 'nexus' ? { ...x, hp: 0, alive: false } : x));
    expect(winner(both, (t) => (t === 'red' ? 2 : 1))).toBe('red');
    expect(winner(both, (t) => (t === 'blue' ? 2 : 1))).toBe('blue');
    const one = s.structures.map((x) =>
      x.kind === 'nexus' && x.team === 'red' ? { ...x, alive: false } : x,
    );
    expect(winner(one)).toBe('blue');
  });
});

describe('balance in simulated matches (#37)', () => {
  // Equal combat skill (both play like the Year 3 bot). 50% right answers = the bot's economy.
  const even = runs(40, 0.5);
  const weak = runs(40, 0.3);
  const strong = runs(40, 0.9);
  const all = [...even, ...weak, ...strong];

  it('every match ends at a Nexus, within about 8 to 11 minutes', () => {
    for (const r of all) {
      expect(r.decidedBy).toBe('nexus');
      expect(r.seconds).toBeGreaterThanOrEqual(480);
      expect(r.seconds).toBeLessThanOrEqual(660);
    }
  });

  it('a mirror match stays near 50% at equal accuracy', () => {
    const w = aggregate('even', 0.5, even).winRate;
    expect(w).toBeGreaterThanOrEqual(0.35);
    expect(w).toBeLessThanOrEqual(0.65);
  });

  it('math skill is a modest edge, not decisive, at equal combat skill', () => {
    const lo = aggregate('weak', 0.3, weak).winRate;
    const hi = aggregate('strong', 0.9, strong).winRate;
    expect(hi).toBeGreaterThan(lo); // it matters...
    expect(hi - lo).toBeLessThanOrEqual(0.5); // ...but a 90% player does not simply win
    expect(hi).toBeLessThanOrEqual(0.8);
    expect(lo).toBeGreaterThanOrEqual(0.1);
  });

  it('the bot Year still decides how hard it is (#43)', { timeout: 60_000 }, () => {
    const y1 = aggregate('y1', 0.6, runs(20, 0.6, gameConfig(1), newPlayerBot(file))).winRate;
    const y6 = aggregate('y6', 0.6, runs(20, 0.6, gameConfig(6), newPlayerBot(file))).winRate;
    expect(y1).toBeGreaterThanOrEqual(0.75);
    expect(y6).toBeLessThanOrEqual(0.35);
  });

  it('writes one CSV row per match with the documented columns', () => {
    const rows = toCsvRows('even', even.slice(0, 3));
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.split(',')).toHaveLength(CSV_COLUMNS.length);
    expect(rows[0]!.startsWith('even,1,0.5,')).toBe(true);
  });

  it('judges a match that hits the time limit by push, then gold', () => {
    const s = createMatch(mirror);
    const pushed = {
      ...s,
      structures: s.structures.map((x) =>
        x.team === 'red' && x.kind === 'tower' ? { ...x, hp: x.maxHp / 2 } : x,
      ),
    };
    const r: MatchSummary = summarize(pushed, 1, 0.5, 0, 0, mirror.econ);
    expect(r).toMatchObject({ winner: 'blue', decidedBy: 'score' });
    expect(summarize(s, 1, 0.5, 0, 0, mirror.econ).winner).toBeNull();
  });
});
