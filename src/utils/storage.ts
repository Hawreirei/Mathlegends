/**
 * Small, safe wrappers around localStorage (#23). Storage can be missing or throw
 * (private browsing, school devices with storage blocked), so every call is guarded.
 * The versioned profile save (#41) builds on this.
 */
import type { Lang } from '../systems/gameState';
import { detectLang } from './i18n';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const LANG_KEY = 'mathlegends.lang';
const REVIEW_KEY = 'mathlegends.review';
const ANSWER_LOG_KEY = 'mathlegends.answers';
const SETTINGS_KEY = 'mathlegends.settings';
const PROFILE_KEY = 'mathlegends.profile';
/** The versioned save (#41): profile, settings and review queue in one document. */
export const SAVE_KEY = 'mathlegends.save';

/** The browser's localStorage, or null if it is unavailable. */
export function browserStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadLang(store: KeyValueStore | null): Lang | null {
  try {
    const v = store?.getItem(LANG_KEY);
    return v === 'id' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(store: KeyValueStore | null, lang: Lang): void {
  try {
    store?.setItem(LANG_KEY, lang);
  } catch {
    // Storage blocked: the choice still applies for this session.
  }
}

/** Saved choice first, then the browser language, then Indonesian. */
export function initialLang(store: KeyValueStore | null, browserLang: string | undefined): Lang {
  return loadLang(store) ?? detectLang(browserLang);
}

/** Parsed JSON saved under `key`, or null if missing, unreadable or storage is blocked. */
export function loadJson(store: KeyValueStore | null, key: string): unknown {
  try {
    const v = store?.getItem(key);
    return v ? (JSON.parse(v) as unknown) : null;
  } catch {
    return null;
  }
}

/** Saves `data` as JSON; returns false if storage is blocked or full. */
export function saveJson(store: KeyValueStore | null, key: string, data: unknown): boolean {
  try {
    if (!store) return false;
    store.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Pre-#41 review queue key (read once to migrate into the versioned save). */
export const loadReviewRaw = (store: KeyValueStore | null): unknown => loadJson(store, REVIEW_KEY);

/** The anonymous answer log (#30) as parsed JSON, or null. Validate it with parseLog. */
export const loadAnswerLogRaw = (store: KeyValueStore | null): unknown =>
  loadJson(store, ANSWER_LOG_KEY);

export const saveAnswerLogRaw = (store: KeyValueStore | null, data: unknown): boolean =>
  saveJson(store, ANSWER_LOG_KEY, data);

/** Pre-#41 settings key (read once to migrate into the versioned save). */
export const loadSettingsRaw = (store: KeyValueStore | null): unknown =>
  loadJson(store, SETTINGS_KEY);

/** Pre-#41 profile key (read once to migrate into the versioned save). */
export const loadProfileRaw = (store: KeyValueStore | null): unknown =>
  loadJson(store, PROFILE_KEY);
