/**
 * Headless match simulation (#28; grows into the balance simulator, #37). Pure, no Phaser.
 * The player is driven by the same brain as the bot (src/systems/bot.ts) and answers each of
 * its last-hit questions correctly with probability `accuracy` (a seeded random draw), paid at
 * once through the real reward resolver (no on-screen timing).
 */
import { botMoveDir, createBrain, thinkBot } from './bot';
import { rewardMultiplier } from './economy';
import {
  applyLastHitReward,
  createMatch,
  stepMatch,
  type MatchConfig,
  type MatchState,
} from './match';
import { mathShare } from './rewards';
import { createRng } from '../utils/rng';

export interface SimOptions {
  accuracy: number;
  seed: number;
  seconds: number;
  dt?: number;
}

export interface SimResult {
  state: MatchState;
  questions: number;
  correct: number;
  /** Correct answers whose bonus the cap trimmed. */
  correctCapped: number;
  /** Correct answers capped, by minute of the match. */
  cappedByMinute: number[];
  correctByMinute: number[];
  /** Highest math share seen after the first `settleSec` seconds. */
  maxShareAfterSettle: number;
  finalShare: number;
}

export function simulateMatch(cfg: MatchConfig, o: SimOptions, settleSec = 120): SimResult {
  const dt = o.dt ?? 0.05;
  const rng = createRng(o.seed);
  let s = createMatch(cfg);
  let brain = createBrain();
  let streak = 0;
  const r: SimResult = {
    state: s,
    questions: 0,
    correct: 0,
    correctCapped: 0,
    cappedByMinute: [],
    correctByMinute: [],
    maxShareAfterSettle: 0,
    finalShare: 0,
  };
  for (let i = 0; i < o.seconds / dt && !s.winner; i++) {
    // The player's brain sees the world from the player's side.
    brain = thinkBot(
      brain,
      { bot: s.player, player: s.bot, minions: s.minions, structures: s.structures, map: cfg.map },
      s.now,
      cfg.bot,
      cfg.econ,
    );
    const step = stepMatch(
      s,
      { move: botMoveDir(brain, s.player), attack: brain.targetId !== null },
      dt,
      cfg,
    );
    s = step.state;
    for (const e of step.events) {
      if (e.type !== 'lastHit') continue;
      const right = rng() < o.accuracy;
      const m = rewardMultiplier(cfg.econ, right ? 'correct' : 'wrong', streak);
      streak = right ? streak + 1 : 0;
      const paid = applyLastHitReward(s, e, m, cfg);
      s = paid.state;
      const minute = Math.floor(s.now / 60);
      r.questions++;
      if (right) {
        r.correct++;
        r.correctByMinute[minute] = (r.correctByMinute[minute] ?? 0) + 1;
        if (paid.capped) {
          r.correctCapped++;
          r.cappedByMinute[minute] = (r.cappedByMinute[minute] ?? 0) + 1;
        }
      }
    }
    if (s.now >= settleSec)
      r.maxShareAfterSettle = Math.max(r.maxShareAfterSettle, mathShare(s.playerProgress));
  }
  r.state = s;
  r.finalShare = mathShare(s.playerProgress);
  return r;
}
