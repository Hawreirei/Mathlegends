# Assets

Every asset in the game, with its source and license (AGENTS.md rule 5). Original or openly licensed only. **No names, art, audio or fonts from Mobile Legends or any other game.** `tests/assets.test.ts` fails if a file in `src/assets/` is missing from this list.

## Sprites (issue #14)

All sprites are **original placeholder art made for MathLegends**. They are SVG files drawn by code in [`scripts/build-sprites.ts`](../scripts/build-sprites.ts) using the palette in [`src/data/theme.json`](../src/data/theme.json), in the style of the design prototype. No third-party art is used. License: project-owned, same as the code (MIT).

To change them, edit the script or the palette and run:

```bash
npm run build:sprites
```

| File (`src/assets/sprites/`) | What | Size (px) | Source | License |
|---|---|---|---|---|
| `hero-<id>.svg` | One hero token per hero in `heroes.json`, drawn from its `look` (team colour, emblem: sparkle, flower, moon or leaf) (#32). Now: `hero-nova.svg` (blue, sparkle), `hero-mira.svg` (red, flower) | 96 x 96 | Original, `build-sprites.ts` | MIT (project) |
| `minion-infantry-blue.svg`, `minion-infantry-red.svg` | Infantry minion (+ symbol) | 56 x 56 | Original, `build-sprites.ts` | MIT (project) |
| `minion-lancer-blue.svg`, `minion-lancer-red.svg` | Lancer minion (× symbol) | 56 x 56 | Original, `build-sprites.ts` | MIT (project) |
| `minion-cannon-blue.svg`, `minion-cannon-red.svg` | Cannon minion (÷ symbol, larger) | 72 x 72 | Original, `build-sprites.ts` | MIT (project) |
| `minion-super-blue.svg`, `minion-super-red.svg` | Super minion (#69): ÷ symbol, gold ring and crown, largest | 96 x 96 | Original, `build-sprites.ts` | MIT (project) |
| `tower-blue.svg`, `tower-red.svg` | Tower (arched gate; blue pointed roof, red crown) | 96 x 160 | Original, `build-sprites.ts` | MIT (project) |
| `nexus-blue.svg`, `nexus-red.svg` | Nexus crystal on a base | 160 x 160 | Original, `build-sprites.ts` | MIT (project) |
| `tile-grass.svg`, `tile-lane.svg`, `tile-water.svg` | Map tiles | 64 x 64 | Original, `build-sprites.ts` | MIT (project) |
| `badge-year-1.svg` ... `badge-year-6.svg` | Rank badges (shield, Year number, as many sparkles as the Year, fill from `theme.json` `badges.fills`, lighter to darker) (#42) | 96 x 112 | Original, `build-sprites.ts` | MIT (project) |

Colour-blind check: the two teams differ by **shape** as well as colour (blue tower has a pointed roof, red has a crown; blue hero has a sparkle, red a flower). Minion types differ by symbol (+, ×, ÷) and the Cannon is bigger; the super minion adds a gold ring and a crown and is bigger still. Badges differ by number, sparkle count (1 to 6) and lightness, not only colour (#42, tested in `tests/rankDisplay.test.ts`). A full palette review is part of #31.

## Fonts (issue #14)

Self-hosted: bundled into the build from npm packages (latin subset), so the game sends **no requests to Google Fonts** and works offline. Loaded in [`src/ui/fonts.ts`](../src/ui/fonts.ts).

| Font | Weights | Use | Source | License |
|---|---|---|---|---|
| Fredoka | 600, 700 | Titles, buttons, numbers | `@fontsource/fredoka` (Fontsource packaging of Google Fonts' Fredoka by Milena Brandão) | SIL Open Font License 1.1 (`node_modules/@fontsource/fredoka/LICENSE`) |
| Nunito | 700, 800 | Body text, questions | `@fontsource/nunito` (Fontsource packaging of Nunito by Vernon Adams and contributors) | SIL Open Font License 1.1 (`node_modules/@fontsource/nunito/LICENSE`) |

The OFL allows bundling the fonts with the game, including commercially, as long as the fonts are not sold on their own.

## Audio plan (issue #14, built in #45)

No audio files yet. Plan:

1. **Sound effects:** generate original effects (hit, last hit, correct, wrong, coin, level up, tower shot, victory, defeat) with a small Web Audio synth in code, or with an sfxr-style tool whose output we own. Either way no third-party samples, and each sound is listed below with how it was made.
2. **Music:** one short looping menu track and one match track. Options, in order of preference: commission or compose an original track; or use a CC0 track (for example from the Kenney or OpenGameArt CC0 collections), recorded here with its exact URL and author.
3. **Rules:** CC0 or original only (no CC-BY-NC, no "free for personal use", no ripped game audio). Mute toggle, and sounds must not be needed to play (children may play muted in class).

| File | What | Source | License |
|---|---|---|---|
| _none yet_ | | | |

## Design prototype (reference only)

| Asset | Source | License | Notes |
|---|---|---|---|
| Artwork in `docs/design-prototype/` | Original CSS/SVG-style art supplied with the design prototype | Project-owned, provided by the project author | Reference only, not shipped in the game build |
| Fredoka, Nunito in the prototype | Loaded remotely from Google Fonts by the prototype page | SIL Open Font License 1.1 | Prototype only; the game uses the self-hosted copies above |
