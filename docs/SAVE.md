# Saved progress (issue #41)

Everything is saved in the browser on the device; nothing goes to a server.

| What | Where (`localStorage`) | In the export file |
|---|---|---|
| Year, stars, placement done, losses at 0 stars, matches played | `mathlegends.save` | yes |
| Accessibility settings (#31) | `mathlegends.save` | yes |
| Missed questions waiting to come back (#29) | `mathlegends.save` | yes |
| Language | `mathlegends.lang` (device preference) | no |
| Anonymous answer log (#30) | `mathlegends.answers` (research data, own CSV export) | no |

The save is written after every change (a match, the placement quiz, a settings change, an import) and read once when the game starts, so **a refresh keeps the rank**.

## Format (version 2)

```json
{
  "app": "mathlegends",
  "version": 2,
  "savedAt": "2026-11-01T10:00:00.000Z",
  "profile": { "placed": true, "tier": 4, "stars": 3, "lossesAtZero": 0, "matchesPlayed": 12 },
  "settings": { "textScale": 1.2, "colorBlind": false, "extraTime": true },
  "review": [{ "question": { "id": "t3.muldiv100.h004", "...": "full question" }, "matchesLeft": 2 }]
}
```

Year 6 stars are saved uncapped (`"stars": 23`).

## Versions and migration

[`src/systems/save.ts`](../src/systems/save.ts) brings any older save up to the current version, one step at a time (`MIGRATIONS[n]` turns version n into n + 1), then checks every part:

| Version | Shape | Migration to the next version |
|---|---|---|
| 1 | Separate keys from #29-#39: `mathlegends.profile`, `.settings`, `.review` | Gathered into one document; profiles saved before #39 get `lossesAtZero: 0`; the review list is unwrapped. Nothing else changes. |
| 2 | One `mathlegends.save` document (above) | (current) |

On the first start after this update the old keys are migrated and written once as `mathlegends.save`; the old keys are left in place but no longer read.

**Checks:** the profile must be valid (Year 1-6, stars below 5 except in Year 6); otherwise the save is *damaged* and is not loaded. Bad settings fall back to the defaults and bad review items are dropped, without losing the rank. A damaged save in storage is left untouched and the game starts fresh, so nothing is overwritten by accident.

**Adding a version later:** bump `SAVE_VERSION`, add `MIGRATIONS[2]` (v2 → v3), and add a test that a v2 file loads with nothing lost.

## Moving to another device

Settings → Year → **Move to another device** ("Pindah perangkat"):

- **Save to file** downloads `mathlegends-save-YYYY-MM-DD.json`.
- **Load from file** opens the file picker. A valid file shows what it holds ("The file holds Year 5 · 2 stars. The progress on this device will be replaced.") and needs a **second tap** to load. The loaded settings apply at once.
- Messages for a file that is not a save, a file from a newer version of the game, or a damaged file; in all three cases nothing changes.

## Tests

`tests/save.test.ts`: round trip; Year 6 uncapped; v1 → v2 with nothing lost (also a pre-#39 profile); rejecting non-saves, newer versions and damaged files; dropping only the bad parts; refresh keeps the rank; first-start migration writes the new save once; a damaged save is not overwritten; blocked storage.
