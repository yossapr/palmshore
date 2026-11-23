// Cars: creation, arcade driving physics (acceleration, steering, lateral grip and drift, a
// handbrake), damage, burning wrecks and explosions, plus the car-against-car collision pass.
// The player, traffic and police all drive through stepVehicle with different controls.

import { VEHICLES, PALETTE } from './config.js';
import { clamp, damp } from './math.js';
import { resolveCircle } from './world.js';
import { explosion, puff, spark, tyreSmoke, addSkid, addShake } from './effects.js';
import { blastPeople } from './people.js';

let nextVehicleId = 1;

export function createVehicle(type, x, y, angle, options = {}) {
  const stats = VEHICLES[type] ?? VEHICLES.sedan;
  const color = options.color ?? stats.colors[Math.floor(Math.random() * stats.colors.length)];
  return {
    id: nextVehicleId++,
    type,
    stats,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    steer: 0,
    throttle: 0,
    brake: 0,
    controls: { throttle: 0, brake: 0, steer: 0, handbrake: false },
    length: stats.length,
    width: stats.width,
    color,
    health: stats.health,
    maxHealth: stats.health,
    driver: options.driver ?? null,
    traffic: options.traffic ?? null,
    parked: options.parked ?? false,
    police: options.police ?? false,
    mission: options.mission ?? null,
    label: options.label ?? null,
    burning: 0,
    exploded: false,
    deadTimer: 0,
    hitFlash: 0,
    siren: options.police ? true : false,
    sirenPhase: Math.random() * Math.PI * 2,
    wheel: 0,
    skidTimer: 0,
    smokeTimer: 0,
    horn: 0,
    ai: null,
    hazard: false,
  };
}

export function spawnVehicle(game, type, x, y, angle, options = {}) {
  const car = createVehicle(type, x, y, angle, options);
  game.vehicles.push(car);
  return car;
}

export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

export function speedOf(car) {
  return Math.hypot(car.vx, car.vy);
}

export function stepVehicle(game, car, dt) {
  car.hitFlash = Math.max(0, car.hitFlash - dt);
  car.sirenPhase += dt * 7;
  if (car.burning > 0) {
    car.burning -= dt;
    car.throttle = 0;
    if (Math.random() < 0.55) {
      puff(game, car.x + (Math.random() - 0.5) * 18, car.y + (Math.random() - 0.5) * 18, '#4d463e', 9);
    }
    if (Math.random() < 0.35) {
      spark(game, car.x, car.y, Math.random() * Math.PI * 2, 1, '#ffb03a');
    }
    if (car.burning <= 0) explodeVehicle(game, car);
  }
  if (car.exploded) {
    car.vx = 0;
    car.vy = 0;
    return;
  }
  const stats = car.stats;
  const controls = car.controls;
  const forward = Math.cos(car.angle);
  const sideways = Math.sin(car.angle);
  let vf = car.vx * forward + car.vy * sideways;
  let vl = -car.vx * sideways + car.vy * forward;
  const throttle = car.burning > 0 ? 0 : controls.throttle;
  const brake = car.burning > 0 ? 0 : controls.brake;
  const steer = controls.steer;
  const handbrake = controls.handbrake && car.burning <= 0;

  let engine = 0;
  if (throttle > 0) {
    engine = vf < -8 ? stats.brake : stats.accel * (1 - clamp(vf / stats.maxSpeed, 0, 0.9)) * throttle;
  } else if (brake > 0) {
    engine = vf > 8 ? -stats.brake * brake : -stats.accel * 0.55 * brake;
  }
  vf += engine * dt;
  vf -= vf * 0.45 * dt;
  if (handbrake) vf -= vf * 1.7 * dt;
  vf = clamp(vf, -stats.maxSpeed * 0.32, stats.maxSpeed);

  const speedFactor = clamp(Math.abs(vf) / 60, 0, 1);
  car.steer = damp(car.steer, steer, 9, dt);
  const turnRate = stats.turn * (handbrake ? 1.3 : 1) * (1 - clamp(Math.abs(vf) / stats.maxSpeed, 0, 1) * 0.34);
  car.angle += car.steer * turnRate * speedFactor * Math.sign(vf || 1) * dt;

  const nf = Math.cos(car.angle);
  const ns = Math.sin(car.angle);
  const lateral = -car.vx * ns + car.vy * nf;
  const grip = handbrake ? stats.grip * 0.16 : stats.grip;
  const newLateral = lateral * Math.exp(-grip * dt);
  car.vx = nf * vf + -ns * newLateral;
  car.vy = ns * vf + nf * newLateral;

  const oldX = car.x;
  const oldY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const radius = car.width * 0.66;
  const resolved = resolveCircle(game.world, car.x, car.y, radius);
  if (resolved.hit) {
    const pushX = resolved.x - car.x;
    const pushY = resolved.y - car.y;
    const pushLen = Math.hypot(pushX, pushY);
    if (pushLen > 0.01) {
      const nx = pushX / pushLen;
      const ny = pushY / pushLen;
      const into = car.vx * nx + car.vy * ny;
      if (into < 0) {
        car.vx -= nx * into * 1.3;
        car.vy -= ny * into * 1.3;
        const impact = -into;
        if (impact > 55) {
          damageVehicle(game, car, (impact - 45) * 0.14);
          spark(game, resolved.x - nx * radius, resolved.y - ny * radius, Math.atan2(-ny, -nx), 4, '#ffd98a');
          if (game.player.inCar === car) addShake(game, Math.min(7, impact * 0.03));
          car.vx *= 0.8;
          car.vy *= 0.8;
        }
      }
    }
    car.x = resolved.x;
    car.y = resolved.y;
  }
  car.wheel += vf * dt * 0.08;

  const slip = Math.abs(newLateral);
  const speed = Math.hypot(car.vx, car.vy);
  if ((slip > 38 && speed > 58) || (handbrake && speed > 45)) {
    car.skidTimer -= dt;
    if (car.skidTimer <= 0) {
      car.skidTimer = 0.035;
      const ox = Math.cos(car.angle + Math.PI / 2) * (car.width * 0.42);
      const oy = Math.sin(car.angle + Math.PI / 2) * (car.width * 0.42);
      const rear = -car.length * 0.3;
      const fx = Math.cos(car.angle) * rear;
      const fy = Math.sin(car.angle) * rear;
      addSkid(game, car.x + fx + ox, car.y + fy + oy, car.x + fx + ox - car.vx * 0.02, car.y + fy + oy - car.vy * 0.02);
      addSkid(game, car.x + fx - ox, car.y + fy - oy, car.x + fx - ox - car.vx * 0.02, car.y + fy - oy - car.vy * 0.02);
      if (Math.random() < 0.5) tyreSmoke(game, car.x + fx, car.y + fy);
    }
  }
  if (car.health < car.maxHealth * 0.4 && !car.exploded) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.28;
      puff(game, car.x - Math.cos(car.angle) * car.length * 0.32, car.y - Math.sin(car.angle) * car.length * 0.32, '#6f675c', 6);
    }
  }
  if (speed > 4) {
    car.parked = false;
  }
  // A car shoved onto the beach or a lawn still leaves tracks in the sand.
  if (speed > 90 && Math.random() < 0.02) puff(game, oldX, oldY, '#e4d3ac', 3);
}

export function damageVehicle(game, car, amount) {
  if (car.exploded) return;
  car.health -= amount;
  car.hitFlash = 0.16;
  if (car.health <= 0 && car.burning <= 0) {
    car.burning = 2.6;
    puff(game, car.x, car.y, '#49423a', 12);
  }
}

export function explodeVehicle(game, car) {
  if (car.exploded) return;
  car.exploded = true;
  car.burning = 0;
  explosion(game, car.x, car.y, 1.15);
  blastPeople(game, car.x, car.y, 150, 95, 'explosion');
  for (const other of game.vehicles) {
    if (other === car || other.exploded) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 170) damageVehicle(game, other, 60 * (1 - d / 170));
  }
  if (game.player.inCar === car) game.damagePlayer(130, 'explosion');
  game.onExplosion?.(car.x, car.y);
}

/** Resolve overlapping cars with a simple mass-weighted impulse and a little impact damage. */
export function collideVehicles(game) {
  const cars = game.vehicles;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.exploded) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.exploded) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const radius = a.width * 0.62 + b.width * 0.62;
      if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue;
      const d = Math.hypot(dx, dy);
      if (d >= radius || d < 0.001) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = radius - d;
      const ma = a.stats.mass;
      const mb = b.stats.mass;
      const total = ma + mb;
      a.x -= nx * overlap * (mb / total);
      a.y -= ny * overlap * (mb / total);
      b.x += nx * overlap * (ma / total);
      b.y += ny * overlap * (ma / total);
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const impulse = (-(1 + 0.25) * vn) / (1 / ma + 1 / mb);
        a.vx -= (impulse * nx) / ma;
        a.vy -= (impulse * ny) / ma;
        b.vx += (impulse * nx) / mb;
        b.vy += (impulse * ny) / mb;
        const impact = -vn;
        if (impact > 65) {
          damageVehicle(game, a, (impact - 55) * 0.1);
          damageVehicle(game, b, (impact - 55) * 0.1);
          spark(game, a.x + nx * a.width * 0.5, a.y + ny * a.width * 0.5, Math.atan2(ny, nx), 4, '#ffe0a0');
          if (game.player.inCar === a || game.player.inCar === b) {
            addShake(game, Math.min(8, impact * 0.035));
            game.damagePlayer(impact * 0.02, 'crash');
          }
        }
      }
    }
  }
}

/** The closest car whose body is within reach; the player's own car is skipped. */
export function nearestVehicle(game, x, y, maxDistance, filter = null) {
  let best = null;
  let bestDistance = maxDistance;
  for (const car of game.vehicles) {
    if (car.exploded || car.burning > 0) continue;
    if (filter && !filter(car)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = car;
    }
  }
  return best ? { car: best, distance: bestDistance } : null;
}

export function vehicleTint(car) {
  if (car.exploded) return '#3a3631';
  if (car.burning > 0) return PALETTE.inkSoft;
  return car.color;
}
