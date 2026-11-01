import Phaser from 'phaser';
import heroesJson from '../data/heroes.json';
import mapJson from '../data/map.json';
import { HeroView } from '../entities/Hero';
import { loadHeroes } from '../systems/data';
import {
  createHeroState,
  directionFromKeys,
  moveHero,
  walkableArea,
  type HeroState,
  type Rect,
} from '../systems/hero';
import { buildMap, cameraZoom, type LaneMap, type MapConfig } from '../systems/map';
import { recordMatch, type MatchResult } from '../systems/gameState';
import { hex, theme } from '../ui/theme';
import { getState, setState } from './shared';

/**
 * The match world (#16): grass, river and lane, both bases with a Nexus and 2 towers each,
 * a camera that follows the player, and the heroes (#17, WASD or arrow keys). The HUD is a separate scene (MatchHudScene) so it
 * stays fixed while the world scrolls and zooms. Units and combat arrive in #17 to #21.
 */
export class MatchScene extends Phaser.Scene {
  map!: LaneMap;
  /** Player hero: rules state (src/systems/hero.ts) and its view. Exposed for browser tests. */
  playerState!: HeroState;
  player!: HeroView;
  botState!: HeroState;
  bot!: HeroView;
  private area!: Rect;
  private keys!: Record<
    'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    Phaser.Input.Keyboard.Key
  >;
  startedAt = 0;

  constructor() {
    super('Match');
  }

  create(): void {
    this.map = buildMap(mapJson as MapConfig);
    this.area = walkableArea(this.map);
    this.startedAt = this.time.now;
    this.drawWorld();
    this.spawnHeroes();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as typeof this.keys;

    const cam = this.cameras.main;
    cam.startFollow(this.player, true, this.map.config.camera.lerp, this.map.config.camera.lerp);
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off('resize', this.fitCamera, this),
    );

    this.scene.launch('MatchHud');
  }

  update(_time: number, deltaMs: number): void {
    const k = this.keys;
    const dir = directionFromKeys({
      up: k.W.isDown || k.UP.isDown,
      down: k.S.isDown || k.DOWN.isDown,
      left: k.A.isDown || k.LEFT.isDown,
      right: k.D.isDown || k.RIGHT.isDown,
    });
    // Cap the step so a long frame (tab switch) cannot teleport the hero.
    this.playerState = moveHero(this.playerState, dir, Math.min(deltaMs, 100) / 1000, this.area);
    this.player.sync(this.playerState);
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
    this.playerState = createHeroState(p, this.map.heroSpawn.blue);
    this.botState = createHeroState(b, this.map.heroSpawn.red);
    this.bot = new HeroView(this, this.botState, b.sprite, 'red');
    this.player = new HeroView(this, this.playerState, p.sprite, 'blue');
  }

  /** Zoom out on narrow (portrait) screens so enough of the lane is visible. */
  private fitCamera(): void {
    const cam = this.cameras.main;
    const { width: W, height: H } = this.map.config.world;
    const zoom = cameraZoom(this.scale.width, this.map.config);
    cam.setZoom(zoom);
    // On tall portrait screens the view is taller than the world: centre the world vertically.
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
    // Lane edges.
    const edge = hex(theme.map.laneDark);
    this.add.rectangle(0, lane.y - lane.thickness / 2, world.width, 8, edge).setOrigin(0, 0.5);
    this.add.rectangle(0, lane.y + lane.thickness / 2, world.width, 8, edge).setOrigin(0, 0.5);

    // Base pads, then Nexus and towers standing on their slots (sprite base on the slot point).
    for (const team of ['blue', 'red'] as const) {
      const nexus = this.map.slots.find((s) => s.kind === 'nexus' && s.team === team)!;
      this.add
        .circle(nexus.x, nexus.y, 250, hex(theme.teams[team].main), 0.16)
        .setStrokeStyle(6, hex(theme.teams[team].main), 0.5);
    }
    for (const s of this.map.slots) {
      const key = `${s.kind}-${s.team}`;
      this.add
        .image(s.x, s.y, key)
        .setOrigin(0.5, s.kind === 'nexus' ? 0.8 : 0.85)
        .setDepth(s.y);
    }
  }

  finish(outcome: MatchResult['outcome']): void {
    const durationSec = (this.time.now - this.startedAt) / 1000;
    setState(this, recordMatch(getState(this), { outcome, durationSec, answered: 0, correct: 0 }));
    this.scene.stop('MatchHud');
    this.scene.start('Result');
  }
}
