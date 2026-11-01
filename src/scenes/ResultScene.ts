import Phaser from 'phaser';
import ranksJson from '../data/ranks.json';
import { loadRanks } from '../systems/data';
import { formatDuration } from '../systems/gameState';
import type { Rect } from '../systems/hudLayout';
import { MissedReview } from '../ui/MissedReview';
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
    const ranks = loadRanks(ranksJson);
    const panelW = Math.min(w - 32, portrait ? 680 : 1240);
    const panelH = h - 32;
    const left = w / 2 - panelW / 2;
    const top = h / 2 - panelH / 2;
    this.add
      .rectangle(w / 2, h / 2, panelW, panelH, hex(c.night), 0.95)
      .setStrokeStyle(4, hex(win ? c.gold : c.violet));

    // Summary: in a left column in landscape, across the top in portrait.
    const colW = portrait ? panelW : 440;
    const cx = left + colW / 2;
    const y0 = top + (portrait ? 20 : 40);
    this.add.image(cx, y0 + 70, win ? 'nexus-blue' : 'nexus-red').setScale(portrait ? 0.45 : 0.6);
    this.add
      .text(
        cx,
        y0 + (portrait ? 170 : 210),
        tr(this, win ? 'result.victory' : 'result.defeat'),
        displayFont(portrait ? 60 : 64, win ? c.gold : c.paper),
      )
      .setOrigin(0.5);
    this.add
      .text(
        cx,
        y0 + (portrait ? 230 : 280),
        tr(this, 'result.time', { time: formatDuration(m.durationSec) }),
        bodyFont(28, c.paper),
      )
      .setOrigin(0.5);
    this.add
      .text(
        cx,
        y0 + (portrait ? 270 : 325),
        tr(this, 'result.accuracy', { correct: m.correct, answered: m.answered }),
        bodyFont(26, c.paper),
      )
      .setOrigin(0.5);

    // Missed questions with explanations (#29).
    const review: Rect = portrait
      ? { x: left + 24, y: y0 + 310, w: panelW - 48, h: top + panelH - 270 - (y0 + 310) }
      : { x: left + colW, y: top + 24, w: panelW - colW - 24, h: panelH - 48 };
    if (m.answered > 0)
      new MissedReview(
        this,
        review,
        m.missed,
        getState(this).lang,
        ranks.questionEngine.reviewMatches,
      );

    const again = () => this.scene.start('Match');
    const menu = () => this.scene.start('Menu');
    if (portrait) {
      const y = top + panelH - 200;
      new Button(this, w / 2, y, tr(this, 'result.again'), again, { width: 360 });
      new Button(this, w / 2, y + 112, tr(this, 'result.menu'), menu, {
        width: 360,
        style: 'secondary',
      });
    } else {
      const y = top + panelH - 210;
      new Button(this, cx, y, tr(this, 'result.again'), again, { width: 320 });
      new Button(this, cx, y + 112, tr(this, 'result.menu'), menu, {
        width: 320,
        style: 'secondary',
      });
    }
  }
}
