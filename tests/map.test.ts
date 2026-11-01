import { describe, expect, it } from 'vitest';
import mapJson from '../src/data/map.json';
import { buildMap, cameraZoom, MapError, type MapConfig } from '../src/systems/map';

const cfg = mapJson as MapConfig;
const map = buildMap(cfg);

describe('lane map (#16)', () => {
  it('has one Nexus and 2 towers per side', () => {
    expect(map.slots.filter((s) => s.kind === 'nexus')).toHaveLength(2);
    for (const team of ['blue', 'red'] as const)
      expect(map.slots.filter((s) => s.kind === 'tower' && s.team === team)).toHaveLength(2);
  });

  it('mirrors the red side exactly, so the lane is fair', () => {
    for (const s of map.slots.filter((x) => x.team === 'blue')) {
      const twin = map.slots.find(
        (x) => x.team === 'red' && x.kind === s.kind && x.index === s.index,
      )!;
      expect(twin.x).toBe(cfg.world.width - s.x);
      expect(twin.y).toBe(s.y);
    }
    expect(map.heroSpawn.red.x).toBe(cfg.world.width - map.heroSpawn.blue.x);
    expect(map.minionSpawn.red.x).toBe(cfg.world.width - map.minionSpawn.blue.x);
  });

  it('orders each side Nexus -> inner tower -> outer tower towards the middle', () => {
    const blue = map.slots.filter((s) => s.team === 'blue').sort((a, b) => a.x - b.x);
    expect(blue.map((s) => `${s.kind}${s.index}`)).toEqual(['nexus0', 'tower0', 'tower1']);
    expect(blue.at(-1)!.x).toBeLessThan(cfg.world.width / 2);
  });

  it('keeps every slot and spawn on the lane and inside the world', () => {
    const points = [
      ...map.slots,
      map.heroSpawn.blue,
      map.heroSpawn.red,
      map.minionSpawn.blue,
      map.minionSpawn.red,
    ];
    for (const p of points) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(cfg.world.width);
      expect(Math.abs(p.y - cfg.lane.y)).toBeLessThanOrEqual(cfg.lane.thickness / 2);
    }
  });

  it('rejects a broken layout with a clear error', () => {
    const bad = structuredClone(cfg);
    bad.blue.towerXs = [1000, 2600];
    expect(() => buildMap(bad)).toThrow(MapError);
    expect(() => buildMap(bad)).toThrow(/towerXs/);
    const bad2 = structuredClone(cfg);
    bad2.lane.y = 1390;
    expect(() => buildMap(bad2)).toThrow(/lane/);
  });
});

describe('camera zoom', () => {
  it('is 1 on a wide screen and zooms out on a narrow portrait screen', () => {
    expect(cameraZoom(1280, cfg)).toBe(1);
    const z = cameraZoom(720, cfg);
    expect(z).toBeLessThan(1);
    expect(720 / z).toBeCloseTo(cfg.camera.minVisibleWidth);
  });
});
