// The four staged screenshot scenes behind ?shot=chase|boulevard|shootout|crane. Each one clears
// the simulation, places real game entities at a chosen moment, burns a little scripted driving
// so the skid marks and poses are genuine, and freezes the clock. The frame is the game's own
// renderer and HUD; nothing is drawn twice or faked.

import { STEP, PALETTE } from './config.js';
import { PLACES } from './world.js';
import { createPerson } from './people.js';
import { spawnVehicle, stepVehicle } from './vehicles.js';
import { createWanted } from './police.js';
import { addSkid, addParticle, muzzleFlash, spark, puff } from './effects.js';
import { CHARACTERS, MISSIONS } from './story.js';
import { createCivilianAt } from './pedestrians.js';
import { WEAPONS } from './config.js';

function clearScene(game) {
  game.people = [];
  game.vehicles = [];
  game.bullets = [];
  game.particles = [];
  game.marks = [];
  game.scorches = [];
  game.pickups = [];
  game.notifications = [];
  game.markers = [];
  game.dialogue = null;
  game.mission = null;
  game.missionPassed = null;
  game.activityObjective = null;
  game.activity = { active: false, stage: 0, timer: 0, points: [], cooldown: 0 };
  game.boss = null;
  game.heli = null;
  game.objective = null;
  game.wanted = createWanted();
  game.mode = 'shot';
  game.player.inCar = null;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.weapon = 'pistol';
  game.player.ammo = { pistol: 24, shotgun: 0, smg: 0 };
  game.player.owned = { fists: true, pistol: true, shotgun: false, smg: false };
  game.player.health = 100;
  game.player.armour = 0;
  game.player.cash = 1200;
  game.prompt = null;
  game.markerPrompt = null;
  game.stats = { missions: 2, deliveries: 4, robberies: 3, kills: 6, shots: 40, distance: 12000 };
  game.audio.setEnabled(false);
}

function focusCamera(game, x, y, zoom) {
  const camera = game.camera;
  camera.x = x;
  camera.y = y;
  camera.zoom = zoom;
  camera.targetZoom = zoom;
  camera.shakeX = 0;
  camera.shakeY = 0;
  const halfW = game.renderer.width / (2 * zoom);
  const halfH = game.renderer.height / (2 * zoom);
  camera.bounds = { x0: x - halfW - 80, y0: y - halfH - 80, x1: x + halfW + 80, y1: y + halfH + 80 };
}

function poseCar(game, type, x, y, angle, color, options = {}) {
  const car = spawnVehicle(game, type, x, y, angle, { color, ...options });
  car.vx = options.vx ?? Math.cos(angle) * 30;
  car.vy = options.vy ?? Math.sin(angle) * 30;
  car.parked = false;
  return car;
}

function posePed(game, x, y, angle, options = {}) {
  const person = createPerson(game, {
    team: options.team ?? 'civil', x, y, angle,
    health: options.health ?? 100, armed: options.armed ?? false, weapon: options.weapon ?? 'pistol',
    shirt: options.shirt, pants: options.pants, skin: options.skin, hair: options.hair,
  });
  person.walkPhase = options.walkPhase ?? 1.2;
  person.state = options.state ?? 'walk';
  person.panic = options.panic ?? 0;
  person.aim = angle;
  return person;
}

function drift(game, car, startX, startY, angle, frames, steer) {
  car.x = startX;
  car.y = startY;
  car.angle = angle;
  car.vx = Math.cos(angle) * 180;
  car.vy = Math.sin(angle) * 180;
  for (let i = 0; i < frames; i += 1) {
    car.controls.throttle = 0.9;
    car.controls.brake = 0;
    car.controls.steer = i < frames * 0.45 ? steer : -steer * 0.55;
    car.controls.handbrake = true;
    stepVehicle(game, car, STEP);
  }
}

function chaseShot(game) {
  clearScene(game);
  game.time = 41.6;
  game.districtLabel = 'Coral Strip';
  const playerCar = poseCar(game, 'muscle', 3770, 1510, Math.PI / 2 + 0.03, '#b6352c', { driver: 'player' });
  drift(game, playerCar, 3770, 1520, Math.PI / 2 + 0.03, 48, 0.4);
  playerCar.x = 3770;
  playerCar.y = 1608;
  playerCar.vx = 12;
  playerCar.vy = 172;
  playerCar.angle = Math.PI / 2 + 0.1;
  game.player.inCar = playerCar;
  game.player.x = playerCar.x;
  game.player.y = playerCar.y;
  game.player.angle = playerCar.angle;
  game.player.health = 84;
  game.player.armour = 45;
  game.player.cash = 2460;
  game.player.owned.smg = true;
  game.player.weapon = 'smg';
  game.player.ammo.smg = 96;
  game.player.ammo.pistol = 34;

  // Cruisers on the player's tail and a roadblock waiting at the Coral Avenue crossing.
  const copA = poseCar(game, 'police', 3748, 1520, Math.PI / 2 + 0.13, '#edf0e7', { police: true, driver: 'police', vx: 8, vy: 168 });
  copA.sirenPhase = 0.4;
  const copB = poseCar(game, 'police', 3810, 1506, Math.PI / 2 - 0.09, '#e6e9dd', { police: true, driver: 'police', vx: -3, vy: 175 });
  copB.sirenPhase = 2.7;
  const copC = poseCar(game, 'police', 3736, 1746, 0.05, '#f0f2e9', { police: true, driver: 'police', vx: 0, vy: 0 });
  copC.sirenPhase = 1.1;
  const copD = poseCar(game, 'police', 3804, 1750, -0.08, '#e9ece1', { police: true, driver: 'police', vx: 0, vy: 0 });
  copD.sirenPhase = 3.4;
  const copE = poseCar(game, 'police', 3840, 1636, -Math.PI / 2, '#eef0e6', { police: true, driver: 'police', vx: 0, vy: -120 });
  copE.sirenPhase = 5.1;

  // Traffic in both directions, and the roadblock backing up the southbound lane.
  poseCar(game, 'taxi', 3760, 1692, Math.PI / 2, '#f2c14e', { vx: 0, vy: 60 });
  poseCar(game, 'sedan', 3840, 1728, -Math.PI / 2, '#d9d2c0', { vx: 0, vy: -110 });
  poseCar(game, 'van', 3840, 1476, -Math.PI / 2, '#8fb3ad', { vx: 0, vy: -120 });
  poseCar(game, 'sports', 3572, 1677, 0, '#4f9f92', { vx: 130, vy: 0 });
  poseCar(game, 'sedan', 3822, 1880, Math.PI / 2, '#c46a55', { vx: 0, vy: 120 });
  poseCar(game, 'muscle', 3760, 1360, Math.PI / 2, '#2f4f63', { vx: 0, vy: 110 });

  // People scattering off both pavements; officers behind the roadblock.
  for (let i = 0; i < 11; i += 1) {
    const east = i % 2 === 0;
    posePed(game, east ? 3876 : 3728, 1420 + i * 48, east ? -Math.PI / 2 : Math.PI / 2, {
      state: 'flee', panic: 3, walkPhase: i * 1.7, shirt: i % 4 === 0 ? '#e4d6b8' : undefined,
    });
  }
  posePed(game, 3706, 1782, -Math.PI / 2 + 0.2, { team: 'police', armed: true, health: 100 });
  posePed(game, 3834, 1786, -Math.PI / 2 - 0.2, { team: 'police', armed: true, health: 100 });
  posePed(game, 3960, 1540, -Math.PI / 2, { walkPhase: 1.4 });
  posePed(game, 3988, 1750, Math.PI / 2, { walkPhase: 3.1, shirt: '#d86a52' });

  // The cruiser behind is firing; tracers and sparks read the chase as hot.
  const aim = Math.atan2(playerCar.y - copA.y, playerCar.x - copA.x);
  muzzleFlash(game, copA.x + Math.cos(aim) * 27, copA.y + Math.sin(aim) * 27, aim);
  for (const particle of game.particles) {
    if (particle.kind === 'flash') {
      particle.life = 0.6;
      particle.max = 0.6;
      particle.size = 24;
    }
  }
  game.bullets.push(
    { x: copA.x + Math.cos(aim) * 58, y: copA.y + Math.sin(aim) * 58, px: copA.x, py: copA.y, vx: Math.cos(aim) * 1300, vy: Math.sin(aim) * 1300, life: 0.5, damage: 27, owner: 'police', weapon: 'pistol' },
    { x: copB.x + Math.cos(aim + 0.08) * 44, y: copB.y + Math.sin(aim + 0.08) * 44, px: copB.x, py: copB.y, vx: Math.cos(aim + 0.08) * 1300, vy: Math.sin(aim + 0.08) * 1300, life: 0.5, damage: 27, owner: 'police', weapon: 'pistol' },
  );
  spark(game, playerCar.x - 12, playerCar.y + 24, -1.9, 6, '#ffd98a');
  game.wanted = { heat: 162, level: 3, seen: 0, fade: 0, lastCrime: 'grand theft auto' };
  game.objective = {
    number: 5, title: 'High Tide', label: 'Shake the tail — reach Marina 7',
    hint: 'Break line of sight, then head south along Ocean Drive',
    x: PLACES.marina.x, y: PLACES.marina.y, distance: Math.hypot(PLACES.marina.x - game.player.x, PLACES.marina.y - game.player.y),
    extra: null,
  };
  game.markers = [];
  addSkid(game, 3704, 1578, 3738, 1598, 0.85);
  addSkid(game, 3714, 1574, 3748, 1594, 0.8);
  addSkid(game, 3738, 1598, 3762, 1604, 0.75);
  addSkid(game, 3722, 1622, 3694, 1682, 0.5);
  addSkid(game, 3736, 1620, 3708, 1678, 0.45);
  addSkid(game, 3778, 1604, 3758, 1652, 0.6);
  addSkid(game, 3792, 1602, 3772, 1650, 0.55);
  addSkid(game, 3760, 1570, 3736, 1640, 0.45);
  addSkid(game, 3824, 1552, 3800, 1612, 0.4);
  puff(game, 3742, 1592, '#e6ddca', 9);
  puff(game, 3756, 1586, '#e6ddca', 8);
  puff(game, 3748, 1618, '#e6ddca', 7);
  puff(game, 3792, 1614, '#e6ddca', 6);
  focusCamera(game, 3800, 1632, 1.2);
}

function boulevardShot(game) {
  clearScene(game);
  game.time = 22.4;
  game.districtLabel = 'Verona Heights';
  const car = poseCar(game, 'sports', 2417, 1524, -Math.PI / 2, '#4f9f92', { driver: 'player' });
  drift(game, car, 2417, 1524, -Math.PI / 2, 24, 0.12);
  car.x = 2417;
  car.y = 1440;
  car.vx = 0;
  car.vy = -200;
  car.angle = -Math.PI / 2 + 0.02;
  game.player.inCar = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.player.angle = car.angle;
  game.player.health = 100;
  game.player.armour = 20;
  game.player.cash = 3180;
  game.player.weapon = 'pistol';
  game.player.ammo.pistol = 41;
  poseCar(game, 'taxi', 2417, 1316, -Math.PI / 2, '#f2c14e', { vx: 0, vy: -150 });
  poseCar(game, 'van', 2417, 1214, -Math.PI / 2, '#e7e0cc', { vx: 0, vy: -120 });
  poseCar(game, 'sedan', 2383, 1380, Math.PI / 2, '#d9d2c0', { vx: 0, vy: 150 });
  poseCar(game, 'sports', 2383, 1562, Math.PI / 2, '#e8563f', { vx: 0, vy: 170 });
  poseCar(game, 'muscle', 2417, 1596, -Math.PI / 2, '#2f4f63', { vx: 0, vy: 130 });
  poseCar(game, 'sedan', 2460, 1176, -Math.PI / 2, '#6f8794', { vx: 0, vy: -140 });
  for (let i = 0; i < 8; i += 1) {
    posePed(game, i % 2 === 0 ? 2333 : 2467, 1250 + i * 46, i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2, { walkPhase: i * 2.1 });
  }
  posePed(game, 2304, 1580, -Math.PI / 2, { walkPhase: 0.4, skin: '#6f4a33' });
  posePed(game, 2480, 1508, Math.PI / 2, { walkPhase: 2.2, shirt: '#d86a52' });
  game.activity = {
    active: true, stage: 1, timer: 64,
    points: [{ x: 2460, y: 1310, done: false }, { ...PLACES.ammo, done: false }, { ...PLACES.park, done: false }],
    cooldown: 0,
  };
  game.activityObjective = {
    label: 'Courier drop 1 of 3', x: 2460, y: 1310,
    timer: 64, distance: Math.hypot(2460 - car.x, 1310 - car.y),
  };
  game.markers = [{ x: 2460, y: 1310, kind: 'activity', label: 'Courier drop' }];
  focusCamera(game, 2417, 1420, 1.0);
}
function shootoutShot(game) {
  clearScene(game);
  game.time = 28.8;
  game.districtLabel = 'Palmshore Park';
  const player = game.player;
  player.x = 2338;
  player.y = 1880;
  player.angle = Math.atan2(1876 - player.y, 2448 - player.x);
  player.health = 47;
  player.armour = 58;
  player.cash = 1875;
  player.weapon = 'pistol';
  player.ammo.pistol = 43;
  player.inCar = null;

  const wreck = poseCar(game, 'police', 2276, 1932, 0.42, '#3f3a33', { police: true });
  wreck.burning = 1.4;
  wreck.health = 0;
  wreck.siren = false;
  const cruiser = poseCar(game, 'police', 2448, 1812, Math.PI / 2 + 0.08, '#eef0e6', { police: true, driver: 'police' });
  cruiser.sirenPhase = 0.6;
  const cruiser2 = poseCar(game, 'police', 2374, 1990, 0.2, '#e9ece2', { police: true, driver: 'police' });
  cruiser2.sirenPhase = 2.2;
  poseCar(game, 'sports', 2554, 1978, 1.1, '#4f9f92', {});

  const officerA = posePed(game, 2448, 1876, Math.PI - 0.12, { team: 'police', armed: true, health: 100 });
  const officerB = posePed(game, 2474, 1938, Math.PI - 0.5, { team: 'police', armed: true, health: 100 });
  const officerC = posePed(game, 2380, 1800, Math.PI * 0.55, { team: 'police', armed: true, health: 100 });
  const downed = posePed(game, 2398, 1928, 1.4, { team: 'police', health: 0 });
  downed.dead = true;
  downed.deadTimer = 3;
  officerA.aim = Math.atan2(player.y - officerA.y, player.x - officerA.x);
  officerB.aim = Math.atan2(player.y - officerB.y, player.x - officerB.x);
  officerC.aim = Math.atan2(player.y - officerC.y, player.x - officerC.x);
  for (let i = 0; i < 6; i += 1) {
    posePed(game, 2130 + (i % 3) * 44, 1920 + Math.floor(i / 3) * 60, Math.PI * 0.7, { state: 'flee', panic: 4, walkPhase: i });
  }
  posePed(game, 2468, 1866, Math.PI / 2, { state: 'flee', panic: 4, walkPhase: 1.2, shirt: '#d7c0a4' });
  game.wanted = { heat: 246, level: 4, seen: 0, fade: 0, lastCrime: 'officer down' };
  game.heli = {
    x: 2568, y: 1790, angle: 1.1, rotor: 2.4,
    spotX: player.x + 8, spotY: player.y - 4, fire: 1.2, alive: true,
  };

  const muzzleX = player.x + Math.cos(player.angle) * 17;
  const muzzleY = player.y + Math.sin(player.angle) * 17;
  muzzleFlash(game, muzzleX, muzzleY, player.angle);
  for (const particle of game.particles) {
    if (particle.kind === 'flash') {
      particle.life = 0.7;
      particle.max = 0.7;
      particle.size = 16;
    }
  }
  game.bullets.push(
    { x: muzzleX + 30, y: muzzleY + 8, px: muzzleX, py: muzzleY, vx: Math.cos(player.angle) * 1450, vy: Math.sin(player.angle) * 1450, life: 0.4, damage: 27, owner: 'player', weapon: 'pistol' },
    { x: muzzleX + 64, y: muzzleY + 17, px: muzzleX, py: muzzleY, vx: Math.cos(player.angle + 0.03) * 1450, vy: Math.sin(player.angle + 0.03) * 1450, life: 0.4, damage: 27, owner: 'player', weapon: 'pistol' },
    { x: 2426, y: 1874, px: 2446, py: 1874, vx: -820, vy: 40, life: 0.4, damage: 27, owner: 'police', weapon: 'pistol' },
  );
  spark(game, officerA.x, officerA.y, 2.2, 7, '#ffd98a');
  spark(game, 2338, 1928, -0.4, 6, '#ffe1a0');
  for (let i = 0; i < 7; i += 1) {
    addParticle(game, {
      kind: 'fire', x: 2276 + (Math.random() - 0.5) * 26, y: 1932 + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, life: 0.8, max: 0.8,
      size: 6 + Math.random() * 6, grow: 9, color: Math.random() > 0.5 ? '#ffb03a' : '#e2604a',
    });
  }
  for (let i = 0; i < 5; i += 1) {
    puff(game, 2272 + (Math.random() - 0.5) * 30, 1920 - i * 14, '#5f584e', 10);
  }
  addSkid(game, 2326, 1958, 2290, 1974, 0.45);
  game.notifications = [{ text: 'WANTED LEVEL ★★★★', life: 4, max: 4, kind: 'danger' }];
  game.prompt = null;
  focusCamera(game, 2392, 1878, 1.45);
}
function craneShot(game) {
  clearScene(game);
  game.time = 16.8;
  game.districtLabel = 'Gannet Docks';
  const player = game.player;
  player.x = 1430;
  player.y = 2484;
  player.angle = Math.PI + 0.55;
  player.health = 100;
  player.armour = 50;
  player.cash = 2120;
  player.weapon = 'pistol';
  player.ammo.pistol = 29;
  player.owned.shotgun = true;
  player.ammo.shotgun = 12;
  const truck = poseCar(game, 'pickup', 1358, 2406, 0.02, '#b46a4a', { label: 'Gull Flatbed', mission: 'crane-game' });
  truck.vx = 0;
  truck.vy = 0;
  const gullA = posePed(game, 1362, 2530, -Math.PI / 2 + 0.4, { team: 'gang', armed: true, weapon: 'pistol', health: 90, shirt: '#5c4a54' });
  const gullB = posePed(game, 1492, 2542, -Math.PI / 2 - 0.3, { team: 'gang', armed: true, weapon: 'smg', health: 95, shirt: '#6e4a48' });
  const gullC = posePed(game, 1520, 2452, Math.PI * 0.5, { team: 'gang', armed: true, weapon: 'pistol', health: 90, shirt: '#4c4a56' });
  gullA.aim = Math.atan2(player.y - gullA.y, player.x - gullA.x);
  gullB.aim = Math.atan2(player.y - gullB.y, player.x - gullB.x);
  gullC.aim = Math.atan2(player.y - gullC.y, player.x - gullC.x);
  for (let i = 0; i < 3; i += 1) {
    posePed(game, 1210 + i * 42, 2570 + (i % 2) * 38, Math.PI * 0.7, { state: 'flee', panic: 4, walkPhase: i * 1.4 });
  }
  // Quayside clutter around the flatbed.
  game.world.props.push(
    { kind: 'container', x: 1188, y: 2462, angle: 0, color: '#a8523f' },
    { kind: 'container', x: 1254, y: 2462, angle: 0, color: '#4e7f86' },
    { kind: 'crate', x: 1320, y: 2452 },
    { kind: 'crate', x: 1310, y: 2478 },
    { kind: 'crane', x: 1676, y: 2482, angle: 0 },
  );
  game.objective = {
    number: 4, title: 'Crane Game', label: 'Steal the flatbed on Gannet Road',
    hint: 'The Gulls have noticed. Keep the engine running.',
    x: truck.x, y: truck.y, distance: Math.hypot(truck.x - player.x, truck.y - player.y), extra: null,
  };
  game.markers = [];
  game.dialogue = {
    lines: [{ speaker: CHARACTERS.IVY, text: "The flatbed is on Gannet Road. Dorsey's boys will notice, so keep the engine running." }],
    index: 0,
    reveal: 200,
    onDone: null,
  };
  game.wanted = { heat: 0, level: 0, seen: 0, fade: 0, lastCrime: null };
  game.missionIndex = 3;
  for (const building of game.world.buildings) {
    if (Math.abs(building.x + building.w / 2 - 1400) < 420 && Math.abs(building.y + building.h / 2 - 2620) < 420) {
      building.sign = 'GULL FREIGHT';
    }
  }
  focusCamera(game, 1428, 2508, 1.4);
  game.audio.setEnabled(false);
}
export function stageShot(name, game) {
  game.renderer.resize();
  if (name === 'boulevard') boulevardShot(game);
  else if (name === 'shootout') shootoutShot(game);
  else if (name === 'crane') craneShot(game);
  else chaseShot(game);
  game.prompt = name === 'crane' ? { key: 'E', text: 'Get in the Flatbed' } : game.prompt;
  game.mode = 'shot';
  game.pendingShot = name;
}
