# Balance simulator (issue #37)

Plays thousands of whole matches headless and writes one CSV row per match.

```bash
npm run sim
```

```bash
npm run sim -- --matches 1000 --out results.csv --seconds 1200
```

Default: 200 matches per scenario, 20-minute limit, CSV to `balance-sim.csv` (git-ignored). The game code runs as-is through Vite (no extra tool). Code: [`src/systems/balanceSim.ts`](../src/systems/balanceSim.ts), [`scripts/balance-sim.ts`](../scripts/balance-sim.ts).

## How a simulated match works

- **The player** is driven by the bot's brain with chosen settings (its *combat skill*: reactions, last hits, skills, items, aggression) and answers each last-hit question right with a chosen probability (its *math skill*). Answers are paid through the real reward rules, fairness cap included.
- **The bot** is the real bot for a given Year (#43). It answers no questions, so its last hits pay x1. A player answering **50%** right averages about x1 (half x1.5, half x0.5), so at equal combat skill **50% is the true mirror match**.
- A match ends at a Nexus. If it hits the time limit it is judged on score: structure damage done minus taken, then gold.

## Scenarios

| Scenario | Player combat skill | Player math skill | Bot |
|---|---|---|---|
| `mirror-30` / `-50` / `-60` / `-90` | Same as the bot (Year 3 settings) | 30 / 50 / 60 / 90% right | Year 3 |
| `new-vs-y1` ... `new-vs-y6` | `bot.json` `newPlayer` (a child's first matches) | 60% right | Year 1 ... 6 |

## CSV columns

`scenario, seed, accuracy, winner (blue = player, red = bot, empty = draw), decidedBy (nexus or score), seconds, pushBlue, pushRed (structure damage done, a destroyed tower = 1), towersLostBlue, towersLostRed, goldBlue, goldRed (earned), levelBlue, levelRed, killsBlue, killsRed, questions, correct, mathShare`.

## Results

`npm run sim` (200 matches per scenario, 2,000 in all):

| Scenario | Player wins | Ended at a Nexus | Average length | Average gold lead | Math share |
|---|---|---|---|---|---|
| mirror-30 | 35.5% | 200/200 | 9:43 | -260 | 22.6% |
| mirror-50 | **47.5%** | 200/200 | 9:43 | -78 | 27.2% |
| mirror-60 | 58.0% | 200/200 | 9:41 | +35 | 30.0% |
| mirror-90 | 62.5% | 200/200 | 9:39 | +345 | 36.6% |
| new-vs-y1 | 85.5% | 200/200 | 9:32 | +361 | 29.2% |
| new-vs-y2 | 76.5% | 200/200 | 9:39 | +172 | 28.7% |
| new-vs-y3 | 44.0% | 200/200 | 9:42 | -41 | 28.0% |
| new-vs-y4 | 29.0% | 200/200 | 9:39 | -50 | 28.3% |
| new-vs-y5 | 23.0% | 200/200 | 9:36 | -214 | 27.3% |
| new-vs-y6 | 9.5% | 200/200 | 9:30 | -346 | 25.6% |

- **Mirror match:** at equal combat skill and equal economy (50% right) the player wins 47.5%: near 50%.
- **Math skill is a modest edge, not decisive:** from 30% to 90% right answers the win rate goes from 35.5% to 62.5%; the gold lead moves by about 600 out of roughly 4,000 earned.
- **Difficulty by Year:** a new player wins 85.5% against the Year 1 bot, then 76.5, 44, 29, 23 and 9.5% against Years 2 to 6: every Year is harder than the one before.
- 2,000 matches took 6 minutes. These results are after the crumble-order fix.

## What the simulator changed: sudden death

The first runs showed that **no match ever ended**: not one of hundreds reached a Nexus even in 20 minutes. Two evenly matched heroes keep the minion waves meeting in the middle, so neither side gets a lasting push. Weaker towers did not fix it (at most 4 of 16 matches ended, and only against the Year 1 bot). The GDD had reserved this case: *"No sudden death unless testing shows matches run past about 12 minutes."*

So sudden death is now on (`structures.json` `suddenDeath`, can be turned off):

- **From 7:00**, towers and Nexus take extra damage: x2 after one minute, x3 after two, and so on.
- **Each base crumbles in order**: the outer tower first, then the inner tower, then the Nexus, the same order players must destroy them in. It goes faster as time goes on and faster for a side that has lost towers (x1.5 with one tower lost, x2 with two). The side behind falls first. A tower that crumbles pays the other side its tower gold. If both Nexus fall in the same moment, the side ahead (structure damage, then gold) wins.
- The HUD shows it: the timer turns red and a banner says *"Babak penentuan! Menara dan Nexus mulai runtuh."* / *"Sudden death! Towers and Nexus start to crumble."*

**Fixed after the first playtest:** the first version drained the Nexus directly, so 59 of 60 simulated matches (and the owner's first real match) ended while the losing side still had towers standing: the game seemed to stop for no reason. Now the crumbling follows the tower order, and `tests/balance.test.ts` checks that the loser always lost both towers before its Nexus fell.

Every simulated match now ends at a Nexus in about 9 to 10 minutes, close to the 8 to 10 minute target. Real children who push on purpose will often finish earlier.

## Checked in CI

`tests/balance.test.ts` (about 160 matches, under 40 s):

- every match ends at a Nexus within 8 to 11 minutes, and never while the losing side still has a tower;
- the mirror match at 50% right answers stays between 35% and 65%;
- math skill is a modest edge at equal combat skill: 90% right beats 30% right, but by at most 50 points, with neither below 10% or above 80%;
- the Year 1 bot loses at least 75% of the time to the new player and the Year 6 bot at most 35%.

## Notes for the playtest (#50)

- **Math share** at 60% right is about 30%, inside the 30 to 40% target (docs/ECONOMY.md); it was 25% before, when the player had no skills or items and matches did not end.
- The simulated player is a bot: children will push, retreat and shop differently. Use the CSV from the playtest's answer logs (#30) and win/loss records to re-check these numbers.
