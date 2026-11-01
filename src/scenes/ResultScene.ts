import Phaser from 'phaser';
import ranksJson from '../data/ranks.json';
import { loadRanks } from '../systems/data';
import type { RankChange } from '../systems/rank';
import { starChanges } from '../systems/rankDisplay';
import { RankBadge } from '../ui/RankBadge';
import { yearLabel } from '../ui/rankText';
import { formatDuration } from '../systems/gameState';
import type { Rect } from '../systems/hudLayout';
import { MissedReview } from '../ui/MissedReview';
import { Button } from '../ui/Button';
import { bodyFont, displayFont, hex, theme } from '../ui/theme';
import { getState, responsive, tr } from './shared';

const ranks = loadRanks(ranksJson);

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
    const y0 = top + 24;
    this.add
      .text(
        cx,
        y0 + 45,
        tr(this, win ? 'result.victory' : 'result.defeat'),
        displayFont(portrait ? 60 : 64, win ? c.gold : c.paper),
      )
      .setOrigin(0.5);
    this.add
      .text(
        cx,
        y0 + 105,
        tr(this, 'result.time', { time: formatDuration(m.durationSec) }),
        bodyFont(28, c.paper),
      )
      .setOrigin(0.5);
    this.add
      .text(
        cx,
        y0 + 145,
        m.answered > 0
          ? tr(this, 'result.accuracyPct', {
              correct: m.correct,
              answered: m.answered,
              pct: Math.round((100 * m.correct) / m.answered),
            })
          : tr(this, 'result.accuracy', { correct: 0, answered: 0 }),
        bodyFont(26, c.paper),
      )
      .setOrigin(0.5);

    // Stars won or lost, any Year change (#39), then the badge with the stars animating (#42).
    const linesEnd = m.rank ? this.rankLines(cx, y0 + 185, colW - 32, m.rank) : y0 + 175;
    const st = getState(this);
    const after = m.rank?.after ?? st.profile;
    const changes = m.rank
      ? starChanges(m.rank.before, m.rank.after, ranks)
      : { gained: [], lost: [] };
    const badgeY = linesEnd + 62;
    new RankBadge(this, cx, badgeY, {
      tier: after.tier,
      stars: after.stars,
      lang: st.lang,
      size: 'large',
      gained: changes.gained,
      lost: changes.lost,
      pulse: !!(m.rank?.promoted || m.rank?.demoted),
    });
    const rankEnd = badgeY + 95;

    // Missed questions with explanations (#29).
    const reviewTop = rankEnd + 16;
    const review: Rect = portrait
      ? { x: left + 24, y: reviewTop, w: panelW - 48, h: top + panelH - 270 - reviewTop }
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
      const y = top + panelH - 190;
      new Button(this, cx, y, tr(this, 'result.again'), again, { width: 320 });
      new Button(this, cx, y + 112, tr(this, 'result.menu'), menu, {
        width: 320,
        style: 'secondary',
      });
    }
  }

  /** "Stars +2 (accuracy bonus)" and "Up to Year 3!"; returns the y below. */
  private rankLines(x: number, y: number, maxW: number, r: RankChange): number {
    const c = theme.colors;
    const lang = getState(this).lang;
    const year = (t: number) => yearLabel(lang, t);
    const parts = [
      r.delta > 0
        ? tr(this, 'result.starsUp', { n: r.delta })
        : r.delta < 0
          ? tr(this, 'result.starsDown', { n: -r.delta })
          : tr(this, 'result.starsSame'),
    ];
    if (r.bonus) parts[0] += ` ${tr(this, 'result.bonus')}`;
    if (r.promoted) parts.push(tr(this, 'result.promoted', { year: year(r.after.tier) }));
    if (r.demoted) parts.push(tr(this, 'result.demoted', { year: year(r.after.tier) }));
    let cy = y;
    parts.forEach((p, i) => {
      const t = this.add
        .text(
          x,
          cy,
          p,
          bodyFont(26, r.delta > 0 || r.promoted ? c.gold : c.paper, i ? '800' : '700'),
        )
        .setOrigin(0.5, 0)
        .setWordWrapWidth(maxW, true)
        .setAlign('center');
      cy += t.height + 4;
    });
    return cy;
  }
}
