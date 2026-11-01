import Phaser from 'phaser';
import ranks from '../data/ranks.json';
import { Button } from '../ui/Button';
import { bodyFont, displayFont, hex, theme } from '../ui/theme';
import { getState, responsive, tr } from './shared';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    responsive(this, () => this.layout());
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const portrait = h > w;
    const s = getState(this);
    const c = theme.colors;
    this.cameras.main.setBackgroundColor(hex(c.ink));

    // Soft background orbs from the prototype.
    this.add.circle(w * 0.85, h * 0.2, Math.min(w, h) * 0.35, hex(c.violet), 0.18);
    this.add.circle(w * 0.1, h * 0.95, Math.min(w, h) * 0.3, hex(theme.teams.blue.main), 0.12);

    // Portrait: one centred column. Landscape: hero on the left, title and buttons on the right.
    const heroX = portrait ? w / 2 : w * 0.3;
    const heroY = portrait ? h * 0.25 : h * 0.5;
    const cx = portrait ? w / 2 : w * 0.64;
    const colW = portrait ? w * 0.9 : w * 0.6;
    this.add.circle(heroX, heroY, portrait ? 130 : 170, hex(c.violet), 0.25);
    this.add.image(heroX, heroY, 'hero-nova').setScale(portrait ? 2 : 2.6);

    const titleY = portrait ? h * 0.45 : h * 0.3;
    this.title(cx, titleY, colW, 110);
    this.add
      .text(cx, titleY + 80, tr(this, 'menu.tagline'), bodyFont(portrait ? 30 : 28, c.paper))
      .setOrigin(0.5)
      .setWordWrapWidth(colW, true)
      .setAlign('center');

    const playY = portrait ? h * 0.64 : h * 0.6;
    new Button(this, cx, playY, `${tr(this, 'menu.play')}  ➜`, () => this.scene.start('Match'), {
      width: 360,
      height: 96,
      fontSize: 40,
    });

    const tier = ranks.tiers.find((t) => t.tier === s.profile.tier) ?? ranks.tiers[0]!;
    const rankY = portrait ? h - 120 : h * 0.84;
    const label = this.add
      .text(
        0,
        rankY,
        tr(this, 'menu.rank', { year: tier.label[s.lang], stars: s.profile.stars }),
        bodyFont(28, c.paper),
      )
      .setOrigin(0, 0.5);
    const badgeW = 56;
    const total = badgeW + 12 + label.width;
    this.add.image(cx - total / 2 + badgeW / 2, rankY, tier.badge).setScale(0.5);
    label.setX(cx - total / 2 + badgeW + 12);
  }

  /** "MATH" white + "LEGENDS" gold, centred on x and shrunk to fit maxWidth. */
  private title(x: number, y: number, maxWidth: number, size: number): void {
    const a = this.add.text(0, y, 'MATH', displayFont(size)).setOrigin(0, 0.5);
    const b = this.add
      .text(0, y, 'LEGENDS', displayFont(size, theme.colors.gold))
      .setOrigin(0, 0.5);
    const scale = Math.min(1, maxWidth / (a.width + b.width));
    a.setScale(scale);
    b.setScale(scale);
    const left = x - ((a.width + b.width) * scale) / 2;
    a.setX(left);
    b.setX(left + a.width * scale);
  }
}
