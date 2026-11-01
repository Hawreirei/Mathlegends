import Phaser from 'phaser';
import type { Lang } from '../systems/gameState';
import { displayFont, hex, theme } from './theme';

const LANGS: Lang[] = ['id', 'en'];

/** Two-segment "ID | EN" switch (#23). Language codes read the same in both languages. */
export class LangToggle extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    current: Lang,
    onChange: (lang: Lang) => void,
  ) {
    super(scene, x, y);
    const segW = 84;
    const h = 56;
    const bg = scene.add.graphics();
    bg.fillStyle(hex(theme.colors.night), 0.9).fillRoundedRect(-segW, -h / 2, segW * 2, h, h / 2);
    bg.lineStyle(3, hex(theme.colors.violet), 1).strokeRoundedRect(
      -segW,
      -h / 2,
      segW * 2,
      h,
      h / 2,
    );
    this.add(bg);
    LANGS.forEach((lang, i) => {
      const cx = -segW / 2 + i * segW;
      const active = lang === current;
      if (active) {
        const pill = scene.add.graphics();
        pill
          .fillStyle(hex(theme.colors.gold), 1)
          .fillRoundedRect(cx - segW / 2 + 5, -h / 2 + 5, segW - 10, h - 10, (h - 10) / 2);
        this.add(pill);
      }
      const label = scene.add
        .text(
          cx,
          0,
          lang.toUpperCase(),
          displayFont(26, active ? theme.colors.ink : theme.colors.paper),
        )
        .setOrigin(0.5);
      const hit = scene.add.zone(cx, 0, segW, h).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (!active) onChange(lang);
      });
      this.add([label, hit]);
    });
    scene.add.existing(this);
  }
}
