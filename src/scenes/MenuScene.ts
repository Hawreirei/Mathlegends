import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { safeAreaInGame } from '../systems/touch';
import { LangToggle } from '../ui/LangToggle';
import { RankBadge } from '../ui/RankBadge';
import heroesJson from '../data/heroes.json';

/** The player hero's sprite (heroes.json playerHero). */
const playerSprite = () =>
  (heroesJson.heroes.find((h) => h.id === heroesJson.playerHero) ?? heroesJson.heroes[0]!).sprite;
import { readSafeAreaCss } from '../ui/safeArea';
import { bodyFont, displayFont, hex, theme } from '../ui/theme';
import { changeLang, getState, responsive, tr } from './shared';
import { enter, goTo, type BackAware } from './nav';
import type { Screen } from '../systems/navigation';

export class MenuScene extends Phaser.Scene implements BackAware {
  constructor() {
    super('Menu');
  }

  /** Back on the Menu leaves the game (#44). */
  backScreen(): Screen {
    return 'menu';
  }

  applyBack(): void {}

  create(): void {
    enter(this, true);
    responsive(this, () => this.layout());
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const portrait = h > w;
    const s = getState(this);
    const c = theme.colors;
    this.cameras.main.setBackgroundColor(hex(c.ink));

    // Soft background orbs from the prototype.
    this.add.circle(w * 0.85, h * 0.2, Math.min(w, h) * 0.35, hex(c.violet), 0.18);
    this.add.circle(w * 0.1, h * 0.95, Math.min(w, h) * 0.3, hex(theme.teams.blue.main), 0.12);

    // Language switch, top-right (#23).
    const cssW = this.game.canvas.getBoundingClientRect().width || w;
    const safe = safeAreaInGame(readSafeAreaCss(), w / cssW);
    new LangToggle(this, w - safe.right - 120, safe.top + 64, s.lang, (lang) =>
      changeLang(this, lang),
    );
    // Portrait: one centred column. Landscape: hero on the left, title and buttons on the right.
    const heroX = portrait ? w / 2 : w * 0.3;
    const heroY = portrait ? h * 0.25 : h * 0.5;
    const cx = portrait ? w / 2 : w * 0.64;
    const colW = portrait ? w * 0.9 : w * 0.6;
    this.add.circle(heroX, heroY, portrait ? 130 : 170, hex(c.violet), 0.25);
    this.add.image(heroX, heroY, playerSprite()).setScale(portrait ? 2 : 2.6);

    const titleY = portrait ? h * 0.45 : h * 0.3;
    this.title(cx, titleY, colW, 110);
    this.add
      .text(cx, titleY + 80, tr(this, 'menu.tagline'), bodyFont(portrait ? 30 : 28, c.paper))
      .setOrigin(0.5)
      .setWordWrapWidth(colW, true)
      .setAlign('center');

    const playY = portrait ? h * 0.64 : h * 0.6;
    new Button(this, cx, playY, `${tr(this, 'menu.play')}  ➜`, () => goTo(this, 'Match'), {
      width: 360,
      height: 96,
      fontSize: 40,
    });

    // Settings (#30): the answer data export; accessibility options come in #31.
    new Button(
      this,
      cx,
      playY + (portrait ? 120 : 110),
      tr(this, 'menu.settings'),
      () => goTo(this, 'Settings'),
      { width: 300, height: 72, fontSize: 28, style: 'secondary' },
    );

    // Which version this is (#52), small in the bottom-left corner.
    this.add
      .text(
        safe.left + 16,
        h - safe.bottom - 12,
        tr(this, 'menu.version', { version: __APP_VERSION__ }),
        bodyFont(18, c.paper, '600'),
      )
      .setOrigin(0, 1)
      .setAlpha(0.6);

    // Rank badge with star icons (#42).
    const rankY = portrait ? h - 120 : h * 0.9;
    new RankBadge(this, cx, rankY, {
      tier: s.profile.tier,
      stars: s.profile.stars,
      lang: s.lang,
      size: 'small',
    });
  }

  /** "MATH" white + "LEGENDS" gold, centred on x and shrunk to fit maxWidth. */
  private title(x: number, y: number, maxWidth: number, size: number): void {
    const a = this.add.text(0, y, 'MATH', displayFont(size)).setOrigin(0, 0.5);
    const b = this.add
      .text(0, y, 'LEGENDS', displayFont(size, theme.colors.gold))
      .setOrigin(0, 0.5);
    const scale = Math.min(1, maxWidth / (a.width + b.width));
    a.setScale(scale);
    b.setScale(scale);
    const left = x - ((a.width + b.width) * scale) / 2;
    a.setX(left);
    b.setX(left + a.width * scale);
  }
}
