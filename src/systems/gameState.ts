/**
 * Typed state shared by all scenes (#15). Pure data and functions, no Phaser.
 * Persistence (localStorage) comes in #41; rank changes in #39.
 */
import type { MissedQuestion, ReviewItem } from './reviewQueue';
import type { RankChange } from './rank';
import { DEFAULT_SETTINGS, type Settings } from './settings';

export type Lang = 'id' | 'en';

export interface MatchResult {
  outcome: 'victory' | 'defeat';
  durationSec: number;
  answered: number;
  correct: number;
  /** Wrong or timed-out questions, for the Result screen (#29). */
  missed: MissedQuestion[];
  /** Stars won or lost and any Year change (#39); absent in older results. */
  rank?: RankChange;
  /** The player left the match early (#44). */
  forfeit?: boolean;
}

export interface Profile {
  /** True once the placement quiz (#38) has set the starting Year. */
  placed: boolean;
  /** Losses in a row while at 0 stars (#39: 2 drop a Year). */
  lossesAtZero: number;
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

export const NEW_PROFILE: Profile = {
  placed: false,
  tier: 1,
  stars: 0,
  lossesAtZero: 0,
  matchesPlayed: 0,
};

export function createGameState(
  lang: Lang,
  review: ReviewItem[] = [],
  settings: Settings = DEFAULT_SETTINGS,
  profile: Profile = NEW_PROFILE,
): GameState {
  return {
    lang,
    profile: { ...profile },
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

/**
 * Records a finished match; `review` is the review queue after it (updateReviewQueue). The
 * profile's Year and stars become `result.rank.after` (#39) when given.
 */
export function recordMatch(
  s: GameState,
  result: MatchResult,
  review: ReviewItem[] = s.review,
): GameState {
  return {
    ...s,
    review,
    profile: {
      ...s.profile,
      ...(result.rank ? result.rank.after : {}),
      matchesPlayed: s.profile.matchesPlayed + 1,
    },
    lastMatch: { ...result, missed: [...result.missed] },
  };
}

export function formatDuration(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** After the placement quiz (#38): start at `tier` with 0 stars. */
export function applyPlacement(s: GameState, tier: number): GameState {
  return { ...s, profile: { ...s.profile, placed: true, tier, stars: 0, lossesAtZero: 0 } };
}

/** "Retake the placement quiz": the next Play starts with the quiz again. */
export function resetPlacement(s: GameState): GameState {
  return { ...s, profile: { ...s.profile, placed: false } };
}

/**
 * Saved profile from storage, or a new one. Anything malformed falls back to the new profile.
 * (A versioned save with export/import comes in #41.)
 */
export function parseProfile(raw: unknown, topTier: number, starsPerTier = 5): Profile {
  if (!raw || typeof raw !== 'object') return { ...NEW_PROFILE };
  const r = raw as Partial<Profile>;
  const int = (v: unknown, min: number, max: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  if (!int(r.tier, 1, topTier) || !int(r.stars, 0, 1e6) || !int(r.matchesPlayed, 0, 1e9))
    return { ...NEW_PROFILE };
  // Below the top Year stars stay under starsPerTier; the top Year has no cap (#39).
  if (r.tier! < topTier && r.stars! >= starsPerTier) return { ...NEW_PROFILE };
  return {
    placed: r.placed === true,
    tier: r.tier!,
    stars: r.stars!,
    lossesAtZero: int(r.lossesAtZero, 0, 100) ? r.lossesAtZero! : 0,
    matchesPlayed: r.matchesPlayed!,
  };
}

export const serializeProfile = (p: Profile) => ({ version: 1, ...p });
