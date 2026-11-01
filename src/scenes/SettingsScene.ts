import Phaser from 'phaser';
import { csvFileName, logSummary, parseLog, serializeLog, toCsv } from '../systems/answerLog';
import { Button } from '../ui/Button';
import { bodyFont, displayFont, hex, theme } from '../ui/theme';
import { downloadText } from '../utils/download';
import { browserStorage, loadAnswerLogRaw, saveAnswerLogRaw } from '../utils/storage';
import { responsive, tr } from './shared';

/**
 * Settings (#30): the anonymous answer log, with "Download CSV" and "Delete data" (tap twice).
 * Accessibility options (#31) will join this screen.
 */
export class SettingsScene extends Phaser.Scene {
  private note: 'exported' | 'cleared' | 'confirm' | null = null;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.note = null;
    responsive(this, () => this.layout());
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const portrait = h > w;
    const c = theme.colors;
    this.cameras.main.setBackgroundColor(hex(c.ink));
    const rows = parseLog(loadAnswerLogRaw(browserStorage()));
    const sum = logSummary(rows);

    const panelW = Math.min(w - 32, 900);
    const panelH = Math.min(h - 32, portrait ? 1000 : 660);
    const top = h / 2 - panelH / 2;
    this.add
      .rectangle(w / 2, h / 2, panelW, panelH, hex(c.night), 0.95)
      .setStrokeStyle(4, hex(c.violet));
    this.add
      .text(w / 2, top + 60, tr(this, 'settings.title'), displayFont(56, c.gold))
      .setOrigin(0.5);

    const textW = panelW - 80;
    const left = w / 2 - textW / 2;
    this.add.text(left, top + 130, tr(this, 'settings.dataTitle'), bodyFont(32, c.white, '800'));
    this.add
      .text(
        left,
        top + 185,
        sum.answers
          ? tr(this, 'settings.dataInfo', { answers: sum.answers, matches: sum.matches })
          : tr(this, 'settings.dataEmpty'),
        bodyFont(26, c.paper, '600'),
      )
      .setWordWrapWidth(textW, true);

    const btnY = top + (portrait ? 380 : 340);
    const btnW = portrait ? textW : (textW - 32) / 2;
    const exportX = portrait ? w / 2 : left + btnW / 2;
    const clearX = portrait ? w / 2 : left + textW - btnW / 2;
    const clearY = portrait ? btnY + 112 : btnY;
    if (sum.answers) {
      new Button(
        this,
        exportX,
        btnY,
        tr(this, 'settings.export'),
        () => {
          downloadText(csvFileName(new Date()), toCsv(rows));
          this.setNote('exported');
        },
        { width: btnW },
      );
      new Button(
        this,
        clearX,
        clearY,
        tr(this, this.note === 'confirm' ? 'settings.clearConfirm' : 'settings.clear'),
        () => {
          if (this.note !== 'confirm') return this.setNote('confirm');
          saveAnswerLogRaw(browserStorage(), serializeLog([]));
          this.setNote('cleared');
        },
        { width: btnW, style: 'secondary', fontSize: 30 },
      );
    }
    if (this.note === 'exported' || this.note === 'cleared')
      this.add
        .text(
          w / 2,
          clearY + 90,
          tr(this, this.note === 'exported' ? 'settings.exported' : 'settings.cleared'),
          bodyFont(26, this.note === 'exported' ? c.mint : c.gold, '700'),
        )
        .setOrigin(0.5, 0)
        .setWordWrapWidth(textW, true)
        .setAlign('center');

    new Button(
      this,
      w / 2,
      top + panelH - 80,
      tr(this, 'settings.back'),
      () => this.scene.start('Menu'),
      { width: 320, style: 'secondary' },
    );
  }

  private setNote(n: SettingsScene['note']): void {
    this.note = n;
    this.children.removeAll(true);
    this.layout();
  }
}
