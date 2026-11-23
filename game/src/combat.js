// Bullets and fists. A shot is a short, fast segment test against buildings, people and cars, so
// nothing tunnels through a wall; impacts throw the sand-coloured sparks the art direction uses
// instead of blood. Melee is a short cone in front of the attacker.

import { WEAPONS } from './config.js';
import { angleDiff, segmentHitsRect } from './math.js';
import { hasLineOfSight } from './world.js';
import { hurtPerson, panicNear, createPerson } from './people.js';
import { damageVehicle } from './vehicles.js';
import { muzzleFlash, spark, addShake } from './effects.js';

/** Distance along the segment at which it enters the rectangle, or Infinity. */
function segmentRectT(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  for (let axis = 0; axis < 2; axis += 1) {
    const p = axis === 0 ? dx : dy;
    const start = axis === 0 ? x1 : y1;
    const lo = axis === 0 ? rect.x : rect.y;
    const hi = axis === 0 ? rect.x + rect.w : rect.y + rect.h;
    if (Math.abs(p) < 1e-9) {
      if (start < lo || start > hi) return Infinity;
    } else {
      let t1 = (lo - start) / p;
      let t2 = (hi - start) / p;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

function closestT(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.0001) return 0;
  return Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
}

export function fireWeapon(game, { x, y, angle, weapon, owner, car = null }) {
  const stats = WEAPONS[weapon];
  if (!stats) return;
  for (let i = 0; i < stats.pellets; i += 1) {
    const spread = (Math.random() - 0.5) * stats.spread * 2;
    const a = angle + spread;
    const speed = stats.speed * (0.92 + Math.random() * 0.14);
    game.bullets.push({
      x, y, px: x, py: y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: Math.min(1.1, stats.range / stats.speed + 0.1),
      damage: stats.damage,
      owner,
      weapon,
      car,
    });
  }
  muzzleFlash(game, x, y, angle);
  if (owner === 'player') {
    panicNear(game, x, y, 320, { x, y });
    game.onGunfire?.(x, y);
  } else if (owner === 'gang') {
    panicNear(game, x, y, 260, { x, y });
    game.onGunfire?.(x, y, 'gang');
  }
}

export function meleeAttack(game, attacker, angle) {
  if (attacker.meleeCooldown > 0) return;
  attacker.meleeCooldown = WEAPONS.fists.rate;
  const stats = WEAPONS.fists;
  let hit = false;
  for (const person of game.people) {
    if (person.dead || person === attacker) continue;
    const dx = person.x - attacker.x;
    const dy = person.y - attacker.y;
    const d = Math.hypot(dx, dy);
    if (d > stats.range + 8) continue;
    if (Math.abs(angleDiff(angle, Math.atan2(dy, dx))) > 0.85) continue;
    hurtPerson(game, person, stats.damage, 'player', person.x, person.y);
    const push = 120;
    person.x += Math.cos(angle) * 8;
    person.y += Math.sin(angle) * 8;
    person.vx = Math.cos(angle) * push;
    person.vy = Math.sin(angle) * push;
    hit = true;
    game.audio.hit();
    break;
  }
  if (!hit) {
    for (const other of game.vehicles) {
      if (other.exploded) continue;
      const dx = other.x - attacker.x;
      const dy = other.y - attacker.y;
      if (Math.hypot(dx, dy) < stats.range + 18) {
        damageVehicle(game, other, 9);
        spark(game, other.x, other.y, angle, 3, '#ffd98a');
        game.audio.hit();
        hit = true;
        break;
      }
    }
  }
  attacker.attackTimer = 0.16;
}

export function updateBullets(game, dt) {
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = game.bullets[i];
    bullet.life -= dt;
    bullet.px = bullet.x;
    bullet.py = bullet.y;
    const nx = bullet.x + bullet.vx * dt;
    const ny = bullet.y + bullet.vy * dt;
    let bestT = 1.01;
    let target = null;
    let targetKind = null;

    for (const building of game.world.buildings) {
      const t = segmentRectT(bullet.x, bullet.y, nx, ny, building);
      if (t < bestT) {
        bestT = t;
        target = building;
        targetKind = 'building';
      }
    }
    for (const person of game.people) {
      if (person.dead) continue;
      if (person === game.player) continue;
      if (bullet.owner === 'player' && person.team === 'civil') {
        // Civilians can be hit, but the wanted level already pays for it.
      }
      const t = closestT(person.x, person.y, bullet.x, bullet.y, nx, ny);
      if (t < bestT) {
        const cx = bullet.x + (nx - bullet.x) * t;
        const cy = bullet.y + (ny - bullet.y) * t;
        if (Math.hypot(cx - person.x, cy - person.y) < person.radius + 2) {
          bestT = t;
          target = person;
          targetKind = 'person';
        }
      }
    }
    for (const car of game.vehicles) {
      if (car === bullet.car || car.exploded) continue;
      const t = closestT(car.x, car.y, bullet.x, bullet.y, nx, ny);
      if (t < bestT) {
        const cx = bullet.x + (nx - bullet.x) * t;
        const cy = bullet.y + (ny - bullet.y) * t;
        if (Math.hypot(cx - car.x, cy - car.y) < car.width * 0.66) {
          bestT = t;
          target = car;
          targetKind = 'car';
        }
      }
    }
    const player = game.player;
    if (!player.inCar && bullet.owner !== 'player') {
      const t = closestT(player.x, player.y, bullet.x, bullet.y, nx, ny);
      if (t < bestT) {
        const cx = bullet.x + (nx - bullet.x) * t;
        const cy = bullet.y + (ny - bullet.y) * t;
        if (Math.hypot(cx - player.x, cy - player.y) < player.radius + 2) {
          bestT = t;
          target = player;
          targetKind = 'player';
        }
      }
    }

    if (target) {
      const hx = bullet.x + (nx - bullet.x) * bestT;
      const hy = bullet.y + (ny - bullet.y) * bestT;
      if (targetKind === 'person') {
        hurtPerson(game, target, bullet.damage, bullet.owner === 'player' ? 'player' : bullet.owner, hx, hy);
      } else if (targetKind === 'car') {
        damageVehicle(game, target, bullet.damage * 0.55);
        spark(game, hx, hy, Math.atan2(-bullet.vy, -bullet.vx), 3, '#ffd98a');
        if (target === player.inCar) game.damagePlayer(bullet.damage * 0.2, 'gunfire');
        if (Math.random() < 0.4) game.audio.hit();
      } else if (targetKind === 'player') {
        game.damagePlayer(bullet.damage, bullet.owner);
        game.audio.hit();
      } else {
        spark(game, hx, hy, Math.atan2(-bullet.vy, -bullet.vx), 3, '#e8dcc0');
        if (Math.random() < 0.25) addShake(game, 0.8);
      }
      game.bullets.splice(i, 1);
      continue;
    }
    bullet.x = nx;
    bullet.y = ny;
    if (bullet.life <= 0 || nx < 0 || ny < 0 || nx > game.world.width || ny > game.world.height) {
      game.bullets.splice(i, 1);
    }
  }
}

/** A police or gang member takes a shot at a point, respecting line of sight and a little spread. */
export function npcFire(game, shooter, targetX, targetY, accuracy = 0.1) {
  if (shooter.cooldown > 0 || shooter.dead) return;
  const angle = Math.atan2(targetY - shooter.y, targetX - shooter.x) + (Math.random() - 0.5) * accuracy;
  shooter.aim = angle;
  if (!hasLineOfSight(game.world, shooter.x, shooter.y, targetX, targetY)) return;
  const weapon = shooter.weapon ?? 'pistol';
  const stats = WEAPONS[weapon] ?? WEAPONS.pistol;
  fireWeapon(game, {
    x: shooter.x + Math.cos(angle) * 13,
    y: shooter.y + Math.sin(angle) * 13,
    angle,
    weapon,
    owner: shooter.team === 'police' ? 'police' : 'gang',
  });
  shooter.cooldown = stats.rate + 0.5 + Math.random() * 0.6;
  game.audio.shoot(weapon);
}

export { createPerson };
