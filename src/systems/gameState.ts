/**
 * Typed state shared by all scenes (#15). Pure data and functions, no Phaser.
 * Persistence (localStorage) comes in #41; rank changes in #39.
 */
export type Lang = 'id' | 'en';

export interface MatchResult {
  outcome: 'victory' | 'defeat';
  durationSec: number;
  answered: number;
  correct: number;
}

export interface Profile {
  tier: number;
  stars: number;
  matchesPlayed: number;
}

export interface GameState {
  lang: Lang;
  profile: Profile;
  lastMatch: MatchResult | null;
}

export function createGameState(lang: Lang): GameState {
  return { lang, profile: { tier: 1, stars: 0, matchesPlayed: 0 }, lastMatch: null };
}

export function setLang(s: GameState, lang: Lang): GameState {
  return { ...s, lang };
}

export function recordMatch(s: GameState, result: MatchResult): GameState {
  return {
    ...s,
    profile: { ...s.profile, matchesPlayed: s.profile.matchesPlayed + 1 },
    lastMatch: { ...result },
  };
}

export function formatDuration(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
