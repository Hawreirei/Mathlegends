# Visual design reference

A clickable HTML/CSS prototype lives in [`docs/design-prototype/`](design-prototype/). Open `docs/design-prototype/index.html` in a browser (no build step). It is a **visual and interaction reference only**; production code is Phaser + TypeScript (see PLAN.md). Do not import its files into `src/`.

## What to copy from it

| Element | Prototype | Use in production |
|---|---|---|
| Palette | ink `#19204c`, paper `#f7f4e9`, gold `#ffc84a`, pink `#f95b93`, blue `#4873ff`, violet `#7160d5`, mint `#55d1bb` | Now in `src/data/theme.json` (#14); do not hard-code in scenes |
| Menu | Crest, big title, one gold "PLAY" button, rank chip in footer | #15 Menu scene, #42 rank badge |
| Match HUD | Top bar (pause, score, timer), quest hint, bottom bar (avatar, level/EXP, gold, shop, skill buttons) | #25 HUD, #35 shop, #18 touch controls |
| Question card | Centered card, 2x2 answer grid, big countdown, streak bonus line | #27 overlay (see changes below) |
| Lane | Blue base left, red base right, circular minions marked with + - x ÷ | #16, #20 |

## Where the prototype disagrees with the project scope

These need a decision or a change before building from it.

1. **Three heroes (Nova, Orion, Mira) and a hero-select screen.** MVP has one hero and no hero select (#32, hero select cut). Keep the Nova design for the player and use one of the others as the bot's look. Hero select returns in #58.
2. **English only.** Every string, including the question text, needs Indonesian and English (AGENTS.md 6a, #23). Check that Indonesian text (often longer) fits the buttons and top bar.
3. **Year 4 rank chip "Scholar".** Ranks are Year 1 to 6 with 5 stars. Decide whether tiers get names. If so, add the names to `ranks.json` in both languages.
4. **Score shows "1 : 0" as team scores.** The win condition is destroying the enemy Nexus (#21). Decide what the top bar shows (for example Nexus health or a kill count) before building #25.
5. **A question can be triggered by tapping the hero or the skill button.** In the game it must appear only on the player's own last hit, and the game must not pause (#27).
6. **Landscape phone (844x390) is broken.** The arena is cropped and the next screen shows below it. #15 and #25 require both portrait and landscape, so the real layout must be designed for both. Portrait (390x844) and desktop (1280x720) look good.
7. **Fonts load from Google Fonts (Fredoka, Nunito).** That is an external request, which breaks offline PWA play (#51) and sends requests from children's devices to a third party. Self-host the font files and record the OFL license in `docs/ASSETS.md`. **Resolved in #14:** the game bundles both fonts from `@fontsource` packages.
8. **The 8 x 7 question has an unmarked correct answer in the mock**, and "3 correct in a row! +15% bonus" does not match the rule of +5% per answer capped at +25% (#28). Treat the numbers in the prototype as placeholders; economy.json is the source of truth.

## Suggested backlog updates (not applied)

- #14 (art plan): add "adopt the prototype look; redraw as Phaser textures or SVG" and the self-hosted fonts.
- #15, #25: reference this file and require a landscape layout.
- #27: reference the question card layout and the changes above.
