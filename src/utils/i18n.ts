/**
 * String lookup (#15, #23). Every player-facing string comes from src/data/i18n/
 * (AGENTS.md rule 6a); question text comes from the question bank in both languages.
 */
import id from '../data/i18n/id.json';
import en from '../data/i18n/en.json';
import type { Lang } from '../systems/gameState';
import type { Choice, LocalizedText } from '../systems/questions';

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

/** Text from the question bank (stem, explanation) in the chosen language. */
export const localize = (text: LocalizedText, lang: Lang): string => text[lang];

/** A question choice as shown on screen: numbers and neutral strings as-is, localized text in `lang`. */
export function choiceText(c: Choice, lang: Lang): string {
  return typeof c === 'number' ? String(c) : typeof c === 'string' ? c : c[lang];
}
