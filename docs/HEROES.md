# Heroes (issue #81, phase 2: v0.2.0)

Today there are two heroes, Nova (the player) and Mira (the bot), and both are `fighter`s. Phase 2 adds **three new heroes** and a **hero select screen** (#83), so a child can pick how they want to play. The point of choosing is that heroes **feel different**; each new one takes a role the game does not have yet.

The numbers below are **starting values**; #82 builds them and #85 tunes them in the balance simulator. Names are **working names** until the naming review (#60): none may come from Mobile Legends or any other game (AGENTS.md rule 5).

## The roster

| Hero | Role | In one line (for a child) | Strong at | Weak against |
|---|---|---|---|---|
| **Nova** (now) | Fighter | "Run in, hit hard, shield up." | Short fights, chasing | Being out-ranged |
| **Mira** (now) | Fighter | Nova's mirror on the red side | Same as Nova | Same as Nova |
| **Rimba** (new) | Tank | "Very tough. Stands in front and takes the hits." | Holding the lane under a tower, surviving | Low damage: slow to finish a fight |
| **Kirana** (new) | Marksman | "Shoots from far away. Keep your distance!" | Last-hitting safely from range, pushing towers | Fragile: dies fast if caught |
| **Wulan** (new) | Mage | "Weak punches, strong magic." | Big skill bursts, hitting a whole wave | Weak basic attacks; runs out of mana |

Roles stay simple on purpose: a Year 1 child should understand a hero from its card in the select screen.

## The new heroes

All three use only the **existing skill kinds** (projectile, area, dash, buff, shield). Crowd control (slow, stun) and healing would need new rules; they are left for a later version.

### Rimba, Penjaga Rimba / Grove Guardian (tank)

A forest guardian with bark for armour. *Lore idea:* "Rimba guards the old trees of the academy garden and never steps back while a friend is behind it."

| Stat | Rimba | (Nova) |
|---|---|---|
| HP / growth | 760 / +85 | (620 / +70) |
| Armor / growth | 28 / +3.2 | (18 / +2.5) |
| ATK / growth | 46 / +4 | (56 / +5) |
| Attack range, speed | 130, 0.9 | (140, 1.0) |
| Move speed | 225 | (240) |
| Mana | 200 | (200) |

| Slot | Skill | Kinds | Idea |
|---|---|---|---|
| 1 | Root Slam (*Hentakan Akar*) | area around self | Damages everything close: good against a wave |
| 2 | Charge (*Terjang*) | dash + area around self | Closes the gap to a fleeing enemy |
| 3 | Bark Wall (*Dinding Kulit Kayu*) | shield (12% of max HP) + armor buff | Survives a tower shot or a burst |
| Ult | Ancient Stand (*Bertahan Teguh*) | big shield + armor buff + area around self | "Now you can't move me" |

### Kirana, Pemanah Fajar / Dawn Archer (marksman)

An archer whose arrows glow like the first light. *Lore idea:* "Kirana practises at dawn and never misses a target she has measured."

| Stat | Kirana | (Nova) |
|---|---|---|
| HP / growth | 520 / +60 | (620 / +70) |
| Armor / growth | 12 / +2 | (18 / +2.5) |
| ATK / growth | 60 / +5.5 | (56 / +5) |
| Attack range, speed | **300**, 1.1 | (140, 1.0) |
| Move speed | 235 | (240) |
| Mana | 220 | (200) |

| Slot | Skill | Kinds | Idea |
|---|---|---|---|
| 1 | Piercing Shot (*Panah Tembus*) | projectile, pierce, long range | Hits a whole line of minions |
| 2 | Focus (*Fokus*) | attack speed + move speed buff | Wins a duel or runs away |
| 3 | Volley (*Hujan Panah*) | area at the target | Clears a wave from a safe distance |
| Ult | Sunburst (*Semburat Fajar*) | big area at the target + attack speed buff | Finishes a fight from range |

A new emblem is needed for her token: an **arrow** (`look.emblem: "arrow"`), drawn by `build-sprites.ts` like the others.

### Wulan, Penyihir Bulan / Moon Mage (mage)

A quiet student who reads the moon's phases. *Lore idea:* "Wulan counts the days between full moons, and her magic grows with every count."

| Stat | Wulan | (Nova) |
|---|---|---|
| HP / growth | 540 / +62 | (620 / +70) |
| Armor / growth | 12 / +2 | (18 / +2.5) |
| ATK / growth | 44 / +3.5 | (56 / +5) |
| Attack range, speed | 220, 0.85 | (140, 1.0) |
| Move speed | 235 | (240) |
| Mana / growth, regen | **300** / +20, 3 | (200 / +15, 2) |

| Slot | Skill | Kinds | Idea |
|---|---|---|---|
| 1 | Moonbeam (*Sinar Bulan*) | projectile, big damage | Her main damage |
| 2 | Tide (*Pasang Surut*) | area at the target | Hits a whole wave |
| 3 | Moon Veil (*Selubung Bulan*) | shield + move speed buff | Escapes when caught |
| Ult | Eclipse (*Gerhana*) | large area at the target, very big damage | The burst a mage is picked for |

## Decisions

**1. Fair damage between heroes: compare total damage, not skills against basic attacks.**
Today's check (#34) keeps each hero's skill damage at most 1.5x its own basic-attack damage over 10 seconds. That works for two similar fighters, but a mage is *meant* to have weak basic attacks and strong skills, so the same rule would leave Wulan with weak skills too.

- **New rule (#82):** over the same 10-second window, each hero's **total damage** (basic attacks + skills) must stay within **±15% of Nova's**.
- **Tank exception:** a tank may be lower if its toughness (HP x armor) is higher by at least as much.
- The old per-hero ratio stays as a sanity cap per role in data: fighter 1.5, tank 1.5, marksman 1.2, mage 3.0.
- #85 then checks real matches: every pairing must be between 40% and 60% at equal skill.

**2. Every hero in both team colours.**
Today a hero's look is tied to one team (Nova blue, Mira red). With hero select, any hero can be on either side, so `build-sprites.ts` draws each hero twice, `hero-<id>-blue` and `hero-<id>-red`, with the same emblem. `look.color` goes away, and the match picks the token by the hero's team. The team is also shown by the ring colour and the side of the map, not by colour alone (#31).

**3. Who the bot plays: a random hero other than the player's.**
The bot's skill still comes from the player's Year (#43); its *hero* is drawn at random from the others, using the match's seed so a match can be replayed. Set in `bot.json` as `heroChoice: "randomOther"`, so a Year-specific pool can come later if the playtest shows that some heroes are too hard for the youngest players. Built in #84.

**4. The default stays Nova.**
The select screen pre-selects the last hero used (#84); a new player sees Nova first.

## What a child sees (#83)

After **Play**: five hero cards (token, name, title, a role word such as "Tough" / "Far shots" / "Magic", and three stat bars: toughness, range, damage). Tapping a card shows its four skills in one line each, then **Fight!** starts the match. Back returns to the Menu.

## Order of work

1. #82: the three heroes (data, skills, tokens in both colours, the new damage check).
2. #83: the select screen.
3. #84: saving the choice and the bot's hero.
4. #85: balance across every pairing.
5. #86: the shop panel speed fix, alongside.
