import Phaser from 'phaser';
import theme from '../data/theme.json';
import { SPRITES, SPRITE_SIZES } from '../assets';

const hex = (c: string) => Number.parseInt(c.slice(1), 16);

/**
 * Loads the placeholder sprites and shows them as a gallery (#14), so the live
 * GitHub Pages build proves the art, fonts and base path all work.
 * Replaced by the real Boot/Menu flow in #15.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const [key, url] of Object.entries(SPRITES)) {
      const size = SPRITE_SIZES[key];
      this.load.svg(key, url, size ? { width: size.width, height: size.height } : undefined);
    }
  }

  create(): void {
    const { width } = this.scale;
    const c = theme.colors;
    this.add
      .text(width / 2, 70, 'MATH', {
        fontFamily: theme.fonts.display,
        fontStyle: '700',
        fontSize: '64px',
        color: c.white,
      })
      .setOrigin(1, 0.5);
    this.add
      .text(width / 2, 70, 'LEGENDS', {
        fontFamily: theme.fonts.display,
        fontStyle: '700',
        fontSize: '64px',
        color: c.gold,
      })
      .setOrigin(0, 0.5);

    // Lane strip made of tiles.
    for (let x = 0; x < width; x += 64) {
      this.add.image(x + 32, 200, 'tile-grass');
      this.add.image(x + 32, 264, 'tile-lane');
      this.add.image(x + 32, 328, 'tile-water');
    }

    const row = (y: number, keys: string[]) => {
      const gap = width / (keys.length + 1);
      keys.forEach((k, i) => this.add.image(gap * (i + 1), y, k));
    };
    row(260, [
      'nexus-blue',
      'tower-blue',
      'hero-nova',
      'minion-infantry-blue',
      'minion-lancer-blue',
      'minion-cannon-blue',
    ]);
    row(470, [
      'minion-cannon-red',
      'minion-lancer-red',
      'minion-infantry-red',
      'hero-mira',
      'tower-red',
      'nexus-red',
    ]);
    row(
      630,
      [1, 2, 3, 4, 5, 6].map((n) => `badge-year-${n}`),
    );

    this.cameras.main.setBackgroundColor(hex(c.ink));
  }
}
