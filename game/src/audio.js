// Every sound in Palmshore is made here with WebAudio: gunshots from noise and a low thump,
// engines from a sawtooth whose pitch tracks the throttle, a two-tone siren, surf, and a slow
// marimba score. No audio file is loaded and nothing needs the network.

import { clamp } from './math.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let enabled = true;
  let started = false;
  let listener = { x: 0, y: 0 };
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOscA = null;
  let sirenOscB = null;
  let sirenGain = null;
  let sirenAlarm = 0;
  let musicTimer = 0;
  let musicStep = 0;
  let mood = 'title';
  let surfGain = null;

  const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.62 : 0;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    started = true;
    return ctx;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function gainFor(x, y) {
    if (!Number.isFinite(x)) return 0.9;
    const d = Math.hypot(x - listener.x, y - listener.y);
    return clamp(1 - d / 1400, 0.08, 1);
  }

  function tone(freq, duration, type, volume, x, y, opts = {}) {
    if (!ensure() || !enabled) return;
    const t = now() + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = volume * gainFor(x, y);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + duration);
    if (opts.detune) osc.detune.value = opts.detune;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    let node = osc;
    if (opts.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filter;
      filter.frequency.value = opts.cutoff ?? 900;
      node.connect(filter);
      filter.connect(gain);
    } else {
      node.connect(gain);
    }
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noise(duration, volume, x, y, opts = {}) {
    if (!ensure() || !enabled) return;
    const t = now() + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = opts.rate ?? 1;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(opts.cutoff ?? 1400, t);
    if (opts.sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(80, opts.sweep), t + duration);
    filter.Q.value = opts.q ?? 0.8;
    const gain = ctx.createGain();
    const vol = volume * gainFor(x, y);
    gain.gain.setValueAtTime(Math.max(0.0002, vol), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + duration + 0.03);
  }

  function play(name, x, y) {
    if (!enabled) return;
    switch (name) {
      case 'pistol':
        noise(0.18, 0.5, x, y, { filter: 'highpass', cutoff: 500, sweep: 200 });
        tone(120, 0.13, 'square', 0.18, x, y, { slide: 52 });
        break;
      case 'shotgun':
        noise(0.34, 0.62, x, y, { cutoff: 900, sweep: 180, q: 0.5 });
        tone(88, 0.24, 'sawtooth', 0.24, x, y, { slide: 42 });
        break;
      case 'smg':
        noise(0.09, 0.32, x, y, { filter: 'highpass', cutoff: 700 });
        tone(160, 0.06, 'square', 0.1, x, y, { slide: 80 });
        break;
      case 'punch':
        tone(70, 0.11, 'sine', 0.32, x, y, { slide: 38 });
        noise(0.07, 0.22, x, y, { cutoff: 500 });
        break;
      case 'crash':
        noise(0.22, 0.38, x, y, { filter: 'bandpass', cutoff: 2200, sweep: 500, q: 1.2 });
        tone(150, 0.14, 'triangle', 0.16, x, y, { slide: 70 });
        break;
      case 'explosion':
        noise(0.7, 0.65, x, y, { filter: 'lowpass', cutoff: 1800, sweep: 120 });
        tone(70, 0.55, 'sawtooth', 0.34, x, y, { slide: 28 });
        break;
      case 'thud':
        noise(0.06, 0.16, x, y, { cutoff: 700 });
        break;
      case 'pickup':
        tone(660, 0.1, 'triangle', 0.2, x, y);
        tone(990, 0.16, 'triangle', 0.18, x, y, { delay: 0.07 });
        break;
      case 'click':
        tone(1200, 0.035, 'square', 0.08, x, y);
        break;
      case 'door':
        tone(120, 0.09, 'square', 0.14, x, y, { slide: 70 });
        noise(0.1, 0.14, x, y, { cutoff: 600 });
        break;
      case 'horn':
        tone(320, 0.32, 'square', 0.14, x, y);
        tone(404, 0.32, 'square', 0.1, x, y);
        break;
      case 'hurt':
        tone(140, 0.16, 'sawtooth', 0.2, x, y, { slide: 76 });
        noise(0.1, 0.14, x, y, { cutoff: 420 });
        break;
      case 'bodyfall':
        noise(0.16, 0.2, x, y, { filter: 'lowpass', cutoff: 350 });
        tone(90, 0.14, 'sine', 0.14, x, y, { slide: 50 });
        break;
      case 'wasted':
        tone(196, 0.9, 'sawtooth', 0.24, x, y, { slide: 62, filter: 'lowpass', cutoff: 700 });
        tone(147, 1.2, 'sine', 0.18, x, y, { slide: 50, delay: 0.12 });
        break;
      case 'busted':
        tone(440, 0.22, 'square', 0.18, x, y);
        tone(330, 0.22, 'square', 0.18, x, y, { delay: 0.24 });
        tone(220, 0.4, 'square', 0.18, x, y, { delay: 0.48 });
        break;
      case 'mission':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.42, 'triangle', 0.16, x, y, { delay: i * 0.1 }));
        break;
      case 'fail':
        [392, 330, 262].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.14, x, y, { delay: i * 0.14, filter: 'lowpass', cutoff: 900 }));
        break;
      case 'ui':
        tone(760, 0.05, 'triangle', 0.1, x, y);
        break;
      default:
        break;
    }
  }

  function ensureEngine() {
    if (engineOsc || !ensure()) return;
    engineOsc = ctx.createOscillator();
    engineFilter = ctx.createBiquadFilter();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 58;
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain.gain.value = 0.0001;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function ensureSiren() {
    if (sirenOscA || !ensure()) return;
    sirenOscA = ctx.createOscillator();
    sirenOscB = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOscA.type = 'square';
    sirenOscB.type = 'square';
    sirenOscA.frequency.value = 720;
    sirenOscB.frequency.value = 960;
    sirenGain.gain.value = 0.0001;
    sirenOscA.connect(sirenGain);
    sirenOscB.connect(sirenGain);
    sirenGain.connect(master);
    sirenOscA.start();
    sirenOscB.start();
  }

  function update(dt) {
    if (!ctx) return;
    // Engine follows the car Ray is in.
    const game = listener.game;
    const p = game?.player;
    const active = p && p.mode === 'car' && p.car && !p.dead;
    if (active) {
      ensureEngine();
      if (engineOsc) {
        const speed = Math.hypot(p.car.vx, p.car.vy);
        const ratio = clamp(speed / (p.car.spec?.top ?? 260), 0, 1.2);
        const throttle = Math.abs(p.car.throttle ?? 0);
        engineOsc.frequency.setTargetAtTime(48 + ratio * 120 + throttle * 14, now(), 0.06);
        engineFilter.frequency.setTargetAtTime(240 + ratio * 900, now(), 0.08);
        engineGain.gain.setTargetAtTime(0.03 + ratio * 0.05, now(), 0.08);
      }
    } else if (engineGain) {
      engineGain.gain.setTargetAtTime(0.0001, now(), 0.12);
    }

    // Siren rises when the police are close and the level is up.
    const police = game?.police;
    if (police && police.level > 0 && p && !p.dead) {
      ensureSiren();
      let near = 1200;
      for (const car of police.cars) near = Math.min(near, Math.hypot(car.x - p.x, car.y - p.y));
      const vol = police.level >= 3 ? 0.03 : 0.018;
      sirenGain?.gain.setTargetAtTime(vol * clamp(1 - near / 1200, 0, 1), now(), 0.2);
      sirenAlarm += dt * 3.2;
      const wobble = Math.sin(sirenAlarm) > 0 ? 1 : 0.78;
      sirenOscA?.frequency.setTargetAtTime(680 * wobble, now(), 0.03);
      sirenOscB?.frequency.setTargetAtTime(920 * wobble, now(), 0.03);
    } else if (sirenGain) {
      sirenGain.gain.setTargetAtTime(0.0001, now(), 0.3);
    }

    // A slow marimba score; the chase key changes when the police are on Ray.
    if (!enabled || !ctx) return;
    musicTimer -= dt;
    if (musicTimer <= 0) {
      const chase = police && police.level >= 2;
      musicTimer = chase ? 0.3 : 0.52;
      const root = chase ? 196 : 220;
      const beat = musicStep % 8;
      if (beat === 0 || beat === 3 || beat === 6) {
        tone(root * (beat === 6 ? 1.5 : 1), chase ? 0.22 : 0.5, 'triangle', 0.07, undefined, undefined, { filter: 'lowpass', cutoff: 900 });
      }
      if (Math.random() < (chase ? 0.7 : 0.45)) {
        const note = SCALE[(musicStep * 3 + (chase ? 2 : 0)) % SCALE.length] * (chase ? 0.75 : 1);
        tone(note, chase ? 0.18 : 0.6, 'sine', chase ? 0.05 : 0.06, undefined, undefined, { delay: 0.04 });
      }
      musicStep += 1;
    }
  }

  return {
    play,
    update,
    ensure,
    get enabled() {
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      if (master) master.gain.setTargetAtTime(enabled ? 0.62 : 0, now(), 0.05);
      if (enabled) ensure();
      return enabled;
    },
    setListener(x, y, game) {
      listener.x = x;
      listener.y = y;
      listener.game = game;
    },
    setMood(next) {
      mood = next;
    },
    get mood() {
      return mood;
    },
    resume() {
      ensure();
    },
  };
}
