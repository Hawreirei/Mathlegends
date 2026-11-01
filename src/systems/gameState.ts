/**
 * Typed state shared by all scenes (#15). Pure data and functions, no Phaser.
 * Persistence (localStorage) comes in #41; rank changes in #39.
 */
import type { MissedQuestion, ReviewItem } from './reviewQueue';
import { DEFAULT_SETTINGS, type Settings } from './settings';

export type Lang = 'id' | 'en';

export interface MatchResult {
  outcome: 'victory' | 'defeat';
  durationSec: number;
  answered: number;
  correct: number;
  /** Wrong or timed-out questions, for the Result screen (#29). */
  missed: MissedQuestion[];
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
  /** Missed questions waiting to come back in the next matches (#29). */
  review: ReviewItem[];
  /** Accessibility options (#31). */
  settings: Settings;
}

export function createGameState(
  lang: Lang,
  review: ReviewItem[] = [],
  settings: Settings = DEFAULT_SETTINGS,
): GameState {
  return {
    lang,
    profile: { tier: 1, stars: 0, matchesPlayed: 0 },
    lastMatch: null,
    review,
    settings: { ...settings },
  };
}

export function setSettings(s: GameState, settings: Settings): GameState {
  return { ...s, settings: { ...settings } };
}

export function setLang(s: GameState, lang: Lang): GameState {
  return { ...s, lang };
}

/** Records a finished match; `review` is the review queue after it (updateReviewQueue). */
export function recordMatch(
  s: GameState,
  result: MatchResult,
  review: ReviewItem[] = s.review,
): GameState {
  return {
    ...s,
    review,
    profile: { ...s.profile, matchesPlayed: s.profile.matchesPlayed + 1 },
    lastMatch: { ...result, missed: [...result.missed] },
  };
}

export function formatDuration(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
