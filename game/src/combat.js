// Bullets, tracers, spread, hit resolution and melee. Hitscan is sampled along each
// projectile's step so nothing tunnels through a pedestrian at 130 m/s.

import { WEAPONS } from './config.js';
import { TAU, dist, segmentPoint, segmentHitsRect } from './math.js';
import { Rng } from './random.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.bullets = [];
    this.rng = new Rng(0x2c0f);
    this.meleeClock = 0;
  }

  getWeapon(id) {
    return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[1];
  }

  fire(actor, weaponId, origin, angle, options = {}) {
    const weapon = this.getWeapon(weaponId);
    const game = this.game;
    const pellets = weapon.pellets ?? 1;
    const owner = options.owner ?? (actor === 'player' ? 'player' : 'police');
    const damage = options.damage ?? weapon.damage;
    const spread = options.spread ?? weapon.spread ?? 0;
    for (let i = 0; i < pellets; i += 1) {
      const jitter = (this.rng.float() - 0.5) * 2 * spread;
      const shotAngle = angle + (pellets > 1 ? (this.rng.float() - 0.5) * 2 * spread : jitter);
      const speed = weapon.speed * (0.92 + this.rng.float() * 0.16);
      const bullet = {
        x: origin.x,
        y: origin.y ?? 1.35,
        z: origin.z,
        px: origin.x,
        pz: origin.z,
        vx: Math.cos(shotAngle) * speed,
        vz: Math.sin(shotAngle) * speed,
        life: weapon.range ? Math.min(1.2, weapon.range / speed + 0.14) : 0.9,
        damage,
        owner,
        source: options.source ?? null,
        color: owner === 'player' ? '#ffe4a0' : '#ff9a7a',
        tracer: null,
      };
      this.bullets.push(bullet);
      this.makeTracer(bullet);
    }
    if (options.muzzle !== false) {
      game.effects.muzzle(origin.x, origin.y ?? 1.35, origin.z, angle);
    }
    game.audio?.gun(weapon.id, owner);
    game.chase.kick(weapon.id === 'shotgun' ? 0.5 : weapon.id === 'rifle' ? 0.42 : 0.25);
    if (owner === 'player') {
      game.pedestrians.fleeAt(origin.x, origin.z, 30);
      game.police.reportGunshot(origin.x, origin.z);
    }
    return true;
  }

  makeTracer(bullet) {
    const material = new THREE.MeshBasicMaterial({
      color: bullet.color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.position.set(bullet.x, bullet.y, bullet.z);
    mesh.scale.set(0.055, 0.055, 1.1);
    this.game.scene.add(mesh);
    bullet.tracer = mesh;
  }

  removeBullet(index) {
    const bullet = this.bullets[index];
    if (bullet.tracer) {
      this.game.scene.remove(bullet.tracer);
      bullet.tracer.material.dispose();
    }
    this.bullets.splice(index, 1);
  }

  update(dt) {
    const game = this.game;
    this.meleeClock = Math.max(0, this.meleeClock - dt);
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i];
      bullet.life -= dt;
      if (bullet.life <= 0) {
        this.removeBullet(i);
        continue;
      }
      bullet.px = bullet.x;
      bullet.pz = bullet.z;
      bullet.x += bullet.vx * dt;
      bullet.z += bullet.vz * dt;
      let hit = false;

      // Buildings.
      for (const rect of game.world.colliders) {
        if (segmentHitsRect(bullet.px, bullet.pz, bullet.x, bullet.z, rect)) {
          game.effects.spark(bullet.x, bullet.y, bullet.z, 4);
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const car of game.vehicles.list) {
          if (car.wrecked) continue;
          const info = segmentPoint(bullet.px, bullet.pz, bullet.x, bullet.z, car.x, car.z);
          if (info.dist < car.model.width * 0.7) {
            if (!(bullet.owner === 'player' && game.player.car === car)) {
              game.vehicles.damageCar(car, bullet.damage * 0.85);
              game.effects.spark(bullet.x, bullet.y, bullet.z, 5);
              if (car === game.player.car) game.chase.kick(0.35);
              hit = true;
            }
          }
          if (hit) break;
        }
      }
      if (!hit && bullet.owner !== 'police') {
        for (const ped of game.pedestrians.peds) {
          if (!ped.alive) continue;
          const info = segmentPoint(bullet.px, bullet.pz, bullet.x, bullet.z, ped.x, ped.z);
          if (info.dist < 0.48) {
            ped.health -= bullet.damage;
            game.effects.blood(ped.x, 1.1, ped.z);
            if (ped.health <= 0) {
              game.pedestrians.kill(ped);
              game.police.reportCrime(ped.boss ? 2.0 : 1.25, 'HOMICIDE');
            } else {
              ped.state = 'flee';
              ped.threat = { x: bullet.px, z: bullet.pz };
              ped.timer = 4;
            }
            hit = true;
            break;
          }
        }
      }
      if (!hit && bullet.owner !== 'police') {
        for (const officer of game.police.officers) {
          if (!officer.alive) continue;
          const info = segmentPoint(bullet.px, bullet.pz, bullet.x, bullet.z, officer.x, officer.z);
          if (info.dist < 0.5) {
            game.police.damageOfficer(officer, bullet.damage);
            game.effects.blood(officer.x, 1.1, officer.z);
            hit = true;
            break;
          }
        }
      }
      if (!hit && bullet.owner === 'police') {
        const player = game.player;
        const info = segmentPoint(bullet.px, bullet.pz, bullet.x, bullet.z, player.x, player.z);
        if (info.dist < 0.52) {
          player.hurt(bullet.damage, 'gunfire');
          game.effects.blood(player.x, 1.2, player.z);
          game.chase.kick(0.55);
          hit = true;
        } else if (player.car) {
          const car = player.car;
          if (segmentPoint(bullet.px, bullet.pz, bullet.x, bullet.z, car.x, car.z).dist < 1.6) {
            game.vehicles.damageCar(car, bullet.damage * 0.7);
            game.effects.spark(bullet.x, bullet.y, bullet.z, 4);
            hit = true;
          }
        }
      }
      if (hit) {
        this.removeBullet(i);
        continue;
      }
      if (bullet.tracer) {
        const mx = (bullet.px + bullet.x) / 2;
        const mz = (bullet.pz + bullet.z) / 2;
        const dx = bullet.x - bullet.px;
        const dz = bullet.z - bullet.pz;
        const len = Math.hypot(dx, dz);
        bullet.tracer.position.set(mx, bullet.y, mz);
        bullet.tracer.scale.set(0.055, 0.055, Math.max(0.4, len + 0.7));
        bullet.tracer.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  melee(attackerX, attackerZ, angle, range = 2.2, damage = 14) {
    if (this.meleeClock > 0) return null;
    this.meleeClock = 0.28;
    const game = this.game;
    let target = null;
    let best = range;
    for (const ped of game.pedestrians.peds) {
      if (!ped.alive) continue;
      const d = dist(attackerX, attackerZ, ped.x, ped.z);
      const dot = ((ped.x - attackerX) * Math.cos(angle) + (ped.z - attackerZ) * Math.sin(angle)) / (d || 1);
      if (d < best && dot > 0.15) {
        best = d;
        target = { kind: 'ped', ped };
      }
    }
    for (const officer of game.police.officers) {
      if (!officer.alive) continue;
      const d = dist(attackerX, attackerZ, officer.x, officer.z);
      const dot = ((officer.x - attackerX) * Math.cos(angle) + (officer.z - attackerZ) * Math.sin(angle)) / (d || 1);
      if (d < best && dot > 0.15) {
        best = d;
        target = { kind: 'officer', officer };
      }
    }
    if (target?.kind === 'ped') {
      target.ped.health -= damage + 10;
      game.effects.blood(target.ped.x, 1.1, target.ped.z);
      if (target.ped.health <= 0) {
        game.pedestrians.kill(target.ped);
        game.police.reportCrime(0.9, 'ASSAULT');
      }
    }
    if (target?.kind === 'officer') {
      game.police.damageOfficer(target.officer, damage + 12);
      game.effects.blood(target.officer.x, 1.1, target.officer.z);
      game.effects.spark(target.officer.x, 1.3, target.officer.z, 3);
    }
    game.audio?.punch(target ? 'hit' : 'whiff');
    return target;
  }

  clear() {
    for (const bullet of this.bullets) {
      if (bullet.tracer) {
        this.game.scene.remove(bullet.tracer);
        bullet.tracer.material.dispose();
      }
    }
    this.bullets.length = 0;
  }
}

export function muzzleOrigin(entity, angle, forward = 0.7) {
  return {
    x: entity.x + Math.cos(angle) * forward,
    y: 1.35,
    z: entity.z + Math.sin(angle) * forward,
  };
}

export const COMBAT_TAU = TAU;
