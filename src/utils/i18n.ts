/**
 * Minimal string lookup (#15). Every player-facing string comes from src/data/i18n/
 * (AGENTS.md rule 6a). The language toggle and saving the choice come in #23.
 */
import id from '../data/i18n/id.json';
import en from '../data/i18n/en.json';
import type { Lang } from '../systems/gameState';

export type StringKey = keyof typeof id;
const STRINGS: Record<Lang, Record<StringKey, string>> = { id, en };

export function t(lang: Lang, key: StringKey, vars: Record<string, string | number> = {}): string {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

/** English if the browser prefers English, otherwise Indonesian. */
export function detectLang(browserLang: string | undefined): Lang {
  return browserLang?.toLowerCase().startsWith('en') ? 'en' : 'id';
}
