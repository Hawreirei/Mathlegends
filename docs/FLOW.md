# Screens and navigation (issue #44)

```
Menu ──Play──> (first time) Placement: intro → 10 questions → "You start in Year N" → Match
  │                                                                                 │
  │──Play──> Match ──Nexus falls / Quit + Leave──> Result ──Play again──> Match      │
  │                                                  └──Menu──> Menu                │
  └──Settings──> Settings ──Move to another device──> transfer page                  │
                     ├──Sound and motion──> sound page (#45)                         │
                     └──Retake placement quiz──> Placement ◄──────────────────────────┘
```

## Back button

The phone's Back button, the browser's back button and **Esc** on a keyboard all follow one table ([`src/systems/navigation.ts`](../src/systems/navigation.ts), tested in `tests/navigation.test.ts`):

| Screen | Back does |
|---|---|
| Menu | Leaves the game (the only screen that does) |
| Settings, Placement (any step), Result | Back to the Menu. An unfinished placement quiz is not saved; Play starts it again. |
| Settings → Move to another device | Back to Settings |
| Settings → Sound and motion (#45) | Back to Settings |
| Match with the shop open | Closes the shop |
| Match with the quit question open | Closes the question (keep playing) |
| Match | Asks "Leave the match? This match will count as a loss." |

How: while the player is anywhere but the Menu, the game keeps one extra entry in the browser history, so Back stays inside the game ([`src/scenes/nav.ts`](../src/scenes/nav.ts)). On the Menu, Back leaves the page as usual. Esc does the same as Back, except that it never leaves the game.

## Quitting a match

**Quit** (top left) or Back opens the question; the match keeps running behind it. **Keep playing** closes it; **Leave** ends the match as a **loss** (`ranks.json` `stars.quitCountsAsLoss`, default true, so quitting cannot be used to dodge losing a star) and opens the Result screen, which says "You left." / "Kamu keluar." and still shows the missed questions. Set `quitCountsAsLoss` to false to send a quitting player straight to the Menu with nothing recorded.

## No dead ends

`tests/navigation.test.ts` checks, over the full screen graph, that every screen can reach the Menu (by a button or Back) and that the Menu can reach every screen. The placement quiz has a **Quit** button too.

## Transitions

Screens fade out and in (0.16 s). A second tap during the fade is ignored, so a double tap cannot start two matches.

## Checked in a browser

On a phone viewport (Playwright, with the real Back button): Menu → Play → placement intro → Back → Menu; quiz → Back → Menu; Settings → Move to another device → Back → Settings → Back → Menu; placement → match; Shop → Back → match; Back → quit question → Back → match; Quit → Leave → Result (loss recorded, `forfeit: true`); Play again → match; Quit → Leave → Result → Back → Menu → Back leaves the page. On desktop, Esc: shop → closed, then quit question → closed; Esc on the Menu does nothing.
