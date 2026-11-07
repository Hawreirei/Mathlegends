/**
 * Offline play and installability (#51): after one online visit the game starts and plays with
 * no network, and Chrome finds nothing missing for installing it. Lighthouse 12 dropped its PWA
 * category; Chrome's own installability check (the one Lighthouse used) is asserted instead.
 */
import { expect, test } from '@playwright/test';

test('installable, and plays in airplane mode after the first visit', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'desktop', 'one browser is enough for the service worker');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('mathlegends.lang', 'en'));

  // First visit, online: the service worker installs and stores the game.
  await page.goto('./');
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active && reg.active.state === 'activated';
  });
  await page
    .waitForFunction(() => !!navigator.serviceWorker.controller, undefined, {
      timeout: 15_000,
    })
    .catch(() => page.reload());

  // Chrome's install check: manifest, icons, service worker, start URL in scope.
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);

  // Airplane mode: reload, the Menu appears, and a match starts.
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(
    () =>
      !!(
        window as never as { mathlegends?: { game: { scene: { isActive(k: string): boolean } } } }
      ).mathlegends?.game.scene.isActive('Menu'),
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(() =>
    (
      window as never as {
        mathlegends: {
          game: { scene: { getScene(k: string): { scene: { start(k: string): void } } } };
        };
      }
    ).mathlegends.game.scene
      .getScene('Menu')
      .scene.start('Match'),
  );
  await page.waitForFunction(
    () =>
      !!(
        window as never as { mathlegends: { game: { scene: { isActive(k: string): boolean } } } }
      ).mathlegends.game.scene.isActive('MatchHud'),
    undefined,
    { timeout: 20_000 },
  );
  // Sprites came from the stored copy: the hero has a real texture, not Phaser's "missing" one.
  const missing = await page.evaluate(
    () =>
      !(
        window as never as { mathlegends: { game: { textures: { exists(k: string): boolean } } } }
      ).mathlegends.game.textures.exists('hero-nova'),
  );
  expect(missing).toBe(false);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
