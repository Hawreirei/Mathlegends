import Phaser from 'phaser';
import { formatDuration } from '../systems/gameState';
import { safeAreaInGame } from '../systems/touch';
import { Button } from '../ui/Button';
import { readSafeAreaCss } from '../ui/safeArea';
import { TouchControls } from '../ui/TouchControls';
import { displayFont, hex, theme } from '../ui/theme';
import type { MatchScene } from './MatchScene';
import { responsive, tr } from './shared';

/** Fired on game.events when the player presses attack (touch button or Space) or a skill. */
export const ATTACK_EVENT = 'ml-attack';
export const SKILL_EVENT = 'ml-skill';

/**
 * Fixed overlay on top of the match world: quit button, timer and, on touch devices,
 * the joystick and attack/skill buttons (#18). The full HUD (health, gold, level,
 * mini-map) comes in #25. The two test buttons end the match until towers and the
 * Nexus can be destroyed (#21).
 */
export class MatchHudScene extends Phaser.Scene {
  private timerText?: Phaser.GameObjects.Text;
  /** Present on touch devices; MatchScene reads its movement vector. */
  touch: TouchControls | null = null;

  constructor() {
    super('MatchHud');
  }

  private get match(): MatchScene {
    return this.scene.get('Match') as MatchScene;
  }

  create(): void {
    this.input.keyboard?.on('keydown-SPACE', () => this.game.events.emit(ATTACK_EVENT));
    responsive(this, () => this.layout());
  }

  update(): void {
    this.timerText?.setText(formatDuration((this.match.time.now - this.match.startedAt) / 1000));
  }

  private layout(): void {
    const { width: w } = this.scale;
    const cssW = this.game.canvas.getBoundingClientRect().width || w;
    const safe = safeAreaInGame(readSafeAreaCss(), w / cssW);
    const barH = 80 + safe.top;

    this.add.rectangle(w / 2, barH / 2, w, barH, hex(theme.colors.night), 0.85);
    const barY = safe.top + 40;
    new Button(
      this,
      safe.left + 90,
      barY,
      tr(this, 'match.quit'),
      () => {
        this.scene.stop('Match');
        this.scene.start('Menu');
      },
      { width: 150, height: 56, style: 'secondary', fontSize: 24 },
    );
    this.timerText = this.add.text(w / 2, barY, '0:00', displayFont(36)).setOrigin(0.5);

    // Temporary test buttons, tucked under the top bar on the right so they never cover the touch controls.
    const tx = w - safe.right - 120;
    new Button(
      this,
      tx,
      barH + 50,
      tr(this, 'match.debugWin'),
      () => this.match.finish('victory'),
      { width: 210, height: 56, fontSize: 22 },
    );
    new Button(
      this,
      tx,
      barH + 120,
      tr(this, 'match.debugLose'),
      () => this.match.finish('defeat'),
      { width: 210, height: 56, style: 'secondary', fontSize: 22 },
    );

    this.touch = this.sys.game.device.input.touch
      ? new TouchControls(
          this,
          safe,
          barH,
          () => this.game.events.emit(ATTACK_EVENT),
          (i) => this.game.events.emit(SKILL_EVENT, i),
        )
      : null;
  }
}
