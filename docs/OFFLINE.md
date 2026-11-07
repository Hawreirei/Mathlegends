# Install and play offline (issue #51)

MathLegends is a Progressive Web App: it can be **added to the home screen like an app** and **played without internet** after one visit online. Useful for schools with weak Wi-Fi and children without mobile data.

## For players and teachers

1. Open the game once while online, on the phone or tablet that will play it: https://hawreirei.github.io/Mathlegends/. The whole game (about 2 MB) is stored on the device in the background.
2. **Install it (optional):** in Chrome on Android, tap the menu (⋮) and **Add to Home screen** / **Install app** ("Tambahkan ke Layar utama" / "Instal aplikasi"); Chrome may also offer it by itself. On iPhone or iPad: Safari → Share → **Add to Home Screen**. The game then opens full screen from its own icon.
3. **Offline:** after that first visit the game opens and plays in airplane mode or with no signal, from the icon or the browser. Progress, settings and the answer log are kept on the device as always.
4. **Updates:** whenever the device is online, opening the game loads the newest version; offline, it plays the last stored version.

Clearing the browser's data for the site removes the stored game *and* the player's progress (use Settings → Move to another device to keep a copy first).

## How it works

- **Manifest** (`manifest.webmanifest`, written at build time): name, the Indonesian tagline as description, full screen, any orientation, the game's colours, and the icons (`public/icons/`, see docs/ASSETS.md). Everything stays under `/Mathlegends/`, the GitHub Pages path (case-sensitive).
- **Service worker** (`sw.js`, written at build time from the real list of built files, [`scripts/pwa.ts`](../scripts/pwa.ts), plugin in `vite.config.ts`; registered in `src/main.ts`, production builds only):
  - On install it stores every file of the build (37 files: page, scripts, styles, `.woff2` fonts, sprites, icons, manifest) in a cache named after a hash of those files.
  - The page itself: **network first**, so online players always get the newest version; offline, the stored page.
  - Everything else: **the stored copy first**. All file names carry a content hash, so a stored file is never out of date; a new build has new names.
  - Lookups ignore `Vary`, because scripts and fonts are requested with an `Origin` header and a server's `Vary: Origin` would otherwise make them miss the stored copy (found by the offline test).
  - When a new version activates, the caches of older versions are deleted.

## Checked

- `tests/pwa.test.ts`: the manifest (paths under `/Mathlegends/`, 192 and 512 PNG icons, a maskable icon, full screen), the list of stored files, the cache version, and the service worker's rules.
- `e2e/offline.spec.ts` (Playwright, in CI): after one online visit, Chrome's installability check reports **no errors**; then, offline, a reload shows the Menu and a match starts with all sprites loaded.

Lighthouse 12 removed its PWA category, so the issue's "Lighthouse PWA checks" are covered by the same check Lighthouse used to run: Chrome's own installability test (`Page.getInstallabilityErrors`), asserted to be empty.
