import Phaser from 'phaser';
import type { Point } from '../systems/map';
import type { StructureState } from '../systems/structures';
import { hex, theme } from '../ui/theme';

/**
 * Draws a tower or Nexus (#21): sprite standing on its slot, health bar, a soft bubble while it
 * is protected (cannot be attacked yet), and a greyed, sunken look once destroyed.
 */
export class StructureView extends Phaser.GameObjects.Container {
  private readonly img: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly bubble: Phaser.GameObjects.Arc;
  private readonly barY: number;
  private destroyedShown = false;

  constructor(scene: Phaser.Scene, s: StructureState) {
    super(scene, s.x, s.y);
    const tower = s.kind === 'tower';
    this.img = scene.add.image(0, 0, `${s.kind}-${s.team}`).setOrigin(0.5, tower ? 0.85 : 0.8);
    this.barY = tower ? -160 : -150;
    this.bubble = scene.add
      .circle(0, tower ? -60 : -50, tower ? 95 : 110, hex(theme.colors.white), 0.12)
      .setStrokeStyle(4, hex(theme.colors.white), 0.45);
    this.bar = scene.add.graphics();
    this.add([this.bubble, this.img, this.bar]);
    this.setDepth(s.y);
    scene.add.existing(this);
  }

  sync(s: StructureState, targetable: boolean): void {
    this.bubble.setVisible(s.alive && !targetable);
    this.bar.clear();
    if (!s.alive) {
      if (!this.destroyedShown) this.showDestroyed();
      return;
    }
    const w = 120;
    const frac = Math.max(0, s.hp / s.maxHp);
    this.bar
      .fillStyle(hex(theme.colors.night), 0.9)
      .fillRoundedRect(-w / 2 - 3, this.barY - 3, w + 6, 18, 6);
    this.bar
      .fillStyle(hex(theme.teams[s.team].main), 1)
      .fillRoundedRect(-w / 2, this.barY, w * frac, 12, 4);
  }

  /** Grey it out and sink it a little, with a puff. */
  private showDestroyed(): void {
    this.destroyedShown = true;
    this.img.setTint(0x777777);
    this.scene.tweens.add({
      targets: this.img,
      alpha: 0.45,
      scaleY: 0.55,
      duration: 450,
      ease: 'Cubic.easeIn',
    });
    const puff = this.scene.add
      .circle(this.x, this.y - 40, 40, hex(theme.colors.paper), 0.8)
      .setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: puff,
      scale: 3,
      alpha: 0,
      duration: 600,
      onComplete: () => puff.destroy(),
    });
  }

  flash(): void {
    this.scene.tweens.killTweensOf(this.img);
    if (this.destroyedShown) return;
    this.img.setScale(0.95);
    this.scene.tweens.add({ targets: this.img, scale: 1, duration: 120, ease: 'Back.easeOut' });
  }
}

/** A tower shot: a large glowing orb from the tower top to the target, then an impact ring. */
export function towerShot(scene: Phaser.Scene, from: Point, to: Point, color: string): void {
  const start = { x: from.x, y: from.y - 120 };
  const orb = scene.add
    .circle(start.x, start.y, 15, hex(color))
    .setStrokeStyle(4, hex(theme.colors.gold))
    .setDepth(9_998);
  const glow = scene.add.circle(start.x, start.y, 26, hex(theme.colors.gold), 0.35).setDepth(9_997);
  scene.tweens.add({
    targets: [orb, glow],
    x: to.x,
    y: to.y,
    duration: 200,
    ease: 'Quad.easeIn',
    onComplete: () => {
      orb.destroy();
      glow.destroy();
      const ring = scene.add
        .circle(to.x, to.y, 20)
        .setStrokeStyle(6, hex(theme.colors.gold), 1)
        .setDepth(9_998);
      scene.tweens.add({
        targets: ring,
        scale: 2.4,
        alpha: 0,
        duration: 260,
        onComplete: () => ring.destroy(),
      });
    },
  });
}
