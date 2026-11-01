/**
 * Balance simulator (#37): runs many headless matches and writes one CSV row per match, plus a
 * summary table.
 *
 *   npm run sim                      # 200 matches per scenario, CSV to balance-sim.csv
 *   npm run sim -- --matches 1000 --out results.csv --seconds 1200
 *
 * Scenarios:
 *   mirror-30 / -50 / -60 / -90  equal combat skill (both play like the Year 3 bot); the player
 *                                answers 30 / 50 / 60 / 90% of questions right (50% = the bot's
 *                                economy, so it is the true mirror match)
 *   new-vs-y1 ... new-vs-y6      the simulator's "new player" (bot.json newPlayer, 60% right)
 *                                against each Year's bot
 *
 * The game code is loaded through Vite (already a dependency), so it runs the real TypeScript.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : fallback;
};
const matches = Number(arg('matches', '200'));
const seconds = Number(arg('seconds', '1200'));
const out = arg('out', 'balance-sim.csv');

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
try {
  const sim = await server.ssrLoadModule('/src/systems/balanceSim.ts');
  const data = await server.ssrLoadModule('/src/systems/data.ts');
  const botJson = (await server.ssrLoadModule('/src/data/bot.json')).default;
  const file = data.loadBotFile(botJson);
  const mirror = sim.gameConfig(3);
  const scenarios = [
    ...[0.3, 0.5, 0.6, 0.9].map((a) => ({
      name: `mirror-${Math.round(a * 100)}`,
      cfg: mirror,
      player: mirror.bot,
      accuracy: a,
    })),
    ...[1, 2, 3, 4, 5, 6].map((t) => ({
      name: `new-vs-y${t}`,
      cfg: sim.gameConfig(t),
      player: data.newPlayerBot(file),
      accuracy: 0.6,
    })),
  ];
  const lines = [sim.CSV_COLUMNS.join(',')];
  const table: string[] = [];
  const started = Date.now();
  for (const sc of scenarios) {
    const rows = Array.from({ length: matches }, (_, i) => sim.runMatch(sc, i + 1, seconds));
    lines.push(...sim.toCsvRows(sc.name, rows));
    const a = sim.aggregate(sc.name, sc.accuracy, rows);
    table.push(
      [
        sc.name.padEnd(12),
        `win ${(a.winRate * 100).toFixed(1)}%`.padEnd(11),
        `nexus ${a.nexusEndings}/${a.matches}`.padEnd(14),
        `avg ${Math.floor(a.avgSeconds / 60)}:${String(Math.round(a.avgSeconds % 60)).padStart(2, '0')}`.padEnd(
          10,
        ),
        `gold lead ${Math.round(a.avgGoldLead)}`.padEnd(16),
        `math share ${(a.avgMathShare * 100).toFixed(1)}%`,
      ].join(' '),
    );
    console.log(table.at(-1));
  }
  writeFileSync(out, lines.join('\n') + '\n');
  console.log(
    `\n${scenarios.length * matches} matches in ${((Date.now() - started) / 1000).toFixed(0)} s -> ${out}`,
  );
} finally {
  await server.close();
}
