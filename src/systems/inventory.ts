/**
 * Inventory and shop rules (#35). Pure TypeScript, no Phaser.
 *
 * - `economy.json` shop.slots (6) item slots; a slot is an item id or null.
 * - Buying costs the item's `cost` in gold and fills the first empty slot; it needs enough gold
 *   and a free slot. The shop is open at any time (GDD decision 1), even while dead.
 * - Selling refunds floor(cost x shop.sellRefund) (70%) and empties the slot.
 * - Spending and refunds change `gold` only, never `goldBySource` (earned gold, used by the
 *   math-share cap in #28).
 * What items do to the hero is #36.
 */
import type { Item, ItemsFile } from './data';
import type { EconomyConfig } from './economy';
import type { Progress } from './progression';

export type Inventory = (string | null)[];

export const emptyInventory = (econ: EconomyConfig): Inventory =>
  Array.from({ length: econ.shop.slots }, () => null);

export const findItem = (items: ItemsFile, id: string): Item | undefined =>
  items.items.find((i) => i.id === id);

export const sellPrice = (item: Item, econ: EconomyConfig): number =>
  Math.floor(item.cost * econ.shop.sellRefund);

export type BuyProblem = 'unknown' | 'gold' | 'full';

/** Why `item` cannot be bought now, or null if it can. */
export function buyProblem(
  gold: number,
  inv: Inventory,
  item: Item | undefined,
): BuyProblem | null {
  if (!item) return 'unknown';
  if (!inv.includes(null)) return 'full';
  if (gold + 1e-9 < item.cost) return 'gold';
  return null;
}

export type ShopResult =
  | { ok: true; progress: Progress; inventory: Inventory; slot: number; gold: number }
  | { ok: false; reason: BuyProblem | 'empty' };

export function buyItem(p: Progress, inv: Inventory, items: ItemsFile, id: string): ShopResult {
  const item = findItem(items, id);
  const problem = buyProblem(p.gold, inv, item);
  if (problem) return { ok: false, reason: problem };
  const slot = inv.indexOf(null);
  const inventory = [...inv];
  inventory[slot] = id;
  return {
    ok: true,
    progress: { ...p, gold: p.gold - item!.cost },
    inventory,
    slot,
    gold: -item!.cost,
  };
}

export function sellItem(
  p: Progress,
  inv: Inventory,
  items: ItemsFile,
  slot: number,
  econ: EconomyConfig,
): ShopResult {
  const id = inv[slot];
  const item = id ? findItem(items, id) : undefined;
  if (!id || !item) return { ok: false, reason: 'empty' };
  const refund = sellPrice(item, econ);
  const inventory = [...inv];
  inventory[slot] = null;
  return { ok: true, progress: { ...p, gold: p.gold + refund }, inventory, slot, gold: refund };
}
