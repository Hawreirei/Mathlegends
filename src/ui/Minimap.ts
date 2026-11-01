import Phaser from 'phaser';
import { worldToMinimap, type Rect } from '../systems/hudLayout';
import type { LaneMap } from '../systems/map';
import type { MatchState } from '../systems/match';
import { hex, theme } from './theme';

/**
 * Mini-map (#25): the lane, towers and Nexuses (grey once destroyed), minions as dots,
 * both heroes, and the camera's view as a white box.
 */
export class Minimap {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly r: Rect,
    private readonly map: LaneMap,
  ) {
    const c = theme.colors;
    const bg = scene.add.graphics();
    bg.fillStyle(hex(c.night), 0.97).fillRoundedRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 14);
    bg.lineStyle(3, hex(c.violet), 0.9).strokeRoundedRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 14);
    const { world, lane, river } = map.config;
    const band = (y: number, th: number, color: string, a = 1) => {
      const top = worldToMinimap({ x: 0, y: y - th / 2 }, world, r);
      bg.fillStyle(hex(color), a).fillRect(r.x, top.y, r.w, (th / world.height) * r.h);
    };
    bg.fillStyle(hex(theme.map.grassDark), 1).fillRect(r.x, r.y, r.w, r.h);
    band(river.y, river.thickness, theme.map.water);
    band(lane.y, lane.thickness, theme.map.lane);
    this.g = scene.add.graphics();
  }

  update(s: MatchState, view: Phaser.Geom.Rectangle): void {
    const g = this.g;
    const { world } = this.map.config;
    const at = (p: { x: number; y: number }) => worldToMinimap(p, world, this.r);
    g.clear();
    for (const st of s.structures) {
      const p = at(st);
      const color = st.alive ? hex(theme.teams[st.team].main) : 0x8a8a8a;
      if (st.kind === 'nexus') {
        g.fillStyle(color, 1).fillTriangle(p.x, p.y - 11, p.x + 9, p.y, p.x, p.y + 11);
        g.fillTriangle(p.x, p.y - 11, p.x - 9, p.y, p.x, p.y + 11);
      } else {
        g.fillStyle(color, 1).fillRect(p.x - 6, p.y - 6, 12, 12);
        g.lineStyle(2, hex(theme.colors.white), st.alive ? 0.9 : 0.4).strokeRect(
          p.x - 6,
          p.y - 6,
          12,
          12,
        );
      }
    }
    for (const m of s.minions) {
      const p = at(m);
      g.fillStyle(hex(theme.teams[m.team].main), 1).fillCircle(p.x, p.y, 3);
    }
    for (const [h, team, radius] of [
      [s.bot, 'red', 7],
      [s.player, 'blue', 8],
    ] as const) {
      if (!h.alive) continue;
      const p = at(h);
      g.fillStyle(hex(theme.teams[team].main), 1).fillCircle(p.x, p.y, radius);
      g.lineStyle(3, hex(theme.colors.white), 1).strokeCircle(p.x, p.y, radius);
    }
    const a = at({ x: Math.max(0, view.x), y: Math.max(0, view.y) });
    const b = at({ x: Math.min(world.width, view.right), y: Math.min(world.height, view.bottom) });
    g.lineStyle(2, hex(theme.colors.white), 0.8).strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
}
