import Phaser from 'phaser';
import type { Point } from '../systems/map';
import { joystickVector, skillButtonPositions, type Insets } from '../systems/touch';
import { displayFont, hex, theme } from './theme';

const JOY_RADIUS = 110;
const KNOB_RADIUS = 48;
const DEAD_ZONE = 0.15;
const ATTACK_RADIUS = 88;
const SKILL_RADIUS = 52;
const SKILL_DISTANCE = 180;
const MARGIN = 40;

/**
 * Virtual joystick (left) and attack + 3 skill buttons (right) for phones (#18).
 * The joystick floats: it appears where the thumb lands anywhere on the left half and
 * snaps back to its home spot when released. All positions keep clear of the safe area.
 */
export class TouchControls {
  /** Current movement vector, length 0..1. */
  vector: Point = { x: 0, y: 0 };

  private joyId: number | null = null;
  private origin: Point;
  private readonly home: Point;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;

  constructor(
    private readonly scene: Phaser.Scene,
    safe: Insets,
    topBarHeight: number,
    onAttack: () => void,
    onSkill: (index: number) => void,
  ) {
    const { width: w, height: h } = scene.scale;
    this.home = { x: safe.left + MARGIN + JOY_RADIUS, y: h - safe.bottom - MARGIN - JOY_RADIUS };
    this.origin = { ...this.home };
    this.base = scene.add
      .circle(this.home.x, this.home.y, JOY_RADIUS, hex(theme.colors.night), 0.35)
      .setStrokeStyle(4, hex(theme.colors.white), 0.5);
    this.knob = scene.add.circle(
      this.home.x,
      this.home.y,
      KNOB_RADIUS,
      hex(theme.colors.white),
      0.75,
    );

    const attackPos = {
      x: w - safe.right - MARGIN - ATTACK_RADIUS,
      y: h - safe.bottom - MARGIN - ATTACK_RADIUS,
    };
    this.roundButton(attackPos, ATTACK_RADIUS, theme.colors.gold, '✦', 64, onAttack);
    skillButtonPositions(attackPos, SKILL_DISTANCE).forEach((p, i) =>
      this.roundButton(
        p,
        SKILL_RADIUS,
        theme.colors.violet,
        String(i + 1),
        36,
        () => onSkill(i),
        0.55,
      ),
    );

    const zoneTop = topBarHeight;
    scene.input.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (this.joyId !== null || over.length > 0 || p.x > w * 0.5 || p.y < zoneTop) return;
        this.joyId = p.id;
        this.origin = { x: p.x, y: p.y };
        this.base.setPosition(p.x, p.y).setAlpha(1);
        this.knob.setPosition(p.x, p.y);
      },
    );
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      this.vector = joystickVector(this.origin, p, JOY_RADIUS, DEAD_ZONE);
      const dx = p.x - this.origin.x;
      const dy = p.y - this.origin.y;
      const d = Math.hypot(dx, dy);
      const k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
      this.knob.setPosition(this.origin.x + dx * k, this.origin.y + dy * k);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      this.joyId = null;
      this.vector = { x: 0, y: 0 };
      this.base.setPosition(this.home.x, this.home.y);
      this.knob.setPosition(this.home.x, this.home.y);
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  private roundButton(
    p: Point,
    r: number,
    color: string,
    label: string,
    size: number,
    onPress: () => void,
    alpha = 1,
  ): void {
    const s = this.scene;
    const c = s.add.container(p.x, p.y);
    const shadow = s.add.circle(0, 6, r, hex(theme.colors.ink), 0.5);
    const face = s.add
      .circle(0, 0, r, hex(color), alpha)
      .setStrokeStyle(4, hex(theme.colors.white), 0.8);
    const text = s.add.text(0, 0, label, displayFont(size, theme.colors.ink)).setOrigin(0.5);
    c.add([shadow, face, text]);
    c.setSize(r * 2, r * 2).setInteractive(
      new Phaser.Geom.Circle(r, r, r),
      Phaser.Geom.Circle.Contains,
    );
    c.on('pointerdown', () => {
      c.setScale(0.92);
      onPress();
    });
    const up = () => c.setScale(1);
    c.on('pointerup', up);
    c.on('pointerout', up);
  }
}
