import Phaser from 'phaser';
import type { Team } from '../systems/map';
import type { HeroState } from '../systems/hero';
import { hex, theme } from '../ui/theme';

const BAR_W = 76;
const BAR_H = 10;

/**
 * Draws a hero from its HeroState (#17): token sprite plus a health bar above it.
 * The rules live in src/systems/hero.ts; this class only renders.
 */
export class HeroView extends Phaser.GameObjects.Container {
  private readonly bar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    state: HeroState,
    sprite: string,
    private readonly team: Team,
  ) {
    super(scene, state.x, state.y);
    const img = scene.add.image(0, 0, sprite);
    this.bar = scene.add.graphics();
    this.add([img, this.bar]);
    scene.add.existing(this);
    this.sync(state);
  }

  sync(s: HeroState): void {
    this.setPosition(s.x, s.y);
    this.setDepth(s.y);
    const frac = Math.max(0, Math.min(1, s.hp / s.maxHp));
    const y = -64;
    this.bar.clear();
    this.bar
      .fillStyle(hex(theme.colors.night), 0.9)
      .fillRoundedRect(-BAR_W / 2 - 2, y - 2, BAR_W + 4, BAR_H + 4, 4);
    this.bar
      .fillStyle(hex(theme.teams[this.team].main), 1)
      .fillRoundedRect(-BAR_W / 2, y, BAR_W * frac, BAR_H, 3);
  }
}
