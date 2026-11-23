// The wanted level and the police response: cruisers that give chase and deploy officers,
// patrolmen who shoot and try to make an arrest, roadblocks at three stars and a helicopter at
// four. Heat fades once the player has broken line of sight and stayed gone long enough.

import { WANTED, VEHICLES } from './config.js';
import { HY, LANES, VX, nearestLanePoint } from './roads.js';
import { createPerson, hurtPerson } from './people.js';
import { spawnVehicle, stepVehicle, damageVehicle } from './vehicles.js';
import { npcFire } from './combat.js';
import { hasLineOfSight } from './world.js';
import { angleDiff, clamp } from './math.js';

export function createWanted() {
  return { heat: 0, level: 0, seen: 0, fade: 0, lastCrime: null };
}

export function addHeat(game, amount, reason = 'crime') {
  const wanted = game.wanted;
  if (amount <= 0) return;
  const before = wanted.level;
  wanted.heat = clamp(wanted.heat + amount, 0, WANTED.thresholds[5] + 60);
  wanted.lastCrime = reason;
  wanted.seen = 0;
  const level = levelForSeconds(wanted.heat);
  if (level > before) {
    wanted.level = level;
    game.wantedFlash = 1.4;
    game.notify(`WANTED LEVEL ${'★'.repeat(level)}`, 3.4, 'danger');
    game.audio.mission();
    spawnResponse(game, level);
  } else {
    wanted.level = level;
  }
}

function levelForSeconds(heat) {
  let level = 0;
  for (let i = 1; i <= 5; i += 1) if (heat >= WANTED.thresholds[i]) level = i;
  return level;
}

export function policeNear(game) {
  const player = game.player;
  for (const car of game.vehicles) {
    if (!car.police || car.exploded) continue;
    if (Math.hypot(car.x - player.x, car.y - player.y) < 900) return true;
  }
  for (const person of game.people) {
    if (person.team === 'police' && !person.dead && Math.hypot(person.x - player.x, person.y - player.y) < 700) return true;
  }
  return false;
}

function policeCars(game) {
  return game.vehicles.filter((car) => car.police && !car.exploded);
}

function officerCount(game) {
  return game.people.filter((p) => p.team === 'police' && !p.dead).length;
}

/** Pick a point on a lane roughly `distance` away, used for spawns and the helicopter. */
function laneSpawnNear(game, distance) {
  const player = game.player;
  let best = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const point = nearestLanePoint(player.x + (game.rand() - 0.5) * 1400, player.y + (game.rand() - 0.5) * 1400);
    const d = Math.hypot(point.x - player.x, point.y - player.y);
    if (d > distance * 0.6 && d < distance * 1.35) {
      best = point;
      break;
    }
    if (!best) best = point;
  }
  return best;
}

export function spawnCruiser(game, near = null, phase = 'pursue') {
  const player = game.player;
  const point = near ?? laneSpawnNear(game, 760);
  const car = spawnVehicle(game, 'police', point.x, point.y, point.axis === 'y' ? Math.PI / 2 : 0, {
    police: true, driver: 'police',
  });
  car.ai = { phase, deployTimer: 1.2, stuck: 0, spawn: { x: point.x, y: point.y }, leaving: 0, target: null };
  car.siren = true;
  return car;
}

export function spawnOfficer(game, x, y) {
  const officer = createPerson(game, {
    team: 'police', x, y, health: 105, armed: true, weapon: 'pistol', speed: 92,
  });
  officer.state = 'chase';
  officer.cooldown = 0.5 + game.rand() * 0.5;
  return officer;
}

function spawnResponse(game, level) {
  const cars = policeCars(game);
  const desired = Math.min(5, level + 1);
  let added = 0;
  for (let i = cars.length; i < desired; i += 1) {
    if (added >= 2) break;
    spawnCruiser(game);
    added += 1;
  }
  if (level >= 4 && !game.heli) {
    const player = game.player;
    game.heli = {
      x: player.x + 520, y: player.y - 420, angle: 0, rotor: 0,
      spotX: player.x, spotY: player.y, fire: 3, alive: true,
    };
    game.notify('Air unit inbound', 3);
  }
  if (level >= 3 && !game.roadblockTimer) {
    game.roadblockTimer = 1;
  }
}

function deployOfficers(game, car) {
  if (car.policeDeployed) return;
  car.policeDeployed = true;
  const count = officerCount(game) > 11 ? 1 : 2;
  for (let i = 0; i < count; i += 1) {
    const side = (i === 0 ? 1 : -1) * (car.width * 0.9 + 14);
    const x = car.x + Math.cos(car.angle + Math.PI / 2) * side;
    const y = car.y + Math.sin(car.angle + Math.PI / 2) * side;
    if (game.world.buildings.some((b) => x > b.x - 4 && x < b.x + b.w + 4 && y > b.y - 4 && y < b.y + b.h + 4)) continue;
    spawnOfficer(game, x, y);
  }
  car.ai.phase = 'parked';
}

function driveCruiser(game, car, targetX, targetY, dt) {
  const speed = Math.hypot(car.vx, car.vy);
  const desired = Math.atan2(targetY - car.y, targetX - car.x);
  const diff = angleDiff(car.angle, desired);
  car.controls.steer = clamp(diff * 2.5, -1, 1);
  const distance = Math.hypot(targetX - car.x, targetY - car.y);
  if (distance < 120 && speed > 150) {
    car.controls.throttle = 0;
    car.controls.brake = 0.8;
  } else {
    car.controls.throttle = 0.95;
    car.controls.brake = 0;
  }
  car.controls.handbrake = false;
  stepVehicle(game, car, dt);
  if (speed < 12) car.ai.stuck += dt;
  else car.ai.stuck = Math.max(0, car.ai.stuck - dt * 2);
  if (car.ai.stuck > 3.5) {
    const point = laneSpawnNear(game, 750);
    car.x = point.x;
    car.y = point.y;
    car.vx = 0;
    car.vy = 0;
    car.angle = point.axis === 'y' ? Math.PI / 2 : 0;
    car.ai.stuck = 0;
  }
}

function updateOfficers(game, dt) {
  const player = game.player;
  const officers = game.people.filter((p) => p.team === 'police' && !p.dead);
  for (const officer of officers) {
    officer.cooldown = Math.max(0, officer.cooldown - dt);
    officer.hitFlash = Math.max(0, officer.hitFlash - dt);
    const dx = player.x - officer.x;
    const dy = player.y - officer.y;
    const distance = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const los = hasLineOfSight(game.world, officer.x, officer.y, player.x, player.y);
    if (game.wanted.level === 0) {
      officer.state = 'leave';
      officer.leaveTimer = (officer.leaveTimer ?? 4) - dt;
      if (officer.leaveTimer <= 0) officer.dead = true;
    }
    if (distance > 1500) {
      officer.dead = true;
      continue;
    }
    if (game.wanted.level > 0) {
      const target = player.inCar ? player.inCar : player;
      const desired = Math.atan2(target.y - officer.y, target.x - officer.x);
      const shouldAdvance = distance > 180 || !los;
      if (shouldAdvance) {
        const speed = distance > 380 ? 108 : 78;
        officer.vx = Math.cos(desired) * speed;
        officer.vy = Math.sin(desired) * speed;
        officer.x += officer.vx * dt;
        officer.y += officer.vy * dt;
        officer.angle = desired;
        officer.walkPhase += dt * 9;
      } else {
        officer.vx = 0;
        officer.vy = 0;
        officer.angle = desired;
      }
      if (los && distance < 470 && distance > 62) {
        npcFire(game, officer, target.x + (game.rand() - 0.5) * 16, target.y + (game.rand() - 0.5) * 16, 0.16);
      }
      // Close in for the arrest when the player is on foot and within reach.
      if (!player.inCar && distance < 58 && game.wanted.level > 0) {
        game.arrestTimer = (game.arrestTimer ?? 0) + dt;
        if (game.arrestTimer > 1.25) game.startBusted(officer);
      } else if (game.arrestTimer) {
        game.arrestTimer = Math.max(0, game.arrestTimer - dt * 0.9);
      }
    }
    const resolvedX = officer.x;
    const resolvedY = officer.y;
    if (game.world.buildings.some((b) => resolvedX > b.x - 6 && resolvedX < b.x + b.w + 6 && resolvedY > b.y - 6 && resolvedY < b.y + b.h + 6)) {
      officer.x += Math.cos(angle + Math.PI) * 8;
      officer.y += Math.sin(angle + Math.PI) * 8;
    }
    if (officer.x < 20) officer.x = 20;
    if (officer.y < 20) officer.y = 20;
    if (officer.x > game.world.waterX - 20) officer.x = game.world.waterX - 20;
    if (officer.y > game.world.height - 20) officer.y = game.world.height - 20;
  }
  game.arrestTimer = game.arrestTimer ?? 0;
  if (game.arrestTimer > 0 && game.wanted.level === 0) game.arrestTimer = 0;
}

function updateHeli(game, dt) {
  const heli = game.heli;
  if (!heli) return;
  const player = game.player;
  if (game.wanted.level < 4) {
    game.heli = null;
    return;
  }
  heli.rotor += dt * 30;
  const targetX = player.x + Math.cos(game.time * 0.4) * 90;
  const targetY = player.y - 160 + Math.sin(game.time * 0.33) * 70;
  heli.x += (targetX - heli.x) * Math.min(1, dt * 0.9);
  heli.y += (targetY - heli.y) * Math.min(1, dt * 0.9);
  heli.angle = Math.atan2(player.y - heli.y, player.x - heli.x);
  heli.spotX += (player.x - heli.spotX) * Math.min(1, dt * 4);
  heli.spotY += (player.y - heli.spotY) * Math.min(1, dt * 4);
  heli.fire -= dt;
  if (heli.fire <= 0 && game.wanted.level >= 5) {
    heli.fire = 2.4;
    if (hasLineOfSight(game.world, heli.x, heli.y, player.x, player.y)) {
      npcFire(game, { team: 'police', x: heli.x, y: heli.y, cooldown: 0, dead: false, weapon: 'smg' }, player.x + (game.rand() - 0.5) * 60, player.y + (game.rand() - 0.5) * 60, 0.2);
    }
  }
}

function updateRoadblock(game, dt) {
  if (game.wanted.level < 3) {
    game.roadblockTimer = 0;
    return;
  }
  game.roadblockTimer = (game.roadblockTimer ?? 0) - dt;
  if (game.roadblockTimer > 0) return;
  game.roadblockTimer = 16;
  const player = game.player;
  const point = nearestLanePoint(player.x + player.vx * 2.5, player.y + player.vy * 2.5);
  if (Math.hypot(point.x - player.x, point.y - player.y) < 240) return;
  const perpendicular = point.axis === 'x' ? Math.PI / 2 : 0;
  for (let i = 0; i < 2; i += 1) {
    const offset = (i === 0 ? 1 : -1) * 30;
    const x = point.x + Math.cos(perpendicular) * offset;
    const y = point.y + Math.sin(perpendicular) * offset;
    const car = spawnVehicle(game, 'police', x, y, perpendicular, { police: true, driver: 'police' });
    car.ai = { phase: 'block', deployTimer: 0, stuck: 0, spawn: { x, y }, leaving: 0 };
    spawnOfficer(game, x + 30, y + 30);
    spawnOfficer(game, x - 30, y - 30);
  }
  game.notify('Roadblock ahead', 2.6, 'danger');
}

export function updateWanted(game, dt) {
  const wanted = game.wanted;
  const player = game.player;
  let seen = false;
  for (const car of game.vehicles) {
    if (!car.police || car.exploded) continue;
    if (Math.hypot(car.x - player.x, car.y - player.y) < 780 && hasLineOfSight(game.world, car.x, car.y, player.x, player.y)) {
      seen = true;
      break;
    }
  }
  if (!seen) {
    for (const person of game.people) {
      if (person.team !== 'police' || person.dead) continue;
      if (Math.hypot(person.x - player.x, person.y - player.y) < 720 && hasLineOfSight(game.world, person.x, person.y, player.x, player.y)) {
        seen = true;
        break;
      }
    }
  }
  if (seen) wanted.seen = 0;
  else wanted.seen += dt;
  if (wanted.heat > 0 && wanted.seen > WANTED.decayDelay) {
    wanted.heat = Math.max(0, wanted.heat - WANTED.decayRate * dt);
    wanted.fade = 1;
  } else if (wanted.seen < WANTED.decayDelay) {
    wanted.fade = 0;
  }
  const level = levelForSeconds(wanted.heat);
  if (level < wanted.level) {
    wanted.level = level;
    game.notify(level === 0 ? 'You lost the cops' : `Wanted level dropped to ${level}`, 2.4);
    if (level === 0) clearWanted(game);
  } else {
    wanted.level = level;
  }
  if (wanted.level > 0) {
    const cars = policeCars(game);
    if (cars.length < Math.min(5, wanted.level + 1) && game.rand() < 0.02) spawnCruiser(game);
    if (wanted.level >= 4 && !game.heli) spawnResponse(game, wanted.level);
    if (officerCount(game) === 0 && wanted.level >= 2 && game.rand() < 0.01) {
      const point = laneSpawnNear(game, 600);
      spawnOfficer(game, point.x, point.y);
    }
  } else if (game.heli) {
    game.heli = null;
  }
}

export function clearWanted(game) {
  game.wanted.heat = 0;
  game.wanted.level = 0;
  game.wanted.seen = 0;
  game.arrestTimer = 0;
  for (const car of game.vehicles) {
    if (!car.police) continue;
    if (car.driver === 'police') {
      car.ai = { phase: 'leave', leaving: 10, deployTimer: 0, stuck: 0, spawn: { x: car.x, y: car.y } };
    }
  }
  for (const person of game.people) {
    if (person.team === 'police' && !person.dead) {
      person.state = 'leave';
      person.leaveTimer = 4 + Math.random() * 4;
    }
  }
  game.serviceVehicles = [];
}

export function updatePolice(game, dt) {
  updateWanted(game, dt);
  for (const car of game.vehicles) {
    if (!car.police || car.exploded || car.driver !== 'police' || !car.ai) continue;
    car.siren = game.wanted.level > 0;
    if (car.ai.phase === 'leave') {
      car.ai.leaving -= dt;
      car.controls.throttle = 0.5;
      car.controls.brake = 0;
      car.controls.steer = 0.1;
      stepVehicle(game, car, dt);
      if (car.ai.leaving <= 0) car.exploded = true;
      continue;
    }
    if (car.ai.phase === 'block') {
      stepVehicle(game, car, dt);
      car.vx *= 0.9;
      car.vy *= 0.9;
      car.controls.throttle = 0;
      car.controls.brake = 1;
      continue;
    }
    const target = game.player.inCar ?? game.player;
    const distance = Math.hypot(target.x - car.x, target.y - car.y);
    if (distance > 1500) {
      car.ai.phase = 'leave';
      car.ai.leaving = 2;
      continue;
    }
    if (game.wanted.level === 0) {
      car.ai.phase = 'leave';
      car.ai.leaving = 4;
      continue;
    }
    if (distance < 170 && !game.player.inCar) {
      deployOfficers(game, car);
      car.controls.throttle = 0;
      car.controls.brake = 1;
      car.controls.steer = 0;
      stepVehicle(game, car, dt);
      continue;
    }
    if (distance < 95 && game.player.inCar) {
      // Ramming speed.
      driveCruiser(game, car, target.x, target.y, dt);
      const playerCar = game.player.inCar;
      if (Math.hypot(playerCar.x - car.x, playerCar.y - car.y) < 50) {
        damageVehicle(game, playerCar, 9 * dt * 6);
        game.damagePlayer(3 * dt * 6, 'police');
      }
      continue;
    }
    driveCruiser(game, car, target.x, target.y, dt);
    if (distance < 190 && game.rand() < 0.008) deployOfficers(game, car);
  }
  updateOfficers(game, dt);
  updateHeli(game, dt);
  updateRoadblock(game, dt);
}

export const POLICE_STATS = VEHICLES.police;
export { HY, VX, LANES };
