/**
 * Versioned save (#41). Pure TypeScript, no Phaser.
 *
 * One JSON document holds a player's progress: profile (Year, stars, placement), accessibility
 * settings and the review queue. It lives in localStorage under `mathlegends.save` and is the
 * format of the export file used to move progress to another device.
 *
 * Versions and migrations (each step only adds or reshapes, nothing is dropped):
 * - v1: the separate keys written by #29-#39 (`mathlegends.profile`, `.settings`, `.review`),
 *   gathered into { version: 1, profile, settings, review }. Profiles saved before #39 have no
 *   `lossesAtZero`.
 * - v2: { app: 'mathlegends', version: 2, savedAt, profile, settings, review } with
 *   `lossesAtZero` always present.
 *
 * The language stays a separate device preference (`mathlegends.lang`) and is not part of the
 * save; the answer log (#30) is research data with its own CSV export and is not either.
 */
import type { RanksFile } from './data';
import { NEW_PROFILE, parseProfile, type Profile } from './gameState';
import { parseReviewQueue, type ReviewItem } from './reviewQueue';
import { parseSettings, type Settings } from './settings';

export const SAVE_APP = 'mathlegends';
export const SAVE_VERSION = 2;

export interface SaveData {
  profile: Profile;
  settings: Settings;
  review: ReviewItem[];
}

export interface SaveFileV2 {
  app: typeof SAVE_APP;
  version: 2;
  savedAt: string;
  profile: Profile;
  settings: Settings;
  review: ReviewItem[];
}

/** What the loader needs to check the data. */
export interface SaveContext {
  ranks: RanksFile;
  topicTiers: Map<string, number>;
  textScales: readonly number[];
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {});

/** Migration from version n to n + 1. */
const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  1: (s) => ({
    app: SAVE_APP,
    version: 2,
    savedAt: typeof s.savedAt === 'string' ? s.savedAt : new Date(0).toISOString(),
    // Profiles from before #39 have no lossesAtZero: start the count at 0.
    profile: { lossesAtZero: 0, ...obj(s.profile) },
    settings: s.settings ?? null,
    // v1 kept the queue as { version, items }; v2 stores the list itself.
    review: Array.isArray(obj(s.review).items) ? obj(s.review).items : [],
  }),
};

export type LoadResult =
  | { ok: true; data: SaveData; migratedFrom: number | null }
  | { ok: false; reason: 'notASave' | 'tooNew' | 'invalid' };

/** Brings a save of any known version up to the current one and checks every part. */
export function readSave(raw: unknown, ctx: SaveContext): LoadResult {
  let s = obj(raw);
  const version = s.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return { ok: false, reason: 'notASave' };
  if (version >= 2 && s.app !== SAVE_APP) return { ok: false, reason: 'notASave' };
  if (version > SAVE_VERSION) return { ok: false, reason: 'tooNew' };
  for (let v = version; v < SAVE_VERSION; v++) s = MIGRATIONS[v]!(s);

  const p = obj(s.profile);
  // A profile that does not check out is a broken save, not a new player.
  const profile = parseProfile(p, ctx.ranks.tiers.length, ctx.ranks.starsPerTier);
  const profileOk =
    p.tier === profile.tier &&
    p.stars === profile.stars &&
    p.matchesPlayed === profile.matchesPlayed;
  if (!profileOk) return { ok: false, reason: 'invalid' };
  return {
    ok: true,
    migratedFrom: version < SAVE_VERSION ? version : null,
    data: {
      profile,
      settings: parseSettings(s.settings, ctx.textScales),
      review: parseReviewQueue(
        { items: Array.isArray(s.review) ? s.review : [] },
        ctx.ranks,
        ctx.topicTiers,
      ),
    },
  };
}

/** The current-version document for `data`. */
export const writeSave = (data: SaveData, now: Date): SaveFileV2 => ({
  app: SAVE_APP,
  version: SAVE_VERSION,
  savedAt: now.toISOString(),
  profile: { ...data.profile },
  settings: { ...data.settings },
  review: data.review.map((r) => ({ ...r })),
});

/**
 * The v1 save gathered from the separate keys written before #41 (each already parsed JSON or
 * null), or null if none of them exists.
 */
export function gatherV1(profile: unknown, settings: unknown, review: unknown): Raw | null {
  if (profile === null && settings === null && review === null) return null;
  return { version: 1, profile: profile ?? { ...NEW_PROFILE }, settings, review };
}

/** File name like "mathlegends-save-2026-11-01.json". */
export const saveFileName = (now: Date) =>
  `mathlegends-save-${now.toISOString().slice(0, 10)}.json`;
