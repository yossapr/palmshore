// Traffic: cars that belong to the street grid, keep to their side of the road, slow behind
// whatever is ahead, roll through the junctions and are respawned off-screen so the city keeps
// moving. They are ordinary vehicles once a bullet or a bumper finds them.

import { CITY, PALETTE } from './config.js';
import { createVehicle } from './vehicles.js';
import { clamp, dist } from './math.js';
import { streamOf } from './random.js';

const TYPES = ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'pickup', 'sports'];

export function createTraffic(world, seed, count = 34) {
  const rng = streamOf(seed, 23);
  const cars = [];
  const tmp = {};

  function makeCar(nearPlayer = false, player = null) {
    let route = world.roads.spawnRoute(rng, nearPlayer && player ? player : null);
    let attempts = 0;
    while (player && dist(route.x, route.y, player.x, player.y) < 380 && attempts < 12) {
      route = world.roads.spawnRoute(rng, null);
      attempts += 1;
    }
    const type = rng.pick(TYPES);
    const car = createVehicle({
      x: route.x,
      y: route.y,
      angle: route.angle,
      type,
      color: type === 'taxi' ? '#e6b357' : rng.pick(PALETTE.cars),
      taxi: type === 'taxi',
      driver: 'ai',
    });
    car.speed = rng.range(96, 158);
    car.cruise = car.speed;
    car.route = { node: route.node, dir: route.dir, lane: route.lane, t: route.t };
    car.turnBlend = 0;
    car.turnFrom = null;
    car.honkTimer = rng.range(3, 20);
    cars.push(car);
    return car;
  }

  for (let i = 0; i < count; i += 1) makeCar();

  function aheadOnLane(car, game) {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    let nearest = 400;
    const check = (other, otherSpeed) => {
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (along > 0 && along < nearest && side < 34) nearest = along;
      return along;
    };
    for (const other of cars) {
      if (other === car || other.removed || other.exploded) continue;
      const along = check(other, other.speed);
      if (along > 0 && along < 90) return Math.min(nearest, along);
    }
    const p = game.player;
    if (p.mode === 'foot') {
      const along = check(p, 0);
      if (along > 0 && along < 100) return Math.min(nearest, along);
    }
    return nearest;
  }

  function update(game, dt) {
    const player = game.player;
    for (const car of cars) {
      if (car.removed || car.exploded) continue;
      if (!car.route) continue;
      const r = car.route;
      const road = world.roads;
      const segLen = CITY.pitch;
      const ahead = aheadOnLane(car, game);
      const targetSpeed = car.cruise * (ahead < 90 ? clamp((ahead - 26) / 64, 0, 1) : 1);
      car.speed += clamp(targetSpeed - car.speed, -220 * dt, 90 * dt);
      // Yield at a busy junction now and then.
      let hold = false;
      if (r.t > 0.86) {
        const node = road.node(r.node.i + r.dir.dx, r.node.j + r.dir.dy);
        for (const other of cars) {
          if (other === car || !other.route) continue;
          if (dist(other.x, other.y, node.x, node.y) < 64 && other.route.t < 0.2) {
            hold = true;
            break;
          }
        }
      }
      const speed = hold ? 0 : car.speed;
      r.t += (speed * dt) / segLen;
      const p = road.railPoint(r.node, r.dir, r.lane, Math.min(r.t, 1), tmp);
      car.angle = p.angle;
      car.vx = Math.cos(p.angle) * speed;
      car.vy = Math.sin(p.angle) * speed;

      if (r.t >= 1) {
        const endNode = road.node(r.node.i + r.dir.dx, r.node.j + r.dir.dy);
        const next = road.nextRoute(rng, endNode, r.dir, r.lane);
        const oldX = p.ex;
        const oldY = p.ey;
        r.node = endNode;
        r.dir = next.dir;
        r.lane = next.lane;
        r.t -= 1;
        const np = road.railPoint(r.node, r.dir, r.lane, Math.max(0, r.t), tmp);
        car.turnFrom = { x: oldX, y: oldY };
        car.turnBlend = 0.22;
        car.x = np.x;
        car.y = np.y;
      } else if (car.turnBlend > 0) {
        car.turnBlend -= dt;
        const k = clamp(1 - car.turnBlend / 0.22, 0, 1);
        car.x = car.turnFrom.x + (p.x - car.turnFrom.x) * k;
        car.y = car.turnFrom.y + (p.y - car.turnFrom.y) * k;
      } else {
        car.x = p.x;
        car.y = p.y;
      }

      car.wheel += speed * dt * 0.08;
      // Respawn a car that is left far behind, and recycle wrecks.
      if (dist(car.x, car.y, player.x, player.y) > 2100) {
        car.removed = true;
      }
      if (car.burning) {
        car.burnTimer -= dt;
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.1;
          game.effects?.smoke(car.x, car.y, 1);
        }
        if (car.burnTimer <= 0) {
          game.effects?.explosion(car.x, car.y);
          game.audio?.play('explosion', car.x, car.y);
          car.exploded = true;
          car.removed = true;
          game.camera?.shake(10, 0.5);
        }
      }
    }
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      if (cars[i].removed) cars.splice(i, 1);
    }
    while (cars.length < count) makeCar(true, player);
  }

  return { cars, update, makeCar };
}
