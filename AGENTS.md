# AGENTS.md: rules for AI coding agents

Project: MathLegends, a 1-lane MOBA where last-hits trigger math questions. Read `PLAN.md` first.

## Rules
1. One issue = one branch (`feat/<issue-number>-<slug>`) = one PR. Reference the issue (`Closes #N`).
2. Game rules go in `src/systems/` as pure TypeScript with no Phaser imports. Write unit tests first.
3. All balance numbers live in `src/data/*.json`. Never hard-code costs, damage, timers or rewards.
4. Validate data (questions, heroes, items) at load and in CI.
5. Original assets only. Record the source and license of every asset in `docs/ASSETS.md`. Do not use names, heroes, art or audio from Mobile Legends or any other game.
6. No personal data. Logs are anonymous and stay on the device. There is no server in the MVP.
6a. Every player-facing string and every question exists in Indonesian and English. Strings come from `src/data/i18n/`, never inline.
7. Keep `npm run lint`, `npm test` and `npm run build` green.
8. The Vite `base` must stay `'/Mathlegends/'` (case-sensitive) so GitHub Pages works.
9. Do not add dependencies without a one-line reason in the PR.
10. When an acceptance criterion cannot be met, say so in the PR; do not silently skip it.

## Definition of done
Acceptance criteria ticked, tests added, docs updated, CI green, PR description lists what changed and how to verify.
