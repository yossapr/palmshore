// Traffic: cars that drive the grid on the right-hand lane, slow for corners, queue behind each
// other, stop for the player on foot, and are culled and respawned around the camera. Each is a
// real vehicle the player can steal.

import { HY, LANES, VX } from './roads.js';
import { spawnVehicle, stepVehicle, speedOf, forwardSpeed } from './vehicles.js';
import { angleDiff, clamp } from './math.js';

const TRAFFIC_TARGET = 24;
const TYPES = [
  ['sedan', 32], ['sedan', 12], ['taxi', 13], ['sports', 9], ['muscle', 8], ['van', 7], ['pickup', 4],
];

function pickType(rand) {
  const total = TYPES.reduce((sum, entry) => sum + entry[1], 0);
  let roll = rand() * total;
  for (const [type, weight] of TYPES) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return 'sedan';
}

function laneWaypoint(axis, road, dir, nodeIndex, lane) {
  if (axis === 'x') return { x: VX[nodeIndex], y: HY[road] + dir * LANES[lane] };
  return { x: VX[road] - dir * LANES[lane], y: HY[nodeIndex] };
}

function exitPoint(axis, road, dir, nodeIndex, lane, vi, hi) {
  const node = { x: VX[vi], y: HY[hi] };
  const along = 118;
  if (axis === 'x') return { x: node.x + dir * along, y: HY[road] + dir * LANES[lane] };
  return { x: VX[road] - dir * LANES[lane], y: node.y + dir * along };
}

function setRoute(car, axis, road, dir, targetIndex, lane) {
  car.traffic = {
    axis, road, dir, targetIndex, lane,
    wps: [laneWaypoint(axis, road, dir, targetIndex, lane)],
    cruise: car.traffic?.cruise ?? 128 + Math.random() * 62,
    stuck: 0,
    ignore: 0,
  };
}

function planNext(game, car) {
  const state = car.traffic;
  const lane = state.lane;
  if (state.axis === 'x') {
    const vi = state.targetIndex;
    const hi = state.road;
    const canContinue = vi + state.dir >= 0 && vi + state.dir < VX.length;
    const turns = [];
    for (const dir of [-1, 1]) {
      if (hi + dir >= 0 && hi + dir < HY.length) turns.push({ dir, axis: 'y', road: vi, targetIndex: hi + dir });
    }
    if (canContinue && (turns.length === 0 || game.rand() < 0.62)) {
      state.targetIndex = vi + state.dir;
      state.wps.push(laneWaypoint('x', hi, state.dir, state.targetIndex, lane));
      return;
    }
    if (turns.length === 0) {
      state.dir *= -1;
      state.targetIndex = vi + state.dir;
      state.wps.push(laneWaypoint('x', hi, state.dir, state.targetIndex, lane));
      return;
    }
    const turn = turns[Math.floor(game.rand() * turns.length)];
    state.axis = 'y';
    state.road = turn.road;
    state.dir = turn.dir;
    state.targetIndex = turn.targetIndex;
    state.wps.push(exitPoint('y', turn.road, turn.dir, turn.targetIndex, lane, vi, hi));
    state.wps.push(laneWaypoint('y', turn.road, turn.dir, turn.targetIndex, lane));
    return;
  }
  const hi = state.targetIndex;
  const vi = state.road;
  const canContinue = hi + state.dir >= 0 && hi + state.dir < HY.length;
  const turns = [];
  for (const dir of [-1, 1]) {
    if (vi + dir >= 0 && vi + dir < VX.length) turns.push({ dir, axis: 'x', road: hi, targetIndex: vi + dir });
  }
  if (canContinue && (turns.length === 0 || game.rand() < 0.62)) {
    state.targetIndex = hi + state.dir;
    state.wps.push(laneWaypoint('y', vi, state.dir, state.targetIndex, lane));
    return;
  }
  if (turns.length === 0) {
    state.dir *= -1;
    state.targetIndex = hi + state.dir;
    state.wps.push(laneWaypoint('y', vi, state.dir, state.targetIndex, lane));
    return;
  }
  const turn = turns[Math.floor(game.rand() * turns.length)];
  state.axis = 'x';
  state.road = turn.road;
  state.dir = turn.dir;
  state.targetIndex = turn.targetIndex;
  state.wps.push(exitPoint('x', turn.road, turn.dir, turn.targetIndex, lane, vi, hi));
  state.wps.push(laneWaypoint('x', turn.road, turn.dir, turn.targetIndex, lane));
}

function spawnTrafficCar(game, x, y, axis, road, dir, targetIndex, lane) {
  const car = spawnVehicle(game, pickType(game.rand), x, y, 0, { driver: 'traffic' });
  setRoute(car, axis, road, dir, targetIndex, lane);
  car.parked = false;
  return car;
}

function randomSpawn(game) {
  const player = game.player;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const axis = game.rand() < 0.5 ? 'x' : 'y';
    if (axis === 'x') {
      const road = Math.floor(game.rand() * HY.length);
      const dir = game.rand() < 0.5 ? 1 : -1;
      const target = 1 + Math.floor(game.rand() * (VX.length - 2));
      const lane = Math.floor(game.rand() * LANES.length);
      const point = laneWaypoint('x', road, dir, target, lane);
      const x = point.x - dir * (120 + game.rand() * 320);
      const y = point.y;
      if (Math.hypot(x - player.x, y - player.y) < 480) continue;
      if (Math.hypot(x - player.x, y - player.y) > 1500) continue;
      if (tooClose(game, x, y, 64)) continue;
      const car = spawnTrafficCar(game, x, y, 'x', road, dir, target, lane);
      car.angle = dir > 0 ? 0 : Math.PI;
      car.vx = Math.cos(car.angle) * 90;
      car.vy = Math.sin(car.angle) * 90;
      return car;
    }
    const road = Math.floor(game.rand() * VX.length);
    const dir = game.rand() < 0.5 ? 1 : -1;
    const target = 1 + Math.floor(game.rand() * (HY.length - 2));
    const lane = Math.floor(game.rand() * LANES.length);
    const point = laneWaypoint('y', road, dir, target, lane);
    const x = point.x;
    const y = point.y - dir * (120 + game.rand() * 320);
    if (Math.hypot(x - player.x, y - player.y) < 480) continue;
    if (Math.hypot(x - player.x, y - player.y) > 1500) continue;
    if (tooClose(game, x, y, 64)) continue;
    const car = spawnTrafficCar(game, x, y, 'y', road, dir, target, lane);
    car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.vx = Math.cos(car.angle) * 90;
    car.vy = Math.sin(car.angle) * 90;
    return car;
  }
  return null;
}

function tooClose(game, x, y, distance) {
  for (const car of game.vehicles) {
    if (Math.hypot(car.x - x, car.y - y) < distance) return true;
  }
  return false;
}

export function seedTraffic(game) {
  for (let i = 0; i < TRAFFIC_TARGET; i += 1) randomSpawn(game);
}

/** Something this car is about to hit: another car, the player on foot, or a pedestrian. */
function blockedAhead(game, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const speed = speedOf(car);
  const reach = 54 + speed * 0.58;
  for (const other of game.vehicles) {
    if (other === car || other.exploded) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 4 || ahead > reach + other.length * 0.5) continue;
    const side = Math.abs(dx * -fy + dy * fx);
    if (side < car.width * 0.8 + other.width * 0.6) {
      const otherSpeed = other.vx * fx + other.vy * fy;
      if (otherSpeed < forwardSpeed(car) * 0.75) return true;
    }
  }
  const player = game.player;
  if (!player.inCar) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (ahead > 4 && ahead < 88 && side < 34) return true;
  }
  for (const person of game.people) {
    if (person.dead || person.team !== 'civil') continue;
    const dx = person.x - car.x;
    const dy = person.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (ahead > 2 && ahead < 68 && side < 26) return true;
  }
  return false;
}

export function updateTraffic(game, dt) {
  const player = game.player;
  for (let i = game.vehicles.length - 1; i >= 0; i -= 1) {
    const car = game.vehicles[i];
    if (!car.traffic || car.driver !== 'traffic') continue;
    car.hitFlash = Math.max(0, car.hitFlash - dt);
    if (car.exploded) continue;
    const state = car.traffic;
    if (Math.hypot(car.x - player.x, car.y - player.y) > 1900 && player.inCar !== car) {
      game.vehicles.splice(i, 1);
      continue;
    }
    if (!state.wps.length) planNext(game, car);
    const target = state.wps[0];
    if (Math.hypot(target.x - car.x, target.y - car.y) < 30) {
      state.wps.shift();
      if (!state.wps.length) planNext(game, car);
    }
    const next = state.wps[0] ?? target;
    const desired = Math.atan2(next.y - car.y, next.x - car.x);
    const diff = angleDiff(car.angle, desired);
    const speed = Math.abs(forwardSpeed(car));
    let cruise = state.cruise;
    if (Math.abs(diff) > 0.45) cruise = Math.min(cruise, 86);
    if (Math.abs(diff) > 1.0) cruise = Math.min(cruise, 58);
    const blocked = blockedAhead(game, car);
    car.controls.steer = clamp(diff * 2.4, -1, 1);
    if (blocked && speed < 220) {
      car.controls.throttle = 0;
      car.controls.brake = 1;
      state.stuck += dt;
    } else if (speed < cruise) {
      car.controls.throttle = 0.85;
      car.controls.brake = 0;
      state.stuck = 0;
    } else if (speed > cruise + 22) {
      car.controls.throttle = 0;
      car.controls.brake = 0.55;
    } else {
      car.controls.throttle = 0.25;
      car.controls.brake = 0;
    }
    car.controls.handbrake = false;
    stepVehicle(game, car, dt);
    if (state.stuck > 7) {
      // A jammed car nudges through after a while instead of blocking the street forever.
      car.controls.throttle = 0.7;
      car.controls.brake = 0;
      state.stuck = 0;
    }
  }
  const trafficCount = game.vehicles.filter((car) => car.traffic && car.driver === 'traffic').length;
  if (trafficCount < TRAFFIC_TARGET - 3 && game.rand() < 0.25) randomSpawn(game);
}
