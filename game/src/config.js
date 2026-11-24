// Palmshore: fixed facts about the city, the light and the people who live in it.
// World units are metres. The clock is frozen at golden hour; captures made tomorrow
// must be the captures made today.

export const GAME = {
  title: 'PALMSHORE',
  tagline: 'A SUN-BLEACHED CRIME STORY',
  subtitle: 'CITY OF SALT · COUNTY OF BAD DECISIONS',
  version: 'PALMSHORE 1.0',
  saveKey: 'palmshore.save.v1',
};

// Game time only. There is no wall clock anywhere in this build.
export const CLOCK = {
  hour: 17,
  minute: 42,
  label: '17:42',
  period: 'GOLDEN HOUR',
  temperature: 31,
  sun: { x: -0.92, y: 0.26, z: 0.3 },
  sunColor: '#ffd09a',
  shadowColor: 'rgba(22, 30, 38, 0.34)',
  skyTop: '#2f5f83',
  skyMid: '#d3a08e',
  skyLow: '#f6c184',
  horizon: '#ffcb8b',
  fog: '#e9b489',
  water: '#237f8c',
  waterDeep: '#145d6e',
  sand: '#e8cf9a',
  asphalt: '#3f4448',
  asphaltLight: '#4b5156',
  sidewalk: '#c9c0ab',
  curb: '#aaa08b',
  grass: '#7f9c5c',
};

export const VIEW = {
  designWidth: 1280,
  designHeight: 480,
  fov: 62,
  near: 0.3,
  far: 620,
  uiMin: 1,
  uiMax: 1.55,
};

// A deliberately small, dense city: seven by five blocks, one good boulevard,
// a beach and a sea horizon. What you can see matters more than what you cannot.
export const WORLD = {
  seed: 20261103,
  cols: 7,
  rows: 5,
  originX: 0,
  originZ: 0,
  pitch: 62,
  roadHalf: 7.6,
  walk: 3.5,
  beach: 48,
  water: 650,
  curbHeight: 0.18,
  fogNear: 52,
  fogFar: 245,
};

export const CITY = {
  maxX: WORLD.originX + WORLD.cols * WORLD.pitch + WORLD.roadHalf + WORLD.beach + WORLD.water,
  maxZ: WORLD.originZ + WORLD.rows * WORLD.pitch + WORLD.roadHalf + 160,
  gridX: (col) => WORLD.originX + col * WORLD.pitch,
  gridZ: (row) => WORLD.originZ + row * WORLD.pitch,
  beachX: WORLD.originX + WORLD.cols * WORLD.pitch + WORLD.roadHalf,
  waterX: WORLD.originX + WORLD.cols * WORLD.pitch + WORLD.roadHalf + WORLD.beach,
  width: WORLD.cols * WORLD.pitch,
  depth: WORLD.rows * WORLD.pitch,
};

export const DISTRICTS = {
  vireo: {
    id: 'vireo',
    name: 'VIREO CENTER',
    short: 'VIREO',
    accent: '#6fd0d8',
    palette: ['#3b5c6b', '#466c7c', '#537f8e', '#34505d', '#608f9b'],
    roofs: ['#2a414b', '#334e59', '#3e5b66'],
    glass: '#7fb9c6',
    style: 'glass',
    storefront: 0.42,
    heights: [18, 44],
    blurb: 'Glass towers, cold coffee, warm money.',
  },
  coral: {
    id: 'coral',
    name: 'CORAL STRIP',
    short: 'CORAL',
    accent: '#ff8264',
    palette: ['#e09573', '#eec69b', '#d97f73', '#e9b78c', '#c96f61', '#f2d9b5', '#d8a06f'],
    roofs: ['#a9604c', '#b87458', '#945044'],
    glass: '#9fd0d4',
    style: 'beach',
    storefront: 0.92,
    heights: [6, 15],
    blurb: 'Neon, salt, and somebody else\'s convertible.',
  },
  marlin: {
    id: 'marlin',
    name: 'MARLIN DOCKS',
    short: 'DOCKS',
    accent: '#74cfa9',
    palette: ['#80938a', '#94a193', '#6f8279', '#a89876', '#84917f'],
    roofs: ['#52645a', '#5e6f61', '#46574f'],
    glass: '#a6c7c2',
    style: 'dock',
    storefront: 0.55,
    heights: [7, 15],
    blurb: 'Bait, bilge pumps, and bosses who never fish.',
  },
  lantana: {
    id: 'lantana',
    name: 'LANTANA HILL',
    short: 'LANTANA',
    accent: '#f2b75f',
    palette: ['#dab486', '#cb946e', '#e8cca7', '#b98267', '#e6bb91'],
    roofs: ['#8d6048', '#9d7153', '#7c523e'],
    glass: '#b8d4d8',
    style: 'hill',
    storefront: 0.3,
    heights: [5, 10],
    blurb: 'Porch lights and lawn politics, up where it is cool.',
  },
  sabal: {
    id: 'sabal',
    name: 'SABAL PARK',
    short: 'SABAL',
    accent: '#93c96f',
    palette: ['#8fae6d', '#a4bf7e', '#7c9a5f'],
    roofs: ['#6d8754'],
    glass: '#b6d4c0',
    style: 'park',
    storefront: 0,
    heights: [3, 5],
    blurb: 'A green square with a fountain that has seen things.',
  },
  kestrel: {
    id: 'kestrel',
    name: 'KESTREL YARDS',
    short: 'KESTREL',
    accent: '#c0a76e',
    palette: ['#8a8c8e', '#9e9683', '#767e81', '#8f816d', '#646d70'],
    roofs: ['#505658', '#5e625f', '#434a4d'],
    glass: '#94aeb2',
    style: 'industrial',
    storefront: 0.25,
    heights: [10, 24],
    blurb: 'Cranes, containers, and no questions after dark.',
  },
};

export function districtFor(col, row) {
  if (col === 2 && row === 2) return 'sabal';
  if (col >= 5 && row <= 1) return 'kestrel';
  if (col >= 5) return 'coral';
  if (row >= 4 && col >= 3) return 'marlin';
  if (col <= 1 && row >= 2) return 'lantana';
  if (row <= 1) return 'vireo';
  return 'coral';
}

export const STREETS_H = [
  'KESTREL WAY', 'BANYAN ROW', 'SUNBURST AVE',
  'PALMETTO BLVD', 'CORAL WAY', 'TARPON CAUSEWAY',
];

export const STREETS_V = [
  'LANTANA RISE', 'VIREO ST', 'MANGO AVE', 'HERON ST',
  'SABAL RD', 'DOCK LN', 'MARLIN DR', 'TIDE AVE',
];

export const STOREFRONTS = [
  { name: 'SUNFADE LIQUOR', color: '#ff8a5b', kind: 'liquor' },
  { name: 'MANGO TANGO', color: '#ffb43c', kind: 'cafe' },
  { name: 'PELICAN PAWN', color: '#7ad0c0', kind: 'pawn' },
  { name: 'THE NEON CONCH', color: '#ff6f9c', kind: 'bar' },
  { name: 'BRINE & BLOOM', color: '#9ed18a', kind: 'florist' },
  { name: 'GULLWING DINER', color: '#ffe08a', kind: 'diner' },
  { name: 'SEAGLASS HOTEL', color: '#8ecbe8', kind: 'hotel' },
  { name: 'PALMETTO PHARMACY', color: '#a8e0a0', kind: 'pharmacy' },
  { name: 'THE SANDBAR', color: '#ffa0b4', kind: 'bar' },
  { name: 'DRIFTWOOD BOOKS', color: '#d9b78a', kind: 'books' },
  { name: 'TIDEWATER REALTY', color: '#87c9b4', kind: 'realty' },
  { name: 'HALO CAR WASH', color: '#9ad6ff', kind: 'wash' },
  { name: 'KING MACKEREL BAIT', color: '#e0b46a', kind: 'bait' },
  { name: 'COCO TAX', color: '#ffd166', kind: 'taxi' },
  { name: 'CASA VELA', color: '#f2a07b', kind: 'hotel' },
  { name: 'MARLIN HARDWARE', color: '#b5c6c0', kind: 'hardware' },
  { name: 'SALT & IRON', color: '#c9a27a', kind: 'gym' },
  { name: 'PELICAN POST', color: '#90b8d8', kind: 'post' },
  { name: 'LOW TIDE LAUNDRY', color: '#a6d8e0', kind: 'laundry' },
  { name: 'REEF RADIO 88.9', color: '#ff9b8a', kind: 'radio' },
];

export const BUILDING_PLATES = [
  '214', '318', '407', '512', '68B', '905', '1120', '77', '240', '1337', '88', '606',
];

// Four weapons and a pair of fists: the five slots of the wheel.
export const WEAPONS = [
  {
    id: 'fists', slot: 1, name: 'FISTS', short: 'FST', ammo: Infinity,
    damage: 14, rate: 0.34, range: 2.1, melee: true, color: '#f0d8b4',
    desc: 'Close quarters, no paperwork.',
  },
  {
    id: 'sidearm', slot: 2, name: 'SIDEARM', short: 'PST', ammo: 12, reserve: 96,
    damage: 24, rate: 0.24, spread: 0.018, speed: 128, pellets: 1, color: '#ffd166',
    desc: 'Palmshore\'s most popular accessory.',
  },
  {
    id: 'smg', slot: 3, name: 'SMG', short: 'SMG', ammo: 30, reserve: 180,
    damage: 13, rate: 0.075, spread: 0.062, speed: 145, pellets: 1, color: '#9ad6ff',
    desc: 'Loud, fast, gone before the chorus.',
  },
  {
    id: 'shotgun', slot: 4, name: 'SHOTGUN', short: 'SHG', ammo: 6, reserve: 36,
    damage: 11, rate: 0.78, spread: 0.19, speed: 108, pellets: 7, color: '#ff8a5b',
    desc: 'Seven conversations at once.',
  },
  {
    id: 'rifle', slot: 5, name: 'RIFLE', short: 'RFL', ammo: 20, reserve: 80,
    damage: 46, rate: 0.36, spread: 0.01, speed: 190, pellets: 1, color: '#d6b4ff',
    desc: 'For when the argument crosses the street.',
  },
];

export const ABILITIES = [
  { key: 'Z', id: 'focus', name: 'FOCUS', desc: 'Steady aim, slower world.', cooldown: 26 },
  { key: 'C', id: 'wind', name: 'SIDEWINDER', desc: 'Burst sprint / nitrous.', cooldown: 12 },
  { key: 'X', id: 'patch', name: 'PATCH UP', desc: '$250 · +35 health.', cooldown: 18 },
];

export const CAR_MODELS = {
  vela: {
    id: 'vela', name: 'VELA GT', kind: 'coupe', length: 4.7, width: 1.95, height: 1.22,
    maxSpeed: 37, accel: 15.5, brake: 27, grip: 8.8, turn: 2.5,
    colors: ['#d9503f', '#efe3c8', '#26343f', '#e0a03c', '#6f9f9a'],
    mass: 1.0,
  },
  marlin: {
    id: 'marlin', name: 'MARLIN 88', kind: 'sedan', length: 5.0, width: 2.0, height: 1.35,
    maxSpeed: 32, accel: 12.5, brake: 25, grip: 7.6, turn: 2.3,
    colors: ['#7fa8a0', '#e8cfa8', '#9a5d50', '#3f5560', '#cfd6cf'],
    mass: 1.1,
  },
  regent: {
    id: 'regent', name: 'REGENT', kind: 'muscle', length: 5.2, width: 2.1, height: 1.26,
    maxSpeed: 40, accel: 16.5, brake: 26, grip: 7.1, turn: 2.35,
    colors: ['#7a2f2f', '#2b2b30', '#b8893f'],
    mass: 1.15,
  },
  van: {
    id: 'van', name: 'KESTREL VAN', kind: 'van', length: 5.6, width: 2.2, height: 2.1,
    maxSpeed: 24, accel: 9, brake: 20, grip: 6.2, turn: 1.85,
    colors: ['#d8d2c0', '#7c8c83', '#b0684f'],
    mass: 1.35,
  },
  cab: {
    id: 'cab', name: 'CORAL CAB', kind: 'taxi', length: 5.0, width: 2.0, height: 1.4,
    maxSpeed: 30, accel: 11, brake: 24, grip: 7.2, turn: 2.25,
    colors: ['#e8b54a', '#f0c96a'],
    mass: 1.08,
  },
  cruiser: {
    id: 'cruiser', name: 'PALMSHORE PD', kind: 'police', length: 5.1, width: 2.05, height: 1.42,
    maxSpeed: 36, accel: 15, brake: 28, grip: 8.0, turn: 2.4,
    colors: ['#e9e6dc'],
    mass: 1.2,
  },
};

export const TRAFFIC_MODELS = ['marlin', 'van', 'cab', 'vela', 'marlin', 'marlin'];

export const RANKS = [
  { name: 'SAND FLEA', rp: 0 },
  { name: 'BEACH RAT', rp: 300 },
  { name: 'SHORE RUNNER', rp: 700 },
  { name: 'TIDE CHASER', rp: 1200 },
  { name: 'CORAL KING', rp: 1800 },
  { name: 'PALMSHORE LEGEND', rp: 2600 },
];

export const PED_COLORS = [
  '#e8c9a0', '#c78e63', '#8a5a3c', '#f0d8b8', '#6b4a32',
  '#5b8fa8', '#d96f5f', '#e8b54a', '#7fa88a', '#b47f9a',
  '#e8e2d0', '#4d5b6b', '#c9a06a', '#9ad6c0', '#ff9b8a',
];

export const UI = {
  ink: '#0f1b22',
  inkSoft: '#1b2c35',
  cream: '#f7efdc',
  creamDim: '#d9d0bb',
  gold: '#ffc857',
  goldDeep: '#d99b32',
  coral: '#ff6f61',
  mint: '#6fe0c0',
  sky: '#8ed6e8',
  pink: '#ff8fb1',
  police: '#79b8ff',
  danger: '#ff5c5c',
  shadow: 'rgba(6, 14, 18, 0.55)',
  panel: 'rgba(14, 26, 32, 0.88)',
  panelSolid: '#112029',
  line: 'rgba(247, 239, 220, 0.22)',
  lineStrong: 'rgba(247, 239, 220, 0.46)',
};

export const FONTS = {
  display: '"Arial Black", "Arial Bold", Impact, sans-serif',
  head: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
  body: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
  mono: 'Consolas, "Courier New", monospace',
};

export const SHOT_SAVE = {
  version: 1,
  money: 18450,
  rp: 620,
  missionIndex: 2,
  missionStage: 2,
  completed: [0, 1],
  weapons: {
    sidearm: { ammo: 12, reserve: 96 },
    smg: { ammo: 24, reserve: 150 },
    shotgun: { ammo: 6, reserve: 24 },
  },
  currentWeapon: 'smg',
  courierDone: 1,
  deaths: 1,
  arrests: 0,
  shot: true,
};
