# Question bank format (issue #10)

Questions live in `src/data/questions/t1.json` to `t6.json` (one JSON array per Year). **These files are built, not edited by hand:** see [The bank](#the-bank-issue-12) below.

The rules are in [`src/systems/questions.ts`](../src/systems/questions.ts). They run:
- in CI, through `npm run validate:questions` (fails the build on any problem);
- in the game at load time, through `assertValidQuestions` (AGENTS.md rule 4).

## Example

```json
{
  "id": "t1.addsub20.h002",
  "tier": 1,
  "type": "application",
  "topic": "t1.addsub20",
  "stem": {
    "id": "Dina punya 12 kelereng. Ia memberi 4 kelereng kepada Budi. Berapa kelereng Dina sekarang?",
    "en": "Dina has 12 marbles. She gives 4 marbles to Budi. How many marbles does Dina have now?"
  },
  "choices": [16, 8, 7, 9],
  "answerIndex": 1,
  "explanation": {
    "id": "Memberi berarti berkurang: 12 - 4 = 8.",
    "en": "Giving away means taking away: 12 - 4 = 8."
  },
  "source": "handwritten"
}
```

## Fields

| Field | Required | Rule |
|---|---|---|
| `id` | yes | Unique across the whole bank. Lowercase letters, digits, `.`, `_`, `-`. Convention: `<topic>.<g or h><number>` (g = generated, h = handwritten). |
| `tier` | yes | 1 to 6. Must equal the tier of `topic` in `curriculum.json`. |
| `type` | yes | `fluency` (Infantry), `application` (Lancer) or `multistep` (Cannon). |
| `topic` | yes | A topic id from [`docs/CURRICULUM.md`](CURRICULUM.md), for example `t3.muldiv100`. |
| `stem` | yes | `{ "id": "...", "en": "..." }`, both non-empty. |
| `choices` | yes | Exactly 4, all different. Each is a number (`42`), a language-neutral string (`"3/4"`), or `{ "id", "en" }` text for word answers. |
| `answerIndex` | yes | 0 to 3: the position of the correct choice. Spread the right answer across positions. (The overlay in #27 should also shuffle choices on display.) |
| `explanation` | yes | `{ "id", "en" }`. One or two short sentences a child can follow. Shown on the Result screen for missed questions. |
| `timeSec` | no | Override in seconds (1 to 60). Normally leave it out: the timer comes from `economy.json` `questionSeconds` by minion type. |
| `tags` | no | List of strings, for example `["make-ten"]`, for analysis. |
| `source` | no | `generated`, `handwritten` or `gensoal`. |

## What the validator rejects

- Duplicate `id`, or the same stem text (in either language) used twice.
- `answerIndex` that is not 0, 1, 2 or 3.
- Missing `explanation`, or a missing or empty Indonesian or English text anywhere.
- Not exactly 4 choices, or two choices that are the same.
- Unknown `topic`, or a `topic` from a different tier than `tier`.
- Bad `tier`, `type`, `timeSec`, `tags` or `source`.

It does **not** check that the marked answer is mathematically correct. Generated items (#11) are correct by construction and unit-tested; handwritten items need the teacher spot-check in #12.

## Writing tips

- Write numbers the Indonesian way in Indonesian text (`1.000`, `0,5`) and the English way in English text (`1,000`, `0.5`). For a decimal or large-number choice, use `{ "id": "0,5", "en": "0.5" }`.
- Use Indonesian contexts: Rupiah, local names, familiar places.
- Make wrong choices plausible: the common mistakes (for 8 + 5: 12 or 14 from miscounting, 3 from subtracting).
- Keep stems short enough to read inside the timer: fluency about 5 seconds, application 8, multistep 12.

## Commands

```bash
npm run validate:questions
```

```bash
node scripts/validate-questions.ts path/to/file.json
```

The command prints a count of items per tier and type. The target for #12 is at least 15 in every cell.

## Generators (issue #11)

Code: [`src/systems/generators/`](../src/systems/generators/) (pure TypeScript, one file per tier, shared helpers in `core.ts`).

```ts
import { generateQuestions } from './systems/generators';
const qs = generateQuestions('t3.muldiv100', 'fluency', 20, 12345); // same seed, same 20 questions
```

- Each template writes the Indonesian and English text from one set of numbers, so the two languages always match.
- Numbers are formatted per language: `1.250` and `0,5` in Indonesian, `1,250` and `0.5` in English. Money is shown as `Rp2.500` / `Rp2,500`.
- Wrong choices come from common mistakes first (forgetting to carry, subtracting the smaller digit from the larger, adding denominators, mixing up area and perimeter, ignoring the order of operations), then near misses.
- A wrong choice can never equal the answer, and equivalent fractions count as equal (2/4 is never offered next to 1/2).
- Word problems use Indonesian names and contexts and repeat the name instead of using "he" or "she" in English.
- Generated ids are `<topic>.g<hash of the English stem>`, so the same question always gets the same id.

`tests/generators.test.ts` generates 40 questions per family and type, then checks that:
- all of them pass the validator;
- no text contains `undefined` or `NaN`;
- no choice is negative;
- the answer appears in all four positions;
- the output is the same for a fixed seed.

It also recomputes the answer from the question text for every "What is A op B?" item, every mixed-operations item, and the main word-problem templates (bus, LCM/HCF, percent, speed, area/perimeter, volume, rounding, equivalent fractions, ratio).

### Coverage

All 28 topics marked "Gen" in [CURRICULUM.md](CURRICULUM.md) have a generator. Topics without a generator, and the missing types below, are handwritten in #12.

| Tier | Topic | Fluency | Application | Multistep |
|---|---|---|---|---|
| 1 | `t1.count20` | yes |  |  |
| 1 | `t1.addsub20` | yes | yes | yes |
| 1 | `t1.pattern` | yes |  |  |
| 2 | `t2.place100` | yes |  |  |
| 2 | `t2.addsub100` | yes | yes | yes |
| 2 | `t2.half_quarter` | yes |  |  |
| 2 | `t2.equal_groups` | yes | yes |  |
| 2 | `t2.money_time` |  | yes | yes |
| 3 | `t3.place1000` | yes |  |  |
| 3 | `t3.addsub1000` | yes | yes | yes |
| 3 | `t3.muldiv100` | yes | yes | yes |
| 3 | `t3.fraction_compare` | yes |  |  |
| 3 | `t3.std_units` | yes |  |  |
| 4 | `t4.place10000` | yes |  |  |
| 4 | `t4.multidigit` | yes | yes | yes |
| 4 | `t4.equiv_fractions` | yes |  |  |
| 4 | `t4.decimals_intro` | yes |  |  |
| 4 | `t4.perim_area` | yes | yes | yes |
| 5 | `t5.big_numbers` | yes |  |  |
| 5 | `t5.kpk_fpb` | yes | yes |  |
| 5 | `t5.frac_addsub` | yes |  |  |
| 5 | `t5.decimal_percent` | yes | yes | yes |
| 5 | `t5.data_mean` | yes | yes | yes |
| 6 | `t6.frac_muldiv` | yes |  |  |
| 6 | `t6.ratio` | yes | yes | yes |
| 6 | `t6.speed_scale` |  | yes | yes |
| 6 | `t6.mixed_ops` | yes |  |  |
| 6 | `t6.volume` | yes | yes | yes |

Limits:
- `t2.money_time` generates money questions only. Telling the time needs clock pictures and is handwritten.
- `t6.speed_scale` covers speed, time and map scale. `t6.chance` and the other topics without a generator are handwritten.

## The bank (issue #12)

| Where | What |
|---|---|
| `src/data/handwritten/t1.json` ... `t6.json` | Handwritten questions (edit these) |
| `src/systems/generators/` | Generators (edit these) |
| `scripts/build-question-bank.ts` | Combines both into the bank |
| `src/data/questions/t1.json` ... `t6.json` | The bank the game loads (built, do not edit) |
| `docs/QUESTION-SPOT-CHECK.md` | Checklist for the teacher (built) |

```bash
npm run build:questions
```

Each Year gets **20 fluency, 15 application and 15 multistep questions (50 per Year, 300 in total)**. Handwritten items come first; generated items fill the rest of each cell, taking turns across that Year's topics so every generator topic appears. Seeds are fixed, so rebuilding gives identical files. `tests/bank.test.ts` fails if the committed bank is out of date, if any cell has fewer than 15 items, if a curriculum topic is missing, or if one template supplies more than 10 of a Year's two-step questions.

There are 40 handwritten questions. They cover the topics without a generator (shapes, measuring, tally charts and pictograms, bar charts, polygons, angles, chance) and add variety to word problems.

**Teacher check:** `docs/QUESTION-SPOT-CHECK.md` lists all 40 handwritten items and 5 generated items per Year (70 items, 23% of the bank), each with both languages, the marked answer and the explanation. Record the result in its table. Fix problems in the handwritten files or generators, never in the built bank.

GenSoal output can be added later as another source file (with `"source": "gensoal"`) once it is converted to this format.

## Question engine (issue #26)

[`src/systems/questionEngine.ts`](../src/systems/questionEngine.ts) chooses the question for each last hit. The bank is loaded and validated by `loadQuestionBank()` (`src/systems/questionBank.ts`).

```ts
let engine = createQuestionEngine(loadQuestionBank(), ranks, seed);
const pick = nextQuestion(engine, playerTier, 'lancer'); // { question, band, source, engine }
engine = pick.engine;
```

1. **Type from the minion:** Infantry = fluency, Lancer = application, Cannon = multistep.
2. **Band from `ranks.json` `questionMix`:** 70% on-level (the player's Year), 20% review, 10% stretch (the Year above). Review comes from the Year just below `reviewPreviousTierShare` (70%) of the time, otherwise from any lower Year. Year 1 has nothing below, so its review share becomes on-level; at Year 6 stretch stays in Year 6.
3. **No repeats:** nothing asked in the last `repeatWindow` (30) questions is asked again.
4. **Never runs dry:** if the bank has nothing fresh for a pick, the engine generates a new question for that Year and type with the #11 generators (`source: 'generated'`). In a realistic mix (mostly Infantry, some Lancers, few Cannons) 800 questions at Year 3 needed no generated questions; the worst case (200 Infantry-only questions) needed 12.

Tests (`tests/questionEngine.test.ts`): no repeat within 30 in 2000 mixed draws and in the worst case for every Year and minion type (checked to fail when the window is shrunk); the 70/20/10 mix within 3% over 1000 draws at Years 2 to 5; band tiers correct; the same seed gives the same questions.

## In the match (issue #27)

- **Trigger:** only the player's own last hit on a minion (`lastHit` from `stepMatch`). Skill buttons, tapping the hero and the bot's last hits never ask a question.
- **Held reward:** the last hit's gold and EXP are held and paid when the question ends, x the multiplier (`applyLastHitReward`): correct `reward.correct` with the streak bonus (gold limited by the math-share cap, never below x1; see `docs/ECONOMY.md`), wrong `reward.wrong`, timeout `reward.timeout`.
- **One at a time:** at most one question shows and one waits. A further last hit, or a waiting question older than its own timer, is *skipped*: it pays the normal reward (x1), with no question and no penalty, and does not touch the streak (`src/systems/questionSession.ts`, tested).
- **Timer:** `economy.json` `questionSeconds`: Infantry 5 s, Lancer 8 s, Cannon 12 s.
- **Never pauses:** the match keeps running. The card is compact and sits low between the touch controls, and the camera eases the hero into the clear band above it while a question is showing.
- **Card:** question text (shrunk to fit long word problems), countdown bar with seconds, four large answers in a 2 x 2 grid in shuffled order, keys 1 to 4 on desktop. Text follows the chosen language. A short "Benar! ×1,5" / "Correct! ×1.5", "Kurang tepat ×0,5" / "Not quite ×0.5" or "Waktu habis" / "Time's up" note follows each answer (full feedback and explanations: #29).
- **Result screen:** "Correct answers: X of Y" now counts the real questions.
