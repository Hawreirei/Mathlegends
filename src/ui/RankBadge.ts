import Phaser from 'phaser';
import ranksJson from '../data/ranks.json';
import { loadRanks } from '../systems/data';
import type { Lang } from '../systems/gameState';
import { rankView, starPoints } from '../systems/rankDisplay';
import { t } from '../utils/i18n';
import { yearLabel } from './rankText';
import { bodyFont, displayFont, hex, theme } from './theme';

const ranks = loadRanks(ranksJson);

export interface RankBadgeOptions {
  tier: number;
  stars: number;
  lang: Lang;
  /** `large`: Result screen, with progress bar; `small`: Menu, one compact row. */
  size: 'large' | 'small';
  /** Star icons (0-4) that pop in, and ones that fade out (#42 star animation). */
  gained?: number[];
  lost?: number[];
  /** Pulse the badge (a promotion or demotion). */
  pulse?: boolean;
}

/**
 * Rank badge (#42): the Year badge, the Year name, 5 star icons (drawn, filled up to the stars
 * held) and, in Year 6 past 5 stars, a gold "×N" with the real total. The large version adds a
 * progress bar towards the next Year. Filled stars are solid gold and empty ones only an
 * outline, so they differ in shape, not just colour. Centred on (x, y).
 */
export class RankBadge extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, o: RankBadgeOptions) {
    super(scene, 0, 0);
    const c = theme.colors;
    const v = rankView(o.tier, o.stars, ranks);
    const large = o.size === 'large';
    const badgeScale = large ? 0.85 : 0.5;
    const badgeW = 96 * badgeScale;
    const badgeH = 112 * badgeScale;
    const r = large ? 17 : 11;
    const step = r * 2 + (large ? 8 : 5);
    const gap = large ? 18 : 12;

    const badge = scene.add
      .image(badgeW / 2, 0, ranks.tiers[o.tier - 1]!.badge)
      .setScale(badgeScale);
    this.add(badge);
    const left = badgeW + gap;

    const label = scene.add
      .text(
        left,
        large ? -badgeH / 2 + 6 : -badgeH / 2 + 2,
        yearLabel(o.lang, o.tier),
        (large ? displayFont : bodyFont)(large ? 34 : 26, c.white, '800'),
      )
      .setOrigin(0, 0);
    this.add(label);

    // Star row.
    const starsY = label.y + label.height + r + (large ? 6 : 2);
    for (let i = 0; i < v.icons; i++) {
      const cx = left + r + i * step;
      // Phaser wants Vector2 points.
      const pts = starPoints(0, 0, r, r * 0.45).map((p) => new Phaser.Math.Vector2(p.x, p.y));
      const empty = scene.add.graphics({ x: cx, y: starsY });
      empty.lineStyle(large ? 3 : 2, hex(c.paper), 0.6).strokePoints(pts, true);
      this.add(empty);
      const filled = i < v.filled || o.lost?.includes(i);
      if (!filled) continue;
      const star = scene.add.graphics({ x: cx, y: starsY });
      star.fillStyle(hex(c.gold), 1).fillPoints(pts, true);
      star.lineStyle(2, hex(c.goldDark), 1).strokePoints(pts, true);
      this.add(star);
      const order = (list: number[] | undefined) => list?.indexOf(i) ?? -1;
      if (order(o.gained) >= 0) {
        star.setScale(0);
        scene.tweens.add({
          targets: star,
          scale: 1,
          delay: 450 + order(o.gained) * 180,
          duration: 320,
          ease: 'Back.Out',
        });
      }
      if (order(o.lost) >= 0)
        scene.tweens.add({ targets: star, alpha: 0, scale: 0.4, delay: 600, duration: 500 });
    }
    let right = left + v.icons * step;
    if (v.times !== null) {
      const times = scene.add
        .text(
          right + 4,
          starsY,
          t(o.lang, 'rank.times', { n: v.times }),
          displayFont(large ? 32 : 24, c.gold),
        )
        .setOrigin(0, 0.5);
      this.add(times);
      right = times.x + times.width;
      if (o.gained?.length)
        scene.tweens.add({ targets: times, scale: 1.25, yoyo: true, delay: 450, duration: 220 });
    }
    right = Math.max(right, label.x + label.width);

    if (large) {
      // Progress towards the next Year, or the top-Year note.
      const barY = starsY + r + 14;
      const barW = v.icons * step - 8;
      const caption =
        v.toNext === null
          ? t(o.lang, 'rank.top')
          : t(o.lang, v.toNext === 1 ? 'rank.toNextOne' : 'rank.toNextMany', {
              n: v.toNext,
              year: yearLabel(o.lang, v.nextTier!),
            });
      if (v.toNext !== null) {
        const bar = scene.add.graphics();
        bar.fillStyle(hex(c.ink), 1).fillRoundedRect(left, barY, barW, 12, 6);
        if (v.progress > 0)
          bar
            .fillStyle(hex(c.gold), 1)
            .fillRoundedRect(left, barY, Math.max(12, barW * v.progress), 12, 6);
        this.add(bar);
      }
      const cap = scene.add
        .text(left, barY + (v.toNext === null ? -2 : 18), caption, bodyFont(20, c.paper, '600'))
        .setAlpha(0.9);
      this.add(cap);
      right = Math.max(right, cap.x + cap.width);
    }

    if (o.pulse)
      scene.tweens.add({
        targets: badge,
        scale: badgeScale * 1.2,
        yoyo: true,
        delay: 300,
        duration: 260,
        repeat: 1,
      });

    // Centre the whole group on (x, y).
    this.setPosition(x - right / 2, y);
    this.width = right;
    scene.add.existing(this);
  }
}
