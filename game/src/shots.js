// Deterministic capture scenes. Each query builds the same city from the same seed,
// arranges the same people, traffic and police, simulates a fixed number of steps,
// then freezes so Chrome's screenshot is the same frame every time.

import { SHOT_SAVE, WORLD, CITY } from './config.js';
import { MISSIONS } from './missions.js';

const REGENT = { x: 438.2, z: 158, heading: -Math.PI / 2 };

function resetCommon(game) {
  game.mode = 'playing';
  game.tick = 0;
  game.timeScale = 1;
  game.paused = false;
  game.player.applySave(SHOT_SAVE);
  game.player.health = 100;
  game.player.armour = 50;
  game.player.dead = false;
  game.player.deadKind = null;
  game.player.fireClock = 0;
  game.player.reloadTimer = 0;
  game.player.focusTimer = 0;
  game.player.windTimer = 0;
  game.player.cooldowns = { focus: 0, wind: 0, patch: 0 };
  game.player.currentWeapon = 'smg';
  game.player.car = null;
  game.player.mesh.visible = true;
  game.police.clearWanted();
  game.story.clear();
  game.hud.toasts = [];
  game.missions.clearTargets();
  game.missions.courier = null;
  game.missions.missionCooldown = 0;
  game.missions.missionIndex = 2;
  game.missions.active = { def: MISSIONS[2], stage: 2 };
  if (game.missions.targetCar) game.vehicles.remove(game.missions.targetCar);
  game.missions.targetCar = game.vehicles.create('regent', {
    x: REGENT.x, z: REGENT.z, heading: REGENT.heading, color: '#7a2f2f', driver: null,
  });
  game.missions.targetCar.customName = 'THE REGENT';
  game.missions.lastStage = 2;
  game.missions.updateMarker();
  game.traffic.clear();
  game.traffic.targetCount = 0;
  game.pedestrians.clear();
  game.traffic.targetCount = 3;
  game.chase.lockedYaw = true;
}

function addTraffic(game, specs) {
  for (const spec of specs) {
    const car = game.traffic.spawnAt(spec.x, spec.z, spec.heading, {
      modelId: spec.model ?? 'marlin', lock: true,
    });
    car.ai.desired = spec.speed ?? 9;
    car.speed = spec.speed ?? 9;
    car.vx = Math.cos(spec.heading) * car.speed;
    car.vz = Math.sin(spec.heading) * car.speed;
    car.colorSeed = spec.colorSeed ?? 1;
  }
  game.traffic.targetCount = game.traffic.cars.length;
}

function addPeds(game, specs) {
  for (const spec of specs) {
    const ped = game.pedestrians.spawnAt(spec.x, spec.z, {
      state: spec.state ?? 'walk',
      heading: spec.heading ?? -Math.PI / 2,
      speed: spec.speed ?? 1.2,
    });
    if (spec.tx !== undefined) ped.target = { x: spec.tx, z: spec.tz };
    if (spec.state === 'idle') {
      ped.state = 'idle';
      ped.timer = 40;
      ped.target = null;
    }
  }
}

function streetLife(game) {
  addTraffic(game, [
    { x: 437.9, z: 118, heading: -Math.PI / 2, model: 'marlin', speed: 8, colorSeed: 2 },
    { x: 437.9, z: 214, heading: -Math.PI / 2, model: 'cab', speed: 9, colorSeed: 0 },
    { x: 430.1, z: 88, heading: Math.PI / 2, model: 'vela', speed: 10, colorSeed: 4 },
    { x: 430.1, z: 252, heading: Math.PI / 2, model: 'van', speed: 7, colorSeed: 1 },
    { x: 405, z: 186.1, heading: 0, model: 'marlin', speed: 8, colorSeed: 3 },
    { x: 290, z: 186.1, heading: Math.PI, model: 'marlin', speed: 7, colorSeed: 2 },
  ]);
  addPeds(game, [
    { x: 425.1, z: 164, state: 'walk', heading: -Math.PI / 2, tx: 425.1, tz: 140 },
    { x: 424.6, z: 194, state: 'walk', heading: Math.PI, tx: 424.6, tz: 220 },
    { x: 425.6, z: 137, state: 'idle', heading: -Math.PI / 2 },
    { x: 424.9, z: 248, state: 'walk', heading: Math.PI / 2, tx: 424.9, tz: 270 },
    { x: 362.2, z: 176, state: 'walk', heading: -Math.PI / 2, tx: 362.2, tz: 155 },
    { x: 424.8, z: 108, state: 'walk', heading: -Math.PI / 2, tx: 424.8, tz: 132 },
    { x: 446.2, z: 150, state: 'walk', heading: -Math.PI / 2, tx: 446.2, tz: 126 },
    { x: 447.1, z: 196, state: 'walk', heading: Math.PI, tx: 447.1, tz: 220 },
    { x: 444.8, z: 226, state: 'idle', heading: -Math.PI / 2 },
  ]);
}

function snapShotCamera(game, yaw, distance, height, targetY = 0) {
  const target = game.player.car
    ? { x: game.player.car.x, y: game.player.car.mesh.position.y + targetY, z: game.player.car.z, heading: game.player.car.heading }
    : { x: game.player.x, y: game.player.y + targetY, z: game.player.z, heading: game.player.heading };
  game.chase.setShot(yaw, { distance, height, pitch: 0.12 });
  game.chase.reset(target, yaw);
  game.chase.baseDistance = distance;
  game.chase.baseHeight = height;
}

export function prepareShot(game, kind) {
  resetCommon(game);
  if (kind === 'drive') {
    game.player.car = null;
    const car = game.vehicles.create('vela', {
      x: 436.6, z: 232, heading: -Math.PI / 2, color: '#d9503f', driver: 'player',
    });
    car.damage = 62;
    car.speed = 36.2;
    car.vx = Math.cos(car.heading) * car.speed;
    car.vz = Math.sin(car.heading) * car.speed;
    game.player.car = car;
    game.player.mesh.visible = false;
    game.player.health = 86;
    game.player.armour = 34;
    streetLife(game);
    addPeds(game, [
      { x: 444, z: 208, state: 'walk', heading: Math.PI, tx: 444, tz: 226 },
      { x: 447, z: 188, state: 'idle', heading: Math.PI },
      { x: 425.2, z: 222, state: 'walk', heading: -Math.PI / 2, tx: 425.2, tz: 198 },
    ]);
    addTraffic(game, [
      { x: 436, z: 156, heading: -Math.PI / 2, model: 'marlin', speed: 8, colorSeed: 1 },
      { x: 429.6, z: 196, heading: Math.PI / 2, model: 'cab', speed: 9, colorSeed: 0 },
      { x: 447, z: 176, heading: -Math.PI / 2, model: 'marlin', speed: 9, colorSeed: 3 },
    ]);
    game.shotTicks = 24;
    game.onShotFreeze = () => {
      car.speed = 36.4;
      car.vx = Math.cos(car.heading) * car.speed;
      car.vz = Math.sin(car.heading) * car.speed;
      car.damage = 62;
      game.player.health = 86;
      game.player.armour = 34;
      game.traffic.targetCount = game.traffic.cars.length;
      snapShotCamera(game, -1.455, 7.8, 3.25, 0.3);
    };
    return;
  }

  if (kind === 'wanted') {
    game.player.setPosition(429.2, 176, -Math.PI / 2);
    game.chase.yaw = -Math.PI / 2;
    game.chase.aimYaw = -Math.PI / 2;
    game.player.health = 34;
    game.player.armour = 12;
    game.player.currentWeapon = 'smg';
    streetLife(game);
    addPeds(game, [
      { x: 446, z: 158, state: 'idle', heading: Math.PI },
      { x: 448, z: 196, state: 'flee', heading: Math.PI / 2 },
    ]);
    game.police.wanted = 4.15;
    game.police.clearUnits();
    game.police.hold = true;
    game.police.spawnCruiser('PURSUIT', { x: 438.2, z: 164, heading: Math.PI / 2 });
    game.police.spawnCruiser('RAMMING', { x: 413, z: 186, heading: 0 });
    game.police.spawnHeli();
    game.police.wanted = 4.15;
    game.police.lastCrime = 0;
    game.police.contactTimer = 60;
    game.police.lastSeen = { x: 423.6, z: 175 };
    const heli = game.police.heli;
    heli.x = 409;
    heli.z = 130;
    heli.y = 17;
    heli.group.position.set(heli.x, heli.y, heli.z);
    for (const unit of game.police.units) {
      if (unit.car) {
        unit.car.speed = 0;
        unit.car.vx = 0;
        unit.car.vz = 0;
        unit.car.damage = unit.role === 'PURSUIT' ? 18 : 34;
        unit.cooldown = 99;
      } else if (unit.kind === 'foot') {
        unit.cooldown = 99;
      }
    }
    game.shotTicks = 60;
    game.onShotFreeze = () => {
      game.player.health = 34;
      game.player.armour = 12;
      game.police.wanted = 4.15;
      game.police.contactTimer = 60;
      game.police.lastCrime = 0;
      const angle = -Math.PI / 2;
      game.combat.fire('player', 'smg', {
        x: game.player.x + Math.cos(angle) * 0.8,
        y: 1.38,
        z: game.player.z + Math.sin(angle) * 0.8,
      }, angle, { owner: 'player', spread: 0.02 });
      game.player.fireClock = 0.4;
      game.chase.kick(0.3);
      snapShotCamera(game, -Math.PI / 2, 5.9, 3.0, 0.25);
    };
    return;
  }

  if (kind === 'story') {
    game.player.setPosition(445.2, 238, -1.5);
    game.chase.yaw = -1.5;
    game.chase.aimYaw = -1.5;
    game.player.health = 92;
    game.player.armour = 40;
    streetLife(game);
    addPeds(game, [
      { x: 424.8, z: 214, state: 'walk', heading: -Math.PI / 2, tx: 424.8, tz: 190 },
      { x: 425.4, z: 258, state: 'idle', heading: Math.PI },
      { x: 442, z: 224, state: 'walk', heading: Math.PI / 2, tx: 442, tz: 246 },
    ]);
    addTraffic(game, [
      { x: 437.9, z: 216, heading: -Math.PI / 2, model: 'marlin', speed: 7, colorSeed: 2 },
      { x: 430.1, z: 180, heading: Math.PI / 2, model: 'vela', speed: 8, colorSeed: 4 },
      { x: 430.1, z: 260, heading: Math.PI / 2, model: 'cab', speed: 8, colorSeed: 1 },
    ]);
    game.shotTicks = 80;
    game.onShotFreeze = () => {
      game.story.setLine('marisol', "The Regent's parked under the Neon Conch. Put it in the sea, and Dex docks with nothing.", { duration: 999 });
      game.hud.toast('SAVED · SLOT 01', '#6fe0c0', 999);
      game.player.health = 92;
      game.player.armour = 40;
      game.player.heading = -1.5;
      snapShotCamera(game, -1.5, 5.9, 3.05, 0.25);
    };
    return;
  }

  // Street.
  game.player.setPosition(445.4, 174, -1.44);
  game.chase.yaw = -1.44;
  game.chase.aimYaw = -1.44;
  game.player.health = 100;
  game.player.armour = 55;
  game.player.currentWeapon = 'smg';
  streetLife(game);
  game.shotTicks = 110;
  game.onShotFreeze = () => {
    game.player.health = 100;
    game.player.armour = 55;
    game.traffic.targetCount = game.traffic.cars.length;
    game.player.heading = -1.44;
    snapShotCamera(game, -1.44, 6.1, 3.05, 0.25);
  };
}

export function shotSeed() {
  return WORLD.seed;
}

export const SHOT_NAMES = ['street', 'drive', 'wanted', 'story'];

export const SHOT_SPOTS = { REGENT, CITY };
