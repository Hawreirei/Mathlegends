# MathLegends: Full Development Plan (from scratch to GitHub Pages)

Working title: **MathLegends** (rename freely, but avoid names close to existing games).
A 1-lane MOBA where every last-hit on a minion triggers a math question. The answer converts into gold and EXP. Ranks are Year 1 to Year 6 and control question difficulty.

## 1. Vision and hard constraints

| Item | Decision |
|---|---|
| Platform | Web (mobile browser first), later installable PWA |
| Engine | Phaser 3 + TypeScript + Vite |
| Hosting | GitHub Pages via GitHub Actions |
| MVP mode | Single player, 1v1 vs a bot on one lane, one hero. No server: everything runs in the browser. |
| Languages | Indonesian and English, switchable in the game. Questions are written in both. |
| Curriculum | Indonesian curriculum (Kurikulum Merdeka), Kelas 1-6 |
| Out of MVP | Online multiplayer, jungle, 3v3/5v5, extra heroes, Year 7-12, accounts, payments |
| IP rule | Original name, heroes, art and audio. Nothing from Mobile Legends. |
| Data | No personal data in MVP. Answer logs are anonymous. |

## 2. Core loop (what must be fun)

1. Start a match against the bot (its difficulty follows your rank).
2. Farm minion waves in the lane.
3. On YOUR last hit, a 4-choice question appears for 5 to 12 seconds. The game never pauses.
4. Correct = 1.5x gold/EXP. Wrong or timeout = 0.5x. Streak adds up to +25%.
5. Buy items, level up, push towers, destroy the enemy Nexus.
6. Win = +1 star. 80%+ accuracy = +1 bonus star. Stars promote you through Year 1 to Year 6.

**Replay test (go/no-go):** after the M2/M3 slice, if fewer than about 60% of student testers say they would play again, fix the loop before adding any content.

## 3. Rank system (Year 1 to Year 6)

- 6 tiers x 5 stars. Floor at Year 1.
- Placement quiz of 10 adaptive questions sets the start tier (never above Year 5).
- Question mix per rank: 70% on-level, 20% review from below, 10% stretch from above (Year 6 stretch uses the hardest Year 6 items).
- **Bot difficulty follows rank.** There is no human opponent, so the bot is the matchmaking: Year 1 bot is gentle, Year 6 bot is strong. Values live in `src/data/bot.json`.
- Minion type controls question type: Infantry = fluency (5s), Lancer = application (8s), Cannon = multi-step (12s, bigger reward).
- Tier topic map (summary; full map with topic ids in docs/CURRICULUM.md):

Tier = Kelas (grade) in the Indonesian curriculum (Kurikulum Merdeka). Fase A = Kelas 1-2, Fase B = Kelas 3-4, Fase C = Kelas 5-6.

**DRAFT: not yet checked against the official Capaian Pembelajaran (CP). A teacher must verify docs/CURRICULUM.md before questions are written (#9).**

| Tier | Fase | Topics (draft, from src/data/curriculum.json) |
|---|---|---|
| 1 | A | Counting and comparing numbers to 20, Addition and subtraction within 20, Simple number and object patterns, Recognising 2D and 3D shapes, Comparing length and weight (non-standard units) |
| 2 | A | Numbers to 100 and place value, Addition and subtraction within 100, Halves and quarters, Multiplication as repeated addition, Money (Rupiah) and telling the time, Tally charts and pictograms |
| 3 | B | Numbers to 1,000 and place value, Addition and subtraction within 1,000, Multiplication and division within 100, Comparing simple fractions, Standard units of length and weight (cm, m, g, kg), Picture graphs and bar charts |
| 4 | B | Numbers to 10,000, Multi-digit multiplication and division, Equivalent fractions, Tenths and hundredths as decimals, Perimeter and area of squares and rectangles, Properties of triangles, quadrilaterals and polygons |
| 5 | C | Numbers to 1,000,000, Lowest common multiple and highest common factor, Adding and subtracting fractions, Decimals and percentages, Measuring and comparing angles, Reading charts, mean and mode |
| 6 | C | Multiplying and dividing fractions, Ratio and proportion, Speed and scale, Mixed operations (order of operations), Volume of cubes and cuboids, Chance: certain, possible, impossible |

Years 7-12 are post-MVP.

## 4. Economy (all values in `src/data/economy.json`)

Starting values to tune with the headless simulator:

- Passive gold: 2 gold/s.
- Last-hit base gold: Infantry 20, Lancer 35, Cannon 60.
- Reward multiplier: correct 1.5, wrong 0.5, timeout 0.5.
- Streak bonus: +5% per consecutive correct, cap +25%.
- EXP follows the same multipliers; level cap 15.
- Damage = ATK x 100 / (100 + ARMOR).
- **Fairness cap:** math-derived income must stay at about 30 to 40% of total gold in simulation, so combat skill still matters.

These are design guesses, not facts. The `sim` issue exists to replace them with measured values.

## 5. Architecture

```
src/
  scenes/     Boot, Menu, Match, Result
  entities/   Hero, Minion, Tower, Nexus, Projectile
  systems/    economy, combat, rank, questionEngine, rewards, ai (pure TS, unit-tested)
  data/       economy.json, heroes.json, items.json, ranks.json, bot.json, i18n/{id,en}.json, questions/*.json
  ui/         HUD, QuestionOverlay, Shop, Joystick
  utils/      rng, i18n, storage
tests/        vitest for systems, playwright for e2e
docs/         GDD, ECONOMY, CURRICULUM, DATA, PERF, PLAYTEST, ASSETS
scripts/      validate-questions, simulate, create_issues.sh
```

Rule: **game rules live in `systems/` with no Phaser import**, so they can be tested and simulated headless. Phaser only renders.

## 6. Milestones

| Milestone | Outcome | Hours |
|---|---|---|
| M0 Foundation | Repo, CI, live hello-world | 12 |
| M1 Design & Data | GDD, economy, curriculum map, schemas, 270+ bilingual questions | 43 |
| M2 Core Slice | Playable 1v1 lane vs a basic bot, ID/EN | 63 |
| M3 Math Engine | Last-hit questions and rewards | 31 |
| M4 Hero & Items | 1 hero, 8 items, balance sim | 29 |
| M5 Rank System | Year 1 to 6, placement, saves | 25 |
| M6 AI & Flow | Rank-scaled bot, full flow, juice | 19 |
| M7 QA & Release | Tests, perf, pilot, PWA, v0.1.0 | 38 |
| M8 Post-MVP | More heroes, Year 7-12, 3v3, cloud, teacher dashboard, online (only if pilot succeeds) | 168 |

Total MVP effort from the backlog is in `ISSUES.md` (260h, an estimate, not measured). At 10 h/week that is about 26 weeks. Scope cuts already applied: one hero, 8 items, Year 1-6 only, 270 questions, no 3v3. Reusing GenSoal output for the question bank may save up to about 10h.

## 7. Workflow with AI agents

- One issue = one branch = one pull request.
- Agent prompt template: "Implement issue #N. Read AGENTS.md and the issue. Write tests first for anything in `systems/`. Do not change numbers outside the data files."
- You review every PR against the acceptance criteria. Never let an agent merge its own work.
- Keep a `CHANGELOG.md`; tag releases with semver.

## 8. Risks and opportunity cost

| Risk | Impact | Mitigation |
|---|---|---|
| Scope creep to full MOBA | 6+ months lost | MVP list is frozen; M8 is locked until the pilot passes |
| Questions break game flow | Students quit | Non-pausing overlay, tunable timers, replay test |
| Rank by grade frustrates weak students | Churn | Placement quiz, 50% reward floor, review mix, bot difficulty scaled to rank |
| Curriculum map is wrong | Questions teach the wrong order | Teacher sign-off on docs/CURRICULUM.md before writing questions |
| Progress lives only in the browser | Lost saves | Export/import in #41, tell testers |
| Math skill decides every match | Unfair | Fairness cap and simulator |
| IP complaints | Takedown | Original assets, `ASSETS.md`, `ip` issue |
| Child data and consent | Legal | No accounts in MVP, no server, anonymous logs kept on the device, school consent |
| Part-time capacity | Slips | Weekly 10h budget, milestone review every 2 weeks |

Opportunity cost: about 260 hours is roughly 26 weeks of your evenings. Decide which current project pauses to make room, and consider reusing this game as the next study's treatment so the same work serves research.

## 9. Step-by-step: from zero to live on GitHub

1. Create the empty repo on GitHub (name it, e.g., `mathlegends`).
2. Unzip this kit into a local folder, then:
   ```
   git init && git add . && git commit -m "chore: starter kit"
   git branch -M main
   git remote add origin https://github.com/<you>/mathlegends.git
   git push -u origin main
   ```
3. Run `bash scripts/create_issues.sh <you>/mathlegends` (needs the GitHub CLI, run `gh auth login` once). This creates all labels, milestones and issues.
4. Do issues #1 to #6 (M0). In Settings > Pages choose **Source: GitHub Actions**.
5. Open Claude Code (or your agent) in the repo and work issue by issue.
6. Each merge to `main` redeploys to `https://<you>.github.io/mathlegends/`.
7. At the end of M7, tag `v0.1.0`.

Note: the `create_issues.sh` script was written but not executed here, because I have no access to your GitHub account. Run it yourself and check the first few issues.
