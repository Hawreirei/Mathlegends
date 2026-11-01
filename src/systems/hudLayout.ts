/**
 * Where every HUD element goes (#25). Pure maths, no Phaser, so a test can check every
 * screen size: all elements on screen, clear of notches, and never overlapping each other
 * or the touch controls.
 *
 * Top bar: Quit (left), Nexus health blue | timer | red (centre). Below it: hero panel
 * (left) and mini-map (right). Touch controls own the bottom corners.
 */
import type { Point } from './map';
import { skillButtonPositions, type Insets } from './touch';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TouchLayout {
  joystick: Point;
  joystickRadius: number;
  attack: Point;
  attackRadius: number;
  skills: Point[];
  skillRadius: number;
}

export interface HudLayout {
  topBar: Rect;
  quit: Rect;
  timer: Rect;
  nexusBlue: Rect;
  nexusRed: Rect;
  heroPanel: Rect;
  minimap: Rect;
  /** Centre of the "respawning in N" message. */
  respawn: Point;
  /** Base font size for HUD text, in game pixels. */
  fontSize: number;
  touch: TouchLayout | null;
}

const BAR_H = 80;
const PAD = 16;
const JOY_RADIUS = 110;
const ATTACK_RADIUS = 88;
const SKILL_RADIUS = 52;
const SKILL_DISTANCE = 180;
const TOUCH_MARGIN = 40;

export function computeHudLayout(w: number, h: number, safe: Insets, touch: boolean): HudLayout {
  const portrait = h > w;
  const left = safe.left + PAD;
  const right = w - safe.right - PAD;
  const top = safe.top;
  const barY = top + BAR_H / 2;

  const quit = { x: left, y: barY - 28, w: 140, h: 56 };
  const timer = { x: w / 2 - 55, y: barY - 24, w: 110, h: 48 };
  // Nexus bars sit either side of the timer, as long as the space between Quit and the timer allows.
  const nexusW = Math.max(90, Math.min(190, timer.x - (quit.x + quit.w) - 2 * PAD));
  // Each box includes the Nexus diamond (24 px tall) at its outer end, so the overlap test covers it.
  const nexusBlue = { x: timer.x - PAD - nexusW, y: barY - 13, w: nexusW, h: 26 };
  const nexusRed = { x: timer.x + timer.w + PAD, y: barY - 13, w: nexusW, h: 26 };

  const panelY = top + BAR_H + 14;
  const panelW = portrait ? 330 : 360;
  const heroPanel = { x: left, y: panelY, w: panelW, h: 124 };
  const mmW = Math.min(portrait ? right - (left + panelW) - PAD : 380, 380);
  const minimap = { x: right - mmW, y: panelY, w: mmW, h: Math.round(mmW * 0.34) };

  let touchLayout: TouchLayout | null = null;
  if (touch) {
    const joystick = {
      x: safe.left + TOUCH_MARGIN + JOY_RADIUS,
      y: h - safe.bottom - TOUCH_MARGIN - JOY_RADIUS,
    };
    const attack = {
      x: w - safe.right - TOUCH_MARGIN - ATTACK_RADIUS,
      y: h - safe.bottom - TOUCH_MARGIN - ATTACK_RADIUS,
    };
    touchLayout = {
      joystick,
      joystickRadius: JOY_RADIUS,
      attack,
      attackRadius: ATTACK_RADIUS,
      skills: skillButtonPositions(attack, SKILL_DISTANCE),
      skillRadius: SKILL_RADIUS,
    };
  }

  return {
    topBar: { x: 0, y: 0, w, h: top + BAR_H },
    quit,
    timer,
    nexusBlue,
    nexusRed,
    heroPanel,
    minimap,
    respawn: { x: w / 2, y: portrait ? h * 0.42 : h * 0.5 },
    fontSize: 26,
    touch: touchLayout,
  };
}

/** World position to a point inside the mini-map rectangle. */
export function worldToMinimap(p: Point, world: { width: number; height: number }, r: Rect): Point {
  return { x: r.x + (p.x / world.width) * r.w, y: r.y + (p.y / world.height) * r.h };
}
