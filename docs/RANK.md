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

**Saved:** the Year, stars and whether the quiz is done are saved on the device (`localStorage` `mathlegends.profile`). The versioned save with export/import comes in #41.

**Logged:** placement answers go to the anonymous answer log (#30) with band `placement` and a `p-` match id.

Code: [`src/systems/placement.ts`](../src/systems/placement.ts) (pure), [`src/scenes/PlacementScene.ts`](../src/scenes/PlacementScene.ts).
