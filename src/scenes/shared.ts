import Phaser from 'phaser';
import type { GameState } from '../systems/gameState';
import { t, type StringKey } from '../utils/i18n';

const KEY = 'state';

export const getState = (scene: Phaser.Scene): GameState => scene.registry.get(KEY) as GameState;
export const setState = (scene: Phaser.Scene, s: GameState): void => {
  scene.registry.set(KEY, s);
};

/** Translated string in the current language. */
export const tr = (scene: Phaser.Scene, key: StringKey, vars?: Record<string, string | number>) =>
  t(getState(scene).lang, key, vars);

/**
 * Builds a scene's layout now and again whenever the canvas size changes (rotation, window resize).
 * `build` must draw everything from this.scale.width/height; the old objects are destroyed first.
 */
export function responsive(scene: Phaser.Scene, build: () => void): void {
  const rebuild = () => {
    scene.children.removeAll(true);
    build();
  };
  rebuild();
  scene.scale.on('resize', rebuild);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', rebuild));
}
