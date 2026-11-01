import Phaser from 'phaser';
import { totalExpToLevel } from '../systems/economy';
import { formatDuration } from '../systems/gameState';
import { computeHudLayout, type HudLayout, type Rect } from '../systems/hudLayout';
import type { StructureState } from '../systems/structures';
import { safeAreaInGame } from '../systems/touch';
import { Button } from '../ui/Button';
import { HeroPanel } from '../ui/HeroPanel';
import { Minimap } from '../ui/Minimap';
import { readSafeAreaCss } from '../ui/safeArea';
import { TouchControls } from '../ui/TouchControls';
import { bodyFont, displayFont, hex, theme } from '../ui/theme';
import type { MatchScene } from './MatchScene';
import { responsive, tr } from './shared';

/** Fired on game.events when the player presses attack (touch button or Space) or a skill. */
export const ATTACK_EVENT = 'ml-attack';
/** Fired when the attack button or Space is released (holding attack keeps attacking, #19). */
export const ATTACK_RELEASE_EVENT = 'ml-attack-release';
export const SKILL_EVENT = 'ml-skill';

/**
 * Fixed overlay on top of the match world (#25). Top bar: Quit, Nexus health for both teams and
 * the timer. Below it: the hero panel (HP, mana, EXP, level, gold) on the left and the mini-map on
 * the right. On touch devices: joystick and attack/skill buttons (#18). Positions come from
 * computeHudLayout, which a test checks for overlaps on every screen size.
 */
export class MatchHudScene extends Phaser.Scene {
  /** Present on touch devices; MatchScene reads its movement vector. */
  touch: TouchControls | null = null;
  layoutInfo?: HudLayout;
  private timerText?: Phaser.GameObjects.Text;
  private nexusBars?: Phaser.GameObjects.Graphics;
  private respawnText?: Phaser.GameObjects.Text;
  private panel?: HeroPanel;
  private minimap?: Minimap;

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
    const m = this.match;
    if (!m.state || !this.layoutInfo) return;
    const s = m.state;
    this.timerText?.setText(formatDuration(s.now));
    this.panel?.update(s.player, s.playerProgress);
    this.minimap?.update(s, m.cameras.main.worldView);
    this.drawNexusBars(s.structures);
    const p = s.player;
    const show = !p.alive && p.respawnAt !== null;
    this.respawnText?.setVisible(show);
    if (show)
      this.respawnText?.setText(
        tr(this, 'hud.respawn', { n: Math.max(1, Math.ceil((p.respawnAt ?? 0) - s.now)) }),
      );
  }

  private drawNexusBars(structures: StructureState[]): void {
    const l = this.layoutInfo;
    const g = this.nexusBars;
    if (!l || !g) return;
    g.clear();
    const draw = (r: Rect, team: 'blue' | 'red') => {
      const n = structures.find((x) => x.kind === 'nexus' && x.team === team);
      const frac = n ? n.hp / n.maxHp : 0;
      // The Nexus diamond sits inside the box at the outer end; the bar fills the rest.
      const D = 24;
      const bx = team === 'blue' ? r.x + D : r.x;
      const bw = r.w - D;
      g.fillStyle(hex(theme.colors.ink), 1).fillRoundedRect(bx, r.y, bw, r.h, r.h / 2);
      const fw = Math.max(0, Math.min(1, frac)) * (bw - 6);
      // Blue drains towards the timer from the outer end; red mirrors it.
      const fx = team === 'blue' ? bx + 3 + (bw - 6 - fw) : bx + 3;
      if (fw > 0)
        g.fillStyle(hex(theme.teams[team].main), 1).fillRoundedRect(
          fx,
          r.y + 3,
          fw,
          r.h - 6,
          (r.h - 6) / 2,
        );
      const dx = team === 'blue' ? r.x + 9 : r.x + r.w - 9;
      const dy = r.y + r.h / 2;
      g.fillStyle(hex(theme.teams[team].main), 1).fillTriangle(
        dx,
        dy - 12,
        dx + 9,
        dy,
        dx,
        dy + 12,
      );
      g.fillTriangle(dx, dy - 12, dx - 9, dy, dx, dy + 12);
    };
    draw(l.nexusBlue, 'blue');
    draw(l.nexusRed, 'red');
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const cssW = this.game.canvas.getBoundingClientRect().width || w;
    const safe = safeAreaInGame(readSafeAreaCss(), w / cssW);
    const touch = this.sys.game.device.input.touch;
    const l = computeHudLayout(w, h, safe, touch);
    this.layoutInfo = l;
    const c = theme.colors;

    this.add.rectangle(w / 2, l.topBar.h / 2, w, l.topBar.h, hex(c.night), 0.85);
    new Button(
      this,
      l.quit.x + l.quit.w / 2,
      l.quit.y + l.quit.h / 2,
      tr(this, 'match.quit'),
      () => {
        this.scene.stop('Match');
        this.scene.start('Menu');
      },
      { width: l.quit.w, height: l.quit.h - 8, style: 'secondary', fontSize: 24 },
    );
    this.timerText = this.add
      .text(l.timer.x + l.timer.w / 2, l.timer.y + l.timer.h / 2, '0:00', displayFont(36))
      .setOrigin(0.5);
    this.nexusBars = this.add.graphics();

    const m = this.match;
    const econ = m.cfg.econ;
    this.panel = new HeroPanel(this, l.heroPanel, m.cfg.playerHero.sprite, (level) => ({
      from: totalExpToLevel(econ, level),
      to:
        level >= econ.exp.levelCap
          ? totalExpToLevel(econ, level)
          : totalExpToLevel(econ, level + 1),
    }));
    this.minimap = new Minimap(this, l.minimap, m.cfg.map);

    this.respawnText = this.add
      .text(l.respawn.x, l.respawn.y, '', bodyFont(40, c.white, '800'))
      .setOrigin(0.5)
      .setStroke(c.ink, 8)
      .setVisible(false);

    this.touch = l.touch
      ? new TouchControls(
          this,
          l.touch,
          l.topBar.h,
          () => this.game.events.emit(ATTACK_EVENT),
          () => this.game.events.emit(ATTACK_RELEASE_EVENT),
          (i) => this.game.events.emit(SKILL_EVENT, i),
        )
      : null;
    this.update();
  }
}
