# Economy and combat (issue #8)

All numbers live in [`src/data/economy.json`](../src/data/economy.json). The rules that use them are in [`src/systems/economy.ts`](../src/systems/economy.ts) (pure TypeScript, unit-tested in `tests/economy.test.ts`). Nothing here is measured yet: these are **starting values** for the simulator (#37) and the playtest balance pass (#50) to replace.

## Formulas

| Rule | Formula | Config keys |
|---|---|---|
| Damage | `ATK x 100 / (100 + ARMOR)`, minimum 1 | `combat.armorConstant`, `combat.minDamage` |
| Last-hit gold | `lastHitGold[type] x multiplier` | `lastHitGold`, `reward` |
| Multiplier | correct `1.5 x (1 + streak)`, wrong `0.5`, timeout `0.5` | `reward` |
| Streak bonus | `+5%` per correct answer in a row before this one, cap `+25%` | `reward.streakBonusPerCorrect`, `reward.streakBonusCap` |
| Passive gold | `3` gold per second | `passiveGoldPerSecond` |
| Other gold | hero kill `150`, tower `120` | `otherGold` |
| EXP to next level | `100 + 40 x (level - 1)`, cap level 15 | `exp.baseToLevel2`, `exp.growthPerLevel`, `exp.levelCap` |
| Minion EXP | full EXP for enemy minions dying within 600 px; your last hits get the answer multiplier | `exp.minion`, `exp.shareRangePx` |
| Respawn | `5 + 1 x level` seconds | `combat.respawn*` |
| Shop | 6 slots, sell for 70% back | `shop` |
| Question timer | Infantry 5 s, Lancer 8 s, Cannon 12 s | `questionSeconds` |
| Right answer shown after each question | 0.8 s | `questionRevealSeconds` |
| Extra time setting (#31) | every timer x1.5 | `extraTimeMultiplier` |

Changed from the first plan: passive gold went from 2 to **3** gold/s and last-hit gold dropped from 20/35/60 to **14/24/45**. With the original values the model put math income at about 50% of all gold, above the 30 to 40% target.

## Fairness target and cap

**Math-derived income** = all gold paid out through answered last-hit questions.
**Target:** 30 to 40% of total match gold for a typical student. **Hard cap:** 40% (`fairness.mathShareCap`). When a player's math gold would push their share above the cap, the extra is not paid (the reward resolver enforces this live; see [Reward resolver](#reward-resolver-issue-28)).

## Worked example: one 10 minute match

Assumptions (in `economy.json` under `estimate`, used only by this model): 20 waves (first at 15 s, then every 30 s), each wave 3 Infantry + 2 Lancers, a Cannon every 3rd wave (6 Cannons). The player last-hits 50% of enemy minions, is near 80% of them for EXP, kills the bot 3 times and destroys 2 towers.

Step by step for a student with **70% accuracy**:

1. Minions met: 60 Infantry, 40 Lancers, 6 Cannons. Last hits (50%): 30, 20, 3.
2. Base last-hit gold: `30 x 14 + 20 x 24 + 3 x 45 = 420 + 480 + 135 = 1035`.
3. Average multiplier: correct answers average about `1.65` with streaks, so `0.7 x 1.65 + 0.3 x 0.5 = 1.30`.
4. Math gold: `1035 x 1.302 = 1347`.
5. Passive gold: `600 s x 3 = 1800`. Kills and towers: `3 x 150 + 2 x 120 = 690`.
6. Total: `1347 + 1800 + 690 = 3837`. **Math share = 1347 / 3837 = 35%.** Inside the target.

Model output for other accuracy levels:

| Accuracy | Math gold | Total gold | Math share | Level at 10 min |
|---|---|---|---|---|
| 30% | 838 | 3328 | 25% | 11 |
| 50% | 1073 | 3563 | 30% | 12 |
| 70% | 1347 | 3837 | 35% | 13 |
| 90% | 1660 (capped from 1706) | 4150 | 40% | 14 |
| 100% | 1660 (capped from 1941) | 4150 | 40% | 15 |

A perfect student ends with about 25% more gold than a 30% student. That is a real edge but not a decisive one, so combat still matters. The tests in `tests/economy.test.ts` fail if a config change pushes the 70% case outside 30 to 40%, or lets 100% accuracy pass the cap.

## DPS budget (for skills, #34)

Over any 10 second window, a hero's skill damage (excluding basic attacks) must not exceed **1.5x** the damage of their basic attacks over the same window, at the same level and with no items. The ultimate counts toward this budget. Numbers: `economy.json` `skillBudget` (`windowSec` 10, `maxRatio` 1.5).

**Enforced (#34)** by [`src/systems/skillBudget.ts`](../src/systems/skillBudget.ts), at load (the match refuses to start with an over-budget kit) and in CI. It takes the worst case: every unlocked skill ready at the start and recast the moment its cooldown ends, mana ignored, every damage effect hitting the target, and attack-speed or ATK buffs counted as skill damage in whole extra attacks. `tests/skillBudget.test.ts` also plays real 10-second fights against a dummy (basic attacks only, then attacks plus every ready skill) at levels 1, 4, 10 and 15 and checks the real extra damage stays within the budget and within the worst-case figure.

| Level | 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12 | 15 |
|---|---|---|---|---|---|---|---|---|---|
| Nova: skill damage / basic damage | 0.44 | 0.66 | 0.65 | 1.18 | 1.16 | 1.14 | 1.13 | 1.12 | 1.11 |
| Mira | 0.47 | 0.70 | 0.69 | 1.24 | 1.22 | 1.20 | 1.19 | 1.18 | 1.17 |

Skills unlock at levels 1, 2, 3 and 4 (ultimate), so the share steps up early and then stays flat at about 1.1 to 1.25x: damage scales mostly with ATK, only a little with level. Mira's ratio is a bit higher because her ATK is lower while the skill base numbers are the same; her total strength stays within 1% of Nova's (#32).

## Spreadsheet

The issue asked for a spreadsheet mirror. The tested model in `src/systems/economy.ts` replaces it, because it reads the real config and cannot drift. To see the table above for new values, change `economy.json` and run `npm test`.

## In the game (issue #22)

Implemented in [`src/systems/progression.ts`](../src/systems/progression.ts) (pure, tested) and wired up in the match:

| Event | Who gets what |
|---|---|
| Every second | Both heroes get `passiveGoldPerSecond` (3) gold, alive or dead |
| A hero lands the killing blow on an enemy minion (last hit) | That hero: `lastHitGold[type]` gold and `exp.minion[type]` EXP, both x the answer multiplier (gold capped by the reward resolver below). Gold also x the minion's `goldScale` (#68). A super minion (#69) pays `superMinionReward` (60 gold, 90 EXP) instead |
| An enemy minion dies to anything else | Every enemy hero within `exp.shareRangePx` (600 px): `exp.minion[type]` EXP, no gold |
| A hero lands the killing blow on the enemy hero | That hero: `otherGold.heroKill` (150) gold and `exp.heroKill` (150) EXP |
| A tower falls | Every hero on the other team: `otherGold.tower` (120) gold |

Level-ups use the EXP curve above. A level-up recomputes the hero's stats as base + growth x (level - 1) from `heroes.json` and adds the extra max HP and mana to current HP and mana. Gold is tracked by source (`start`, `passive`, `lastHit`, `heroKill`, `tower`) so the math share of income can be measured in real matches and by the simulator (#37).

## Reward resolver (issue #28)

[`src/systems/rewards.ts`](../src/systems/rewards.ts) (pure, tested) decides what a held last-hit reward pays once its question ends. `applyLastHitReward` in `match.ts` calls it, and the HUD toast shows the multiplier that was really paid.

- **Math share** = `lastHit` gold / (`passive` + `lastHit` + `heroKill` + `tower`) gold. Starting gold is not counted.
- **Correct answer:** wants `lastHitGold x (reward.correct + streak bonus)`. If paying that would push the share above `fairness.mathShareCap` (40%), only the bonus above x1 is trimmed, down to exactly 40%.
- **x1 guarantee:** a correct answer never pays less than a skipped question (x1). So the share can go slightly above 40% when gold is far too generous; this is deliberate, a child should never feel punished for a right answer.
- **Wrong or timeout:** x0.5, never touched by the cap.
- **EXP is not capped.** It always gets the full multiplier.

### Headless simulation

[`src/systems/simulate.ts`](../src/systems/simulate.ts) plays a whole match with no Phaser: the player hero is driven by the bot brain, and each of its last hits is answered correctly with a fixed probability (seeded). `tests/simulate.test.ts` runs it for 10 minutes.

| Accuracy | Highest math share after minute 2 | Cap trimmed a reward? |
|---|---|---|
| 30% | 22.4% | no |
| 70% | 25.6% (25.5% at the end) | no |
| 100% | 39.5% | no |

With the current numbers the cap never triggers in real play: it is a safety net. The test also triples `lastHitGold` to check that the cap does trim and keeps the share below an uncapped run.

**Finding for the balance pass (#37, #50):** a 70% student ends at about 25%, below the 30 to 40% target. The simulated player lands only 24 to 31 last hits in 10 minutes, against about 53 in the worked example above. Numbers were not changed here; the simulator in #37 and the playtest should decide whether to raise `lastHitGold` or the correct-answer reward.
