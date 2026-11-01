import { describe, expect, it } from 'vitest';
import ranksJson from '../src/data/ranks.json';
import theme from '../src/data/theme.json';
import { loadRanks } from '../src/systems/data';
import { NEW_PROFILE } from '../src/systems/gameState';
import { curriculumTopicTiers, loadQuestionBank } from '../src/systems/questionBank';
import {
  gatherV1,
  readSave,
  saveFileName,
  SAVE_VERSION,
  writeSave,
  type SaveData,
} from '../src/systems/save';
import { DEFAULT_SETTINGS } from '../src/systems/settings';
import { EMPTY_SAVE, loadGame, saveGame } from '../src/utils/saveStore';
import { SAVE_KEY, type KeyValueStore } from '../src/utils/storage';

const ranks = loadRanks(ranksJson);
const ctx = { ranks, topicTiers: curriculumTopicTiers(), textScales: theme.textScales };
const bank = loadQuestionBank();
const now = new Date('2026-11-01T10:00:00Z');

const memory = (init: Record<string, unknown> = {}) => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  const store: KeyValueStore = {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
  };
  return { m, store, json: (k: string) => JSON.parse(m.get(k) ?? 'null') as unknown };
};

const DATA: SaveData = {
  profile: { placed: true, tier: 4, stars: 3, lossesAtZero: 1, matchesPlayed: 12 },
  settings: { textScale: 1.2, colorBlind: true, extraTime: false },
  review: [
    { question: bank[0]!, matchesLeft: 3 },
    { question: bank[100]!, matchesLeft: 1 },
  ],
};

describe('versioned save (#41)', () => {
  it('round-trips the current version through JSON without changes', () => {
    const file = JSON.parse(JSON.stringify(writeSave(DATA, now)));
    expect(file).toMatchObject({
      app: 'mathlegends',
      version: SAVE_VERSION,
      savedAt: now.toISOString(),
    });
    expect(readSave(file, ctx)).toEqual({ ok: true, data: DATA, migratedFrom: null });
  });

  it('keeps an uncapped Year 6 total', () => {
    const y6 = { ...DATA, profile: { ...DATA.profile, tier: 6, stars: 23 } };
    const r = readSave(JSON.parse(JSON.stringify(writeSave(y6, now))), ctx);
    expect(r.ok && r.data.profile.stars).toBe(23);
  });

  it('migrates a v1 save (the separate pre-#41 keys) without losing anything', () => {
    const v1 = gatherV1(
      { version: 1, ...DATA.profile },
      { version: 1, ...DATA.settings },
      { version: 1, items: DATA.review },
    );
    expect(readSave(JSON.parse(JSON.stringify(v1)), ctx)).toEqual({
      ok: true,
      data: DATA,
      migratedFrom: 1,
    });
  });

  it('migrates a profile saved before #39 (no lossesAtZero) by starting the count at 0', () => {
    const { lossesAtZero: _, ...old } = DATA.profile;
    const r = readSave(gatherV1({ version: 1, ...old }, null, null), ctx);
    expect(r).toMatchObject({
      ok: true,
      migratedFrom: 1,
      data: {
        profile: { ...DATA.profile, lossesAtZero: 0 },
        settings: DEFAULT_SETTINGS,
        review: [],
      },
    });
  });

  it('rejects files that are not a save, from a newer game, or damaged', () => {
    expect(readSave({ hello: 1 }, ctx)).toEqual({ ok: false, reason: 'notASave' });
    expect(readSave('text', ctx)).toEqual({ ok: false, reason: 'notASave' });
    expect(readSave({ app: 'other', version: 2 }, ctx)).toEqual({ ok: false, reason: 'notASave' });
    expect(readSave({ ...writeSave(DATA, now), version: 99 }, ctx)).toEqual({
      ok: false,
      reason: 'tooNew',
    });
    const broken = { ...writeSave(DATA, now), profile: { ...DATA.profile, tier: 9 } };
    expect(readSave(broken, ctx)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('drops bad parts it can do without (bad settings, bad review items) but keeps the rank', () => {
    const file = {
      ...writeSave(DATA, now),
      settings: { textScale: 7 },
      review: [{ question: { id: 'x' }, matchesLeft: 2 }],
    };
    const r = readSave(file, ctx);
    expect(r.ok && r.data.profile).toEqual(DATA.profile);
    expect(r.ok && r.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.ok && r.data.review).toEqual([]);
  });

  it('names the export file by date', () => {
    expect(saveFileName(now)).toBe('mathlegends-save-2026-11-01.json');
  });
});

describe('save on the device (#41)', () => {
  it('a refresh keeps the rank: save, then load', () => {
    const { store } = memory();
    expect(saveGame(store, DATA, now)).toBe(true);
    expect(loadGame(store, ctx, now).data).toEqual(DATA);
  });

  it('a new player gets an empty save and nothing is written', () => {
    const { store, m } = memory();
    expect(loadGame(store, ctx, now)).toEqual({ data: EMPTY_SAVE, result: null });
    expect(m.size).toBe(0);
    expect(EMPTY_SAVE.profile).toEqual(NEW_PROFILE);
  });

  it('moves the old separate keys into the versioned save once', () => {
    const { store, json } = memory({
      'mathlegends.profile': { version: 1, ...DATA.profile },
      'mathlegends.settings': { version: 1, ...DATA.settings },
      'mathlegends.review': { version: 1, items: DATA.review },
    });
    const first = loadGame(store, ctx, now);
    expect(first.data).toEqual(DATA);
    expect(first.result).toMatchObject({ ok: true, migratedFrom: 1 });
    expect(json(SAVE_KEY)).toMatchObject({ version: SAVE_VERSION, profile: DATA.profile });
    const second = loadGame(store, ctx, now);
    expect(second.data).toEqual(DATA);
    expect(second.result).toMatchObject({ migratedFrom: null });
  });

  it('a damaged save is left alone (not overwritten) and the game starts fresh', () => {
    const bad = { ...writeSave(DATA, now), profile: { tier: 'x' } };
    const { store, json } = memory({ [SAVE_KEY]: bad });
    expect(loadGame(store, ctx, now).data).toEqual(EMPTY_SAVE);
    expect(json(SAVE_KEY)).toEqual(JSON.parse(JSON.stringify(bad)));
  });

  it('works when storage is blocked', () => {
    expect(loadGame(null, ctx, now).data).toEqual(EMPTY_SAVE);
    expect(saveGame(null, DATA, now)).toBe(false);
  });
});
