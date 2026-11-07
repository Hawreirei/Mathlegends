import Phaser from 'phaser';
import { bodyFont, theme } from './theme';

/**
 * Frame-rate meter for checking a real phone (#48): open the game with `?fps` in the address
 * (…/Mathlegends/?fps) and the match shows frames per second and the CPU time of each frame
 * (the rules, the scenes and preparing the drawing), averaged over half a second.
 * 60 fps needs at most 16.7 ms; 30 fps 33.3 ms. Off unless asked for.
 */
export const fpsMeterWanted = (): boolean =>
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('fps');

export class FpsMeter {
  /** Only one meter wraps the game loop at a time (the HUD is rebuilt on rotation). */
  private static current: FpsMeter | null = null;
  private readonly text: Phaser.GameObjects.Text;
  private frames = 0;
  private cpu = 0;
  private worst = 0;
  private since = performance.now();
  private readonly restore: () => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    format: (fps: number, ms: number, worst: number) => string,
  ) {
    this.text = scene.add
      .text(x, y, '', bodyFont(20, theme.colors.white, '800'))
      .setOrigin(0.5, 0)
      .setStroke(theme.colors.ink, 5)
      .setDepth(10_000);
    FpsMeter.current?.restore();
    FpsMeter.current = this;
    // Time each step of the game loop (wrapped once; undone when the scene shuts down).
    const loop = scene.game.loop as unknown as { callback: (t: number, d: number) => void };
    const step = loop.callback;
    loop.callback = (t, d) => {
      const a = performance.now();
      step(t, d);
      const ms = performance.now() - a;
      this.frames++;
      this.cpu += ms;
      this.worst = Math.max(this.worst, ms);
      const now = performance.now();
      if (now - this.since >= 500) {
        const secs = (now - this.since) / 1000;
        if (this.text.active)
          this.text.setText(
            format(
              Math.round(this.frames / secs),
              +(this.cpu / this.frames).toFixed(1),
              +this.worst.toFixed(1),
            ),
          );
        this.frames = 0;
        this.cpu = 0;
        this.worst = 0;
        this.since = now;
      }
    };
    this.restore = () => {
      loop.callback = step;
      if (FpsMeter.current === this) FpsMeter.current = null;
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.restore());
  }
}
