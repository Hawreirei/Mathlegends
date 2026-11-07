/**
 * Smoke test (#47): boot, start a match, last-hit a minion, answer its question, and finish a
 * short match, on desktop and phone, in Indonesian and English. Input is real (clicks, taps,
 * keys); the test only sets the scene up quickly (a weak minion next to the hero, a weak enemy
 * Nexus) through the `window.mathlegends` handle, so it does not wait for whole minutes of play.
 */
import { expect, test, type Page } from '@playwright/test';
import en from '../src/data/i18n/en.json' with { type: 'json' };
import id from '../src/data/i18n/id.json' with { type: 'json' };

type Lang = 'id' | 'en';
const STRINGS = { id, en } as const;

async function waitForScene(page: Page, key: string) {
  await page.waitForFunction(
    (k) =>
      !!(
        window as unknown as { mathlegends?: { game: { scene: { isActive(k: string): boolean } } } }
      ).mathlegends?.game.scene.isActive(k),
    key,
    { timeout: 30_000 },
  );
}

/** Page position of a point in game coordinates (the canvas is scaled to fit the window). */
async function toPage(page: Page, x: number, y: number) {
  return page.evaluate(
    ([gx, gy]) => {
      const g = (
        window as unknown as {
          mathlegends: {
            game: { canvas: HTMLCanvasElement; scale: { width: number; height: number } };
          };
        }
      ).mathlegends.game;
      const r = g.canvas.getBoundingClientRect();
      return {
        x: r.left + (gx! * r.width) / g.scale.width,
        y: r.top + (gy! * r.height) / g.scale.height,
      };
    },
    [x, y],
  );
}

/** Clicks or taps at a game position, the way the project's player would. */
async function press(page: Page, x: number, y: number, touch: boolean) {
  const p = await toPage(page, x, y);
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

/** Game position of the first text in `scene` that starts with `label` (buttons are containers). */
async function findText(page: Page, scene: string, label: string) {
  return page.evaluate(
    ([sc, text]) => {
      type Obj = {
        type: string;
        text?: string;
        x: number;
        y: number;
        list?: Obj[];
        parentContainer?: Obj;
      };
      const g = (
        window as unknown as {
          mathlegends: { game: { scene: { getScene(k: string): { children: { list: Obj[] } } } } };
        }
      ).mathlegends.game;
      const walk = (o: Obj, ox: number, oy: number): { x: number; y: number } | null => {
        if (o.type === 'Text' && o.text?.startsWith(text!)) return { x: ox + o.x, y: oy + o.y };
        for (const c of o.list ?? []) {
          const hit = walk(c, ox + (o.list ? o.x : 0), oy + (o.list ? o.y : 0));
          if (hit) return hit;
        }
        return null;
      };
      for (const o of g.scene.getScene(sc!).children.list) {
        const hit = walk(o, 0, 0);
        if (hit) return hit;
      }
      return null;
    },
    [scene, label],
  );
}

/** True once the active question of the match exists. */
const questionShown = (page: Page) =>
  page.evaluate(
    () =>
      !!(
        window as never as {
          mathlegends: {
            game: { scene: { getScene(k: string): { session: { active: unknown } } } };
          };
        }
      ).mathlegends.game.scene.getScene('Match').session.active,
  );

const sceneActive = (page: Page, key: string) =>
  page.evaluate(
    (k) =>
      !!(
        window as never as {
          mathlegends: { game: { scene: { isActive(k: string): boolean } } };
        }
      ).mathlegends.game.scene.isActive(k),
    key,
  );

/**
 * Attacks like a player: taps the attack button (phone) or presses Space (desktop), again every
 * 300 ms, until `done` (an attack waiting for the hero's cooldown would otherwise expire).
 */
async function attackUntil(page: Page, touch: boolean, done: () => Promise<boolean>) {
  const atk = touch
    ? await page.evaluate(() => {
        const h = (
          window as never as {
            mathlegends: {
              game: {
                scene: {
                  getScene(k: string): {
                    layoutInfo: { touch: { attack: { x: number; y: number } } };
                  };
                };
              };
            };
          }
        ).mathlegends.game.scene.getScene('MatchHud');
        return h.layoutInfo.touch.attack;
      })
    : null;
  for (let i = 0; i < 40; i++) {
    if (await done()) return;
    if (atk) await press(page, atk.x, atk.y, true);
    else await page.keyboard.press('Space');
    await page.waitForTimeout(300);
  }
  expect(await done(), 'the attack did not land within 12 s').toBe(true);
}

for (const lang of ['id', 'en'] as const satisfies readonly Lang[]) {
  test(`plays a short match in ${lang === 'id' ? 'Indonesian' : 'English'}`, async ({
    page,
  }, info) => {
    const touch = info.project.name === 'phone';
    const t = STRINGS[lang];
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // A new player in this language, sound off so the run is quiet.
    await page.addInitScript((l) => {
      localStorage.setItem('mathlegends.lang', l);
      localStorage.setItem(
        'mathlegends.save',
        JSON.stringify({
          app: 'mathlegends',
          version: 2,
          savedAt: 'e2e',
          profile: { tier: 1, stars: 0, lossesAtZero: 0, matchesPlayed: 0 },
          settings: {
            textScale: 1,
            colorBlind: false,
            extraTime: false,
            sound: false,
            music: false,
            reduceMotion: true,
          },
          review: [],
        }),
      );
    }, lang);

    // 1. Boot: the Menu shows Play in the chosen language.
    await page.goto('./');
    await waitForScene(page, 'Menu');
    const play = await findText(page, 'Menu', t['menu.play']);
    expect(play, `Play button "${t['menu.play']}"`).not.toBeNull();

    // 2. Play starts a match straight away (no placement quiz, everyone starts in Year 1).
    await press(page, play!.x, play!.y, touch);
    await waitForScene(page, 'Match');
    await waitForScene(page, 'MatchHud');

    // 3. A last hit: the first wave arrives and one red Infantry, almost dead, stands next to the hero.
    await page.evaluate(() => {
      const m = (
        window as never as {
          mathlegends: { game: { scene: { getScene(k: string): { state: { now: number } } } } };
        }
      ).mathlegends.game.scene.getScene('Match');
      m.state = { ...m.state, now: 14.9 };
    });
    await page.waitForFunction(() => {
      const m = (
        window as never as {
          mathlegends: {
            game: { scene: { getScene(k: string): { state: { minions: unknown[] } } } };
          };
        }
      ).mathlegends.game.scene.getScene('Match');
      return m.state.minions.length > 0;
    });
    await page.evaluate(() => {
      type M = { id: string; team: string; kind: string; hp: number; x: number; y: number };
      const m = (
        window as never as {
          mathlegends: {
            game: {
              scene: {
                getScene(k: string): { state: { minions: M[]; player: { x: number; y: number } } };
              };
            };
          };
        }
      ).mathlegends.game.scene.getScene('Match');
      const s = m.state;
      const target = s.minions.find((x) => x.team === 'red' && x.kind === 'infantry')!;
      // Mid-lane, far from both waves and all towers, so only the hero can land the hit.
      const at = { x: 2200, y: 700 };
      m.state = {
        ...s,
        player: { ...s.player, ...at },
        minions: s.minions.map((x) =>
          x.id === target.id ? { ...x, hp: 1, x: at.x + 60, y: at.y } : x,
        ),
      };
    });
    await attackUntil(page, touch, () => questionShown(page));

    // 4. The question appears; answer it correctly (a tap on the right answer, or its key).
    const answer = await page.evaluate(() => {
      type Obj = { type: string; x: number; y: number; width: number; height: number };
      const g = (
        window as never as {
          mathlegends: {
            game: {
              scene: {
                getScene(k: string): {
                  session: {
                    active: { order: number[]; question: { answerIndex: number }; shownAt: number };
                  };
                  state: { now: number };
                  question: { root: { list: Obj[] } };
                };
              };
            };
          };
        }
      ).mathlegends.game;
      const a = g.scene.getScene('Match').session.active;
      const slot = a.order.indexOf(a.question.answerIndex);
      const zones = g.scene
        .getScene('MatchHud')
        .question.root.list.filter((o) => o.type === 'Zone');
      const z = zones[slot]!;
      return { slot, x: z.x, y: z.y };
    });
    // The card appears a moment after the last hit; wait for its answers to be live.
    await page.waitForTimeout(400);
    if (touch) await press(page, answer.x, answer.y, true);
    else await page.keyboard.press(String(answer.slot + 1));
    await page.waitForFunction(() => {
      const m = (
        window as never as {
          mathlegends: {
            game: { scene: { getScene(k: string): { session: { correct: number } } } };
          };
        }
      ).mathlegends.game.scene.getScene('Match');
      return m.session.correct === 1;
    });

    // 5. Finish: red's towers are down and its Nexus nearly so; the hero stands by it and hits it.
    await page.evaluate(() => {
      type St = {
        id: string;
        team: string;
        kind: string;
        hp: number;
        alive: boolean;
        x: number;
        y: number;
      };
      const m = (
        window as never as {
          mathlegends: {
            game: {
              scene: {
                getScene(k: string): {
                  state: {
                    structures: St[];
                    player: { x: number; y: number };
                    bot: { x: number; y: number };
                  };
                };
              };
            };
          };
        }
      ).mathlegends.game.scene.getScene('Match');
      const s = m.state;
      const nexus = s.structures.find((x) => x.team === 'red' && x.kind === 'nexus')!;
      m.state = {
        ...s,
        player: { ...s.player, x: nexus.x - 100, y: nexus.y },
        // The bot waits mid-lane, so the hero's nearest target is the Nexus.
        bot: { ...s.bot, x: 1500, y: nexus.y },
        structures: s.structures.map((x) =>
          x.team !== 'red'
            ? x
            : x.kind === 'tower'
              ? { ...x, hp: 0, alive: false }
              : { ...x, hp: 1 },
        ),
      };
    });
    await attackUntil(page, touch, () => sceneActive(page, 'Result'));

    // 6. The Result screen says Victory in this language, and the match is saved.
    await waitForScene(page, 'Result');
    expect(await findText(page, 'Result', t['result.victory'])).not.toBeNull();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mathlegends.save')!));
    expect(saved.profile).toMatchObject({ matchesPlayed: 1, tier: 1 });
    expect(saved.profile.stars).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
