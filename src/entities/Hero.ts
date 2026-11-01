import Phaser from 'phaser';
import type { Point, Team } from '../systems/map';
import type { HeroState } from '../systems/hero';
import { displayFont, hex, theme } from '../ui/theme';

const BAR_W = 76;
const BAR_H = 10;

/**
 * Draws a hero from its HeroState (#17, #19): token sprite, health bar, hit flash and,
 * while dead, a respawn countdown at its base. The rules live in src/systems/; this only renders.
 */
export class HeroView extends Phaser.GameObjects.Container {
  private readonly img: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly countdown: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    state: HeroState,
    sprite: string,
    private readonly team: Team,
    base: Point,
  ) {
    super(scene, state.x, state.y);
    this.img = scene.add.image(0, 0, sprite);
    this.bar = scene.add.graphics();
    this.add([this.img, this.bar]);
    scene.add.existing(this);
    this.countdown = scene.add
      .text(base.x, base.y, '', displayFont(56, theme.colors.white))
      .setOrigin(0.5)
      .setStroke(theme.colors.ink, 8)
      .setDepth(10_000)
      .setVisible(false);
    this.sync(state, 0);
  }

  /** `now` is match seconds, used for the respawn countdown. */
  sync(s: HeroState, now: number): void {
    this.setVisible(s.alive);
    this.countdown.setVisible(!s.alive);
    if (!s.alive) {
      this.countdown.setText(String(Math.max(1, Math.ceil((s.respawnAt ?? now) - now))));
      return;
    }
    this.setPosition(s.x, s.y);
    this.setDepth(s.y);
    const frac = Math.max(0, Math.min(1, s.hp / s.maxHp));
    const y = -64;
    this.bar.clear();
    this.bar
      .fillStyle(hex(theme.colors.night), 0.9)
      .fillRoundedRect(-BAR_W / 2 - 2, y - 2, BAR_W + 4, BAR_H + 4, 4);
    if (frac > 0)
      this.bar
        .fillStyle(hex(theme.teams[this.team].main), 1)
        .fillRoundedRect(-BAR_W / 2, y, BAR_W * frac, BAR_H, 3);
  }

  /** Short white flash when hit. */
  flash(): void {
    this.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(80, () => this.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }
}

/** Floating damage number that rises and fades (#19; more juice in #44). */
export function damageNumber(scene: Phaser.Scene, at: Point, amount: number): void {
  const t = scene.add
    .text(
      at.x + Phaser.Math.Between(-12, 12),
      at.y - 70,
      String(Math.round(amount)),
      displayFont(34, theme.colors.white),
    )
    .setOrigin(0.5)
    .setStroke(theme.colors.ink, 6)
    .setDepth(10_000);
  scene.tweens.add({
    targets: t,
    y: t.y - 50,
    alpha: 0,
    duration: 650,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}

/** Quick slash arc from attacker towards target. */
export function slash(scene: Phaser.Scene, from: Point, to: Point, color: string): void {
  const g = scene.add.graphics().setDepth(9_999);
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  g.lineStyle(10, hex(color), 0.9).beginPath();
  g.arc(from.x, from.y, 70, a - 0.7, a + 0.7);
  g.strokePath();
  scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
}
