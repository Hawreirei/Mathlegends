import Phaser from 'phaser';
import type { Lang } from '../systems/gameState';
import type { Rect } from '../systems/hudLayout';
import type { MissedQuestion } from '../systems/reviewQueue';
import { choiceText, localize, t } from '../utils/i18n';
import { Button } from './Button';
import { bodyFont, displayFont, hex, theme } from './theme';

const PAD = 24;
const NAV_H = 72;

/**
 * The Result screen's list of missed questions (#29): one question at a time with < and >
 * buttons. Each shows the question, the player's answer (or "time ran out"), the right answer
 * and the explanation, in the chosen language. Text shrinks to fit long word problems.
 */
export class MissedReview {
  private readonly page: Phaser.GameObjects.Container;
  private index = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly r: Rect,
    private readonly missed: readonly MissedQuestion[],
    private readonly lang: Lang,
    reviewMatches: number,
  ) {
    const c = theme.colors;
    const card = scene.add.graphics();
    card.fillStyle(hex(c.paper), 1).fillRoundedRect(r.x, r.y, r.w, r.h, 24);
    card.lineStyle(4, hex(c.gold), 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 24);
    this.page = scene.add.container(0, 0);

    if (!missed.length) {
      scene.add
        .text(r.x + r.w / 2, r.y + r.h / 2, t(lang, 'result.allCorrect'), displayFont(36, c.ink))
        .setOrigin(0.5)
        .setWordWrapWidth(r.w - 2 * PAD, true)
        .setAlign('center');
      return;
    }
    scene.add.text(
      r.x + PAD,
      r.y + PAD,
      t(lang, 'result.reviewTitle', { n: missed.length }),
      displayFont(32, c.violet),
    );
    scene.add
      .text(
        r.x + PAD,
        r.y + r.h - PAD - NAV_H - 8,
        t(lang, 'result.comeBack', { n: reviewMatches }),
        bodyFont(20, c.ink, '600'),
      )
      .setOrigin(0, 1)
      .setWordWrapWidth(r.w - 2 * PAD, true)
      .setAlpha(0.75);

    if (missed.length > 1) {
      const y = r.y + r.h - PAD - NAV_H / 2;
      const opts = { width: 96, height: NAV_H - 8, style: 'secondary' as const, fontSize: 36 };
      new Button(scene, r.x + PAD + 48, y, t(lang, 'result.prev'), () => this.go(-1), opts);
      new Button(scene, r.x + r.w - PAD - 48, y, t(lang, 'result.next'), () => this.go(1), opts);
    }
    this.draw();
  }

  /** The item shown, for tests and keyboard use. */
  get current(): number {
    return this.index;
  }

  go(step: number): void {
    const n = this.missed.length;
    this.index = (this.index + step + n) % n;
    this.draw();
  }

  private draw(): void {
    const { scene, r, lang } = this;
    const c = theme.colors;
    const m = this.missed[this.index]!;
    const q = m.question;
    this.page.removeAll(true);

    const top = r.y + PAD + 56;
    const bottom = r.y + r.h - PAD - NAV_H - 44;
    const width = r.w - 2 * PAD;
    const lines = [
      { text: localize(q.stem, lang), color: c.ink, weight: '800', scale: 1 },
      {
        text:
          m.chosen === null
            ? t(lang, 'result.timedOut')
            : t(lang, 'result.yourAnswer', { a: choiceText(q.choices[m.chosen]!, lang) }),
        color: c.wrong,
        weight: '800',
        scale: 0.95,
      },
      {
        text: t(lang, 'result.rightAnswer', { a: choiceText(q.choices[q.answerIndex]!, lang) }),
        color: c.correct,
        weight: '800',
        scale: 0.95,
      },
      { text: localize(q.explanation, lang), color: c.ink, weight: '600', scale: 0.9 },
    ];
    const texts = lines.map((l) =>
      scene.add
        .text(r.x + PAD, 0, l.text, bodyFont(30, l.color, l.weight))
        .setWordWrapWidth(width, true),
    );
    // Shrink everything together until the four blocks fit between the title and the footer.
    const gap = 14;
    const layout = (size: number) => {
      texts.forEach((x, i) => x.setFontSize(Math.round(size * lines[i]!.scale)));
      return texts.reduce((h, x) => h + x.height, 0) + gap * (texts.length - 1);
    };
    let size = 30;
    while (size > 16 && layout(size) > bottom - top) size -= 2;
    let y = top;
    for (const x of texts) {
      x.setY(y);
      y += x.height + gap;
    }
    // Light strip behind the explanation, so it reads as the "why".
    const ex = texts[3]!;
    const strip = scene.add
      .rectangle(r.x + PAD - 10, ex.y - 6, width + 20, ex.height + 12, hex(c.mint), 0.25)
      .setOrigin(0);
    this.page.add([strip, ...texts]);

    if (this.missed.length > 1)
      this.page.add(
        scene.add
          .text(
            r.x + r.w / 2,
            r.y + r.h - PAD - NAV_H / 2,
            t(lang, 'result.page', { i: this.index + 1, n: this.missed.length }),
            displayFont(30, c.ink),
          )
          .setOrigin(0.5),
      );
  }
}
