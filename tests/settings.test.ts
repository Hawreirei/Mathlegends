import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import en from '../src/data/i18n/en.json';
import id from '../src/data/i18n/id.json';
import ranksJson from '../src/data/ranks.json';
import theme from '../src/data/theme.json';
import { loadRanks } from '../src/systems/data';
import { validateEconomy, type EconomyConfig } from '../src/systems/economy';
import { createGameState, setSettings } from '../src/systems/gameState';
import { loadQuestionBank } from '../src/systems/questionBank';
import { createQuestionEngine } from '../src/systems/questionEngine';
import { createSession, onLastHit, tick } from '../src/systems/questionSession';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  serializeSettings,
  timeScale,
} from '../src/systems/settings';

const econ = economyJson as EconomyConfig;
const bank = loadQuestionBank();
const ranks = loadRanks(ranksJson);
const reward = () => ({ gold: 14, exp: 30, at: { x: 0, y: 0 } });
const session = (scale: number) => createSession(createQuestionEngine(bank, ranks, 1), econ, scale);

describe('accessibility settings (#31)', () => {
  it('defaults to normal text, normal colours, normal time', () => {
    expect(createGameState('id').settings).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ textScale: 1, colorBlind: false, extraTime: false });
  });

  it('round-trips through storage and ignores bad values', () => {
    const s = { textScale: 1.4, colorBlind: true, extraTime: true };
    expect(
      parseSettings(JSON.parse(JSON.stringify(serializeSettings(s))), theme.textScales),
    ).toEqual(s);
    expect(
      parseSettings({ textScale: 3, colorBlind: 'yes', extraTime: 1 }, theme.textScales),
    ).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null, theme.textScales)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ colorBlind: true }, theme.textScales)).toEqual({
      ...DEFAULT_SETTINGS,
      colorBlind: true,
    });
  });

  it('setSettings does not mutate the old state', () => {
    const a = createGameState('en');
    const b = setSettings(a, { ...a.settings, extraTime: true });
    expect(a.settings.extraTime).toBe(false);
    expect(b.settings.extraTime).toBe(true);
  });

  it('extra time multiplies every question timer by 1.5', () => {
    expect(econ.extraTimeMultiplier).toBe(1.5);
    expect(timeScale({ ...DEFAULT_SETTINGS, extraTime: true }, econ)).toBe(1.5);
    expect(timeScale(DEFAULT_SETTINGS, econ)).toBe(1);
    for (const kind of ['infantry', 'lancer', 'cannon'] as const) {
      const normal = onLastHit(session(1), kind, reward(), 0, 3).session.active!;
      const extra = onLastHit(session(1.5), kind, reward(), 0, 3).session.active!;
      expect(normal.deadline).toBe(econ.questionSeconds[kind]);
      expect(extra.deadline).toBe(econ.questionSeconds[kind] * 1.5);
    }
  });

  it('with extra time a question does not time out at its normal deadline', () => {
    const s = onLastHit(session(1.5), 'infantry', reward(), 0, 3).session;
    expect(tick(s, econ.questionSeconds.infantry + 0.1).resolutions).toEqual([]);
    expect(tick(s, econ.questionSeconds.infantry * 1.5).resolutions[0]!.outcome).toBe('timeout');
  });

  it('with extra time a waiting question stays fresh for 1.5x as long', () => {
    // A Cannon question (12 s, 18 s with extra time) shows; an Infantry one waits.
    let s = onLastHit(session(1.5), 'cannon', reward(), 0, 3).session;
    s = onLastHit(s, 'infantry', reward(), 0, 3).session;
    // At 7 s the waiting Infantry question (5 s normally) would be stale; with 7.5 s it is not.
    const r = tick({ ...s, active: { ...s.active!, deadline: 7 } }, 7);
    expect(r.resolutions.map((x) => x.outcome)).toEqual(['timeout']);
  });

  it('economy.json rejects an extra time multiplier below 1', () => {
    expect(validateEconomy({ ...econ, extraTimeMultiplier: 0.8 })).toContain(
      'extraTimeMultiplier must be at least 1',
    );
    expect(validateEconomy(econ)).toEqual([]);
  });

  it('has a colour-blind-safe pair that differs from the normal right/wrong colours', () => {
    expect(theme.colorBlind.correct).not.toBe(theme.colors.correct);
    expect(theme.colorBlind.wrong).not.toBe(theme.colors.wrong);
    expect(theme.textScales[0]).toBe(1);
  });

  it('every settings string exists in both languages', () => {
    const keys = (o: object) => Object.keys(o).filter((k) => k.startsWith('settings.'));
    expect(keys(id).sort()).toEqual(keys(en).sort());
    expect(keys(en).length).toBeGreaterThan(15);
  });
});
