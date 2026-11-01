import Phaser from 'phaser';
import botJson from '../data/bot.json';
import skillsJson from '../data/skills.json';
import itemsJson from '../data/items.json';
import ranksJson from '../data/ranks.json';
import economyJson from '../data/economy.json';
import heroesJson from '../data/heroes.json';
import mapJson from '../data/map.json';
import minionsJson from '../data/minions.json';
import structuresJson from '../data/structures.json';
import {
  blastRing,
  damageNumber,
  dashTrail,
  goldPopup,
  HeroView,
  levelUpBurst,
  projectileDot,
  slash,
} from '../entities/Hero';
import { MinionView, shot } from '../entities/Minion';
import { StructureView, towerShot } from '../entities/Structure';
import { ATTACK_BUFFER_SEC } from '../systems/combat';
import {
  botForTier,
  loadBotFile,
  loadSkills,
  loadItems,
  checkHeroSkills,
  loadHeroes,
  loadMinions,
  loadRanks,
  loadStructures,
} from '../systems/data';
import { validateEconomy, type EconomyConfig } from '../systems/economy';
import { recordMatch, type MatchResult } from '../systems/gameState';
import {
  appendRows,
  newMatchId,
  parseLog,
  rowFor,
  serializeLog,
  type AnswerRow,
  type MatchLogInfo,
} from '../systems/answerLog';
import { updateReviewQueue } from '../systems/reviewQueue';
import { applyMatch } from '../systems/rank';
import { timeScale } from '../systems/settings';
import { checkSkillBudget } from '../systems/skillBudget';
import { browserStorage, loadAnswerLogRaw, saveAnswerLogRaw } from '../utils/storage';
import { directionFromKeys, type HeroState } from '../systems/hero';
import { buildMap, cameraZoom, type MapConfig } from '../systems/map';
import {
  applyLastHitReward,
  createMatch,
  playerBuy,
  playerSell,
  stepMatch,
  type MatchConfig,
  type MatchEvent,
  type MatchInput,
  type MatchState,
} from '../systems/match';
import type { MinionState } from '../systems/minions';
import { loadQuestionBank } from '../systems/questionBank';
import { createQuestionEngine } from '../systems/questionEngine';
import {
  answer,
  createSession,
  onLastHit,
  tick,
  timeLimit,
  type Resolution,
  type Session,
} from '../systems/questionSession';
import type { Progress } from '../systems/progression';
import { isTargetable, type StructureState } from '../systems/structures';
import { hex, theme } from '../ui/theme';
import {
  ATTACK_EVENT,
  ATTACK_RELEASE_EVENT,
  SKILL_EVENT,
  SKILL_FAILED_EVENT,
  SKILL_KEYS,
  type MatchHudScene,
} from './MatchHudScene';
import { getState, setStateAndSave, tr } from './shared';
import { enter, goTo } from './nav';

/** Fired on game.events when a question ends: (resolution). The HUD shows the feedback. */
export const QUESTION_RESOLVED_EVENT = 'ml-question-resolved';

/** Fired on game.events when the player's hit kills a minion: (kind, minionId). The question overlay (#27) listens. */
export const LAST_HIT_EVENT = 'ml-last-hit';

/** Delay between a Nexus falling and the Result screen, so the collapse can be seen. */
const END_DELAY_MS = 1500;

type Keys = Record<
  'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
  Phaser.Input.Keyboard.Key
>;

/**
 * Draws a match and feeds it player input. All rules live in src/systems/match.ts
 * (stepMatch): movement, combat, minions, towers, the bot (#24), gold and EXP. This scene
 * turns the events it returns into visuals. The HUD is a separate scene (MatchHudScene).
 */
export class MatchScene extends Phaser.Scene {
  cfg!: MatchConfig;
  /** Questions of this match (#27); the HUD's QuestionOverlay draws session.active. */
  session!: Session;
  /** A skill slot pressed since the last step (#33). */
  private pendingSkill: number | null = null;
  private logInfo!: MatchLogInfo;
  private logRows: AnswerRow[] = [];
  /** The whole match state; exposed for browser tests. */
  state!: MatchState;
  player!: HeroView;
  bot!: HeroView;
  /** Set once a Nexus falls; the match ends shortly after. */
  ending = false;
  /** Attack presses so far (touch button or Space). */
  attackPresses = 0;
  private minionViews = new Map<string, MinionView>();
  private structureViews = new Map<string, StructureView>();
  private dangerRing!: Phaser.GameObjects.Graphics;
  private dangerRingDistance = 0;
  private attackHeld = false;
  private lastAttackPress = -Infinity;
  private keys!: Keys;

  constructor() {
    super('Match');
  }

  /** Match time in seconds. */
  get now(): number {
    return this.state.now;
  }
  get playerState(): HeroState {
    return this.state.player;
  }
  set playerState(v: HeroState) {
    this.state = { ...this.state, player: v };
  }
  get botState(): HeroState {
    return this.state.bot;
  }
  set botState(v: HeroState) {
    this.state = { ...this.state, bot: v };
  }
  get minions(): MinionState[] {
    return this.state.minions;
  }
  set minions(v: MinionState[]) {
    this.state = { ...this.state, minions: v };
  }
  get structures(): StructureState[] {
    return this.state.structures;
  }
  set structures(v: StructureState[]) {
    this.state = { ...this.state, structures: v };
  }
  get playerProgress(): Progress {
    return this.state.playerProgress;
  }
  get lastHits(): MatchState['lastHits'] {
    return this.state.lastHits;
  }

  create(): void {
    enter(this);
    const econ = economyJson as EconomyConfig;
    const problems = validateEconomy(econ);
    if (problems.length) throw new Error(`Invalid economy.json:\n${problems.join('\n')}`);
    const heroes = loadHeroes(heroesJson);
    const find = (id: string | undefined, role: string) => {
      const h = heroes.heroes.find((x) => x.id === id);
      if (!h) throw new Error(`heroes.json must set ${role} to an existing hero`);
      return h;
    };
    const structures = loadStructures(structuresJson);
    // Skills (#33), checked against the heroes at load (AGENTS.md rule 4).
    const skills = loadSkills(skillsJson);
    const skillProblems = [
      ...checkHeroSkills(heroes, skills),
      // The skill damage budget (#34, docs/ECONOMY.md).
      ...checkSkillBudget(heroes.heroes, skills, econ, econ.exp.levelCap),
    ];
    if (skillProblems.length) throw new Error(`Invalid skills:\n${skillProblems.join('\n')}`);
    this.cfg = {
      econ,
      map: buildMap(mapJson as MapConfig),
      minions: loadMinions(minionsJson),
      structures,
      playerHero: find(heroes.playerHero, 'playerHero'),
      botHero: find(heroes.botHero, 'botHero'),
      // The bot's difficulty follows the player's Year (#43).
      bot: botForTier(loadBotFile(botJson), getState(this).profile.tier),
      skills,
      items: loadItems(itemsJson),
    };
    this.dangerRingDistance = structures.dangerRingDistance;
    this.state = createMatch(this.cfg, Date.now() % 2 ** 31);
    // The question bank is validated at load; the seed changes every match.
    const engine = createQuestionEngine(
      loadQuestionBank(),
      loadRanks(ranksJson),
      Date.now() % 2 ** 31,
      getState(this).review,
    );
    this.session = createSession(engine, econ, timeScale(getState(this).settings, econ));
    // Anonymous answer log (#30): kept here, saved on the device when the match ends or is quit.
    this.logInfo = {
      matchId: newMatchId(Date.now()),
      matchStart: new Date().toISOString(),
      playerTier: getState(this).profile.tier,
      lang: getState(this).lang,
    };
    this.logRows = [];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.saveLog());
    this.minionViews = new Map();
    this.projectileViews = new Map();
    this.structureViews = new Map();
    this.ending = false;
    this.attackHeld = false;
    this.lastAttackPress = -Infinity;
    this.attackPresses = 0;

    this.drawWorld();
    const map = this.cfg.map;
    this.bot = new HeroView(
      this,
      this.state.bot,
      this.cfg.botHero.sprite,
      'red',
      map.heroSpawn.red,
    );
    this.player = new HeroView(
      this,
      this.state.player,
      this.cfg.playerHero.sprite,
      'blue',
      map.heroSpawn.blue,
    );
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Keys;
    // Skills (#33): Q, E, R and F on a keyboard (1-4 answer questions); buttons on touch.
    this.pendingSkill = null;
    SKILL_KEYS.forEach((key, slot) =>
      this.input.keyboard!.on(`keydown-${key}`, () => (this.pendingSkill = slot)),
    );

    this.cameras.main.startFollow(
      this.player,
      true,
      map.config.camera.lerp,
      map.config.camera.lerp,
    );
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
    const skill = (slot: number) => (this.pendingSkill = slot);
    this.game.events.on(ATTACK_EVENT, press);
    this.game.events.on(ATTACK_RELEASE_EVENT, release);
    this.game.events.on(SKILL_EVENT, skill);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.fitCamera, this);
      this.game.events.off(ATTACK_EVENT, press);
      this.game.events.off(ATTACK_RELEASE_EVENT, release);
      this.game.events.off(SKILL_EVENT, skill);
    });

    this.scene.launch('MatchHud');
  }

  update(_time: number, deltaMs: number): void {
    // Cap the step so a long frame (tab switch) cannot teleport anyone.
    const dt = Math.min(deltaMs, 100) / 1000;
    const r = stepMatch(this.state, this.readInput(), dt, this.cfg);
    this.state = r.state;
    for (const e of r.events) this.show(e);
    const t = tick(this.session, this.state.now);
    this.session = t.session;
    this.resolve(t.resolutions);

    const now = this.state.now;
    this.player.sync(this.state.player, now);
    this.bot.sync(this.state.bot, now);
    for (const m of this.state.minions) this.minionViews.get(m.id)?.sync(m);
    this.syncProjectiles();
    for (const s of this.state.structures)
      this.structureViews.get(s.id)?.sync(s, isTargetable(s, this.state.structures));
    this.drawDangerRing();
    this.keepHeroInView();
  }

  /** One dot per skill projectile in flight (#33). */
  private projectileViews = new Map<string, Phaser.GameObjects.Arc>();

  private syncProjectiles(): void {
    const live = new Set<string>();
    for (const p of this.state.projectiles) {
      live.add(p.id);
      let v = this.projectileViews.get(p.id);
      if (!v) {
        v = projectileDot(this, p.team === 'blue' ? theme.colors.gold : theme.teams.red.main);
        this.projectileViews.set(p.id, v);
      }
      v.setPosition(p.x, p.y);
    }
    for (const [id, v] of this.projectileViews)
      if (!live.has(id)) {
        v.destroy();
        this.projectileViews.delete(id);
      }
  }

  private camOffsetY = 0;

  /**
   * While a question is showing, ease the camera so the hero sits in the clear band between the
   * top panels and the question card; ease back afterwards (#27).
   */
  private keepHeroInView(): void {
    const hud = this.scene.get('MatchHud') as MatchHudScene;
    const l = hud.layoutInfo;
    const cam = this.cameras.main;
    let target = 0;
    if (l && this.session?.active) {
      // The hero is centred horizontally. On wide screens the panels sit at the sides, so only the
      // top bar is above it; on narrow screens the panels span the middle too.
      const cx = this.scale.width / 2;
      const panelsClear = l.heroPanel.x + l.heroPanel.w < cx - 60 && l.minimap.x > cx + 60;
      const bandTop = panelsClear ? l.topBar.h : l.heroPanel.y + l.heroPanel.h;
      const bandMid = (bandTop + l.questionCard.y) / 2;
      target = -(this.scale.height / 2 - bandMid) / cam.zoom;
    }
    this.camOffsetY += (target - this.camOffsetY) * 0.15;
    cam.setFollowOffset(0, this.camOffsetY);
  }

  private readInput(): MatchInput {
    // One skill press per step (#33); presses while dead or ending are dropped.
    const skill = this.pendingSkill;
    this.pendingSkill = null;
    if (this.ending || !this.state.player.alive) return { move: { x: 0, y: 0 }, attack: false };
    const k = this.keys;
    let move = directionFromKeys({
      up: k.W.isDown || k.UP.isDown,
      down: k.S.isDown || k.DOWN.isDown,
      left: k.A.isDown || k.LEFT.isDown,
      right: k.D.isDown || k.RIGHT.isDown,
    });
    // The touch joystick wins when it is being used (analogue: partial tilt = slower walk).
    const stick = (this.scene.get('MatchHud') as MatchHudScene).touch?.vector;
    if (stick && (stick.x !== 0 || stick.y !== 0)) move = stick;
    const attack = this.attackHeld || this.now - this.lastAttackPress <= ATTACK_BUFFER_SEC;
    return { move, attack, skill };
  }

  /** Turns one rules event into visuals. */
  private show(e: MatchEvent): void {
    const playerId = this.state.player.id;
    const botId = this.state.bot.id;
    switch (e.type) {
      case 'spawn':
        this.minionViews.set(e.minion.id, new MinionView(this, e.minion));
        return;
      case 'attack': {
        if (e.by === 'player' || e.by === 'bot') {
          slash(this, e.from, e.to, e.by === 'player' ? theme.colors.gold : theme.teams.red.main);
          if (e.by === 'player' || e.targetId === playerId) damageNumber(this, e.to, e.damage);
          if (e.by === 'player') this.lastAttackPress = -Infinity;
        } else if (e.by === 'minion' && e.minionKind && e.minionKind !== 'infantry') {
          shot(this, e.from, e.to, theme.teams[e.team].main, e.minionKind === 'cannon');
        } else if (e.by === 'tower') {
          towerShot(this, e.from, e.to, theme.teams[e.team].main);
          if (e.targetId === playerId) damageNumber(this, e.to, e.damage);
        }
        const mv = this.minionViews.get(e.targetId);
        if (mv) {
          mv.flash();
          if (e.killed) {
            mv.die();
            this.minionViews.delete(e.targetId);
          }
        } else if (e.targetId === playerId) this.player.flash();
        else if (e.targetId === botId) this.bot.flash();
        else this.structureViews.get(e.targetId)?.flash();
        return;
      }
      case 'reward':
        if (e.heroId === playerId && e.gold > 0) goldPopup(this, e.at, e.gold);
        return;
      case 'skill': {
        const color = e.by === 'player' ? theme.colors.gold : theme.teams.red.main;
        if (e.dashTo) dashTrail(this, e.from, e.dashTo, color);
        for (const b of e.blasts) blastRing(this, b, b.radius, color);
        return;
      }
      case 'skillFailed':
        if (e.by === 'player') this.game.events.emit(SKILL_FAILED_EVENT, e.slot, e.reason);
        return;
      case 'skillHit': {
        if (e.team === 'blue' || e.targetId === playerId) damageNumber(this, e.at, e.damage);
        const mv = this.minionViews.get(e.targetId);
        if (mv) {
          mv.flash();
          if (e.killed) {
            mv.die();
            this.minionViews.delete(e.targetId);
          }
        } else if (e.targetId === playerId) this.player.flash();
        else if (e.targetId === botId) this.bot.flash();
        return;
      }
      case 'levelUp':
        if (e.heroId === playerId) levelUpBurst(this, this.state.player, tr(this, 'fx.levelUp'));
        return;
      case 'lastHit': {
        this.game.events.emit(LAST_HIT_EVENT, e.kind, e.minionId);
        const tier = getState(this).profile.tier;
        const r = onLastHit(
          this.session,
          e.kind,
          { gold: e.gold, exp: e.exp, at: e.at },
          this.state.now,
          tier,
        );
        this.session = r.session;
        this.resolve(r.resolutions);
        return;
      }
      case 'winner':
        this.ending = true;
        this.attackHeld = false;
        this.time.delayedCall(END_DELAY_MS, () =>
          this.finish(e.team === 'blue' ? 'victory' : 'defeat'),
        );
        return;
    }
  }

  /** Faint red ring showing an enemy tower's range when the player gets close to it. */
  private drawDangerRing(): void {
    const g = this.dangerRing;
    const p = this.state.player;
    g.clear();
    if (!p.alive) return;
    for (const t of this.state.structures) {
      if (t.kind !== 'tower' || !t.alive || t.team === p.team) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > t.attackRange + this.dangerRingDistance) continue;
      g.fillStyle(hex(theme.colors.wrong), 0.08).fillCircle(t.x, t.y, t.attackRange);
      g.lineStyle(5, hex(theme.colors.wrong), 0.55).strokeCircle(t.x, t.y, t.attackRange);
    }
  }

  /** Zoom out on narrow (portrait) screens and centre the world vertically when the view is taller. */
  private fitCamera(): void {
    const cam = this.cameras.main;
    const map = this.cfg.map.config;
    const zoom = cameraZoom(this.scale.width, map);
    cam.setZoom(zoom);
    const viewH = this.scale.height / zoom;
    // Tall portrait views: centre the world, with room above and below so the camera can still
    // shift to keep the hero visible over the question card (the grass extends that far).
    const extra = 600;
    if (viewH > map.world.height)
      cam.setBounds(0, (map.world.height - viewH) / 2 - extra, map.world.width, viewH + 2 * extra);
    else cam.setBounds(0, 0, map.world.width, map.world.height);
  }

  private drawWorld(): void {
    const { world, lane, river } = this.cfg.map.config;
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

    // Base pads: heroes heal quickly inside their own (map.json base.healRadius).
    const healR = this.cfg.map.config.base.healRadius;
    for (const team of ['blue', 'red'] as const) {
      const nexus = this.cfg.map.slots.find((s) => s.kind === 'nexus' && s.team === team)!;
      this.add
        .circle(nexus.x, nexus.y, healR, hex(theme.teams[team].main), 0.16)
        .setStrokeStyle(6, hex(theme.teams[team].main), 0.5);
    }
    this.dangerRing = this.add.graphics().setDepth(1);
    for (const s of this.state.structures)
      this.structureViews.set(s.id, new StructureView(this, s));
  }

  /** Shop (#35): buy an item for the player. Returns false if it could not be bought. */
  buyItem(id: string): boolean {
    const r = playerBuy(this.state, id, this.cfg);
    this.state = r.state;
    return r.result.ok;
  }

  /** Shop (#35): sell the item in a slot. Returns the gold refunded, or null. */
  sellSlot(slot: number): number | null {
    const r = playerSell(this.state, slot, this.cfg);
    this.state = r.state;
    return r.result.ok ? r.result.gold : null;
  }

  /** The player tapped answer slot `slot` on the question card. */
  answerSlot(slot: number): void {
    const r = answer(this.session, slot, this.state.now);
    this.session = r.session;
    this.resolve(r.resolutions);
  }

  /** Pays held last-hit rewards x the answer multiplier and tells the HUD. */
  private resolve(list: Resolution[]): void {
    for (const res of list) {
      const paid = applyLastHitReward(this.state, res.reward, res.multiplier, this.cfg);
      this.state = paid.state;
      for (const e of paid.events) this.show(e);
      // The HUD shows the multiplier actually paid (the fairness cap may trim the bonus, #28).
      this.game.events.emit(QUESTION_RESOLVED_EVENT, { ...res, multiplier: paid.goldMultiplier });
      const row =
        res.question &&
        rowFor(
          res,
          { ...this.logInfo, lang: getState(this).lang },
          this.logRows.length + 1,
          timeLimit(this.cfg.econ, res.question) * this.session.timeScale,
        );
      if (row) this.logRows.push(row);
    }
  }

  /** Adds this match's answers to the log saved on the device (once). */
  private saveLog(): void {
    if (!this.logRows.length) return;
    const store = browserStorage();
    saveAnswerLogRaw(
      store,
      serializeLog(appendRows(parseLog(loadAnswerLogRaw(store)), this.logRows)),
    );
    this.logRows = [];
  }

  /**
   * The player left the match (#44). With ranks.json stars.quitCountsAsLoss it counts as a
   * loss and goes to the Result screen (stars, missed questions); otherwise back to the Menu.
   */
  forfeit(): void {
    if (this.ending) return;
    this.ending = true;
    this.attackHeld = false;
    if (loadRanks(ranksJson).stars.quitCountsAsLoss) this.finish('defeat', true);
    else goTo(this, 'Menu', ['MatchHud']);
  }

  finish(outcome: MatchResult['outcome'], forfeit = false): void {
    const missed = this.session.missed;
    // Missed questions come back in the next matches (#29); the queue is saved on the device.
    const ranks = loadRanks(ranksJson);
    const review = updateReviewQueue(this.session.engine.review, missed, ranks);
    // Stars and Year (#39).
    const rank = applyMatch(
      getState(this).profile,
      { won: outcome === 'victory', answered: this.session.asked, correct: this.session.correct },
      ranks,
    );
    setStateAndSave(
      this,
      recordMatch(
        getState(this),
        {
          outcome,
          durationSec: this.now,
          answered: this.session.asked,
          correct: this.session.correct,
          missed,
          rank,
          forfeit,
        },
        review,
      ),
    );
    goTo(this, 'Result', ['MatchHud']);
  }
}
