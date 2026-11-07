# Releasing a version (issues #52, #53)

Versions follow [Semantic Versioning](https://semver.org/): **x.y.z**.

- **z** (patch): fixes only, e.g. 0.1.1.
- **y** (minor): new features, e.g. the jungle.
- **x** (major): 1.0.0 once the game is out of the pilot, then for changes that break saves or how the game is played.

## Checklist

1. **Changes are on `main`.** Every change came in through a pull request with green CI: lint, question validation, unit tests with the coverage gate, build, bundle budget, and the browser tests.
2. **Version and notes in one pull request:**
   - Set `"version"` in `package.json` (and run `npm install --package-lock-only`).
   - Add a `## [x.y.z] - YYYY-MM-DD` section at the top of `CHANGELOG.md`, with what changed for players and teachers, and a `### Known issues` list.
   - `tests/release.test.ts` fails if the section or the known issues are missing.
3. **Merge it.** The **Deploy to GitHub Pages** workflow builds and publishes the site. Its `verify-live` job then:
   - waits until https://hawreirei.github.io/Mathlegends/version.json shows this commit;
   - plays a short match on the live site, on a phone screen and a desktop screen, in Indonesian and English, and checks offline play and installability.
4. **When `verify-live` is green, publish:** Actions → **Release** → Run workflow (branch `main`). It creates the tag `vx.y.z` on that commit and a GitHub Release whose text is the version's CHANGELOG section. It refuses if the tag already exists.
5. **Screenshots** (when the look changed): `npm run build`, `npx vite preview --port 4173`, then `npm run screenshots` updates `docs/screenshots/` for the README.
6. **Check by hand on a real phone** (a few minutes):
   - Open the play link, play a match through to the Result screen, and check the version in the Menu's bottom-left corner.
   - Install the game, then open it in airplane mode.
   - Try `?fps` for the frame rate.

The live site always equals a tagged release when steps 3 and 4 run on the same commit. `version.json` shows the version and commit at any time, and the Menu shows the version.

## v0.1.0 (2026-11-07)

The first release, a pilot for the class playtest (#49).

- Released from the merge of the release pull request, after its `verify-live` job passed.
- Not yet done, and listed under Known issues: the teacher reviews (#9, #12) and the balance pass from playtest data (#50).
