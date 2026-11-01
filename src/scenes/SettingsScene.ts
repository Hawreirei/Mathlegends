import Phaser from 'phaser';
import economyJson from '../data/economy.json';
import { csvFileName, logSummary, parseLog, serializeLog, toCsv } from '../systems/answerLog';
import { fmt } from '../systems/generators/core';
import type { Settings } from '../systems/settings';
import { Button } from '../ui/Button';
import { bodyFont, displayFont, hex, theme, ts } from '../ui/theme';
import { downloadText, pickTextFile } from '../utils/download';
import { curriculumTopicTiers } from '../systems/questionBank';
import { readSave, saveFileName, writeSave, type SaveData } from '../systems/save';
import type { StringKey } from '../utils/i18n';
import { browserStorage, loadAnswerLogRaw, saveAnswerLogRaw } from '../utils/storage';
import ranks from '../data/ranks.json';
import { loadRanks } from '../systems/data';
import { resetPlacement } from '../systems/gameState';
import { changeSettings, getState, responsive, setStateAndSave, tr } from './shared';

type TransferNote = 'exported' | 'loaded' | 'confirmHint' | 'notASave' | 'tooNew' | 'invalid';

const TEXT_KEYS: StringKey[] = ['settings.text1', 'settings.text2', 'settings.text3'];

/**
 * Settings: accessibility options (#31: question text size, colour-blind colours, extra time)
 * and the anonymous answer log with "Download CSV" and "Delete data" (tap twice) (#30).
 * Landscape shows the two sections side by side, portrait one above the other.
 */
export class SettingsScene extends Phaser.Scene {
  private note: 'exported' | 'cleared' | 'confirm' | 'retake' | null = null;
  private page: 'main' | 'transfer' = 'main';
  private transferNote: TransferNote | null = null;
  /** A checked save picked for import, waiting for the second tap. */
  private pendingImport: SaveData | null = null;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.note = null;
    this.page = 'main';
    this.transferNote = null;
    this.pendingImport = null;
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
    const onTransfer = this.page === 'transfer';
    this.add
      .text(
        w / 2,
        top + 55,
        tr(this, onTransfer ? 'transfer.title' : 'settings.title'),
        displayFont(52, c.gold),
      )
      .setOrigin(0.5);
    if (onTransfer) {
      this.transfer(w / 2, top + 130, Math.min(panelW - 80, 760), portrait);
      new Button(
        this,
        w / 2,
        top + panelH - 64,
        tr(this, 'transfer.back'),
        () => this.showPage('main'),
        { width: 320, height: 76, style: 'secondary' },
      );
      return;
    }

    const pad = 40;
    if (portrait) {
      const colW = panelW - 2 * pad;
      const end = this.accessibility(left + pad, top + 120, colW);
      const yearEnd = this.year(left + pad, end + 30, colW);
      this.answerData(left + pad, yearEnd + 20, colW);
    } else {
      const colW = (panelW - 3 * pad) / 2;
      this.accessibility(left + pad, top + 120, colW);
      const yearEnd = this.year(left + 2 * pad + colW, top + 120, colW);
      this.answerData(left + 2 * pad + colW, yearEnd + 20, colW);
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

  /** Current Year and "Retake placement quiz" (tap twice) (#38). Returns the y below. */
  private year(x: number, y: number, colW: number): number {
    const c = theme.colors;
    const st = getState(this);
    const tier = ranks.tiers.find((t) => t.tier === st.profile.tier) ?? ranks.tiers[0]!;
    const confirm = this.note === 'retake';
    this.add.text(x, y, tr(this, 'settings.yearTitle'), bodyFont(32, c.white, '800'));
    this.add
      .text(
        x,
        y + 50,
        confirm
          ? tr(this, 'settings.retakeHint')
          : tr(this, 'settings.yearInfo', {
              rank: tr(this, 'menu.rank', { year: tier.label[st.lang], stars: st.profile.stars }),
            }),
        bodyFont(24, confirm ? c.gold : c.paper, '600'),
      )
      .setWordWrapWidth(colW, true);
    const half = (colW - 16) / 2;
    new Button(
      this,
      x + half / 2,
      y + 130,
      tr(this, confirm ? 'settings.retakeConfirm' : 'settings.retake'),
      () => {
        if (!confirm) return this.setNote('retake');
        setStateAndSave(this, resetPlacement(getState(this)));
        this.scene.start('Placement');
      },
      { width: half, height: 64, fontSize: 20, style: confirm ? 'primary' : 'secondary' },
    );
    // Export / import the versioned save (#41) on its own page.
    new Button(
      this,
      x + colW - half / 2,
      y + 130,
      tr(this, 'settings.transfer'),
      () => this.showPage('transfer'),
      { width: half, height: 64, fontSize: 20, style: 'secondary' },
    );
    return y + 170;
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

  /** Save to file / Load from file (#41). Load asks for a second tap before replacing progress. */
  private transfer(cx: number, y: number, colW: number, portrait: boolean): void {
    const c = theme.colors;
    const x = cx - colW / 2;
    const info = this.add
      .text(x, y, tr(this, 'transfer.info'), bodyFont(26, c.paper, '600'))
      .setWordWrapWidth(colW, true);
    const btnY = info.y + info.height + 70;
    const bw = portrait ? colW : (colW - 24) / 2;
    const pending = this.pendingImport;
    new Button(
      this,
      portrait ? cx : x + bw / 2,
      btnY,
      tr(this, 'transfer.export'),
      () => {
        const st = getState(this);
        const now = new Date();
        const file = writeSave(
          { profile: st.profile, settings: st.settings, review: st.review },
          now,
        );
        downloadText(saveFileName(now), JSON.stringify(file, null, 2), 'application/json');
        this.pendingImport = null;
        this.setTransferNote('exported');
      },
      { width: bw, height: 76, fontSize: 28 },
    );
    const importY = portrait ? btnY + 110 : btnY;
    new Button(
      this,
      portrait ? cx : x + colW - bw / 2,
      importY,
      tr(this, pending ? 'transfer.confirm' : 'transfer.import'),
      () => {
        if (pending) return this.applyImport(pending);
        void pickTextFile('.json,application/json').then((text) => {
          if (text === null) return;
          let raw: unknown;
          try {
            raw = JSON.parse(text);
          } catch {
            return this.setTransferNote('notASave');
          }
          const r = readSave(raw, {
            ranks: loadRanks(ranks),
            topicTiers: curriculumTopicTiers(),
            textScales: theme.textScales,
          });
          if (!r.ok) return this.setTransferNote(r.reason);
          this.pendingImport = r.data;
          this.setTransferNote('confirmHint');
        });
      },
      {
        width: bw,
        height: 76,
        fontSize: pending ? 24 : 28,
        style: pending ? 'primary' : 'secondary',
      },
    );
    const n = this.transferNote;
    if (!n) return;
    const st = getState(this);
    const shown = n === 'confirmHint' && pending ? pending.profile : st.profile;
    const rank = this.rankText(shown.tier, shown.stars);
    const good = n === 'exported' || n === 'loaded';
    this.add
      .text(
        cx,
        importY + 70,
        tr(this, `transfer.${n}`, { rank }),
        bodyFont(24, good ? c.mint : c.gold, '700'),
      )
      .setOrigin(0.5, 0)
      .setWordWrapWidth(colW, true)
      .setAlign('center');
  }

  private rankText(tier: number, stars: number): string {
    const t = ranks.tiers.find((k) => k.tier === tier) ?? ranks.tiers[0]!;
    return tr(this, 'menu.rank', { year: t.label[getState(this).lang], stars });
  }

  private applyImport(data: SaveData): void {
    const st = getState(this);
    this.pendingImport = null;
    this.transferNote = 'loaded';
    setStateAndSave(this, {
      ...st,
      profile: data.profile,
      settings: data.settings,
      review: data.review,
    });
    // The loaded settings (text size, colours) apply at once; every screen redraws.
    changeSettings(this, data.settings);
  }

  private setTransferNote(n: TransferNote): void {
    this.transferNote = n;
    this.children.removeAll(true);
    this.layout();
  }

  private showPage(p: 'main' | 'transfer'): void {
    this.page = p;
    this.note = null;
    this.transferNote = null;
    this.pendingImport = null;
    this.children.removeAll(true);
    this.layout();
  }

  private setNote(n: SettingsScene['note']): void {
    this.note = n;
    this.children.removeAll(true);
    this.layout();
  }
}
