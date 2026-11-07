# Changelog

All notable changes to MathLegends. Versions follow [Semantic Versioning](https://semver.org/); the format follows [Keep a Changelog](https://keepachangelog.com/). How a version is released: [docs/RELEASE.md](docs/RELEASE.md).

## [0.1.0] - 2026-11-07

The first public version: a pilot for playtesting with a class (#49). **Play: https://hawreirei.github.io/Mathlegends/**

### The game

- A one-lane MOBA against a computer opponent: one hero each, minion waves (Infantry, Lancer, Cannon), two towers and a Nexus per side. Destroy the enemy Nexus to win. Matches last about 8 to 10 minutes; from 7:00 sudden death makes towers, then the Nexus, crumble in order so every match ends.
- **Math on every last hit:** when your hero lands the killing blow on a minion, a four-choice question appears (5, 8 or 12 seconds by minion). The match keeps running. A right answer pays x1.5 gold and EXP, a wrong one x0.5; the right answer is shown after every question, and missed questions come back in later matches with an explanation on the Result screen.
- **About 300 bilingual questions** for Year (Kelas) 1 to 6 of Kurikulum Merdeka, plus generators for 28 topics, in **Indonesian and English** (toggle on the Menu).
- **Ranks:** everyone starts in **Year 1**; wins earn stars (a bonus star for high accuracy), 5 stars move you up a Year, two losses at 0 stars move you down. Year 6 has no star cap. The Year sets the question mix and the bot's skill.
- **Hero, skills and items:** heroes Nova (player) and Mira (bot), four skills each (projectile, area, dash, shield, ultimate), a shop with 8 items and passives, levels up to 15.
- **Bot:** six difficulty steps, one per Year: a new player wins about 83% against Year 1 and 9% against Year 6 in 2,000 simulated matches.
- **Late game:** minions grow stronger over the match (#68); destroying the enemy's inner tower brings **super minions** to your waves (#69).
- **Game feel:** original synthesised sound effects and music, damage numbers, screen shake on big moments (#45).

### For players, teachers and families

- Plays in the browser on phones, tablets and computers; touch controls (joystick, attack and skill buttons) or keyboard (WASD/arrows, Space, Q E R F, 1-4 to answer).
- **Install and play offline:** add it to the home screen; after one online visit it plays in airplane mode (#51, docs/OFFLINE.md).
- **Accessibility:** question text size, colour-blind colours, extra time (x1.5), Reduce motion; Sound effects and Music switches, and a mute button in matches.
- **Progress stays on the device** (no accounts, no server, no personal data). Settings → Move to another device saves it to a file and loads it elsewhere.
- **Answer data for research:** an anonymous log of every answer, downloadable as CSV from Settings (docs/DATA.md).
- The phone's Back button never leaves the game except from the Menu.

### Under the hood

- Game rules are pure TypeScript in `src/systems/`, tested by 460 unit tests at 98% coverage (CI fails below 80%), and a browser smoke test that plays a short match on desktop and phone screens in both languages, plus an offline test (docs/TESTING.md).
- Performance budget: first load 2.1 s on 4G and 4.6 s on slow 4G with a phone-speed CPU, 11 ms of CPU per frame in a busy fight (docs/PERF.md). A balance simulator plays thousands of matches (docs/BALANCE.md).
- Every deploy checks that the live site serves the deployed commit and plays a match on it.

### Known issues

- **Teacher reviews still to come:** the curriculum map (#9) and a spot-check of 10% of the questions (#12) have not yet been signed off by a teacher.
- **Older students start low:** with no placement quiz (removed at the owner's request), a Year 5 or 6 student plays about 20 wins of easier Years first. Watch this in the playtest.
- **Balance is from simulation only:** win rates, rewards and timings come from the simulator; the balance pass from real playtest data is #50. Super minions rarely matter in simulated matches, because inner towers usually fall during sudden death.
- **Frame rate not yet measured on a real phone:** the CPU budget is met with a 4x slowed CPU, but the test machine has no GPU. Open the game with `?fps` on a mid-range Android to see the real frame rate.
- **The shop panel** still draws with the slower Graphics objects while open.
- **Clearing the browser's data** for the site deletes the stored game and the player's progress; save a copy first (Settings → Move to another device).
- Sounds are synthesised placeholders, to be judged by ear in the playtest.

[0.1.0]: https://github.com/Hawreirei/Mathlegends/releases/tag/v0.1.0
