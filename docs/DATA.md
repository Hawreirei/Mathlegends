# Answer data for research (issue #30)

The game keeps an anonymous log of every question a player answers, on the device only. A teacher or researcher can download it as a CSV file from **Menu → Settings → Download CSV** ("Pengaturan → Unduh CSV").

## Privacy

- **No personal data.** No name, class, school, age, account, device id or location. Each match gets a random id (`matchId`) that links the answers of one match together and nothing else.
- **Stays on the device.** The log lives in this browser's `localStorage` (`mathlegends.answers`). The game makes no network calls; nothing is uploaded.
- **The person holding the device decides.** Only an explicit download shares it. **Delete data** (tap twice) wipes the log.
- At most 5,000 answers are kept (about 1 MB); the oldest go first.
- Several children sharing one device end up in one log. Use the `matchId` and `matchStart` columns, together with a paper seating plan kept by the teacher, if answers must be told apart. Never write names into the game.

## When a row is written

One row per question that was **shown and ended**: answered right, answered wrong, or timed out. A last hit that was *skipped* (a third question while one shows and one waits) never showed a question and is not logged. Rows are saved when the match ends or the player quits it.

## The CSV file

- File name: `mathlegends-answers-YYYY-MM-DD.csv` (the download date).
- UTF-8 with a byte-order mark (Excel opens it correctly), comma separated, CRLF line ends, RFC 4180 quoting.
- First line is the header. Empty field = no value.

| Column | Type | Meaning |
|---|---|---|
| `matchId` | text | Random id of the match, e.g. `m-mh0x2k1c-4f7q2c`. Same for every row of one match. |
| `matchStart` | ISO 8601 (UTC) | When the match started, e.g. `2026-11-01T03:15:00.000Z`. |
| `seq` | integer | 1 for the first question of the match, then 2, 3, ... |
| `matchSec` | number | Match clock in seconds when the question appeared. |
| `playerTier` | 1-6 | The player's Year (rank tier) during the match. |
| `questionTier` | 1-6 | The Year the question belongs to. |
| `questionType` | text | `fluency`, `application` or `multistep`. |
| `topic` | text | Curriculum topic id, see [CURRICULUM.md](CURRICULUM.md), e.g. `t3.muldiv100`. |
| `itemId` | text | Question id, see [QUESTIONS.md](QUESTIONS.md). Generated ids are stable for the same question. |
| `itemSource` | text | `handwritten`, `generated` or `gensoal`. |
| `band` | text | Why it was chosen: `onLevel` (player's Year), `review` (a lower Year), `stretch` (the Year above) or `missed` (missed in an earlier match, #29). |
| `minion` | text | The minion last-hit: `infantry`, `lancer` or `cannon`. |
| `outcome` | text | `correct`, `wrong` or `timeout`. |
| `correct` | 0/1 | 1 if correct. |
| `chosenIndex` | 0-3 | The answer picked, as its position in the question's `choices` in the bank (not the shuffled position on screen). Empty on a timeout. |
| `answerIndex` | 0-3 | Position of the right answer in `choices`. |
| `responseMs` | integer | Milliseconds from the question appearing to the tap. Empty on a timeout. Game time: it runs with the match, so a stalled browser tab can stretch it. |
| `timeLimitSec` | number | Seconds the player had (Infantry 5, Lancer 8, Cannon 12; see `economy.json`), x1.5 when the Extra time setting is on (#31). |
| `lang` | `id`/`en` | Language the question was shown in. |

To see the question text, look the `itemId` up in `src/data/questions/t*.json`. Questions the engine generated on the fly (when the bank ran out) have `itemSource` `generated` and may not be in the bank files; their ids are hashes of the English text.

## Code

- [`src/systems/answerLog.ts`](../src/systems/answerLog.ts): rows, CSV, storage format (pure, tested in `tests/answerLog.test.ts`).
- [`src/scenes/SettingsScene.ts`](../src/scenes/SettingsScene.ts): summary, download and delete.
- [`src/utils/download.ts`](../src/utils/download.ts): the file download (desktop, Android and iOS 13+ browsers).
