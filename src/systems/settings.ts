/**
 * Accessibility settings (#31). Pure TypeScript, no Phaser.
 *
 * - textScale: one of theme.json textScales (1, 1.2, 1.4). Enlarges the reading parts of the game:
 *   the question card, its answers, the feedback note and the Result screen review.
 * - colorBlind: swaps the right/wrong colours for a colour-blind-safe pair (theme.json colorBlind).
 * - extraTime: every question timer x economy.json extraTimeMultiplier (1.5).
 * - sound / music (#45): sound effects and background music, each on or off (the mute switches).
 * - reduceMotion (#45): no screen shake.
 */
import type { EconomyConfig } from './economy';

export interface Settings {
  textScale: number;
  colorBlind: boolean;
  extraTime: boolean;
  sound: boolean;
  music: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  textScale: 1,
  colorBlind: false,
  extraTime: false,
  sound: true,
  music: true,
  reduceMotion: false,
};

/** Saved settings from storage; anything missing or invalid falls back to the default. */
export function parseSettings(raw: unknown, textScales: readonly number[]): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return {
    textScale:
      typeof r.textScale === 'number' && textScales.includes(r.textScale)
        ? r.textScale
        : DEFAULT_SETTINGS.textScale,
    colorBlind: typeof r.colorBlind === 'boolean' ? r.colorBlind : DEFAULT_SETTINGS.colorBlind,
    extraTime: typeof r.extraTime === 'boolean' ? r.extraTime : DEFAULT_SETTINGS.extraTime,
    sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_SETTINGS.sound,
    music: typeof r.music === 'boolean' ? r.music : DEFAULT_SETTINGS.music,
    reduceMotion:
      typeof r.reduceMotion === 'boolean' ? r.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
  };
}

export const serializeSettings = (s: Settings) => ({ version: 1, ...s });

/** Multiplier for every question timer. */
export const timeScale = (s: Settings, econ: EconomyConfig): number =>
  s.extraTime ? econ.extraTimeMultiplier : 1;
