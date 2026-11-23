// Cars: the arcade handling (acceleration, steering, drift, handbrake, damage), burn-outs and
// explosions, the parked cars the city is born with, and the shared step every moving car runs.

import { PALETTE, VEHICLE, VEHICLE_TYPES } from './config.js';
import { clamp, dist, wrapAngle } from './math.js';

let nextCarId = 1;

export function createVehicle({ x, y, angle = 0, type = 'sedan', color, police = false, parked = false, driver = null, siren = false, taxi = false }) {
  const spec = VEHICLE_TYPES[type] ?? VEHICLE_TYPES.sedan;
  return {
    id: nextCarId++,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    type,
    spec,
    length: spec.length,
    width: spec.width,
    color: color ?? (police ? '#ece6d8' : PALETTE.cars[(nextCarId * 7) % PALETTE.cars.length]),
    roof: police ? '#23303c' : '#00000022',
    police,
    taxi,
    siren,
    parked,
    driver,
    health: VEHICLE.maxHealth,
    maxHealth: VEHICLE.maxHealth,
    burning: false,
    burnTimer: 0,
    exploded: false,
    removed: false,
    steer: 0,
    throttle: 0,
    handbrake: false,
    skidTimer: 0,
    smokeTimer: 0,
    hitFlash: 0,
    lastHit: 0,
    wheel: 0,
    horn: 0,
    ai: null,
    route: null,
    target: null,
  };
}

export function vehicleSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

export function createParkedVehicles(world) {
  const out = [];
  for (const spot of world.parked) {
    const car = createVehicle({
      x: spot.x,
      y: spot.y,
      angle: spot.angle,
      type: spot.type,
      color: spot.color,
      parked: true,
    });
    out.push(car);
  }
  return out;
}

/** Damage a car; enough of it sets it burning, which ends in an explosion. */
export function damageVehicle(car, amount, game, source = 'hit') {
  if (!car || car.exploded) return;
  car.health -= amount;
  car.hitFlash = 1;
  car.lastHit = 0.4;
  if (car.health <= 0 && !car.burning) {
    car.health = 0;
    car.burning = true;
    car.burnTimer = VEHICLE.burnTime;
    game.audio?.play('crash', car.x, car.y);
    game.effects?.smoke(car.x, car.y, 6);
  }
  if (car.burning && source === 'bullet') car.burnTimer = Math.min(car.burnTimer, 1.2);
}

export function explodeVehicle(car, game) {
  if (car.exploded) return;
  car.exploded = true;
  car.burning = false;
  car.removed = true;
  game.effects?.explosion(car.x, car.y);
  game.audio?.play('explosion', car.x, car.y);
  game.camera?.shake(18, 0.8);
  const p = game.player;
  if (p) {
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 110) {
      damagePlayer(game, 44 * (1 - d / 110), 'explosion');
      game.player.car = null;
      game.player.mode = 'foot';
      game.player.x = car.x + 30;
      game.player.y = car.y + 20;
    }
  }
  for (const other of game.vehicles) {
    if (other === car || other.exploded) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 120) damageVehicle(other, 130 * (1 - d / 120), game, 'explosion');
  }
  game.effects?.scorch(car.x, car.y);
  for (const ped of game.pedestrians?.people ?? []) {
    const d = dist(car.x, car.y, ped.x, ped.y);
    if (d < 140 && !ped.dead) {
      game.pedestrians.hurt(ped, 120, game);
    }
  }
}

function damagePlayer(game, amount, cause) {
  game.player?.hurt(amount, cause);
}

/** The shared arcade step. `controls` is {throttle -1..1, steer -1..1, handbrake, brake}. */
export function stepVehicle(car, dt, controls, game) {
  if (car.exploded || car.removed) return;
  car.hitFlash = Math.max(0, car.hitFlash - dt * 4);
  car.lastHit = Math.max(0, car.lastHit - dt);
  if (car.burning) {
    car.burnTimer -= dt;
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.08;
      game.effects?.fire(car.x + Math.cos(car.angle) * 6, car.y + Math.sin(car.angle) * 6);
    }
    if (car.burnTimer <= 0) {
      explodeVehicle(car, game);
      return;
    }
  }

  const throttle = clamp(controls?.throttle ?? 0, -1, 1);
  const steer = clamp(controls?.steer ?? 0, -1, 1);
  const handbrake = !!controls?.handbrake;
  car.throttle = throttle;
  car.handbrake = handbrake;
  car.steer += (steer - car.steer) * Math.min(1, dt * 9);

  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  let long = car.vx * cos + car.vy * sin;
  let lat = -car.vx * sin + car.vy * cos;
  const spec = car.spec;
  const speed = Math.hypot(car.vx, car.vy);
  const surface = game.world?.roads?.isOnRoad(car.x, car.y) ? 1 : 0.72;

  if (throttle > 0) {
    const headroom = clamp(1 - long / spec.top, 0, 1);
    long += throttle * spec.accel * surface * (0.35 + headroom * 0.9) * dt;
  } else if (throttle < 0) {
    if (long > 8) long -= 420 * dt;
    else long += throttle * spec.accel * 0.55 * dt;
  }
  if (controls?.brake) long -= Math.sign(long) * 560 * dt;
  long *= Math.exp(-(handbrake ? 2.4 : 0.5) * dt);
  if (handbrake) long *= Math.exp(-1.5 * dt);

  const grip = handbrake ? VEHICLE.handbrakeGrip : spec.grip * surface;
  lat *= Math.exp(-grip * dt);

  const steerAuthority = clamp(Math.abs(long) / 90, 0, 1) * (long < -4 ? 0.7 : 1);
  const direction = long < -4 ? -1 : 1;
  const turn = car.steer * spec.steer * steerAuthority * direction * (handbrake ? 1.35 : 1);
  car.angle = wrapAngle(car.angle + turn * dt);

  car.vx = Math.cos(car.angle) * long - Math.sin(car.angle) * lat;
  car.vy = Math.sin(car.angle) * long + Math.cos(car.angle) * lat;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.wheel += long * dt * 0.12;

  // Skid marks when the tyres break loose, and a little dust on sand.
  if ((handbrake && speed > 45) || Math.abs(lat) > 74 || (speed > 100 && !game.world?.roads?.isOnRoad(car.x, car.y))) {
    car.skidTimer -= dt;
    if (car.skidTimer <= 0) {
      car.skidTimer = 0.03;
      const back = -car.length * 0.32;
      const side = car.width * 0.36;
      const bx = car.x + Math.cos(car.angle) * back;
      const by = car.y + Math.sin(car.angle) * back;
      game.effects?.skid(bx - Math.sin(car.angle) * side, by + Math.cos(car.angle) * side, car.angle);
      game.effects?.skid(bx + Math.sin(car.angle) * side, by - Math.cos(car.angle) * side, car.angle);
      if (game.world && !game.world.roads.isOnRoad(car.x, car.y)) game.effects?.dust(car.x, car.y);
    }
  }

  // Probe the body at three points so a corner catches instead of passing through it.
  const probes = [-0.36, 0, 0.36];
  for (const f of probes) {
    const px = car.x + Math.cos(car.angle) * car.length * f;
    const py = car.y + Math.sin(car.angle) * car.length * f;
    const res = game.world.collideCircle(px, py, car.width * 0.56);
    if (res.hit) {
      if (res.hit.water) {
        car.vx *= 0.9;
        car.vy *= 0.9;
        if (car.driver === 'player') {
          game.player?.drown();
        }
        continue;
      }
      const dx = res.x - px;
      const dy = res.y - py;
      car.x += dx;
      car.y += dy;
      const nlen = Math.hypot(dx, dy) || 1;
      const nx = dx / nlen;
      const ny = dy / nlen;
      const into = car.vx * nx + car.vy * ny;
      car.vx -= nx * into * 1.6;
      car.vy -= ny * into * 1.6;
      car.vx *= 0.82;
      car.vy *= 0.82;
      const impact = Math.abs(into);
      if (impact > VEHICLE.damageAt && car.lastHit <= 0) {
        damageVehicle(car, (impact - VEHICLE.damageAt) * 0.56, game, 'crash');
        car.lastHit = 0.28;
        game.effects?.spark(car.x + nx * 20, car.y + ny * 20, 5);
        game.audio?.play('crash', car.x, car.y);
        game.camera?.shake(clamp(impact / 40, 1, 8), 0.2);
      }
    }
  }

  // Keep every car inside the map.
  car.x = clamp(car.x, 24, game.world.width - 20);
  car.y = clamp(car.y, 24, game.world.height - 20);
}

/** Cars are solid to each other: a simple separating shove with shared momentum. */
export function resolveVehiclePairs(game) {
  const cars = game.vehicles;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.exploded || a.removed) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.exploded || b.removed) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.length + b.length) * 0.3;
      if (d >= min || d < 0.001) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) * 0.5;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const impulse = -rel * 0.45;
        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        b.vx += nx * impulse;
        b.vy += ny * impulse;
        if (Math.abs(rel) > 120) {
          game.effects?.spark((a.x + b.x) / 2, (a.y + b.y) / 2, 4);
          if (a.driver === 'player' || b.driver === 'player') {
            damageVehicle(a.driver === 'player' ? a : b, Math.abs(rel) * 0.12, game, 'crash');
            game.audio?.play('crash', a.x, a.y);
          }
        }
      }
    }
  }
}

/** The nearest car a player on foot can get into. */
export function nearestEnterable(game, x, y, range) {
  let best = null;
  let bestD = range;
  for (const car of game.vehicles) {
    if (car.removed || car.exploded || car.driver === 'ai' || car.driver === 'cop') continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** A free spot beside a car to stand when getting out. */
export function exitSpot(car) {
  const side = -Math.PI / 2;
  return {
    x: car.x + Math.cos(car.angle + side) * (car.width * 0.9),
    y: car.y + Math.sin(car.angle + side) * (car.width * 0.9),
  };
}
