import Phaser from 'phaser';
import { totalExpToLevel } from '../systems/economy';
import { formatDuration } from '../systems/gameState';
import { computeHudLayout, type HudLayout, type Rect } from '../systems/hudLayout';
import type { StructureState } from '../systems/structures';
import { safeAreaInGame } from '../systems/touch';
import { skillButtonState, skillInSlot } from '../systems/skills';
import { SkillButton } from '../ui/SkillButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { BackAware } from './nav';
import type { BackAction, Screen } from '../systems/navigation';
import { ShopPanel } from '../ui/ShopPanel';
import { Button } from '../ui/Button';
import { HeroPanel } from '../ui/HeroPanel';
import { Minimap } from '../ui/Minimap';
import { QuestionOverlay } from '../ui/QuestionOverlay';
import { readSafeAreaCss } from '../ui/safeArea';
import { TouchControls } from '../ui/TouchControls';
import { bodyFont, displayFont, hex, textScale, theme, ts } from '../ui/theme';
import { QUESTION_RESOLVED_EVENT, type MatchScene } from './MatchScene';
import type { Resolution } from '../systems/questionSession';
import { fmt } from '../systems/generators/core';
import { getState, responsive, tr } from './shared';

/** Fired on game.events when the player presses attack (touch button or Space) or a skill. */
export const ATTACK_EVENT = 'ml-attack';
/** Fired when the attack button or Space is released (holding attack keeps attacking, #19). */
export const ATTACK_RELEASE_EVENT = 'ml-attack-release';
export const SKILL_EVENT = 'ml-skill';
/** Keyboard keys for skill slots 0-3 (the ultimate is F) (#33). */
export const SKILL_KEYS = ['Q', 'E', 'R', 'F'] as const;
/** Fired on game.events when a player skill cannot be cast: (slot, reason) (#33). */
export const SKILL_FAILED_EVENT = 'ml-skill-failed';

/**
 * Fixed overlay on top of the match world (#25). Top bar: Quit, Nexus health for both teams and
 * the timer. Below it: the hero panel (HP, mana, EXP, level, gold) on the left and the mini-map on
 * the right. On touch devices: joystick and attack/skill buttons (#18). Positions come from
 * computeHudLayout, which a test checks for overlaps on every screen size.
 */
export class MatchHudScene extends Phaser.Scene implements BackAware {
  private confirm: ConfirmDialog | null = null;

  /** Back closes the quit question or the shop first, then asks before quitting (#44). */
  backScreen(): Screen {
    if (this.confirm) return 'matchQuitConfirm';
    if (this.shop?.visible) return 'matchShop';
    return 'match';
  }

  applyBack(a: BackAction): void {
    if (a.kind === 'askQuit') this.askQuit();
    else if (a.kind === 'close') {
      if (this.confirm) this.closeConfirm();
      else this.shop?.close();
    }
  }

  /** "Leave the match? It counts as a loss." The match keeps running behind it. */
  private askQuit(): void {
    if (this.confirm || this.match.ending) return;
    this.shop?.close();
    this.confirm = new ConfirmDialog(
      this,
      tr(this, 'quit.title'),
      tr(this, 'quit.body'),
      tr(this, 'quit.stay'),
      tr(this, 'quit.leave'),
      () => this.closeConfirm(),
      () => {
        this.closeConfirm();
        this.match.forfeit();
      },
    );
  }

  private closeConfirm(): void {
    this.confirm?.destroy();
    this.confirm = null;
  }

  /** Present on touch devices; MatchScene reads its movement vector. */
  touch: TouchControls | null = null;
  private skillButtons: SkillButton[] = [];
  private shop?: ShopPanel;

  private toggleShop(): void {
    if (!this.shop) return;
    if (this.shop.visible) this.shop.close();
    else this.shop.open();
  }
  layoutInfo?: HudLayout;
  private timerText?: Phaser.GameObjects.Text;
  private suddenDeathShown = false;

  /** A short banner across the middle of the screen (sudden death, #37). */
  private showBanner(text: string): void {
    const { width: w, height: h } = this.scale;
    const t = this.add
      .text(w / 2, h * 0.38, text, bodyFont(36, theme.colors.white, '800'))
      .setOrigin(0.5)
      .setPadding(28, 14, 28, 14)
      .setBackgroundColor(theme.colors.wrong)
      .setWordWrapWidth(w - 80, true)
      .setAlign('center')
      .setDepth(250);
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 2600,
      duration: 500,
      onComplete: () => t.destroy(),
    });
  }
  private nexusBars?: Phaser.GameObjects.Graphics;
  private respawnText?: Phaser.GameObjects.Text;
  private panel?: HeroPanel;
  private minimap?: Minimap;
  private question?: QuestionOverlay;
  private feedback?: Phaser.GameObjects.Text;

  constructor() {
    super('MatchHud');
  }

  private get match(): MatchScene {
    return this.scene.get('Match') as MatchScene;
  }

  create(): void {
    this.suddenDeathShown = false;
    this.input.keyboard?.on('keydown-SPACE', () => this.game.events.emit(ATTACK_EVENT));
    this.input.keyboard?.on('keyup-SPACE', () => this.game.events.emit(ATTACK_RELEASE_EVENT));
    this.input.keyboard?.on('keydown-B', () => this.toggleShop());
    responsive(this, () => this.layout());
    const onFailed = (slot: number) => this.skillButtons[slot]?.nudge();
    this.game.events.on(SKILL_FAILED_EVENT, onFailed);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(SKILL_FAILED_EVENT, onFailed),
    );
    const onResolved = (r: Resolution) => this.showFeedback(r);
    this.game.events.on(QUESTION_RESOLVED_EVENT, onResolved);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(QUESTION_RESOLVED_EVENT, onResolved),
    );
  }

  /**
   * Short "Correct! x1.5" / "Not quite x0.5" / "Time's up x0.5" note on the card's top edge, while
   * the card itself marks the right answer (#29).
   */
  private showFeedback(r: Resolution): void {
    const f = this.feedback;
    const l = this.layoutInfo;
    if (!f || !l || r.outcome === 'skipped') return;
    const lang = getState(this).lang;
    const key =
      r.outcome === 'correct' ? 'q.correct' : r.outcome === 'wrong' ? 'q.wrong' : 'q.timeout';
    const x = fmt(Math.round(r.multiplier * 100) / 100, lang);
    const color = r.outcome === 'correct' ? theme.colors.correct : theme.colors.wrong;
    this.tweens.killTweensOf(f);
    f.setText(tr(this, key, { x }))
      .setColor(theme.colors.white)
      .setBackgroundColor(color)
      .setPosition(l.questionCard.x + l.questionCard.w / 2, l.questionCard.y)
      .setAlpha(1)
      .setScale(1)
      .setVisible(true);
    this.tweens.add({
      targets: f,
      alpha: 0,
      scale: 1.15,
      delay: 700,
      duration: 350,
      onComplete: () => f.setVisible(false),
    });
  }

  update(): void {
    const m = this.match;
    if (!m.state || !this.layoutInfo) return;
    const s = m.state;
    this.timerText?.setText(formatDuration(s.now));
    // Sudden death (#37): the timer turns red and a banner says so once.
    const sd = m.cfg.structures.suddenDeath;
    const inSd = sd.enabled && s.now >= sd.afterSec;
    this.timerText?.setColor(inSd ? theme.colors.wrong : theme.colors.white);
    if (inSd && !this.suddenDeathShown) {
      this.suddenDeathShown = true;
      this.showBanner(tr(this, 'hud.suddenDeath'));
    }
    this.panel?.update(s.player, s.playerProgress);
    this.shop?.sync({ gold: s.playerProgress.gold, inventory: s.playerItems });
    // Skill buttons: cooldown sweep, seconds, mana and lock state (#33).
    const def = m.cfg.playerHero;
    this.skillButtons.forEach((b, slot) => {
      const st = skillButtonState(
        s.player,
        skillInSlot(def.skills, slot, m.cfg.skills),
        slot,
        s.now,
      );
      b.update(st, tr(this, 'skill.locked', { n: st.unlockLevel }));
    });
    this.minimap?.update(s, m.cameras.main.worldView);
    this.drawNexusBars(s.structures);
    this.question?.sync(
      m.session?.active ?? null,
      m.session?.reveal ?? null,
      s.now,
      getState(this).lang,
    );
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
    // A rebuild (resize, language) clears the screen, the quit question included.
    this.confirm = null;
    const l = computeHudLayout(w, h, safe, touch, textScale());
    this.layoutInfo = l;
    const c = theme.colors;

    this.add.rectangle(w / 2, l.topBar.h / 2, w, l.topBar.h, hex(c.night), 0.85);
    new Button(
      this,
      l.quit.x + l.quit.w / 2,
      l.quit.y + l.quit.h / 2,
      tr(this, 'match.quit'),
      () => this.askQuit(),
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

    this.question?.destroy();
    this.question = new QuestionOverlay(this, l.questionCard, (slot) =>
      this.match.answerSlot(slot),
    );
    this.feedback = this.add
      .text(0, 0, '', bodyFont(ts(34), c.white, '800'))
      .setOrigin(0.5)
      .setPadding(24, 12, 24, 12)
      .setDepth(200)
      .setVisible(false);

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
    // Shop (#35): top-bar button, or B; Esc closes. The match keeps running.
    new Button(
      this,
      l.shopButton.x + l.shopButton.w / 2,
      l.shopButton.y + l.shopButton.h / 2,
      tr(this, 'hud.shop'),
      () => this.toggleShop(),
      { width: l.shopButton.w, height: l.shopButton.h - 8, fontSize: 24 },
    );
    const wasOpen = this.shop?.visible ?? false;
    this.shop = new ShopPanel(
      this,
      l.shopPanel,
      m.cfg.items,
      m.cfg.econ,
      getState(this).lang,
      (id) => this.match.buyItem(id),
      (slot) => this.match.sellSlot(slot),
      () => this.shop?.close(),
    );
    if (wasOpen) this.shop.open();

    // Keyboard players: the Q E R F skill bar (#33).
    this.skillButtons =
      this.touch?.skills ??
      (l.skillBar ?? []).map(
        (r, i) =>
          new SkillButton(
            this,
            { x: r.x + r.w / 2, y: r.y + r.h / 2 },
            r.w / 2,
            'square',
            SKILL_KEYS[i] ?? '',
            i === 3,
            () => this.game.events.emit(SKILL_EVENT, i),
          ),
      );
    this.update();
  }
}
