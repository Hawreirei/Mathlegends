# Testing (issues #46, #47)

Every check below runs in CI on each pull request (`.github/workflows/ci.yml`), in this order.

| Command | What it checks |
|---|---|
| `npm run lint` | ESLint, including the "no inline player-facing text" rule (AGENTS.md 6a) |
| `npm run validate:questions` | Every question in the bank, both languages |
| `npm run test:coverage` | All unit tests (Vitest), plus the **coverage gate** below |
| `npm run build` | Type check and production build |
| `npm run check:bundle` | Download size budget (docs/PERF.md) |
| `npm run e2e` | The **smoke test** below, in a real browser |

## Unit tests and the coverage gate (#46)

`tests/*.test.ts` test the game rules in `src/systems/` (pure TypeScript, no Phaser): economy, rank, question engine, items, skills, minions, towers, the bot, saving, the balance simulator and more. `npm test` runs them; `npm run test:coverage` runs them and measures how much of `src/systems/` they exercise.

**Gate:** CI fails if statements, branches, functions or lines of `src/systems/` drop below **80%** (`vite.config.ts`, `test.coverage.thresholds`). The report lists the uncovered lines of each file.

Coverage on 2026-11-07: **98% of statements, 95% of branches, 99% of functions, 99% of lines**. Most of it came from writing tests first with each feature (AGENTS.md rule 2). #46 added tests for the few gaps: the sounds, shake and damage numbers of skills, a capped top Year, and malformed saved profiles.

## Smoke test (#47)

[`e2e/smoke.spec.ts`](../e2e/smoke.spec.ts), run by Playwright ([`playwright.config.ts`](../playwright.config.ts)) against the production build:

1. **Boot:** the Menu shows Play in the chosen language.
2. **Play** (a real click or tap) starts a match straight away.
3. **Last hit:** a red Infantry with 1 HP is placed next to the hero in mid-lane; the hero attacks (Space, or a tap on the touch attack button).
4. **Answer:** the question appears; the test answers it correctly (the number key, or a tap on the answer) and checks it counted.
5. **Finish:** red's towers are down and its Nexus at 1 HP; the hero attacks it.
6. **Result:** the Victory screen in the chosen language, the match saved (1 match played, at least 1 star), and no errors in the page.

`e2e/offline.spec.ts` checks offline play and installability (docs/OFFLINE.md).

The smoke test runs 4 times: **desktop** (1280 x 720, mouse and keyboard) and **phone** (390 x 844, touch), each in **Indonesian** and **English**. About 25 s in all. The test sets up steps 3 and 5 through the `window.mathlegends` handle so it does not wait minutes for waves; all input is real.

To run it locally:

```bash
npm run build
```

```bash
npx playwright install chromium
```

```bash
npm run e2e
```

The first command is needed after every change; the second only once per machine. The test starts `vite preview` itself.

## Other tools

- `npm run sim`: the balance simulator (docs/BALANCE.md).
- `npm run perf`: load time and CPU per frame (docs/PERF.md).
