/**
 * Balance simulator (#37). Pure TypeScript, no Phaser.
 *
 * Plays whole matches headless (src/systems/simulate.ts): the player side is driven by the bot
 * brain with given settings and answers each last-hit question correctly with a given
 * probability; the bot side is the real bot. Each match ends at a Nexus or at the time limit,
 * where it is judged by score (below). scripts/balance-sim.ts runs thousands and writes a CSV.
 *
 * Score at the time limit: structure damage done minus taken ("push", a destroyed tower = 1),
 * then earned gold. A side wins on score if its push is ahead by more than `pushMargin`, or
 * pushes are level and its gold is ahead by more than `goldMargin`; otherwise a draw.
 */
import botJson from '../data/bot.json';
import economyJson from '../data/economy.json';
import heroesJson from '../data/heroes.json';
import itemsJson from '../data/items.json';
import mapJson from '../data/map.json';
import minionsJson from '../data/minions.json';
import skillsJson from '../data/skills.json';
import structuresJson from '../data/structures.json';
import {
  botForTier,
  loadBotFile,
  loadHeroes,
  loadItems,
  loadMinions,
  loadSkills,
  loadStructures,
  type BotConfig,
} from './data';
import type { EconomyConfig } from './economy';
import { buildMap, type MapConfig } from './map';
import type { MatchConfig, MatchState } from './match';
import type { Progress } from './progression';
import { mathShare } from './rewards';
import { simulateMatch } from './simulate';

export const SCORE = { pushMargin: 0.05, goldMargin: 100 };

export interface MatchSummary {
  seed: number;
  accuracy: number;
  /** blue = the simulated player, red = the bot, null = draw. */
  winner: 'blue' | 'red' | null;
  decidedBy: 'nexus' | 'score';
  seconds: number;
  /** Structure damage the player did / the bot did (a destroyed tower = 1). */
  pushBlue: number;
  pushRed: number;
  towersLostBlue: number;
  towersLostRed: number;
  goldBlue: number;
  goldRed: number;
  levelBlue: number;
  levelRed: number;
  killsBlue: number;
  killsRed: number;
  questions: number;
  correct: number;
  /** Share of the player's earned gold that came from last-hit questions. */
  mathShare: number;
  /** Seconds when the player / the bot first earned super minions (#69); null = never. */
  superBlueAt: number | null;
  superRedAt: number | null;
}

const earned = (p: Progress) => Object.values(p.goldBySource).reduce((a, b) => a + b, 0);

/** Damage done to `team`'s structures, a destroyed tower or Nexus counting 1. */
function damageTo(s: MatchState, team: 'blue' | 'red'): number {
  return s.structures
    .filter((x) => x.team === team)
    .reduce((t, x) => t + (x.maxHp - x.hp) / x.maxHp, 0);
}

export function summarize(
  s: MatchState,
  seed: number,
  accuracy: number,
  questions: number,
  correct: number,
  econ: EconomyConfig,
  superAt: { blue: number | null; red: number | null } = { blue: null, red: null },
): MatchSummary {
  const pushBlue = damageTo(s, 'red');
  const pushRed = damageTo(s, 'blue');
  const goldBlue = earned(s.playerProgress);
  const goldRed = earned(s.botProgress);
  let winner: MatchSummary['winner'] = s.winner;
  if (!winner) {
    const push = pushBlue - pushRed;
    const gold = goldBlue - goldRed;
    if (Math.abs(push) > SCORE.pushMargin) winner = push > 0 ? 'blue' : 'red';
    else if (Math.abs(gold) > SCORE.goldMargin) winner = gold > 0 ? 'blue' : 'red';
  }
  const lost = (team: 'blue' | 'red') =>
    s.structures.filter((x) => x.team === team && x.kind === 'tower' && !x.alive).length;
  return {
    seed,
    accuracy,
    winner,
    decidedBy: s.winner ? 'nexus' : 'score',
    seconds: Math.round(s.now),
    pushBlue: round(pushBlue),
    pushRed: round(pushRed),
    towersLostBlue: lost('blue'),
    towersLostRed: lost('red'),
    goldBlue: Math.round(goldBlue),
    goldRed: Math.round(goldRed),
    levelBlue: s.playerProgress.level,
    levelRed: s.botProgress.level,
    killsBlue: Math.round(s.playerProgress.goldBySource.heroKill / econ.otherGold.heroKill),
    killsRed: Math.round(s.botProgress.goldBySource.heroKill / econ.otherGold.heroKill),
    questions,
    correct,
    mathShare: round(mathShare(s.playerProgress)),
    superBlueAt: superAt.blue === null ? null : Math.round(superAt.blue),
    superRedAt: superAt.red === null ? null : Math.round(superAt.red),
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The real game data, with the bot at `botTier` (or given settings). */
export function gameConfig(
  bot: BotConfig | number = 3,
  econ = economyJson as EconomyConfig,
): MatchConfig {
  const heroes = loadHeroes(heroesJson);
  return {
    econ,
    map: buildMap(mapJson as MapConfig),
    minions: loadMinions(minionsJson),
    structures: loadStructures(structuresJson),
    playerHero: heroes.heroes.find((h) => h.id === heroes.playerHero)!,
    botHero: heroes.heroes.find((h) => h.id === heroes.botHero)!,
    bot: typeof bot === 'number' ? botForTier(loadBotFile(botJson), bot) : bot,
    skills: loadSkills(skillsJson),
    items: loadItems(itemsJson),
  };
}

export interface Scenario {
  name: string;
  cfg: MatchConfig;
  /** How the simulated player plays (combat skill). */
  player: BotConfig;
  accuracy: number;
}

/** One match of a scenario. */
export function runMatch(sc: Scenario, seed: number, seconds: number): MatchSummary {
  const r = simulateMatch(sc.cfg, { accuracy: sc.accuracy, seed, seconds, player: sc.player });
  return summarize(r.state, seed, sc.accuracy, r.questions, r.correct, sc.cfg.econ, r.superAt);
}

export interface ScenarioResult {
  name: string;
  accuracy: number;
  matches: number;
  /** Player win rate, draws counting half. */
  winRate: number;
  wins: number;
  draws: number;
  losses: number;
  nexusEndings: number;
  avgSeconds: number;
  avgGoldLead: number;
  avgPushLead: number;
  avgMathShare: number;
}

export function aggregate(
  name: string,
  accuracy: number,
  rows: readonly MatchSummary[],
): ScenarioResult {
  const n = rows.length;
  const wins = rows.filter((r) => r.winner === 'blue').length;
  const draws = rows.filter((r) => r.winner === null).length;
  const avg = (f: (r: MatchSummary) => number) => round(rows.reduce((t, r) => t + f(r), 0) / n);
  return {
    name,
    accuracy,
    matches: n,
    winRate: round((wins + draws / 2) / n),
    wins,
    draws,
    losses: n - wins - draws,
    nexusEndings: rows.filter((r) => r.decidedBy === 'nexus').length,
    avgSeconds: avg((r) => r.seconds),
    avgGoldLead: avg((r) => r.goldBlue - r.goldRed),
    avgPushLead: avg((r) => r.pushBlue - r.pushRed),
    avgMathShare: avg((r) => r.mathShare),
  };
}

export const CSV_COLUMNS: (keyof MatchSummary | 'scenario')[] = [
  'scenario',
  'seed',
  'accuracy',
  'winner',
  'decidedBy',
  'seconds',
  'pushBlue',
  'pushRed',
  'towersLostBlue',
  'towersLostRed',
  'goldBlue',
  'goldRed',
  'levelBlue',
  'levelRed',
  'killsBlue',
  'killsRed',
  'questions',
  'correct',
  'mathShare',
  'superBlueAt',
  'superRedAt',
];

export function toCsvRows(name: string, rows: readonly MatchSummary[]): string[] {
  return rows.map((r) =>
    CSV_COLUMNS.map((c) => (c === 'scenario' ? name : (r[c] ?? ''))).join(','),
  );
}
