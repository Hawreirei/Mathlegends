# Accessibility (issue #31)

Players turn these on in **Menu → Settings → Accessibility** ("Pengaturan → Kemudahan bermain"). The choice is saved on the device (in the versioned save, `localStorage` `mathlegends.save`, see docs/SAVE.md) and applies at once, in both languages.

| Option | Choices | What it does | Data |
|---|---|---|---|
| Question text size ("Ukuran huruf soal") | Normal / Large / Extra large (x1, x1.2, x1.4) | Enlarges the reading parts of the game: question text, answers, the feedback note and the Result screen review. A sample line on the Settings screen shows the size. | `theme.json` `textScales` |
| Colour-blind colours ("Warna ramah buta warna") | Off / On | Right answers turn blue and wrong ones orange (Okabe-Ito pair, safe for red-green colour blindness) on the card, the timer bar, the feedback note and the Result screen. | `theme.json` `colorBlind` |
| Extra time ("Waktu tambahan") | Off / On | Every question timer x1.5: Infantry 7.5 s, Lancer 12 s, Cannon 18 s. A waiting question also stays fresh 1.5x as long. | `economy.json` `extraTimeMultiplier` |

### Sound and motion (#45)

**Menu → Settings → Sound and motion** ("Suara dan gerak"):

| Option | Choices | What it does |
|---|---|---|
| Sound effects ("Efek suara") | On / Off | Hits, coins, last hits, right and wrong answers, level-ups, towers falling, victory and defeat |
| Music ("Musik") | On / Off | A quiet original loop in the background |
| Reduce motion ("Kurangi gerakan") | Off / On | No screen shake |

In a match the **speaker button** (left of the mini-map), or **M** on a keyboard, mutes sound and music together, or turns both back on. Every choice is saved with the other settings, so **mute persists** after a reload or the next day (tested). Sound is never needed to play: everything a sound says is also on screen, so a class can play muted.

## Details

- **Text size and the card.** With a larger size the question card grows, but only while at least `HERO_BAND` (300 game px) stays free above it, so the hero stays in view (`src/systems/hudLayout.ts`, tested on every screen size). Where there is no room the card keeps its size and long questions shrink to fit, as before. Menus, buttons and HUD numbers keep their size so the layout always fits.
- **Colours are never the only signal.** Even with the option off, the right answer has a tick and a wrong pick a cross, and the feedback note says "Correct" / "Not quite" / "Time's up" in words. The two teams are blue and pink, which stay distinct for the common colour-blindness types.
- **Extra time is fair to log.** The answer log (#30) records the time the player actually had in `timeLimitSec`.
- **Rewards do not change** with these options.

## Code

- [`src/systems/settings.ts`](../src/systems/settings.ts): the settings, loading and the timer multiplier (pure, tested in `tests/settings.test.ts`).
- [`src/ui/theme.ts`](../src/ui/theme.ts): `applyAccessibility` swaps the colours and sets the text scale; `ts(size)` scales a font size.
- [`src/scenes/SettingsScene.ts`](../src/scenes/SettingsScene.ts): the Settings screen.
