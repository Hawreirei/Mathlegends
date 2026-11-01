import Phaser from 'phaser';
import { ITEM_CATEGORIES, type Item, type ItemsFile } from '../systems/data';
import type { EconomyConfig } from '../systems/economy';
import type { Lang } from '../systems/gameState';
import { fmt } from '../systems/generators/core';
import type { Rect } from '../systems/hudLayout';
import { buyProblem, findItem, sellPrice, type Inventory } from '../systems/inventory';
import { t, type StringKey } from '../utils/i18n';
import { Button } from './Button';
import { bodyFont, displayFont, hex, theme } from './theme';

type Tab = 'all' | (typeof ITEM_CATEGORIES)[number];
const TABS: Tab[] = ['all', ...ITEM_CATEGORIES];

/** What the panel needs from the match each frame. */
export interface ShopView {
  gold: number;
  inventory: Inventory;
}

/**
 * The item shop (#35): open any time from the HUD button (or B); the match keeps running.
 * Category tabs, item cards, a details pane with Buy / Sell, and the 6 item slots.
 * Item icons are drawn shapes per category (blade, star, shield, wing, leaf), so they read
 * without colour. All rules are in src/systems/inventory.ts.
 */
export class ShopPanel {
  private readonly root: Phaser.GameObjects.Container;
  private tab: Tab = 'all';
  /** Selected item: from the list (`shop`) or one of your slots (`slot`). */
  private sel: { from: 'shop'; id: string } | { from: 'slot'; slot: number } | null = null;
  private note = '';
  private key = '';
  private view: ShopView = { gold: 0, inventory: [] };
  private goldText?: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly r: Rect,
    private readonly items: ItemsFile,
    private readonly econ: EconomyConfig,
    private readonly lang: Lang,
    private readonly onBuy: (id: string) => boolean,
    private readonly onSell: (slot: number) => number | null,
    private readonly onClose: () => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(90).setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  open(): void {
    this.root.setVisible(true);
    this.key = '';
  }

  close(): void {
    this.root.setVisible(false);
    this.note = '';
  }

  /** Redraws when something the player can see changed (gold for the buttons, slots, selection). */
  sync(v: ShopView): void {
    this.view = v;
    if (!this.root.visible) return;
    const selItem = this.selected();
    const affordable = this.items.items.map((i) => v.gold >= i.cost).join('');
    const key = `${affordable}|${v.inventory.join(',')}|${this.tab}|${JSON.stringify(this.sel)}|${this.note}|${selItem?.id}`;
    // Gold ticks up every second: update the number in place, and rebuild only when what can be
    // bought, the slots or the selection change (a rebuild mid-tap would swallow the tap).
    this.goldText?.setText(this.tr('shop.gold', { n: this.money(v.gold) }));
    if (key === this.key) return;
    this.key = key;
    this.build();
  }

  private selected(): Item | undefined {
    if (!this.sel) return undefined;
    if (this.sel.from === 'shop') return findItem(this.items, this.sel.id);
    const id = this.view.inventory[this.sel.slot];
    return id ? findItem(this.items, id) : undefined;
  }

  private tr(key: StringKey, vars?: Record<string, string | number>): string {
    return t(this.lang, key, vars);
  }

  private money(n: number): string {
    return fmt(Math.floor(n), this.lang);
  }

  private build(): void {
    const { scene, r } = this;
    const c = theme.colors;
    this.root.removeAll(true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.root.add(o);
      return o;
    };
    const portrait = r.h > r.w * 1.1;
    const PAD = 18;

    // Panel and a blocker so taps on the panel do not reach the joystick zone.
    const bg = add(scene.add.graphics());
    bg.fillStyle(hex(c.night), 0.97).fillRoundedRect(r.x, r.y, r.w, r.h, 22);
    bg.lineStyle(4, hex(c.gold), 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 22);
    add(scene.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setInteractive());

    // Header: title, gold, close.
    add(scene.add.text(r.x + PAD, r.y + PAD, this.tr('shop.title'), displayFont(34, c.gold)));
    this.goldText = add(
      scene.add
        .text(
          r.x + r.w / 2,
          r.y + PAD + 20,
          this.tr('shop.gold', { n: this.money(this.view.gold) }),
          bodyFont(26, c.gold, '800'),
        )
        .setOrigin(0.5),
    );
    add(
      new Button(
        scene,
        r.x + r.w - PAD - 70,
        r.y + PAD + 22,
        this.tr('shop.close'),
        () => this.onClose(),
        {
          width: 140,
          height: 52,
          fontSize: 24,
          style: 'secondary',
        },
      ),
    );

    // Tabs.
    const tabY = r.y + PAD + 64;
    const tabW = (r.w - 2 * PAD - (TABS.length - 1) * 8) / TABS.length;
    TABS.forEach((tab, i) => {
      add(
        new Button(
          scene,
          r.x + PAD + tabW / 2 + i * (tabW + 8),
          tabY + 24,
          this.tr(`shop.cat.${tab}` as StringKey),
          () => {
            this.tab = tab;
            this.sync(this.view);
          },
          {
            width: tabW,
            height: 48,
            fontSize: tabW < 110 ? 18 : 22,
            style: this.tab === tab ? 'primary' : 'secondary',
          },
        ),
      );
    });

    // Bottom: your 6 slots.
    const slotSize = Math.min(84, (r.w - 2 * PAD - 5 * 10) / 6);
    const slotsY = r.y + r.h - PAD - slotSize;
    const used = this.view.inventory.filter(Boolean).length;
    add(
      scene.add.text(
        r.x + PAD,
        slotsY - 32,
        this.tr('shop.slots', { n: used, max: this.econ.shop.slots }),
        bodyFont(22, c.paper, '700'),
      ),
    );
    this.view.inventory.forEach((id, i) => {
      const x = r.x + PAD + i * (slotSize + 10);
      const g = add(scene.add.graphics());
      const chosen = this.sel?.from === 'slot' && this.sel.slot === i;
      g.fillStyle(hex(c.ink), 1).fillRoundedRect(x, slotsY, slotSize, slotSize, 12);
      g.lineStyle(chosen ? 4 : 2, hex(chosen ? c.gold : c.violet), 1).strokeRoundedRect(
        x,
        slotsY,
        slotSize,
        slotSize,
        12,
      );
      const item = id ? findItem(this.items, id) : undefined;
      if (item)
        drawItemIcon(
          add(scene.add.graphics()),
          x + slotSize / 2,
          slotsY + slotSize / 2,
          slotSize * 0.32,
          item.category,
        );
      if (item)
        add(
          scene.add
            .zone(x + slotSize / 2, slotsY + slotSize / 2, slotSize, slotSize)
            .setInteractive({ useHandCursor: true }),
        ).on('pointerup', () => {
          this.sel = { from: 'slot', slot: i };
          this.note = '';
          this.sync(this.view);
        });
    });

    // Middle: item cards and the details pane (side by side in landscape, stacked in portrait).
    const midTop = tabY + 64;
    const midBottom = slotsY - 44;
    const detailW = portrait ? r.w - 2 * PAD : Math.max(260, (r.w - 2 * PAD) * 0.38);
    const detailH = portrait ? 230 : midBottom - midTop;
    const gridW = portrait ? r.w - 2 * PAD : r.w - 2 * PAD - detailW - PAD;
    const gridH = portrait ? midBottom - midTop - detailH - PAD : midBottom - midTop;
    const list = this.items.items.filter((i) => this.tab === 'all' || i.category === this.tab);
    const cols = Math.max(2, Math.floor(gridW / 170));
    const cardW = (gridW - (cols - 1) * 10) / cols;
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const cardH = Math.min(110, (gridH - (rows - 1) * 10) / rows);
    list.forEach((item, i) => {
      const x = r.x + PAD + (i % cols) * (cardW + 10);
      const y = midTop + Math.floor(i / cols) * (cardH + 10);
      const chosen = this.sel?.from === 'shop' && this.sel.id === item.id;
      const can = this.view.gold >= item.cost;
      const g = add(scene.add.graphics());
      g.fillStyle(hex(chosen ? c.violet : c.ink), 1).fillRoundedRect(x, y, cardW, cardH, 14);
      g.lineStyle(chosen ? 4 : 2, hex(chosen ? c.gold : c.violet), 1).strokeRoundedRect(
        x,
        y,
        cardW,
        cardH,
        14,
      );
      const iconR = Math.min(22, cardH * 0.22);
      drawItemIcon(add(scene.add.graphics()), x + 14 + iconR, y + cardH / 2, iconR, item.category);
      const nameX = x + 24 + iconR * 2;
      const name = add(
        scene.add
          .text(nameX, y + 10, item.name[this.lang], bodyFont(20, c.white, '800'))
          .setWordWrapWidth(cardW - (nameX - x) - 8, true),
      );
      for (let size = 20; size > 14 && name.height > cardH - 40; size--) name.setFontSize(size);
      add(
        scene.add
          .text(
            nameX,
            y + cardH - 30,
            this.money(item.cost),
            bodyFont(20, can ? c.gold : c.paper, '800'),
          )
          .setAlpha(can ? 1 : 0.6),
      );
      add(
        scene.add
          .zone(x + cardW / 2, y + cardH / 2, cardW, cardH)
          .setInteractive({ useHandCursor: true }),
      ).on('pointerup', () => {
        this.sel = { from: 'shop', id: item.id };
        this.note = '';
        this.sync(this.view);
      });
    });

    // Details.
    const dx = portrait ? r.x + PAD : r.x + r.w - PAD - detailW;
    const dy = portrait ? midBottom - detailH : midTop;
    const dg = add(scene.add.graphics());
    dg.fillStyle(hex(c.ink), 0.9).fillRoundedRect(dx, dy, detailW, detailH, 14);
    const item = this.selected();
    if (!item) {
      add(
        scene.add
          .text(dx + 16, dy + 16, this.note || this.tr('shop.pick'), bodyFont(22, c.paper, '600'))
          .setWordWrapWidth(detailW - 32, true),
      );
      return;
    }
    add(
      scene.add
        .text(dx + 16, dy + 12, item.name[this.lang], bodyFont(24, c.gold, '800'))
        .setWordWrapWidth(detailW - 32, true),
    );
    const desc = add(
      scene.add
        .text(dx + 16, dy + 48, item.description[this.lang], bodyFont(19, c.paper, '600'))
        .setWordWrapWidth(detailW - 32, true),
    );
    const stats = Object.entries(item.stats)
      .map(
        ([k, v]) =>
          `+${fmt(k === 'lifesteal' ? Math.round((v as number) * 100) : (v as number), this.lang)}${k === 'lifesteal' ? '%' : ''} ${this.tr(`stat.${k}` as StringKey)}`,
      )
      .join('\n');
    add(scene.add.text(dx + 16, desc.y + desc.height + 8, stats, bodyFont(20, c.mint, '800')));
    const btnY = dy + detailH - 40;
    if (this.sel?.from === 'slot') {
      const slot = this.sel.slot;
      add(
        new Button(
          scene,
          dx + detailW / 2,
          btnY,
          this.tr('shop.sell', { price: this.money(sellPrice(item, this.econ)) }),
          () => {
            const gold = this.onSell(slot);
            if (gold === null) return;
            this.note = this.tr('shop.sold', {
              name: item.name[this.lang],
              gold: this.money(gold),
            });
            this.sel = null;
            this.sync(this.view);
          },
          { width: detailW - 32, height: 56, fontSize: 24, style: 'secondary' },
        ),
      );
    } else {
      const problem = buyProblem(this.view.gold, this.view.inventory, item);
      const label =
        problem === 'full'
          ? this.tr('shop.full')
          : problem === 'gold'
            ? this.tr('shop.noGold', { cost: this.money(item.cost) })
            : this.tr('shop.buy', { cost: this.money(item.cost) });
      const b = add(
        new Button(
          scene,
          dx + detailW / 2,
          btnY,
          label,
          () => {
            if (problem) return;
            if (!this.onBuy(item.id)) return;
            this.note = this.tr('shop.bought', { name: item.name[this.lang] });
            this.sel = null;
            this.sync(this.view);
          },
          {
            width: detailW - 32,
            height: 56,
            fontSize: problem ? 20 : 24,
            style: problem ? 'secondary' : 'primary',
          },
        ),
      );
      if (problem) b.setAlpha(0.6);
    }
  }
}

/** Category icon (#35): blade (attack), star (magic), shield (defense), wing (movement), leaf (support). */
export function drawItemIcon(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  category: Item['category'],
): void {
  const c = theme.colors;
  const v = (pts: [number, number][]) =>
    pts.map(([x, y]) => new Phaser.Math.Vector2(cx + x * r, cy + y * r));
  g.fillStyle(hex(c.white), 1);
  if (category === 'attack') {
    g.fillPoints(
      v([
        [0, -1],
        [0.28, 0.45],
        [0, 0.6],
        [-0.28, 0.45],
      ]),
      true,
    );
    g.fillStyle(hex(c.gold), 1).fillRect(cx - r * 0.55, cy + r * 0.5, r * 1.1, r * 0.18);
    g.fillRect(cx - r * 0.1, cy + r * 0.6, r * 0.2, r * 0.4);
  } else if (category === 'magic') {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const k = i % 2 ? 0.45 : 1;
      pts.push([Math.cos(a) * k, Math.sin(a) * k]);
    }
    g.fillStyle(hex(c.gold), 1).fillPoints(v(pts), true);
  } else if (category === 'defense') {
    g.fillPoints(
      v([
        [-0.8, -0.85],
        [0.8, -0.85],
        [0.8, 0.1],
        [0, 1],
        [-0.8, 0.1],
      ]),
      true,
    );
    g.fillStyle(hex(c.violet), 1).fillPoints(
      v([
        [-0.45, -0.5],
        [0.45, -0.5],
        [0.45, 0.05],
        [0, 0.6],
        [-0.45, 0.05],
      ]),
      true,
    );
  } else if (category === 'movement') {
    g.fillPoints(
      v([
        [-1, 0.6],
        [-0.2, -0.9],
        [0.1, -0.3],
        [1, -0.5],
        [0.2, 0.7],
      ]),
      true,
    );
  } else {
    g.fillStyle(hex(c.mint), 1).fillPoints(
      v([
        [0, -1],
        [0.75, -0.2],
        [0.35, 0.75],
        [0, 1],
        [-0.35, 0.75],
        [-0.75, -0.2],
      ]),
      true,
    );
    g.lineStyle(3, hex(c.ink), 0.6).lineBetween(cx, cy - r * 0.8, cx, cy + r * 0.9);
  }
}
