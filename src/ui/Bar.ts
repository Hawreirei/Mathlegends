import Phaser from 'phaser';
import { hex } from './theme';

/**
 * A progress bar (HP, mana, EXP, Nexus health) made of two rounded Rectangles (#48). Unlike a
 * Graphics object, a Rectangle is turned into triangles only when its size changes, and the fill
 * is resized only when its width in whole pixels changes.
 */
export class Bar {
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private shown = -1;
  private readonly inset: number;
  private readonly fw: number;
  private readonly fh: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    trackColor: string,
    opts: {
      trackAlpha?: number;
      container?: Phaser.GameObjects.Container;
      rounded?: boolean;
      /** Gap between the track's edge and the fill. */
      inset?: number;
      /** 'right': the fill is anchored at the right end and empties towards it. */
      from?: 'left' | 'right';
    } = {},
  ) {
    const inset = opts.inset ?? 0;
    this.inset = inset;
    this.fw = w - 2 * inset;
    this.fh = h - 2 * inset;
    const radius = opts.rounded === false ? 0 : h / 2;
    this.track = scene.add
      .rectangle(x, y, w, h, hex(trackColor), opts.trackAlpha ?? 1)
      .setOrigin(0)
      .setRounded(radius);
    const right = opts.from === 'right';
    this.fill = scene.add
      .rectangle(right ? x + w - inset : x + inset, y + inset, this.fw, this.fh, hex(color), 1)
      .setOrigin(right ? 1 : 0, 0)
      .setRounded(opts.rounded === false ? 0 : this.fh / 2);
    opts.container?.add([this.track, this.fill]);
  }

  /** frac: 0 (empty) to 1 (full). */
  set(frac: number): this {
    const f = Math.max(0, Math.min(1, frac));
    const px = f > 0 ? Math.max(Math.round(f * this.fw), this.fh) : 0;
    if (px === this.shown) return this;
    this.shown = px;
    this.fill.setVisible(px > 0);
    if (px > 0) this.fill.setSize(px, this.fh);
    return this;
  }

  setColor(color: string): this {
    this.fill.setFillStyle(hex(color), 1);
    return this;
  }

  setVisible(v: boolean): this {
    this.track.setVisible(v);
    this.fill.setVisible(v && this.shown > 0);
    return this;
  }

  /** Moves the bar (left-filling bars only). */
  setPosition(x: number, y: number): this {
    this.track.setPosition(x, y);
    this.fill.setPosition(x + this.inset, y + this.inset);
    return this;
  }

  setDepth(d: number): this {
    this.track.setDepth(d);
    this.fill.setDepth(d);
    return this;
  }

  destroy(): void {
    this.track.destroy();
    this.fill.destroy();
  }
}
