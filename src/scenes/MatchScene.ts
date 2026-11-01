import Phaser from 'phaser';
import economyJson from '../data/economy.json';
import heroesJson from '../data/heroes.json';
import mapJson from '../data/map.json';
import { damageNumber, HeroView, slash } from '../entities/Hero';
import {
  ATTACK_BUFFER_SEC,
  canAttack,
  nearestEnemyInRange,
  regenerate,
  resolveAttack,
  tickRespawn,
} from '../systems/combat';
import { loadHeroes } from '../systems/data';
import { validateEconomy, type EconomyConfig } from '../systems/economy';
import { recordMatch, type MatchResult } from '../systems/gameState';
import {
  createHeroState,
  directionFromKeys,
  moveHero,
  walkableArea,
  type HeroState,
  type Rect,
} from '../systems/hero';
import { buildMap, cameraZoom, type LaneMap, type MapConfig } from '../systems/map';
import { hex, theme } from '../ui/theme';
import { ATTACK_EVENT, ATTACK_RELEASE_EVENT, type MatchHudScene } from './MatchHudScene';
import { getState, setState } from './shared';

type Keys = Record<
  'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
  Phaser.Input.Keyboard.Key
>;

/**
 * The match world: lane, bases, Nexus and towers (#16), heroes and movement (#17), and
 * basic combat (#19): attack auto-targets the nearest enemy in range, damage follows
 * economy.json, dead heroes respawn at their base after a level-based timer.
 * The HUD is a separate scene (MatchHudScene) that stays fixed while the world scrolls.
 */
export class MatchScene extends Phaser.Scene {
  map!: LaneMap;
  economy!: EconomyConfig;
  /** Rules state and views; exposed for browser tests. */
  playerState!: HeroState;
  player!: HeroView;
  botState!: HeroState;
  bot!: HeroView;
  startedAt = 0;
  /** Attack presses so far (touch button or Space). */
  attackPresses = 0;
  private attackHeld = false;
  private lastAttackPress = -Infinity;
  private area!: Rect;
  private keys!: Keys;

  constructor() {
    super('Match');
  }

  /** Match time in seconds. */
  get now(): number {
    return (this.time.now - this.startedAt) / 1000;
  }

  create(): void {
    this.economy = economyJson as EconomyConfig;
    const problems = validateEconomy(this.economy);
    if (problems.length) throw new Error(`Invalid economy.json:\n${problems.join('\n')}`);
    this.map = buildMap(mapJson as MapConfig);
    this.area = walkableArea(this.map);
    this.startedAt = this.time.now;
    this.attackHeld = false;
    this.lastAttackPress = -Infinity;
    this.attackPresses = 0;
    this.drawWorld();
    this.spawnHeroes();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Keys;

    const cam = this.cameras.main;
    cam.startFollow(this.player, true, this.map.config.camera.lerp, this.map.config.camera.lerp);
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);

    const press = () => {
      this.attackPresses++;
      this.attackHeld = true;
      this.lastAttackPress = this.now;
    };
    const release = () => {
      this.attackHeld = false;
    };
    this.game.events.on(ATTACK_EVENT, press);
    this.game.events.on(ATTACK_RELEASE_EVENT, release);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.fitCamera, this);
      this.game.events.off(ATTACK_EVENT, press);
      this.game.events.off(ATTACK_RELEASE_EVENT, release);
    });

    this.scene.launch('MatchHud');
  }

  update(_time: number, deltaMs: number): void {
    // Cap the step so a long frame (tab switch) cannot teleport anyone.
    const dt = Math.min(deltaMs, 100) / 1000;
    const now = this.now;

    if (this.playerState.alive) {
      const k = this.keys;
      let dir = directionFromKeys({
        up: k.W.isDown || k.UP.isDown,
        down: k.S.isDown || k.DOWN.isDown,
        left: k.A.isDown || k.LEFT.isDown,
        right: k.D.isDown || k.RIGHT.isDown,
      });
      // The touch joystick wins when it is being used (analogue: partial tilt = slower walk).
      const stick = (this.scene.get('MatchHud') as MatchHudScene).touch?.vector;
      if (stick && (stick.x !== 0 || stick.y !== 0)) dir = stick;
      this.playerState = moveHero(this.playerState, dir, dt, this.area);
      this.playerAttack(now);
    }

    this.playerState = tickRespawn(regenerate(this.playerState, dt), now, this.map.heroSpawn.blue);
    this.botState = tickRespawn(regenerate(this.botState, dt), now, this.map.heroSpawn.red);
    this.player.sync(this.playerState, now);
    this.bot.sync(this.botState, now);
  }

  /** Attack the nearest enemy in range while attack is held, or shortly after a press. */
  private playerAttack(now: number): void {
    const wants = this.attackHeld || now - this.lastAttackPress <= ATTACK_BUFFER_SEC;
    if (!wants || !canAttack(this.playerState, now)) return;
    const target = nearestEnemyInRange(this.playerState, [this.botState]);
    if (!target) return;
    const r = resolveAttack(this.playerState, target, now, this.economy);
    this.playerState = r.attacker;
    this.botState = r.target;
    this.lastAttackPress = -Infinity;
    slash(this, this.playerState, target, theme.colors.gold);
    this.bot.flash();
    damageNumber(this, target, r.damage);
  }

  private spawnHeroes(): void {
    const data = loadHeroes(heroesJson);
    const find = (id: string | undefined, role: string) => {
      const h = data.heroes.find((x) => x.id === id);
      if (!h) throw new Error(`heroes.json must set ${role} to an existing hero`);
      return h;
    };
    const p = find(data.playerHero, 'playerHero');
    const b = find(data.botHero, 'botHero');
    this.playerState = createHeroState(p, this.map.heroSpawn.blue, 'blue');
    this.botState = createHeroState(b, this.map.heroSpawn.red, 'red');
    this.bot = new HeroView(this, this.botState, b.sprite, 'red', this.map.heroSpawn.red);
    this.player = new HeroView(this, this.playerState, p.sprite, 'blue', this.map.heroSpawn.blue);
  }

  /** Zoom out on narrow (portrait) screens and centre the world vertically when the view is taller. */
  private fitCamera(): void {
    const cam = this.cameras.main;
    const { width: W, height: H } = this.map.config.world;
    const zoom = cameraZoom(this.scale.width, this.map.config);
    cam.setZoom(zoom);
    const viewH = this.scale.height / zoom;
    if (viewH > H) cam.setBounds(0, (H - viewH) / 2, W, viewH);
    else cam.setBounds(0, 0, W, H);
  }

  private drawWorld(): void {
    const { world, lane, river } = this.map.config;
    this.cameras.main.setBackgroundColor(hex(theme.map.grass));
    // Grass extends past the world so tall portrait views never show an empty edge.
    this.add.tileSprite(0, -world.height, world.width, world.height * 3, 'tile-grass').setOrigin(0);
    this.add
      .tileSprite(0, river.y - river.thickness / 2, world.width, river.thickness, 'tile-water')
      .setOrigin(0);
    this.add
      .tileSprite(0, lane.y - lane.thickness / 2, world.width, lane.thickness, 'tile-lane')
      .setOrigin(0);
    const edge = hex(theme.map.laneDark);
    this.add.rectangle(0, lane.y - lane.thickness / 2, world.width, 8, edge).setOrigin(0, 0.5);
    this.add.rectangle(0, lane.y + lane.thickness / 2, world.width, 8, edge).setOrigin(0, 0.5);

    for (const team of ['blue', 'red'] as const) {
      const nexus = this.map.slots.find((s) => s.kind === 'nexus' && s.team === team)!;
      this.add
        .circle(nexus.x, nexus.y, 250, hex(theme.teams[team].main), 0.16)
        .setStrokeStyle(6, hex(theme.teams[team].main), 0.5);
    }
    for (const s of this.map.slots) {
      this.add
        .image(s.x, s.y, `${s.kind}-${s.team}`)
        .setOrigin(0.5, s.kind === 'nexus' ? 0.8 : 0.85)
        .setDepth(s.y);
    }
  }

  finish(outcome: MatchResult['outcome']): void {
    setState(
      this,
      recordMatch(getState(this), { outcome, durationSec: this.now, answered: 0, correct: 0 }),
    );
    this.scene.stop('MatchHud');
    this.scene.start('Result');
  }
}
