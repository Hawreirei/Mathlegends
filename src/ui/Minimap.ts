import Phaser from 'phaser';
import { worldToMinimap, type Rect } from '../systems/hudLayout';
import type { LaneMap } from '../systems/map';
import type { MatchState } from '../systems/match';
import { bakedImage, bakeKey } from './bake';
import { hex, theme } from './theme';

/** Redraws per second: the mini-map is small, 10 updates a second look smooth (#48). */
const REDRAWS_PER_SEC = 10;
/** Extra room around the map so markers at the edge are not cut off. */
const PAD = 12;

/**
 * Mini-map (#25): the lane, towers and Nexuses (grey once destroyed), minions as dots,
 * both heroes, and the camera's view as a white box.
 *
 * Performance (#48): the frame and terrain are drawn once into a cached image; the markers are
 * painted with the Canvas 2D API onto a small canvas texture about 10 times a second, instead of
 * a Graphics object that Phaser would turn into triangles on every frame.
 */
export class Minimap {
  private readonly canvas: Phaser.Textures.CanvasTexture;
  private lastDraw = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly r: Rect,
    private readonly map: LaneMap,
  ) {
    const c = theme.colors;
    const { world, lane, river } = map.config;
    bakedImage(
      scene,
      bakeKey('minimap', r.w, r.h, world.width, world.height, lane.y, river.y),
      { x: -9, y: -9, w: r.w + 18, h: r.h + 18 },
      (g) => {
        g.fillStyle(hex(c.night), 0.97).fillRoundedRect(-6, -6, r.w + 12, r.h + 12, 14);
        g.lineStyle(3, hex(c.violet), 0.9).strokeRoundedRect(-6, -6, r.w + 12, r.h + 12, 14);
        g.fillStyle(hex(theme.map.grassDark), 1).fillRect(0, 0, r.w, r.h);
        const band = (y: number, th: number, color: string) =>
          g
            .fillStyle(hex(color), 1)
            .fillRect(0, ((y - th / 2) / world.height) * r.h, r.w, (th / world.height) * r.h);
        band(river.y, river.thickness, theme.map.water);
        band(lane.y, lane.thickness, theme.map.lane);
      },
    ).setPosition(r.x, r.y);
    const key = 'minimap-markers';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.canvas = scene.textures.createCanvas(
      key,
      Math.ceil(r.w + 2 * PAD),
      Math.ceil(r.h + 2 * PAD),
    )!;
    scene.add.image(r.x - PAD, r.y - PAD, key).setOrigin(0);
  }

  update(s: MatchState, view: Phaser.Geom.Rectangle): void {
    const now = this.scene.time.now;
    if (now - this.lastDraw < 1000 / REDRAWS_PER_SEC) return;
    this.lastDraw = now;
    const ctx = this.canvas.getContext();
    const { world } = this.map.config;
    const local = { x: PAD, y: PAD, w: this.r.w, h: this.r.h };
    const at = (p: { x: number; y: number }) => worldToMinimap(p, world, local);
    const white = theme.colors.white;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const st of s.structures) {
      const p = at(st);
      ctx.fillStyle = st.alive ? theme.teams[st.team].main : '#8a8a8a';
      if (st.kind === 'nexus') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 11);
        ctx.lineTo(p.x + 9, p.y);
        ctx.lineTo(p.x, p.y + 11);
        ctx.lineTo(p.x - 9, p.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
        ctx.globalAlpha = st.alive ? 0.9 : 0.4;
        ctx.strokeStyle = white;
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
        ctx.globalAlpha = 1;
      }
    }
    for (const m of s.minions) {
      const p = at(m);
      ctx.fillStyle = theme.teams[m.team].main;
      ctx.beginPath();
      ctx.arc(p.x, p.y, m.isSuper ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [h, team, radius] of [
      [s.bot, 'red', 7],
      [s.player, 'blue', 8],
    ] as const) {
      if (!h.alive) continue;
      const p = at(h);
      ctx.fillStyle = theme.teams[team].main;
      ctx.strokeStyle = white;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const a = at({ x: Math.max(0, view.x), y: Math.max(0, view.y) });
    const b = at({ x: Math.min(world.width, view.right), y: Math.min(world.height, view.bottom) });
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = white;
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.globalAlpha = 1;
    this.canvas.refresh();
  }
}
