// Traffic: cars follow the lane graph, queue at red lights, keep their distance and
// occasionally pull into the opposite lane to pass a stopped car.

import { LANE } from './roads.js';
import { TRAFFIC_MODELS, WORLD, CITY } from './config.js';
import { clamp, dist, wrapAngle } from './math.js';
import { Rng } from './random.js';

export class Traffic {
  constructor(game, count = 20) {
    this.game = game;
    this.roads = game.roads;
    this.vehicles = game.vehicles;
    this.rng = new Rng(WORLD.seed ^ 0x7a2f);
    this.cars = [];
    this.targetCount = count;
    for (let i = 0; i < count; i += 1) this.spawnNear(game.player, 30 + i * 9);
  }

  directionOf(edge, dir) {
    if (edge.axis === 'h') return { x: dir, z: 0 };
    return { x: 0, z: dir };
  }

  spawnAt(x, z, heading, options = {}) {
    const modelId = options.modelId ?? this.rng.pick(TRAFFIC_MODELS);
    const car = this.vehicles.create(modelId, {
      x, z, heading,
      colorSeed: this.rng.int(0, 99),
      driver: 'traffic',
      lock: options.lock ?? false,
    });
    const axis = Math.abs(Math.cos(heading)) > Math.abs(Math.sin(heading)) ? 'h' : 'v';
    const dirX = Math.cos(heading) >= 0 ? 1 : -1;
    const dirZ = Math.sin(heading) >= 0 ? 1 : -1;
    const node = this.roads.nearestNode(x, z);
    const from = axis === 'h'
      ? this.roads.node(dirX > 0 ? node.col : node.col + 1, node.row)
      : this.roads.node(node.col, dirZ > 0 ? node.row : node.row + 1);
    const to = axis === 'h'
      ? this.roads.node(dirX > 0 ? from.col + 1 : from.col - 1, from.row)
      : this.roads.node(from.col, dirZ > 0 ? from.row + 1 : from.row - 1);
    car.ai = {
      axis,
      dirX: axis === 'h' ? dirX : 0,
      dirZ: axis === 'v' ? dirZ : 0,
      from,
      to: to ?? from,
      laneTarget: LANE,
      lane: LANE,
      desired: options.desired ?? this.rng.range(9, 13.6),
      overtake: 0,
      blocked: 0,
      wait: 0,
      stuck: 0,
    };
    this.cars.push(car);
    return car;
  }

  spawnNear(player, offset = 0) {
    let spot = null;
    let tries = 0;
    while (!spot && tries < 30) {
      spot = this.roads.spawnLane(this.rng, player);
      tries += 1;
      if (spot && dist(spot.x, spot.z, player.x, player.z) < 30) spot = null;
    }
    if (!spot) return null;
    const car = this.spawnAt(spot.x, spot.z, spot.heading);
    if (car) {
      car.ai.spawnOffset = offset;
      car.speed = car.ai.desired * 0.6;
      car.vx = Math.cos(spot.heading) * car.speed;
      car.vz = Math.sin(spot.heading) * car.speed;
    }
    return car;
  }

  retarget(car) {
    const ai = car.ai;
    const options = [];
    const prev = { x: ai.dirX, z: ai.dirZ };
    for (const [dx, dz, weight] of [
      [prev.x, prev.z, 0.6],
      [-prev.z, prev.x, 0.2],
      [prev.z, -prev.x, 0.2],
    ]) {
      const next = this.roads.stepNode(ai.to.col, ai.to.row, dx, dz);
      if (!next) continue;
      options.push({ dx, dz, next, weight });
    }
    if (!options.length) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = this.roads.stepNode(ai.to.col, ai.to.row, dx, dz);
        if (next) options.push({ dx, dz, next, weight: 1 });
      }
    }
    if (!options.length) return;
    let total = options.reduce((sum, option) => sum + option.weight, 0);
    let roll = this.rng.float() * total;
    let chosen = options[options.length - 1];
    for (const option of options) {
      roll -= option.weight;
      if (roll <= 0) {
        chosen = option;
        break;
      }
    }
    ai.from = ai.to;
    ai.to = chosen.next;
    ai.dirX = chosen.dx;
    ai.dirZ = chosen.dz;
    ai.axis = chosen.dz === 0 ? 'h' : 'v';
    ai.overtake = 0;
  }

  leaderFor(car) {
    const fx = Math.cos(car.heading);
    const fz = Math.sin(car.heading);
    let best = null;
    let bestAhead = 12;
    for (const other of this.cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = dx * fx + dz * fz;
      const lateral = Math.abs(dx * -fz + dz * fx);
      if (ahead > 0.5 && ahead < bestAhead && lateral < 2.7) {
        bestAhead = ahead;
        best = other;
      }
    }
    return best ? { car: best, ahead: bestAhead } : null;
  }

  oncomingClear(car) {
    const fx = Math.cos(car.heading);
    const fz = Math.sin(car.heading);
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = dx * fx + dz * fz;
      const lateral = Math.abs(dx * -fz + dz * fx);
      if (ahead > 0 && ahead < 22 && lateral < 5.5) {
        const dot = Math.cos(other.heading) * fx + Math.sin(other.heading) * fz;
        if (dot < -0.3) return false;
      }
    }
    return true;
  }

  update(dt) {
    const time = this.game.tick;
    for (const car of this.cars) {
      const ai = car.ai;
      if (!ai || car.wrecked || car.driver !== 'traffic') continue;
      const to = ai.to;
      const nodeDist = Math.hypot(to.x - car.x, to.z - car.z);
      if (nodeDist < 10.5) this.retarget(car);
      const dir = { x: ai.dirX, z: ai.dirZ };
      const right = { x: -dir.z, z: dir.x };
      const laneOffset = ai.lane;
      const targetX = ai.to.x + right.x * laneOffset;
      const targetZ = ai.to.z + right.z * laneOffset;
      let targetSpeed = ai.desired;
      const light = this.roads.lightState(ai.to, ai.axis, time);
      const stopLine = Math.hypot(ai.to.x - car.x, ai.to.z - car.z) - 9;
      if (light !== 'green' && stopLine < 10 && stopLine > -3) {
        targetSpeed = Math.min(targetSpeed, Math.max(0, stopLine * 1.5));
        if (light === 'red' && stopLine < 6) targetSpeed = 0;
      }
      const leader = ai.overtake > 0 ? null : this.leaderFor(car);
      if (leader) {
        ai.blocked += dt;
        targetSpeed = Math.min(targetSpeed, Math.max(0, (leader.ahead - 4.5) * 2.2));
        if (ai.blocked > 2.2 && ai.overtake <= 0 && car.speed < 4 && this.oncomingClear(car)) {
          ai.overtake = 2.6;
          ai.blocked = 0;
        }
      } else {
        ai.blocked = Math.max(0, ai.blocked - dt);
      }
      if (ai.overtake > 0) {
        ai.overtake -= dt;
        ai.laneTarget = -LANE;
      } else {
        ai.laneTarget = LANE;
      }
      ai.lane += (ai.laneTarget - ai.lane) * Math.min(1, dt * 1.8);
      // Unstick after a long wait.
      if (Math.abs(car.speed) < 0.25) ai.wait += dt;
      else ai.wait = 0;
      if (ai.wait > 5) {
        ai.wait = 0;
        car.x += Math.cos(car.heading + Math.PI / 2) * 0.8;
      }
      const desired = Math.atan2(targetZ - car.z, targetX - car.x);
      const diff = wrapAngle(desired - car.heading);
      const steer = clamp(diff * 2.5, -1, 1);
      const speedError = targetSpeed - Math.abs(car.speed);
      let throttle = speedError > 0.4 ? clamp(speedError * 0.5, 0.12, 1) : 0;
      let brake = 0;
      if (speedError < -1) brake = clamp(-speedError * 0.25, 0.15, 1);
      if (targetSpeed < 0.3 && Math.abs(car.speed) < 1.2) brake = 0.8;
      this.vehicles.setControls(car, throttle, brake, steer, false);
    }
    // Keep the population around the player.
    for (const car of this.cars.slice()) {
      if (!car.lock && dist(car.x, car.z, this.game.player.x, this.game.player.z) > 205) {
        this.vehicles.remove(car);
        this.cars.splice(this.cars.indexOf(car), 1);
      }
    }
    while (this.cars.length < this.targetCount) {
      if (!this.spawnNear(this.game.player, this.cars.length * 7)) break;
    }
  }

  countNear(x, z, radius) {
    return this.cars.filter((car) => dist(car.x, car.z, x, z) < radius).length;
  }

  clear() {
    for (const car of this.cars.slice()) this.vehicles.remove(car);
    this.cars.length = 0;
  }

  spawnShotCar(x, z, heading, modelId) {
    const car = this.spawnAt(x, z, heading, { modelId, lock: true, desired: 11 });
    car.speed = 11;
    car.vx = Math.cos(heading) * car.speed;
    car.vz = Math.sin(heading) * car.speed;
    return car;
  }

  get cityCars() {
    return this.cars;
  }

  bounds() {
    return { maxX: CITY.waterX, maxZ: CITY.maxZ };
  }
}
