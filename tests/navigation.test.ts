import { describe, expect, it } from 'vitest';
import { backAction, EXITS, type Screen } from '../src/systems/navigation';

const SCREENS = Object.keys(EXITS) as Screen[];

/** Where back leads, as a screen (null = leaves the game). */
function backTo(s: Screen): Screen | null {
  const a = backAction(s);
  if (a.kind === 'leave') return null;
  if (a.kind === 'scene') return a.to === 'Menu' ? 'menu' : 'settings';
  if (a.kind === 'askQuit') return 'matchQuitConfirm';
  // close: the screen underneath
  return s === 'settingsTransfer' ? 'settings' : 'match';
}

describe('navigation (#44)', () => {
  it('only the Menu lets Back leave the game', () => {
    for (const s of SCREENS) expect(backAction(s).kind === 'leave', s).toBe(s === 'menu');
  });

  it('no dead ends: from every screen the Menu can be reached, by buttons or by Back', () => {
    for (const start of SCREENS) {
      const seen = new Set<Screen>([start]);
      const queue: Screen[] = [start];
      while (queue.length) {
        const s = queue.shift()!;
        const next = [...EXITS[s], backTo(s)].filter((x): x is Screen => x !== null);
        for (const n of next)
          if (!seen.has(n)) {
            seen.add(n);
            queue.push(n);
          }
      }
      expect(seen.has('menu'), `${start} cannot reach the Menu`).toBe(true);
    }
  });

  it('every screen can be reached from the Menu', () => {
    const seen = new Set<Screen>(['menu']);
    const queue: Screen[] = ['menu'];
    while (queue.length)
      for (const n of EXITS[queue.shift()!])
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
    expect([...seen].sort()).toEqual([...SCREENS].sort());
  });

  it('in a match, Back closes what is open first and asks before quitting', () => {
    expect(backAction('matchShop')).toEqual({ kind: 'close' });
    expect(backAction('matchQuitConfirm')).toEqual({ kind: 'close' });
    expect(backAction('match')).toEqual({ kind: 'askQuit' });
  });

  it('Back from Settings sub-page returns to Settings, other screens to the Menu', () => {
    expect(backAction('settingsTransfer')).toEqual({ kind: 'close' });
    for (const s of [
      'settings',
      'placementIntro',
      'placementQuiz',
      'placementDone',
      'result',
    ] as const)
      expect(backAction(s)).toEqual({ kind: 'scene', to: 'Menu' });
  });
});
