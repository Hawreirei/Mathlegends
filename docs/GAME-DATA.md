# Hero, item and rank data (issue #13)

Three JSON files in `src/data/`, each checked when it is loaded by [`src/systems/data.ts`](../src/systems/data.ts) (zod schemas). A bad file stops loading with a `DataError` that names the file and every bad field, for example:

```
Invalid heroes.json (2 problems):
  heroes.json: heroes[0].base.hp: Invalid input: expected number, received string
  heroes.json: heroes[0].role: Invalid option: expected one of "tank"|"fighter"|"mage"|"marksman"|"support"
```

`tests/data.test.ts` loads the committed files in CI, so a broken file fails the build. Unknown fields are rejected too, which catches typos such as `hpp`. All player-facing text needs both `id` (Indonesian) and `en` (English).

## heroes.json

`playerHero` names the hero the player controls and `botHero` the one the bot plays; both must exist in the file. Two starter heroes are in place (#17): **Nova** (player, blue) and **Mira** (bot, red), both Fighters with identical placeholder stats so the lane stays fair. #32 sets their final stats and lore.

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

## map.json (issue #16)

The single lane, loaded by [`src/systems/map.ts`](../src/systems/map.ts). Only the **blue** (left) side is written down; the red side is its mirror image across the middle, so both teams get exactly the same distances.

| Field | Value | Meaning |
|---|---|---|
| `world.width` / `world.height` | 4400 / 1400 | World size in pixels |
| `lane.y` / `lane.thickness` | 700 / 360 | Horizontal lane centre and width |
| `lane.walkMargin` | 60 | Heroes stay this far from the lane edges and world ends (about one token radius) |
| `river.y` / `river.thickness` | 1060 / 140 | Decorative river below the lane |
| `blue.nexusX` | 300 | Blue Nexus (red: 4100) |
| `blue.towerXs` | 1000, 1750 | Inner and outer blue towers (red: 3400, 2650) |
| `blue.heroSpawnX` / `minionSpawnX` | 520 / 460 | Spawn points on the lane |
| `camera.minVisibleWidth` | 1150 | Narrow (portrait) screens zoom out until at least this much lane is visible |
| `camera.lerp` | 0.12 | How softly the camera follows the player (0 to 1; higher is tighter) |

The loader rejects a lane that does not fit in the world, towers that are not in order from the Nexus towards the middle, or spawns on the wrong half. On tall portrait screens the camera centres the world vertically.

## minions.json (issue #20)

Stats per minion type, loaded and checked by `loadMinions` in `src/systems/data.ts`. When and how many spawn is in `economy.json` (`match`): first wave at 15 s, then every 30 s; 3 Infantry + 2 Lancers per wave; a Cannon every 3rd wave.

| Type | HP | ATK | Armor | Range | Attacks/s | Speed | Aggro | Role |
|---|---|---|---|---|---|---|---|---|
| Infantry (+) | 420 | 22 | 10 | 90 | 0.8 | 140 | 380 | Front line, melee |
| Lancer (×) | 300 | 28 | 4 | 300 | 0.7 | 140 | 400 | Ranged |
| Cannon (÷) | 820 | 45 | 25 | 340 | 0.5 | 120 | 420 | Tough, slow, ranged |

`spacing` (70) is the gap between minions in a fresh wave. `aggroRange` must be at least `attackRange` (checked).

Behaviour (`src/systems/minions.ts`): march towards the enemy base; target the nearest enemy **minion** in aggro range, or the nearest enemy **hero** only if no enemy minion is near; walk into range and attack; friendly minions push apart so a wave keeps its shape; dead minions do not respawn. All minions decide from the same snapshot each step and attacks land simultaneously, so list order gives neither team an edge: a test runs 10 minutes of mirrored waves and requires equal kills (99 vs 99) with the fight holding the middle. The player's killing blow on a minion counts as a **last hit** and fires `ml-last-hit` (used by the question overlay in #27).

## structures.json (issue #21)

| Field | Value | Meaning |
|---|---|---|
| `tower.hp` / `armor` | 2400 / 40 | |
| `tower.atk` / `attackSpeed` | 140 / 0.8 | One shot every 1.25 s; about 118 damage to a starter hero (armor 18) |
| `tower.attackRange` | 420 | Pixels |
| `nexus.hp` / `armor` | 4000 / 40 | The Nexus never attacks |
| `dangerRingDistance` | 220 | Show an enemy tower's red range ring when the player is this close to its edge |

Rules (`src/systems/structures.ts`):
- **Protection order:** the outer tower can be attacked first; the inner tower only after the outer falls; the Nexus only after both towers fall. Protected structures show a soft white bubble.
- **Tower targeting:** nearest enemy minion in range, otherwise nearest enemy hero in range.
- **Minion targeting:** enemy minions, then attackable enemy structures, then enemy heroes, so waves push towers.
- **Win:** destroying the enemy Nexus ends the match (Victory); losing your own ends it (Defeat). The Result screen follows 1.5 s later so the collapse can be seen.

A simulation with blue waves only (no defenders) takes the red outer tower at 103 s, the inner at 191 s and the Nexus at 238 s. With defending minions and a hero, matches should land near the 8 to 10 minute target; the simulator (#37) will measure it.
