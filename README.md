# MathLegends

A single-player 1-lane MOBA where every last-hit on a minion asks a math question. Correct answers turn into more gold and EXP. Ranks run from Year 1 to Year 6 (Indonesian curriculum) and set both the question difficulty and the bot's strength. Plays in English or Indonesian. No server needed.

- Full plan: [PLAN.md](PLAN.md)
- Issue backlog (60 issues): [ISSUES.md](ISSUES.md)
- Rules for AI agents: [AGENTS.md](AGENTS.md)

## Quick start
```
npm ci
npm run dev        # local dev server
npm run lint       # ESLint
npm test           # Vitest
npm run build      # type-check and build to dist/
```

Requires Node 22 or newer.

## Deploy
Every push to `main` runs `.github/workflows/deploy.yml` and publishes to GitHub Pages.
One-time setup in GitHub: Settings > Pages > Source = **GitHub Actions**.

The site lives at `https://hawreirei.github.io/Mathlegends/`. The Vite `base` in `vite.config.ts` must stay `/Mathlegends/` (the path is case-sensitive).

Play link: https://hawreirei.github.io/Mathlegends/ (live after the first merge to `main` and the Pages setting above)

## Project layout
`src/{scenes,entities,systems,data,ui,utils}`, `tests/`, `docs/`, `scripts/`. Game rules live in `src/systems/` with no Phaser imports.
