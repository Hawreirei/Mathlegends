import Phaser from 'phaser';
import theme from './data/theme.json';
import { BootScene } from './scenes/BootScene';
import { MatchScene } from './scenes/MatchScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';
import { createGameState } from './systems/gameState';
import { logicalSize } from './systems/layout';
import { loadFonts } from './ui/fonts';
import { detectLang } from './utils/i18n';

declare global {
  interface Window {
    /** Handle for automated tests (Playwright, #47). */
    mathlegends?: { game: Phaser.Game };
  }
}

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
    scene: [BootScene, MenuScene, MatchScene, ResultScene],
    callbacks: {
      preBoot: (g) => g.registry.set('state', createGameState(detectLang(navigator.language))),
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
