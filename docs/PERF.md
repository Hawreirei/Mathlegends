# Performance budget (issue #48)

Children play on whatever phone the family has, often a mid-range Android on mobile data or school Wi-Fi. The budget:

| What | Budget | Measured | Checked by |
|---|---|---|---|
| Whole build | under 5 MB | 1.9 MB | `npm run check:bundle` (CI) |
| First visit download (compressed) | under 700 KB | 541 KB | `npm run check:bundle` (CI) |
| Game code re-downloaded after an update (compressed) | under 200 KB | 122 KB | `npm run check:bundle` (CI) |
| Menu on screen, first visit, ordinary 4G, CPU 4x slower | under 5 s | **2.1 s** | `npm run perf` |
| Menu on screen, first visit, slow 4G, CPU 4x slower | under 5 s | **4.6 s** | `npm run perf` |
| Menu on screen, return visit, slow 4G, CPU 4x slower | under 5 s | **1.9 s** | `npm run perf` |
| CPU time per frame in a busy fight, CPU 4x slower | average under 16.7 ms (60 fps); no frame over 33.3 ms (30 fps) | **11 ms average, 17.7 ms p95, 24.5 ms worst; 0 frames over 33.3 ms** | `npm run perf` |

## How it is measured

`npm run perf` ([`scripts/perf.ts`](../scripts/perf.ts)) drives the production build in Chromium with a phone-sized landscape screen (915 x 412, touch) and the CPU slowed down 4x, Chrome's usual stand-in for a mid-range Android phone.

- **First load:** the cache is emptied and the network throttled to Chrome DevTools' presets: *slow 4G* (150 ms round trip, 1.6 Mbit/s down, Lighthouse's mobile default) and *fast 4G* (60 ms, 9 Mbit/s). The timer stops when the Menu is on screen. The return visit has the files cached.
- **Fight:** a match is moved to 4:45, so the next waves are grown (#68), with red's towers down so blue's waves bring super minions (#69). The player stands in the middle of the lane attacking, the bot fights back, the waves meet, and 20 s of frames are recorded.
- **CPU time per frame** is the time of each step of Phaser's game loop: the match rules, all scenes and the preparation of the drawing. On a phone the GPU then draws the frame.

**Caveat: this machine has no GPU.** Chromium draws WebGL in software (SwiftShader), so its *frame rate* here is 8 to 25 fps whatever the game does (even the nearly empty Menu runs at 24 fps). That number says nothing about a phone, so the budget uses the CPU time per frame instead. To see the real frame rate on a real phone, open the game with **`?fps`** in the address (`…/Mathlegends/?fps`). The match then shows frames per second and the CPU time per frame.

To rerun:

```bash
npm run build && npx vite preview --port 4173
```

```bash
npm run perf
```

## What the measurements changed

**1. Graphics objects were most of the CPU time.** Phaser turns every Graphics object (rounded rectangles, circles, lines) into triangles again on every frame, even when it has not changed. A fight drew about 3,000 Graphics commands per frame: the HUD's panels, buttons, bars and mini-map, and the health bar over every unit. Hiding them all cut the CPU time per frame from 22 ms to 8 ms, so they were replaced:

- Shapes that do not change are drawn once into a cached texture and shown as an image ([`src/ui/bake.ts`](../src/ui/bake.ts)): every button face (up and pressed), the mute button, skill button faces and shadows, the hero panel, the mini-map frame and terrain, the question card and answer buttons.
- Bars are rounded Rectangles ([`src/ui/Bar.ts`](../src/ui/Bar.ts)), which Phaser turns into triangles only when their size changes, and they are resized only when the width in whole pixels changes: HP, mana and EXP in the hero panel, the Nexus bars, the question timer, and the health bars over heroes, towers and minions.
- The mini-map's moving markers are painted with the Canvas 2D API onto a small texture 10 times a second, not every frame.

| CPU time per frame, fight, CPU 4x slower | Before | After |
|---|---|---|
| Average | 20.4 ms | 11.0 ms |
| 95th percentile | 28.9 ms | 17.7 ms |
| Worst | 41.9 ms | 24.5 ms |
| Frames over 33.3 ms (below 30 fps) | 3 | 0 |

The match rules themselves (`stepMatch`, the bot, minions) take under 0.5% of the time.

**2. First load waited on itself.** The fonts started downloading only after the 1.4 MB of JavaScript had arrived and run, and the sprites only after the fonts. Now `index.html` has preload links for the four fonts (a small plugin in `vite.config.ts`), so they arrive with the JavaScript. Menu on slow 4G: 4.8 s → 4.6 s. Sprites are not preloaded: Phaser fetches images its own way, so a preloaded copy was downloaded twice.

**3. Phaser is its own file.** Phaser (357 KB compressed) rarely changes, so after an update a returning player downloads only the game's code (122 KB) again.

## Decided against

- **Object pooling for minions and projectiles** (suggested in the issue). Garbage collection was under 0.1% of the profile and creating minions does not show up at all, so pooling would add code for no measurable gain. Reconsider if `?fps` on a real phone shows stutters when waves spawn.
- **Shrinking Phaser.** It is about 70% of the download and does not shrink by removing unused parts; first load already meets the budget.

## Still to check

- The `?fps` reading on a real mid-range Android phone, during the playtest (#49).
- The shop panel still draws with Graphics while it is open; it is open only briefly. Convert it the same way if a phone shows it slows down.
