import Phaser from 'phaser';
import type { HeroState } from '../systems/hero';
import type { Rect } from '../systems/hudLayout';
import type { Progress } from '../systems/progression';
import { bakedImage, bakeKey } from './bake';
import { Bar } from './Bar';
import { bodyFont, displayFont, hex, theme } from './theme';

/**
 * Player status in the HUD (#25): portrait with level badge, HP bar with numbers, mana bar,
 * EXP bar and gold. Numbers and the level badge read the same in both languages.
 */
export class HeroPanel {
  private readonly hp: Bar;
  private readonly mana: Bar;
  private readonly exp: Bar;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly barX: number;
  private readonly barW: number;

  constructor(
    scene: Phaser.Scene,
    r: Rect,
    sprite: string,
    private readonly levelExp: (level: number) => { from: number; to: number },
  ) {
    const c = theme.colors;
    // Drawn once and cached (#48).
    bakedImage(
      scene,
      bakeKey('hero-panel', r.w, r.h),
      { x: -3, y: -3, w: r.w + 6, h: r.h + 6 },
      (g) => {
        g.fillStyle(hex(c.night), 0.97).fillRoundedRect(0, 0, r.w, r.h, 18);
        g.lineStyle(3, hex(c.violet), 0.9).strokeRoundedRect(0, 0, r.w, r.h, 18);
      },
    ).setPosition(r.x, r.y);

    const px = r.x + 58;
    const py = r.y + r.h / 2;
    scene.add.circle(px, py, 44, hex(theme.teams.blue.dark), 1);
    this.portrait = scene.add.image(px, py, sprite).setScale(0.85);
    scene.add.circle(px + 34, py + 34, 20, hex(c.gold)).setStrokeStyle(3, hex(c.ink));
    this.levelText = scene.add.text(px + 34, py + 35, '1', displayFont(24, c.ink)).setOrigin(0.5);

    this.barX = r.x + 116;
    this.barW = r.x + r.w - 16 - this.barX;
    const y0 = r.y + 16;
    this.hp = new Bar(scene, this.barX, y0, this.barW, 28, theme.teams.blue.main, c.ink);
    this.mana = new Bar(scene, this.barX, y0 + 34, this.barW, 12, c.mint, c.ink);
    this.exp = new Bar(scene, this.barX, y0 + 52, this.barW, 8, c.gold, c.ink);
    this.hpText = scene.add
      .text(this.barX + this.barW / 2, r.y + 30, '', bodyFont(20, c.white, '800'))
      .setOrigin(0.5)
      .setStroke(c.ink, 4);
    scene.add
      .circle(this.barX + 12, r.y + r.h - 24, 12, hex(c.gold))
      .setStrokeStyle(3, hex(c.goldDark));
    this.goldText = scene.add
      .text(this.barX + 32, r.y + r.h - 24, '0', displayFont(28, c.gold))
      .setOrigin(0, 0.5);
  }

  update(h: HeroState, p: Progress): void {
    this.hp.set(h.alive ? h.hp / h.maxHp : 0);
    this.mana.set(h.maxMana > 0 ? h.mana / h.maxMana : 0);
    const lv = this.levelExp(p.level);
    this.exp.set(lv.to > lv.from ? (p.exp - lv.from) / (lv.to - lv.from) : 1);
    this.hpText.setText(`${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`);
    this.levelText.setText(String(p.level));
    this.goldText.setText(String(Math.floor(p.gold)));
    this.portrait.setAlpha(h.alive ? 1 : 0.35);
  }
}
