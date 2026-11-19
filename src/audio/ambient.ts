// Procedural ambient soundscape built only with the Web Audio API. No audio files.
import type { Mood, SoundKind } from '../memory/types';

const MOOD_CHORDS: Record<Mood, number[]> = {
  nostalgic: [220, 277.18, 329.63, 415.3],
  peaceful: [196, 246.94, 293.66, 392],
  strange: [207.65, 233.08, 311.13, 369.99],
  joyful: [261.63, 329.63, 392, 493.88],
  melancholic: [174.61, 207.65, 261.63, 311.13],
  uncertain: [185, 220, 277.18, 293.66],
};

export class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stops: (() => void)[] = [];
  private timers: number[] = [];
  playing = false;

  private noiseBuffer(ctx: AudioContext, brown = false) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  private noise(filterType: BiquadFilterType, freq: number, q: number, gain: number, brown = false, lfoRate = 0, lfoDepth = 0) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, brown);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master!);
    if (lfoRate > 0) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = lfoRate;
      const lg = ctx.createGain(); lg.gain.value = lfoDepth;
      lfo.connect(lg).connect(g.gain); lfo.start();
      this.stops.push(() => lfo.stop());
    }
    src.start();
    this.stops.push(() => src.stop());
  }

  private pad(mood: Mood) {
    const ctx = this.ctx!;
    const g = ctx.createGain(); g.gain.value = 0.035;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    g.connect(lp).connect(this.master!);
    MOOD_CHORDS[mood].forEach((hz, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = hz / 2;
      o.detune.value = (i - 1.5) * 6;
      const og = ctx.createGain(); og.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 0.4;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(g); o.start(); lfo.start();
      this.stops.push(() => { o.stop(); lfo.stop(); });
    });
  }

  private every(minMs: number, maxMs: number, fn: () => void) {
    const tick = () => { fn(); this.timers.push(window.setTimeout(tick, minMs + Math.random() * (maxMs - minMs))); };
    this.timers.push(window.setTimeout(tick, minMs));
  }

  private blip(freqFrom: number, freqTo: number, dur: number, gain: number, type: OscillatorType = 'sine') {
    const ctx = this.ctx; if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freqFrom, t);
    o.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  async start(sounds: SoundKind[], mood: Mood, volume = 0.6) {
    this.stop();
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = this.ctx ?? new Ctx();
    await this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 2.5);
    this.master.connect(this.ctx.destination);

    this.pad(mood);
    const set = new Set(sounds);
    if (set.has('rain')) { this.noise('highpass', 1200, 0.3, 0.12); this.noise('lowpass', 500, 0.5, 0.08, true); }
    if (set.has('wind')) this.noise('bandpass', 420, 0.8, 0.18, true, 0.08, 0.12);
    if (set.has('waves')) this.noise('lowpass', 650, 0.4, 0.22, true, 0.11, 0.2);
    if (set.has('city')) { this.noise('lowpass', 220, 0.7, 0.2, true); this.every(5000, 14000, () => this.blip(440, 430, 0.5, 0.012, 'square')); }
    if (set.has('hum')) { this.noise('lowpass', 140, 1, 0.12, true); }
    if (set.has('birds')) this.every(1800, 6000, () => { const f = 2200 + Math.random() * 1800; this.blip(f, f * 1.4, 0.12, 0.03); setTimeout(() => this.blip(f * 1.2, f * 0.9, 0.1, 0.025), 140); });
    if (set.has('crickets')) this.every(700, 1800, () => { for (let i = 0; i < 3; i++) setTimeout(() => this.blip(4600, 4500, 0.04, 0.012, 'triangle'), i * 60); });
    if (set.has('clock')) this.every(1000, 1000, () => this.blip(1800, 1200, 0.03, 0.03, 'triangle'));
    if (set.has('music')) {
      const notes = MOOD_CHORDS[mood];
      this.every(1400, 3200, () => { const n = notes[Math.floor(Math.random() * notes.length)] * 2; this.blip(n, n * 0.999, 2.2, 0.03, 'sine'); });
    }
    if (set.has('voices')) this.noise('bandpass', 700, 2.5, 0.05, true, 0.3, 0.05);
    this.playing = true;
  }

  setVolume(v: number) {
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
  }

  stop() {
    this.timers.forEach((t) => clearTimeout(t)); this.timers = [];
    const stops = this.stops; this.stops = [];
    const master = this.master; this.master = null;
    if (master && this.ctx) {
      master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      setTimeout(() => { stops.forEach((s) => { try { s(); } catch { /* already stopped */ } }); master.disconnect(); }, 1600);
    }
    this.playing = false;
  }
}

export const ambient = new Ambient();
