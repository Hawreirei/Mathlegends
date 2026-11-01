# MathLegends: Game Design Document (one page)

Status: **APPROVED** by the project owner on 2026-11-01 (issue #7), including all four defaults marked **[DECIDE]** below.

## 1. Pitch
A single-player, 1-lane MOBA for Indonesian primary students (Year/Kelas 1 to 6). You fight a computer opponent in a lane. Every time **you** land the final hit on an enemy minion, a math question appears. A correct answer pays out more gold and EXP than a wrong one, so being good at math makes you stronger, but fighting still matters.

Name: **MathLegends** (working title, name check in #60). Runs in a phone or desktop browser. No server, no accounts.

## 2. Core loop
1. Open the game, take the placement quiz the first time (10 questions) to get a starting Year tier.
2. Start a match against the bot. The bot's strength follows your Year tier.
3. Farm minion waves, fight the bot, buy items, level up.
4. On your own last hit: 4-choice question, 5 / 8 / 12 seconds depending on the minion type. The game never pauses.
5. Correct = 1.5x gold and EXP. Wrong or timeout = 0.5x. Streak adds +5% per correct answer, up to +25%.
6. Destroy the enemy Nexus to win. Win = +1 star. Win with 80% or better accuracy = +1 bonus star. Loss = -1 star.
7. Result screen shows stars, accuracy and the questions you missed, with explanations.

Exact numbers live in `src/data/economy.json` (issue #8). They are tunable guesses until the simulator (#37) and the playtest (#49) measure them.

## 3. Win condition and match length
- Win by destroying the enemy Nexus; lose if yours is destroyed.
- Target match length: **8 to 10 minutes**.
- The match ends at once on Nexus destruction. There is no time limit in the MVP. **[DECIDE]** If matches run past 12 minutes in testing, add sudden death (Nexus takes extra damage over time).

## 4. The map
One horizontal lane, your base on the left, the enemy base on the right. Each side has one Nexus and **2 towers**. Minion waves spawn on a timer from both bases. Every Nth wave includes a Cannon minion.

| Minion | Role | Question type | Timer | Reward |
|---|---|---|---|---|
| Infantry | Frontline | Fluency (quick facts) | 5 s | Base |
| Lancer | Mid | Application (short word problem) | 8 s | Higher |
| Cannon | Siege | Multi-step | 12 s | Highest |

Timers are tunable and have an accessibility option of 1.5x (#31).

## 5. Controls
- **Phone:** virtual joystick on the left; attack button and 3 skill buttons on the right; one-handed play is a requirement. Answers are large tap targets.
- **Desktop:** WASD or arrows to move, mouse or keys to attack and cast skills, 1 to 4 (or click) to answer.
- The hero **auto-targets the nearest enemy in range** when attacking.
- Both portrait and landscape must work (the prototype fails landscape; see `docs/DESIGN.md`).

## 6. Question rules
- A question appears **only** when the player's own basic attack or skill kills a minion. Never when a tower, a minion or the bot kills it. Tapping the hero or a button never opens a question.
- One question at a time; at most 1 more waits in the queue. A waiting question that is too stale (older than its timer) is dropped without penalty.
- 70% on-level, 20% review from lower tiers, 10% stretch from the tier above. No repeat within 30 questions.
- Questions come from the bundled bank, in Indonesian or English per the language setting. Wrong answers return in the next 3 matches.
- **Fairness:** math-derived income stays at about 30 to 40% of total gold, so combat skill still matters.

## 7. Rank and the bot
- 6 tiers (Year 1 to Year 6), 5 stars each. Floor at Year 1.
- **Placement quiz (kept, decided 2026-11-01):** the first time a child plays, 10 adaptive questions set the starting Year (estimated level minus 1, never above Year 5). Starting everyone at Year 1 was rejected: Year 5 and 6 students would need about 25 stars (2 to 4 hours) of Year 1 sums before reaching their level.
- **Stars:** win +1; win with 80% or more correct answers +1 bonus (2 in total); loss -1.
- **Climbing (decided 2026-11-01):** reaching the 5th star moves you up at once to the next Year with 0 stars. A 2-star win that crosses the line carries the extra star over (4 stars + 2 = next Year with 1 star).
- **Year 6 has no star cap (decided 2026-11-01):** stars keep counting. The badge always shows 5 filled star icons, plus a gold "×N" label with the real total from the 6th star on (for example 5 stars plus "×9" for 9 stars), and the text reads "Kelas 6 · 9 bintang" / "Year 6 · 9 stars". The real total is saved, so it can be shown on a leaderboard or teacher view later. A loss at Year 6 takes one star off the total.
- **Dropping a Year:** only after 2 straight losses at 0 stars; never below Year 1.
- **Tier names [DECIDE]:** none in the MVP. Rank is shown as "Year 4, 2 stars" with a badge. Named tiers (the prototype's "Scholar") can be added later in `ranks.json`.
- There is no human opponent, so the **bot is the matchmaking**: six difficulty steps, one per Year tier (last-hit accuracy, reaction time, item timing, aggression). Year 1 must be easy to beat; Year 6 a real challenge.

## 8. Hero, skills, items
- **One playable hero** (an original balanced Fighter), with 3 skills and an ultimate. The bot uses a second hero entry with the same schema.
- **Shop [DECIDE]:** open at any time through a button on the HUD (the match is never paused), 6 item slots, 8 items in total, sell for 70% back.
- Levels 1 to 15, stats grow per level.

## 9. HUD
- **Top bar [DECIDE]:** pause button, match timer, and **Nexus health** for both sides (not a team score, because the goal is the Nexus). Combo or streak indicator on the right.
- **Bottom bar:** hero avatar with level and EXP, gold, shop button, skill buttons.
- Mini-map showing towers and heroes.

## 10. Languages and accessibility
- Indonesian and English, switchable from the menu. Default from the browser language, falling back to Indonesian. All strings from `src/data/i18n/`.
- Font size option, colour-blind-safe palette, optional extended answer timer (x1.5).

## 11. Data and privacy
- Everything runs in the browser. Progress is saved in `localStorage` with an export/import file for changing devices.
- Anonymous answer logs stay on the device and can be exported as CSV for research. No names, no accounts, no network calls.
- Fonts are self-hosted; the game makes no third-party requests.

## 12. MVP scope

**In:** single player vs bot, 1 lane, 1 hero, 8 items, Year 1 to 6 with about 270 bilingual questions, placement quiz, rank with stars, local saves, ID/EN, GitHub Pages deploy, PWA by v0.1.0.

**Out (post-MVP backlog, M8):** online multiplayer, accounts and cloud save, teacher dashboard, jungle, 3v3 or 5v5, extra heroes and hero select, Year 7 to 12, payments.

## 13. IP rules
- Original name, heroes, art, audio and text. **No names, heroes, art, skills, maps or audio from Mobile Legends or any other game.** Genre mechanics (lanes, minions, towers, last-hitting) are not owned by anyone and are fine to use.
- Every asset is recorded with source and license in `docs/ASSETS.md`. Placeholders must be original or CC0.
- A written name and trademark check happens in #60.

## 14. Success test
After the core slice (M2 + M3), test with students from Year 1 to 6. **Go/no-go: 60% or more say they would play again.** If not, fix the loop before adding content.

## Decisions (approved)
1. Shop opens at any time through a HUD button.
2. Top bar shows Nexus health, not a team score.
3. No named rank tiers in the MVP.
4. No sudden death unless testing shows matches run past about 12 minutes.
