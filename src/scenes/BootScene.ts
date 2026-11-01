import Phaser from 'phaser';

/** Hello-world scene used to prove the build and Pages deploy work. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2 - 20, 'MathLegends', {
        fontFamily: 'sans-serif',
        fontSize: '72px',
        color: '#fca311',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 50, 'Hello, world! 2 + 2 = 4', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }
}
