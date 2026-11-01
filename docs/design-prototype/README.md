# MathLegends visual prototype

This package turns the provided planning kit into a self-contained visual design prototype. Open `index.html` in a browser; no build step or dependencies are required.

## Included screens

- Main menu with rank identity and a hero silhouette
- Hero selection for Nova, Orion, and Mira
- A one-lane academy arena with minions, towers, hero, lane decorations, HUD, shop, pause state, and quest panel
- A last-hit maths challenge overlay with working answer feedback and countdown
- Result screen and how-to-play guide

## Interaction map

1. Choose **Play Adventure**.
2. Select a hero and choose **Continue**.
3. In the lane, click Nova or the highlighted ability to open a math challenge.
4. Pick an answer to see reward feedback, then start another match.

## Implementation note

The art is original, CSS/SVG-style browser artwork embedded in the UI. This keeps the prototype portable, responsive, and free from third-party art licenses. It is a visual/design reference and interaction prototype, not the Phaser production implementation described in `PLAN.md`.
