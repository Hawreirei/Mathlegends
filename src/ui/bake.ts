import Phaser from 'phaser';

/**
 * Draws a shape once into a texture and returns it as an Image (#48).
 *
 * Phaser turns every Graphics object into triangles again on every frame, even when nothing
 * changed; in a match that was about two thirds of the CPU time per frame. Shapes that do not
 * change (button faces, panel backgrounds, frames) are drawn here once, cached by `key` for the
 * whole game, and shown as a plain image, which costs almost nothing to draw.
 *
 * `draw` paints with (0, 0) at the image's origin point, like a Graphics inside a Container;
 * `box` is the area it may paint in, relative to that origin (include room for strokes).
 */
export function bakedImage(
  scene: Phaser.Scene,
  key: string,
  box: Box,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): Phaser.GameObjects.Image {
  const t = bakeTexture(scene, key, box, draw);
  return scene.add.image(0, 0, t.key).setOrigin(t.originX, t.originY);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The texture alone (for swapping an image between cached states). */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  box: Box,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): { key: string; originX: number; originY: number } {
  const w = Math.ceil(box.w);
  const h = Math.ceil(box.h);
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(-box.x, -box.y);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }
  return { key, originX: -box.x / w, originY: -box.y / h };
}

/** A stable texture key for a shape and the numbers that define it. */
export const bakeKey = (name: string, ...parts: (string | number | boolean)[]): string =>
  `baked:${name}:${parts.map((p) => (typeof p === 'number' ? Math.round(p * 100) / 100 : p)).join(':')}`;
