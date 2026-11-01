/**
 * One match, as pure data and rules (#24). No Phaser: MatchScene feeds player input in and draws
 * the events that come out; tests and the balance simulator (#37) run whole matches headless.
 *
 * Order of one step: player moves and attacks; the bot thinks, moves and attacks; due minion
 * waves spawn; minions step (they may hit minions, structures and heroes); towers shoot;
 * gold ticks; heroes regenerate, heal in their base and respawn; the winner is checked.
 */
import { botMoveDir, createBrain, thinkBot, type BotBrain } from './bot';
import { canAttack, nearestEnemyInRange, regenerate, resolveAttack, tickRespawn } from './combat';
import type { BotConfig, Hero, MinionsFile, StructuresFile } from './data';
import type { EconomyConfig, MinionType } from './economy';
import { createHeroState, moveHero, walkableArea, type HeroState, type Rect } from './hero';
import type { LaneMap, Point, Team } from './map';
import { spawnWave, stepMinions, wavesDue, type MinionState } from './minions';
import {
  addExp,
  addGold,
  applyLevel,
  createProgress,
  killRewards,
  tickPassiveGold,
  type Progress,
  type Victim,
} from './progression';
import {
  createStructures,
  isTargetable,
  stepTowers,
  winner,
  type StructureState,
} from './structures';

export interface MatchConfig {
  econ: EconomyConfig;
  map: LaneMap;
  minions: MinionsFile;
  structures: StructuresFile;
  playerHero: Hero;
  botHero: Hero;
  bot: BotConfig;
}

export type Unit = HeroState | MinionState | StructureState;

export interface MatchState {
  /** Match time in seconds. */
  now: number;
  player: HeroState;
  bot: HeroState;
  playerProgress: Progress;
  botProgress: Progress;
  minions: MinionState[];
  structures: StructureState[];
  /** Player last hits by minion type (#27 questions, #30 logging). */
  lastHits: Record<MinionType, number>;
  brain: BotBrain;
  winner: Team | null;
}

export interface MatchInput {
  /** Joystick or keys; length 0..1. */
  move: Point;
  /** True while the player wants to attack (held, or a buffered press). */
  attack: boolean;
}

export type MatchEvent =
  | { type: 'spawn'; minion: MinionState }
  | {
      type: 'attack';
      by: 'player' | 'bot' | 'minion' | 'tower';
      attackerId: string;
      targetId: string;
      from: Point;
      to: Point;
      damage: number;
      killed: boolean;
      /** For minion shots: the attacker's type. */
      minionKind?: MinionType;
      team: Team;
    }
  | { type: 'reward'; heroId: string; gold: number; exp: number; at: Point }
  | { type: 'levelUp'; heroId: string; level: number }
  | {
      /**
       * The player landed a last hit. Its gold and EXP are NOT paid yet: the question overlay
       * (#27) asks a question and pays them through applyLastHitReward x the answer multiplier.
       */
      type: 'lastHit';
      kind: MinionType;
      minionId: string;
      gold: number;
      exp: number;
      at: Point;
    }
  | { type: 'winner'; team: Team };

export function createMatch(cfg: MatchConfig): MatchState {
  return {
    now: 0,
    player: createHeroState(cfg.playerHero, cfg.map.heroSpawn.blue, 'blue'),
    bot: createHeroState(cfg.botHero, cfg.map.heroSpawn.red, 'red'),
    playerProgress: createProgress(cfg.econ),
    botProgress: createProgress(cfg.econ),
    minions: [],
    structures: createStructures(cfg.map, cfg.structures),
    lastHits: { infantry: 0, lancer: 0, cannon: 0 },
    brain: createBrain(),
    winner: null,
  };
}

const areaCache = new WeakMap<LaneMap, Rect>();
const areaOf = (map: LaneMap) => {
  let a = areaCache.get(map);
  if (!a) {
    a = walkableArea(map);
    areaCache.set(map, a);
  }
  return a;
};

function victimOf(u: Unit): Victim {
  if ('heroId' in u) return { kind: 'hero', team: u.team, x: u.x, y: u.y };
  if (u.kind === 'tower' || u.kind === 'nexus')
    return { kind: u.kind, team: u.team, x: u.x, y: u.y };
  return { kind: 'minion', minionKind: u.kind, team: u.team, x: u.x, y: u.y };
}

/** Mutable working copy used inside one step. */
interface Work extends MatchState {
  events: MatchEvent[];
}

/** Gold, EXP and level-ups for a death (rules in progression.ts). */
function grantKill(w: Work, victim: Unit, killerId: string, cfg: MatchConfig): void {
  const v = victimOf(victim);
  let held: { gold: number; exp: number } | null = null;
  for (const r of killRewards(v, killerId, [w.player, w.bot], cfg.econ)) {
    const isPlayer = r.heroId === w.player.id;
    // The player's own last-hit reward waits for the question (#27).
    if (isPlayer && r.source === 'lastHit') {
      held = { gold: r.gold, exp: r.exp };
      continue;
    }
    let p = isPlayer ? w.playerProgress : w.botProgress;
    if (r.gold > 0) p = addGold(p, r.gold, r.source === 'shareExp' ? 'lastHit' : r.source);
    const x = addExp(p, r.exp, cfg.econ);
    p = x.progress;
    if (isPlayer) w.playerProgress = p;
    else w.botProgress = p;
    w.events.push({
      type: 'reward',
      heroId: r.heroId,
      gold: r.gold,
      exp: r.exp,
      at: { x: v.x, y: v.y },
    });
    if (x.levelsGained > 0) {
      if (isPlayer) w.player = applyLevel(w.player, cfg.playerHero, p.level);
      else w.bot = applyLevel(w.bot, cfg.botHero, p.level);
      w.events.push({ type: 'levelUp', heroId: r.heroId, level: p.level });
    }
  }
  if (killerId === w.player.id && v.kind === 'minion' && v.minionKind) {
    w.lastHits = { ...w.lastHits, [v.minionKind]: w.lastHits[v.minionKind] + 1 };
    w.events.push({
      type: 'lastHit',
      kind: v.minionKind,
      minionId: victim.id,
      gold: held?.gold ?? 0,
      exp: held?.exp ?? 0,
      at: { x: v.x, y: v.y },
    });
  }
}

/** A hero hits `target` (already checked to be in range); writes the result back into the work state. */
function heroHits(w: Work, who: 'player' | 'bot', target: Unit, cfg: MatchConfig): void {
  const attacker = who === 'player' ? w.player : w.bot;
  const r = resolveAttack(attacker, target, w.now, cfg.econ);
  if (who === 'player') w.player = r.attacker;
  else w.bot = r.attacker;
  if (target.id === w.player.id) w.player = r.target as HeroState;
  else if (target.id === w.bot.id) w.bot = r.target as HeroState;
  else if (w.structures.some((s) => s.id === target.id)) {
    const s = { ...(r.target as StructureState), respawnAt: null };
    w.structures = w.structures.map((x) => (x.id === s.id ? s : x));
  } else {
    const m = r.target as MinionState;
    w.minions = r.killed
      ? w.minions.filter((x) => x.id !== m.id)
      : w.minions.map((x) => (x.id === m.id ? m : x));
  }
  w.events.push({
    type: 'attack',
    by: who,
    attackerId: attacker.id,
    targetId: target.id,
    from: { x: attacker.x, y: attacker.y },
    to: { x: target.x, y: target.y },
    damage: r.damage,
    killed: r.killed,
    team: attacker.team,
  });
  if (r.killed) grantKill(w, target, attacker.id, cfg);
}

function inOwnBase(h: HeroState, map: LaneMap): boolean {
  const nexus = map.slots.find((s) => s.kind === 'nexus' && s.team === h.team)!;
  return Math.hypot(h.x - nexus.x, h.y - nexus.y) <= map.config.base.healRadius;
}

export function stepMatch(
  state: MatchState,
  input: MatchInput,
  dt: number,
  cfg: MatchConfig,
): { state: MatchState; events: MatchEvent[] } {
  // A finished match only lets the clock run (the scene shows the collapse, then the result).
  if (state.winner) return { state: { ...state, now: state.now + dt }, events: [] };
  const prevNow = state.now;
  const w: Work = { ...state, now: state.now + dt, events: [] };
  const area = areaOf(cfg.map);
  const now = w.now;

  // 1. Player.
  if (w.player.alive) {
    w.player = moveHero(w.player, input.move, dt, area);
    if (input.attack && canAttack(w.player, now)) {
      const structures = w.structures.filter((s) => isTargetable(s, w.structures));
      const target = nearestEnemyInRange<Unit>(w.player, [w.bot, ...w.minions, ...structures]);
      if (target) heroHits(w, 'player', target, cfg);
    }
  }

  // 2. Bot.
  w.brain = thinkBot(
    w.brain,
    { bot: w.bot, player: w.player, minions: w.minions, structures: w.structures, map: cfg.map },
    now,
    cfg.bot,
    cfg.econ,
  );
  if (w.bot.alive) {
    w.bot = moveHero(w.bot, botMoveDir(w.brain, w.bot), dt, area);
    const target: Unit | undefined =
      w.brain.targetId === w.player.id
        ? w.player
        : w.minions.find((m) => m.id === w.brain.targetId);
    if (
      target &&
      target.alive &&
      canAttack(w.bot, now) &&
      Math.hypot(target.x - w.bot.x, target.y - w.bot.y) <= w.bot.attackRange
    )
      heroHits(w, 'bot', target, cfg);
  }

  // 3. Waves.
  for (const n of wavesDue(prevNow, now, cfg.econ))
    for (const team of ['blue', 'red'] as const)
      for (const m of spawnWave(n, team, cfg.map, cfg.econ, cfg.minions, `w${n}`)) {
        w.minions.push(m);
        w.events.push({ type: 'spawn', minion: m });
      }

  // 4. Minions, then towers. Victims are looked up in the snapshot taken before each step.
  const units = () =>
    new Map<string, Unit>([
      ...w.minions.map((m) => [m.id, m] as const),
      ...w.structures.map((s) => [s.id, s] as const),
      [w.player.id, w.player],
      [w.bot.id, w.bot],
    ]);
  let before = units();
  const ms = stepMinions(
    w.minions,
    [w.player, w.bot],
    dt,
    now,
    cfg.econ,
    cfg.map,
    w.structures,
    cfg.minions.heroBodyRadius,
  );
  w.minions = ms.minions;
  w.structures = ms.structures;
  [w.player, w.bot] = ms.heroes as [HeroState, HeroState];
  for (const e of ms.events) {
    const attacker = before.get(e.attackerId) as MinionState | undefined;
    const target = before.get(e.targetId);
    if (!attacker || !target) continue;
    w.events.push({
      type: 'attack',
      by: 'minion',
      attackerId: e.attackerId,
      targetId: e.targetId,
      from: { x: e.x, y: e.y },
      to: { x: target.x, y: target.y },
      damage: e.damage,
      killed: e.killed,
      minionKind: attacker.kind,
      team: attacker.team,
    });
    if (e.killed) grantKill(w, target, e.attackerId, cfg);
  }

  before = units();
  const ts = stepTowers(w.structures, w.minions, [w.player, w.bot], now, cfg.econ);
  w.structures = ts.structures;
  w.minions = ts.minions;
  [w.player, w.bot] = ts.heroes as [HeroState, HeroState];
  for (const e of ts.events) {
    const target = before.get(e.targetId);
    const tower = w.structures.find((s) => s.id === e.attackerId)!;
    if (!target) continue;
    w.events.push({
      type: 'attack',
      by: 'tower',
      attackerId: e.attackerId,
      targetId: e.targetId,
      from: { x: e.x, y: e.y },
      to: { x: target.x, y: target.y },
      damage: e.damage,
      killed: e.killed,
      team: tower.team,
    });
    if (e.killed) grantKill(w, target, e.attackerId, cfg);
  }

  // 5. Gold, healing, respawn.
  w.playerProgress = tickPassiveGold(w.playerProgress, dt, cfg.econ);
  w.botProgress = tickPassiveGold(w.botProgress, dt, cfg.econ);
  const heal = (h: HeroState): HeroState => {
    let x = regenerate(h, dt);
    if (x.alive && inOwnBase(x, cfg.map))
      x = {
        ...x,
        hp: Math.min(x.maxHp, x.hp + x.maxHp * cfg.map.config.base.healFractionPerSec * dt),
      };
    return tickRespawn(x, now, cfg.map.heroSpawn[h.team]);
  };
  w.player = heal(w.player);
  w.bot = heal(w.bot);

  // 6. Winner.
  const win = winner(w.structures);
  if (win) {
    w.winner = win;
    w.events.push({ type: 'winner', team: win });
  }

  const { events, ...rest } = w;
  return { state: rest, events };
}

/**
 * Pays a held last-hit reward x the answer multiplier (#27, #28): gold counted as 'lastHit'
 * (math income), EXP with level-ups. Returns the new state and the reward/level-up events.
 */
export function applyLastHitReward(
  state: MatchState,
  base: { gold: number; exp: number; at: Point },
  multiplier: number,
  cfg: MatchConfig,
): { state: MatchState; events: MatchEvent[] } {
  const gold = base.gold * multiplier;
  const exp = base.exp * multiplier;
  const events: MatchEvent[] = [];
  let p = addGold(state.playerProgress, gold, 'lastHit');
  const x = addExp(p, exp, cfg.econ);
  p = x.progress;
  let player = state.player;
  events.push({ type: 'reward', heroId: player.id, gold, exp, at: base.at });
  if (x.levelsGained > 0) {
    player = applyLevel(player, cfg.playerHero, p.level);
    events.push({ type: 'levelUp', heroId: player.id, level: p.level });
  }
  return { state: { ...state, player, playerProgress: p }, events };
}
