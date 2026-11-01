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
| mirror-30 | 35.5% | 200/200 | 10:10 | -273 | 24.2% |
| mirror-50 | **46.5%** | 200/200 | 10:10 | -86 | 29.4% |
| mirror-60 | 49.5% | 200/200 | 10:11 | +25 | 32.1% |
| mirror-90 | 60.0% | 200/200 | 10:07 | +316 | 38.1% |
| new-vs-y1 | 90.0% | 200/200 | 10:00 | +392 | 30.3% |
| new-vs-y2 | 72.5% | 200/200 | 10:07 | +165 | 30.1% |
| new-vs-y3 | 42.0% | 200/200 | 10:09 | -33 | 30.0% |
| new-vs-y4 | 25.5% | 200/200 | 10:07 | -75 | 30.3% |
| new-vs-y5 | 18.0% | 200/200 | 10:03 | -235 | 28.9% |
| new-vs-y6 | 11.0% | 200/200 | 9:56 | -354 | 27.5% |

- **Mirror match:** at equal combat skill and equal economy (50% right) the player wins 46.5%: near 50%.
- **Math skill is a modest edge, not decisive:** from 30% to 90% right answers the win rate goes from 35.5% to 60.0%; the gold lead moves by about 600 out of roughly 4,000 earned.
- **Difficulty by Year:** a new player wins 90% against the Year 1 bot, then 72.5, 42, 25.5, 18 and 11% against Years 2 to 6: every Year is harder than the one before.
- 2,000 matches took 7.5 minutes.

## What the simulator changed: sudden death

The first runs showed that **no match ever ended**: not one of hundreds reached a Nexus even in 20 minutes. Two evenly matched heroes keep the minion waves meeting in the middle, so neither side gets a lasting push. Weaker towers did not fix it (at most 4 of 16 matches ended, and only against the Year 1 bot). The GDD had reserved this case: *"No sudden death unless testing shows matches run past about 12 minutes."*

So sudden death is now on (`structures.json` `suddenDeath`, can be turned off):

- **From 7:00**, towers and Nexus take extra damage: x2 after one minute, x3 after two, and so on.
- **Both Nexus crumble** a little each second, faster as time goes on and faster for a side that has lost towers (x2 with one tower lost, x3 with two). The side behind falls first. If both fall in the same moment, the side ahead (structure damage, then gold) wins.
- The HUD shows it: the timer turns red and a banner says *"Babak penentuan! Nexus mulai runtuh."* / *"Sudden death! The Nexus starts to crumble."*

Every simulated match now ends at a Nexus in about 9 to 11 minutes, close to the 8 to 10 minute target. Real children who push on purpose will often finish earlier.

## Checked in CI

`tests/balance.test.ts` (about 160 matches, under 40 s):

- every match ends at a Nexus within 8 to 11 minutes;
- the mirror match at 50% right answers stays between 35% and 65%;
- math skill is a modest edge at equal combat skill: 90% right beats 30% right, but by at most 50 points, with neither below 10% or above 80%;
- the Year 1 bot loses at least 75% of the time to the new player and the Year 6 bot at most 35%.

## Notes for the playtest (#50)

- **Math share** at 60% right is about 32%, inside the 30 to 40% target (docs/ECONOMY.md); it was 25% before, when the player had no skills or items and matches did not end.
- The simulated player is a bot: children will push, retreat and shop differently. Use the CSV from the playtest's answer logs (#30) and win/loss records to re-check these numbers.
