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

Changed from the first plan: passive gold went from 2 to **3** gold/s and last-hit gold dropped from 20/35/60 to **14/24/45**. With the original values the model put math income at about 50% of all gold, above the 30 to 40% target.

## Fairness target and cap

**Math-derived income** = all gold paid out through answered last-hit questions.
**Target:** 30 to 40% of total match gold for a typical student. **Hard cap:** 40% (`fairness.mathShareCap`). When a player's math gold would push their share above the cap, the extra is not paid (the reward resolver in #28 enforces this live).

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

Over any 10 second window, a hero's skill damage (excluding basic attacks) must not exceed **1.5x** the damage of their basic attacks over the same window, at the same level and with no items. The ultimate counts toward this budget. The simulator (#37) checks it once skills exist.

## Spreadsheet

The issue asked for a spreadsheet mirror. The tested model in `src/systems/economy.ts` replaces it, because it reads the real config and cannot drift. To see the table above for new values, change `economy.json` and run `npm test`.
