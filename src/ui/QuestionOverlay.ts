import Phaser from 'phaser';
import type { Lang } from '../systems/gameState';
import type { Rect } from '../systems/hudLayout';
import type { ActiveQuestion, Reveal } from '../systems/questionSession';
import { choiceText, localize } from '../utils/i18n';
import { bodyFont, displayFont, hex, theme } from './theme';

const PAD = 20;
const GAP = 16;

/**
 * The last-hit question card (#27): question text, a countdown bar with seconds, and four large
 * answer buttons in a 2 x 2 grid (shuffled order). The match keeps running underneath.
 * Long questions shrink their font to fit. Keys 1-4 answer too (desktop).
 * After an answer or a timeout the card briefly shows the right answer (#29): green with a tick,
 * the player's wrong pick red with a cross (shapes as well as colours, for colour-blind players).
 */

type SlotLook = 'normal' | 'right' | 'wrongPick' | 'dim';
export class QuestionOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly timerBar: Phaser.GameObjects.Graphics;
  private readonly seconds: Phaser.GameObjects.Text;
  private shownId: string | null = null;
  /** False while the right answer is being shown. */
  private answering = false;
  private readonly barY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly r: Rect,
    private readonly onAnswer: (slot: number) => void,
  ) {
    this.root = scene.add.container(0, 0).setVisible(false).setDepth(100);
    this.barY = r.y + PAD;
    // The timer bar and seconds live outside `root`, which is cleared for every new question
    // (clearing destroys its children; re-adding destroyed objects crashed the second question).
    this.timerBar = scene.add.graphics().setDepth(101).setVisible(false);
    this.seconds = scene.add
      .text(r.x + r.w - PAD, this.barY + 34, '', displayFont(40, theme.colors.ink))
      .setOrigin(1, 0)
      .setDepth(101)
      .setVisible(false);
    scene.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (this.root.visible && this.answering && n >= 1 && n <= 4) this.onAnswer(n - 1);
    });
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /**
   * Shows the reveal of the last answer while it lasts, else the active question once it is due
   * (rebuilding only when what is shown changes), else nothing.
   */
  sync(q: ActiveQuestion | null, reveal: Reveal | null, now: number, lang: Lang): void {
    if (reveal && now < reveal.until) {
      const key = `reveal:${reveal.question.id}@${reveal.until}`;
      if (key !== this.shownId) this.build(reveal, lang, key, reveal);
      return;
    }
    if (!q || now < q.shownAt) {
      this.root.setVisible(false);
      this.timerBar.setVisible(false);
      this.seconds.setVisible(false);
      this.shownId = null;
      return;
    }
    const key = `${q.question.id}@${q.shownAt}`;
    if (key !== this.shownId) this.build(q, lang, key, null);
    this.drawTimer(q, now);
  }

  private build(
    q: Pick<ActiveQuestion, 'question' | 'order'>,
    lang: Lang,
    key: string,
    reveal: Reveal | null,
  ): void {
    const { r, scene } = this;
    const c = theme.colors;
    this.root.removeAll(true);
    this.shownId = key;
    this.answering = !reveal;

    const card = scene.add.graphics();
    card.fillStyle(hex(c.ink), 0.35).fillRoundedRect(r.x + 6, r.y + 10, r.w, r.h, 26);
    card.fillStyle(hex(c.paper), 0.97).fillRoundedRect(r.x, r.y, r.w, r.h, 26);
    card.lineStyle(5, hex(c.gold), 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 26);
    this.root.add(card);

    // Answers: 2 x 2 grid at the bottom.
    const btnH = Math.max(80, Math.min(120, (r.h - 2 * PAD) * 0.22));
    const btnW = (r.w - 2 * PAD - GAP) / 2;
    const gridTop = r.y + r.h - PAD - 2 * btnH - GAP;

    // Question text between the timer and the answers, shrunk until it fits.
    const stemTop = this.barY + 34;
    const stemMaxW = r.w - 2 * PAD - 90;
    const stemMaxH = gridTop - GAP - stemTop;
    const stem = scene.add.text(
      r.x + PAD,
      stemTop,
      localize(q.question.stem, lang),
      bodyFont(40, c.ink, '800'),
    );
    stem.setWordWrapWidth(stemMaxW, true);
    for (let size = 40; size > 18 && stem.height > stemMaxH; size -= 2) stem.setFontSize(size);
    this.root.add(stem);

    q.order.forEach((choiceIndex, slot) => {
      const col = slot % 2;
      const row = Math.floor(slot / 2);
      const x = r.x + PAD + col * (btnW + GAP);
      const y = gridTop + row * (btnH + GAP);
      const look: SlotLook = !reveal
        ? 'normal'
        : choiceIndex === q.question.answerIndex
          ? 'right'
          : choiceIndex === reveal.chosen
            ? 'wrongPick'
            : 'dim';
      const face = look === 'right' ? c.correct : look === 'wrongPick' ? c.wrong : c.white;
      const g = scene.add.graphics().setAlpha(look === 'dim' ? 0.45 : 1);
      const draw = (pressed: boolean) => {
        g.clear();
        g.fillStyle(hex(c.violet), 1).fillRoundedRect(x, y + 6, btnW, btnH, 18);
        g.fillStyle(hex(pressed ? c.gold : face), 1).fillRoundedRect(
          x,
          y + (pressed ? 4 : 0),
          btnW,
          btnH,
          18,
        );
        g.lineStyle(3, hex(c.violet), 1).strokeRoundedRect(
          x,
          y + (pressed ? 4 : 0),
          btnW,
          btnH,
          18,
        );
      };
      draw(false);
      const label = scene.add
        .text(
          x + btnW / 2,
          y + btnH / 2,
          choiceText(q.question.choices[choiceIndex]!, lang),
          displayFont(38, look === 'right' || look === 'wrongPick' ? c.white : c.ink),
        )
        .setOrigin(0.5)
        .setAlpha(look === 'dim' ? 0.45 : 1);
      for (let size = 38; size > 18 && label.width > btnW - 40; size -= 2) label.setFontSize(size);
      if (reveal) {
        // Tick on the right answer, cross on a wrong pick, at the right-hand end of the button.
        const m = scene.add.graphics().lineStyle(8, hex(c.white), 1);
        const cx = x + btnW - 34;
        const cy = y + btnH / 2;
        if (look === 'right') {
          m.lineBetween(cx - 16, cy, cx - 4, cy + 12);
          m.lineBetween(cx - 4, cy + 12, cx + 16, cy - 12);
        }
        if (look === 'wrongPick') {
          m.lineBetween(cx - 12, cy - 12, cx + 12, cy + 12);
          m.lineBetween(cx - 12, cy + 12, cx + 12, cy - 12);
        }
        this.root.add([g, label, m]);
        return;
      }
      const hint = scene.add.text(x + 12, y + 8, String(slot + 1), bodyFont(18, c.violet, '800'));
      const zone = scene.add
        .zone(x + btnW / 2, y + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerup', () => {
        draw(false);
        this.onAnswer(slot);
      });
      this.root.add([g, label, hint, zone]);
    });
    this.root.setVisible(true);
    // No timer while the right answer is shown.
    this.timerBar.setVisible(!reveal);
    this.seconds.setVisible(!reveal);
  }

  private drawTimer(q: ActiveQuestion, now: number): void {
    const { r } = this;
    const total = q.deadline - q.shownAt;
    const left = Math.max(0, q.deadline - now);
    const frac = total > 0 ? left / total : 0;
    const w = r.w - 2 * PAD;
    const color =
      frac > 0.5 ? theme.colors.correct : frac > 0.25 ? theme.colors.gold : theme.colors.wrong;
    this.timerBar.clear();
    this.timerBar
      .fillStyle(hex(theme.colors.ink), 0.15)
      .fillRoundedRect(r.x + PAD, this.barY, w, 16, 8);
    if (frac > 0)
      this.timerBar
        .fillStyle(hex(color), 1)
        .fillRoundedRect(r.x + PAD, this.barY, Math.max(16, w * frac), 16, 8);
    this.seconds
      .setText(String(Math.ceil(left)))
      .setColor(frac > 0.25 ? theme.colors.ink : theme.colors.wrong);
  }
}
