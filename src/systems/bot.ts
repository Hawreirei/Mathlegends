/**
 * Basic bot brain (#24). Pure TypeScript, no Phaser. A small state machine:
 *
 * - lane:    stand just behind the front friendly minion (or behind its own outer tower when
 *            no minions are out), last-hit minions it can finish in one blow, otherwise hit the
 *            weakest enemy minion in reach, fight the player when close and healthy, and hit an
 *            enemy tower or Nexus when its own minions are taking the tower's shots (#43);
 * - retreat: below retreatHpFraction walk home and heal; return at returnHpFraction.
 *
 * It never walks into an enemy tower's range unless a friendly minion is already there to
 * take the tower's shots. Every threshold comes from src/data/bot.json.
 */
import type { BotConfig, Hero, Skill, SkillsFile } from './data';
import { castProblem, skillInSlot } from './skills';
import { damage, type EconomyConfig } from './economy';
import type { HeroState } from './hero';
import type { LaneMap, Point, Team } from './map';
import type { MinionState } from './minions';
import { isTargetable, type StructureState } from './structures';

export interface BotBrain {
  mode: 'lane' | 'retreat';
  nextDecisionAt: number;
  targetId: string | null;
  moveTo: Point | null;
  /** A skill slot to cast this step (#43), or null. */
  skill: number | null;
  /** Random state (seeded, so a match replays the same way in tests). */
  seed: number;
}

/** What the brain needs to use skills (#43). */
export interface BotKit {
  hero: Hero;
  skills: SkillsFile;
}

/** One step of a small seeded random generator (mulberry32): a number in [0, 1) and the next seed. */
export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

export interface BotWorld {
  bot: HeroState;
  player: HeroState;
  minions: readonly MinionState[];
  structures: readonly StructureState[];
  map: LaneMap;
}

export const createBrain = (seed = 1): BotBrain => ({
  mode: 'lane',
  nextDecisionAt: 0,
  targetId: null,
  moveTo: null,
  skill: null,
  seed,
});

const isDefensive = (s: Skill) => s.effects.every((e) => e.kind === 'buff' || e.kind === 'shield');

/**
 * The skill to cast now, if any (#43): a damage skill when its target is in range (the
 * ultimate first against the hero), a shield/buff-only skill when hurt or fighting the hero;
 * each only with probability skillUseChance.
 */
function chooseSkill(
  w: BotWorld,
  target: { id: string; x: number; y: number } | null,
  now: number,
  cfg: BotConfig,
  kit: BotKit,
  roll: () => number,
): number | null {
  const { bot, player } = w;
  const slots = kit.hero.skills.map((_, i) => i);
  const order = target?.id === player.id ? [...slots].reverse() : slots;
  const hurt = bot.hp / bot.maxHp < cfg.defensiveSkillHpFraction;
  for (const slot of order) {
    const skill = skillInSlot(kit.hero.skills, slot, kit.skills);
    if (!skill || castProblem(bot, skill, slot, now)) continue;
    if (isDefensive(skill)) {
      if (!(hurt || target?.id === player.id)) continue;
    } else if (!target || dist(bot, target) > skill.range) continue;
    if (roll() < cfg.skillUseChance) return slot;
  }
  return null;
}

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
  kit?: BotKit,
): BotBrain {
  const { bot, player } = w;
  if (!bot.alive) return { ...createBrain(brain.seed), nextDecisionAt: now };
  // A skill is cast once; the next decision may pick another.
  if (now < brain.nextDecisionAt) return brain.skill === null ? brain : { ...brain, skill: null };
  const next = now + cfg.decisionIntervalSec;
  const hpFrac = bot.hp / bot.maxHp;
  let seed = brain.seed;
  const roll = () => {
    const r = nextRandom(seed);
    seed = r.seed;
    return r.value;
  };

  let mode = brain.mode;
  if (hpFrac < cfg.retreatHpFraction) mode = 'retreat';
  else if (mode === 'retreat' && hpFrac >= cfg.returnHpFraction) mode = 'lane';
  if (mode === 'retreat') {
    // Walking home: a shield or speed skill helps get there.
    const skill = kit ? chooseSkill(w, null, now, cfg, kit, roll) : null;
    return {
      mode,
      nextDecisionAt: next,
      targetId: null,
      moveTo: w.map.heroSpawn[bot.team],
      skill,
      seed,
    };
  }

  const margin = cfg.towerSafetyMarginPx;
  const reach = bot.attackRange + cfg.acquireRangeBonus;
  const enemies = w.minions.filter((m) => m.alive && m.team !== bot.team && dist(bot, m) <= reach);
  const safeTarget = (p: Point) => !isUnsafe(p, bot.team, w, margin);

  // 1. A minion we can finish in one blow (last hit) - unless it mistimes this one (#43).
  const mistimed = roll() >= cfg.lastHitAccuracy;
  const finishable = enemies
    .filter(
      (m) =>
        m.hp <= damage(bot.atk, m.armor, econ.combat.armorConstant, econ.combat.minDamage) &&
        safeTarget(m),
    )
    .sort((a, b) => dist(bot, a) - dist(bot, b))[0];
  // Mistimed: it hits something else this time (or waits), and the minion may die to others.
  const lastHit = mistimed ? undefined : finishable;
  // 2. The player, if close, alive, not under their own tower, and we are healthy.
  const fightPlayer =
    player.alive &&
    dist(bot, player) <= cfg.engageRange &&
    hpFrac >= cfg.engageMinHpFraction &&
    safeTarget(player);
  // 3. Otherwise the weakest enemy minion in reach.
  const weakest = enemies
    .filter((m) => safeTarget(m) && m !== finishable)
    .sort((a, b) => a.hp - b.hp)[0];

  // 4. Push (#43): an enemy tower or Nexus it can attack, while its own minions take the shots.
  const structure = w.structures
    .filter(
      (t) =>
        t.alive &&
        t.team !== bot.team &&
        isTargetable(t, w.structures) &&
        dist(bot, t) <= reach &&
        safeTarget(t),
    )
    .sort((a, b) => dist(bot, a) - dist(bot, b))[0];

  const target = lastHit ?? (fightPlayer ? player : (weakest ?? structure ?? null));
  let moveTo: Point;
  if (target)
    moveTo =
      dist(bot, target) > bot.attackRange - 10
        ? { x: target.x, y: target.y }
        : { x: bot.x, y: bot.y };
  else moveTo = laneAnchor(w, cfg);
  moveTo = makeSafe(moveTo, bot.team, w, margin);
  const skillTarget = target ?? (fightPlayer ? player : null);
  const skill = kit ? chooseSkill(w, skillTarget, now, cfg, kit, roll) : null;
  return { mode, nextDecisionAt: next, targetId: target?.id ?? null, moveTo, skill, seed };
}

/** Unit vector towards the brain's move target, or zero when there. */
export function botMoveDir(brain: BotBrain, bot: HeroState): Point {
  if (!brain.moveTo) return { x: 0, y: 0 };
  const dx = brain.moveTo.x - bot.x;
  const dy = brain.moveTo.y - bot.y;
  const d = Math.hypot(dx, dy);
  return d < 8 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d };
}
