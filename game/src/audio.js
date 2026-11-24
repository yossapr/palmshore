// All sound is synthesised here: no files, no network. The engine and siren are live
// oscillators; guns are noise bursts; the score is a slow minor arpeggio.

import { clamp } from './math.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.started = false;
    this.muted = false;
    this.engine = null;
    this.siren = null;
    this.sirenGain = null;
    this.nextNote = 0;
    this.noteIndex = 0;
    this.noiseBuffer = null;
    this.lastFoot = 0;
    this.lastSiren = 0;
  }

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const length = Math.floor(this.ctx.sampleRate * 0.7);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  }

  unlock() {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.started) return;
    this.started = true;
    this.buildEngine();
    this.buildSiren();
    this.nextNote = this.ctx.currentTime + 0.6;
  }

  buildEngine() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 48;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 3;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.engine = { osc, filter, gain };
  }

  buildSiren() {
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 660;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1300;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.siren = { osc, gain };
  }

  setEngine(speed, driving) {
    if (!this.engine) return;
    const now = this.ctx.currentTime;
    const targetGain = driving ? 0.12 + clamp(Math.abs(speed) / 40, 0, 1) * 0.1 : 0;
    this.engine.gain.gain.setTargetAtTime(targetGain, now, 0.12);
    this.engine.osc.frequency.setTargetAtTime(44 + Math.abs(speed) * 3.4, now, 0.08);
    this.engine.filter.frequency.setTargetAtTime(320 + Math.abs(speed) * 14, now, 0.1);
  }

  setSiren(active, time) {
    if (!this.siren) return;
    const now = this.ctx.currentTime;
    this.siren.gain.gain.setTargetAtTime(active ? 0.055 : 0, now, 0.2);
    if (active) {
      const high = Math.floor(time * 2.2) % 2 === 0;
      this.siren.osc.frequency.setTargetAtTime(high ? 880 : 620, now, 0.05);
    }
  }

  noise(duration = 0.18, gain = 0.5, filterFreq = 1600, type = 'highpass') {
    if (!this.started || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  tone(freq, duration, gain = 0.12, type = 'triangle', slide = 0) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  gun(id = 'sidearm', owner = 'player') {
    if (!this.started) return;
    const loud = owner === 'player' ? 1 : 0.5;
    this.noise(id === 'shotgun' ? 0.24 : id === 'rifle' ? 0.16 : 0.1, 0.55 * loud, id === 'shotgun' ? 900 : 1700);
    this.tone(id === 'shotgun' ? 90 : 140, 0.12, 0.28 * loud, 'square', -70);
  }

  punch(hit) {
    if (!this.started) return;
    this.noise(0.09, hit ? 0.4 : 0.16, hit ? 700 : 400, 'lowpass');
    this.tone(hit ? 80 : 120, 0.1, 0.12, 'sine');
  }

  crunch() {
    if (!this.started) return;
    this.noise(0.16, 0.42, 600, 'lowpass');
    this.tone(70, 0.16, 0.16, 'sawtooth');
  }

  explosion() {
    if (!this.started) return;
    this.noise(0.85, 0.8, 380, 'lowpass');
    this.tone(55, 0.55, 0.35, 'sawtooth', -20);
  }

  pickup(kind = 'cash') {
    if (!this.started) return;
    const base = kind === 'cash' ? 660 : kind === 'health' ? 520 : 760;
    this.tone(base, 0.09, 0.14, 'triangle');
    this.tone(base * 1.5, 0.12, 0.1, 'triangle');
  }

  cash() {
    if (!this.started) return;
    this.tone(880, 0.08, 0.12, 'triangle');
    this.tone(1180, 0.14, 0.09, 'triangle');
  }

  ui() {
    if (!this.started) return;
    this.tone(420, 0.045, 0.07, 'square');
  }

  horn() {
    if (!this.started) return;
    this.tone(330, 0.3, 0.09, 'sawtooth');
    this.tone(415, 0.3, 0.07, 'sawtooth');
  }

  footsteps(time, moving) {
    if (!this.started || !moving) return;
    if (time - this.lastFoot < 0.34) return;
    this.lastFoot = time;
    this.noise(0.06, 0.12, 900, 'bandpass');
  }

  musicUpdate() {
    if (!this.started || !this.ctx) return;
    if (this.ctx.currentTime < this.nextNote) return;
    const chords = [
      [110.0, 130.81, 164.81, 220.0],
      [87.31, 110.0, 130.81, 174.61],
      [130.81, 164.81, 196.0, 261.63],
      [98.0, 123.47, 146.83, 196.0],
    ];
    const chord = chords[Math.floor(this.noteIndex / 8) % chords.length];
    const note = chord[this.noteIndex % chord.length];
    this.tone(note, 0.4, 0.028, 'triangle');
    if (this.noteIndex % 8 === 0) this.tone(chord[0] / 2, 1.6, 0.03, 'sine');
    if (this.noteIndex % 4 === 2) this.noise(0.05, 0.04, 5000);
    this.noteIndex += 1;
    this.nextNote = this.ctx.currentTime + 0.42;
  }

  update(dt, game) {
    if (!this.started) return;
    this.musicUpdate();
    this.footsteps(game.tick, game.player.moving && !game.player.car);
    const siren = game.police.wanted > 1 && game.police.nearestUnitDistance() < 90;
    this.setSiren(siren, game.tick);
    void dt;
  }
}
