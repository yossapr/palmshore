// Every tuning number, colour and name in one place: the city's size, the palette the whole game
// draws from, car stats, weapon stats and the wanted-level curve. Nothing below depends on the
// window size; the renderer fits the world to whatever canvas it is given.

export const STEP = 1 / 60;

/** The city's extents in world pixels. The water starts east of waterX; the sand east of sandX. */
export const WORLD = { width: 4280, height: 3300, sandX: 3878, waterX: 4132 };

export const CAMERA = {
  foot: 1.16,
  car: 0.92,
  min: 0.72,
  lookAhead: 0.42,
  smooth: 5.2,
  zoomSmooth: 2.4,
  shakeDecay: 6.5,
};

export const PLAYER = {
  radius: 9,
  walk: 112,
  run: 198,
  maxHealth: 100,
  maxArmour: 100,
  interact: 52,
  respawnCost: 200,
  bustCost: 150,
};

/** The wanted level grows through these heat thresholds (index = star count). */
export const WANTED = {
  thresholds: [0, 22, 65, 130, 220, 330],
  decayDelay: 5.0,
  decayRate: 16,
  max: 5,
  sirenRadius: 900,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 16, rate: 0.34, range: 36, melee: true, ammo: Infinity },
  pistol: {
    name: 'Pistol', damage: 27, rate: 0.24, range: 640, speed: 1450, spread: 0.02,
    pellets: 1, clip: 12, ammoMax: 144, pickup: 18, kick: 3,
  },
  shotgun: {
    name: 'Shotgun', damage: 14, rate: 0.8, range: 340, speed: 1150, spread: 0.115,
    pellets: 6, clip: 5, ammoMax: 40, pickup: 8, kick: 9,
  },
  smg: {
    name: 'SMG', damage: 15, rate: 0.085, range: 540, speed: 1500, spread: 0.055,
    pellets: 1, clip: 24, ammoMax: 240, pickup: 40, kick: 2,
  },
};

/** Physics is arcade: a top speed in px/s, an acceleration, and a grip that decides how it drifts. */
export const VEHICLES = {
  sedan: {
    name: 'Cabbie', length: 50, width: 25, maxSpeed: 255, accel: 235, brake: 430, reverse: 95,
    turn: 2.55, grip: 7.4, mass: 1, health: 130, weight: 1.0,
    colors: ['#d9d2c0', '#9aa7a3', '#c46a55', '#6f8794', '#e0b563'],
  },
  sports: {
    name: 'Brisa', length: 49, width: 24, maxSpeed: 372, accel: 320, brake: 480, reverse: 110,
    turn: 3.0, grip: 7.8, mass: 0.85, health: 100, weight: 0.8,
    colors: ['#e8563f', '#f0c651', '#4f9f92', '#f2efe4'],
  },
  muscle: {
    name: 'Vandal', length: 56, width: 27, maxSpeed: 338, accel: 300, brake: 400, reverse: 100,
    turn: 2.45, grip: 5.4, mass: 1.15, health: 165, weight: 1.15,
    colors: ['#b6352c', '#e5823a', '#2f4f63', '#f0e6cf'],
  },
  taxi: {
    name: 'Surf Cab', length: 51, width: 26, maxSpeed: 268, accel: 240, brake: 430, reverse: 95,
    turn: 2.6, grip: 7.0, mass: 1.05, health: 140, weight: 1.0,
    colors: ['#f2c14e'],
  },
  van: {
    name: 'Gull Van', length: 65, width: 30, maxSpeed: 215, accel: 175, brake: 350, reverse: 80,
    turn: 2.05, grip: 6.2, mass: 1.6, health: 220, weight: 1.6,
    colors: ['#e7e0cc', '#8fb3ad', '#c98a5a'],
  },
  pickup: {
    name: 'Flatbed', length: 70, width: 31, maxSpeed: 205, accel: 170, brake: 330, reverse: 75,
    turn: 1.95, grip: 5.6, mass: 1.9, health: 260, weight: 1.9,
    colors: ['#7c8a6c', '#b46a4a', '#d6ceb4'],
  },
  police: {
    name: 'Patrol', length: 53, width: 27, maxSpeed: 320, accel: 295, brake: 460, reverse: 105,
    turn: 2.75, grip: 7.0, mass: 1.2, health: 190, weight: 1.2,
    colors: ['#e9ece4'],
  },
  heli: { name: 'Gull Chopper', length: 60, width: 60, maxSpeed: 300, accel: 0, brake: 0, turn: 0, grip: 0, mass: 1, health: 1, weight: 0, colors: ['#2c3a42'] },
};

export const DISTRICTS = {
  downtown: {
    label: 'Verano Heights',
    ground: '#c7b795',
    lot: '#b9a888',
    roof: ['#9aa9ac', '#b4c0bd', '#86979c', '#c9cfc4', '#a9b6b8'],
    accent: '#5d7f8c',
    tower: true,
  },
  beach: {
    label: 'Coral Strip',
    ground: '#e4d3ac',
    lot: '#dbc79e',
    roof: ['#ead1b0', '#e2a58f', '#a9d0c8', '#eeddb8', '#d99a7d'],
    accent: '#e07f68',
    tower: false,
  },
  docks: {
    label: 'Gannet Docks',
    ground: '#b7ae97',
    lot: '#a8a08a',
    roof: ['#8c9084', '#a0715c', '#7f8b83', '#9c9a86'],
    accent: '#c58a4e',
    tower: false,
  },
  suburb: {
    label: 'Sunmint Acres',
    ground: '#a9b37e',
    lot: '#bcc48f',
    roof: ['#c97e63', '#ad8f6e', '#8ea79a', '#d2b184'],
    accent: '#7d9161',
    tower: false,
  },
  midtown: {
    label: 'Neon Row',
    ground: '#c9bda3',
    lot: '#bdb093',
    roof: ['#c7a48e', '#9aa8a7', '#d7c9a8', '#b3867a'],
    accent: '#d0645a',
    tower: false,
  },
  park: {
    label: 'Palmshore Park',
    ground: '#8fae63',
    lot: '#7d9d55',
    roof: ['#8fae63'],
    accent: '#5f843f',
    tower: false,
  },
};

/** The whole game draws from this: warm asphalt, bleached stucco, sea glass and sunset coral. */
export const PALETTE = {
  ink: '#211d18',
  inkSoft: '#3a332b',
  cream: '#f6ead2',
  paper: '#efe1c4',
  muted: '#b9ab90',
  asphalt: '#575044',
  asphaltDark: '#443e34',
  asphaltLight: '#665c4c',
  line: '#f0e4c6',
  lineWarm: '#e5c98c',
  walk: '#dcccaa',
  walkEdge: '#c6b393',
  curb: '#c0ad8c',
  sand: '#ecd7a6',
  sandDark: '#ddc38d',
  sea: '#2f7f8b',
  seaDeep: '#1d5c71',
  seaLight: '#57a9ad',
  foam: '#e2f3ea',
  grass: '#7d9b58',
  grassDark: '#5f7d42',
  palmTrunk: '#8a6942',
  palm: '#4c7338',
  palmLight: '#6c9146',
  towerGlass: '#7fa9b4',
  glassLight: '#b7d6d5',
  shadow: 'rgba(52,40,26,0.30)',
  shadowDeep: 'rgba(48,36,24,0.20)',
  shadowSoft: 'rgba(48,36,24,0.09)',
  sun: '#ffe4ae',
  wetSand: '#cfb583',
  coral: '#e2604a',
  gold: '#f2b94b',
  goldDeep: '#c98b2a',
  police: '#3b6ea8',
  policeRed: '#cf4b46',
  health: '#7fc46a',
  armour: '#6fa9cf',
  danger: '#d64b3f',
  blood: '#a23b32',
  white: '#fbf5e7',
};

export const FONT = {
  ui: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  display: '"Arial Black", "Segoe UI Black", Impact, system-ui, sans-serif',
  mono: '"Consolas", "SFMono-Regular", monospace',
};

export const SAVE_KEY = 'palmshore.save.v2';
export const SETTINGS_KEY = 'palmshore.settings.v1';
