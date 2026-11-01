import Phaser from 'phaser';
import theme from './data/theme.json';
import { BootScene } from './scenes/BootScene';
import { MatchHudScene } from './scenes/MatchHudScene';
import { MatchScene } from './scenes/MatchScene';
import { MenuScene } from './scenes/MenuScene';
import { PlacementScene } from './scenes/PlacementScene';
import { ResultScene } from './scenes/ResultScene';
import { SettingsScene } from './scenes/SettingsScene';
import { createGameState, parseProfile } from './systems/gameState';
import { logicalSize } from './systems/layout';
import { loadFonts } from './ui/fonts';
import ranksJson from './data/ranks.json';
import { loadRanks } from './systems/data';
import { curriculumTopicTiers } from './systems/questionBank';
import { parseReviewQueue } from './systems/reviewQueue';
import { parseSettings } from './systems/settings';
import { applyAccessibility } from './ui/theme';
import {
  browserStorage,
  initialLang,
  loadProfileRaw,
  loadReviewRaw,
  loadSettingsRaw,
} from './utils/storage';

declare global {
  interface Window {
    /** Handle for automated tests (Playwright, #47). */
    mathlegends?: { game: Phaser.Game };
  }
}

// No browser zoom, scroll or long-press menu on the game (#18). The CSS in index.html does most of this;
// iOS Safari ignores user-scalable=no, so its pinch gesture and double-tap zoom are blocked here too.
for (const type of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu'])
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

void loadFonts().then(() => {
  const size = logicalSize(window.innerWidth, window.innerHeight);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: theme.colors.ink,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: size.width,
      height: size.height,
    },
    scene: [
      BootScene,
      MenuScene,
      PlacementScene,
      MatchScene,
      MatchHudScene,
      ResultScene,
      SettingsScene,
    ],
    // Use real frame time: Phaser's default smoothing treats slow frames as 60 fps,
    // which made heroes move at a fraction of their speed on slower devices (#17).
    fps: { smoothStep: false },
    // Joystick thumb + a button thumb at the same time (#18).
    input: { activePointers: 3 },
    callbacks: {
      preBoot: (g) => {
        // Saved choice, else browser language, else Indonesian (#23).
        const store = browserStorage();
        const lang = initialLang(store, navigator.language);
        document.documentElement.lang = lang;
        const ranks = loadRanks(ranksJson);
        // Missed questions from earlier matches (#29), checked like the bank.
        const review = parseReviewQueue(loadReviewRaw(store), ranks, curriculumTopicTiers());
        // Accessibility settings (#31) apply before any screen is drawn.
        const settings = parseSettings(loadSettingsRaw(store), theme.textScales);
        applyAccessibility(settings);
        // Year and stars (#38; versioned save with export/import in #41).
        const profile = parseProfile(loadProfileRaw(store), ranks.tiers.length, ranks.starsPerTier);
        g.registry.set('state', createGameState(lang, review, settings, profile));
      },
    },
  });

  // Rotation or window resize: switch between the portrait and landscape canvas.
  let pending = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      const next = logicalSize(window.innerWidth, window.innerHeight);
      if (next.width !== game.scale.gameSize.width || next.height !== game.scale.gameSize.height) {
        game.scale.setGameSize(next.width, next.height);
      }
    }, 150);
  });

  window.mathlegends = { game };
});
