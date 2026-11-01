import Phaser from 'phaser';
import { formatDuration } from '../systems/gameState';
import { Button } from '../ui/Button';
import { bodyFont, displayFont, hex, theme } from '../ui/theme';
import { getState, responsive, tr } from './shared';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(): void {
    responsive(this, () => this.layout());
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const portrait = h > w;
    const c = theme.colors;
    const m = getState(this).lastMatch;
    this.cameras.main.setBackgroundColor(hex(c.ink));
    if (!m) {
      this.scene.start('Menu');
      return;
    }
    const win = m.outcome === 'victory';
    const panelW = Math.min(w - 48, 640);
    const panelH = portrait ? 820 : 600;
    this.add
      .rectangle(w / 2, h / 2, panelW, panelH, hex(c.night), 0.95)
      .setStrokeStyle(4, hex(win ? c.gold : c.violet));
    const top = h / 2 - panelH / 2;
    this.add.image(w / 2, top + 110, win ? 'nexus-blue' : 'nexus-red').setScale(0.8);
    this.add
      .text(
        w / 2,
        top + 230,
        tr(this, win ? 'result.victory' : 'result.defeat'),
        displayFont(72, win ? c.gold : c.paper),
      )
      .setOrigin(0.5);
    this.add
      .text(
        w / 2,
        top + 310,
        tr(this, 'result.time', { time: formatDuration(m.durationSec) }),
        bodyFont(30, c.paper),
      )
      .setOrigin(0.5);
    this.add
      .text(
        w / 2,
        top + 355,
        tr(this, 'result.accuracy', { correct: m.correct, answered: m.answered }),
        bodyFont(26, c.paper),
      )
      .setOrigin(0.5);

    const y = top + panelH - (portrait ? 220 : 90);
    if (portrait) {
      new Button(this, w / 2, y, tr(this, 'result.again'), () => this.scene.start('Match'), {
        width: 360,
      });
      new Button(this, w / 2, y + 120, tr(this, 'result.menu'), () => this.scene.start('Menu'), {
        width: 360,
        style: 'secondary',
      });
    } else {
      new Button(this, w / 2 - 150, y, tr(this, 'result.again'), () => this.scene.start('Match'), {
        width: 270,
      });
      new Button(this, w / 2 + 150, y, tr(this, 'result.menu'), () => this.scene.start('Menu'), {
        width: 270,
        style: 'secondary',
      });
    }
  }
}
