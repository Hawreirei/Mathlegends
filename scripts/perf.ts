/**
 * Performance check (#48): first load on a slow phone connection, and frame times in a busy
 * late-game fight on a slowed-down CPU. Needs Playwright's Chromium (a dev dependency since #47:
 * `npx playwright install chromium` once) and a production build being served:
 *
 *   npm run build && npx vite preview --port 4173
 *   node scripts/perf.ts                       # defaults below
 *   node scripts/perf.ts --url http://localhost:4173/Mathlegends/ --cpu 4 --seconds 20
 *
 * Prints JSON with the results; docs/PERF.md records the numbers and the budget.
 */
import { createRequire } from 'node:module';

interface Page {
  goto(url: string): Promise<unknown>;
  evaluate<T>(fn: (arg: never) => T | Promise<T>, arg?: unknown): Promise<T>;
  waitForFunction(fn: () => boolean, arg?: unknown, opts?: { timeout: number }): Promise<unknown>;
  addInitScript(script: string): Promise<void>;
  keyboard: { down(k: string): Promise<void>; up(k: string): Promise<void> };
  close(): Promise<void>;
  on(ev: 'pageerror', cb: (e: Error) => void): void;
}
interface Context {
  newPage(): Promise<Page>;
  newCDPSession(p: Page): Promise<{ send(m: string, p?: object): Promise<unknown> }>;
  close(): Promise<void>;
}
interface Browser {
  newContext(o: object): Promise<Context>;
  close(): Promise<void>;
}
const { chromium } = createRequire(import.meta.url)('playwright') as {
  chromium: { launch(o?: object): Promise<Browser> };
};

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : fallback;
};
const URL_ = arg('url', 'http://localhost:4173/Mathlegends/');
const CPU = Number(arg('cpu', '4'));
const SECONDS = Number(arg('seconds', '20'));

/** Network presets as Chrome DevTools defines them. */
const NETWORKS = {
  /** A weak connection (Lighthouse's mobile default): 150 ms round trip, 1.6 Mbit/s down. */
  slow4g: { latency: 150, down: 1.6, up: 0.75 },
  /** An ordinary 4G connection: 60 ms round trip, 9 Mbit/s down. */
  fast4g: { latency: 60, down: 9, up: 1.5 },
};
const conditions = (n: (typeof NETWORKS)[keyof typeof NETWORKS]) => ({
  offline: false,
  latency: n.latency,
  downloadThroughput: (n.down * 1024 * 1024) / 8,
  uploadThroughput: (n.up * 1024 * 1024) / 8,
});
const PHONE = {
  viewport: { width: 915, height: 412 },
  deviceScaleFactor: 2.6,
  isMobile: true,
  hasTouch: true,
};
const SAVE = JSON.stringify({
  app: 'mathlegends',
  version: 2,
  savedAt: 'perf',
  profile: { placed: true, tier: 3, stars: 0, lossesAtZero: 0, matchesPlayed: 1 },
  settings: { textScale: 1, colorBlind: false, extraTime: false, sound: false, music: false },
  review: [],
});

interface Win {
  mathlegends?: {
    game: {
      scene: {
        isActive(k: string): boolean;
        getScene(k: string): {
          scene: { start(k: string): void };
          state: Record<string, unknown> & {
            player: Record<string, unknown>;
            bot: Record<string, unknown>;
            structures: { id: string; alive: boolean; hp: number }[];
            minions: unknown[];
          };
        };
      };
      renderer: { type: number };
      loop: { actualFps: number; callback: (time: number, delta: number) => void };
    };
  };
  __frames?: number[];
  __steps?: number[];
}

/** Time until the Menu is on screen; `repeat` = a second visit with the files cached. */
async function firstLoad(browser: Browser, network: keyof typeof NETWORKS, repeat: boolean) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (repeat) await page.goto(URL_);
  else await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', conditions(NETWORKS[network]));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const t0 = Date.now();
  await page.goto(URL_);
  await page.waitForFunction(
    () => !!(globalThis as unknown as Win).mathlegends?.game.scene.isActive('Menu'),
    undefined,
    { timeout: 60_000 },
  );
  const menuMs = Date.now() - t0;
  const bytes = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .concat(performance.getEntriesByType('navigation'))
      .reduce((t, e) => t + ((e as PerformanceResourceTiming).transferSize || 0), 0),
  );
  await ctx.close();
  return { menuMs, transferKB: Math.round(bytes / 1024) };
}

async function fight(browser: Browser) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(`localStorage.setItem('mathlegends.save', ${JSON.stringify(SAVE)});`);
  const cdp = await ctx.newCDPSession(page);
  await page.goto(URL_);
  await page.waitForFunction(
    () => !!(globalThis as unknown as Win).mathlegends?.game.scene.isActive('Menu'),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.evaluate(() =>
    (globalThis as unknown as Win).mathlegends!.game.scene.getScene('Menu').scene.start('Match'),
  );
  await page.waitForFunction(
    () => !!(globalThis as unknown as Win).mathlegends?.game.scene.isActive('Match'),
  );
  // A busy late game: 4:45 in, so the next waves are grown; blue has broken red's towers, so its
  // waves bring super minions. Both heroes stand in the middle of the lane and fight.
  await page.evaluate(() => {
    const m = (globalThis as unknown as Win).mathlegends!.game.scene.getScene('Match');
    const s = m.state;
    m.state = {
      ...s,
      now: 285,
      player: { ...s.player, x: 2100, y: 700 },
      bot: { ...s.bot, x: 2300, y: 700 },
      structures: s.structures.map((x) =>
        x.id.startsWith('tower-red') ? { ...x, hp: 0, alive: false } : x,
      ),
    };
  });
  await page.keyboard.down(' ');
  // Waves spawn at 5:15 and meet in the middle about 25 s later: record from then on.
  await new Promise((r) => setTimeout(r, 38_000));
  // Two measures: the time between frames (limited by drawing, which on this machine is done in
  // software), and the CPU time of each game step: the rules, the scenes and preparing the draw
  // calls. On a phone the GPU draws; the CPU time is what decides 60 fps.
  await page.evaluate(() => {
    const w = globalThis as unknown as Win;
    const g = w.mathlegends!.game;
    w.__frames = [];
    w.__steps = [];
    const step = g.loop.callback;
    g.loop.callback = (time: number, delta: number) => {
      const t = performance.now();
      step(time, delta);
      w.__steps!.push(performance.now() - t);
    };
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames!.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  const out = await page.evaluate(() => {
    const w = globalThis as unknown as Win;
    const g = w.mathlegends!.game;
    const m = g.scene.getScene('Match');
    return {
      frames: w.__frames!.slice(1),
      steps: w.__steps!.slice(1),
      renderer: g.renderer.type === 2 ? 'WebGL' : 'Canvas',
      minions: m.state.minions.length,
    };
  });
  await page.keyboard.up(' ');
  await ctx.close();
  return {
    renderer: out.renderer,
    minionsOnMap: out.minions,
    /** CPU time per game step: must stay under 16.7 ms for 60 fps, 33.3 ms for 30 fps. */
    stepCpuMs: stats(out.steps),
    /** Time between frames on this machine (software drawing when there is no GPU). */
    frameMs: stats(out.frames),
    errors,
  };
}

function stats(xs: number[]) {
  const f = [...xs].sort((a, b) => a - b);
  const pct = (p: number) => +f[Math.min(f.length - 1, Math.floor(p * f.length))]!.toFixed(1);
  const avg = f.reduce((a, b) => a + b, 0) / f.length;
  return {
    n: f.length,
    avg: +avg.toFixed(1),
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    worst: +f[f.length - 1]!.toFixed(1),
    over16ms: f.filter((x) => x > 1000 / 60).length,
    over33ms: f.filter((x) => x > 1000 / 30).length,
  };
}

const browser = await chromium.launch();
try {
  const load = {
    slow4g: await firstLoad(browser, 'slow4g', false),
    fast4g: await firstLoad(browser, 'fast4g', false),
    slow4gReturnVisit: await firstLoad(browser, 'slow4g', true),
  };
  const fightResult = await fight(browser);
  console.log(JSON.stringify({ url: URL_, cpuSlowdown: CPU, load, fight: fightResult }, null, 2));
} finally {
  await browser.close();
}
