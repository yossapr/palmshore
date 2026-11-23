// Palmshore's tuning and palette in one place: the city grid, the sun, the car handling,
// the weapons, the wanted rules and every colour the renderer uses. Nothing here draws.

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

/** The city grid. A block is `blockW` wide, a road `roadW`, so the pitch is their sum. */
export const CITY = {
  cols: 10,
  rows: 8,
  pitch: 460,
  roadW: 118,
  blockW: 342,
  sidewalk: 22,
  beachW: 560,
  harborH: 300,
  seed: 1,
};

export const CITY_WIDTH = CITY.cols * CITY.pitch + CITY.roadW + CITY.beachW;
export const CITY_HEIGHT = CITY.rows * CITY.pitch + CITY.roadW + CITY.harborH;

/** Water: the ocean east of the coast road, and the harbour south of the docks. */
export const COAST_X = CITY.cols * CITY.pitch + CITY.roadW + 320;
export const HARBOR_Y = CITY.rows * CITY.pitch + CITY.roadW + 120;

export const PALETTE = {
  sand: '#dfc99a',
  sandLight: '#f1e2bd',
  sandDeep: '#c9ae7c',
  cream: '#f8eed8',
  creamDim: '#eadcbe',
  coral: '#dd6b52',
  coralDeep: '#b34a37',
  coralLight: '#ee9a7c',
  teal: '#2e8f86',
  tealDeep: '#1c6663',
  tealLight: '#6cc0b0',
  green: '#2b5c40',
  greenLight: '#4f8159',
  greenPale: '#87a86a',
  ink: '#211d19',
  inkSoft: '#3b342c',
  inkFaint: 'rgba(33,29,25,0.18)',
  asphalt: '#5f5a52',
  asphaltDark: '#4b463f',
  asphaltLight: '#736c62',
  gutter: '#45403a',
  water: '#3d9c9c',
  waterDeep: '#1e6f78',
  waterLight: '#9ad8cb',
  foam: '#f2f6e9',
  glass: '#7fb3ae',
  blood: '#7d2b26',
  skin: ['#e8b58c', '#c98d63', '#8d5b3d', '#f0c8a3', '#a96f4b', '#6b422c'],
  hair: ['#2b2119', '#4a3320', '#161310', '#b98b4f', '#7d6b58', '#d8d2c4'],
  shirts: ['#dd6b52', '#2e8f86', '#f2e2be', '#2b5c40', '#e0a94f', '#8b6f9e', '#c95d75', '#4d7fa3'],
  pants: ['#3b4658', '#6a6157', '#d8c9a6', '#2a2b2f', '#7c5b4a', '#4b6b6b'],
  cars: ['#d9d3c3', '#2e8f86', '#dd6b52', '#2b3a45', '#e6b357', '#7a8b6f', '#a9c3c6', '#b34a37', '#f0e6d2', '#5a6a7a'],
  roofs: ['#c9ab8c', '#d9c4a3', '#b8a58d', '#cbb89c', '#a8a294', '#d3b699', '#bfae95', '#a9b0a0'],
  walls: ['#f2e4c6', '#e8d3ad', '#dcc2a0', '#f7eeda', '#d9c8ab', '#e6cbb4'],
  awning: ['#dd6b52', '#2e8f86', '#f0e2be', '#2b5c40', '#d9a94f'],
  signs: ['#2e8f86', '#dd6b52', '#2b5c40', '#211d19'],
};

export const FONT = {
  ui: '"Segoe UI", "Trebuchet MS", system-ui, sans-serif',
  display: 'Georgia, "Times New Roman", serif',
  narrow: '"Trebuchet MS", "Segoe UI", sans-serif',
};

/** The one sun sits to the north-west; every solid drops its shadow to the south-east. */
export const SUN = { dx: 9, dy: 13, angle: -2.28, wash: 'rgba(255,196,120,0.16)' };

export const PLAYER = {
  radius: 10,
  walk: 132,
  run: 236,
  accel: 12,
  aimTurn: 12,
  health: 100,
  armour: 0,
  hurtCooldown: 0.35,
  robRange: 86,
  enterRange: 74,
  respawnCost: 250,
};

export const VEHICLE = {
  radius: 15,
  drag: 0.62,
  grip: 6.4,
  handbrakeGrip: 1.15,
  steer: 2.5,
  reverseSteer: 1.7,
  maxHealth: 240,
  damageAt: 52,
  burnTime: 3.2,
};

export const VEHICLE_TYPES = {
  sedan: { length: 48, width: 24, accel: 240, top: 268, grip: 6.6, steer: 2.5, mass: 1 },
  coupe: { length: 46, width: 23, accel: 285, top: 320, grip: 6.1, steer: 2.7, mass: 0.95 },
  taxi: { length: 49, width: 24, accel: 225, top: 250, grip: 6.5, steer: 2.4, mass: 1.05 },
  van: { length: 58, width: 27, accel: 190, top: 220, grip: 5.6, steer: 2.0, mass: 1.5 },
  truck: { length: 66, width: 30, accel: 160, top: 190, grip: 5.2, steer: 1.8, mass: 1.9 },
  sports: { length: 47, width: 25, accel: 330, top: 370, grip: 6.9, steer: 2.8, mass: 0.9 },
  police: { length: 50, width: 25, accel: 305, top: 340, grip: 6.8, steer: 2.6, mass: 1.1 },
  pickup: { length: 55, width: 27, accel: 205, top: 240, grip: 5.7, steer: 2.1, mass: 1.4 },
};

export const WEAPONS = {
  fists: { name: 'FISTS', ammo: Infinity, damage: 24, rate: 0.32, range: 40, sound: 'punch', melee: true },
  pistol: { name: 'PISTOL', ammo: 12, damage: 26, rate: 0.24, speed: 760, spread: 0.035, sound: 'pistol', tracer: '#f4e2b0' },
  shotgun: { name: 'SHOTGUN', ammo: 6, damage: 20, pellets: 5, rate: 0.72, speed: 660, spread: 0.14, sound: 'shotgun', tracer: '#ffd9a0' },
  smg: { name: 'SMG', ammo: 30, damage: 15, rate: 0.085, speed: 820, spread: 0.07, sound: 'smg', tracer: '#ffe9b8' },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'shotgun', 'smg'];

export const WANTED = {
  max: 5,
  heatPerStar: 22,
  coolAfter: 7.5,
  decayEvery: 3.4,
  maxCops: 6,
  starsLabel: ['CLEAR', 'SUSPECT', 'WANTED', 'HUNTED', 'LOCKDOWN', 'MANHUNT'],
};

export const MISSIONS = {
  markerRadius: 34,
  bannerTime: 5.5,
  rewardTime: 4.5,
};

export const SAVE_KEY = 'palmshore.save.v1';
export const BEST_KEY = 'palmshore.best.v1';

/** The city's districts, by block. Used for building lots and the minimap's label. */
export const DISTRICT_NAMES = {
  downtown: 'DOWNTOWN',
  beach: 'CORAL STRIP',
  docks: 'MARINA DOCKS',
  park: 'SUNSET PARK',
  suburbs: 'PALM GROVE',
  midtown: 'TIDE HEIGHTS',
};
