# Skills (issue #33)

Skills are data. Each hero lists up to 4 skill ids in `heroes.json` (`skills`: 3 skills, then the ultimate); the skills themselves are in [`src/data/skills.json`](../src/data/skills.json). One system ([`src/systems/skills.ts`](../src/systems/skills.ts), pure and tested) handles every skill; [`match.ts`](../src/systems/match.ts) applies them in the match.

## Casting

A skill casts when the hero is alive, has reached `unlockLevel`, the skill's cooldown is over and the hero has `mana`. Casting spends the mana and starts the cooldown. Mana comes back at `manaRegen` per second.

**Aim (no aiming needed):** the enemy hero if it is within the skill's `range`, else the nearest enemy minion in range, else straight ahead (the way the hero last moved). Skills hit heroes and minions, not towers.

**Last hits:** a skill that kills an enemy minion is the player's last hit, so a question comes, exactly as for a basic attack (#27).

## Format

```json
{
  "id": "nova-star-toss",
  "name": { "id": "Lempar Bintang", "en": "Star Toss" },
  "description": { "id": "...", "en": "..." },
  "ultimate": false,
  "unlockLevel": 1,
  "cooldown": 5,
  "mana": 35,
  "range": 520,
  "effects": [
    { "kind": "projectile", "damage": { "base": 70, "perLevel": 10, "atkRatio": 0.6 }, "speed": 950, "radius": 28, "pierce": false }
  ]
}
```

Amounts (`damage`, shield `amount`) are `base + perLevel x (level - 1) + atkRatio x ATK + maxHpRatio x max HP`; damage then goes through armour like a basic attack (docs/ECONOMY.md).

| Effect `kind` | Fields | What it does |
|---|---|---|
| `projectile` | `damage`, `speed` (px/s), `radius` (px), `pierce` | Flies towards the aim up to `range`; hits the first enemy it touches, or every enemy on its path with `pierce`. Swept, so a fast projectile cannot skip a target. |
| `aoe` | `centre` (`self` or `target`), `radius`, `damage` | Damages every enemy within `radius` of the hero or of the aim point. |
| `dash` | `distance` | Moves the hero up to `distance` towards the target, landing just short of it (or straight ahead), never out of the lane. |
| `buff` | `stat` (`atk`, `armor`, `moveSpeed`, `attackSpeed`), `mult` and/or `add`, `duration` | Raises the stat for `duration` seconds; it stays through a level-up and then goes back. |
| `shield` | `amount`, `duration` | Absorbs damage before HP for `duration` seconds. Shown as a white ring and a white strip on the health bar. |

Effects run in order, so `dash` then `aoe` (`centre: self`) lands and then hits around the landing spot.

**Checked at load and in CI:** `skills.json` is checked field by field (unknown fields and kinds are rejected), and `checkHeroSkills` makes sure every hero skill exists and the ultimate (at most one) is last.

## Adding a skill (JSON only)

1. Add the skill to `skills.json`.
2. Put its id in a hero's `skills` list in `heroes.json`.

`tests/skills.test.ts` does exactly this with a piercing "Ice Lance" and casts it.

## Controls and display

| | Skill 1 | Skill 2 | Skill 3 | Ultimate |
|---|---|---|---|---|
| Phone | button 1 | button 2 | button 3 | button 4 (outer ring, gold) |
| Keyboard | Q | E | R | F |

Keys 1 to 4 stay for answering questions. On a phone the buttons sit around the attack button; with a keyboard a skill bar sits in the bottom-right corner (bottom centre in portrait).

Each button shows its state ([`src/ui/SkillButton.ts`](../src/ui/SkillButton.ts)): bright when ready; during the cooldown a dark pie (round buttons) or a dropping curtain (square ones) with the seconds left; dimmed with a blue rim when mana is short; dark with "Lv N" until unlocked. A press that cannot cast gives the button a quick shake.

## Current skills

Nova (player) and Mira (bot) have mirrored kits, so the lane stays even. Numbers are first drafts; #34 balances them (skill damage budget in docs/ECONOMY.md) and the bot starts casting in #43.

| Slot | Nova | Mira | Unlock | Cooldown | Mana | Effects |
|---|---|---|---|---|---|---|
| 1 | Star Toss / Lempar Bintang | Petal Dart / Panah Kelopak | Lv 1 | 5 s | 35 | Projectile 70 (+10/level, +0.6 ATK) |
| 2 | Flash Step / Langkah Kilat | Vine Leap / Lompatan Sulur | Lv 2 | 9 s | 40 | Dash 240 px, then AoE 110 px: 45 (+8/level, +0.4 ATK) |
| 3 | Light Shield / Perisai Cahaya | Bark Guard / Kulit Kayu | Lv 3 | 13 s | 50 | Shield 90 (+18/level, +5% max HP) for 4 s; +20% move speed for 3 s |
| Ult | Starfall / Hujan Bintang | Bloom Burst / Ledakan Bunga | Lv 4 | 40 s | 100 | AoE 200 px at the target: 160 (+24/level, +1.0 ATK); +30% attack speed for 5 s |
