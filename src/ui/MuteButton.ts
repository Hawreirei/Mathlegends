import Phaser from 'phaser';
import type { Rect } from '../systems/hudLayout';
import { hex, theme } from './theme';

/**
 * Mute button in the match HUD (#45): a speaker with sound waves, or with a cross when muted.
 * Drawn, not an emoji, so it looks the same on every device. Muting turns off sound effects and
 * music together; Settings has a switch for each.
 */
export class MuteButton extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private muted: boolean;

  constructor(scene: Phaser.Scene, r: Rect, muted: boolean, onToggle: () => void) {
    super(scene, r.x + r.w / 2, r.y + r.h / 2);
    this.g = scene.add.graphics();
    this.add(this.g);
    this.muted = muted;
    this.setSize(r.w, r.h).setInteractive({ useHandCursor: true });
    this.on('pointerup', onToggle);
    scene.add.existing(this);
    this.draw(r.w);
  }

  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    this.draw(this.width);
  }

  private draw(size: number): void {
    const g = this.g;
    const c = theme.colors;
    const s = size / 2;
    g.clear();
    g.fillStyle(hex(c.ink), 1).fillRoundedRect(-s, -s + 4, size, size, 16);
    g.fillStyle(hex(c.night), 1).fillRoundedRect(-s, -s, size, size, 16);
    g.lineStyle(3, hex(c.violet), 1).strokeRoundedRect(-s, -s, size, size, 16);
    // Speaker: a box and a cone.
    g.fillStyle(hex(c.white), 1);
    g.fillRect(-15, -6, 8, 12);
    g.fillTriangle(-9, 0, 2, -13, 2, 13);
    g.fillRect(-9, -6, 11, 12);
    if (this.muted) {
      g.lineStyle(4, hex(c.wrong), 1);
      g.lineBetween(7, -7, 17, 7);
      g.lineBetween(17, -7, 7, 7);
    } else {
      g.lineStyle(3, hex(c.white), 1);
      g.beginPath().arc(4, 0, 8, -0.8, 0.8).strokePath();
      g.beginPath().arc(4, 0, 15, -0.8, 0.8).strokePath();
    }
  }
}
