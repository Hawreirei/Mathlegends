/**
 * README screenshots (#53), taken from a production build being served:
 *
 *   npm run build && npx vite preview --port 4173
 *   node scripts/screenshots.ts                   # writes docs/screenshots/*.jpg
 *
 * Uses Playwright's Chromium. The fight is set up through window.mathlegends (late game, both
 * heroes in mid-lane) and takes about a minute.
 */
import { chromium, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const URL_ = process.argv[2] ?? 'http://localhost:4173/Mathlegends/';
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const SAVE = JSON.stringify({
  app: 'mathlegends',
  version: 2,
  savedAt: 'screenshots',
  profile: { tier: 3, stars: 2, lossesAtZero: 0, matchesPlayed: 6 },
  settings: {
    textScale: 1,
    colorBlind: false,
    extraTime: false,
    sound: false,
    music: false,
    reduceMotion: true,
  },
  review: [],
});

type Scene = {
  scene: { start(k: string): void };
  state: Record<string, unknown>;
  show(e: unknown): void;
  answerSlot(slot: number): void;
  session: { active: { order: number[]; question: { answerIndex: number } } | null };
};
type W = {
  mathlegends: { game: { scene: { isActive(k: string): boolean; getScene(k: string): Scene } } };
};

const sceneIs = (page: Page, key: string) =>
  page.waitForFunction((k) => !!(window as never as W).mathlegends?.game.scene.isActive(k), key, {
    timeout: 60_000,
  });

async function open(lang: string, viewport: { width: number; height: number }, touch: boolean) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 2,
    isMobile: touch,
    hasTouch: touch,
  });
  await page.addInitScript(
    ([l, s]) => {
      localStorage.setItem('mathlegends.lang', l!);
      localStorage.setItem('mathlegends.save', s!);
    },
    [lang, SAVE],
  );
  await page.goto(URL_);
  await sceneIs(page, 'Menu');
  await page.waitForTimeout(500);
  return page;
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 86 });

const browser = await chromium.launch();
try {
  // Menu on a phone held upright (Indonesian) and on a laptop (English).
  let page = await open('id', { width: 390, height: 844 }, true);
  await shot(page, 'menu-phone');
  await page.close();
  page = await open('en', { width: 1280, height: 720 }, false);
  await shot(page, 'menu-desktop');
  await page.close();

  // A late-game fight on a phone held sideways, with a question on screen.
  page = await open('en', { width: 844, height: 390 }, true);
  await page.evaluate(() =>
    (window as never as W).mathlegends.game.scene.getScene('Menu').scene.start('Match'),
  );
  await sceneIs(page, 'MatchHud');
  await page.evaluate(() => {
    const m = (window as never as W).mathlegends.game.scene.getScene('Match');
    const s = m.state as { player: object; bot: object };
    m.state = {
      ...s,
      now: 285,
      player: { ...s.player, x: 2050, y: 700 },
      bot: { ...s.bot, x: 2350, y: 700 },
    };
  });
  await page.waitForTimeout(37_000);
  await page.evaluate(() =>
    (window as never as W).mathlegends.game.scene.getScene('Match').show({
      type: 'lastHit',
      kind: 'lancer',
      minionId: 'x',
      gold: 24,
      exp: 40,
      at: { x: 2100, y: 700 },
    }),
  );
  await page.waitForTimeout(700);
  await shot(page, 'match-phone');

  // Answer it correctly, so the Result screen shows a real count.
  await page.evaluate(() => {
    const m = (window as never as W).mathlegends.game.scene.getScene('Match');
    const a = m.session.active!;
    m.answerSlot(a.order.indexOf(a.question.answerIndex));
  });
  await page.waitForTimeout(1200);

  // The Result screen after a win.
  await page.evaluate(() => {
    const m = (window as never as W).mathlegends.game.scene.getScene('Match');
    const s = m.state as {
      structures: { team: string; kind: string; alive: boolean; hp: number }[];
    };
    m.state = {
      ...s,
      structures: s.structures.map((x) => (x.team === 'red' ? { ...x, hp: 0, alive: false } : x)),
    };
  });
  await sceneIs(page, 'Result');
  await page.waitForTimeout(2500);
  await shot(page, 'result-phone');
  await page.close();
} finally {
  await browser.close();
}
console.log(`Screenshots written to ${OUT}`);
