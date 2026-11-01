import { describe, expect, it } from 'vitest';
import economyJson from '../src/data/economy.json';
import itemsJson from '../src/data/items.json';
import { ITEM_CATEGORIES, loadItems } from '../src/systems/data';
import type { EconomyConfig } from '../src/systems/economy';
import {
  buyItem,
  buyProblem,
  emptyInventory,
  findItem,
  sellItem,
  sellPrice,
} from '../src/systems/inventory';
import { createProgress, type Progress } from '../src/systems/progression';

const econ = economyJson as EconomyConfig;
const items = loadItems(itemsJson);
const rich = (gold: number): Progress => ({ ...createProgress(econ), gold });

describe('items.json (#35)', () => {
  it('has the 8 MVP items covering all 5 shop categories, in both languages', () => {
    expect(items.items).toHaveLength(8);
    expect(new Set(items.items.map((i) => i.category))).toEqual(new Set(ITEM_CATEGORIES));
    for (const i of items.items) {
      expect(i.name.id && i.name.en && i.description.id && i.description.en).toBeTruthy();
      expect(Number.isInteger(i.cost)).toBe(true);
    }
  });
});

describe('shop rules (#35)', () => {
  it('a starter item is affordable with the starting gold', () => {
    const cheapest = Math.min(...items.items.map((i) => i.cost));
    expect(cheapest).toBeLessThanOrEqual(econ.startingGold);
  });

  it('has 6 item slots', () => {
    expect(econ.shop.slots).toBe(6);
    expect(emptyInventory(econ)).toEqual([null, null, null, null, null, null]);
  });

  it('buying deducts the cost and fills the first free slot', () => {
    const sword = findItem(items, 'training-sword')!;
    const r = buyItem(rich(1000), emptyInventory(econ), items, sword.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.progress.gold).toBe(1000 - sword.cost);
    expect(r.inventory[0]).toBe(sword.id);
    expect(r.gold).toBe(-sword.cost);
  });

  it('selling refunds 70% (rounded down) and empties the slot', () => {
    const spear = findItem(items, 'comet-spear')!;
    expect(sellPrice(spear, econ)).toBe(Math.floor(spear.cost * 0.7));
    const inv = ['training-sword', 'comet-spear', null, null, null, null];
    const r = sellItem(rich(100), inv, items, 1, econ);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.progress.gold).toBe(100 + Math.floor(spear.cost * 0.7));
    expect(r.inventory).toEqual(['training-sword', null, null, null, null, null]);
  });

  it('refuses without enough gold, with all 6 slots full, for unknown items and empty slots', () => {
    const sword = findItem(items, 'training-sword')!;
    expect(buyProblem(sword.cost - 1, emptyInventory(econ), sword)).toBe('gold');
    expect(buyProblem(sword.cost, emptyInventory(econ), sword)).toBeNull();
    const full = Array(6).fill('bamboo-vest');
    expect(buyItem(rich(9999), full, items, sword.id)).toEqual({ ok: false, reason: 'full' });
    expect(buyItem(rich(9999), emptyInventory(econ), items, 'nope')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(sellItem(rich(0), emptyInventory(econ), items, 2, econ)).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('the same item can be bought more than once (stacking rules are #36)', () => {
    let inv = emptyInventory(econ);
    let p = rich(2000);
    for (let i = 0; i < 3; i++) {
      const r = buyItem(p, inv, items, 'training-sword');
      if (!r.ok) throw new Error(r.reason);
      inv = r.inventory;
      p = r.progress;
    }
    expect(inv.filter((x) => x === 'training-sword')).toHaveLength(3);
  });

  it('spending and refunds never count as earned gold (math share, #28)', () => {
    const p = rich(1000);
    const bought = buyItem(p, emptyInventory(econ), items, 'leaf-charm');
    if (!bought.ok) throw new Error();
    const sold = sellItem(bought.progress, bought.inventory, items, 0, econ);
    if (!sold.ok) throw new Error();
    expect(sold.progress.goldBySource).toEqual(p.goldBySource);
  });
});
