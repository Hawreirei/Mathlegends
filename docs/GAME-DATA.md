# Hero, item and rank data (issue #13)

Three JSON files in `src/data/`, each checked when it is loaded by [`src/systems/data.ts`](../src/systems/data.ts) (zod schemas). A bad file stops loading with a `DataError` that names the file and every bad field, for example:

```
Invalid heroes.json (2 problems):
  heroes.json: heroes[0].base.hp: Invalid input: expected number, received string
  heroes.json: heroes[0].role: Invalid option: expected one of "tank"|"fighter"|"mage"|"marksman"|"support"
```

`tests/data.test.ts` loads the committed files in CI, so a broken file fails the build. Unknown fields are rejected too, which catches typos such as `hpp`. All player-facing text needs both `id` (Indonesian) and `en` (English).

## heroes.json

Empty for now; the player hero and the bot hero are added in #32.

| Field | Meaning |
|---|---|
| `id` | Lowercase id, unique, e.g. `"nova"` |
| `name`, `lore` | `{ "id", "en" }` |
| `role` | `tank`, `fighter`, `mage`, `marksman` or `support` |
| `base.hp`, `base.mana` | Starting health and mana |
| `base.atk`, `base.armor` | Used by damage = ATK x 100 / (100 + ARMOR), see `docs/ECONOMY.md` |
| `base.moveSpeed` | Pixels per second |
| `base.attackRange` | Pixels |
| `base.attackSpeed` | Attacks per second |
| `base.hpRegen`, `base.manaRegen` | Per second |
| `growth.hp`, `.mana`, `.atk`, `.armor` | Added for each level above 1 |
| `skills` | Up to 4 skill ids (3 skills + ultimate), defined in #33 |
| `sprite` | Texture key; the asset must be listed in `docs/ASSETS.md` |

## items.json

Empty for now; the 8 MVP items are added in #36.

| Field | Meaning |
|---|---|
| `id`, `name`, `description` | Unique id; text in both languages |
| `category` | `attack`, `magic`, `defense`, `movement` or `support` (shop tabs) |
| `cost` | Whole number of gold. Selling refunds `economy.json` `shop.sellRefund` (70%). |
| `stats` | Any of `hp`, `mana`, `atk`, `armor`, `moveSpeed`, `attackSpeed`, `hpRegen`, `manaRegen`, `lifesteal` (0 to 1) |
| `passive` | Optional `{ "id", "unique", "description" }`. Unique passives with the same id do not stack. |
| `icon` | Optional texture key |

An item needs at least one stat or a passive.

## ranks.json

Filled in now with the rules approved in `docs/GDD.md`:

| Field | Value | Meaning |
|---|---|---|
| `tiers` | 6 | Year 1 to 6; labels "Kelas N" / "Year N" (no named tiers in the MVP), badge texture key per tier |
| `starsPerTier` | 5 | |
| `placement.questions` | 10 | Placement quiz length |
| `placement.startOffset` | -1 | Start tier = estimated mastery - 1 |
| `placement.maxStartTier` | 5 | Nobody starts above Year 5 |
| `stars.win` / `stars.loss` | +1 / -1 | |
| `stars.bonusAccuracy` / `bonusStars` | 0.8 / +1 | Win with 80%+ accuracy earns an extra star |
| `stars.demoteAfterLossesAtZero` | 2 | Drop a tier only after 2 straight losses at 0 stars |
| `questionMix` | 0.7 / 0.2 / 0.1 | On-level / review / stretch; must add up to 1 |

The loader also checks that tiers are numbered 1, 2, 3, ... in order and that `maxStartTier` is not above the top tier.
