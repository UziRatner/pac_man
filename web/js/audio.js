// All sound is synthesized with WebAudio oscillators (no asset files), mirroring
// the effects from the Python sounds.py. AudioContext must be unlocked by a user
// gesture on iOS, so call unlock() from the first tap/keypress.

import { LS_MUTED } from './constants.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem(LS_MUTED) === '1';
    this.wakaHigh = false;
    this.siren = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(LS_MUTED, m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // Schedule a simple tone with a quick attack/release envelope.
  _tone(freq, dur, type = 'square', gain = 0.4, startOffset = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  chomp() {
    this.wakaHigh = !this.wakaHigh;
    this._tone(this.wakaHigh ? 520 : 440, 0.06, 'square', 0.25);
  }

  powerPellet() {
    this._tone(220, 0.25, 'sawtooth', 0.3);
  }

  eatGhost() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t0);
    osc.frequency.linearRampToValueAtTime(1100, t0 + 0.3);
    g.gain.setValueAtTime(0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.34);
  }

  death() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t0);
    osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.8);
    g.gain.setValueAtTime(0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.95);
  }

  start() {
    this._tone(523, 0.12, 'square', 0.3, 0);
    this._tone(659, 0.12, 'square', 0.3, 0.13);
    this._tone(784, 0.18, 'square', 0.3, 0.26);
  }

  levelComplete() {
    this._tone(659, 0.1, 'square', 0.3, 0);
    this._tone(784, 0.1, 'square', 0.3, 0.11);
    this._tone(1047, 0.2, 'square', 0.3, 0.22);
  }

  // Looping background siren while ghosts are frightened.
  startSiren() {
    if (!this.ctx || this.muted || this.siren) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 280;
    lfo.frequency.value = 6;
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    g.gain.value = 0.12;
    osc.connect(g); g.connect(this.master);
    osc.start(); lfo.start();
    this.siren = { osc, lfo, g };
  }

  stopSiren() {
    if (!this.siren) return;
    try { this.siren.osc.stop(); this.siren.lfo.stop(); } catch (e) { /* already stopped */ }
    this.siren = null;
  }
}
