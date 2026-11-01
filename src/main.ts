import Phaser from 'phaser';
import theme from './data/theme.json';
import { BootScene } from './scenes/BootScene';
import { loadFonts } from './ui/fonts';

void loadFonts().then(() => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: theme.colors.ink,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    scene: [BootScene],
  });
});
