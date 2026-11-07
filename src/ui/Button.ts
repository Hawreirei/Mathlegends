import Phaser from 'phaser';
import { sfx } from '../audio/AudioPlayer';
import { bakedImage, bakeKey, bakeTexture } from './bake';
import { displayFont, hex, theme } from './theme';

export type ButtonStyle = 'primary' | 'secondary';

/** Rounded button in the prototype style: gold primary, dark secondary. Large tap target. */
export class Button extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    opts: { width?: number; height?: number; style?: ButtonStyle; fontSize?: number } = {},
  ) {
    super(scene, x, y);
    const w = opts.width ?? 320;
    const h = opts.height ?? 88;
    const primary = (opts.style ?? 'primary') === 'primary';
    const face = primary ? theme.colors.gold : theme.colors.night;
    const edge = primary ? theme.colors.goldDark : theme.colors.ink;
    const textColor = primary ? theme.colors.ink : theme.colors.white;

    // Both faces are drawn once and cached (#48): up, and pressed (shifted down onto its edge).
    const paint = (pressed: boolean) => (g: Phaser.GameObjects.Graphics) => {
      g.fillStyle(hex(edge), 1).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 22);
      g.fillStyle(hex(face), 1).fillRoundedRect(-w / 2, -h / 2 + (pressed ? 6 : 0), w, h, 22);
      if (!primary)
        g.lineStyle(3, hex(theme.colors.violet), 1).strokeRoundedRect(
          -w / 2,
          -h / 2 + (pressed ? 6 : 0),
          w,
          h,
          22,
        );
    };
    const box = { x: -w / 2 - 3, y: -h / 2 - 3, w: w + 6, h: h + 14 };
    const keyOf = (pressed: boolean) => bakeKey('button', primary, w, h, face, edge, pressed);
    const g = bakedImage(scene, keyOf(false), box, paint(false));
    bakeTexture(scene, keyOf(true), box, paint(true));
    const draw = (pressed: boolean) => g.setTexture(keyOf(pressed));
    const text = scene.add
      .text(0, 0, label, displayFont(opts.fontSize ?? 34, textColor))
      .setOrigin(0.5);
    this.add([g, text]);
    this.setSize(w, h + 8).setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      draw(true);
      text.setY(6);
    });
    this.on('pointerout', () => {
      draw(false);
      text.setY(0);
    });
    this.on('pointerup', () => {
      draw(false);
      text.setY(0);
      sfx.play('click');
      onClick();
    });
    scene.add.existing(this);
  }
}
