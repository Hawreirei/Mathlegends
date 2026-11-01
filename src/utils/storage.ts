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
