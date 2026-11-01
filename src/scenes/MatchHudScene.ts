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
/** Fired when the attack button or Space is released (holding attack keeps attacking, #19). */
export const ATTACK_RELEASE_EVENT = 'ml-attack-release';
export const SKILL_EVENT = 'ml-skill';

/**
 * Fixed overlay on top of the match world: quit button, timer and, on touch devices,
 * the joystick and attack/skill buttons (#18). The full HUD (health, gold, level,
 * mini-map) comes in #25.
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
    this.input.keyboard?.on('keyup-SPACE', () => this.game.events.emit(ATTACK_RELEASE_EVENT));
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

    this.touch = this.sys.game.device.input.touch
      ? new TouchControls(
          this,
          safe,
          barH,
          () => this.game.events.emit(ATTACK_EVENT),
          () => this.game.events.emit(ATTACK_RELEASE_EVENT),
          (i) => this.game.events.emit(SKILL_EVENT, i),
        )
      : null;
  }
}
