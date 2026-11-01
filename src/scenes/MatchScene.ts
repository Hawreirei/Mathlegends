import Phaser from 'phaser';
import { formatDuration, recordMatch, type MatchResult } from '../systems/gameState';
import { Button } from '../ui/Button';
import { bodyFont, displayFont, hex, theme } from '../ui/theme';
import { getState, responsive, setState, tr } from './shared';

/**
 * Placeholder match (#15): shows the lane art and a running timer, with test buttons to
 * finish the match. The real lane, units and win condition replace this in #16 to #21.
 */
export class MatchScene extends Phaser.Scene {
  private startedAt = 0;
  private timerText?: Phaser.GameObjects.Text;

  constructor() {
    super('Match');
  }

  create(): void {
    this.startedAt = this.time.now;
    responsive(this, () => this.layout());
  }

  update(): void {
    this.timerText?.setText(formatDuration((this.time.now - this.startedAt) / 1000));
  }

  private finish(outcome: MatchResult['outcome']): void {
    const durationSec = (this.time.now - this.startedAt) / 1000;
    setState(this, recordMatch(getState(this), { outcome, durationSec, answered: 0, correct: 0 }));
    this.scene.start('Result');
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const c = theme.colors;
    this.cameras.main.setBackgroundColor(hex(theme.map.grass));

    // Lane band across the middle.
    const laneY = h / 2;
    for (let x = 0; x < w + 64; x += 64) {
      this.add.image(x + 32, laneY - 64, 'tile-lane');
      this.add.image(x + 32, laneY, 'tile-lane');
      this.add.image(x + 32, laneY + 64, 'tile-lane');
      this.add.image(x + 32, laneY + 160, 'tile-water');
    }
    this.add.image(110, laneY - 20, 'nexus-blue');
    this.add.image(w - 110, laneY - 20, 'nexus-red');
    this.add.image(w * 0.3, laneY, 'hero-nova');
    this.add.image(w * 0.7, laneY, 'hero-mira');

    // Top bar.
    this.add.rectangle(w / 2, 40, w, 80, hex(c.night), 0.9);
    new Button(this, 90, 40, tr(this, 'match.quit'), () => this.scene.start('Menu'), {
      width: 150,
      height: 56,
      style: 'secondary',
      fontSize: 24,
    });
    this.timerText = this.add.text(w / 2, 40, '0:00', displayFont(36)).setOrigin(0.5);

    this.add
      .text(w / 2, laneY - 200, tr(this, 'match.placeholder'), bodyFont(28, c.ink))
      .setOrigin(0.5);
    const by = h - 80;
    new Button(this, w / 2 - 170, by, tr(this, 'match.debugWin'), () => this.finish('victory'), {
      width: 300,
      height: 72,
      fontSize: 28,
    });
    new Button(this, w / 2 + 170, by, tr(this, 'match.debugLose'), () => this.finish('defeat'), {
      width: 300,
      height: 72,
      style: 'secondary',
      fontSize: 28,
    });
  }
}
