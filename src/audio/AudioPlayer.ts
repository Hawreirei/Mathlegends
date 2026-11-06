/**
 * Plays the game's sounds and music (#45) with Web Audio, synthesised from the recipes in
 * src/data/audio.json: no audio files, nothing third-party. Which sound an event makes, the
 * throttling and the music schedule are pure rules in src/systems/feel.ts.
 *
 * Browsers only allow sound after the player touches the page, so nothing plays until unlock()
 * runs from a tap, click or key (main.ts wires that once). Sounds are never needed to play:
 * everything they say is also on screen.
 */
import audioJson from '../data/audio.json';
import feelJson from '../data/feel.json';
import { loadAudio, loadFeel, type SoundName, type SoundRecipe } from '../systems/data';
import { allowSound, musicSchedule } from '../systems/feel';

const audio = loadAudio(audioJson);
const feel = loadFeel(feelJson);
const LOOKAHEAD_SEC = 0.6;

class AudioPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private soundOn = true;
  private musicOn = true;
  private last: Record<string, number> = {};
  private musicTimer: number | null = null;
  private loopStart = 0;
  private scheduledUntil = 0;
  private readonly schedule = musicSchedule(audio.music);

  /** Applies the Sound and Music settings (the mute switches). */
  configure(sound: boolean, music: boolean): void {
    this.soundOn = sound;
    this.musicOn = music;
    if (music) this.startMusic();
    else this.stopMusic();
  }

  /** Call from a user gesture: creates or resumes the audio context, then starts music if on. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = audio.masterVolume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.musicOn) this.startMusic();
    } catch {
      // No audio on this device: the game plays silently.
    }
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (!this.soundOn || !ctx || !this.master || ctx.state !== 'running') return;
    const gate = allowSound(this.last, name, ctx.currentTime, feel);
    if (!gate.play) return;
    this.last = gate.last;
    this.voice(audio.sounds[name], ctx.currentTime);
  }

  /** One recipe: a pitch slide, or a run of notes; with an optional noise burst. */
  private voice(r: SoundRecipe, t0: number): void {
    const ctx = this.ctx!;
    const dur = r.durationMs / 1000;
    const steps = r.notes ?? [r.from!];
    steps.forEach((freq, i) => {
      const t = t0 + i * dur;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = r.wave;
      osc.frequency.setValueAtTime(freq, t);
      if (!r.notes) osc.frequency.exponentialRampToValueAtTime(r.to!, t + dur);
      envelope(g, t, dur, r.volume);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
    if (r.noise) {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = buf;
      envelope(g, t0, dur, r.volume * 0.6);
      src.connect(g).connect(this.master!);
      src.start(t0);
    }
  }

  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.musicTimer !== null) return;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = audio.music.volume;
    this.musicGain.connect(this.master);
    this.loopStart = ctx.currentTime + 0.1;
    this.scheduledUntil = this.loopStart;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 200);
    this.scheduleMusic();
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    const ctx = this.ctx;
    const g = this.musicGain;
    if (ctx && g) {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      window.setTimeout(() => g.disconnect(), 400);
    }
    this.musicGain = null;
  }

  /** Queues the notes that start in the next LOOKAHEAD_SEC (the loop repeats forever). */
  private scheduleMusic(): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !out) return;
    const until = ctx.currentTime + LOOKAHEAD_SEC;
    const { notes, loopSec } = this.schedule;
    while (this.scheduledUntil < until) {
      const from = this.scheduledUntil;
      const to = Math.min(until, from + loopSec);
      const loops = Math.floor((from - this.loopStart) / loopSec);
      for (let k = loops; k <= loops + 1; k++) {
        const base = this.loopStart + k * loopSec;
        for (const n of notes) {
          const t = base + n.at;
          if (t < from || t >= to) continue;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = n.voice === 'bass' ? audio.music.bassWave : audio.music.wave;
          osc.frequency.setValueAtTime(n.freq, t);
          envelope(g, t, n.durationSec, n.voice === 'bass' ? 0.7 : 1);
          osc.connect(g).connect(out);
          osc.start(t);
          osc.stop(t + n.durationSec + 0.05);
        }
      }
      this.scheduledUntil = to;
    }
  }
}

/** Quick attack, then a fade to silence, so notes never click. */
function envelope(g: GainNode, t: number, dur: number, peak: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + Math.min(0.01, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** The one player for the whole game. */
export const sfx = new AudioPlayer();
