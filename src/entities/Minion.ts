import Phaser from 'phaser';
import type { Point } from '../systems/map';
import type { MinionState } from '../systems/minions';
import { hex, theme } from '../ui/theme';

/**
 * Draws one minion (#20): sprite plus a small health bar that appears once it is damaged.
 * Rules live in src/systems/minions.ts; this only renders.
 */
export class MinionView extends Phaser.GameObjects.Container {
  private readonly img: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly barW: number;

  constructor(scene: Phaser.Scene, m: MinionState) {
    super(scene, m.x, m.y);
    this.img = scene.add.image(0, 0, m.sprite);
    this.bar = scene.add.graphics();
    this.barW = m.radius * 2;
    this.add([this.img, this.bar]);
    scene.add.existing(this);
    this.sync(m);
  }

  sync(m: MinionState): void {
    this.setPosition(m.x, m.y).setDepth(m.y);
    this.bar.clear();
    if (m.hp >= m.maxHp) return;
    const y = -m.radius - 14;
    const w = this.barW;
    this.bar.fillStyle(hex(theme.colors.night), 0.85).fillRect(-w / 2 - 1, y - 1, w + 2, 8);
    this.bar
      .fillStyle(hex(theme.teams[m.team === 'blue' ? 'blue' : 'red'].main), 1)
      .fillRect(-w / 2, y, w * Math.max(0, m.hp / m.maxHp), 6);
  }

  /**
   * Hit feedback: a quick shrink-and-back "punch". Not a white flash: minions in a wave are hit
   * in sync, and whole rows flashing white hid the + / × / ÷ symbols that tell their types apart.
   */
  flash(): void {
    this.scene.tweens.killTweensOf(this.img);
    this.img.setScale(0.86);
    this.scene.tweens.add({ targets: this.img, scale: 1, duration: 120, ease: 'Back.easeOut' });
  }

  /** Shrink and fade, then remove. */
  die(): void {
    this.bar.clear();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.6,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }
}

/** A ranged shot from a Lancer or Cannon: a small ball flying to the target. */
export function shot(
  scene: Phaser.Scene,
  from: Point,
  to: Point,
  color: string,
  big: boolean,
): void {
  const b = scene.add
    .circle(from.x, from.y, big ? 10 : 6, hex(color))
    .setStrokeStyle(2, hex(theme.colors.white))
    .setDepth(9_998);
  scene.tweens.add({ targets: b, x: to.x, y: to.y, duration: 140, onComplete: () => b.destroy() });
}
