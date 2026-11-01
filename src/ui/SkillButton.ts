import Phaser from 'phaser';
import type { Point } from '../systems/map';
import type { SkillButtonState } from '../systems/skills';
import { bodyFont, displayFont, hex, theme } from './theme';

/**
 * A skill button (#33), round on touch screens and square in the desktop skill bar.
 *
 * - Ready: bright face.
 * - Cooldown: a dark pie (round) or curtain (square) for the time still to go, with the
 *   seconds left in the middle.
 * - Not enough mana: dimmed, with a blue rim.
 * - Locked (hero level too low): dark, with "Lv N".
 * The key or slot label stays in the corner. Shape and text carry the state, not only colour.
 */
export class SkillButton {
  private readonly c: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly sweep: Phaser.GameObjects.Graphics;
  private readonly secs: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private readonly lock: Phaser.GameObjects.Text;
  private last = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly at: Point,
    private readonly r: number,
    private readonly shape: 'circle' | 'square',
    labelText: string,
    private readonly ultimate: boolean,
    onPress: () => void,
  ) {
    this.c = scene.add.container(at.x, at.y).setDepth(50);
    const shadow = scene.add.graphics();
    shadow.fillStyle(hex(theme.colors.ink), 0.5);
    this.fill(shadow, 0, 6, r);
    this.face = scene.add.graphics();
    this.sweep = scene.add.graphics();
    this.label = scene.add
      .text(
        shape === 'circle' ? 0 : -r + 10,
        shape === 'circle' ? 0 : -r + 6,
        labelText,
        displayFont(shape === 'circle' ? 34 : 22, theme.colors.ink),
      )
      .setOrigin(shape === 'circle' ? 0.5 : 0, shape === 'circle' ? 0.5 : 0);
    this.secs = scene.add
      .text(0, 0, '', displayFont(30, theme.colors.white))
      .setOrigin(0.5)
      .setStroke(theme.colors.ink, 6);
    this.lock = scene.add
      .text(0, r * 0.45, '', bodyFont(18, theme.colors.white, '800'))
      .setOrigin(0.5);
    this.c.add([shadow, this.face, this.sweep, this.label, this.secs, this.lock]);
    const hit =
      shape === 'circle'
        ? new Phaser.Geom.Circle(r, r, r)
        : new Phaser.Geom.Rectangle(0, 0, r * 2, r * 2);
    this.c
      .setSize(r * 2, r * 2)
      .setInteractive(
        hit,
        shape === 'circle' ? Phaser.Geom.Circle.Contains : Phaser.Geom.Rectangle.Contains,
      );
    this.c.on('pointerdown', () => {
      this.c.setScale(0.92);
      onPress();
    });
    const up = () => this.c.setScale(1);
    this.c.on('pointerup', up);
    this.c.on('pointerout', up);
  }

  private fill(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
    if (this.shape === 'circle') g.fillCircle(x, y, r);
    else g.fillRoundedRect(x - r, y - r, r * 2, r * 2, 14);
  }

  /** A quick shake when a press cannot cast (cooldown, mana, locked). */
  nudge(): void {
    this.scene.tweens.add({
      targets: this.c,
      x: this.at.x + 6,
      yoyo: true,
      repeat: 2,
      duration: 40,
      onComplete: () => this.c.setX(this.at.x),
    });
  }

  update(st: SkillButtonState, lockLabel: string): void {
    const key = `${st.empty}|${st.ready}|${st.locked}|${st.noMana}|${Math.ceil(st.cooldownLeft)}|${st.cooldownFrac.toFixed(2)}`;
    if (key === this.last) return;
    this.last = key;
    const c = theme.colors;
    const base = this.ultimate ? c.gold : c.violet;
    const r = this.r;
    this.face.clear();
    this.sweep.clear();
    this.c.setVisible(!st.empty);
    if (st.empty) return;
    const dim = st.locked || (st.noMana && st.cooldownLeft <= 0);
    this.face.fillStyle(hex(st.locked ? c.night : base), st.locked ? 0.9 : dim ? 0.45 : 0.95);
    this.fill(this.face, 0, 0, r);
    this.face.lineStyle(4, hex(st.noMana && !st.locked ? theme.teams.blue.light : c.white), 0.85);
    if (this.shape === 'circle') this.face.strokeCircle(0, 0, r);
    else this.face.strokeRoundedRect(-r, -r, r * 2, r * 2, 14);
    if (st.cooldownLeft > 0 && !st.locked) {
      // The part of the cooldown still to go: a pie from 12 o'clock on round buttons, a
      // curtain that drops from the top on square ones.
      this.sweep.fillStyle(hex(c.ink), 0.6);
      if (this.shape === 'circle') {
        const start = -Math.PI / 2;
        this.sweep.slice(0, 0, r, start, start + Math.PI * 2 * st.cooldownFrac, false).fillPath();
      } else {
        const hgt = 2 * r * st.cooldownFrac;
        this.sweep.fillRoundedRect(-r, r - hgt, r * 2, hgt, Math.min(14, hgt / 2));
      }
    }
    this.secs.setText(st.cooldownLeft > 0 && !st.locked ? String(Math.ceil(st.cooldownLeft)) : '');
    this.lock.setText(st.locked ? lockLabel : '');
    this.label
      .setColor(st.locked ? c.paper : c.ink)
      .setAlpha(st.cooldownLeft > 0 && this.shape === 'circle' ? 0 : 1);
  }
}
