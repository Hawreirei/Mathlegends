import Phaser from 'phaser';
import economyJson from '../data/economy.json';
import ranksJson from '../data/ranks.json';
import {
  appendRows,
  newMatchId,
  parseLog,
  placementRow,
  serializeLog,
  type AnswerRow,
  type MatchLogInfo,
} from '../systems/answerLog';
import { loadRanks, type RanksFile } from '../systems/data';
import type { EconomyConfig } from '../systems/economy';
import { applyPlacement } from '../systems/gameState';
import {
  createPlacement,
  nextPlacementQuestion,
  placementDone,
  placementTier,
  recordPlacementAnswer,
  type PlacementState,
} from '../systems/placement';
import { loadQuestionBank } from '../systems/questionBank';
import type { ActiveQuestion, Reveal } from '../systems/questionSession';
import type { Question } from '../systems/questions';
import type { Rect } from '../systems/hudLayout';
import { timeScale } from '../systems/settings';
import { Button } from '../ui/Button';
import { QuestionOverlay } from '../ui/QuestionOverlay';
import { bodyFont, displayFont, hex, textScale, theme } from '../ui/theme';
import { browserStorage, loadAnswerLogRaw, saveAnswerLogRaw } from '../utils/storage';
import { getState, responsive, setStateAndSave, tr } from './shared';
import { enter, goTo, type BackAware } from './nav';
import type { Screen } from '../systems/navigation';

type Phase = 'intro' | 'quiz' | 'done';

/**
 * The placement quiz (#38): an intro, 10 adaptive questions on the match's question card
 * (timer, shuffled answers, the right answer shown after each), then the starting Year.
 * The rules are in src/systems/placement.ts. Answers go to the answer log (#30) as `placement`.
 */
export class PlacementScene extends Phaser.Scene implements BackAware {
  backScreen(): Screen {
    return this.phase === 'intro'
      ? 'placementIntro'
      : this.phase === 'quiz'
        ? 'placementQuiz'
        : 'placementDone';
  }

  /** Back leaves to the Menu; an unfinished quiz is not saved (Play starts it again). */
  applyBack(): void {
    this.overlay?.destroy();
    goTo(this, 'Menu');
  }

  private ranks!: RanksFile;
  private econ!: EconomyConfig;
  private bank!: Question[];
  private phase: Phase = 'intro';
  private quiz!: PlacementState;
  private active: ActiveQuestion | null = null;
  private reveal: Reveal | null = null;
  private overlay: QuestionOverlay | null = null;
  private progress?: Phaser.GameObjects.Text;
  private logInfo!: MatchLogInfo;
  private logRows: AnswerRow[] = [];
  private seconds = 15;
  /** Scene clock when the quiz started (log rows count time from here). */
  private quizStart = 0;

  constructor() {
    super('Placement');
  }

  create(): void {
    enter(this);
    this.ranks = loadRanks(ranksJson);
    this.econ = economyJson as EconomyConfig;
    this.bank = loadQuestionBank();
    this.phase = 'intro';
    this.active = null;
    this.reveal = null;
    this.overlay = null;
    this.logRows = [];
    responsive(this, () => this.layout());
  }

  /** Scene clock in seconds (the timer and the reveal use it). */
  private get now(): number {
    return this.time.now / 1000;
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const c = theme.colors;
    this.cameras.main.setBackgroundColor(hex(c.ink));
    this.overlay?.destroy();
    this.overlay = null;
    this.progress = undefined;
    this.add.circle(w * 0.85, h * 0.15, Math.min(w, h) * 0.3, hex(c.violet), 0.15);
    this.add.text(w / 2, 70, tr(this, 'placement.title'), displayFont(56, c.gold)).setOrigin(0.5);
    if (this.phase === 'intro') this.intro(w, h);
    else if (this.phase === 'quiz') this.quizLayout(w, h);
    else this.result(w, h);
  }

  private intro(w: number, h: number): void {
    const c = theme.colors;
    const textW = Math.min(w - 64, 760);
    this.add
      .text(w / 2, h * 0.36, tr(this, 'placement.intro'), bodyFont(30, c.paper, '600'))
      .setOrigin(0.5)
      .setWordWrapWidth(textW, true)
      .setAlign('center');
    new Button(this, w / 2, h * 0.62, tr(this, 'placement.start'), () => this.start(), {
      width: 360,
      height: 96,
      fontSize: 40,
    });
    new Button(this, w / 2, h * 0.62 + 120, tr(this, 'placement.back'), () => goTo(this, 'Menu'), {
      width: 300,
      height: 72,
      fontSize: 28,
      style: 'secondary',
    });
  }

  private start(): void {
    const seed = Date.now() % 2 ** 31;
    this.quiz = createPlacement(this.ranks, seed);
    this.seconds =
      this.ranks.placement.secondsPerQuestion * timeScale(getState(this).settings, this.econ);
    this.logInfo = {
      matchId: newMatchId(Date.now(), Math.random, 'p'),
      matchStart: new Date().toISOString(),
      playerTier: getState(this).profile.tier,
      lang: getState(this).lang,
    };
    this.phase = 'quiz';
    this.quizStart = this.now;
    this.showNext(this.now);
    this.children.removeAll(true);
    this.layout();
  }

  private quizLayout(w: number, h: number): void {
    const c = theme.colors;
    this.progress = this.add.text(w / 2, 130, '', bodyFont(28, c.paper, '700')).setOrigin(0.5);
    const portrait = h > w;
    const top = 170;
    const cardW = Math.min(w - 48, 900);
    const cardH = Math.min((portrait ? 600 : 420) * textScale(), h - top - 32);
    const rect: Rect = {
      x: (w - cardW) / 2,
      y: top + (h - top - 32 - cardH) / 2,
      w: cardW,
      h: cardH,
    };
    this.overlay = new QuestionOverlay(this, rect, (slot) => this.answer(slot));
    this.update();
  }

  private showNext(at: number): void {
    const q = nextPlacementQuestion(this.quiz, this.bank, this.ranks);
    const order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(this.quiz.rng() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    this.active = {
      question: q,
      band: 'onLevel',
      kind: 'infantry',
      reward: { gold: 0, exp: 0, at: { x: 0, y: 0 } },
      order,
      shownAt: at,
      deadline: at + this.seconds,
    };
  }

  private answer(slot: number): void {
    const a = this.active;
    if (!a || this.reveal || this.now < a.shownAt) return;
    this.end(a, a.order[slot] ?? null);
  }

  /** Ends the shown question: `chosen` null = timeout. */
  private end(a: ActiveQuestion, chosen: number | null): void {
    const now = this.now;
    const correct = chosen === a.question.answerIndex;
    this.logRows.push(
      placementRow(
        a.question,
        this.logInfo,
        this.quiz.answers.length + 1,
        a.shownAt - this.quizStart,
        chosen,
        chosen === null ? null : now - a.shownAt,
        this.seconds,
      ),
    );
    this.quiz = recordPlacementAnswer(this.quiz, a.question, correct, this.ranks);
    const outcome = chosen === null ? 'timeout' : correct ? 'correct' : 'wrong';
    this.reveal = {
      question: a.question,
      order: a.order,
      outcome,
      chosen,
      until: now + this.econ.questionRevealSeconds,
    };
    this.active = null;
  }

  update(): void {
    if (this.phase !== 'quiz' || !this.overlay) return;
    const now = this.now;
    if (this.active && now >= this.active.deadline) this.end(this.active, null);
    if (this.reveal && now >= this.reveal.until) {
      this.reveal = null;
      if (placementDone(this.quiz, this.ranks)) return this.finish();
      this.showNext(now);
    }
    const n = Math.min(
      this.quiz.answers.length + (this.reveal ? 0 : 1),
      this.ranks.placement.questions,
    );
    this.progress?.setText(
      tr(this, 'placement.progress', { n, total: this.ranks.placement.questions }),
    );
    this.overlay.sync(this.active, this.reveal, now, getState(this).lang);
  }

  private finish(): void {
    const tier = placementTier(this.quiz.answers, this.ranks);
    setStateAndSave(this, applyPlacement(getState(this), tier));
    const store = browserStorage();
    saveAnswerLogRaw(
      store,
      serializeLog(appendRows(parseLog(loadAnswerLogRaw(store)), this.logRows)),
    );
    this.logRows = [];
    this.phase = 'done';
    this.children.removeAll(true);
    this.layout();
  }

  private result(w: number, h: number): void {
    const c = theme.colors;
    const s = getState(this);
    const tier = this.ranks.tiers.find((t) => t.tier === s.profile.tier) ?? this.ranks.tiers[0]!;
    const right = this.quiz.answers.filter((a) => a.correct).length;
    this.add
      .text(w / 2, h * 0.22, tr(this, 'placement.doneTitle'), displayFont(48, c.white))
      .setOrigin(0.5);
    this.add.image(w / 2, h * 0.36, tier.badge).setScale(1.1);
    this.add
      .text(
        w / 2,
        h * 0.48,
        tr(this, 'placement.result', { year: tier.label[s.lang] }),
        displayFont(44, c.gold),
      )
      .setOrigin(0.5);
    this.add
      .text(
        w / 2,
        h * 0.48 + 60,
        tr(this, 'placement.score', { correct: right, total: this.quiz.answers.length }),
        bodyFont(28, c.paper),
      )
      .setOrigin(0.5);
    this.add
      .text(w / 2, h * 0.48 + 105, tr(this, 'placement.note'), bodyFont(24, c.paper, '600'))
      .setOrigin(0.5)
      .setWordWrapWidth(Math.min(w - 64, 760), true)
      .setAlign('center')
      .setAlpha(0.85);
    new Button(
      this,
      w / 2,
      Math.min(h - 80, h * 0.48 + 220),
      tr(this, 'placement.play'),
      () => goTo(this, 'Match'),
      { width: 360, height: 96, fontSize: 40 },
    );
  }
}
