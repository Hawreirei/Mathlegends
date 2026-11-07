/** Game feel (#45): damage numbers, screen shake, sounds and music. */
import { describe, expect, it } from 'vitest';
import audioJson from '../src/data/audio.json';
import feelJson from '../src/data/feel.json';
import { DataError, loadAudio, loadFeel, SOUND_NAMES } from '../src/systems/data';
import {
  addDamage,
  allowSound,
  createDamageNumbers,
  damageHit,
  musicSchedule,
  shakeFor,
  soundForOutcome,
  soundsFor,
  type FeelContext,
} from '../src/systems/feel';
import type { MatchEvent } from '../src/systems/match';

const feel = loadFeel(feelJson);
const audio = loadAudio(audioJson);
const at = { x: 0, y: 0 };
const ctx: FeelContext = {
  playerId: 'hero-player',
  playerMaxHp: 1000,
  kindOf: (id) =>
    id.startsWith('tower-')
      ? 'tower'
      : id.startsWith('nexus-')
        ? 'nexus'
        : id.startsWith('hero-')
          ? 'hero'
          : 'minion',
};
const attack = (p: Partial<Extract<MatchEvent, { type: 'attack' }>>): MatchEvent => ({
  type: 'attack',
  by: 'minion',
  attackerId: 'a',
  targetId: 'm1',
  from: at,
  to: at,
  damage: 10,
  killed: false,
  team: 'red',
  ...p,
});

describe('feel.json and audio.json', () => {
  it('load and validate', () => {
    expect(feel.damageNumbers.maxOnScreen).toBeGreaterThan(0);
    expect(Object.keys(audio.sounds).sort()).toEqual([...SOUND_NAMES].sort());
  });

  it('reject a sound with neither notes nor a pitch slide', () => {
    const bad = structuredClone(audioJson) as { sounds: Record<string, unknown> };
    bad.sounds.hit = { wave: 'square', durationMs: 50, volume: 0.1 };
    expect(() => loadAudio(bad)).toThrow(DataError);
  });

  it('reject a shake strong enough to make children feel sick', () => {
    const bad = structuredClone(feelJson);
    bad.shake.nexusDown.intensity = 0.2;
    expect(() => loadFeel(bad)).toThrow(DataError);
  });
});

describe('damage numbers: readable but not cluttered', () => {
  const hit = (targetId: string, amount: number, kind: 'dealt' | 'taken' = 'dealt') => ({
    targetId,
    kind,
    amount,
    at,
  });

  it('a first hit adds a number', () => {
    const r = addDamage(createDamageNumbers(), hit('m1', 30), 0, feel);
    expect(r.show).toMatchObject({ kind: 'add', item: { amount: 30, targetId: 'm1' } });
  });

  it('quick hits on the same target add up in one number', () => {
    let s = createDamageNumbers();
    s = addDamage(s, hit('m1', 30), 0, feel).state;
    const r = addDamage(s, hit('m1', 25), feel.damageNumbers.mergeWindowSec / 2, feel);
    expect(r.show).toMatchObject({ kind: 'update', item: { amount: 55 } });
    expect(r.state.items).toHaveLength(1);
  });

  it('a later hit, another target or the other direction gets its own number', () => {
    let s = createDamageNumbers();
    s = addDamage(s, hit('m1', 30), 0, feel).state;
    const late = addDamage(s, hit('m1', 10), feel.damageNumbers.mergeWindowSec + 0.01, feel);
    expect(late.show?.kind).toBe('add');
    expect(addDamage(s, hit('m2', 10), 0.1, feel).show?.kind).toBe('add');
    expect(addDamage(s, hit('m1', 10, 'taken'), 0.1, feel).show?.kind).toBe('add');
  });

  it(`never shows more than maxOnScreen at once; the oldest makes room`, () => {
    let s = createDamageNumbers();
    const max = feel.damageNumbers.maxOnScreen;
    const firstIds: number[] = [];
    for (let i = 0; i < max + 3; i++) {
      const r = addDamage(s, hit(`m${i}`, 10), i * 0.01, feel);
      s = r.state;
      if (r.show) firstIds.push(r.show.item.id);
      expect(s.items.length).toBeLessThanOrEqual(max);
      if (i >= max) expect(r.evicted).toEqual([firstIds[i - max]]);
    }
  });

  it('expired numbers do not count, and tiny amounts are not shown', () => {
    let s = createDamageNumbers();
    s = addDamage(s, hit('m1', 10), 0, feel).state;
    const r = addDamage(s, hit('m2', 10), feel.damageNumbers.lifetimeSec + 1, feel);
    expect(r.state.items.map((d) => d.targetId)).toEqual(['m2']);
    expect(addDamage(s, hit('m3', 0), 0, feel).show).toBeNull();
  });

  it('only hits involving the player make numbers', () => {
    expect(damageHit(attack({ by: 'player', targetId: 'm1' }), ctx.playerId)?.kind).toBe('dealt');
    expect(damageHit(attack({ targetId: ctx.playerId }), ctx.playerId)?.kind).toBe('taken');
    expect(damageHit(attack({ by: 'minion', targetId: 'm1' }), ctx.playerId)).toBeNull();
    expect(damageHit(attack({ by: 'bot', targetId: 'm1' }), ctx.playerId)).toBeNull();
  });
});

describe('screen shake', () => {
  it('only for big moments', () => {
    expect(shakeFor(attack({ targetId: 'm1', killed: true }), ctx, feel, false)).toBeNull();
    expect(shakeFor(attack({ targetId: ctx.playerId, damage: 10 }), ctx, feel, false)).toBeNull();
    expect(shakeFor(attack({ targetId: ctx.playerId, damage: 200 }), ctx, feel, false)).toEqual(
      feel.shake.heroHit,
    );
    expect(shakeFor(attack({ targetId: ctx.playerId, killed: true }), ctx, feel, false)).toEqual(
      feel.shake.heroDeath,
    );
    expect(shakeFor(attack({ targetId: 'tower-red-1', killed: true }), ctx, feel, false)).toEqual(
      feel.shake.towerDown,
    );
    expect(shakeFor(attack({ targetId: 'nexus-red-0', killed: true }), ctx, feel, false)).toEqual(
      feel.shake.nexusDown,
    );
  });

  it('never with Reduce motion on', () => {
    expect(shakeFor(attack({ targetId: 'nexus-red-0', killed: true }), ctx, feel, true)).toBeNull();
  });

  it('a falling Nexus shakes harder and longer than a tower', () => {
    expect(feel.shake.nexusDown.intensity).toBeGreaterThan(feel.shake.towerDown.intensity);
    expect(feel.shake.nexusDown.durationMs).toBeGreaterThan(feel.shake.towerDown.durationMs);
  });
});

describe('sounds', () => {
  it('match events make the expected sounds', () => {
    expect(soundsFor(attack({ by: 'player' }), ctx)).toEqual(['hit']);
    expect(soundsFor(attack({ targetId: ctx.playerId }), ctx)).toEqual(['hurt']);
    expect(soundsFor(attack({ targetId: 'tower-red-1', killed: true }), ctx)).toEqual([
      'towerDown',
    ]);
    expect(soundsFor(attack({ by: 'minion', targetId: 'm1' }), ctx)).toEqual(['minionHit']);
    expect(soundsFor(attack({ by: 'bot', targetId: 'm1' }), ctx)).toEqual([]);
    expect(soundsFor({ type: 'reward', heroId: ctx.playerId, gold: 14, exp: 30, at }, ctx)).toEqual(
      ['coin'],
    );
    expect(soundsFor({ type: 'reward', heroId: 'hero-bot', gold: 14, exp: 30, at }, ctx)).toEqual(
      [],
    );
    expect(soundsFor({ type: 'levelUp', heroId: ctx.playerId, level: 2 }, ctx)).toEqual([
      'levelUp',
    ]);
  });

  it('a right answer cheers, a wrong one or a timeout buzzes, a skipped one is silent', () => {
    expect(soundForOutcome('correct')).toBe('correct');
    expect(soundForOutcome('wrong')).toBe('wrong');
    expect(soundForOutcome('timeout')).toBe('wrong');
    expect(soundForOutcome('skipped')).toBeNull();
  });

  it('a busy sound plays at most once per gap; unlisted sounds are not limited', () => {
    const gap = feel.soundMinGapSec.hit!;
    let last = {};
    const first = allowSound(last, 'hit', 1, feel);
    expect(first.play).toBe(true);
    last = first.last;
    expect(allowSound(last, 'hit', 1 + gap / 2, feel).play).toBe(false);
    expect(allowSound(last, 'hit', 1 + gap, feel).play).toBe(true);
    expect(allowSound(last, 'levelUp', 1, feel).play).toBe(true);
    expect(allowSound(allowSound(last, 'levelUp', 1, feel).last, 'levelUp', 1, feel).play).toBe(
      true,
    );
  });
});

describe('music', () => {
  it('one loop is bars x 4 beats long, with one bass note per bar and no rests played', () => {
    const { notes, loopSec } = musicSchedule(audio.music);
    const beat = 60 / audio.music.bpm;
    expect(loopSec).toBeCloseTo(audio.music.bars.length * 4 * beat, 9);
    expect(notes.filter((n) => n.voice === 'bass')).toHaveLength(audio.music.bars.length);
    const rests = audio.music.bars.flatMap((b) => b.melody).filter((f) => f === 0).length;
    expect(notes.filter((n) => n.voice === 'melody')).toHaveLength(
      audio.music.bars.length * 4 - rests,
    );
    for (const n of notes) {
      expect(n.at).toBeGreaterThanOrEqual(0);
      expect(n.at + n.durationSec).toBeLessThanOrEqual(loopSec + 1e-9);
    }
  });
});

describe('skills, last hits and other events (#45)', () => {
  const skillHit = (p: Partial<Extract<MatchEvent, { type: 'skillHit' }>>): MatchEvent =>
    ({
      type: 'skillHit',
      skillId: 's',
      targetId: 'm1',
      at,
      damage: 50,
      killed: false,
      team: 'blue',
      ...p,
    }) as MatchEvent;

  it('sounds: the player casting, being hit by a skill, a last hit; nothing for spawns', () => {
    const cast = (by: 'player' | 'bot') =>
      ({
        type: 'skill',
        by,
        heroId: 'h',
        skillId: 's',
        slot: 0,
        from: at,
        at,
        dashTo: null,
        blasts: [],
      }) as MatchEvent;
    expect(soundsFor(cast('player'), ctx)).toEqual(['skill']);
    expect(soundsFor(cast('bot'), ctx)).toEqual([]);
    expect(soundsFor(skillHit({ targetId: ctx.playerId, team: 'red' }), ctx)).toEqual(['hurt']);
    expect(soundsFor(skillHit({}), ctx)).toEqual([]);
    expect(
      soundsFor({ type: 'lastHit', kind: 'infantry', minionId: 'm', gold: 14, exp: 30, at }, ctx),
    ).toEqual(['lastHit']);
    expect(soundsFor({ type: 'winner', team: 'blue' }, ctx)).toEqual([]);
  });

  it('damage numbers from skills: dealt by blue, taken by the player, none for red hitting minions', () => {
    expect(damageHit(skillHit({}), ctx.playerId)?.kind).toBe('dealt');
    expect(damageHit(skillHit({ targetId: ctx.playerId, team: 'red' }), ctx.playerId)?.kind).toBe(
      'taken',
    );
    expect(damageHit(skillHit({ team: 'red' }), ctx.playerId)).toBeNull();
    expect(damageHit({ type: 'winner', team: 'red' }, ctx.playerId)).toBeNull();
  });

  it('shake: a skill that kills the player shakes; other events do not', () => {
    expect(shakeFor(skillHit({ targetId: ctx.playerId, killed: true }), ctx, feel, false)).toEqual(
      feel.shake.heroDeath,
    );
    expect(shakeFor({ type: 'winner', team: 'blue' }, ctx, feel, false)).toBeNull();
    expect(
      shakeFor(
        attack({ targetId: 'm1', killed: true }),
        { ...ctx, kindOf: () => null },
        feel,
        false,
      ),
    ).toBeNull();
  });
});
