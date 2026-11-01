import json, os

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MS = [
    ("M0 Foundation", "Repo, tooling, CI, and a live hello-world on GitHub Pages."),
    ("M1 Design & Data", "Design doc, economy numbers, curriculum map, data schemas, bilingual seed content."),
    ("M2 Core Slice", "Playable 1-lane 1v1 slice: move, fight, minions, towers, win/lose."),
    ("M3 Math Engine", "Last-hit questions, rewards, logging, accessibility."),
    ("M4 Hero & Items", "One original hero, skills, shop, items, first balance pass."),
    ("M5 Rank System", "Year 1-6 ranks, placement quiz, persistence."),
    ("M6 AI & Match Flow", "Rank-scaled bot difficulty, full match flow, audio and juice."),
    ("M7 QA & Release", "Tests, performance, playtests, PWA, v0.1.0 live on GitHub Pages."),
    ("M8 Post-MVP Backlog", "Do only after the classroom pilot proves the core loop."),
]

# key, title, milestone idx, labels, hours, deps(keys), description, acceptance criteria
I = []
def add(key, title, ms, labels, hrs, deps, desc, ac):
    I.append(dict(key=key, title=title, ms=ms, labels=labels, hrs=hrs, deps=deps, desc=desc, ac=ac))

# ---------------- M0
add("repo", "Create repository, README, license and branch rules", 0, ["setup"], 2, [],
    "Create the GitHub repo (working title MathLegends). Add README (vision, how to run), MIT license, .gitignore (node, dist), and a main-branch protection rule requiring CI to pass.",
    ["Repo exists with README, LICENSE, .gitignore", "main requires a PR + passing CI", "Default branch is main"])
add("scaffold", "Scaffold Vite + TypeScript + Phaser 3 project", 0, ["setup"], 3, ["repo"],
    "npm create vite (vanilla-ts), add phaser. Folder layout: src/{scenes,entities,systems,data,ui,utils}, tests/, docs/, scripts/. Set vite base to '/<repo-name>/' for Pages.",
    ["npm run dev shows a Phaser canvas", "npm run build outputs dist/", "Folders from PLAN.md exist"])
add("tooling", "Add ESLint, Prettier, Vitest and npm scripts", 0, ["setup"], 2, ["scaffold"],
    "Scripts: lint, format, test, build, dev. Strict TypeScript.",
    ["npm run lint and npm test pass on a clean checkout", "tsconfig strict: true"])
add("ci", "Add CI workflow (lint, test, build) on every PR", 0, ["setup", "deploy"], 2, ["tooling"],
    "Copy .github/workflows/ci.yml from the starter kit.",
    ["PR shows green check when lint, test and build pass", "Fails on a deliberate lint error"])
add("pages", "Deploy hello-world to GitHub Pages (deploy early)", 0, ["deploy"], 2, ["ci"],
    "Copy deploy.yml. In repo Settings > Pages set Source = GitHub Actions. Merge to main and confirm the live URL.",
    ["Live URL loads the Phaser canvas", "Every merge to main redeploys automatically", "URL added to README"])
add("agents", "Add AGENTS.md, issue/PR templates and labels", 0, ["setup", "docs"], 1, ["repo"],
    "AGENTS.md tells AI coding agents the rules: one issue = one branch = one PR, data-driven config, tests for systems, no copyrighted assets.",
    ["AGENTS.md, ISSUE_TEMPLATE, PULL_REQUEST_TEMPLATE committed", "Labels created"])

# ---------------- M1
add("gdd", "Write one-page game design doc", 1, ["design", "docs"], 4, ["repo"],
    "Core loop, win condition (destroy enemy Nexus), match length target 8-10 min, controls, what is OUT of MVP (jungle, online, 3v3/5v5, extra heroes, Year 7-12, accounts). Single player vs bot only; no server. Include original game name and IP rules: no Mobile Legends names, heroes, art or audio.",
    ["docs/GDD.md approved by you", "MVP scope list and out-of-scope list present", "IP rules stated"])
add("econ", "Define economy and combat formulas as config", 1, ["design", "balance", "data"], 5, ["gdd"],
    "Create src/data/economy.json with: passive gold/s, last-hit base gold per minion type, correct/wrong multipliers, streak bonus and cap, EXP curve, damage formula. Mirror in a spreadsheet.",
    ["All numbers live in economy.json, none hard-coded", "Documented in docs/ECONOMY.md with a worked example", "Math share of income target stated (about 30-40%)"])
add("curriculum", "Indonesian curriculum topic map for Year 1-6 (Kurikulum Merdeka)", 1, ["math", "design", "docs"], 4, ["gdd"],
    "Map Kelas 1-6 (Fase A: 1-2, Fase B: 3-4, Fase C: 5-6) to topics from the Capaian Pembelajaran elements (Bilangan, Aljabar, Pengukuran, Geometri, Analisis Data dan Peluang). Write docs/CURRICULUM.md with 4-6 topics per tier and mark which have a generator. The draft table in PLAN.md must be verified by a teacher against the official CP before questions are written.",
    ["docs/CURRICULUM.md covers tiers 1-6", "Each topic has an id used by the question schema", "Teacher sign-off recorded in the file"])
add("qschema", "Question bank JSON schema + validator script", 1, ["data", "math"], 4, ["curriculum"],
    "Fields: id, tier (1-6), type (fluency|application|multistep), topic, stem {id,en}, choices[4] (numbers or {id,en}), answerIndex, explanation {id,en}, timeSec, tags. Validator rejects duplicates, bad answerIndex, missing explanation or missing either language.",
    ["scripts/validate-questions.ts runs in CI", "Fails on a deliberately broken item", "Fails if id or en text is missing"])
add("qgen", "Bilingual procedural question generators", 1, ["math", "data"], 10, ["qschema"],
    "Parametric generators for the Year 1-6 topics in docs/CURRICULUM.md (e.g. addition, a x b, fraction add, percent, perimeter/area) with distractors from common errors. Each template outputs Indonesian and English text from one source. Use Indonesian contexts (Rp, local names). Deterministic with a seed so tests are repeatable.",
    ["Generators for at least 12 topic families covering all 6 tiers", "Every output has id and en text", "Distractors are plausible, never equal to the answer", "Unit tests with a fixed seed"])
add("qseed", "Seed question bank: minimum 15 items per (tier x type), ID + EN", 1, ["math", "data"], 10, ["qschema", "qgen"],
    "6 tiers x 3 types x 15 = 270 items minimum, each in Indonesian and English (mix of generated and handwritten, reuse GenSoal output where possible). Handwrite application and multistep items; generators cover fluency. Topics follow docs/CURRICULUM.md.",
    ["270+ items pass the validator", "Each tier has 15+ items per type", "Both languages present on every item", "Spot-check of 10% by a teacher"])
add("dataschema", "Hero, item and rank data schemas", 1, ["data"], 3, ["gdd"],
    "TypeScript types + JSON files: heroes.json (one hero), items.json, ranks.json (6 tiers). Loader with runtime validation (zod).",
    ["Loader throws a clear error on bad data", "Empty-but-valid files committed"])
add("assets", "Original placeholder art and audio plan", 1, ["design", "docs"], 3, ["gdd"],
    "Use CC0 packs (e.g. Kenney) or your own AI-generated originals. Record the license for every asset in docs/ASSETS.md. No ripped game assets.",
    ["docs/ASSETS.md lists source and license per asset", "Placeholder sprite set for 1 hero, the bot hero, 3 minions, tower, Nexus, map tiles"])

# ---------------- M2
add("scenes", "Scene manager: Boot, Menu, Match, Result", 2, ["engine"], 4, ["scaffold"],
    "Phaser scenes with a typed shared GameState. Responsive scaling for portrait and landscape phones.",
    ["Navigate Menu > Match > Result", "Scale mode FIT works at 360x640 and 1280x720"])
add("map", "Single-lane map with bases and tower slots", 2, ["engine"], 5, ["scenes", "assets"],
    "Horizontal lane, two Nexus, 2 towers per side, camera follow, world bounds.",
    ["Map renders with correct entity slots", "Camera follows the player smoothly"])
add("hero", "Hero entity: movement and base stats", 2, ["engine", "gameplay"], 5, ["map", "dataschema"],
    "Hero class driven by heroes.json: HP, mana, attack, armor, speed. Keyboard movement first.",
    ["Hero moves with WASD and arrows", "Stats come from JSON"])
add("touch", "Mobile touch controls (joystick, attack, skill buttons)", 2, ["engine", "ui"], 6, ["hero"],
    "Virtual joystick left, attack and 3 skill buttons right, safe-area aware.",
    ["Playable on a real phone browser", "No accidental page scroll or zoom"])
add("combat", "Combat: basic attack, damage formula, death and respawn", 2, ["engine", "gameplay"], 8, ["hero", "econ"],
    "Auto-target nearest enemy in range, damage = atk x 100/(100+armor), respawn timer scales with level.",
    ["Damage matches economy.json formula (unit-tested)", "Hero dies and respawns at base"])
add("minions", "Minion waves: Infantry, Lancer, Cannon", 2, ["engine", "gameplay"], 8, ["map", "combat"],
    "Wave spawner on a timer, lane pathing, aggro on nearest enemy, each type with its own stats and sprite.",
    ["Waves spawn on both sides and fight in the middle", "Cannon minion appears every Nth wave"])
add("towers", "Towers, Nexus and win/lose condition", 2, ["engine", "gameplay"], 6, ["combat", "minions"],
    "Towers attack nearest enemy, prioritise minions. Destroying the enemy Nexus ends the match.",
    ["Match ends with a Victory/Defeat result", "Tower shots are visible and readable"])
add("xp", "Gold, EXP and hero levelling", 2, ["engine", "gameplay"], 5, ["combat", "econ"],
    "Passive gold, kill gold, EXP curve, stat growth per level, cap at level 15.",
    ["Level-up applies stat growth", "Values come from economy.json"])
add("i18n", "Language support: Indonesian and English", 2, ["ui", "engine"], 3, ["scenes"],
    "i18n helper plus src/data/i18n/id.json and en.json. Language toggle in Menu, saved in the profile. Default from browser language, falling back to Indonesian.",
    ["All UI strings come from the i18n files", "Switching language updates the UI without reload", "Question text uses the chosen language"])
add("basicbot", "Basic bot opponent: lane farming and attack", 2, ["ai", "gameplay"], 8, ["minions", "towers"],
    "Simple finite-state bot hero: walk to lane, farm minions, attack the player in range, retreat at low HP. Fixed difficulty for now; rank scaling comes later. This makes the slice playable single-player.",
    ["Bot farms and fights without crashing for a full match", "Bot behaviour is parameterised from data, not hard-coded"])
add("hud", "HUD: HP/mana bars, gold, level, timer, mini-map", 2, ["ui"], 5, ["xp"],
    "Readable on a 6-inch phone, minimal clutter.",
    ["All elements visible in portrait and landscape", "Mini-map shows towers and heroes"])

# ---------------- M3
add("qengine", "Question engine: selection by tier, type and difficulty", 3, ["math", "engine"], 6, ["qseed", "xp"],
    "Pure TypeScript module (no Phaser). Inputs: tier, minion type, recent history. Avoids repeats within a window, applies the 70/20/10 on-level/review/stretch mix.",
    ["Unit tests prove no repeat within 30 questions", "Mix ratio verified over 1000 draws within 3%"])
add("qui", "Last-hit trigger and non-pausing question overlay", 3, ["math", "ui", "gameplay"], 8, ["qengine", "hud", "touch"],
    "On last hit, show 4 large tap buttons with a timer bar. Game never pauses. Only one question at a time, queue max 1.",
    ["Question appears only on the player's last hit", "Timer by type: Infantry 5s, Lancer 8s, Cannon 12s (tunable)", "Playable one-handed"])
add("reward", "Reward resolver: correct, wrong, timeout, streak, math-share cap", 3, ["math", "balance", "gameplay"], 5, ["qui", "econ"],
    "Correct = 1.5x, wrong or timeout = 0.5x, streak +5% per answer capped at +25%. Cap total math-derived income share per match.",
    ["Unit tests for every branch", "Math-derived share stays under the cap in a simulation"])
add("feedback", "Answer feedback, explanations and review queue", 3, ["math", "ui"], 5, ["qui"],
    "Instant correct/wrong cue. Wrong answers stored; show explanation on the Result screen and re-queue the item later.",
    ["Result screen lists missed questions with explanations", "Missed items return within the next 3 matches"])
add("logging", "Local answer logging and CSV export for research", 3, ["math", "qa"], 4, ["qui"],
    "Log tier, type, item id, correct, response ms, match id. Export CSV from a settings screen. No personal data.",
    ["CSV downloads on desktop and mobile", "Schema documented in docs/DATA.md"])
add("a11y", "Accessibility: text size, colour-blind palette, extra time", 3, ["ui", "math"], 3, ["qui", "i18n"],
    "Font scale, colour-blind-safe palette, optional extended timer.",
    ["Font scale option works in both languages", "Extended timer multiplies time by 1.5"])

# ---------------- M4
add("classes", "Define the single original hero (data)", 4, ["gameplay", "data"], 2, ["dataschema", "hero"],
    "One original hero (a balanced Fighter) plus a second hero entry for the bot, using the same schema. Original name, lore, stats. No resemblance to existing MOBA heroes. More heroes are post-MVP.",
    ["Player hero and bot hero in heroes.json", "Adding a hero needs JSON only"])
add("skills", "Skill framework: cooldown, mana, targeting, ultimate", 4, ["gameplay", "engine"], 8, ["classes", "combat"],
    "Data-driven skills (projectile, AoE, dash, buff, shield). Cooldown and mana handled by one system.",
    ["Add a new skill by JSON only", "Cooldown UI on skill buttons"])
add("heroskills", "Implement the hero's skills", 4, ["gameplay"], 4, ["skills"],
    "3 skills + 1 ultimate for the hero, using the framework, no hero-specific hacks.",
    ["Every skill works with touch input", "No skill deals damage beyond the DPS budget in docs/ECONOMY.md"])
add("shop", "Item shop UI: buy, sell, categories", 4, ["ui", "gameplay"], 6, ["xp", "hud"],
    "Open at base or any time via a button (decide in GDD). Categories: Attack, Magic, Defense, Movement, Support.",
    ["Purchase deducts gold, sell refunds 70%", "6 item slots"])
add("items", "Item effects: 8 items with stat stacking and unique passives", 4, ["gameplay", "balance"], 4, ["shop", "dataschema"],
    "Items suit the single hero, with a mix of attack, defense, speed and sustain. Unique passives do not stack.",
    ["8 items in items.json", "Stat stacking unit-tested"])
add("sim", "Headless bot-vs-bot simulation for balance", 4, ["balance", "qa"], 5, ["items", "heroskills"],
    "Script runs thousands of simulated matches with scripted answer accuracy (30%, 60%, 90%) and outputs win-rate and economy CSV.",
    ["Mirror match (hero vs hero) stays near 50% at equal accuracy", "Math-skill advantage is a modest edge, not decisive, at equal combat skill"])

# ---------------- M5
add("placement", "Adaptive placement quiz (10 questions)", 5, ["math", "gameplay"], 6, ["qengine"],
    "Staircase difficulty over Year 1-6 questions. Starting tier = estimated mastery minus 1, capped so nobody starts above Year 5.",
    ["Same answers always give the same tier (deterministic test)", "Takes under 3 minutes"])
add("rankmodel", "Rank model: 6 tiers x 5 stars, promotion and demotion", 5, ["gameplay", "math"], 6, ["econ"],
    "Win +1 star, win with 80%+ accuracy +1 bonus, loss -1. Demotion across a tier only after 2 straight losses at 0 stars. Pure TS module.",
    ["Unit tests cover promotion, demotion, floor at Year 1", "Config in ranks.json"])
add("rankmix", "Wire rank to question difficulty mix", 5, ["math"], 3, ["rankmodel", "qengine"],
    "Question tier = current rank tier. Review items from below, stretch items from above.",
    ["Year 4 player sees Year 4 questions plus review (Years 1-3) and stretch (Year 5); Year 6 stretch draws harder Year 6 items"])
add("save", "Profile persistence with versioned save and export/import", 5, ["engine"], 5, ["rankmodel"],
    "localStorage, schema version, migration function, JSON export/import for device changes.",
    ["Refresh keeps rank", "Old save versions migrate without data loss"])
add("rankui", "Rank badges, progress bar and post-match summary", 5, ["ui"], 5, ["rankmodel", "save", "i18n"],
    "Badges Year 1-6, star animation, accuracy summary.",
    ["Summary shows stars gained and accuracy", "Badges distinguishable for colour-blind users"])

# ---------------- M6
add("bots", "Bot upgrade: skills, item buying and rank-scaled difficulty", 6, ["ai", "gameplay"], 8, ["basicbot", "heroskills", "items", "rankmodel"],
    "Upgrade the basic bot with skill use and item purchases. Difficulty is looked up from the player's Year tier (Year 1 easiest, Year 6 hardest): last-hit accuracy, reaction time, item timing, aggression. Values live in src/data/bot.json. Since there is no human opponent, this is how matches stay fair across ranks.",
    ["Six difficulty steps, one per Year tier", "Bot uses skills and buys items", "Year 1 bot is beatable by a new player; Year 6 bot is a real challenge (checked with the simulator)"])
add("flow", "Full match flow: placement, match, result, rematch", 6, ["gameplay", "ui"], 5, ["scenes", "rankui", "placement"],
    "Smooth transitions, quit and rematch.",
    ["No dead ends in any flow", "Back button behaves sensibly on mobile"])
add("juice", "Audio and game feel: SFX, music, damage numbers, screen shake", 6, ["ui", "engine"], 6, ["flow", "assets"],
    "Licensed or original audio only. Mute toggle.",
    ["Mute persists", "Damage numbers readable but not cluttered"])

# ---------------- M7
add("unit", "Unit tests for economy, rank, question engine, items", 7, ["qa"], 6, ["reward", "rankmodel", "items"],
    "Target 80%+ coverage on src/systems.",
    ["Coverage gate in CI at 80% for src/systems"])
add("e2e", "Playwright smoke test on desktop and mobile viewport", 7, ["qa"], 6, ["flow"],
    "Boot, start match, last-hit one minion, answer, finish a short test match, in both languages.",
    ["Runs in CI", "Mobile viewport 390x844 passes"])
add("perf", "Performance budget and optimisation", 7, ["qa", "engine"], 6, ["flow"],
    "Targets: 60 fps on a mid-range Android, bundle under 5 MB, first load under 5 s on 4G. Object pooling for minions and projectiles.",
    ["Budget measured and written in docs/PERF.md", "No frame under 30 fps during 1v1 fights"])
add("playtest", "Student playtest protocol and feedback form", 7, ["qa", "math", "docs"], 5, ["flow", "logging"],
    "Pre/post test, 15-minute play session, replay-intent question ('Would you play again?'), short survey. Consent per your school and ethics process.",
    ["Protocol in docs/PLAYTEST.md", "Replay-intent threshold defined (for example 60%+)"])
add("balance2", "Balance pass v2 from playtest data", 7, ["balance"], 6, ["playtest", "sim"],
    "Adjust economy.json, timers and item costs from playtest and CSV data.",
    ["Change log of every number changed and why"])
add("pwa", "PWA: manifest, service worker, offline play", 7, ["deploy", "engine"], 4, ["perf"],
    "Installable on Android, works offline after first load. Mind the Pages base path.",
    ["Lighthouse PWA checks pass", "Game launches in airplane mode"])
add("release", "Release checklist, CHANGELOG and v0.1.0 tag", 7, ["deploy", "docs"], 3, ["unit", "e2e", "balance2", "pwa"],
    "Semantic version, CHANGELOG.md, GitHub Release with notes and a known-issues list.",
    ["Tag v0.1.0 and GitHub Release published"])
add("golive", "Production deploy to GitHub Pages and public play link", 7, ["deploy"], 2, ["release", "pages"],
    "Verify the live build equals the tag. Add the play link and screenshots to README.",
    ["Live URL plays the full flow on a phone", "README has Play link, screenshots and credits"])

# ---------------- M8
add("supa", "Supabase auth and cloud save", 8, ["backlog"], 12, ["golive"], "Accounts and cloud rank. Needs privacy review for minors.", ["Login and cloud save work", "Privacy notice published"])
add("teacher", "Teacher dashboard: class accuracy by topic", 8, ["backlog", "math"], 16, ["supa"], "Aggregate answer logs per class and topic.", ["Teacher sees weak topics per class"])
add("online", "Online multiplayer prototype", 8, ["backlog"], 60, ["golive"], "Authoritative server (Colyseus or similar). Large cost, only if the pilot justifies it.", ["Two players complete a match online"])
add("jungle", "Jungle camps and objectives (Turtle/Lord-style, original names)", 8, ["backlog", "gameplay"], 20, ["golive"], "Original neutral objectives with their own questions.", ["Objectives give team buffs and bonus questions"])
add("heroes", "More heroes and Year 7-12 content", 8, ["backlog", "gameplay", "math"], 40, ["golive"], "Four more original heroes, hero select, tiers 7-12 with their question banks. Only after the pilot.", ["Hero select works", "Tiers 7-12 pass the validator"])
add("mode3v3", "3v3 mode with three lanes", 8, ["backlog", "gameplay", "engine"], 14, ["heroes"], "Extend the map to three lanes.", ["3v3 match completes end to end"])
add("ip", "Naming, trademark and original art review", 8, ["backlog", "docs"], 6, ["golive"], "Confirm the name is not confusingly similar to existing games. Replace placeholders with original art.", ["Written check completed"])

keys = {d["key"]: n + 1 for n, d in enumerate(I)}
for n, d in enumerate(I):
    d["num"] = n + 1
    dep = ", ".join("#%d" % keys[k] for k in d["deps"]) or "none"
    d["body"] = "%s\n\n**Estimate:** %dh\n**Depends on:** %s\n\n**Acceptance criteria**\n%s\n\n**Definition of done:** merged via PR, CI green, docs updated if behaviour changed." % (
        d["desc"], d["hrs"], dep, "\n".join("- [ ] " + a for a in d["ac"]))

labels = sorted({l for d in I for l in d["labels"]})
data = {
    "labels": labels,
    "milestones": [{"title": t, "description": s} for t, s in MS],
    "issues": [{"title": "[%02d] %s" % (d["num"], d["title"]), "milestone": MS[d["ms"]][0], "labels": d["labels"], "body": d["body"]} for d in I],
}
json.dump(data, open(os.path.join(OUT, "issues.json"), "w"), indent=1, ensure_ascii=False)

lines = ["# Issue backlog (%d issues)\n" % len(I)]
tot = 0
for mi, (t, s) in enumerate(MS):
    items = [d for d in I if d["ms"] == mi]
    h = sum(d["hrs"] for d in items)
    if mi < 8: tot += h
    lines.append("\n## %s (%dh)\n_%s_\n" % (t, h, s))
    for d in items:
        dep = ", ".join("#%d" % keys[k] for k in d["deps"]) or "none"
        lines.append("### #%d %s\n`%s` | %dh | depends: %s\n\n%s\n\n%s\n" % (
            d["num"], d["title"], ", ".join(d["labels"]), d["hrs"], dep, d["desc"],
            "\n".join("- [ ] " + a for a in d["ac"])))
lines.append("\n---\nMVP total (M0-M7): **%dh**, about **%.0f weeks at 10h/week**.\n" % (tot, tot / 10))
open(os.path.join(OUT, "ISSUES.md"), "w").write("\n".join(lines))
print(len(I), "issues;", tot, "hours MVP;", round(tot / 10), "weeks at 10h/week")
