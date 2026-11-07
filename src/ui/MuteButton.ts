import Phaser from 'phaser';
import type { Rect } from '../systems/hudLayout';
import { bakedImage, bakeKey, bakeTexture } from './bake';
import { hex, theme } from './theme';

/**
 * Mute button in the match HUD (#45): a speaker with sound waves, or with a cross when muted.
 * Drawn, not an emoji, so it looks the same on every device. Muting turns off sound effects and
 * music together; Settings has a switch for each.
 */
export class MuteButton extends Phaser.GameObjects.Container {
  private readonly img: Phaser.GameObjects.Image;
  private readonly size: number;

  constructor(scene: Phaser.Scene, r: Rect, muted: boolean, onToggle: () => void) {
    super(scene, r.x + r.w / 2, r.y + r.h / 2);
    this.size = r.w;
    // Both icons are drawn once and cached (#48).
    const box = { x: -r.w / 2 - 3, y: -r.w / 2 - 3, w: r.w + 6, h: r.w + 10 };
    bakeTexture(scene, this.key(true), box, (g) => this.draw(g, true));
    this.img = bakedImage(scene, this.key(false), box, (g) => this.draw(g, false));
    this.add(this.img);
    this.setSize(r.w, r.h).setInteractive({ useHandCursor: true });
    this.on('pointerup', onToggle);
    scene.add.existing(this);
    this.setMuted(muted);
  }

  setMuted(muted: boolean): void {
    this.img.setTexture(this.key(muted));
  }

  private key(muted: boolean): string {
    return bakeKey('mute', this.size, muted);
  }

  private draw(g: Phaser.GameObjects.Graphics, muted: boolean): void {
    const size = this.size;
    const c = theme.colors;
    const s = size / 2;
    g.fillStyle(hex(c.ink), 1).fillRoundedRect(-s, -s + 4, size, size, 16);
    g.fillStyle(hex(c.night), 1).fillRoundedRect(-s, -s, size, size, 16);
    g.lineStyle(3, hex(c.violet), 1).strokeRoundedRect(-s, -s, size, size, 16);
    // Speaker: a box and a cone.
    g.fillStyle(hex(c.white), 1);
    g.fillRect(-15, -6, 8, 12);
    g.fillTriangle(-9, 0, 2, -13, 2, 13);
    g.fillRect(-9, -6, 11, 12);
    if (muted) {
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
