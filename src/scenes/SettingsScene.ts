import Phaser from 'phaser';
import economyJson from '../data/economy.json';
import { csvFileName, logSummary, parseLog, serializeLog, toCsv } from '../systems/answerLog';
import { fmt } from '../systems/generators/core';
import type { Settings } from '../systems/settings';
import { Button } from '../ui/Button';
import { bodyFont, displayFont, hex, theme, ts } from '../ui/theme';
import { downloadText } from '../utils/download';
import type { StringKey } from '../utils/i18n';
import { browserStorage, loadAnswerLogRaw, saveAnswerLogRaw } from '../utils/storage';
import { changeSettings, getState, responsive, tr } from './shared';

const TEXT_KEYS: StringKey[] = ['settings.text1', 'settings.text2', 'settings.text3'];

/**
 * Settings: accessibility options (#31: question text size, colour-blind colours, extra time)
 * and the anonymous answer log with "Download CSV" and "Delete data" (tap twice) (#30).
 * Landscape shows the two sections side by side, portrait one above the other.
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

    const panelW = Math.min(w - 32, portrait ? 900 : 1400);
    const panelH = h - 32;
    const top = 16;
    const left = w / 2 - panelW / 2;
    this.add
      .rectangle(w / 2, h / 2, panelW, panelH, hex(c.night), 0.95)
      .setStrokeStyle(4, hex(c.violet));
    this.add
      .text(w / 2, top + 55, tr(this, 'settings.title'), displayFont(52, c.gold))
      .setOrigin(0.5);

    const pad = 40;
    if (portrait) {
      const colW = panelW - 2 * pad;
      const end = this.accessibility(left + pad, top + 120, colW);
      this.answerData(left + pad, end + 30, colW);
    } else {
      const colW = (panelW - 3 * pad) / 2;
      this.accessibility(left + pad, top + 120, colW);
      this.answerData(left + 2 * pad + colW, top + 120, colW);
    }

    new Button(
      this,
      w / 2,
      top + panelH - 64,
      tr(this, 'settings.back'),
      () => this.scene.start('Menu'),
      { width: 320, height: 76, style: 'secondary' },
    );
  }

  /** Text size, colour-blind colours, extra time. Returns the y below the section. */
  private accessibility(x: number, y: number, colW: number): number {
    const c = theme.colors;
    const s = getState(this).settings;
    const set = (patch: Partial<Settings>) => changeSettings(this, { ...s, ...patch });
    this.add.text(x, y, tr(this, 'settings.a11yTitle'), bodyFont(32, c.white, '800'));

    // Text size: three choices, the chosen one gold.
    this.add.text(x, y + 55, tr(this, 'settings.textSize'), bodyFont(24, c.paper, '700'));
    const gap = 16;
    const bw = (colW - 2 * gap) / 3;
    theme.textScales.forEach((scale, i) => {
      new Button(
        this,
        x + bw / 2 + i * (bw + gap),
        y + 125,
        tr(this, TEXT_KEYS[i] ?? 'settings.text1'),
        () => set({ textScale: scale }),
        {
          width: bw,
          height: 64,
          fontSize: 24,
          style: s.textScale === scale ? 'primary' : 'secondary',
        },
      );
    });
    this.add.text(x, y + 175, tr(this, 'settings.textSample'), bodyFont(ts(30), c.mint, '800'));

    const toggle = (
      rowY: number,
      label: StringKey,
      hint: string,
      on: boolean,
      flip: () => void,
    ) => {
      this.add
        .text(x, rowY, tr(this, label), bodyFont(26, c.white, '800'))
        .setWordWrapWidth(colW - 190, true);
      this.add
        .text(x, rowY + 38, hint, bodyFont(20, c.paper, '600'))
        .setWordWrapWidth(colW - 190, true)
        .setAlpha(0.8);
      new Button(
        this,
        x + colW - 80,
        rowY + 30,
        tr(this, on ? 'settings.on' : 'settings.off'),
        flip,
        { width: 160, height: 64, fontSize: 26, style: on ? 'primary' : 'secondary' },
      );
    };
    toggle(y + 250, 'settings.colorBlind', tr(this, 'settings.colorBlindHint'), s.colorBlind, () =>
      set({ colorBlind: !s.colorBlind }),
    );
    const x15 = fmt(economyJson.extraTimeMultiplier, getState(this).lang);
    toggle(
      y + 350,
      'settings.extraTime',
      tr(this, 'settings.extraTimeHint', { x: x15 }),
      s.extraTime,
      () => set({ extraTime: !s.extraTime }),
    );
    return y + 440;
  }

  /** The answer log (#30). */
  private answerData(x: number, y: number, colW: number): void {
    const c = theme.colors;
    const rows = parseLog(loadAnswerLogRaw(browserStorage()));
    const sum = logSummary(rows);
    this.add.text(x, y, tr(this, 'settings.dataTitle'), bodyFont(32, c.white, '800'));
    const info = this.add
      .text(
        x,
        y + 55,
        sum.answers
          ? tr(this, 'settings.dataInfo', { answers: sum.answers, matches: sum.matches })
          : tr(this, 'settings.dataEmpty'),
        bodyFont(24, c.paper, '600'),
      )
      .setWordWrapWidth(colW, true);

    const btnY = info.y + info.height + 60;
    const bw = (colW - 24) / 2;
    if (sum.answers) {
      new Button(
        this,
        x + bw / 2,
        btnY,
        tr(this, 'settings.export'),
        () => {
          downloadText(csvFileName(new Date()), toCsv(rows));
          this.setNote('exported');
        },
        { width: bw, height: 76, fontSize: 28 },
      );
      new Button(
        this,
        x + colW - bw / 2,
        btnY,
        tr(this, this.note === 'confirm' ? 'settings.clearConfirm' : 'settings.clear'),
        () => {
          if (this.note !== 'confirm') return this.setNote('confirm');
          saveAnswerLogRaw(browserStorage(), serializeLog([]));
          this.setNote('cleared');
        },
        { width: bw, height: 76, fontSize: 24, style: 'secondary' },
      );
    }
    if (this.note === 'exported' || this.note === 'cleared')
      this.add
        .text(
          x + colW / 2,
          btnY + 60,
          tr(this, this.note === 'exported' ? 'settings.exported' : 'settings.cleared'),
          bodyFont(24, this.note === 'exported' ? c.mint : c.gold, '700'),
        )
        .setOrigin(0.5, 0)
        .setWordWrapWidth(colW, true)
        .setAlign('center');
  }

  private setNote(n: SettingsScene['note']): void {
    this.note = n;
    this.children.removeAll(true);
    this.layout();
  }
}
