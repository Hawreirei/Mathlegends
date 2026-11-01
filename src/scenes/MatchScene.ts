import Phaser from 'phaser';
import economyJson from '../data/economy.json';
import heroesJson from '../data/heroes.json';
import mapJson from '../data/map.json';
import minionsJson from '../data/minions.json';
import structuresJson from '../data/structures.json';
import { damageNumber, goldPopup, HeroView, levelUpBurst, slash } from '../entities/Hero';
import { MinionView, shot } from '../entities/Minion';
import { StructureView, towerShot } from '../entities/Structure';
import {
  ATTACK_BUFFER_SEC,
  canAttack,
  nearestEnemyInRange,
  regenerate,
  resolveAttack,
  tickRespawn,
} from '../systems/combat';
import {
  loadHeroes,
  loadMinions,
  type Hero,
  loadStructures,
  type MinionsFile,
  type StructuresFile,
} from '../systems/data';
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
import { buildMap, cameraZoom, type LaneMap, type MapConfig, type Point } from '../systems/map';
import {
  spawnWave,
  stepMinions,
  wavesDue,
  type AttackEvent,
  type MinionState,
} from '../systems/minions';
import {
  createStructures,
  isTargetable,
  stepTowers,
  winner,
  type StructureState,
} from '../systems/structures';
import { hex, theme } from '../ui/theme';
import { ATTACK_EVENT, ATTACK_RELEASE_EVENT, type MatchHudScene } from './MatchHudScene';
import {
  addExp,
  addGold,
  applyLevel,
  createProgress,
  killRewards,
  tickPassiveGold,
  type Progress,
  type Victim,
} from '../systems/progression';
import { getState, setState, tr } from './shared';

/** Fired on game.events when the player's hit kills a minion: (kind, minionId). The question overlay (#27) listens. */
export const LAST_HIT_EVENT = 'ml-last-hit';

/** Delay between a Nexus falling and the Result screen, so the collapse can be seen. */
const END_DELAY_MS = 1500;

type Keys = Record<
  'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
  Phaser.Input.Keyboard.Key
>;
type Unit = HeroState | MinionState | StructureState;

/**
 * The match world. Lane, bases and camera (#16); heroes and movement (#17); combat (#19):
 * attack auto-targets the nearest enemy in range and dead heroes respawn at their base;
 * minion waves (#20); towers and Nexus (#21): towers shoot minions first, structures are
 * protected until the ones in front fall, and destroying the enemy Nexus wins.
 * All rules are in src/systems/; this scene wires them together and draws the result.
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
  minions: MinionState[] = [];
  structures: StructureState[] = [];
  /** Player last hits on minions, by type (for #22 gold and #27 questions). */
  lastHits = { infantry: 0, lancer: 0, cannon: 0 };
  /** Gold, EXP and level for each hero (#22). */
  playerProgress!: Progress;
  botProgress!: Progress;
  private playerDef!: Hero;
  private botDef!: Hero;
  /** Set once a Nexus falls; the match ends shortly after. */
  ending = false;
  startedAt = 0;
  /** Attack presses so far (touch button or Space). */
  attackPresses = 0;
  private minionViews = new Map<string, MinionView>();
  private structureViews = new Map<string, StructureView>();
  private minionCfg!: MinionsFile;
  private structureCfg!: StructuresFile;
  private dangerRing!: Phaser.GameObjects.Graphics;
  private prevNow = 0;
  private attackHeld = false;
  private lastAttackPress = -Infinity;
  private area!: Rect;
  private keys!: Keys;

  constructor() {
    super('Match');
  }

  /** Match time in seconds. */
  get now(): number {
    return (this.game.loop.time - this.startedAt) / 1000;
  }

  create(): void {
    this.economy = economyJson as EconomyConfig;
    const problems = validateEconomy(this.economy);
    if (problems.length) throw new Error(`Invalid economy.json:\n${problems.join('\n')}`);
    this.map = buildMap(mapJson as MapConfig);
    this.minionCfg = loadMinions(minionsJson);
    this.structureCfg = loadStructures(structuresJson);
    this.area = walkableArea(this.map);

    this.minions = [];
    this.minionViews = new Map();
    this.structures = createStructures(this.map, this.structureCfg);
    this.structureViews = new Map();
    this.lastHits = { infantry: 0, lancer: 0, cannon: 0 };
    this.playerProgress = createProgress(this.economy);
    this.botProgress = createProgress(this.economy);
    this.ending = false;
    this.prevNow = 0;
    // game.loop.time, not this.time.now: a newly started scene's clock is stale in create(),
    // which made the match clock include the time spent on the menu (#22).
    this.startedAt = this.game.loop.time;
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

    if (this.playerState.alive && !this.ending) {
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

    this.spawnDueWaves(now);
    this.stepUnits(dt, now);

    this.playerProgress = tickPassiveGold(this.playerProgress, dt, this.economy);
    this.botProgress = tickPassiveGold(this.botProgress, dt, this.economy);
    this.playerState = tickRespawn(regenerate(this.playerState, dt), now, this.map.heroSpawn.blue);
    this.botState = tickRespawn(regenerate(this.botState, dt), now, this.map.heroSpawn.red);

    this.player.sync(this.playerState, now);
    this.bot.sync(this.botState, now);
    for (const m of this.minions) this.minionViews.get(m.id)?.sync(m);
    for (const s of this.structures)
      this.structureViews.get(s.id)?.sync(s, isTargetable(s, this.structures));
    this.drawDangerRing();
    this.checkWin();
    this.prevNow = now;
  }

  private spawnDueWaves(now: number): void {
    for (const n of wavesDue(this.prevNow, now, this.economy)) {
      for (const team of ['blue', 'red'] as const) {
        for (const m of spawnWave(n, team, this.map, this.economy, this.minionCfg, `w${n}`)) {
          this.minions.push(m);
          this.minionViews.set(m.id, new MinionView(this, m));
        }
      }
    }
  }

  /** Minions move and fight (including structures), then towers shoot. */
  private stepUnits(dt: number, now: number): void {
    const before = new Map<string, Unit>([
      ...this.minions.map((m) => [m.id, m] as const),
      ...this.structures.map((s) => [s.id, s] as const),
      [this.playerState.id, this.playerState],
      [this.botState.id, this.botState],
    ]);

    const m = stepMinions(
      this.minions,
      [this.playerState, this.botState],
      dt,
      now,
      this.economy,
      this.map,
      this.structures,
    );
    this.minions = m.minions;
    this.structures = m.structures;
    [this.playerState, this.botState] = m.heroes as [HeroState, HeroState];
    for (const e of m.events) {
      const attacker = before.get(e.attackerId) as MinionState | undefined;
      const target = before.get(e.targetId);
      if (attacker && target && attacker.kind !== 'infantry')
        shot(this, attacker, target, theme.teams[attacker.team].main, attacker.kind === 'cannon');
      this.showHit(e);
      if (e.killed && target) this.onKill(target, e.attackerId);
    }

    const t = stepTowers(
      this.structures,
      this.minions,
      [this.playerState, this.botState],
      now,
      this.economy,
    );
    this.structures = t.structures;
    this.minions = t.minions;
    [this.playerState, this.botState] = t.heroes as [HeroState, HeroState];
    for (const e of t.events) {
      const tower = this.structures.find((s) => s.id === e.attackerId)!;
      const target = before.get(e.targetId);
      if (target) towerShot(this, tower, target, theme.teams[tower.team].main);
      this.showHit(e);
      if (e.killed && target) this.onKill(target, e.attackerId);
    }
  }

  /** What kind of thing died, for killRewards. */
  private victimOf(u: Unit): Victim {
    if ('heroId' in u) return { kind: 'hero', team: u.team, x: u.x, y: u.y };
    if (u.kind === 'tower' || u.kind === 'nexus')
      return { kind: u.kind, team: u.team, x: u.x, y: u.y };
    return { kind: 'minion', minionKind: u.kind, team: u.team, x: u.x, y: u.y };
  }

  /**
   * Hands out gold and EXP for a death (rules in src/systems/progression.ts) and levels heroes up.
   * Last hits use multiplier 1 for now; the question result replaces it in #28.
   */
  private onKill(victim: Unit, killerId: string): void {
    const v = this.victimOf(victim);
    const rewards = killRewards(v, killerId, [this.playerState, this.botState], this.economy);
    for (const r of rewards) {
      const isPlayer = r.heroId === this.playerState.id;
      let progress = isPlayer ? this.playerProgress : this.botProgress;
      if (r.gold > 0)
        progress = addGold(progress, r.gold, r.source === 'shareExp' ? 'lastHit' : r.source);
      const x = addExp(progress, r.exp, this.economy);
      progress = x.progress;
      if (isPlayer) {
        this.playerProgress = progress;
        if (r.gold > 0) goldPopup(this, v, r.gold);
        if (x.levelsGained > 0) {
          this.playerState = applyLevel(this.playerState, this.playerDef, progress.level);
          levelUpBurst(this, this.playerState, tr(this, 'fx.levelUp'));
        }
      } else {
        this.botProgress = progress;
        if (x.levelsGained > 0)
          this.botState = applyLevel(this.botState, this.botDef, progress.level);
      }
    }
  }

  /** Hit feedback on whatever was hit: minion, hero or structure. */
  private showHit(e: AttackEvent): void {
    const view = this.minionViews.get(e.targetId);
    if (view) {
      view.flash();
      if (e.killed) {
        view.die();
        this.minionViews.delete(e.targetId);
      }
    } else if (e.targetId === this.playerState.id) this.player.flash();
    else if (e.targetId === this.botState.id) this.bot.flash();
    else this.structureViews.get(e.targetId)?.flash();
  }

  /** Attack the nearest enemy in range while attack is held, or shortly after a press. */
  private playerAttack(now: number): void {
    const wants = this.attackHeld || now - this.lastAttackPress <= ATTACK_BUFFER_SEC;
    if (!wants || !canAttack(this.playerState, now)) return;
    const structures = this.structures.filter((s) => isTargetable(s, this.structures));
    const target = nearestEnemyInRange<Unit>(this.playerState, [
      this.botState,
      ...this.minions,
      ...structures,
    ]);
    if (!target) return;
    const r = resolveAttack(this.playerState, target, now, this.economy);
    this.playerState = r.attacker;
    this.lastAttackPress = -Infinity;
    slash(this, this.playerState, target, theme.colors.gold);
    damageNumber(this, target, r.damage);

    if (r.killed) this.onKill(target, this.playerState.id);

    if (target.id === this.botState.id) {
      this.botState = r.target as HeroState;
      this.bot.flash();
    } else if (this.structures.some((s) => s.id === target.id)) {
      const s = { ...(r.target as StructureState), respawnAt: null };
      this.structures = this.structures.map((x) => (x.id === s.id ? s : x));
      this.structureViews.get(s.id)?.flash();
    } else {
      const mn = r.target as MinionState;
      const view = this.minionViews.get(mn.id);
      if (r.killed) {
        this.minions = this.minions.filter((x) => x.id !== mn.id);
        view?.die();
        this.minionViews.delete(mn.id);
        this.lastHits[mn.kind]++;
        this.game.events.emit(LAST_HIT_EVENT, mn.kind, mn.id);
      } else {
        this.minions = this.minions.map((x) => (x.id === mn.id ? mn : x));
        view?.flash();
      }
    }
  }

  /** When a Nexus falls: stop the player, let the collapse play, then show the result. */
  private checkWin(): void {
    const w = winner(this.structures);
    if (!w || this.ending) return;
    this.ending = true;
    this.attackHeld = false;
    this.time.delayedCall(END_DELAY_MS, () => this.finish(w === 'blue' ? 'victory' : 'defeat'));
  }

  /** Faint red ring showing an enemy tower's range when the player gets close to it. */
  private drawDangerRing(): void {
    const g = this.dangerRing;
    g.clear();
    if (!this.playerState.alive) return;
    for (const t of this.structures) {
      if (t.kind !== 'tower' || !t.alive || t.team === this.playerState.team) continue;
      const d = Math.hypot(t.x - this.playerState.x, t.y - this.playerState.y);
      if (d > t.attackRange + this.structureCfg.dangerRingDistance) continue;
      g.fillStyle(hex(theme.colors.wrong), 0.08).fillCircle(t.x, t.y, t.attackRange);
      g.lineStyle(5, hex(theme.colors.wrong), 0.55).strokeCircle(t.x, t.y, t.attackRange);
    }
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
    this.playerDef = p;
    this.botDef = b;
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
      const nexus: Point = this.map.slots.find((s) => s.kind === 'nexus' && s.team === team)!;
      this.add
        .circle(nexus.x, nexus.y, 250, hex(theme.teams[team].main), 0.16)
        .setStrokeStyle(6, hex(theme.teams[team].main), 0.5);
    }
    this.dangerRing = this.add.graphics().setDepth(1);
    for (const s of this.structures) this.structureViews.set(s.id, new StructureView(this, s));
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
