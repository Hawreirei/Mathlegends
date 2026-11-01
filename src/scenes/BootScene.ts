import Phaser from 'phaser';
import { SPRITES, SPRITE_SIZES } from '../assets';
import { bodyFont, hex, theme } from '../ui/theme';
import { tr } from './shared';

/** Loads every sprite with a progress bar, then opens the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const { width, height } = this.scale;
    const barW = Math.min(480, width * 0.6);
    this.add
      .text(width / 2, height / 2 - 50, tr(this, 'boot.loading'), bodyFont(28))
      .setOrigin(0.5);
    this.add
      .rectangle(width / 2, height / 2, barW, 18, hex(theme.colors.night))
      .setStrokeStyle(2, hex(theme.colors.violet));
    const fill = this.add
      .rectangle(width / 2 - barW / 2, height / 2, 1, 14, hex(theme.colors.gold))
      .setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => fill.setSize(Math.max(1, (barW - 4) * p), 14));

    for (const [key, url] of Object.entries(SPRITES)) {
      const size = SPRITE_SIZES[key];
      this.load.svg(key, url, size ? { width: size.width, height: size.height } : undefined);
    }
  }

  create(): void {
    this.scene.start('Menu');
  }
}
