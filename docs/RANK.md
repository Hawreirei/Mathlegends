# Rank

Decisions are in [GDD.md](GDD.md) section 7. Numbers are in `src/data/ranks.json` ([GAME-DATA.md](GAME-DATA.md)).

## Everyone starts in Year 1

Every new player starts in **Year 1 with 0 stars** and climbs by winning (below). The first tap on **Play** ("Main") starts a match straight away.

There used to be a placement quiz (#38): 10 adaptive questions before the first match set the starting Year, so an older student did not have to climb through Year 1. **It was removed on 2026-11-07 at the owner's request.** The trade-off: a Year 5 or 6 student now plays easy Year 1 to 4 questions first. With 5 stars per Year and at least 1 star per win, reaching Year 5 takes about 20 wins. The questions mix in a little of the next Year (`stretch`), and the accuracy bonus can speed this up.

Saves from before the change keep their Year and stars; a player who never finished the quiz is in Year 1. Answer logs on a device may still hold rows with band `placement` from the old quiz.

## Stars, moving up and down (issue #39)

[`src/systems/rank.ts`](../src/systems/rank.ts) (pure, tested in `tests/rank.test.ts`) updates the Year and stars after every match. The Result screen shows the change ("Stars +2 (accuracy bonus)", "Up to Year 3!") above the rank badge (#42).

| Match result | Stars |
|---|---|
| Win | +1 |
| Win with at least 80% correct answers (and at least 5 questions answered) | +2 (1 + accuracy bonus) |
| Loss | -1 (never below 0) |

- **Moving up:** the 5th star moves you to the next Year at once with 0 stars. Extra stars carry over: 4 stars + a 2-star win = next Year with 1 star. Climbing Year 1 to Year 6 one star at a time takes 25 wins.
- **Year 6 has no star cap:** stars keep counting (6, 7, ... 23 ...) and the real total is saved. A loss takes one star off. (Shown as 5 star icons plus "×N", see below.)
- **Moving down:** a loss at 0 stars takes nothing but is counted. After **2 losses in a row at 0 stars** you drop one Year and land on **3 stars**, so two wins (or one 2-star win) bring you back. A win resets the count. The loss that takes you down to 0 stars does not count.
- **Floor:** Year 1. Losses at Year 1 with 0 stars change nothing.

Two numbers were not set by the GDD and were chosen here (both in `ranks.json`, easy to change):
- `starsAfterDemotion` = **3**: where you land after dropping a Year.
- `bonusMinAnswered` = **5**: the accuracy bonus needs at least 5 answered questions, so a match with 1 right answer out of 1 does not earn it.

Also saved per player: `lossesAtZero` (losses in a row at 0 stars). A saved profile with 5 or more stars below Year 6 is treated as broken and replaced by a new profile.

## Rank sets the questions (issue #40)

Every last-hit question uses the player's current Year from the profile, so the questions change the moment the Year changes (after a promotion or a demotion). The question engine ([QUESTIONS.md](QUESTIONS.md#question-engine-issue-26)) mixes:

| Band | Share | A Year 4 player gets | A Year 6 player gets |
|---|---|---|---|
| On-level | 70% | Year 4 | Year 6 |
| Review | 20% | Year 3 (70% of review), else Year 1 or 2 | Year 5 (70%), else Years 1-4 |
| Stretch | 10% | Year 5 | Harder Year 6 items: the next harder type (word problem instead of a quick fact, two-step instead of a word problem), with that type's timer |

Missed questions from earlier matches (#29) come on top. `tests/rankMix.test.ts` checks the Year 4 and Year 6 cases over 3000 draws, the 70/20/10 shares, and the timer of a harder Year 6 question.

## Badges and summary (issue #42)

[`src/ui/RankBadge.ts`](../src/ui/RankBadge.ts) draws the rank everywhere it appears; what it shows comes from [`src/systems/rankDisplay.ts`](../src/systems/rankDisplay.ts) (pure, tested in `tests/rankDisplay.test.ts`).

- **Badge:** a shield with the Year number and as many sparkles as the Year (1 to 6). The fill gets darker Year by Year (`theme.json` `badges.fills`), so Years differ in number, sparkle count and lightness: readable without colour vision.
- **Stars:** always 5 star icons; held stars are solid gold, the rest only an outline (shape, not just colour).
- **Year 6 above 5 stars:** 5 filled icons plus a gold **×N** with the real total; the text reads "Kelas 6 · 9 bintang" / "Year 6 · 9 stars" (Settings, transfer page).
- **Progress bar** (Result screen): stars / 5 towards the next Year with "2 more stars to Year 4" / "2 bintang lagi ke Kelas 4"; in Year 6 "Top Year! Keep collecting stars."
- **Menu:** a compact badge (badge, Year, stars, ×N) at the bottom.
- **Result summary:** Victory/Defeat, time, accuracy with percentage ("Correct answers: 8 of 10 (80%)"), the star change and any Year change, then the large badge. New stars pop in one by one, a lost star fades out, ×N pulses when Year 6 stars grow, and the badge pulses on a promotion or demotion.
- **Plurals:** "1 star" / "2 stars" in English; Indonesian has one form ("1 bintang", "2 bintang").

**Leaving a match** (#44) counts as a loss when `stars.quitCountsAsLoss` is true (the default): stars -1, and it counts towards the 2 losses at 0 stars. See [FLOW.md](FLOW.md).
