# Question bank format (issue #10)

Questions live in `src/data/questions/*.json`. Each file is a JSON array of question objects. One file per tier (`t1.json` to `t6.json`) is the convention, but any file name works.

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
