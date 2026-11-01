import Phaser from 'phaser';
import { setLang, type GameState, type Lang } from '../systems/gameState';
import { t, type StringKey } from '../utils/i18n';
import { browserStorage, saveLang } from '../utils/storage';

/** Fired on game.events after the language changes; every responsive scene rebuilds. */
export const LANG_EVENT = 'ml-lang';

const KEY = 'state';

export const getState = (scene: Phaser.Scene): GameState => scene.registry.get(KEY) as GameState;
export const setState = (scene: Phaser.Scene, s: GameState): void => {
  scene.registry.set(KEY, s);
};

/** Translated string in the current language. */
export const tr = (scene: Phaser.Scene, key: StringKey, vars?: Record<string, string | number>) =>
  t(getState(scene).lang, key, vars);

/** Switches language for the whole game, saves the choice and redraws every visible screen (#23). */
export function changeLang(scene: Phaser.Scene, lang: Lang): void {
  setState(scene, setLang(getState(scene), lang));
  saveLang(browserStorage(), lang);
  document.documentElement.lang = lang;
  scene.game.events.emit(LANG_EVENT, lang);
}

/**
 * Builds a scene's layout now and again whenever the canvas size changes (rotation, window resize)
 * or the language changes.
 * `build` must draw everything from this.scale.width/height; the old objects are destroyed first.
 */
export function responsive(scene: Phaser.Scene, build: () => void): void {
  const rebuild = () => {
    scene.children.removeAll(true);
    build();
  };
  rebuild();
  scene.scale.on('resize', rebuild);
  scene.game.events.on(LANG_EVENT, rebuild);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off('resize', rebuild);
    scene.game.events.off(LANG_EVENT, rebuild);
  });
}
