import Phaser from 'phaser';
import { setLang, setSettings, type GameState, type Lang } from '../systems/gameState';
import { serializeSettings, type Settings } from '../systems/settings';
import { applyAccessibility } from '../ui/theme';
import { t, type StringKey } from '../utils/i18n';
import { browserStorage, saveLang, saveSettingsRaw } from '../utils/storage';

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

/** Fired on game.events after the accessibility settings change (#31); responsive scenes rebuild. */
export const SETTINGS_EVENT = 'ml-settings';

/** Applies and saves new accessibility settings and redraws every visible screen (#31). */
export function changeSettings(scene: Phaser.Scene, settings: Settings): void {
  setState(scene, setSettings(getState(scene), settings));
  saveSettingsRaw(browserStorage(), serializeSettings(settings));
  applyAccessibility(settings);
  scene.game.events.emit(SETTINGS_EVENT, settings);
}

/**
 * Builds a scene's layout now and again whenever the canvas size changes (rotation, window resize)
 * or the language or settings change.
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
  scene.game.events.on(SETTINGS_EVENT, rebuild);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off('resize', rebuild);
    scene.game.events.off(LANG_EVENT, rebuild);
    scene.game.events.off(SETTINGS_EVENT, rebuild);
  });
}
