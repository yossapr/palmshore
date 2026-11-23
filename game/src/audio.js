// All sound is synthesised here with the Web Audio API: no files, no network. Gunshots are noise
// bursts, the engine is a filtered saw wave tied to road speed, the siren is a wailing oscillator,
// and a slow four-chord pad sits under the city. Audio starts on the first key press.

export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = true;
  let engine = null;
  let siren = null;
  let tyres = null;
  let noiseBuffer = null;
  let musicTimer = 0;
  let chordIndex = 0;
  let started = false;

  function ensure() {
    if (!enabled) return null;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      started = true;
      startEngine();
      startAmbience();
      return ctx;
    } catch {
      ctx = null;
      return null;
    }
  }

  function noise(duration, volume, filterFreq = 1800, type = 'lowpass') {
    const audio = ensure();
    if (!audio) return;
    const source = audio.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = audio.createGain();
    const now = audio.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  function tone(freq, duration, volume, type = 'sine', slide = null) {
    const audio = ensure();
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function startEngine() {
    const audio = ctx;
    const osc = audio.createOscillator();
    const sub = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    osc.type = 'sawtooth';
    sub.type = 'triangle';
    osc.frequency.value = 58;
    sub.frequency.value = 29;
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 3;
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    sub.start();
    engine = { osc, sub, filter, gain };
  }

  function startAmbience() {
    const audio = ctx;
    // Sea wash: filtered noise with a slow swell.
    const source = audio.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const gain = audio.createGain();
    gain.gain.value = 0.022;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    const lfo = audio.createOscillator();
    const lfoGain = audio.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
  }

  function playChord() {
    if (!ctx || !enabled) return;
    const roots = [196, 174.6, 146.8, 164.8];
    const root = roots[chordIndex % roots.length];
    chordIndex += 1;
    const notes = [root, root * 1.25, root * 1.5, root * 2];
    const now = ctx.currentTime;
    for (const freq of notes) {
      for (const detune of [-3, 3]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.012, now + 1.6);
        gain.gain.linearRampToValueAtTime(0.0001, now + 7.5);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 7.7);
      }
    }
  }

  function startSiren() {
    if (siren || !ctx) return;
    const audio = ctx;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const lfo = audio.createOscillator();
    const lfoGain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = 760;
    gain.gain.value = 0;
    lfo.type = 'sine';
    lfo.frequency.value = 0.55;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    siren = { osc, gain, lfo };
  }

  function startTyres() {
    if (tyres || !ctx) return;
    const audio = ctx;
    const source = audio.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    filter.Q.value = 4;
    const gain = audio.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    tyres = { gain };
  }

  return {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = value;
      if (!value) {
        if (master) master.gain.value = 0;
      } else {
        const audio = ensure();
        if (audio && master) master.gain.value = 0.55;
        if (audio && !tyres) startTyres();
      }
    },
    resume() { ensure(); },
    toggle() {
      this.setEnabled(!enabled);
      return enabled;
    },
    update(game, dt) {
      if (!ctx) return;
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer = 9;
        if (!game.player.inCar) playChord();
      }
      if (engine) {
        const speed = game.player.inCar
          ? Math.hypot(game.player.inCar.vx, game.player.inCar.vy)
          : Math.hypot(game.player.vx, game.player.vy) * 0.4;
        const target = game.player.inCar ? 0.035 + Math.min(0.05, speed / 8000) : 0;
        engine.gain.gain.value += (target - engine.gain.gain.value) * Math.min(1, dt * 4);
        const freq = 52 + Math.min(150, speed * 0.55);
        engine.osc.frequency.value += (freq - engine.osc.frequency.value) * Math.min(1, dt * 6);
        engine.sub.frequency.value = engine.osc.frequency.value * 0.5;
        engine.filter.frequency.value = 320 + speed * 1.1;
      }
      const wanted = game.wanted.level > 0 && game.policeNear();
      if (wanted && !siren) {
        startSiren();
      }
      if (siren) {
        const target = wanted ? 0.022 : 0;
        siren.gain.gain.value += (target - siren.gain.gain.value) * Math.min(1, dt * 5);
      }
      if (tyres) {
        const car = game.player.inCar;
        const slip = car ? Math.abs(car.vx * -Math.sin(car.angle) + car.vy * Math.cos(car.angle)) : 0;
        const target = car && slip > 45 ? Math.min(0.05, slip / 2600) : 0;
        tyres.gain.gain.value += (target - tyres.gain.gain.value) * Math.min(1, dt * 8);
      }
    },
    shoot(weapon = 'pistol') {
      noise(weapon === 'shotgun' ? 0.3 : 0.11, weapon === 'shotgun' ? 0.5 : 0.34, weapon === 'shotgun' ? 900 : 1800);
      tone(weapon === 'shotgun' ? 90 : 150, 0.1, 0.22, 'square', 50);
    },
    explosion() {
      noise(0.9, 0.75, 480);
      tone(70, 0.7, 0.45, 'sine', 28);
    },
    hit() { noise(0.08, 0.22, 2600); },
    pickup() { tone(660, 0.09, 0.09, 'triangle'); setTimeout(() => tone(990, 0.1, 0.08, 'triangle'), 70); },
    cash() { tone(880, 0.07, 0.08, 'square'); setTimeout(() => tone(1320, 0.09, 0.07, 'square'), 60); },
    ui() { tone(520, 0.04, 0.06, 'square'); },
    mission() {
      tone(523, 0.2, 0.08, 'triangle');
      setTimeout(() => tone(659, 0.2, 0.08, 'triangle'), 140);
      setTimeout(() => tone(784, 0.32, 0.09, 'triangle'), 280);
    },
    fail() {
      tone(220, 0.5, 0.12, 'sawtooth', 110);
    },
    horn() {
      tone(392, 0.28, 0.07, 'square');
      tone(494, 0.28, 0.05, 'square');
    },
    sirenOn() { startSiren(); },
  };
}
