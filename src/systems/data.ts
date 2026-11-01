/**
 * Schemas and loaders for heroes.json, items.json and ranks.json (#13).
 * Pure TypeScript, no Phaser. Every loader validates at load time and throws a DataError
 * that names the file and the exact field (AGENTS.md rule 4).
 */
import { z } from 'zod';

export class DataError extends Error {
  constructor(file: string, problems: string[]) {
    super(
      `Invalid ${file} (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${problems.map((p) => `  ${file}: ${p}`).join('\n')}`,
    );
    this.name = 'DataError';
  }
}

const text = z.string().trim().min(1);
/** Player-facing text in both languages (AGENTS.md rule 6a). */
const localized = z.object({ id: text, en: text }).strict();
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'must be lowercase letters, digits and "-"');
const positive = z.number().positive();
const nonNegative = z.number().min(0);

function path(p: PropertyKey[]): string {
  return p.reduce<string>(
    (s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${String(k)}` : String(k)),
    '',
  );
}

function parse<T>(schema: z.ZodType<T>, raw: unknown, file: string): T {
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  throw new DataError(
    file,
    r.error.issues.map((i) => {
      const where = path(i.path) || '(root)';
      return `${where}: ${i.message}`;
    }),
  );
}

/** Adds an issue for every repeated `id` in a list. */
function uniqueIds(list: { id: string }[], ctx: z.RefinementCtx, key: string) {
  const seen = new Set<string>();
  list.forEach((x, i) => {
    if (seen.has(x.id))
      ctx.addIssue({ code: 'custom', path: [key, i, 'id'], message: `duplicate id "${x.id}"` });
    seen.add(x.id);
  });
}

// ---------- heroes.json

export const HERO_ROLES = ['tank', 'fighter', 'mage', 'marksman', 'support'] as const;

export const heroSchema = z
  .object({
    id,
    name: localized,
    role: z.enum(HERO_ROLES),
    lore: localized,
    base: z
      .object({
        hp: positive,
        mana: nonNegative,
        atk: positive,
        armor: nonNegative,
        /** Pixels per second. */
        moveSpeed: positive,
        /** Pixels. */
        attackRange: positive,
        /** Attacks per second. */
        attackSpeed: positive,
        /** Per second. */
        hpRegen: nonNegative,
        manaRegen: nonNegative,
      })
      .strict(),
    /** Added per level above 1. */
    growth: z
      .object({ hp: nonNegative, mana: nonNegative, atk: nonNegative, armor: nonNegative })
      .strict(),
    /** Skill ids (defined in #33): 3 skills + 1 ultimate at most. */
    skills: z.array(id).max(4),
    /** Texture key; the asset is listed in docs/ASSETS.md. */
    sprite: id,
  })
  .strict();

export const heroesFileSchema = z
  .object({
    version: z.literal(1),
    /** Hero the player controls (#17). One playable hero in the MVP. */
    playerHero: id.optional(),
    /** Hero the bot plays (#24). */
    botHero: id.optional(),
    heroes: z.array(heroSchema),
  })
  .strict()
  .superRefine((f, ctx) => {
    uniqueIds(f.heroes, ctx, 'heroes');
    for (const key of ['playerHero', 'botHero'] as const) {
      const ref = f[key];
      if (ref !== undefined && !f.heroes.some((h) => h.id === ref))
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `"${ref}" is not a hero in this file`,
        });
    }
  });

export type Hero = z.infer<typeof heroSchema>;
export type HeroesFile = z.infer<typeof heroesFileSchema>;
export const loadHeroes = (raw: unknown): HeroesFile => parse(heroesFileSchema, raw, 'heroes.json');

// ---------- items.json

export const ITEM_CATEGORIES = ['attack', 'magic', 'defense', 'movement', 'support'] as const;

const itemStats = z
  .object({
    hp: positive,
    mana: positive,
    atk: positive,
    armor: positive,
    moveSpeed: positive,
    /** Added to attacks per second. */
    attackSpeed: positive,
    hpRegen: positive,
    manaRegen: positive,
    /** Fraction of damage dealt returned as HP, 0 to 1. */
    lifesteal: z.number().gt(0).max(1),
  })
  .partial()
  .strict();

export const itemSchema = z
  .object({
    id,
    name: localized,
    description: localized,
    category: z.enum(ITEM_CATEGORIES),
    cost: z.number().int().positive(),
    stats: itemStats,
    /** Unique passives with the same id do not stack (#36). */
    passive: z.object({ id, unique: z.boolean(), description: localized }).strict().optional(),
    icon: id.optional(),
  })
  .strict()
  .refine((it) => Object.keys(it.stats).length > 0 || it.passive, {
    message: 'an item needs at least one stat or a passive',
    path: ['stats'],
  });

export const itemsFileSchema = z
  .object({ version: z.literal(1), items: z.array(itemSchema) })
  .strict()
  .superRefine((f, ctx) => uniqueIds(f.items, ctx, 'items'));

export type Item = z.infer<typeof itemSchema>;
export type ItemsFile = z.infer<typeof itemsFileSchema>;
export const loadItems = (raw: unknown): ItemsFile => parse(itemsFileSchema, raw, 'items.json');

// ---------- ranks.json

const fraction = z.number().min(0).max(1);

export const ranksFileSchema = z
  .object({
    version: z.literal(1),
    starsPerTier: z.number().int().positive(),
    tiers: z
      .array(z.object({ tier: z.number().int().positive(), label: localized, badge: id }).strict())
      .min(1),
    placement: z
      .object({
        questions: z.number().int().positive(),
        /** Start tier = estimated mastery + startOffset, then capped. */
        startOffset: z.number().int(),
        maxStartTier: z.number().int().positive(),
      })
      .strict(),
    stars: z
      .object({
        win: z.number().int().positive(),
        loss: z.number().int().negative(),
        bonusAccuracy: fraction,
        bonusStars: z.number().int().min(0),
        /** Straight losses at 0 stars before dropping a tier. */
        demoteAfterLossesAtZero: z.number().int().positive(),
      })
      .strict(),
    questionMix: z.object({ onLevel: fraction, review: fraction, stretch: fraction }).strict(),
    questionEngine: z
      .object({
        /** No question repeats within this many questions (#26). */
        repeatWindow: z.number().int().positive(),
        /** Share of review picks taken from the tier just below; the rest from any lower tier. */
        reviewPreviousTierShare: fraction,
      })
      .strict(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.tiers.some((t, i) => t.tier !== i + 1))
      ctx.addIssue({
        code: 'custom',
        path: ['tiers'],
        message: 'tiers must be numbered 1, 2, 3, ... in order',
      });
    if (r.placement.maxStartTier > r.tiers.length)
      ctx.addIssue({
        code: 'custom',
        path: ['placement', 'maxStartTier'],
        message: `maxStartTier (${r.placement.maxStartTier}) is above the top tier (${r.tiers.length})`,
      });
    const m = r.questionMix;
    if (Math.abs(m.onLevel + m.review + m.stretch - 1) > 1e-9)
      ctx.addIssue({
        code: 'custom',
        path: ['questionMix'],
        message: 'questionMix must add up to 1',
      });
  });

export type RanksFile = z.infer<typeof ranksFileSchema>;
export const loadRanks = (raw: unknown): RanksFile => parse(ranksFileSchema, raw, 'ranks.json');

// ---------- minions.json (#20)

const minionStats = z
  .object({
    hp: positive,
    atk: positive,
    armor: nonNegative,
    attackRange: positive,
    attackSpeed: positive,
    moveSpeed: positive,
    /** Pixels: how far a minion notices enemies. Must be at least its attack range. */
    aggroRange: positive,
    radius: positive,
    hpRegen: nonNegative,
  })
  .strict()
  .refine((m) => m.aggroRange >= m.attackRange, {
    message: 'aggroRange must be at least attackRange',
    path: ['aggroRange'],
  });

export const minionsFileSchema = z
  .object({
    version: z.literal(1),
    _note: z.string().optional(),
    types: z.object({ infantry: minionStats, lancer: minionStats, cannon: minionStats }).strict(),
    /** Pixels between minions in a spawned wave. */
    spacing: positive,
    /** Minions keep at least their radius plus this from any hero, so heroes stay visible in a fight. */
    heroBodyRadius: nonNegative,
  })
  .strict();

export type MinionsFile = z.infer<typeof minionsFileSchema>;
export const loadMinions = (raw: unknown): MinionsFile =>
  parse(minionsFileSchema, raw, 'minions.json');

// ---------- structures.json (#21)

export const structuresFileSchema = z
  .object({
    version: z.literal(1),
    _note: z.string().optional(),
    tower: z
      .object({
        hp: positive,
        atk: positive,
        armor: nonNegative,
        attackRange: positive,
        attackSpeed: positive,
      })
      .strict(),
    nexus: z.object({ hp: positive, armor: nonNegative }).strict(),
    /** Show an enemy tower's range ring when the player is within this distance of its edge. */
    dangerRingDistance: nonNegative,
  })
  .strict();

export type StructuresFile = z.infer<typeof structuresFileSchema>;
export const loadStructures = (raw: unknown): StructuresFile =>
  parse(structuresFileSchema, raw, 'structures.json');

// ---------- bot.json (#24)

export const botFileSchema = z
  .object({
    version: z.literal(1),
    _note: z.string().optional(),
    /** Seconds between decisions (the bot's reaction time). */
    decisionIntervalSec: positive,
    /** Go back to base below this fraction of max HP... */
    retreatHpFraction: fraction,
    /** ...and come back to the lane at or above this one. */
    returnHpFraction: fraction,
    /** Go after the player when they are this close (pixels). */
    engageRange: positive,
    /** Only fight the player at or above this fraction of max HP. */
    engageMinHpFraction: fraction,
    /** Walk up to minions this far beyond attack range. */
    acquireRangeBonus: nonNegative,
    /** Stand this far behind the front friendly minion. */
    holdBackPx: nonNegative,
    /** Stay this much further out than an enemy tower's range when no friendly minion is there. */
    towerSafetyMarginPx: nonNegative,
  })
  .strict()
  .refine((b) => b.returnHpFraction > b.retreatHpFraction, {
    message: 'returnHpFraction must be above retreatHpFraction',
    path: ['returnHpFraction'],
  });

export type BotConfig = z.infer<typeof botFileSchema>;
export const loadBot = (raw: unknown): BotConfig => parse(botFileSchema, raw, 'bot.json');
