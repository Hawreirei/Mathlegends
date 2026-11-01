/**
 * One match, as pure data and rules (#24). No Phaser: MatchScene feeds player input in and draws
 * the events that come out; tests and the balance simulator (#37) run whole matches headless.
 *
 * Order of one step: player moves and attacks; the bot thinks, moves and attacks; due minion
 * waves spawn; minions step (they may hit minions, structures and heroes); towers shoot;
 * gold ticks; heroes regenerate, heal in their base and respawn; the winner is checked.
 */
import { botMoveDir, createBrain, thinkBot, type BotBrain } from './bot';
import {
  canAttack,
  nearestEnemyInRange,
  regenerate,
  resolveAttack,
  takeDamage,
  tickRespawn,
} from './combat';
import type { BotConfig, Hero, ItemsFile, MinionsFile, SkillsFile, StructuresFile } from './data';
import { buyItem, emptyInventory, sellItem, type Inventory, type ShopResult } from './inventory';
import { damage, type EconomyConfig, type MinionType } from './economy';
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
import { resolveLastHitGold } from './rewards';
import {
  applyBuff,
  castProblem,
  dashEnd,
  direction,
  expireEffects,
  pickTarget,
  scaled,
  skillInSlot,
  stepProjectile,
  type CastProblem,
  type ProjectileState,
} from './skills';

export interface MatchConfig {
  econ: EconomyConfig;
  map: LaneMap;
  minions: MinionsFile;
  structures: StructuresFile;
  playerHero: Hero;
  botHero: Hero;
  bot: BotConfig;
  /** Skill definitions (#33). */
  skills: SkillsFile;
  /** Shop items (#35). */
  items: ItemsFile;
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
  /** Skill projectiles in flight (#33). */
  projectiles: ProjectileState[];
  /** Counter for projectile ids. */
  nextProjectile: number;
  /** Item slots (#35): item ids or null. */
  playerItems: Inventory;
  botItems: Inventory;
}

export interface MatchInput {
  /** Joystick or keys; length 0..1. */
  move: Point;
  /** True while the player wants to attack (held, or a buffered press). */
  attack: boolean;
  /** A skill slot the player pressed this step (0-3), if any (#33). */
  skill?: number | null;
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
  | { type: 'winner'; team: Team }
  /** A skill was cast (#33): what to draw. `at` is the aim point. */
  | {
      type: 'skill';
      by: 'player' | 'bot';
      heroId: string;
      skillId: string;
      slot: number;
      from: Point;
      at: Point;
      /** Dash end, if the skill dashed. */
      dashTo: Point | null;
      /** AoE circles to flash. */
      blasts: { x: number; y: number; radius: number }[];
    }
  /** A skill could not be cast (for a short UI hint). */
  | { type: 'skillFailed'; by: 'player' | 'bot'; slot: number; reason: CastProblem }
  /** Damage dealt by a skill (projectile or AoE). */
  | {
      type: 'skillHit';
      skillId: string;
      targetId: string;
      at: Point;
      damage: number;
      killed: boolean;
      team: Team;
    };

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
    projectiles: [],
    nextProjectile: 0,
    playerItems: emptyInventory(cfg.econ),
    botItems: emptyInventory(cfg.econ),
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

const heroOf = (w: Work, who: 'player' | 'bot') => (who === 'player' ? w.player : w.bot);
const setHero = (w: Work, who: 'player' | 'bot', h: HeroState) => {
  if (who === 'player') w.player = h;
  else w.bot = h;
};

/** Skill damage to one unit: armour, shield, kill rewards (a player kill is a last hit, #27). */
function skillDamage(
  w: Work,
  casterId: string,
  skillId: string,
  target: HeroState | MinionState,
  raw: number,
  cfg: MatchConfig,
): void {
  const dmg = damage(raw, target.armor, cfg.econ.combat.armorConstant, cfg.econ.combat.minDamage);
  const hit = takeDamage(target, dmg, w.now, cfg.econ);
  if (target.id === w.player.id) w.player = hit.target as HeroState;
  else if (target.id === w.bot.id) w.bot = hit.target as HeroState;
  else
    w.minions = hit.killed
      ? w.minions.filter((m) => m.id !== target.id)
      : w.minions.map((m) => (m.id === target.id ? (hit.target as MinionState) : m));
  w.events.push({
    type: 'skillHit',
    skillId,
    targetId: target.id,
    at: { x: target.x, y: target.y },
    damage: dmg,
    killed: hit.killed,
    team: target.team === 'blue' ? 'red' : 'blue',
  });
  if (hit.killed) grantKill(w, target, casterId, cfg);
}

/** Casts the skill in `slot` for the player or the bot (rules in skills.ts). */
function castSkill(w: Work, who: 'player' | 'bot', slot: number, cfg: MatchConfig): void {
  const def = who === 'player' ? cfg.playerHero : cfg.botHero;
  let caster = heroOf(w, who);
  const skill = skillInSlot(def.skills, slot, cfg.skills);
  const problem = castProblem(caster, skill, slot, w.now);
  if (problem || !skill) {
    w.events.push({ type: 'skillFailed', by: who, slot, reason: problem ?? 'noSkill' });
    return;
  }
  const enemyHero = who === 'player' ? w.bot : w.player;
  const target = pickTarget<HeroState | MinionState>(caster, skill.range, enemyHero, w.minions);
  const from = { x: caster.x, y: caster.y };
  let aim = target ? direction(caster, target, caster.facing) : caster.facing;
  const readyAt = [...caster.skillReadyAt];
  readyAt[slot] = w.now + skill.cooldown;
  caster = { ...caster, mana: caster.mana - skill.mana, skillReadyAt: readyAt, facing: aim };
  setHero(w, who, caster);

  let dashTo: Point | null = null;
  const blasts: { x: number; y: number; radius: number }[] = [];
  const aimPoint = target
    ? { x: target.x, y: target.y }
    : { x: from.x + aim.x * skill.range, y: from.y + aim.y * skill.range };
  for (const e of skill.effects) {
    caster = heroOf(w, who);
    if (e.kind === 'dash') {
      const end = dashEnd(
        caster,
        aim,
        e.distance,
        target,
        caster.attackRange * 0.6,
        areaOf(cfg.map),
      );
      dashTo = end;
      setHero(w, who, { ...caster, ...end });
    } else if (e.kind === 'aoe') {
      const c = e.centre === 'self' ? { x: caster.x, y: caster.y } : aimPoint;
      blasts.push({ ...c, radius: e.radius });
      const raw = scaled(e.damage, caster);
      const victims = [heroOf(w, who === 'player' ? 'bot' : 'player'), ...w.minions].filter(
        (u) => u.alive && u.team !== caster.team && Math.hypot(u.x - c.x, u.y - c.y) <= e.radius,
      );
      for (const v of victims) {
        const fresh =
          v.id === w.player.id
            ? w.player
            : v.id === w.bot.id
              ? w.bot
              : w.minions.find((m) => m.id === v.id);
        if (fresh?.alive) skillDamage(w, caster.id, skill.id, fresh, raw, cfg);
      }
    } else if (e.kind === 'projectile') {
      w.projectiles = [
        ...w.projectiles,
        {
          id: `p${w.nextProjectile}`,
          skillId: skill.id,
          ownerId: caster.id,
          team: caster.team,
          x: caster.x,
          y: caster.y,
          dir: aim,
          speed: e.speed,
          left: Math.max(skill.range, 1),
          radius: e.radius,
          damage: scaled(e.damage, caster),
          pierce: e.pierce,
          hit: [],
        },
      ];
      w.nextProjectile += 1;
    } else if (e.kind === 'buff') {
      setHero(w, who, applyBuff(caster, e, w.now));
    } else if (e.kind === 'shield') {
      const amount = scaled(e.amount, caster);
      setHero(w, who, {
        ...caster,
        shield: Math.max(amount, caster.shield ?? 0),
        shieldUntil: w.now + e.duration,
      });
    }
    aim = heroOf(w, who).facing;
  }
  w.events.push({
    type: 'skill',
    by: who,
    heroId: caster.id,
    skillId: skill.id,
    slot,
    from,
    at: aimPoint,
    dashTo,
    blasts,
  });
}

/** Moves every projectile; hits deal skill damage to enemies (heroes and minions). */
function stepProjectiles(w: Work, dt: number, cfg: MatchConfig): void {
  const kept: ProjectileState[] = [];
  for (const p of w.projectiles) {
    const enemies = [w.player, w.bot, ...w.minions];
    const r = stepProjectile<HeroState | MinionState>(p, dt, enemies, (u) =>
      'heroId' in u ? cfg.minions.heroBodyRadius : u.radius,
    );
    for (const target of r.hits) {
      const fresh =
        target.id === w.player.id
          ? w.player
          : target.id === w.bot.id
            ? w.bot
            : w.minions.find((m) => m.id === target.id);
      if (fresh?.alive) skillDamage(w, p.ownerId, p.skillId, fresh, p.damage, cfg);
    }
    if (r.projectile) kept.push(r.projectile);
  }
  w.projectiles = kept;
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
  if (input.skill !== undefined && input.skill !== null) castSkill(w, 'player', input.skill, cfg);

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

  // Skill projectiles (#33).
  stepProjectiles(w, dt, cfg);

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
    let x = expireEffects(regenerate(h, dt), now);
    if (x.alive && x.mana < x.maxMana)
      x = { ...x, mana: Math.min(x.maxMana, x.mana + x.manaRegen * dt) };
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
 * (math income) after the fairness cap (src/systems/rewards.ts), EXP with level-ups.
 * Returns the new state, the reward/level-up events and the gold multiplier actually paid.
 */
export function applyLastHitReward(
  state: MatchState,
  base: { gold: number; exp: number; at: Point },
  multiplier: number,
  cfg: MatchConfig,
): { state: MatchState; events: MatchEvent[]; goldMultiplier: number; capped: boolean } {
  // Gold goes through the fairness cap (#28); EXP keeps the full multiplier.
  const g = resolveLastHitGold(base.gold, multiplier, state.playerProgress, cfg.econ);
  const gold = g.gold;
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
  return {
    state: { ...state, player, playerProgress: p },
    events,
    goldMultiplier: base.gold > 0 ? gold / base.gold : multiplier,
    capped: g.capped,
  };
}

/** The player buys an item from the shop (#35); the match keeps running. */
export function playerBuy(
  state: MatchState,
  itemId: string,
  cfg: MatchConfig,
): { state: MatchState; result: ShopResult } {
  const r = buyItem(state.playerProgress, state.playerItems, cfg.items, itemId);
  if (!r.ok) return { state, result: r };
  return {
    state: { ...state, playerProgress: r.progress, playerItems: r.inventory },
    result: r,
  };
}

/** The player sells the item in `slot` for 70% of its cost (#35). */
export function playerSell(
  state: MatchState,
  slot: number,
  cfg: MatchConfig,
): { state: MatchState; result: ShopResult } {
  const r = sellItem(state.playerProgress, state.playerItems, cfg.items, slot, cfg.econ);
  if (!r.ok) return { state, result: r };
  return {
    state: { ...state, playerProgress: r.progress, playerItems: r.inventory },
    result: r,
  };
}
