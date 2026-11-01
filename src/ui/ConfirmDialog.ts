import Phaser from 'phaser';
import { Button } from './Button';
import { bodyFont, displayFont, hex, theme } from './theme';

/**
 * A small yes/no dialog (#44), e.g. "Leave the match?". The match keeps running behind it.
 * Taps outside the box do nothing (so a stray tap cannot quit).
 */
export class ConfirmDialog {
  private readonly parts: Phaser.GameObjects.GameObject[];

  constructor(
    scene: Phaser.Scene,
    title: string,
    body: string,
    stayLabel: string,
    goLabel: string,
    onStay: () => void,
    onGo: () => void,
  ) {
    const { width: w, height: h } = scene.scale;
    const c = theme.colors;
    const bw = Math.min(w - 48, 620);
    const bh = 330;
    const x = w / 2 - bw / 2;
    const y = h / 2 - bh / 2;
    const shade = scene.add.rectangle(w / 2, h / 2, w, h, hex(c.ink), 0.55).setInteractive();
    const box = scene.add.graphics();
    box.fillStyle(hex(c.night), 1).fillRoundedRect(x, y, bw, bh, 24);
    box.lineStyle(4, hex(c.gold), 1).strokeRoundedRect(x, y, bw, bh, 24);
    const t = scene.add
      .text(w / 2, y + 60, title, displayFont(38, c.gold))
      .setOrigin(0.5)
      .setWordWrapWidth(bw - 48, true)
      .setAlign('center');
    const b = scene.add
      .text(w / 2, y + 130, body, bodyFont(26, c.paper, '600'))
      .setOrigin(0.5)
      .setWordWrapWidth(bw - 48, true)
      .setAlign('center');
    const half = (bw - 72) / 2;
    const stay = new Button(scene, x + 24 + half / 2, y + bh - 70, stayLabel, onStay, {
      width: half,
      height: 76,
      fontSize: 26,
    });
    const go = new Button(scene, x + bw - 24 - half / 2, y + bh - 70, goLabel, onGo, {
      width: half,
      height: 76,
      fontSize: 26,
      style: 'secondary',
    });
    // Separate objects with rising depth (not one container): inside a container the full-screen
    // shade could take the buttons' taps.
    shade.setDepth(300);
    box.setDepth(301);
    t.setDepth(302);
    b.setDepth(302);
    stay.setDepth(303);
    go.setDepth(303);
    this.parts = [shade, box, t, b, stay, go];
  }

  destroy(): void {
    for (const p of this.parts) p.destroy();
  }
}
