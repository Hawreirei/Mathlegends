/**
 * The single-lane map (#16). Pure TypeScript, no Phaser.
 * src/data/map.json describes the blue side; the red side is its mirror image,
 * so both teams get exactly the same distances.
 */
export type Team = 'blue' | 'red';

export interface MapConfig {
  version: number;
  world: { width: number; height: number };
  /** walkMargin: how far heroes must stay from the lane edges and world ends. */
  lane: { y: number; thickness: number; walkMargin: number };
  river: { y: number; thickness: number };
  blue: { nexusX: number; towerXs: number[]; heroSpawnX: number; minionSpawnX: number };
  camera: { minVisibleWidth: number; lerp: number };
}

export interface Point {
  x: number;
  y: number;
}

export interface Slot extends Point {
  kind: 'nexus' | 'tower';
  team: Team;
  /** Nexus: 0. Towers: 0 = inner (near the Nexus), 1 = outer (towards the middle). */
  index: number;
}

export interface LaneMap {
  config: MapConfig;
  slots: Slot[];
  heroSpawn: Record<Team, Point>;
  minionSpawn: Record<Team, Point>;
}

export class MapError extends Error {
  constructor(message: string) {
    super(`Invalid map.json: ${message}`);
    this.name = 'MapError';
  }
}

export function buildMap(c: MapConfig): LaneMap {
  const W = c.world.width;
  const mid = W / 2;
  const half = c.lane.thickness / 2;
  if (c.lane.y - half < 0 || c.lane.y + half > c.world.height)
    throw new MapError('lane must fit inside the world height');
  const b = c.blue;
  if (!(b.nexusX > 0)) throw new MapError('blue.nexusX must be inside the world');
  if (b.towerXs.length !== 2) throw new MapError('blue.towerXs must list exactly 2 towers');
  const xs = [b.nexusX, ...b.towerXs];
  if (xs.some((x, i) => i > 0 && x <= xs[i - 1]!) || xs.at(-1)! >= mid)
    throw new MapError('blue.towerXs must increase from the Nexus and stay left of the middle');
  for (const [name, x] of [
    ['heroSpawnX', b.heroSpawnX],
    ['minionSpawnX', b.minionSpawnX],
  ] as const)
    if (!(x > 0 && x < mid)) throw new MapError(`blue.${name} must be on the blue half`);

  const y = c.lane.y;
  const mirror = (x: number) => W - x;
  const slots: Slot[] = [];
  for (const team of ['blue', 'red'] as const) {
    const fx = team === 'blue' ? (x: number) => x : mirror;
    slots.push({ kind: 'nexus', team, index: 0, x: fx(b.nexusX), y });
    b.towerXs.forEach((tx, index) => slots.push({ kind: 'tower', team, index, x: fx(tx), y }));
  }
  return {
    config: c,
    slots,
    heroSpawn: { blue: { x: b.heroSpawnX, y }, red: { x: mirror(b.heroSpawnX), y } },
    minionSpawn: { blue: { x: b.minionSpawnX, y }, red: { x: mirror(b.minionSpawnX), y } },
  };
}

/** Camera zoom so at least `minVisibleWidth` world pixels are visible across the screen. */
export function cameraZoom(viewWidth: number, c: MapConfig): number {
  return Math.min(1, viewWidth / c.camera.minVisibleWidth);
}
