/**
 * Screen changes and the Back button (#44).
 *
 * - goTo(): a short fade out, then the next scene (which fades in with enter()).
 * - Back: the phone/browser Back button and Esc both call routeBack(). The active scene says
 *   which screen it shows (backScreen) and handles the action from src/systems/navigation.ts.
 *   While the player is anywhere but the Menu, one extra browser history entry is kept, so
 *   Back stays inside the game; on the Menu, Back leaves the page as usual.
 */
import Phaser from 'phaser';
import { backAction, type BackAction, type Screen } from '../systems/navigation';

/** A scene that can answer the Back button. */
export interface BackAware {
  backScreen(): Screen;
  applyBack(a: BackAction): void;
}

const FADE_MS = 160;

/** Fades this scene out and starts `key` (once, even if tapped twice). */
export function goTo(scene: Phaser.Scene, key: string, stop: string[] = []): void {
  const cam = scene.cameras.main;
  if ((scene as unknown as { leaving?: boolean }).leaving) return;
  (scene as unknown as { leaving?: boolean }).leaving = true;
  scene.input.enabled = false;
  cam.fadeOut(FADE_MS, 20, 24, 62);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    for (const s of stop) scene.scene.stop(s);
    scene.scene.start(key);
  });
}

/** Call in create(): fade in, and keep the browser history in step with the screen. */
export function enter(scene: Phaser.Scene, isMenu = false): void {
  (scene as unknown as { leaving?: boolean }).leaving = false;
  scene.input.enabled = true;
  scene.cameras.main.fadeIn(FADE_MS, 20, 24, 62);
  syncHistory(!isMenu);
}

const inGame = () => (history.state as { ml?: boolean } | null)?.ml === true;

/** Away from the Menu: one history entry to catch Back. On the Menu: none needed. */
export function syncHistory(awayFromMenu: boolean): void {
  try {
    if (awayFromMenu && !inGame()) history.pushState({ ml: true }, '');
  } catch {
    // History blocked (sandboxed frame): Back simply leaves, as before.
  }
}

/** The scene that answers Back: the HUD over the match first, then any other active scene. */
function backScene(game: Phaser.Game): (Phaser.Scene & BackAware) | null {
  const active = game.scene.getScenes(true) as (Phaser.Scene & Partial<BackAware>)[];
  const hud = active.find((s) => s.scene.key === 'MatchHud');
  const s = (hud ?? active.find((x) => typeof x.backScreen === 'function')) as
    (Phaser.Scene & BackAware) | undefined;
  return s && typeof s.backScreen === 'function' ? s : null;
}

/** Does what Back means on the current screen. Returns false when the game should be left. */
export function routeBack(game: Phaser.Game): boolean {
  const s = backScene(game);
  if (!s) return false;
  const a = backAction(s.backScreen());
  if (a.kind === 'leave') return false;
  s.applyBack(a);
  return true;
}

/** Hooks the browser Back button and Esc to routeBack (#44). Call once at start. */
export function installBackHandling(game: Phaser.Game): void {
  window.addEventListener('popstate', () => {
    // The extra entry was used up. Stay in the game unless we are on the Menu...
    if (routeBack(game)) syncHistory(true);
    // ...where Back leaves: the entry may still be there from before a button led back to the
    // Menu, so step past it too.
    else history.back();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') routeBack(game);
  });
}
