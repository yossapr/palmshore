// The four staged screenshot scenes behind ?shot=chase|boulevard|shootout|crane. Each one clears
// the simulation, places real game entities at a chosen moment, burns a little scripted driving
// so the skid marks and poses are genuine, and freezes the clock. The frame is the game's own
// renderer and HUD; nothing is drawn twice or faked.

import { STEP } from './config.js';
import { PLACES } from './world.js';
import { createPerson } from './people.js';
import { spawnVehicle, stepVehicle } from './vehicles.js';
import { createWanted } from './police.js';
import { addSkid, addParticle, muzzleFlash, spark, puff } from './effects.js';

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

const CROWD_SHIRTS = ['#e4d6b8', '#d86a52', '#5f8f93', '#e8b45a', '#8f6f9e', '#6f8f5b', '#d7c0a4', '#b95f5f', '#7f9cb5'];

const WANTED_NOTIFICATION = { text: 'WANTED LEVEL ★★★★', life: 4, max: 4, kind: 'danger' };

/** COVER — a downtown block with traffic, a crowd, a drift and two cruisers closing in. */
function chaseShot(game) {
  clearScene(game);
  game.time = 36.8;
  game.districtLabel = 'Verano Heights';
  // Edge cleanup: drop signs that would sit under the cash HUD or be cut by a border.
  for (const building of game.world.buildings) {
    if ((building.x > 2700 && building.y < 1660) || building.x < 2040) building.sign = null;
  }

  // Dee's Vandal, mid-drift down Verano Boulevard between the towers.
  const car = poseCar(game, 'muscle', 2383, 1366, Math.PI / 2 + 0.05, '#b6352c', { driver: 'player' });
  drift(game, car, 2348, 1228, Math.PI / 2 + 0.08, 44, 0.55);
  car.x = 2383;
  car.y = 1366;
  car.vx = -6;
  car.vy = 178;
  car.angle = Math.PI / 2 + 0.05;
  game.player.inCar = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.player.angle = car.angle;
  game.player.health = 72;
  game.player.armour = 38;
  game.player.cash = 2460;
  game.player.weapon = 'smg';
  game.player.owned.smg = true;
  game.player.ammo = { pistol: 28, shotgun: 0, smg: 96 };

  // Two cruisers closing in: one on the tail, one coming the other way.
  const copA = poseCar(game, 'police', 2382, 1214, Math.PI / 2 + 0.02, '#edf0e7', { police: true, driver: 'police', vx: 2, vy: 168 });
  copA.sirenPhase = 0.5;
  const copB = poseCar(game, 'police', 2416, 1494, -Math.PI / 2 - 0.04, '#e6e9dd', { police: true, driver: 'police', vx: -4, vy: -158 });
  copB.sirenPhase = 2.8;

  // Traffic in both directions, plus a couple of cars queued at the kerb.
  poseCar(game, 'sedan', 2439, 1250, -Math.PI / 2, '#9aa7a3', { vx: 0, vy: -120 });
  poseCar(game, 'taxi', 2361, 1482, Math.PI / 2, '#f2c14e', { vx: 0, vy: 100 });
  poseCar(game, 'sports', 2439, 1532, -Math.PI / 2, '#e8563f', { vx: 0, vy: -136 });
  poseCar(game, 'sedan', 2361, 1596, Math.PI / 2, '#c46a55', { vx: 0, vy: 86 });
  poseCar(game, 'van', 2439, 1590, -Math.PI / 2, '#8fb3ad', { vx: 0, vy: -108 });

  // The crowd spills off both pavements, phones up, running from the sirens.
  for (let i = 0; i < 10; i += 1) {
    const east = i % 2 === 0;
    posePed(game, east ? 2467 + (i % 3) * 4 : 2333 - (i % 3) * 4, 1224 + i * 31, east ? -Math.PI / 2 : Math.PI / 2, {
      state: i % 3 === 0 ? 'walk' : 'flee',
      panic: i % 3 === 0 ? 0 : 2.6,
      walkPhase: i * 1.7,
      shirt: CROWD_SHIRTS[i % CROWD_SHIRTS.length],
    });
  }
  posePed(game, 2346, 1362, 0.4, { walkPhase: 2.2, shirt: '#f0e6cf', state: 'flee', panic: 3 });
  posePed(game, 2452, 1300, -0.7, { walkPhase: 4.1, shirt: '#d86a52', state: 'flee', panic: 3 });
  // A knot of onlookers pressed against the east kerb, plus two more sprinting west.
  for (let i = 0; i < 4; i += 1) {
    posePed(game, 2464 + (i % 2) * 9, 1348 + i * 26, -Math.PI / 2 + (i % 2 ? 0.22 : -0.18), {
      state: 'flee', panic: 3.2, walkPhase: 1.1 + i * 1.4,
      shirt: CROWD_SHIRTS[(i + 2) % CROWD_SHIRTS.length],
    });
  }
  posePed(game, 2329, 1420, Math.PI / 2 + 0.3, { state: 'flee', panic: 2.8, walkPhase: 2.6, shirt: '#e8b45a' });
  posePed(game, 2331, 1524, Math.PI / 2 - 0.25, { state: 'flee', panic: 2.4, walkPhase: 4.8, shirt: '#9cc0b6' });

  // The cruiser behind is firing; tracers and sparks read the chase as hot.
  const aim = Math.atan2(car.y - copA.y, car.x - copA.x);
  muzzleFlash(game, copA.x + Math.cos(aim) * 27, copA.y + Math.sin(aim) * 27, aim);
  for (const particle of game.particles) {
    if (particle.kind === 'flash') {
      particle.life = 0.6;
      particle.max = 0.6;
      particle.size = 22;
    }
  }
  game.bullets.push(
    { x: copA.x + Math.cos(aim) * 72, y: copA.y + Math.sin(aim) * 72, px: copA.x, py: copA.y, vx: Math.cos(aim) * 1300, vy: Math.sin(aim) * 1300, life: 0.5, damage: 27, owner: 'police', weapon: 'pistol' },
    { x: copA.x + Math.cos(aim + 0.12) * 56, y: copA.y + Math.sin(aim + 0.12) * 56, px: copA.x, py: copA.y, vx: Math.cos(aim + 0.12) * 1300, vy: Math.sin(aim + 0.12) * 1300, life: 0.5, damage: 27, owner: 'police', weapon: 'pistol' },
  );
  spark(game, car.x + 12, car.y + 22, 1.2, 7, '#ffd98a');
  puff(game, 2372, 1308, '#e6ddca', 8);
  puff(game, 2390, 1306, '#e6ddca', 7);
  puff(game, 2380, 1342, '#e6ddca', 6);
  puff(game, 2402, 1334, '#e6ddca', 5);

  // Long, real skid marks: two rear tyres, plus an earlier swerve across the lane.
  addSkid(game, 2374, 1238, 2372, 1278, 0.75);
  addSkid(game, 2372, 1278, 2378, 1326, 0.72);
  addSkid(game, 2390, 1238, 2388, 1278, 0.68);
  addSkid(game, 2388, 1278, 2394, 1326, 0.66);
  addSkid(game, 2340, 1300, 2360, 1348, 0.42);
  addSkid(game, 2360, 1348, 2366, 1392, 0.34);
  addSkid(game, 2404, 1310, 2396, 1352, 0.3);
  // A long, darker pair leading in from the previous block, so the drift reads at a glance.
  addSkid(game, 2376, 1168, 2370, 1244, 0.9);
  addSkid(game, 2370, 1244, 2376, 1318, 0.92);
  addSkid(game, 2398, 1168, 2392, 1244, 0.82);
  addSkid(game, 2392, 1244, 2398, 1318, 0.86);
  puff(game, 2371, 1240, '#e9e0cc', 9);
  puff(game, 2393, 1206, '#e9e0cc', 8);

  // Keep roof signage out of the HUD corners on the far-right towers.
  for (const building of game.world.buildings) {
    if (building.x > 2740 && building.y < 1650) {
      building.sign = null;
      building.billboard = null;
    }
  }

  game.wanted = { heat: 165, level: 3, seen: 0, fade: 0, lastCrime: 'grand theft auto' };
  game.objective = {
    number: 5, title: 'High Tide', label: 'Shake the tail — reach Marina 7',
    hint: 'Break line of sight, then head south along Ocean Drive',
    x: PLACES.marina.x, y: PLACES.marina.y,
    distance: Math.hypot(PLACES.marina.x - game.player.x, PLACES.marina.y - game.player.y),
    extra: null,
  };
  game.markers = [];
  focusCamera(game, 2400, 1388, 1.02);
}

/** A bright cruise south on Ocean Drive, with the hotel strip, the beach lot and the bay. */
function boulevardShot(game) {
  clearScene(game);
  game.time = 24.6;
  game.districtLabel = 'Coral Strip';

  const car = poseCar(game, 'sports', 3764, 1310, Math.PI / 2, '#4f9f92', { driver: 'player' });
  drift(game, car, 3764, 1248, Math.PI / 2, 18, 0.1);
  car.x = 3764;
  car.y = 1310;
  car.vx = 0;
  car.vy = 198;
  car.angle = Math.PI / 2;
  game.player.inCar = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.player.angle = car.angle;
  game.player.health = 100;
  game.player.armour = 20;
  game.player.cash = 3180;
  game.player.weapon = 'pistol';
  game.player.ammo.pistol = 41;

  // Name the resort row facing Ocean Drive (fronts stay as generated, only the signage varies).
  const resortNames = ['CORAL ARMS', 'SUNRAY MOTEL', 'NAUTILUS', "GULL'S REST", 'TIDE LINE', 'PALM COURT'];
  let hotelIndex = 0;
  for (const building of game.world.buildings) {
    if (building.style !== 'hotel') continue;
    if (building.x < 3120 || building.x > 3730 || building.y < 1020 || building.y > 1980) continue;
    building.sign = resortNames[hotelIndex % resortNames.length];
    hotelIndex += 1;
  }
  // The left-most hotel is cropped by the frame; its sign would collide with the district label.
  for (const building of game.world.buildings) {
    if (building.x < 3300) {
      building.sign = null;
      building.billboard = null;
    }
  }

  // The beach lot's parked cars, straight from the generated world.
  const lotColors = ['#d9d2c0', '#9aa7a3', '#c46a55', '#e0b563', '#8fb3ad', '#6f8794'];
  let slot = 0;
  for (const parked of game.world.parked) {
    if (parked.x < 3880 || parked.x > 4050 || parked.y < 1050 || parked.y > 1320) continue;
    const lotCar = poseCar(game, parked.type, parked.x, parked.y, parked.angle, lotColors[slot % lotColors.length], { parked: true });
    lotCar.vx = 0;
    lotCar.vy = 0;
    slot += 1;
  }
  // Two more bays filled so the lot reads as a busy beach car park, not a showroom.
  poseCar(game, 'sedan', 4078, 1174, -Math.PI / 2, '#c46a55', { parked: true });
  poseCar(game, 'van', 4078, 1264, -Math.PI / 2, '#8fb3ad', { parked: true });

  // Traffic in both directions on Ocean Drive.
  poseCar(game, 'sedan', 3834, 1196, -Math.PI / 2, '#d9d2c0', { vx: 0, vy: -120 });
  poseCar(game, 'taxi', 3834, 1404, -Math.PI / 2, '#f2c14e', { vx: 0, vy: -126 });
  poseCar(game, 'van', 3834, 1498, -Math.PI / 2, '#e7e0cc', { vx: 0, vy: -104 });
  poseCar(game, 'sedan', 3760, 1188, Math.PI / 2, '#c46a55', { vx: 0, vy: 118 });
  poseCar(game, 'muscle', 3760, 1448, Math.PI / 2, '#2f4f63', { vx: 0, vy: 112 });

  // Strollers on the Ocean Drive pavement, sunbathers and a lifeguard on the sand.
  for (let i = 0; i < 6; i += 1) {
    posePed(game, 3733 - (i % 2) * 5, 1108 + i * 44, i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2, {
      walkPhase: i * 2.3, shirt: CROWD_SHIRTS[(i + 2) % CROWD_SHIRTS.length],
    });
  }
  posePed(game, 3952, 1380, 1.9, { walkPhase: 1.4, shirt: '#e8b45a', pants: '#8a7a62' });
  posePed(game, 3994, 1440, -1.2, { walkPhase: 3.7, shirt: '#d86a52' });
  posePed(game, 3960, 1180, 0.5, { walkPhase: 0.8, shirt: '#f2efe4' });
  game.world.props.push({ kind: 'lifeguard', x: 4036, y: 1408, angle: Math.PI / 2 });

  game.wanted = { heat: 0, level: 0, seen: 0, fade: 0, lastCrime: null };
  game.objective = null;
  game.markers = [];
  focusCamera(game, 3892, 1296, 1.0);
}

/** Four stars, a burning cruiser, officers in cover and the air unit over the Sunray Clinic. */
function shootoutShot(game) {
  clearScene(game);
  game.time = 29.4;
  game.districtLabel = 'Verano Heights';

  // The clinic block: name its frontage so the firefight has a location to read from.
  for (const building of game.world.buildings) {
    if (building.x > 2450 && building.x < 2550 && building.y > 1720 && building.y < 1800) {
      building.sign = 'SUNRAY';
      building.front = 'n';
    }
  }

  const player = game.player;
  player.x = 2378;
  player.y = 1704;
  player.angle = Math.atan2(1648 - player.y, 2478 - player.x);
  player.health = 54;
  player.armour = 58;
  player.cash = 1875;
  player.weapon = 'pistol';
  player.ammo.pistol = 43;
  player.inCar = null;

  const wreck = poseCar(game, 'police', 2440, 1800, 0.48, '#3f3a33', { police: true });
  wreck.burning = 1.4;
  wreck.health = 0;
  wreck.siren = false;
  const cruiserA = poseCar(game, 'police', 2434, 1598, Math.PI / 2 + 0.08, '#eef0e6', { police: true, driver: 'police' });
  cruiserA.sirenPhase = 0.6;
  const cruiserB = poseCar(game, 'police', 2352, 1672, 0.12, '#e9ece2', { police: true, driver: 'police' });
  cruiserB.sirenPhase = 2.2;
  poseCar(game, 'sports', 2328, 1800, -0.42, '#4f9f92', {});
  // Roadblock across the west approach, with a taxi caught behind it and a civilian bailing out.
  const cruiserC = poseCar(game, 'police', 2296, 1677, 0.03, '#eff1e7', { police: true, driver: 'police' });
  cruiserC.sirenPhase = 4.1;
  poseCar(game, 'taxi', 2212, 1700, 0.02, '#f2c14e', {});
  poseCar(game, 'sedan', 2130, 1677, 0, '#9aa7a3', {});
  // Keep the frame edges clean: no roof signage half-cut by a border or the HUD.
  for (const building of game.world.buildings) {
    if (building.x > 2740 || building.x < 2050) {
      building.billboard = null;
      building.sign = null;
    }
  }

  const officerA = posePed(game, 2478, 1648, Math.PI * 0.85, { team: 'police', armed: true, health: 100 });
  const officerB = posePed(game, 2474, 1742, Math.PI - 0.15, { team: 'police', armed: true, health: 100 });
  const officerC = posePed(game, 2392, 1632, Math.PI * 0.6, { team: 'police', armed: true, health: 100 });
  const downed = posePed(game, 2418, 1808, 1.4, { team: 'police', health: 0 });
  downed.dead = true;
  downed.deadTimer = 3;
  officerA.aim = Math.atan2(player.y - officerA.y, player.x - officerA.x);
  officerB.aim = Math.atan2(player.y - officerB.y, player.x - officerB.x);
  officerC.aim = Math.atan2(player.y - officerC.y, player.x - officerC.x);

  // Civilians flattening themselves against the far pavement.
  for (let i = 0; i < 4; i += 1) {
    posePed(game, 2338 - (i % 2) * 10, 1696 + i * 46, Math.PI * 0.7, {
      state: 'flee', panic: 4, walkPhase: i * 1.3, shirt: CROWD_SHIRTS[(i + 4) % CROWD_SHIRTS.length],
    });
  }
  posePed(game, 2466, 1694, -Math.PI / 2, { state: 'flee', panic: 4, walkPhase: 1.2, shirt: '#d7c0a4' });
  // Park life on the grass corner, so the green reads as Palmshore Park and not empty lawn.
  posePed(game, 2244, 1776, 0.9, { walkPhase: 2.2, shirt: '#e8b45a', pants: '#8a7a62' });
  posePed(game, 2280, 1836, -1.4, { walkPhase: 4.4, shirt: '#5f8f93' });
  game.world.props.push(
    { kind: 'parkBench', x: 2302, y: 1764, angle: 0 },
    { kind: 'parkBench', x: 2302, y: 1846, angle: 0 },
  );
  game.world.palms.push(
    { x: 2210, y: 1768, size: 1.05, seed: 1.2 },
    { x: 2262, y: 1808, size: 0.92, seed: 3.4 },
    { x: 2290, y: 1762, size: 1.12, seed: 5.1 },
  );

  game.wanted = { heat: 246, level: 4, seen: 0, fade: 0, lastCrime: 'officer down' };
  game.heli = {
    x: 2572, y: 1608, angle: 1.1, rotor: 2.4,
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
    { x: muzzleX + 34, y: muzzleY + 9, px: muzzleX, py: muzzleY, vx: Math.cos(player.angle) * 1450, vy: Math.sin(player.angle) * 1450, life: 0.4, damage: 27, owner: 'player', weapon: 'pistol' },
    { x: muzzleX + 72, y: muzzleY + 19, px: muzzleX, py: muzzleY, vx: Math.cos(player.angle + 0.03) * 1450, vy: Math.sin(player.angle + 0.03) * 1450, life: 0.4, damage: 27, owner: 'player', weapon: 'pistol' },
    { x: 2462, y: 1718, px: 2478, py: 1700, vx: -880, vy: 60, life: 0.4, damage: 27, owner: 'police', weapon: 'pistol' },
  );
  spark(game, officerA.x, officerA.y, 2.2, 7, '#ffd98a');
  spark(game, 2394, 1752, -0.4, 6, '#ffe1a0');
  // Two officers returning fire, with visible tracers reading across the junction.
  for (const officer of [officerA, officerB]) {
    const ax = officer.x + Math.cos(officer.aim) * 15;
    const ay = officer.y + Math.sin(officer.aim) * 15;
    muzzleFlash(game, ax, ay, officer.aim);
    game.bullets.push({
      x: ax + Math.cos(officer.aim) * 62, y: ay + Math.sin(officer.aim) * 62,
      px: ax, py: ay, vx: Math.cos(officer.aim) * 980, vy: Math.sin(officer.aim) * 980,
      life: 0.5, damage: 20, owner: 'police', weapon: 'pistol',
    });
  }
  for (const particle of game.particles) {
    if (particle.kind === 'flash') {
      particle.life = 0.7;
      particle.max = 0.7;
      particle.size = 9;
    }
  }
  spark(game, player.x + 4, player.y - 6, 1.6, 5, '#ffcf7a');
  puff(game, 2296, 1690, '#5a544a', 12);
  // Fire and smoke off the burning cruiser, drawn by the engine's own particle renderer.
  for (let i = 0; i < 8; i += 1) {
    addParticle(game, {
      kind: 'fire', x: 2440 + (Math.random() - 0.5) * 26, y: 1800 + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, life: 0.8, max: 0.8,
      size: 6 + Math.random() * 6, grow: 9, color: Math.random() > 0.5 ? '#ffb03a' : '#e2604a',
    });
  }
  for (let i = 0; i < 5; i += 1) {
    puff(game, 2436 + (Math.random() - 0.5) * 30, 1792 - i * 14, '#5f584e', 10);
  }
  addSkid(game, 2412, 1848, 2434, 1878, 0.5);
  game.notifications = [];
  game.prompt = null;
  game.markers = [];
  focusCamera(game, 2408, 1676, 1.26);
}

/** The Crane Game job at Gannet Docks: the flatbed, the Gulls, containers and the crane. */
function craneShot(game) {
  clearScene(game);
  game.time = 19.2;
  game.districtLabel = 'Gannet Docks';

  const player = game.player;
  player.x = 1350;
  player.y = 2620;
  player.angle = -Math.PI / 2 + 0.1;
  player.health = 100;
  player.armour = 50;
  player.cash = 2120;
  player.weapon = 'pistol';
  player.ammo.pistol = 29;
  player.owned.shotgun = true;
  player.ammo.shotgun = 12;
  player.inCar = null;

  // The flatbed waits in the alley between the two freight sheds.
  const truck = poseCar(game, 'pickup', 1350, 2530, 0.02, '#b46a4a', { label: 'Gull Flatbed', mission: 'crane-game' });
  truck.vx = 0;
  truck.vy = 0;

  const gullA = posePed(game, 1308, 2482, -Math.PI / 2 + 0.4, { team: 'gang', armed: true, weapon: 'pistol', health: 90, shirt: '#5c4a54' });
  const gullB = posePed(game, 1450, 2522, -Math.PI / 2 - 0.3, { team: 'gang', armed: true, weapon: 'smg', health: 95, shirt: '#6e4a48' });
  const gullC = posePed(game, 1380, 2596, Math.PI * 0.55, { team: 'gang', armed: true, weapon: 'pistol', health: 90, shirt: '#4c4a56' });
  gullA.aim = Math.atan2(player.y - gullA.y, player.x - gullA.x);
  gullB.aim = Math.atan2(player.y - gullB.y, player.x - gullB.x);
  gullC.aim = Math.atan2(player.y - gullC.y, player.x - gullC.x);
  for (let i = 0; i < 3; i += 1) {
    posePed(game, 1140 + i * 58, 2436 + (i % 2) * 8, Math.PI * 0.7, { state: 'flee', panic: 4, walkPhase: i * 1.4 });
  }

  // Quayside clutter in the alley, on the apron and against the sheds.
  game.world.props.push(
    { kind: 'container', x: 1476, y: 2510, angle: 0, color: '#a8523f' },
    { kind: 'container', x: 1544, y: 2436, angle: 0, color: '#4e7f86' },
    { kind: 'crate', x: 1240, y: 2436 },
    { kind: 'crate', x: 1348, y: 2584 },
    { kind: 'crate', x: 1300, y: 2588 },
    { kind: 'crate', x: 1424, y: 2586 },
    { kind: 'crate', x: 1456, y: 2606 },
    { kind: 'crate', x: 1512, y: 2596 },
    { kind: 'crate', x: 1544, y: 2618 },
    { kind: 'crane', x: 1632, y: 2472, angle: 0 },
  );

  // Traffic still moving on Gannet Road beyond the job, and a delivery van at the loading bay.
  poseCar(game, 'sedan', 1520, 2377, 0, '#d9d2c0', { vx: 118, vy: 0 });
  poseCar(game, 'van', 1160, 2343, Math.PI, '#8fb3ad', { vx: -104, vy: 0 });
  poseCar(game, 'van', 1544, 2438, Math.PI, '#e7e0cc', { parked: true });

  // The sheds face the road for the shot: sign, awning and loading doors on the north edge.
  for (const building of game.world.buildings) {
    if (building.style !== 'warehouse') continue;
    if (building.x > 1050 && building.x < 1650 && building.y > 2400 && building.y < 2900) {
      building.front = 'n';
      building.sign = 'GULL FREIGHT';
      building.entrance.awning = true;
    }
  }

  game.objective = {
    number: 4, title: 'Crane Game', label: 'Steal the flatbed on Gannet Road',
    hint: 'The Gulls have noticed. Keep the engine running.',
    x: truck.x, y: truck.y, distance: Math.hypot(truck.x - player.x, truck.y - player.y), extra: null,
  };
  game.notifications = [{ text: 'THE GULLS HAVE NOTICED', life: 4, max: 4, kind: 'danger' }];
  game.markers = [];
  game.dialogue = null;
  game.wanted = { heat: 0, level: 0, seen: 0, fade: 0, lastCrime: null };
  game.missionIndex = 3;
  focusCamera(game, 1358, 2510, 1.3);
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
