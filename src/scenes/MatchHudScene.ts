import Phaser from 'phaser';
import { formatDuration } from '../systems/gameState';
import { Button } from '../ui/Button';
import { displayFont, hex, theme } from '../ui/theme';
import type { MatchScene } from './MatchScene';
import { responsive, tr } from './shared';

/**
 * Fixed overlay on top of the match world: quit button and timer. The full HUD
 * (health, gold, level, mini-map) comes in #25. The two test buttons end the match
 * until towers and the Nexus can be destroyed (#21).
 */
export class MatchHudScene extends Phaser.Scene {
  private timerText?: Phaser.GameObjects.Text;

  constructor() {
    super('MatchHud');
  }

  private get match(): MatchScene {
    return this.scene.get('Match') as MatchScene;
  }

  create(): void {
    responsive(this, () => this.layout());
  }

  update(): void {
    this.timerText?.setText(formatDuration((this.match.time.now - this.match.startedAt) / 1000));
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    this.add.rectangle(w / 2, 40, w, 80, hex(theme.colors.night), 0.85);
    new Button(
      this,
      90,
      40,
      tr(this, 'match.quit'),
      () => {
        this.scene.stop('Match');
        this.scene.start('Menu');
      },
      { width: 150, height: 56, style: 'secondary', fontSize: 24 },
    );
    this.timerText = this.add.text(w / 2, 40, '0:00', displayFont(36)).setOrigin(0.5);

    const by = h - 70;
    new Button(
      this,
      w / 2 - 165,
      by,
      tr(this, 'match.debugWin'),
      () => this.match.finish('victory'),
      { width: 300, height: 72, fontSize: 28 },
    );
    new Button(
      this,
      w / 2 + 165,
      by,
      tr(this, 'match.debugLose'),
      () => this.match.finish('defeat'),
      { width: 300, height: 72, style: 'secondary', fontSize: 28 },
    );
  }
}
