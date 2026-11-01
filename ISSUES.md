# Issue backlog (60 issues)


## M0 Foundation (12h)
_Repo, tooling, CI, and a live hello-world on GitHub Pages._

### #1 Create repository, README, license and branch rules
`setup` | 2h | depends: none

Create the GitHub repo (working title MathLegends). Add README (vision, how to run), MIT license, .gitignore (node, dist), and a main-branch protection rule requiring CI to pass.

- [ ] Repo exists with README, LICENSE, .gitignore
- [ ] main requires a PR + passing CI
- [ ] Default branch is main

### #2 Scaffold Vite + TypeScript + Phaser 3 project
`setup` | 3h | depends: #1

npm create vite (vanilla-ts), add phaser. Folder layout: src/{scenes,entities,systems,data,ui,utils}, tests/, docs/, scripts/. Set vite base to '/<repo-name>/' for Pages.

- [ ] npm run dev shows a Phaser canvas
- [ ] npm run build outputs dist/
- [ ] Folders from PLAN.md exist

### #3 Add ESLint, Prettier, Vitest and npm scripts
`setup` | 2h | depends: #2

Scripts: lint, format, test, build, dev. Strict TypeScript.

- [ ] npm run lint and npm test pass on a clean checkout
- [ ] tsconfig strict: true

### #4 Add CI workflow (lint, test, build) on every PR
`setup, deploy` | 2h | depends: #3

Copy .github/workflows/ci.yml from the starter kit.

- [ ] PR shows green check when lint, test and build pass
- [ ] Fails on a deliberate lint error

### #5 Deploy hello-world to GitHub Pages (deploy early)
`deploy` | 2h | depends: #4

Copy deploy.yml. In repo Settings > Pages set Source = GitHub Actions. Merge to main and confirm the live URL.

- [ ] Live URL loads the Phaser canvas
- [ ] Every merge to main redeploys automatically
- [ ] URL added to README

### #6 Add AGENTS.md, issue/PR templates and labels
`setup, docs` | 1h | depends: #1

AGENTS.md tells AI coding agents the rules: one issue = one branch = one PR, data-driven config, tests for systems, no copyrighted assets.

- [ ] AGENTS.md, ISSUE_TEMPLATE, PULL_REQUEST_TEMPLATE committed
- [ ] Labels created


## M1 Design & Data (43h)
_Design doc, economy numbers, curriculum map, data schemas, bilingual seed content._

### #7 Write one-page game design doc
`design, docs` | 4h | depends: #1

Core loop, win condition (destroy enemy Nexus), match length target 8-10 min, controls, what is OUT of MVP (jungle, online, 3v3/5v5, extra heroes, Year 7-12, accounts). Single player vs bot only; no server. Include original game name and IP rules: no Mobile Legends names, heroes, art or audio.

- [ ] docs/GDD.md approved by you
- [ ] MVP scope list and out-of-scope list present
- [ ] IP rules stated

### #8 Define economy and combat formulas as config
`design, balance, data` | 5h | depends: #7

Create src/data/economy.json with: passive gold/s, last-hit base gold per minion type, correct/wrong multipliers, streak bonus and cap, EXP curve, damage formula. Mirror in a spreadsheet.

- [ ] All numbers live in economy.json, none hard-coded
- [ ] Documented in docs/ECONOMY.md with a worked example
- [ ] Math share of income target stated (about 30-40%)

### #9 Indonesian curriculum topic map for Year 1-6 (Kurikulum Merdeka)
`math, design, docs` | 4h | depends: #7

Map Kelas 1-6 (Fase A: 1-2, Fase B: 3-4, Fase C: 5-6) to topics from the Capaian Pembelajaran elements (Bilangan, Aljabar, Pengukuran, Geometri, Analisis Data dan Peluang). Write docs/CURRICULUM.md with 4-6 topics per tier and mark which have a generator. The draft table in PLAN.md must be verified by a teacher against the official CP before questions are written.

- [ ] docs/CURRICULUM.md covers tiers 1-6
- [ ] Each topic has an id used by the question schema
- [ ] Teacher sign-off recorded in the file

### #10 Question bank JSON schema + validator script
`data, math` | 4h | depends: #9

Fields: id, tier (1-6), type (fluency|application|multistep), topic, stem {id,en}, choices[4] (numbers or {id,en}), answerIndex, explanation {id,en}, timeSec, tags. Validator rejects duplicates, bad answerIndex, missing explanation or missing either language.

- [ ] scripts/validate-questions.ts runs in CI
- [ ] Fails on a deliberately broken item
- [ ] Fails if id or en text is missing

### #11 Bilingual procedural question generators
`math, data` | 10h | depends: #10

Parametric generators for the Year 1-6 topics in docs/CURRICULUM.md (e.g. addition, a x b, fraction add, percent, perimeter/area) with distractors from common errors. Each template outputs Indonesian and English text from one source. Use Indonesian contexts (Rp, local names). Deterministic with a seed so tests are repeatable.

- [ ] Generators for at least 12 topic families covering all 6 tiers
- [ ] Every output has id and en text
- [ ] Distractors are plausible, never equal to the answer
- [ ] Unit tests with a fixed seed

### #12 Seed question bank: minimum 15 items per (tier x type), ID + EN
`math, data` | 10h | depends: #10, #11

6 tiers x 3 types x 15 = 270 items minimum, each in Indonesian and English (mix of generated and handwritten, reuse GenSoal output where possible). Handwrite application and multistep items; generators cover fluency. Topics follow docs/CURRICULUM.md.

- [ ] 270+ items pass the validator
- [ ] Each tier has 15+ items per type
- [ ] Both languages present on every item
- [ ] Spot-check of 10% by a teacher

### #13 Hero, item and rank data schemas
`data` | 3h | depends: #7

TypeScript types + JSON files: heroes.json (one hero), items.json, ranks.json (6 tiers). Loader with runtime validation (zod).

- [ ] Loader throws a clear error on bad data
- [ ] Empty-but-valid files committed

### #14 Original placeholder art and audio plan
`design, docs` | 3h | depends: #7

Use CC0 packs (e.g. Kenney) or your own AI-generated originals. Record the license for every asset in docs/ASSETS.md. No ripped game assets.

- [ ] docs/ASSETS.md lists source and license per asset
- [ ] Placeholder sprite set for 1 hero, the bot hero, 3 minions, tower, Nexus, map tiles


## M2 Core Slice (63h)
_Playable 1-lane 1v1 slice: move, fight, minions, towers, win/lose._

### #15 Scene manager: Boot, Menu, Match, Result
`engine` | 4h | depends: #2

Phaser scenes with a typed shared GameState. Responsive scaling for portrait and landscape phones.

- [ ] Navigate Menu > Match > Result
- [ ] Scale mode FIT works at 360x640 and 1280x720

### #16 Single-lane map with bases and tower slots
`engine` | 5h | depends: #15, #14

Horizontal lane, two Nexus, 2 towers per side, camera follow, world bounds.

- [ ] Map renders with correct entity slots
- [ ] Camera follows the player smoothly

### #17 Hero entity: movement and base stats
`engine, gameplay` | 5h | depends: #16, #13

Hero class driven by heroes.json: HP, mana, attack, armor, speed. Keyboard movement first.

- [ ] Hero moves with WASD and arrows
- [ ] Stats come from JSON

### #18 Mobile touch controls (joystick, attack, skill buttons)
`engine, ui` | 6h | depends: #17

Virtual joystick left, attack and 3 skill buttons right, safe-area aware.

- [ ] Playable on a real phone browser
- [ ] No accidental page scroll or zoom

### #19 Combat: basic attack, damage formula, death and respawn
`engine, gameplay` | 8h | depends: #17, #8

Auto-target nearest enemy in range, damage = atk x 100/(100+armor), respawn timer scales with level.

- [ ] Damage matches economy.json formula (unit-tested)
- [ ] Hero dies and respawns at base

### #20 Minion waves: Infantry, Lancer, Cannon
`engine, gameplay` | 8h | depends: #16, #19

Wave spawner on a timer, lane pathing, aggro on nearest enemy, each type with its own stats and sprite.

- [ ] Waves spawn on both sides and fight in the middle
- [ ] Cannon minion appears every Nth wave

### #21 Towers, Nexus and win/lose condition
`engine, gameplay` | 6h | depends: #19, #20

Towers attack nearest enemy, prioritise minions. Destroying the enemy Nexus ends the match.

- [ ] Match ends with a Victory/Defeat result
- [ ] Tower shots are visible and readable

### #22 Gold, EXP and hero levelling
`engine, gameplay` | 5h | depends: #19, #8

Passive gold, kill gold, EXP curve, stat growth per level, cap at level 15.

- [ ] Level-up applies stat growth
- [ ] Values come from economy.json

### #23 Language support: Indonesian and English
`ui, engine` | 3h | depends: #15

i18n helper plus src/data/i18n/id.json and en.json. Language toggle in Menu, saved in the profile. Default from browser language, falling back to Indonesian.

- [ ] All UI strings come from the i18n files
- [ ] Switching language updates the UI without reload
- [ ] Question text uses the chosen language

### #24 Basic bot opponent: lane farming and attack
`ai, gameplay` | 8h | depends: #20, #21

Simple finite-state bot hero: walk to lane, farm minions, attack the player in range, retreat at low HP. Fixed difficulty for now; rank scaling comes later. This makes the slice playable single-player.

- [ ] Bot farms and fights without crashing for a full match
- [ ] Bot behaviour is parameterised from data, not hard-coded

### #25 HUD: HP/mana bars, gold, level, timer, mini-map
`ui` | 5h | depends: #22

Readable on a 6-inch phone, minimal clutter.

- [ ] All elements visible in portrait and landscape
- [ ] Mini-map shows towers and heroes


## M3 Math Engine (31h)
_Last-hit questions, rewards, logging, accessibility._

### #26 Question engine: selection by tier, type and difficulty
`math, engine` | 6h | depends: #12, #22

Pure TypeScript module (no Phaser). Inputs: tier, minion type, recent history. Avoids repeats within a window, applies the 70/20/10 on-level/review/stretch mix.

- [ ] Unit tests prove no repeat within 30 questions
- [ ] Mix ratio verified over 1000 draws within 3%

### #27 Last-hit trigger and non-pausing question overlay
`math, ui, gameplay` | 8h | depends: #26, #25, #18

On last hit, show 4 large tap buttons with a timer bar. Game never pauses. Only one question at a time, queue max 1.

- [ ] Question appears only on the player's last hit
- [ ] Timer by type: Infantry 5s, Lancer 8s, Cannon 12s (tunable)
- [ ] Playable one-handed

### #28 Reward resolver: correct, wrong, timeout, streak, math-share cap
`math, balance, gameplay` | 5h | depends: #27, #8

Correct = 1.5x, wrong or timeout = 0.5x, streak +5% per answer capped at +25%. Cap total math-derived income share per match.

- [ ] Unit tests for every branch
- [ ] Math-derived share stays under the cap in a simulation

### #29 Answer feedback, explanations and review queue
`math, ui` | 5h | depends: #27

Instant correct/wrong cue. Wrong answers stored; show explanation on the Result screen and re-queue the item later.

- [ ] Result screen lists missed questions with explanations
- [ ] Missed items return within the next 3 matches

### #30 Local answer logging and CSV export for research
`math, qa` | 4h | depends: #27

Log tier, type, item id, correct, response ms, match id. Export CSV from a settings screen. No personal data.

- [ ] CSV downloads on desktop and mobile
- [ ] Schema documented in docs/DATA.md

### #31 Accessibility: text size, colour-blind palette, extra time
`ui, math` | 3h | depends: #27, #23

Font scale, colour-blind-safe palette, optional extended timer.

- [ ] Font scale option works in both languages
- [ ] Extended timer multiplies time by 1.5


## M4 Hero & Items (29h)
_One original hero, skills, shop, items, first balance pass._

### #32 Define the single original hero (data)
`gameplay, data` | 2h | depends: #13, #17

One original hero (a balanced Fighter) plus a second hero entry for the bot, using the same schema. Original name, lore, stats. No resemblance to existing MOBA heroes. More heroes are post-MVP.

- [ ] Player hero and bot hero in heroes.json
- [ ] Adding a hero needs JSON only

### #33 Skill framework: cooldown, mana, targeting, ultimate
`gameplay, engine` | 8h | depends: #32, #19

Data-driven skills (projectile, AoE, dash, buff, shield). Cooldown and mana handled by one system.

- [ ] Add a new skill by JSON only
- [ ] Cooldown UI on skill buttons

### #34 Implement the hero's skills
`gameplay` | 4h | depends: #33

3 skills + 1 ultimate for the hero, using the framework, no hero-specific hacks.

- [ ] Every skill works with touch input
- [ ] No skill deals damage beyond the DPS budget in docs/ECONOMY.md

### #35 Item shop UI: buy, sell, categories
`ui, gameplay` | 6h | depends: #22, #25

Open at base or any time via a button (decide in GDD). Categories: Attack, Magic, Defense, Movement, Support.

- [ ] Purchase deducts gold, sell refunds 70%
- [ ] 6 item slots

### #36 Item effects: 8 items with stat stacking and unique passives
`gameplay, balance` | 4h | depends: #35, #13

Items suit the single hero, with a mix of attack, defense, speed and sustain. Unique passives do not stack.

- [ ] 8 items in items.json
- [ ] Stat stacking unit-tested

### #37 Headless bot-vs-bot simulation for balance
`balance, qa` | 5h | depends: #36, #34

Script runs thousands of simulated matches with scripted answer accuracy (30%, 60%, 90%) and outputs win-rate and economy CSV.

- [ ] Mirror match (hero vs hero) stays near 50% at equal accuracy
- [ ] Math-skill advantage is a modest edge, not decisive, at equal combat skill


## M5 Rank System (25h)
_Year 1-6 ranks, placement quiz, persistence._

### #38 Adaptive placement quiz (10 questions)
`math, gameplay` | 6h | depends: #26

Staircase difficulty over Year 1-6 questions. Starting tier = estimated mastery minus 1, capped so nobody starts above Year 5.

- [ ] Same answers always give the same tier (deterministic test)
- [ ] Takes under 3 minutes

### #39 Rank model: 6 tiers x 5 stars, promotion and demotion
`gameplay, math` | 6h | depends: #8

Win +1 star, win with 80%+ accuracy +1 bonus, loss -1. Demotion across a tier only after 2 straight losses at 0 stars. Pure TS module.

- [ ] Unit tests cover promotion, demotion, floor at Year 1
- [ ] Config in ranks.json

### #40 Wire rank to question difficulty mix
`math` | 3h | depends: #39, #26

Question tier = current rank tier. Review items from below, stretch items from above.

- [ ] Year 4 player sees Year 4 questions plus review (Years 1-3) and stretch (Year 5); Year 6 stretch draws harder Year 6 items

### #41 Profile persistence with versioned save and export/import
`engine` | 5h | depends: #39

localStorage, schema version, migration function, JSON export/import for device changes.

- [ ] Refresh keeps rank
- [ ] Old save versions migrate without data loss

### #42 Rank badges, progress bar and post-match summary
`ui` | 5h | depends: #39, #41, #23

Badges Year 1-6, star animation, accuracy summary.

- [ ] Summary shows stars gained and accuracy
- [ ] Badges distinguishable for colour-blind users


## M6 AI & Match Flow (19h)
_Rank-scaled bot difficulty, full match flow, audio and juice._

### #43 Bot upgrade: skills, item buying and rank-scaled difficulty
`ai, gameplay` | 8h | depends: #24, #34, #36, #39

Upgrade the basic bot with skill use and item purchases. Difficulty is looked up from the player's Year tier (Year 1 easiest, Year 6 hardest): last-hit accuracy, reaction time, item timing, aggression. Values live in src/data/bot.json. Since there is no human opponent, this is how matches stay fair across ranks.

- [ ] Six difficulty steps, one per Year tier
- [ ] Bot uses skills and buys items
- [ ] Year 1 bot is beatable by a new player; Year 6 bot is a real challenge (checked with the simulator)

### #44 Full match flow: placement, match, result, rematch
`gameplay, ui` | 5h | depends: #15, #42, #38

Smooth transitions, quit and rematch.

- [ ] No dead ends in any flow
- [ ] Back button behaves sensibly on mobile

### #45 Audio and game feel: SFX, music, damage numbers, screen shake
`ui, engine` | 6h | depends: #44, #14

Licensed or original audio only. Mute toggle.

- [ ] Mute persists
- [ ] Damage numbers readable but not cluttered


## M7 QA & Release (38h)
_Tests, performance, playtests, PWA, v0.1.0 live on GitHub Pages._

### #46 Unit tests for economy, rank, question engine, items
`qa` | 6h | depends: #28, #39, #36

Target 80%+ coverage on src/systems.

- [ ] Coverage gate in CI at 80% for src/systems

### #47 Playwright smoke test on desktop and mobile viewport
`qa` | 6h | depends: #44

Boot, start match, last-hit one minion, answer, finish a short test match, in both languages.

- [ ] Runs in CI
- [ ] Mobile viewport 390x844 passes

### #48 Performance budget and optimisation
`qa, engine` | 6h | depends: #44

Targets: 60 fps on a mid-range Android, bundle under 5 MB, first load under 5 s on 4G. Object pooling for minions and projectiles.

- [ ] Budget measured and written in docs/PERF.md
- [ ] No frame under 30 fps during 1v1 fights

### #49 Student playtest protocol and feedback form
`qa, math, docs` | 5h | depends: #44, #30

Pre/post test, 15-minute play session, replay-intent question ('Would you play again?'), short survey. Consent per your school and ethics process.

- [ ] Protocol in docs/PLAYTEST.md
- [ ] Replay-intent threshold defined (for example 60%+)

### #50 Balance pass v2 from playtest data
`balance` | 6h | depends: #49, #37

Adjust economy.json, timers and item costs from playtest and CSV data.

- [ ] Change log of every number changed and why

### #51 PWA: manifest, service worker, offline play
`deploy, engine` | 4h | depends: #48

Installable on Android, works offline after first load. Mind the Pages base path.

- [ ] Lighthouse PWA checks pass
- [ ] Game launches in airplane mode

### #52 Release checklist, CHANGELOG and v0.1.0 tag
`deploy, docs` | 3h | depends: #46, #47, #50, #51

Semantic version, CHANGELOG.md, GitHub Release with notes and a known-issues list.

- [ ] Tag v0.1.0 and GitHub Release published

### #53 Production deploy to GitHub Pages and public play link
`deploy` | 2h | depends: #52, #5

Verify the live build equals the tag. Add the play link and screenshots to README.

- [ ] Live URL plays the full flow on a phone
- [ ] README has Play link, screenshots and credits


## M8 Post-MVP Backlog (168h)
_Do only after the classroom pilot proves the core loop._

### #54 Supabase auth and cloud save
`backlog` | 12h | depends: #53

Accounts and cloud rank. Needs privacy review for minors.

- [ ] Login and cloud save work
- [ ] Privacy notice published

### #55 Teacher dashboard: class accuracy by topic
`backlog, math` | 16h | depends: #54

Aggregate answer logs per class and topic.

- [ ] Teacher sees weak topics per class

### #56 Online multiplayer prototype
`backlog` | 60h | depends: #53

Authoritative server (Colyseus or similar). Large cost, only if the pilot justifies it.

- [ ] Two players complete a match online

### #57 Jungle camps and objectives (Turtle/Lord-style, original names)
`backlog, gameplay` | 20h | depends: #53

Original neutral objectives with their own questions.

- [ ] Objectives give team buffs and bonus questions

### #58 More heroes and Year 7-12 content
`backlog, gameplay, math` | 40h | depends: #53

Four more original heroes, hero select, tiers 7-12 with their question banks. Only after the pilot.

- [ ] Hero select works
- [ ] Tiers 7-12 pass the validator

### #59 3v3 mode with three lanes
`backlog, gameplay, engine` | 14h | depends: #58

Extend the map to three lanes.

- [ ] 3v3 match completes end to end

### #60 Naming, trademark and original art review
`backlog, docs` | 6h | depends: #53

Confirm the name is not confusingly similar to existing games. Replace placeholders with original art.

- [ ] Written check completed


---
MVP total (M0-M7): **260h**, about **26 weeks at 10h/week**.
