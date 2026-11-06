/**
 * Game feel (#45): damage numbers, screen shake, which sounds a match event makes, sound
 * throttling and the music schedule. Pure TypeScript, no Phaser and no Web Audio: the scenes and
 * src/audio/AudioPlayer.ts turn these decisions into pixels and sound. Numbers in feel.json and
 * audio.json.
 */
import type { AudioFile, FeelFile, SoundName } from './data';
import type { Point } from './map';
import type { MatchEvent } from './match';
import type { Outcome } from './questionSession';

// ---------- damage numbers

/** dealt = the player hit something (white); taken = something hit the player (red). */
export type DamageKind = 'dealt' | 'taken';

export interface DamageNumber {
  id: number;
  targetId: string;
  kind: DamageKind;
  amount: number;
  /** Match time of the latest hit added to it. */
  bornAt: number;
  at: Point;
}

export interface DamageNumbers {
  items: DamageNumber[];
  nextId: number;
}

export const createDamageNumbers = (): DamageNumbers => ({ items: [], nextId: 1 });

export interface DamageResult {
  state: DamageNumbers;
  /** What to draw: a new number, or a new total on one already shown; null = nothing. */
  show: { kind: 'add' | 'update'; item: DamageNumber } | null;
  /** Numbers to remove now to make room (the oldest first). */
  evicted: number[];
}

/**
 * Adds a hit. Hits on the same target of the same kind within mergeWindowSec add up in one
 * number, so a fast flurry reads as one total instead of a stack. At most maxOnScreen numbers
 * live at once; the oldest makes room. Amounts below minAmount are not shown.
 */
export function addDamage(
  s: DamageNumbers,
  hit: { targetId: string; kind: DamageKind; amount: number; at: Point },
  now: number,
  cfg: FeelFile,
): DamageResult {
  const c = cfg.damageNumbers;
  let items = s.items.filter((d) => now - d.bornAt <= c.lifetimeSec);
  if (hit.amount < c.minAmount || hit.amount <= 0)
    return { state: { ...s, items }, show: null, evicted: [] };
  const same = items.find(
    (d) => d.targetId === hit.targetId && d.kind === hit.kind && now - d.bornAt <= c.mergeWindowSec,
  );
  if (same) {
    const item = { ...same, amount: same.amount + hit.amount, bornAt: now };
    items = items.map((d) => (d.id === same.id ? item : d));
    return { state: { ...s, items }, show: { kind: 'update', item }, evicted: [] };
  }
  const item: DamageNumber = { id: s.nextId, ...hit, bornAt: now };
  items = [...items, item];
  const evicted: number[] = [];
  while (items.length > c.maxOnScreen) {
    const oldest = items.reduce((a, b) => (b.bornAt < a.bornAt ? b : a));
    evicted.push(oldest.id);
    items = items.filter((d) => d.id !== oldest.id);
  }
  return { state: { items, nextId: s.nextId + 1 }, show: { kind: 'add', item }, evicted };
}

/** Which damage number (if any) an event makes: only hits involving the player are shown. */
export function damageHit(
  e: MatchEvent,
  playerId: string,
): { targetId: string; kind: DamageKind; amount: number; at: Point } | null {
  if (e.type === 'attack') {
    if (e.targetId === playerId)
      return { targetId: e.targetId, kind: 'taken', amount: e.damage, at: e.to };
    if (e.by === 'player')
      return { targetId: e.targetId, kind: 'dealt', amount: e.damage, at: e.to };
    return null;
  }
  if (e.type === 'skillHit') {
    if (e.targetId === playerId)
      return { targetId: e.targetId, kind: 'taken', amount: e.damage, at: e.at };
    if (e.team === 'blue')
      return { targetId: e.targetId, kind: 'dealt', amount: e.damage, at: e.at };
  }
  return null;
}

// ---------- screen shake

export interface Shake {
  intensity: number;
  durationMs: number;
}

export interface FeelContext {
  playerId: string;
  playerMaxHp: number;
  /** What a unit id is (towers and Nexus ids come from createStructures). */
  kindOf: (id: string) => 'hero' | 'minion' | 'tower' | 'nexus' | null;
}

/**
 * Screen shake for an event, only for big moments: a heavy hit on the player, the player's death,
 * a tower or Nexus falling. Never with reduceMotion on.
 */
export function shakeFor(
  e: MatchEvent,
  ctx: FeelContext,
  cfg: FeelFile,
  reduceMotion: boolean,
): Shake | null {
  if (reduceMotion) return null;
  if (e.type !== 'attack' && e.type !== 'skillHit') return null;
  const s = cfg.shake;
  if (e.killed) {
    const k = ctx.kindOf(e.targetId);
    if (k === 'nexus') return s.nexusDown;
    if (k === 'tower') return s.towerDown;
    if (e.targetId === ctx.playerId) return s.heroDeath;
    return null;
  }
  if (e.targetId === ctx.playerId && e.damage >= s.heroHitRatio * ctx.playerMaxHp) return s.heroHit;
  return null;
}

// ---------- sounds

/** The sounds a match event makes (before throttling). */
export function soundsFor(e: MatchEvent, ctx: FeelContext): SoundName[] {
  switch (e.type) {
    case 'attack': {
      const k = e.killed ? ctx.kindOf(e.targetId) : null;
      if (k === 'tower' || k === 'nexus') return ['towerDown'];
      if (e.by === 'player') return ['hit'];
      if (e.targetId === ctx.playerId) return ['hurt'];
      if (e.by === 'minion' && ctx.kindOf(e.targetId) === 'minion') return ['minionHit'];
      return [];
    }
    case 'skill':
      return e.by === 'player' ? ['skill'] : [];
    case 'skillHit':
      return e.targetId === ctx.playerId ? ['hurt'] : [];
    case 'reward':
      return e.heroId === ctx.playerId && e.gold > 0 ? ['coin'] : [];
    case 'levelUp':
      return e.heroId === ctx.playerId ? ['levelUp'] : [];
    case 'lastHit':
      return ['lastHit'];
    default:
      return [];
  }
}

/** The sound for a question's result; skipped questions are silent. */
export const soundForOutcome = (o: Outcome): SoundName | null =>
  o === 'correct' ? 'correct' : o === 'skipped' ? null : 'wrong';

/** Throttle: a sound listed in soundMinGapSec plays at most once per gap. */
export function allowSound(
  last: Readonly<Record<string, number>>,
  name: SoundName,
  now: number,
  cfg: FeelFile,
): { play: boolean; last: Record<string, number> } {
  const gap = cfg.soundMinGapSec[name];
  const prev = last[name];
  if (gap !== undefined && prev !== undefined && now - prev < gap) return { play: false, last };
  return { play: true, last: { ...last, [name]: now } };
}

// ---------- music

export interface MusicNote {
  /** Seconds from the start of the loop. */
  at: number;
  freq: number;
  durationSec: number;
  voice: 'melody' | 'bass';
}

/** One pass of the music loop: four melody beats and one held bass note per bar. */
export function musicSchedule(m: AudioFile['music']): { notes: MusicNote[]; loopSec: number } {
  const beat = 60 / m.bpm;
  const notes: MusicNote[] = [];
  m.bars.forEach((bar, i) => {
    const start = i * 4 * beat;
    notes.push({ at: start, freq: bar.bass, durationSec: 4 * beat * 0.95, voice: 'bass' });
    bar.melody.forEach((f, j) => {
      if (f > 0)
        notes.push({ at: start + j * beat, freq: f, durationSec: beat * 0.8, voice: 'melody' });
    });
  });
  return { notes, loopSec: m.bars.length * 4 * beat };
}
