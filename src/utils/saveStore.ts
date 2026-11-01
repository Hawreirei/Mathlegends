/**
 * Loading and writing the versioned save (#41) on the device. Works with any KeyValueStore, so
 * tests use an in-memory one.
 */
import { NEW_PROFILE } from '../systems/gameState';
import {
  gatherV1,
  readSave,
  writeSave,
  type LoadResult,
  type SaveContext,
  type SaveData,
} from '../systems/save';
import { DEFAULT_SETTINGS } from '../systems/settings';
import {
  loadJson,
  loadProfileRaw,
  loadReviewRaw,
  loadSettingsRaw,
  saveJson,
  SAVE_KEY,
  type KeyValueStore,
} from './storage';

export const EMPTY_SAVE: SaveData = {
  profile: { ...NEW_PROFILE },
  settings: DEFAULT_SETTINGS,
  review: [],
};

/**
 * The saved progress: the versioned save if there is one, else the pre-#41 keys migrated (and
 * written back as the versioned save), else a new player. A save that does not check out is
 * left untouched in storage and the game starts fresh, so nothing is overwritten by accident.
 */
export function loadGame(
  store: KeyValueStore | null,
  ctx: SaveContext,
  now: Date,
): { data: SaveData; result: LoadResult | null } {
  const raw =
    loadJson(store, SAVE_KEY) ??
    gatherV1(loadProfileRaw(store), loadSettingsRaw(store), loadReviewRaw(store));
  if (raw === null) return { data: EMPTY_SAVE, result: null };
  const result = readSave(raw, ctx);
  if (!result.ok) return { data: EMPTY_SAVE, result };
  if (result.migratedFrom !== null) saveJson(store, SAVE_KEY, writeSave(result.data, now));
  return { data: result.data, result };
}

/** Writes the current progress as the versioned save. */
export const saveGame = (store: KeyValueStore | null, data: SaveData, now: Date): boolean =>
  saveJson(store, SAVE_KEY, writeSave(data, now));
