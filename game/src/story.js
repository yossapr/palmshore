// The people of Palmshore and the words they say. Dialogue is a queue; the HUD draws
// whichever line is current, with a vector portrait drawn from the same spec.

export const CHARACTERS = {
  marisol: {
    id: 'marisol',
    name: 'MARISOL VANE',
    title: 'FIXER · CORAL STRIP',
    accent: '#ffc857',
    portraitBg: '#234247',
    skin: '#8a5a3e',
    skinShadow: '#663f2c',
    hair: '#d9cfba',
    hairStyle: 'bob',
    shirt: '#0f2630',
    jacket: '#2e756f',
    glasses: 'shades',
    earring: true,
    lip: '#8d4a3e',
    blink: 1.2,
  },
  dex: {
    id: 'dex',
    name: 'DEX CALLOWAY',
    title: 'RIVAL · THE REGENT',
    accent: '#ff8fb1',
    portraitBg: '#3a2330',
    skin: '#e0b08a',
    skinShadow: '#b9835f',
    hair: '#e8d6a8',
    hairStyle: 'mullet',
    shirt: '#ff8fb1',
    jacket: '#2b2028',
    glasses: 'shades',
    lip: '#a85a55',
    blink: 2.4,
  },
  salt: {
    id: 'salt',
    name: 'DET. RUBEN SALT',
    title: 'PALMSHORE PD · BADGE 114',
    accent: '#79b8ff',
    portraitBg: '#223447',
    skin: '#c78e63',
    skinShadow: '#996744',
    hair: '#3b3028',
    hairStyle: 'fedora',
    shirt: '#c9c5b4',
    jacket: '#7a6a52',
    glasses: 'aviators',
    moustache: true,
    scar: true,
    lip: '#7a4a3c',
    blink: 0.4,
  },
  pike: {
    id: 'pike',
    name: 'AURELIO PIKE',
    title: 'HARBOUR BOSS · MARLIN DOCKS',
    accent: '#ff7d64',
    portraitBg: '#43322a',
    skin: '#d9a77c',
    skinShadow: '#a97850',
    hair: '#b9b2a2',
    hairStyle: 'bald',
    shirt: '#f2ead2',
    jacket: '#d8c9a8',
    beard: true,
    earring: true,
    lip: '#8d5a48',
    blink: 3.0,
  },
  clerk: {
    id: 'clerk',
    name: 'SUNFADE CLERK',
    title: 'BEHIND THE COUNTER',
    accent: '#ffb43c',
    portraitBg: '#4a3826',
    skin: '#b97c50',
    skinShadow: '#8d5a38',
    hair: '#2a2420',
    hairStyle: 'short',
    shirt: '#e8d9b8',
    jacket: '#7a4a3c',
    lip: '#8a5040',
    blink: 1.8,
  },
  dispatch: {
    id: 'dispatch',
    name: 'PALMSHORE PD',
    title: 'DISPATCH · CHANNEL 4',
    accent: '#8ed6e8',
    portraitBg: '#172a35',
    skin: '#c78e63',
    skinShadow: '#996744',
    hair: '#1f2a30',
    hairStyle: 'short',
    shirt: '#20344a',
    jacket: '#16283a',
    glasses: 'shades',
    lip: '#7a4a3c',
    blink: 0.8,
  },
  rook: {
    id: 'rook',
    name: 'ROOK',
    title: 'CORAL STRIP · NO FIXED ADDRESS',
    accent: '#ff7d64',
    portraitBg: '#24323a',
    skin: '#b97c50',
    skinShadow: '#8d5a38',
    hair: '#221d1b',
    hairStyle: 'short',
    shirt: '#f0e4c8',
    jacket: '#2c3a40',
    lip: '#8a5040',
    blink: 2.0,
  },
};

export class Story {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.current = null;
    this.elapsed = 0;
    this.shown = 0;
  }

  say(speakerId, text, duration = 6.4) {
    this.queue.push({ speakerId, text, duration });
    if (!this.current) this.advance();
  }

  advance() {
    const next = this.queue.shift();
    if (!next) {
      this.current = null;
      this.elapsed = 0;
      this.shown = 0;
      return;
    }
    this.current = next;
    this.elapsed = 0;
    this.shown = 0;
  }

  update(dt) {
    if (!this.current) return;
    this.elapsed += dt;
    const speed = 44;
    this.shown = Math.min(this.current.text.length, Math.floor(this.elapsed * speed));
    if (this.elapsed > this.current.duration + this.current.text.length / speed) this.advance();
  }

  setLine(speakerId, text, options = {}) {
    this.current = { speakerId, text, duration: options.duration ?? 999 };
    this.elapsed = options.elapsed ?? 20;
    this.shown = text.length;
    this.queue = options.queue ? [...options.queue] : [];
  }

  get line() {
    if (!this.current) return null;
    return {
      character: CHARACTERS[this.current.speakerId] ?? CHARACTERS.rook,
      text: this.current.text.slice(0, this.shown),
      full: this.current.text,
      speakerId: this.current.speakerId,
      progress: this.shown / Math.max(1, this.current.text.length),
    };
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.elapsed = 0;
    this.shown = 0;
  }

  character(id) {
    return CHARACTERS[id] ?? CHARACTERS.rook;
  }
}
