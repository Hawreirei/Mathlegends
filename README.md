# MathLegends

A single-player 1-lane MOBA where every last-hit on a minion asks a math question. Correct answers turn into more gold and EXP. Ranks run from Year 1 to Year 6 (Indonesian curriculum) and set both the question difficulty and the bot's strength. Plays in English or Indonesian. No server needed.

- Full plan: [PLAN.md](PLAN.md)
- Issue backlog (60 issues): [ISSUES.md](ISSUES.md)
- Rules for AI agents: [AGENTS.md](AGENTS.md)

## Quick start (after M0 scaffold exists)
```
npm ci
npm run dev
```

## Bootstrap the repo
```
git init && git add . && git commit -m "chore: starter kit"
git branch -M main
git remote add origin https://github.com/hawreirei/mathlegends.git
git push -u origin main
bash scripts/create_issues.sh hawreirei/mathlegends
```
Then in GitHub: Settings > Pages > Source = GitHub Actions.

Play link: _added at the `golive` issue_
