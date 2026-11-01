/**
 * Economy and combat rules. Pure TypeScript, no Phaser (AGENTS.md rule 2).
 * Every number comes from src/data/economy.json (rule 3).
 */

export type MinionType = 'infantry' | 'lancer' | 'cannon';
export type AnswerOutcome = 'correct' | 'wrong' | 'timeout';

export interface EconomyConfig {
  version: number;
  match: {
    targetMinutes: number;
    firstWaveSeconds: number;
    waveIntervalSeconds: number;
    cannonEveryNthWave: number;
    wave: Record<MinionType, number>;
  };
  passiveGoldPerSecond: number;
  startingGold: number;
  lastHitGold: Record<MinionType, number>;
  otherGold: { heroKill: number; tower: number };
  reward: {
    correct: number;
    wrong: number;
    timeout: number;
    streakBonusPerCorrect: number;
    streakBonusCap: number;
  };
  fairness: { mathShareTarget: number[]; mathShareCap: number };
  questionSeconds: Record<MinionType, number>;
  /** How long the card shows the right answer after an answer or timeout (#29). */
  questionRevealSeconds: number;
  /** Question timers x this when the Extra time setting is on (#31). */
  extraTimeMultiplier: number;
  /** Skill damage over windowSec may be at most maxRatio x basic-attack damage (#34). */
  skillBudget: { windowSec: number; maxRatio: number };
  exp: {
    minion: Record<MinionType, number>;
    heroKill: number;
    shareRangePx: number;
    baseToLevel2: number;
    growthPerLevel: number;
    levelCap: number;
  };
  combat: {
    armorConstant: number;
    minDamage: number;
    respawnBaseSeconds: number;
    respawnPerLevelSeconds: number;
  };
  shop: { slots: number; sellRefund: number };
  estimate: {
    lastHitRate: number;
    expShareRate: number;
    heroKills: number;
    towersDestroyed: number;
  };
}

const MINIONS: MinionType[] = ['infantry', 'lancer', 'cannon'];

/** Returns a list of problems; empty means the config is valid. */
export function validateEconomy(c: EconomyConfig): string[] {
  const e: string[] = [];
  const pos = (path: string, v: unknown) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)
      e.push(`${path} must be a positive number (got ${String(v)})`);
  };
  const frac = (path: string, v: unknown) => {
    if (typeof v !== 'number' || v < 0 || v > 1)
      e.push(`${path} must be between 0 and 1 (got ${String(v)})`);
  };
  for (const m of MINIONS) {
    pos(`lastHitGold.${m}`, c.lastHitGold?.[m]);
    pos(`questionSeconds.${m}`, c.questionSeconds?.[m]);
    pos(`exp.minion.${m}`, c.exp?.minion?.[m]);
  }
  pos('passiveGoldPerSecond', c.passiveGoldPerSecond);
  pos('questionRevealSeconds', c.questionRevealSeconds);
  pos('skillBudget.windowSec', c.skillBudget?.windowSec);
  pos('skillBudget.maxRatio', c.skillBudget?.maxRatio);
  if (!(c.extraTimeMultiplier >= 1)) e.push('extraTimeMultiplier must be at least 1');
  pos('match.waveIntervalSeconds', c.match?.waveIntervalSeconds);
  pos('combat.armorConstant', c.combat?.armorConstant);
  if (!(c.reward?.correct > 1)) e.push(`reward.correct must be above 1 (got ${c.reward?.correct})`);
  if (!(c.reward?.wrong > 0 && c.reward.wrong < 1)) e.push('reward.wrong must be between 0 and 1');
  if (!(c.reward?.timeout > 0 && c.reward.timeout < 1))
    e.push('reward.timeout must be between 0 and 1');
  if (c.reward && c.reward.timeout > c.reward.wrong)
    e.push('reward.timeout must not pay more than reward.wrong');
  frac('reward.streakBonusCap', c.reward?.streakBonusCap);
  frac('fairness.mathShareCap', c.fairness?.mathShareCap);
  frac('shop.sellRefund', c.shop?.sellRefund);
  if (!Number.isInteger(c.exp?.levelCap) || c.exp.levelCap < 2)
    e.push('exp.levelCap must be an integer >= 2');
  return e;
}

/** Damage = ATK x K / (K + ARMOR), K = combat.armorConstant (100). */
export function damage(atk: number, armor: number, k = 100, min = 1): number {
  if (atk <= 0) return 0;
  return Math.max(min, (atk * k) / (k + Math.max(0, armor)));
}

/** Gold/EXP multiplier for an answer. `priorStreak` = correct answers in a row before this one. */
export function rewardMultiplier(
  c: EconomyConfig,
  outcome: AnswerOutcome,
  priorStreak: number,
): number {
  const r = c.reward;
  if (outcome !== 'correct') return r[outcome];
  const bonus = Math.min(r.streakBonusCap, r.streakBonusPerCorrect * Math.max(0, priorStreak));
  return r.correct * (1 + bonus);
}

/** EXP needed to go from `level` to `level + 1`. Infinity at the cap. */
export function expToNext(c: EconomyConfig, level: number): number {
  if (level >= c.exp.levelCap) return Infinity;
  return c.exp.baseToLevel2 + c.exp.growthPerLevel * (level - 1);
}

export function totalExpToLevel(c: EconomyConfig, level: number): number {
  let t = 0;
  for (let l = 1; l < level; l++) t += expToNext(c, l);
  return t;
}

export function levelForExp(c: EconomyConfig, exp: number): number {
  let level = 1;
  while (level < c.exp.levelCap && exp >= totalExpToLevel(c, level + 1)) level++;
  return level;
}

export function respawnSeconds(c: EconomyConfig, level: number): number {
  return c.combat.respawnBaseSeconds + c.combat.respawnPerLevelSeconds * level;
}

/** Expected multiplier for a correct answer at accuracy p, including the streak bonus. */
function expectedCorrectMultiplier(c: EconomyConfig, p: number): number {
  const r = c.reward;
  const capStreak = Math.ceil(r.streakBonusCap / r.streakBonusPerCorrect);
  let m = 0;
  for (let k = 0; k < capStreak; k++) m += p ** k * (1 - p) * rewardMultiplier(c, 'correct', k);
  m += p ** capStreak * rewardMultiplier(c, 'correct', capStreak);
  return m;
}

export interface MatchEstimate {
  waves: number;
  passiveGold: number;
  otherGold: number;
  mathGoldUncapped: number;
  mathGold: number;
  totalGold: number;
  mathShare: number;
  exp: number;
  level: number;
}

/**
 * Paper model of one match for the player, used to check the fairness target.
 * Not a simulation: the headless simulator (#37) replaces it with measured values.
 */
export function estimateMatch(c: EconomyConfig, accuracy: number): MatchEstimate {
  const secs = c.match.targetMinutes * 60;
  const waves = Math.floor((secs - c.match.firstWaveSeconds) / c.match.waveIntervalSeconds) + 1;
  const cannonWaves = Math.floor(waves / c.match.cannonEveryNthWave);
  const count: Record<MinionType, number> = {
    infantry: waves * c.match.wave.infantry,
    lancer: waves * c.match.wave.lancer,
    cannon: cannonWaves * c.match.wave.cannon,
  };
  const avgMult =
    accuracy * expectedCorrectMultiplier(c, accuracy) + (1 - accuracy) * c.reward.wrong;
  const est = c.estimate;

  let baseLastHitGold = 0;
  let minionExp = 0;
  for (const m of MINIONS) {
    baseLastHitGold += count[m] * est.lastHitRate * c.lastHitGold[m];
    const nearby = count[m] * est.expShareRate;
    const lastHits = count[m] * est.lastHitRate;
    minionExp += (nearby - lastHits) * c.exp.minion[m] + lastHits * c.exp.minion[m] * avgMult;
  }

  const passiveGold = secs * c.passiveGoldPerSecond;
  const otherGold = est.heroKills * c.otherGold.heroKill + est.towersDestroyed * c.otherGold.tower;
  const nonMath = passiveGold + otherGold;
  const mathGoldUncapped = baseLastHitGold * avgMult;
  const cap = c.fairness.mathShareCap;
  const mathGold = Math.min(mathGoldUncapped, (cap / (1 - cap)) * nonMath);
  const totalGold = nonMath + mathGold;
  const exp = minionExp + est.heroKills * c.exp.heroKill;

  return {
    waves,
    passiveGold,
    otherGold,
    mathGoldUncapped,
    mathGold,
    totalGold,
    mathShare: mathGold / totalGold,
    exp,
    level: levelForExp(c, exp),
  };
}
