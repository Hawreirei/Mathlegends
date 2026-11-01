/**
 * Basic bot brain (#24). Pure TypeScript, no Phaser. A small state machine:
 *
 * - lane:    stand just behind the front friendly minion (or behind its own outer tower when
 *            no minions are out), last-hit minions it can finish in one blow, otherwise hit the
 *            weakest enemy minion in reach, and fight the player when close and healthy;
 * - retreat: below retreatHpFraction walk home and heal; return at returnHpFraction.
 *
 * It never walks into an enemy tower's range unless a friendly minion is already there to
 * take the tower's shots. Every threshold comes from src/data/bot.json.
 */
import type { BotConfig } from './data';
import { damage, type EconomyConfig } from './economy';
import type { HeroState } from './hero';
import type { LaneMap, Point, Team } from './map';
import type { MinionState } from './minions';
import type { StructureState } from './structures';

export interface BotBrain {
  mode: 'lane' | 'retreat';
  nextDecisionAt: number;
  targetId: string | null;
  moveTo: Point | null;
}

export interface BotWorld {
  bot: HeroState;
  player: HeroState;
  minions: readonly MinionState[];
  structures: readonly StructureState[];
  map: LaneMap;
}

export const createBrain = (): BotBrain => ({
  mode: 'lane',
  nextDecisionAt: 0,
  targetId: null,
  moveTo: null,
});

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const forward = (team: Team) => (team === 'blue' ? 1 : -1);

/** A point is unsafe for `team` if an enemy tower covers it and no friendly minion is under that tower. */
export function isUnsafe(p: Point, team: Team, w: BotWorld, margin: number): boolean {
  for (const t of w.structures) {
    if (t.kind !== 'tower' || !t.alive || t.team === team) continue;
    if (dist(p, t) > t.attackRange + margin) continue;
    const covered = w.minions.some(
      (m) => m.alive && m.team === team && dist(m, t) <= t.attackRange,
    );
    if (!covered) return true;
  }
  return false;
}

/** Walk `p` back towards the bot's own base until it is safe. */
function makeSafe(p: Point, team: Team, w: BotWorld, margin: number): Point {
  const step = -forward(team) * 40;
  let q = { ...p };
  for (let i = 0; i < 120 && isUnsafe(q, team, w, margin); i++) q = { x: q.x + step, y: q.y };
  return q;
}

/** Where the bot stands when it has nothing to hit. */
function laneAnchor(w: BotWorld, cfg: BotConfig): Point {
  const { bot } = w;
  const fwd = forward(bot.team);
  const friends = w.minions.filter((m) => m.alive && m.team === bot.team);
  if (friends.length) {
    const front = friends.reduce((a, b) => (fwd * b.x > fwd * a.x ? b : a));
    return { x: front.x - fwd * cfg.holdBackPx, y: front.y };
  }
  const towers = w.structures.filter((s) => s.kind === 'tower' && s.alive && s.team === bot.team);
  if (towers.length) {
    const outer = towers.reduce((a, b) => (fwd * b.x > fwd * a.x ? b : a));
    return { x: outer.x - fwd * 150, y: outer.y };
  }
  return w.map.heroSpawn[bot.team];
}

/** Decides what the bot wants. Re-thinks only every decisionIntervalSec (its reaction time). */
export function thinkBot(
  brain: BotBrain,
  w: BotWorld,
  now: number,
  cfg: BotConfig,
  econ: EconomyConfig,
): BotBrain {
  const { bot, player } = w;
  if (!bot.alive) return { ...createBrain(), nextDecisionAt: now };
  if (now < brain.nextDecisionAt) return brain;
  const next = now + cfg.decisionIntervalSec;
  const hpFrac = bot.hp / bot.maxHp;

  let mode = brain.mode;
  if (hpFrac < cfg.retreatHpFraction) mode = 'retreat';
  else if (mode === 'retreat' && hpFrac >= cfg.returnHpFraction) mode = 'lane';
  if (mode === 'retreat')
    return { mode, nextDecisionAt: next, targetId: null, moveTo: w.map.heroSpawn[bot.team] };

  const margin = cfg.towerSafetyMarginPx;
  const reach = bot.attackRange + cfg.acquireRangeBonus;
  const enemies = w.minions.filter((m) => m.alive && m.team !== bot.team && dist(bot, m) <= reach);
  const safeTarget = (p: Point) => !isUnsafe(p, bot.team, w, margin);

  // 1. A minion we can finish in one blow (last hit).
  const finishable = enemies
    .filter(
      (m) =>
        m.hp <= damage(bot.atk, m.armor, econ.combat.armorConstant, econ.combat.minDamage) &&
        safeTarget(m),
    )
    .sort((a, b) => dist(bot, a) - dist(bot, b))[0];
  // 2. The player, if close, alive, not under their own tower, and we are healthy.
  const fightPlayer =
    player.alive &&
    dist(bot, player) <= cfg.engageRange &&
    hpFrac >= cfg.engageMinHpFraction &&
    safeTarget(player);
  // 3. Otherwise the weakest enemy minion in reach.
  const weakest = enemies.filter(safeTarget).sort((a, b) => a.hp - b.hp)[0];

  const target = finishable ?? (fightPlayer ? player : (weakest ?? null));
  let moveTo: Point;
  if (target)
    moveTo =
      dist(bot, target) > bot.attackRange - 10
        ? { x: target.x, y: target.y }
        : { x: bot.x, y: bot.y };
  else moveTo = laneAnchor(w, cfg);
  moveTo = makeSafe(moveTo, bot.team, w, margin);
  return { mode, nextDecisionAt: next, targetId: target?.id ?? null, moveTo };
}

/** Unit vector towards the brain's move target, or zero when there. */
export function botMoveDir(brain: BotBrain, bot: HeroState): Point {
  if (!brain.moveTo) return { x: 0, y: 0 };
  const dx = brain.moveTo.x - bot.x;
  const dy = brain.moveTo.y - bot.y;
  const d = Math.hypot(dx, dy);
  return d < 8 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d };
}
