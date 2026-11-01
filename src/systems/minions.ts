/**
 * Minion waves (#20). Pure TypeScript, no Phaser, so the balance simulator (#37) can run it.
 * Waves spawn on a timer from both bases, march along the lane, fight the nearest enemy
 * (minions first, heroes only when no enemy minion is near) and never respawn.
 */
import { canAttack, resolveAttack, type Combatant } from './combat';
import type { MinionsFile } from './data';
import type { EconomyConfig, MinionType } from './economy';
import { walkableArea, type HeroState } from './hero';
import type { LaneMap, Point, Team } from './map';
import { isTargetable, type StructureState } from './structures';

export interface MinionState extends Combatant {
  kind: MinionType;
  /** Position in its wave (0 = front); the red twin of a blue minion has the same slot. */
  slot: number;
  wave: number;
  moveSpeed: number;
  aggroRange: number;
  radius: number;
  sprite: string;
}

export interface AttackEvent {
  attackerId: string;
  targetId: string;
  damage: number;
  killed: boolean;
  /** Where the attacker stood, for effects. */
  x: number;
  y: number;
}

/** Match time (seconds) when wave `n` (0-based) spawns. */
export const waveTime = (n: number, c: EconomyConfig): number =>
  c.match.firstWaveSeconds + n * c.match.waveIntervalSeconds;

/** Wave numbers whose spawn time falls in (prev, now]. */
export function wavesDue(prev: number, now: number, c: EconomyConfig): number[] {
  const out: number[] = [];
  const first = Math.max(
    0,
    Math.ceil((prev - c.match.firstWaveSeconds) / c.match.waveIntervalSeconds),
  );
  for (let n = first; waveTime(n, c) <= now + 1e-9; n++)
    if (waveTime(n, c) > prev + 1e-9) out.push(n);
  return out;
}

/** Every Nth wave (the 3rd, 6th, ...) brings a Cannon. */
export const hasCannon = (n: number, c: EconomyConfig): boolean =>
  (n + 1) % c.match.cannonEveryNthWave === 0;

const dirOf = (team: Team) => (team === 'blue' ? 1 : -1);

export function spawnWave(
  n: number,
  team: Team,
  map: LaneMap,
  c: EconomyConfig,
  m: MinionsFile,
  idPrefix: string,
): MinionState[] {
  const kinds: MinionType[] = [
    ...Array<MinionType>(c.match.wave.infantry).fill('infantry'),
    ...Array<MinionType>(c.match.wave.lancer).fill('lancer'),
    ...(hasCannon(n, c) ? Array<MinionType>(c.match.wave.cannon).fill('cannon') : []),
  ];
  const spawn = map.minionSpawn[team];
  const dir = dirOf(team);
  const rows = [0, -1, 1];
  return kinds.map((kind, slot) => {
    const t = m.types[kind];
    const col = Math.floor(slot / rows.length);
    const row = rows[slot % rows.length]!;
    return {
      id: `${idPrefix}-${team}-${slot}`,
      team,
      kind,
      slot,
      wave: n,
      x: spawn.x - dir * col * m.spacing,
      y: spawn.y + row * m.spacing,
      hp: t.hp,
      maxHp: t.hp,
      atk: t.atk,
      armor: t.armor,
      attackRange: t.attackRange,
      attackSpeed: t.attackSpeed,
      hpRegen: t.hpRegen,
      moveSpeed: t.moveSpeed,
      aggroRange: t.aggroRange,
      radius: t.radius,
      level: 1,
      alive: true,
      nextAttackAt: 0,
      respawnAt: null,
      sprite: `minion-${kind}-${team}`,
    };
  });
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function nearest<T extends Combatant>(
  from: Combatant,
  list: readonly T[],
  range: number,
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const o of list) {
    if (!o.alive || o.team === from.team) continue;
    const d = dist(from, o);
    if (d <= range && d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

function moveToward(p: Point, to: Point, step: number): Point {
  const d = dist(p, to);
  if (d <= step || d === 0) return { x: to.x, y: to.y };
  return { x: p.x + ((to.x - p.x) / d) * step, y: p.y + ((to.y - p.y) / d) * step };
}

export interface StepResult {
  minions: MinionState[];
  heroes: HeroState[];
  structures: StructureState[];
  events: AttackEvent[];
}

/**
 * Advances all minions by `dt` seconds at match time `now`. Every minion decides from the
 * same snapshot, then moves and attacks are applied, so neither team gets a first-move edge.
 * Heroes are passed in so minions can damage them; they are returned updated.
 */
export function stepMinions(
  minionsIn: readonly MinionState[],
  heroesIn: readonly HeroState[],
  dt: number,
  now: number,
  c: EconomyConfig,
  map: LaneMap,
  structuresIn: readonly StructureState[] = [],
): StepResult {
  const area = walkableArea(map);
  const minions = minionsIn.map((x) => ({ ...x }));
  const heroes = heroesIn.map((x) => ({ ...x }));
  const structures = structuresIn.map((x) => ({ ...x }));
  const targetableStructures = structuresIn.filter((x) => isTargetable(x, structuresIn));
  const plans: { i: number; targetId: string }[] = [];

  // 1. Decide (from the snapshot) and move.
  minionsIn.forEach((m, i) => {
    if (!m.alive) return;
    // Priority: enemy minions, then enemy structures that can be attacked, then enemy heroes.
    const target =
      nearest(m, minionsIn, m.aggroRange) ??
      nearest(m, targetableStructures, m.aggroRange) ??
      nearest(m, heroesIn, m.aggroRange);
    const me = minions[i]!;
    if (target && dist(m, target) <= m.attackRange) {
      if (canAttack(m, now)) plans.push({ i, targetId: target.id });
      return;
    }
    const step = m.moveSpeed * dt;
    const to = target ?? { x: m.x + dirOf(m.team) * step, y: m.y };
    const next = target ? moveToward(m, to, Math.min(step, dist(m, to) - m.attackRange + 1)) : to;
    me.x = next.x;
    me.y = next.y;
  });

  // 2. Attack, simultaneously: a minion killed this step still lands the attack it planned,
  //    so list order gives neither team an edge. Targets already at 0 HP are not hit again.
  const events: AttackEvent[] = [];
  for (const { i, targetId } of plans) {
    const attacker = minions[i]!;
    const ti = minions.findIndex((x) => x.id === targetId);
    const hi = ti < 0 ? heroes.findIndex((x) => x.id === targetId) : -1;
    const si = ti < 0 && hi < 0 ? structures.findIndex((x) => x.id === targetId) : -1;
    const target =
      ti >= 0 ? minions[ti]! : hi >= 0 ? heroes[hi]! : si >= 0 ? structures[si]! : null;
    if (!target || !target.alive) continue;
    const r = resolveAttack(attacker, target, now, c);
    minions[i] = r.attacker;
    if (ti >= 0) minions[ti] = r.target as MinionState;
    else if (hi >= 0) heroes[hi] = r.target as HeroState;
    else structures[si] = { ...(r.target as StructureState), respawnAt: null };
    events.push({
      attackerId: attacker.id,
      targetId,
      damage: r.damage,
      killed: r.killed,
      x: attacker.x,
      y: attacker.y,
    });
  }

  // 3. Dead minions leave; minions never respawn.
  const alive = minions.filter((m) => m.alive).map((m) => ({ ...m, respawnAt: null }));

  // 4. Push friendly minions apart so a wave keeps its shape, then keep everyone on the lane.
  for (let i = 0; i < alive.length; i++)
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i]!;
      const b = alive[j]!;
      if (a.team !== b.team) continue;
      const min = (a.radius + b.radius) * 1.1;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d === 0) {
        dx = 0;
        dy = j % 2 ? 1 : -1;
        d = 1;
      }
      const push = (min - d) / 2;
      a.x -= (dx / d) * push;
      a.y -= (dy / d) * push;
      b.x += (dx / d) * push;
      b.y += (dy / d) * push;
    }
  for (const m of alive) {
    m.x = Math.min(area.right, Math.max(area.left, m.x));
    m.y = Math.min(area.bottom, Math.max(area.top, m.y));
  }
  return { minions: alive, heroes, structures, events };
}
