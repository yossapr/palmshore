// The four staged frames, one function each. A shot clears the street, places exactly the cars,
// people, cops and damage the frame needs, points the camera and freezes the clock, so every
// capture is repeatable from ?shot=<name>&seed=1. Used only by the screenshot mode.

import { PALETTE } from './config.js';
import { makePerson } from './people.js';
import { createVehicle } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { createRandom } from './random.js';

const lookRng = createRandom(1337);

function clearStreet(game) {
  game.vehicles = [];
  game.enemies = [];
  game.traffic.cars.length = 0;
  game.pedestrians.people.length = 0;
  game.police.state.cars.length = 0;
  game.police.state.cops.length = 0;
  game.police.state.heli = null;
  game.police.state.heat = 0;
  game.police.state.level = 0;
  game.combat.bullets.length = 0;
  game.combat.pickups.length = 0;
  game.effects.particles.length = 0;
  game.effects.skids.length = 0;
  game.effects.scorches.length = 0;
  game.effects.texts.length = 0;
  game.effects.rings.length = 0;
  game.hud.notifications.length = 0;
  game.missionResult = null;
  game.missions.clearResult();
  game.player.car = null;
  game.player.mode = 'foot';
  game.player.dead = false;
  game.player.busted = false;
  game.player.health = 100;
  game.player.armour = 0;
  game.player.weapon = 'pistol';
  game.player.weapons.pistol.ammo = 12;
  game.player.unlocked.pistol = true;
  game.player.money = 4820;
  game.stats = { kills: 7, earned: 6830, missions: 2, deliveries: 3, spent: 250 };
}

function car(game, x, y, angle, type = 'sedan', color, opts = {}) {
  const vehicle = createVehicle({ x, y, angle, type, color, police: opts.police, taxi: opts.taxi, driver: opts.driver ?? null });
  if (opts.health) vehicle.health = opts.health;
  if (opts.police) {
    vehicle.police = true;
    vehicle.siren = opts.siren ?? true;
    game.police.state.cars.push(vehicle);
  }
  game.vehicles.push(vehicle);
  return vehicle;
}

function playerCar(game, x, y, angle, type = 'sports', color = '#2e8f86') {
  const vehicle = car(game, x, y, angle, type, color, { driver: 'player' });
  game.player.mode = 'car';
  game.player.car = vehicle;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.player.aim = angle;
  return vehicle;
}

function ped(game, x, y, angle, opts = {}) {
  const person = makePerson(lookRng, {
    x,
    y,
    angle,
    shirt: opts.shirt ?? PALETTE.shirts[(Math.abs(Math.round(x + y)) % PALETTE.shirts.length)],
    pants: opts.pants,
    skin: opts.skin,
    hair: opts.hair,
    hat: opts.hat ?? null,
    bag: opts.bag ?? false,
    kind: opts.kind ?? 'ped',
    armed: opts.armed ?? false,
    health: opts.health ?? 100,
    boss: opts.boss ?? false,
    accent: PALETTE.coralDeep,
    name: opts.name ?? null,
  });
  person.walk = opts.walk ?? 40;
  person.phase = opts.phase ?? 1.2;
  if (opts.flee) {
    person.panic = 6;
    person.fleeFrom = opts.flee;
    person.angle = opts.angle;
    person.walk = 150;
    person.phase = 2.2;
  }
  if (opts.dead) {
    person.dead = true;
    person.deadTimer = 3;
  }
  if (opts.kind === 'enemy') game.enemies.push(person);
  else game.pedestrians.people.push(person);
  return person;
}

function cop(game, x, y, angle) {
  const person = ped(game, x, y, angle, { kind: 'cop', armed: true, health: 105 });
  game.pedestrians.people.pop();
  game.police.state.cops.push(person);
  return person;
}

function crowd(game, points) {
  points.forEach(([x, y, angle, opts]) => ped(game, x, y, angle, opts));
}

function skidTrail(game, x, y, angle, length, gap = 9) {
  for (let k = 0; k < length; k += gap) {
    const px = x + Math.cos(angle) * k;
    const py = y + Math.sin(angle) * k;
    game.effects.skid(px - Math.sin(angle) * 8, py + Math.cos(angle) * 8, angle);
    game.effects.skid(px + Math.sin(angle) * 8, py - Math.cos(angle) * 8, angle);
  }
}

function muzzle(game, x, y, angle, scale = 1) {
  game.effects.muzzle(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, angle, scale);
}

function stageCover(game, world) {
  clearStreet(game);
  const road = world.roads.verticals[5];
  const cx = road.x;
  const cy = 742;
  game.camera.pose(cx, cy, 1.22);
  game.player.money = 8420;
  game.player.armour = 62;
  game.player.health = 78;
  game.player.weapon = 'smg';
  game.player.weapons.smg.ammo = 24;
  game.player.unlocked.smg = true;
  const carAngle = -Math.PI / 2;
  const pc = playerCar(game, cx + 21, cy + 8, carAngle, 'sports', '#dd6b52');
  pc.health = 168;
  pc.vx = 0;
  pc.vy = -150;
  skidTrail(game, cx + 21, cy + 30, Math.PI / 2, 120, 8);
  skidTrail(game, cx + 2, cy - 34, Math.PI / 2 + 0.2, 74, 7);
  skidTrail(game, cx + 40, cy - 40, Math.PI / 2 - 0.16, 70, 7);

  // Three lanes of traffic: oncoming southbound, the player's lane, and the far lane.
  car(game, cx + 21, cy - 120, carAngle, 'taxi', '#e6b357', { taxi: true });
  car(game, cx + 45, cy - 60, carAngle, 'coupe', '#2b3a45');
  car(game, cx + 21, cy - 250, carAngle, 'sedan', '#a9c3c6');
  car(game, cx - 21, cy - 40, Math.PI / 2, 'van', '#d9d3c3');
  car(game, cx - 45, cy + 10, Math.PI / 2, 'sedan', '#7a8b6f');
  car(game, cx - 21, cy - 210, Math.PI / 2, 'sports', '#b34a37');
  // A little cross traffic on the intersection at the top edge.
  car(game, cx - 180, 540, 0, 'sedan', '#b34a37');
  car(game, cx + 170, 562, Math.PI, 'van', '#2e8f86');
  // Two cruisers closing in behind Ray.
  const copA = car(game, cx - 21, cy + 96, carAngle, 'police', '#ece6d8', { police: true });
  const copB = car(game, cx + 45, cy + 38, carAngle, 'police', '#f3ecd9', { police: true });
  copA.driver = 'cop';
  copB.driver = 'cop';
  copA.siren = true;
  copB.siren = true;
  copA.vx = 0;
  copA.vy = -90;
  copB.vx = 0;
  copB.vy = -60;

  // A crowd on both sidewalks, a few running from the sirens.
  const crowdPoints = [];
  for (let k = 0; k < 7; k += 1) {
    crowdPoints.push([cx - 70 + (k % 2) * 6, cy - 150 + k * 52, k % 2 ? 2.6 : 0.4, { bag: k === 2, shirt: PALETTE.shirts[k % PALETTE.shirts.length] }]);
  }
  for (let k = 0; k < 6; k += 1) {
    crowdPoints.push([cx + 68 - (k % 2) * 5, cy - 120 + k * 58, k % 2 ? Math.PI : 0.2, { hat: k === 1 ? 'sunhat' : null, shirt: PALETTE.shirts[(k + 3) % PALETTE.shirts.length] }]);
  }
  crowdPoints.push([cx - 76, cy + 108, 0.8, { shirt: '#dd6b52', bag: true }]);
  crowdPoints.push([cx + 74, cy + 126, -2.2, { shirt: '#f2e2be' }]);
  crowdPoints.push([cx - 120, cy + 46, 1.2, { flee: { x: cx, y: cy } }]);
  crowd(game, crowdPoints);

  game.police.setWanted(3, game);
  game.missions.stage('sunbleached', 2, game);
  game.missions.stageDialogue('ROOK', 'Tide Line. South docks. Keep the engine running.');
  game.effects.smoke(cx + 21, cy + 96, 2);
  game.hud.notifications.length = 0;
  return 2.35;
}

function stageBeach(game, world) {
  clearStreet(game);
  const coastX = world.roads.verticals[world.roads.verticals.length - 1].x;
  const cy = 1600;
  game.camera.pose(coastX + 20, cy, 1.2);
  const pc = playerCar(game, coastX + 21, cy + 30, -Math.PI / 2, 'sports', '#2e8f86');
  pc.health = 220;
  pc.vx = 0;
  pc.vy = -132;
  game.player.money = 12400;
  game.player.health = 100;
  game.player.armour = 34;
  game.player.weapon = 'pistol';
  game.player.weapons.pistol.ammo = 12;
  game.player.unlocked.pistol = true;
  // Northbound cruise and southbound traffic.
  car(game, coastX + 21, cy + 172, -Math.PI / 2, 'coupe', '#e6b357');
  car(game, coastX + 45, cy - 26, -Math.PI / 2, 'sedan', '#d9d3c3');
  car(game, coastX + 21, cy - 170, -Math.PI / 2, 'taxi', '#e0a94f', { taxi: true });
  car(game, coastX - 21, cy + 120, Math.PI / 2, 'taxi', '#e0a94f', { taxi: true });
  car(game, coastX - 21, cy - 120, Math.PI / 2, 'van', '#a9c3c6');
  car(game, coastX - 45, cy + 250, Math.PI / 2, 'sedan', '#b34a37');
  // Parked nose-to-tail along the sea wall.
  car(game, coastX - 48, cy - 112, -Math.PI / 2, 'coupe', '#dd6b52');
  car(game, coastX - 48, cy - 10, -Math.PI / 2, 'sedan', '#f0e6d2');
  car(game, coastX - 48, cy + 96, -Math.PI / 2, 'sports', '#e6b357');
  car(game, coastX - 48, cy + 202, -Math.PI / 2, 'van', '#7a8b6f');
  // Beach life.
  const sandX = coastX + 250;
  world.props.push({ type: 'umbrella', x: sandX, y: cy - 60, color: PALETTE.coral, rot: 0.4 });
  world.props.push({ type: 'lounger', x: sandX + 30, y: cy - 50, rot: 0.2 });
  world.props.push({ type: 'towel', x: sandX + 14, y: cy - 24, rot: 0.2, color: '#dd6b52' });
  world.props.push({ type: 'umbrella', x: sandX + 96, y: cy + 96, color: PALETTE.teal, rot: 1.2 });
  world.props.push({ type: 'lounger', x: sandX + 126, y: cy + 108, rot: 0.1 });
  world.props.push({ type: 'towel', x: sandX + 72, y: cy + 128, rot: -0.3, color: '#f0c96a' });
  world.props.push({ type: 'lifeguard', x: sandX + 178, y: cy + 24, rot: 0 });
  world.props.push({ type: 'volley', x: sandX + 96, y: cy + 72, rot: 0.15 });
  world.props.push({ type: 'surfboard', x: sandX + 216, y: cy + 30, rot: 1.2, color: '#f0e6d2' });
  world.props.push({ type: 'surfboard', x: sandX + 226, y: cy + 46, rot: 1.4, color: '#dd6b52' });
  world.props.push({ type: 'dune', x: sandX + 50, y: cy + 250, w: 64, h: 26, rot: 0.4 });
  world.props.push({ type: 'dune', x: sandX + 180, y: cy - 10, w: 44, h: 20, rot: 1.1 });
  world.props.push({ type: 'towel', x: sandX + 214, y: cy - 44, rot: 0.6, color: '#2e8f86' });
  world.props.push({ type: 'umbrella', x: sandX + 176, y: cy + 246, color: '#e0a94f', rot: 0.8 });
  world.props.push({ type: 'towel', x: sandX + 196, y: cy + 212, rot: -0.4, color: '#c95d75' });
  world.props.push({ type: 'surfboard', x: sandX + 42, y: cy + 176, rot: -1.1, color: '#2e8f86' });
  const motelBlock = world.blocks.find((b) => b.district === 'beach' && b.j === 3);
  if (motelBlock) {
    const lot = motelBlock.lot;
    const px = lot.x + lot.w * 0.32;
    const py = lot.y + lot.h * 0.76;
    world.props.push({ type: 'lounger', x: px - 82, y: py, rot: 0 });
    world.props.push({ type: 'lounger', x: px + 82, y: py, rot: 0 });
    world.props.push({ type: 'umbrella', x: px + 96, y: py - 24, color: PALETTE.coral, rot: 1.1 });
    world.props.push({ type: 'umbrella', x: px - 96, y: py - 24, color: PALETTE.teal, rot: -0.6 });
  }
  world.props.push({ type: 'kiosk', x: coastX + 164, y: cy + 34, rot: 0 });
  world.props.push({ type: 'barrel', x: coastX + 194, y: cy + 50, color: '#527a8a' });
  world.props.push({ type: 'towel', x: coastX + 384, y: cy - 214, rot: 0.4, color: '#f0c96a' });
  world.props.push({ type: 'umbrella', x: coastX + 36, y: cy + 92, color: '#f0c96a', rot: -0.4 });
  world.props.push({ type: 'towel', x: coastX + 66, y: cy + 108, rot: 0.3, color: '#dd6b52' });
  world.props.push({ type: 'umbrella', x: coastX + 292, y: cy - 54, color: '#2e8f86', rot: 0.9 });
  world.props.push({ type: 'towel', x: coastX + 268, y: cy - 32, rot: -0.2, color: '#f0e6d2' });
  world.props.push({ type: 'umbrella', x: coastX + 252, y: cy + 126, color: PALETTE.coral, rot: 1.5 });
  world.props.push({ type: 'towel', x: coastX + 230, y: cy + 108, rot: 0.5, color: '#2e8f86' });
  world.props.push({ type: 'yacht', x: coastX + 430, y: cy + 40, w: 150, h: 42, rot: 0.04 });
  world.props.push({ type: 'boat', x: coastX + 520, y: cy - 170, rot: -0.1, color: '#f0e6d2' });
  world.props.push({ type: 'jetski', x: coastX + 360, y: cy - 110, rot: 0.2, color: '#dd6b52' });
  world.props.push({ type: 'jetski', x: coastX + 350, y: cy + 146, rot: -0.3, color: '#2e8f86' });
  world.props.push({ type: 'sailboat', x: coastX + 360, y: cy - 70, rot: 0.06, w: 120, h: 34, color: '#f0e6d2' });
  world.props.push({ type: 'boat', x: coastX + 610, y: cy - 6, rot: 0.1, color: '#2e8f86' });
  for (let k = 0; k < 5; k += 1) world.props.push({ type: 'pier', x: coastX + 320, y: cy + 66 + k * 38, w: 36, h: 36, rot: 0 });
  crowd(game, [
    [coastX - 44, cy + 214, -0.4, { hat: 'sunhat', bag: true, shirt: '#f2e2be' }],
    [coastX - 44, cy + 242, -0.2, { shirt: '#2e8f86' }],
    [coastX - 74, cy - 30, Math.PI / 2, { shirt: '#dd6b52' }],
    [coastX + 160, cy + 66, 0.4, { hat: 'sunhat', shirt: '#e0a94f' }],
    [coastX + 208, cy + 100, -1.2, { shirt: '#c95d75' }],
    [coastX + 248, cy + 16, 1.4, { shirt: '#8b6f9e' }],
    [coastX + 268, cy + 210, -0.6, { shirt: '#f2e2be', bag: true }],
    [coastX + 70, cy + 160, 2.4, { shirt: '#4d7fa3' }],
    [coastX + 300, cy - 200, 0.8, { shirt: '#dd6b52', hat: 'sunhat' }],
    [coastX + 118, cy - 160, 1.1, { shirt: '#2e8f86' }],
    [coastX + 200, cy + 168, 0.4, { shirt: '#f0d8a8', hat: 'sunhat' }],
    [coastX + 236, cy + 196, -1.4, { shirt: '#dd6b52' }],
    [coastX + 84, cy - 240, 2.0, { shirt: '#2b5c40' }],
    [coastX + 134, cy + 180, 1.3, { shirt: '#c95d75', bag: true }],
    [coastX + 92, cy + 66, -0.8, { shirt: '#f2e2be', hat: 'sunhat' }],
    [coastX + 282, cy - 30, 2.4, { shirt: '#4d7fa3' }],
    [coastX + 306, cy + 92, -1.0, { shirt: '#dd6b52' }],
    [coastX + 190, cy + 46, 0.2, { shirt: '#2e8f86' }],
    [coastX + 258, cy + 150, 2.8, { shirt: '#e0a94f', hat: 'sunhat' }],
    [coastX + 190, cy + 24, -0.5, { shirt: '#f2e2be' }],
    [coastX + 214, cy + 40, 2.6, { shirt: '#2e8f86' }],
    [coastX + 180, cy + 60, 0.9, { shirt: '#dd6b52' }],
  ]);
  game.police.setWanted(0, game);
  game.missions.stage('sunbleached', 5, game);
  game.missions.stageDialogue('ROOK', 'Casa Luna. I will meet you there. Do not open the ledger.');
  game.hud.notifications.length = 0;
  return 4.2;
}

function stageShootout(game, world) {
  clearStreet(game);
  const coral = world.landmarks.coralArms;
  const b = coral.building;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h + 58;
  game.camera.pose(cx + 26, cy, 1.3);
  game.player.mode = 'foot';
  game.player.x = cx - 74;
  game.player.y = cy + 12;
  game.player.angle = 0;
  game.player.aim = 0.05;
  game.player.weapon = 'shotgun';
  game.player.weapons.shotgun.ammo = 6;
  game.player.unlocked.shotgun = true;
  game.player.health = 71;
  game.player.armour = 40;
  game.player.money = 3560;

  // A car burning in the middle of the street.
  const burning = car(game, cx + 28, cy - 12, 0.04, 'sedan', '#3a332c', { health: 0 });
  burning.burning = true;
  burning.health = 0;
  game.effects.scorch(cx + 28, cy - 12);
  for (let k = 0; k < 7; k += 1) game.effects.fire(cx + 28 + Math.cos(k * 1.7) * 22, cy - 12 + Math.sin(k * 2.1) * 10);
  game.effects.smoke(cx + 28, cy - 28, 5);
  skidTrail(game, cx - 104, cy + 4, 0, 60, 8);
  car(game, cx - 190, cy + 10, 0.03, 'coupe', '#2e8f86');
  car(game, cx + 208, cy - 16, Math.PI - 0.04, 'van', '#d9d3c3');
  const cruiser = car(game, cx - 152, cy - 18, 0.02, 'police', '#ece6d8', { police: true });
  cruiser.driver = 'cop';
  cruiser.siren = true;

  const enemies = [
    [cx + 104, cy - 30, 2.9, 86],
    [cx + 128, cy + 26, 3.4, 72],
    [cx + 184, cy + 2, 2.8, 64],
  ];
  enemies.forEach(([x, y, angle, hp], i) => {
    const e = ped(game, x, y, angle, { kind: 'enemy', armed: true, health: hp, shirt: i === 0 ? '#3d3a34' : '#5c4a3c' });
    e.shootCooldown = 3;
  });
  const boss = ped(game, cx + 214, cy - 38, 3.0, { kind: 'enemy', armed: true, health: 160, shirt: '#2a2622', boss: true, name: 'VARGAS' });
  boss.shootCooldown = 3;

  muzzle(game, cx - 74, cy + 12, 0.05, 1.1);
  muzzle(game, cx + 104, cy - 30, 2.9, 0.8);
  muzzle(game, cx + 128, cy + 26, 3.4, 0.8);
  muzzle(game, cx + 184, cy + 2, 2.8, 0.8);
  const copA = cop(game, cx - 124, cy + 30, 0.1);
  muzzle(game, copA.x, copA.y, 0.1, 0.85);
  const copB = cop(game, cx - 104, cy + 46, 0.2);
  muzzle(game, copB.x, copB.y, 0.2, 0.85);
  game.combat.addBullet(cx - 52, cy + 10, 0.02, 760, 15, 'player', '#ffe9b8', 0.5);
  game.combat.addBullet(cx + 60, cy - 10, 3.1, 760, 18, 'enemy', '#ffe6b0', 0.5);
  game.combat.addBullet(cx + 30, cy + 22, 2.7, 760, 18, 'police', '#ffe6b0', 0.5);
  game.combat.spawnPickup(game, cx + 6, cy + 34, 'cash', 160);
  game.combat.spawnPickup(game, cx + 58, cy + 44, 'ammo', 12);
  game.combat.spawnPickup(game, cx + 96, cy + 52, 'health', 0);
  game.effects.blood(cx + 112, cy + 4, 6);

  crowd(game, [
    [cx - 130, cy + 58, 0.2, { flee: { x: cx, y: cy }, shirt: '#f2e2be' }],
    [cx - 106, cy + 74, 0.7, { flee: { x: cx, y: cy }, shirt: '#dd6b52', bag: true }],
    [cx + 124, cy + 62, -0.4, { flee: { x: cx, y: cy }, shirt: '#2e8f86' }],
    [cx - 156, cy - 48, 1.3, { flee: { x: cx, y: cy }, shirt: '#e0a94f' }],
    [cx + 146, cy - 58, -2.4, { flee: { x: cx, y: cy }, shirt: '#c95d75' }],
    [cx - 84, cy + 82, 2.2, { flee: { x: cx, y: cy }, shirt: '#8b6f9e' }],
    [cx + 84, cy + 78, 0.6, { dead: true, shirt: '#5a6a7a' }],
  ]);
  game.effects.blood(cx + 84, cy + 78, 8);
  game.police.setWanted(3, game);
  game.missions.stage('tideline', 1, game);
  game.missions.stageDialogue('VARGAS', 'You are Teo’s brother. You have his stubborn face.');
  game.hud.notifications.length = 0;
  return 1.62;
}

function stageDocks(game, world) {
  clearStreet(game);
  const cx = 1500;
  const cy = 3790;
  game.camera.pose(cx, cy, 1.08);
  world.props = world.props.filter((p) => p.type !== 'ship' && p.type !== 'boat');
  game.player.mode = 'foot';
  game.player.x = cx - 96;
  game.player.y = cy + 96;
  game.player.angle = -0.7;
  game.player.aim = -0.62;
  game.player.weapon = 'smg';
  game.player.weapons.smg.ammo = 18;
  game.player.unlocked.smg = true;
  game.player.health = 82;
  game.player.armour = 58;
  game.player.money = 21600;

  // The quay: containers, a crane, a waiting ship and the water behind them.
  world.props.push({ type: 'ship', x: 1980, y: 3950, w: 280, h: 62, rot: 0.02 });
  world.props.push({ type: 'boat', x: 1100, y: 3968, rot: 0.05, color: '#2e8f86' });
  world.props.push({ type: 'boat', x: 1260, y: 4000, rot: -0.05, color: '#dd6b52' });
  world.props.push({ type: 'hpier', x: 1260, y: 3838, w: 40, h: 170, rot: 0 });
  world.props.push({ type: 'container', x: 1830, y: 3780, w: 76, h: 24, color: '#dd6b52' });
  world.props.push({ type: 'container', x: 1830, y: 3812, w: 76, h: 24, color: '#2e8f86' });
  world.props.push({ type: 'container', x: 1120, y: 3796, w: 70, h: 24, color: '#b8863f' });
  world.props.push({ type: 'crate', x: 1188, y: 3862, w: 24, h: 22 });
  world.props.push({ type: 'crate', x: 1216, y: 3876, w: 20, h: 18 });
  world.props.push({ type: 'crate', x: 1770, y: 3786, w: 22, h: 20 });
  world.props.push({ type: 'bollard', x: 1360, y: 3912 });
  world.props.push({ type: 'bollard', x: 1640, y: 3912 });
  world.props.push({ type: 'lamp', x: 1320, y: 3810 });
  world.props.push({ type: 'lamp', x: 1720, y: 3810 });
  world.props.push({ type: 'crate', x: 1290, y: 3820, w: 26, h: 24 });
  world.props.push({ type: 'crate', x: 1322, y: 3842, w: 20, h: 18 });
  world.props.push({ type: 'crate', x: 1590, y: 3848, w: 24, h: 20 });
  world.props.push({ type: 'container', x: 1380, y: 3760, w: 64, h: 22, color: '#527a8a' });
  world.props.push({ type: 'container', x: 1750, y: 3772, w: 86, h: 24, color: '#c4503c' });
  world.props.push({ type: 'container', x: 1760, y: 3802, w: 70, h: 20, color: '#2e8f86' });
  world.props.push({ type: 'crate', x: 1670, y: 3796, w: 24, h: 20 });
  world.props.push({ type: 'dockoffice', x: 1120, y: 3816, w: 150, h: 60 });
  world.props.push({ type: 'docksign', x: 1218, y: 3778, rot: 0 });
  world.props.push({ type: 'forklift', x: 1380, y: 3852, rot: -0.3 });
  world.props.push({ type: 'barrel', x: 1352, y: 3858, color: '#b8863f' });
  world.props.push({ type: 'barrel', x: 1368, y: 3868, color: '#527a8a' });
  world.props.push({ type: 'barrel', x: 1660, y: 3838, color: '#c4503c' });
  car(game, cx - 250, cy + 30, -0.3, 'van', '#2b3a45');
  const pc = car(game, cx - 60, cy + 150, Math.PI / 2, 'sports', '#dd6b52');
  pc.health = 190;
  car(game, cx + 260, cy - 90, Math.PI, 'truck', '#7a8b6f');
  const cruiser = car(game, cx + 320, cy + 20, Math.PI + 0.2, 'police', '#ece6d8', { police: true });
  cruiser.driver = 'cop';
  cruiser.siren = true;

  const e1 = ped(game, cx + 10, cy - 50, 1.6, { kind: 'enemy', armed: true, health: 85, shirt: '#2c3b3d' });
  const e2 = ped(game, cx + 120, cy + 30, -0.9, { kind: 'enemy', armed: true, health: 85, shirt: '#5c4a3c' });
  const e3 = ped(game, cx + 96, cy - 100, -1.8, { kind: 'enemy', armed: true, health: 120, shirt: '#3d3a34' });
  const boss = ped(game, cx + 42, cy - 4, 2.4, { kind: 'enemy', armed: true, health: 240, shirt: '#2a2622', boss: true, name: null });
  [e1, e2, e3, boss].forEach((e) => { e.shootCooldown = 3; });
  muzzle(game, e1.x, e1.y, 1.6, 0.8);
  muzzle(game, e2.x, e2.y, -0.9, 0.8);
  muzzle(game, boss.x, boss.y, 2.4, 1.0);
  muzzle(game, cx - 96, cy + 96, -0.62, 1.0);
  game.combat.addBullet(cx - 56, cy + 82, -0.62, 820, 15, 'player', '#ffe9b8', 0.4);
  game.combat.addBullet(cx + 76, cy + 10, -0.7, 760, 18, 'enemy', '#ffe6b0', 0.4);
  const copA = cop(game, cx + 300, cy + 30, Math.PI + 0.1);
  muzzle(game, copA.x, copA.y, Math.PI + 0.1);
  crowd(game, [
    [cx - 190, cy + 30, 0.9, { flee: { x: cx, y: cy }, shirt: '#f2e2be' }],
    [cx - 170, cy - 30, 0.3, { flee: { x: cx, y: cy }, shirt: '#dd6b52' }],
    [cx + 240, cy - 20, -1.4, { flee: { x: cx, y: cy }, shirt: '#e0a94f' }],
    [cx + 150, cy + 120, 1.1, { dead: true, shirt: '#4d7fa3' }],
  ]);
  game.effects.blood(cx + 150, cy + 120, 7);
  game.combat.spawnPickup(game, cx + 24, cy + 82, 'cash', 240);
  game.police.setWanted(2, game);
  game.missions.stage('lastlight', 0, game);
  const marker = game.missions.marker;
  marker.x = cx + 42;
  marker.y = cy - 4;
  marker.label = 'VARGAS';
  marker.radius = 46;
  game.missions.stageDialogue('VARGAS', 'Your brother drowned owing me a hundred thousand dollars.');
  game.hud.notifications.length = 0;
  return 6.4;
}

const SCENES = {
  cover: stageCover,
  beach: stageBeach,
  shootout: stageShootout,
  docks: stageDocks,
};

export function stageShot(name, game) {
  const stage = SCENES[name] ?? SCENES.cover;
  const time = stage(game, game.world);
  game.player.hurtTimer = 0;
  game.player.hurtFlash = 0;
  game.player.aimBlend = 1;
  game.hud.update(game, 0.016);
  game.hud.notifications.length = 0;
  return time;
}

export const SHOT_SCENES = Object.keys(SCENES);
