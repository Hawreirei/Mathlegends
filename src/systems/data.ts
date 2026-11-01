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
/** Emblems scripts/build-sprites.ts can draw on a hero token. */
export const HERO_EMBLEMS = ['sparkle', 'flower', 'moon', 'leaf'] as const;

export const heroSchema = z
  .object({
    id,
    name: localized,
    /** Short epithet shown with the name, e.g. "Star Strider" (#32). */
    title: localized,
    role: z.enum(HERO_ROLES),
    lore: localized,
    /**
     * How the generated sprite looks (#32): team colour from theme.json teams and an emblem.
     * `npm run build:sprites` draws `sprite` from this, so a new hero needs JSON only.
     */
    look: z.object({ color: z.enum(['blue', 'red']), emblem: z.enum(HERO_EMBLEMS) }).strict(),
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
    /** Texture key, always `hero-<id>`; generated from `look` by npm run build:sprites. */
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
    f.heroes.forEach((h, i) => {
      if (h.sprite !== `hero-${h.id}`)
        ctx.addIssue({
          code: 'custom',
          path: ['heroes', i, 'sprite'],
          message: `sprite must be "hero-${h.id}" (generated from look by npm run build:sprites)`,
        });
    });
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

// ---------- skills.json (#33)

const scaling = z
  .object({
    base: nonNegative,
    /** Added per hero level above 1. */
    perLevel: nonNegative,
    /** x the caster's ATK. */
    atkRatio: z.number().min(0).optional(),
    /** x the caster's max HP (shields). */
    maxHpRatio: z.number().min(0).optional(),
  })
  .strict();

export const SKILL_STATS = ['atk', 'armor', 'moveSpeed', 'attackSpeed'] as const;

const effectSchema = z.discriminatedUnion('kind', [
  /** Flies from the caster towards the target; hits the first enemy it touches (or all, with pierce). */
  z
    .object({
      kind: z.literal('projectile'),
      damage: scaling,
      /** Pixels per second; it flies up to the skill's range. */
      speed: positive,
      /** Hit radius in pixels. */
      radius: positive,
      pierce: z.boolean(),
    })
    .strict(),
  /** Damages every enemy within radius of the caster (`self`) or of the target (`target`). */
  z
    .object({
      kind: z.literal('aoe'),
      centre: z.enum(['self', 'target']),
      radius: positive,
      damage: scaling,
    })
    .strict(),
  /** Moves the caster up to `distance` pixels towards the target (or the way it faces). */
  z.object({ kind: z.literal('dash'), distance: positive }).strict(),
  /** Raises one of the caster's stats for `duration` seconds: x mult and/or + add. */
  z
    .object({
      kind: z.literal('buff'),
      stat: z.enum(SKILL_STATS),
      mult: positive.optional(),
      add: z.number().optional(),
      duration: positive,
    })
    .strict(),
  /** Absorbs damage before HP for `duration` seconds. */
  z.object({ kind: z.literal('shield'), amount: scaling, duration: positive }).strict(),
]);

export const skillSchema = z
  .object({
    id,
    name: localized,
    description: localized,
    /** The ultimate takes the 4th slot. */
    ultimate: z.boolean(),
    /** Hero level needed to cast it. */
    unlockLevel: z.number().int().min(1),
    /** Seconds. */
    cooldown: positive,
    mana: nonNegative,
    /** Pixels: how far the skill looks for a target (0 = self only). */
    range: nonNegative,
    effects: z.array(effectSchema).min(1),
  })
  .strict();

export const skillsFileSchema = z
  .object({ version: z.literal(1), _note: z.string().optional(), skills: z.array(skillSchema) })
  .strict()
  .superRefine((f, ctx) => uniqueIds(f.skills, ctx, 'skills'));

export type Skill = z.infer<typeof skillSchema>;
export type SkillEffect = z.infer<typeof effectSchema>;
export type SkillsFile = z.infer<typeof skillsFileSchema>;
export const loadSkills = (raw: unknown): SkillsFile => parse(skillsFileSchema, raw, 'skills.json');

/**
 * Every hero's skills exist in skills.json, the ultimate (if any) is last, and there is at most one.
 * Returns problems; empty means fine (checked at load and in CI).
 */
export function checkHeroSkills(heroes: HeroesFile, skills: SkillsFile): string[] {
  const byId = new Map(skills.skills.map((s) => [s.id, s]));
  const out: string[] = [];
  for (const h of heroes.heroes) {
    const list = h.skills.map((id) => byId.get(id));
    h.skills.forEach((id, i) => {
      if (!list[i]) out.push(`${h.id}: skill "${id}" is not in skills.json`);
    });
    const ults = list.filter((s) => s?.ultimate);
    if (ults.length > 1) out.push(`${h.id}: more than one ultimate`);
    if (ults.length === 1 && !list[list.length - 1]?.ultimate)
      out.push(`${h.id}: the ultimate must be the last skill`);
  }
  return out;
}
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

/** What an item passive does (#36). Implemented in src/systems/items.ts and match.ts. */
const passiveEffect = z.discriminatedUnion('kind', [
  /** Extra damage on every basic attack (through armour). */
  z.object({ kind: z.literal('onHitDamage'), amount: positive }).strict(),
  /** Skill cooldowns shorter by this fraction (all sources together at most 40%). */
  z.object({ kind: z.literal('cooldownReduction'), amount: z.number().gt(0).max(0.4) }).strict(),
  /** Skill damage x (1 + amount). */
  z.object({ kind: z.literal('skillPower'), amount: z.number().gt(0).max(1) }).strict(),
  /** When HP falls below hpBelow x max HP: a shield of maxHpRatio x max HP for duration s; then wait cooldown s. */
  z
    .object({
      kind: z.literal('lowHpShield'),
      hpBelow: z.number().gt(0).lt(1),
      maxHpRatio: z.number().gt(0).max(1),
      duration: positive,
      cooldown: positive,
    })
    .strict(),
]);

export type PassiveEffect = z.infer<typeof passiveEffect>;

export const itemSchema = z
  .object({
    id,
    name: localized,
    description: localized,
    category: z.enum(ITEM_CATEGORIES),
    cost: z.number().int().positive(),
    stats: itemStats,
    /** A passive (#36). Unique passives with the same id count once, however many you own. */
    passive: z
      .object({ id, unique: z.boolean(), description: localized, effect: passiveEffect })
      .strict()
      .optional(),
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
        /** The Year of the first question (#38). */
        firstTier: z.number().int().positive(),
        /** Timer per placement question; a timeout counts as wrong. */
        secondsPerQuestion: z.number().positive(),
        questionType: z.enum(['fluency', 'application', 'multistep']),
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
        /** Stars after dropping a Year (#39). */
        starsAfterDemotion: z.number().int().min(0),
        /** The accuracy bonus needs at least this many answered questions (#39). */
        bonusMinAnswered: z.number().int().min(0),
        /** The top Year keeps counting stars past starsPerTier (decided 2026-11-01). */
        topTierUncapped: z.boolean(),
      })
      .strict(),
    questionMix: z.object({ onLevel: fraction, review: fraction, stretch: fraction }).strict(),
    questionEngine: z
      .object({
        /** No question repeats within this many questions (#26). */
        repeatWindow: z.number().int().positive(),
        /** Share of review picks taken from the tier just below; the rest from any lower tier. */
        reviewPreviousTierShare: fraction,
        /** A missed question comes back within this many matches (#29). */
        reviewMatches: z.number().int().positive(),
        /** At most one review question in every this many questions, unless one is on its last match. */
        reviewEvery: z.number().int().positive(),
        /** Most questions kept in the review queue (the oldest go first). */
        reviewQueueMax: z.number().int().positive(),
        /**
         * Stretch at the top Year (#40), where there is no Year above: `harderType` asks the next
         * harder question type of the top Year (fluency -> application -> multistep), with that
         * type's timer; `sameType` asks a normal top-Year question.
         */
        topTierStretch: z.enum(['harderType', 'sameType']),
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
    if (r.stars.starsAfterDemotion >= r.starsPerTier)
      ctx.addIssue({
        code: 'custom',
        path: ['stars', 'starsAfterDemotion'],
        message: `starsAfterDemotion must be below starsPerTier (${r.starsPerTier})`,
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

// ---------- bot.json (#24, #43)

const botSettings = z
  .object({
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
    /** Chance of taking a last hit it could take (otherwise it mistimes that one) (#43). */
    lastHitAccuracy: fraction,
    /** Chance of using a ready skill when it has a reason to, at each decision (#43). */
    skillUseChance: fraction,
    /** Uses shield/buff-only skills below this fraction of max HP (or when fighting) (#43). */
    defensiveSkillHpFraction: fraction,
    /** Waits this long after it could afford the next item before buying it (#43). */
    itemDelaySec: nonNegative,
  })
  .strict();

const botOverride = botSettings.partial().strict();

export const botFileSchema = z
  .object({
    version: z.literal(2),
    _note: z.string().optional(),
    base: botSettings,
    /** One difficulty step per Year tier, 1 to 6 (#43). Each overrides `base`. */
    tiers: z.array(botOverride.extend({ tier: z.number().int().min(1) }).strict()).min(1),
    /** The simulator's stand-in for a child in their first matches (#43). */
    newPlayer: botOverride,
    /** Items the bot buys, in order (ids from items.json). */
    buildOrder: z.array(id),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.tiers.some((t, i) => t.tier !== i + 1))
      ctx.addIssue({
        code: 'custom',
        path: ['tiers'],
        message: 'tiers must be 1, 2, 3, ... in order',
      });
    for (const [i, o] of [f.base, ...f.tiers, { ...f.base, ...f.newPlayer }].entries()) {
      const b = { ...f.base, ...o };
      if (b.returnHpFraction <= b.retreatHpFraction)
        ctx.addIssue({
          code: 'custom',
          path: [i === 0 ? 'base' : 'tiers', 'returnHpFraction'],
          message: 'returnHpFraction must be above retreatHpFraction',
        });
    }
  });

export type BotFile = z.infer<typeof botFileSchema>;
export type BotConfig = z.infer<typeof botSettings> & { buildOrder: string[] };
export const loadBotFile = (raw: unknown): BotFile => parse(botFileSchema, raw, 'bot.json');

/** The bot's settings for a Year tier (#43): base + that Year's step (clamped to 1..6). */
export function botForTier(f: BotFile, tier: number): BotConfig {
  const t = f.tiers[Math.max(0, Math.min(f.tiers.length - 1, tier - 1))]!;
  const over: Partial<BotFile['base']> & { tier?: number } = { ...t };
  delete over.tier;
  return { ...f.base, ...over, buildOrder: f.buildOrder };
}

/** The simulator's "new player" settings (#43). */
export const newPlayerBot = (f: BotFile): BotConfig => ({
  ...f.base,
  ...f.newPlayer,
  buildOrder: f.buildOrder,
});

/** bot.json for a Year tier (3, the middle, when not given): base + that Year's step. */
export const loadBot = (raw: unknown, tier = 3): BotConfig => botForTier(loadBotFile(raw), tier);
