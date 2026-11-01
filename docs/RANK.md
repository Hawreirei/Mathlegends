# Rank and placement

Decisions are in [GDD.md](GDD.md) section 7. Numbers are in `src/data/ranks.json` ([GAME-DATA.md](GAME-DATA.md)).

## Placement quiz (issue #38)

The first time a child taps **Play** ("Main"), the placement quiz runs before the first match. It sets the starting Year so a Year 5 student does not have to climb through Year 1 first.

1. **Intro:** "10 short questions to find the right Year for you..." with **Start** and **Back**.
2. **10 questions** on the same card as in a match (timer, four shuffled answers, keys 1-4, the right answer shown for a moment after each). Fluency questions only, 15 seconds each; a timeout counts as wrong. The Extra time setting (#31) applies.
3. **Staircase:** the first question is Year 3. A right answer moves the next question one Year up, a wrong answer one Year down, always within Year 1 to 6.
4. **Result:**
   - *mastery* = the highest Year with at least one right answer and no more wrong than right answers at that Year (Year 1 if none);
   - *starting Year* = mastery - 1, at least Year 1 and at most Year 5, with 0 stars.

   The screen shows the badge, "You start in Year 3." / "Kamu mulai di Kelas 3.", the score and **Play!**.

| A student who can do... | is placed in |
|---|---|
| nothing yet, or Year 1 | Year 1 |
| up to Year 2 | Year 1 |
| up to Year 3 | Year 2 |
| up to Year 4 | Year 3 |
| up to Year 5 | Year 4 |
| Year 6 | Year 5 |

Starting one Year below mastery gives an easy first win; stars then move the child up (#39).

**Timing:** at most 10 x (15 s + 0.8 s reveal) = 2 min 38 s, even if every question times out; most children finish in about a minute. With Extra time the worst case is 3 min 53 s.

**Deterministic:** the Year depends only on the order of right and wrong answers, never on which questions were drawn. `tests/placement.test.ts` checks this for 200 random answer patterns with different question draws, checks the table above, and that no question repeats.

**Retake:** Settings → Year → "Retake placement quiz" (tap twice) runs the quiz again; the Year is set again and stars go back to 0. Useful when a device moves to another child.

**Saved:** the Year, stars and whether the quiz is done are saved on the device in the versioned save, which can be moved to another device ([SAVE.md](SAVE.md), #41).

**Logged:** placement answers go to the anonymous answer log (#30) with band `placement` and a `p-` match id.

Code: [`src/systems/placement.ts`](../src/systems/placement.ts) (pure), [`src/scenes/PlacementScene.ts`](../src/scenes/PlacementScene.ts).

## Stars, moving up and down (issue #39)

[`src/systems/rank.ts`](../src/systems/rank.ts) (pure, tested in `tests/rank.test.ts`) updates the Year and stars after every match. The Result screen shows the change ("Stars +2 (accuracy bonus)", "Up to Year 3!", "Now: Year 3 · 1 stars"); badges and a progress bar come in #42.

| Match result | Stars |
|---|---|
| Win | +1 |
| Win with at least 80% correct answers (and at least 5 questions answered) | +2 (1 + accuracy bonus) |
| Loss | -1 (never below 0) |

- **Moving up:** the 5th star moves you to the next Year at once with 0 stars. Extra stars carry over: 4 stars + a 2-star win = next Year with 1 star. Climbing Year 1 to Year 6 one star at a time takes 25 wins.
- **Year 6 has no star cap:** stars keep counting (6, 7, ... 23 ...) and the real total is saved. A loss takes one star off. (Showing 5 star icons plus "×N" is #42.)
- **Moving down:** a loss at 0 stars takes nothing but is counted. After **2 losses in a row at 0 stars** you drop one Year and land on **3 stars**, so two wins (or one 2-star win) bring you back. A win resets the count. The loss that takes you down to 0 stars does not count.
- **Floor:** Year 1. Losses at Year 1 with 0 stars change nothing.

Two numbers were not set by the GDD and were chosen here (both in `ranks.json`, easy to change):
- `starsAfterDemotion` = **3**: where you land after dropping a Year.
- `bonusMinAnswered` = **5**: the accuracy bonus needs at least 5 answered questions, so a match with 1 right answer out of 1 does not earn it.

Also saved per player: `lossesAtZero` (losses in a row at 0 stars). A saved profile with 5 or more stars below Year 6 is treated as broken and replaced by a new profile.

## Rank sets the questions (issue #40)

Every last-hit question uses the player's current Year from the profile, so the questions change the moment the Year changes (after placement, a promotion or a demotion). The question engine ([QUESTIONS.md](QUESTIONS.md#question-engine-issue-26)) mixes:

| Band | Share | A Year 4 player gets | A Year 6 player gets |
|---|---|---|---|
| On-level | 70% | Year 4 | Year 6 |
| Review | 20% | Year 3 (70% of review), else Year 1 or 2 | Year 5 (70%), else Years 1-4 |
| Stretch | 10% | Year 5 | Harder Year 6 items: the next harder type (word problem instead of a quick fact, two-step instead of a word problem), with that type's timer |

Missed questions from earlier matches (#29) come on top. `tests/rankMix.test.ts` checks the Year 4 and Year 6 cases over 3000 draws, the 70/20/10 shares, and the timer of a harder Year 6 question.
