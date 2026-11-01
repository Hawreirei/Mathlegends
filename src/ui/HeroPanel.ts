import Phaser from 'phaser';
import type { HeroState } from '../systems/hero';
import type { Rect } from '../systems/hudLayout';
import type { Progress } from '../systems/progression';
import { bodyFont, displayFont, hex, theme } from './theme';

/**
 * Player status in the HUD (#25): portrait with level badge, HP bar with numbers, mana bar,
 * EXP bar and gold. Numbers and the level badge read the same in both languages.
 */
export class HeroPanel {
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly barX: number;
  private readonly barW: number;

  constructor(
    scene: Phaser.Scene,
    private readonly r: Rect,
    sprite: string,
    private readonly levelExp: (level: number) => { from: number; to: number },
  ) {
    const c = theme.colors;
    const bg = scene.add.graphics();
    bg.fillStyle(hex(c.night), 0.97).fillRoundedRect(r.x, r.y, r.w, r.h, 18);
    bg.lineStyle(3, hex(c.violet), 0.9).strokeRoundedRect(r.x, r.y, r.w, r.h, 18);

    const px = r.x + 58;
    const py = r.y + r.h / 2;
    scene.add.circle(px, py, 44, hex(theme.teams.blue.dark), 1);
    this.portrait = scene.add.image(px, py, sprite).setScale(0.85);
    scene.add.circle(px + 34, py + 34, 20, hex(c.gold)).setStrokeStyle(3, hex(c.ink));
    this.levelText = scene.add.text(px + 34, py + 35, '1', displayFont(24, c.ink)).setOrigin(0.5);

    this.barX = r.x + 116;
    this.barW = r.x + r.w - 16 - this.barX;
    this.bars = scene.add.graphics();
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
    const c = theme.colors;
    const g = this.bars;
    const x = this.barX;
    const w = this.barW;
    const y0 = this.r.y + 16;
    const bar = (y: number, height: number, frac: number, color: string) => {
      g.fillStyle(hex(c.ink), 1).fillRoundedRect(x, y, w, height, height / 2);
      const fw = Math.max(0, Math.min(1, frac)) * w;
      if (fw > 0)
        g.fillStyle(hex(color), 1).fillRoundedRect(x, y, Math.max(fw, height), height, height / 2);
    };
    g.clear();
    bar(y0, 28, h.alive ? h.hp / h.maxHp : 0, theme.teams.blue.main);
    bar(y0 + 34, 12, h.maxMana > 0 ? h.mana / h.maxMana : 0, c.mint);
    const lv = this.levelExp(p.level);
    bar(y0 + 52, 8, lv.to > lv.from ? (p.exp - lv.from) / (lv.to - lv.from) : 1, c.gold);
    this.hpText.setText(`${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`);
    this.levelText.setText(String(p.level));
    this.goldText.setText(String(Math.floor(p.gold)));
    this.portrait.setAlpha(h.alive ? 1 : 0.35);
  }
}
