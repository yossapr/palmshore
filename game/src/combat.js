// Bullets, melee, pickups and the damage rules that bind them: what a shot can hit and what it
// does when it lands. Muzzle flashes and blood belong to effects.js; this file is the maths.

import { WEAPONS, PLAYER } from './config.js';
import { clamp, dist, wrapAngle } from './math.js';
import { damageVehicle } from './vehicles.js';

export function createCombat() {
  const bullets = [];
  const pickups = [];
  const tracers = [];

  function addBullet(x, y, angle, speed, damage, owner, color, life = 0.9) {
    bullets.push({
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      owner,
      color,
      life,
      speed,
    });
  }

  /** Fire one weapon: the player's, a cop's or a goon's. */
  function shootWeapon(game, weaponName, x, y, angle, owner = 'player') {
    const w = WEAPONS[weaponName] ?? WEAPONS.pistol;
    const pellets = w.pellets ?? 1;
    for (let k = 0; k < pellets; k += 1) {
      const spread = (Math.random() - 0.5) * (w.spread ?? 0.04) * 2;
      addBullet(x, y, angle + spread, w.speed ?? 760, w.damage, owner, w.tracer ?? '#ffe6b0', 0.72);
    }
    game.effects?.muzzle(x, y, angle, w.pellets ? 1.6 : 1);
    game.effects?.smoke(x + Math.cos(angle) * 12, y + Math.sin(angle) * 12, 1);
    game.audio?.play(w.sound ?? 'pistol', x, y);
    game.camera?.shake(w.melee ? 2 : w.pellets ? 6 : 2.5, 0.12);
    game.pedestrians?.panicAt(x, y, w.melee ? 90 : 330, { x, y });
    if (owner === 'player' && !w.melee) game.police?.addHeat(1.3, game);
    for (const ped of game.pedestrians?.people ?? []) {
      if (ped.kind !== 'ped' || ped.dead) continue;
      if (Math.random() < 0.35) ped.fleeFrom = { x, y };
    }
  }

  function spawnPickup(game, x, y, type, amount = 0) {
    if (pickups.length > 70) pickups.shift();
    pickups.push({ x, y, type, amount, rot: Math.random() * 6.28, life: 0, bob: Math.random() * 6.28 });
  }

  function createWorldPickups(world) {
    const spots = [
      { x: world.landmarks.hospital?.x ?? 1200, y: world.landmarks.hospital?.y ?? 900, type: 'health' },
      { x: world.landmarks.police?.x ?? 1600, y: world.landmarks.police?.y ?? 1200, type: 'armour' },
      { x: world.landmarks.safehouse?.x ?? 700, y: world.landmarks.safehouse?.y ?? 1600, type: 'health' },
      { x: world.landmarks.park?.x ?? 2000, y: world.landmarks.park?.y ?? 1700, type: 'ammo' },
      { x: world.landmarks.pier9?.x ?? 1200, y: (world.landmarks.pier9?.y ?? 3000) + 80, type: 'ammo' },
      { x: (world.landmarks.coralArms?.x ?? 4000) + 60, y: (world.landmarks.coralArms?.y ?? 900) + 40, type: 'armour' },
    ];
    for (const s of spots) {
      if (!world.solidAt(s.x, s.y)) pickups.push({ x: s.x, y: s.y, type: s.type, amount: 0, rot: 0, life: 0, bob: Math.random() * 6.28 });
    }
  }

  function hurtCop(cop, amount, game, byPlayer = false) {
    if (cop.dead) return;
    cop.health -= amount;
    cop.hurtFlash = 1;
    game.effects?.blood(cop.x, cop.y, 3);
    if (cop.health <= 0) {
      cop.dead = true;
      cop.deadTimer = 0;
      game.effects?.blood(cop.x, cop.y, 8);
      game.audio?.play('bodyfall', cop.x, cop.y);
      game.police?.onCopDown(cop);
      if (byPlayer) game.police?.addHeat(1.1);
      if (Math.random() < 0.55) spawnPickup(game, cop.x, cop.y, 'ammo', 12);
    }
  }

  function hurtEnemy(enemy, amount, game, byPlayer = true) {
    if (enemy.dead) return;
    enemy.health -= amount;
    enemy.hurtFlash = 1;
    enemy.panic = 0;
    game.effects?.blood(enemy.x, enemy.y, 3);
    if (enemy.health <= 0) {
      enemy.dead = true;
      enemy.deadTimer = 0;
      game.effects?.blood(enemy.x, enemy.y, 9);
      game.audio?.play('bodyfall', enemy.x, enemy.y);
      if (byPlayer) {
        game.stats.kills = (game.stats.kills ?? 0) + 1;
        if (Math.random() < 0.6) spawnPickup(game, enemy.x, enemy.y, Math.random() < 0.5 ? 'cash' : 'ammo', Math.random() < 0.5 ? 80 : 15);
      }
    }
  }

  function nearestTargetTo(game, x, y, angle, range, arc) {
    let best = null;
    let bestScore = Infinity;
    const test = (list, kind, alive) => {
      for (const e of list) {
        if (!alive(e)) continue;
        const d = dist(x, y, e.x, e.y);
        if (d > range) continue;
        const a = Math.atan2(e.y - y, e.x - x);
        if (Math.abs(wrapAngle(a - angle)) > arc / 2) continue;
        if (d < bestScore) {
          bestScore = d;
          best = { kind, entity: e };
        }
      }
    };
    test(game.enemies ?? [], 'enemy', (e) => !e.dead);
    test(game.police?.cops ?? [], 'cop', (e) => !e.dead);
    test(game.pedestrians?.people ?? [], 'ped', (e) => !e.dead && e.kind === 'ped' && !e.robbed);
    return best;
  }

  function melee(game) {
    const p = game.player;
    const target = nearestTargetTo(game, p.x, p.y, p.aim, 46, 1.8);
    game.effects?.swing(p.x, p.y, p.aim);
    game.audio?.play('punch', p.x, p.y);
    if (!target) return false;
    const e = target.entity;
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    e.x += Math.cos(ang) * 12;
    e.y += Math.sin(ang) * 12;
    if (target.kind === 'enemy') hurtEnemy(e, 34, game);
    else if (target.kind === 'cop') hurtCop(e, 30, game, true);
    else {
      game.pedestrians.hurt(e, 20, game, true);
      if (target.kind === 'ped') {
        e.robbed = true;
        game.player.money += 35;
        game.effects?.text(e.x, e.y - 16, '+$35', '#f4dfa4');
        game.police?.addHeat(0.35);
      }
    }
    game.effects?.spark(e.x, e.y, 3);
    return true;
  }

  function updateBullets(game, dt) {
    const p = game.player;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }
      const travel = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.ceil(travel / 12));
      const stepX = (b.vx * dt) / steps;
      const stepY = (b.vy * dt) / steps;
      let dead = false;
      for (let s = 0; s < steps && !dead; s += 1) {
        b.px = b.x;
        b.py = b.y;
        b.x += stepX;
        b.y += stepY;
        if (b.life < 0.62 && b.owner === 'player') tracers.push({ x1: b.px, y1: b.py, x2: b.x, y2: b.y, life: 0.08 });
        // Walls.
        const solid = game.world.solidAt(b.x, b.y);
        if (solid) {
          game.effects?.spark(b.x, b.y, 3);
          if (Math.random() < 0.4) game.audio?.play('thud', b.x, b.y);
          dead = true;
          break;
        }
        if (b.owner !== 'player') {
          if (p.mode === 'foot' && dist(b.x, b.y, p.x, p.y) < PLAYER.radius + 3) {
            p.hurt(b.damage, 'bullet');
            dead = true;
            break;
          }
          if (p.mode === 'car' && p.car && dist(b.x, b.y, p.car.x, p.car.y) < p.car.length * 0.4) {
            damageVehicle(p.car, b.damage * 0.6, game, 'bullet');
            game.effects?.spark(b.x, b.y, 2);
            dead = true;
            break;
          }
          for (const cop of game.police?.cops ?? []) {
            if (!cop.dead && dist(b.x, b.y, cop.x, cop.y) < 11) dead = true;
          }
          for (const enemy of game.enemies ?? []) {
            if (!enemy.dead && dist(b.x, b.y, enemy.x, enemy.y) < 11) dead = true;
          }
        } else {
          let hit = false;
          for (const enemy of game.enemies ?? []) {
            if (enemy.dead || hit) continue;
            if (dist(b.x, b.y, enemy.x, enemy.y) < 12) {
              hurtEnemy(enemy, b.damage, game);
              hit = true;
            }
          }
          for (const cop of game.police?.cops ?? []) {
            if (cop.dead || hit) continue;
            if (dist(b.x, b.y, cop.x, cop.y) < 12) {
              hurtCop(cop, b.damage, game, true);
              hit = true;
            }
          }
          for (const ped of game.pedestrians?.people ?? []) {
            if (ped.dead || hit || ped.kind !== 'ped') continue;
            if (dist(b.x, b.y, ped.x, ped.y) < 12) {
              game.pedestrians.hurt(ped, b.damage, game, true);
              hit = true;
            }
          }
          for (const car of game.vehicles) {
            if (hit || car.removed || car.exploded || car === p.car) continue;
            if (dist(b.x, b.y, car.x, car.y) < car.length * 0.42) {
              damageVehicle(car, b.damage * 1.35, game, 'bullet');
              game.effects?.spark(b.x, b.y, 3);
              hit = true;
              if (car.driver === 'ai' || car.driver === 'cop') game.police?.addHeat(0.12);
            }
          }
          if (hit) dead = true;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) tracers.splice(i, 1);
    }
  }

  function updatePickups(game, dt) {
    const p = game.player;
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pick = pickups[i];
      pick.rot += dt * 1.6;
      pick.life += dt;
      if (dist(pick.x, pick.y, p.x, p.y) > 30) continue;
      let taken = false;
      if (pick.type === 'health') {
        if (p.health < 100) {
          p.health = Math.min(100, p.health + 35);
          taken = true;
          game.effects?.text(pick.x, pick.y - 12, '+35 HEALTH', '#9fd6b4');
        }
      } else if (pick.type === 'armour') {
        if (p.armour < 100) {
          p.armour = Math.min(100, p.armour + 40);
          taken = true;
          game.effects?.text(pick.x, pick.y - 12, '+40 ARMOUR', '#9fc4de');
        }
      } else if (pick.type === 'ammo') {
        const gun = p.weapon === 'fists' ? 'pistol' : p.weapon;
        p.weapons[gun].ammo += gun === 'shotgun' ? 6 : gun === 'smg' ? 24 : 12;
        taken = true;
        game.effects?.text(pick.x, pick.y - 12, '+AMMO', '#f4dfa4');
      } else if (pick.type === 'cash') {
        p.money += pick.amount;
        game.stats.earned = (game.stats.earned ?? 0) + pick.amount;
        taken = true;
        game.effects?.text(pick.x, pick.y - 14, `+$${pick.amount}`, '#f7dfa0');
      }
      if (taken) {
        game.audio?.play('pickup', pick.x, pick.y);
        pickups.splice(i, 1);
      }
    }
  }

  return { bullets, pickups, tracers, shootWeapon, addBullet, spawnPickup, createWorldPickups, updateBullets, updatePickups, melee, hurtCop, hurtEnemy };
}
