// Pedestrians: sidewalk walkers, idlers and jaywalkers who scatter at gunfire and
// can be relieved of their cash at close range.

import { PED_COLORS, WORLD } from './config.js';
import { TAU, clamp, dist } from './math.js';
import { Rng } from './random.js';
import { makePerson, animatePerson } from './people.js';

function pickSpec(rng) {
  const skin = rng.pick(PED_COLORS.slice(0, 8));
  return {
    id: 'ped',
    skin,
    skinShadow: '#7a5136',
    hair: rng.pick(['#221d1b', '#4a3424', '#7a5a3a', '#c9b48a', '#1b1b1b', '#a86a3c']),
    shirt: rng.pick(['#e8e2d0', '#d96f5f', '#5b8fa8', '#e8b54a', '#7fa88a', '#b47f9a', '#f2d9b5']),
    jacket: rng.pick(['#3f5a62', '#6b4a3a', '#d9cfba', '#2f4858', '#8e5d4a', '#b9c7bd']),
    pants: rng.pick(['#3d4148', '#5b6b74', '#d8cdb4', '#2f3a44', '#7a6a55']),
    accent: '#ffc857',
    style: 'ped',
    blink: rng.range(0, 4),
  };
}

export class Pedestrians {
  constructor(game, count = 34) {
    this.game = game;
    this.world = game.world;
    this.roads = game.roads;
    this.rng = new Rng(WORLD.seed ^ 0x9e37);
    this.peds = [];
    this.count = count;
    for (let i = 0; i < count; i += 1) this.spawnNear(game.player, 8 + i * 3);
  }

  spawnAt(x, z, options = {}) {
    const spec = options.spec ?? pickSpec(this.rng);
    const person = makePerson(spec);
    const ped = {
      id: this.peds.length + 1,
      x, z,
      heading: options.heading ?? -Math.PI / 2,
      speed: 0,
      baseSpeed: options.speed ?? this.rng.range(1.05, 1.55),
      state: options.state ?? 'walk',
      timer: this.rng.range(0.5, 3),
      target: null,
      person,
      mesh: person.group,
      alive: true,
      robbed: false,
      tag: options.tag ?? null,
      threat: null,
      deathTimer: 0,
      walkTime: this.rng.range(0, 10),
      scale: options.scale ?? 1,
      locked: options.locked ?? false,
      health: options.health ?? 45,
      maxHealth: options.health ?? 45,
    };
    ped.mesh.position.set(x, this.world.heightAt(x, z), z);
    this.game.scene.add(ped.mesh);
    this.peds.push(ped);
    this.pickTarget(ped);
    return ped;
  }

  pointOnSidewalk(nearX, nearZ) {
    for (let tries = 0; tries < 16; tries += 1) {
      const col = clamp(Math.floor(nearX / WORLD.pitch) + this.rng.int(-2, 2), 0, WORLD.cols - 1);
      const row = clamp(Math.floor(nearZ / WORLD.pitch) + this.rng.int(-2, 2), 0, WORLD.rows - 1);
      const rect = this.roads.blockRect(col, row);
      const side = this.rng.int(0, 3);
      const inset = 1.5;
      let x = rect.x + inset;
      let z = rect.z + inset;
      if (side === 0) { x = this.rng.range(rect.x + 1.2, rect.x + rect.w - 1.2); z = rect.z + 1.4; }
      if (side === 1) { x = this.rng.range(rect.x + 1.2, rect.x + rect.w - 1.2); z = rect.z + rect.d - 1.4; }
      if (side === 2) { x = rect.x + 1.4; z = this.rng.range(rect.z + 1.2, rect.z + rect.d - 1.2); }
      if (side === 3) { x = rect.x + rect.w - 1.4; z = this.rng.range(rect.z + 1.2, rect.z + rect.d - 1.2); }
      if (this.world.collides(x, z, 0.45)) continue;
      if (dist(x, z, nearX, nearZ) > 55) continue;
      return { x, z };
    }
    return { x: nearX + this.rng.range(-4, 4), z: nearZ + this.rng.range(-4, 4) };
  }

  pickTarget(ped) {
    // One in five walks across the road: a jaywalk between blocks.
    if (this.rng.chance(0.22)) {
      const near = this.roads.nearestRoad(ped.x, ped.z);
      if (near) {
        const cross = near.axis === 'h'
          ? { x: ped.x + this.rng.range(-2, 2), z: ped.z + (ped.z < near.z ? 1 : -1) * (15 + this.rng.range(0, 8)) }
          : { x: ped.x + (ped.x < near.x ? 1 : -1) * (15 + this.rng.range(0, 8)), z: ped.z + this.rng.range(-2, 2) };
        ped.target = cross;
        ped.state = 'cross';
        ped.timer = 8;
        return;
      }
    }
    const point = this.pointOnSidewalk(ped.x + this.rng.range(-30, 30), ped.z + this.rng.range(-30, 30));
    ped.target = point;
    ped.state = 'walk';
    ped.timer = 12;
  }

  spawnNear(player, offset = 0) {
    const angle = this.rng.range(0, TAU);
    const radius = 7 + (offset % 26);
    const x = player.x + Math.cos(angle) * radius;
    const z = player.z + Math.sin(angle) * radius;
    const near = this.pointOnSidewalk(x, z);
    if (this.world.collides(near.x, near.z, 0.4)) return null;
    return this.spawnAt(near.x, near.z);
  }

  fleeAt(x, z, radius = 24) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      if (dist(ped.x, ped.z, x, z) < radius) {
        ped.state = 'flee';
        ped.threat = { x, z };
        ped.timer = 3.6;
        const away = Math.atan2(ped.z - z, ped.x - x);
        ped.target = { x: ped.x + Math.cos(away) * 12, z: ped.z + Math.sin(away) * 12 };
      }
    }
  }

  scareFromCar(car) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      if (Math.abs(car.speed) > 6 && dist(ped.x, ped.z, car.x, car.z) < 4.2) {
        ped.state = 'flee';
        ped.threat = { x: car.x, z: car.z };
        ped.timer = 2.4;
      }
    }
  }

  nearest(x, z, maxDist = 2.6) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      const d = dist(ped.x, ped.z, x, z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  rob(ped) {
    if (!ped || !ped.alive || ped.robbed) return 0;
    ped.robbed = true;
    ped.state = 'flee';
    ped.threat = { x: this.game.player.x, z: this.game.player.z };
    ped.timer = 4;
    const amount = 18 + Math.floor(this.rng.float() * 68);
    return amount;
  }

  kill(ped) {
    if (!ped.alive) return;
    ped.alive = false;
    ped.state = 'dead';
    ped.deathTimer = 18;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.28;
    this.game.effects.blood(ped.x, 1.0, ped.z);
  }

  update(dt) {
    for (const ped of this.peds.slice()) {
      if (!ped.alive) {
        ped.deathTimer -= dt;
        if (ped.deathTimer <= 0) {
          this.game.scene.remove(ped.mesh);
          this.peds.splice(this.peds.indexOf(ped), 1);
        }
        continue;
      }
      let speed = 0;
      if (ped.state === 'walk' || ped.state === 'cross') {
        speed = ped.baseSpeed * (ped.state === 'cross' ? 1.25 : 1);
      } else if (ped.state === 'flee') {
        speed = 3.4;
      }
      ped.timer -= dt;
      if (ped.state === 'idle' && ped.timer <= 0) this.pickTarget(ped);
      if ((ped.state === 'walk' || ped.state === 'cross') && ped.timer <= 0) {
        ped.state = this.rng.chance(0.45) ? 'idle' : 'walk';
        ped.timer = this.rng.range(1.4, 4.5);
        if (ped.state === 'walk') this.pickTarget(ped);
      }
      if (ped.state === 'flee' && ped.timer <= 0) {
        ped.state = 'walk';
        this.pickTarget(ped);
      }
      if (ped.state === 'flee' && ped.threat) {
        const away = Math.atan2(ped.z - ped.threat.z, ped.x - ped.threat.x);
        ped.target = { x: ped.x + Math.cos(away) * 6, z: ped.z + Math.sin(away) * 6 };
      }
      if (ped.locked && ped.state !== 'flee') {
        ped.state = 'idle';
        ped.timer = 9;
        ped.speed = 0;
        speed = 0;
      } else if (ped.state === 'walk' || ped.state === 'cross' || ped.state === 'flee') {
        const target = ped.target;
        if (target) {
          const dx = target.x - ped.x;
          const dz = target.z - ped.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.6) {
            ped.state = 'idle';
            ped.timer = this.rng.range(0.8, 3.6);
            speed = 0;
          } else {
            const step = speed * dt;
            ped.x += (dx / d) * step;
            ped.z += (dz / d) * step;
            ped.heading = Math.atan2(dz, dx);
            ped.walkTime += dt;
            ped.speed = speed;
          }
        }
      } else {
        ped.speed = 0;
      }
      const beforeX = ped.x;
      const beforeZ = ped.z;
      this.world.resolveCircle(ped, 0.34);
      if (Math.hypot(ped.x - beforeX, ped.z - beforeZ) > 0.02 && ped.state !== 'flee') {
        this.pickTarget(ped);
      }
      ped.x = clamp(ped.x, 1.5, this.world.roads.beachX + 42);
      ped.z = clamp(ped.z, 1.5, WORLD.rows * WORLD.pitch + 40);
      const ground = this.world.heightAt(ped.x, ped.z);
      ped.mesh.position.set(ped.x, ground, ped.z);
      ped.mesh.rotation.y = Math.atan2(Math.cos(ped.heading), Math.sin(ped.heading));
      animatePerson(ped.person, ped.walkTime, ped.speed > 0.1, ped.speed);
      if (ped.state === 'flee') {
        ped.person.arms[0].rotation.x = -1.0;
        ped.person.arms[1].rotation.x = -1.0;
      }
    }
  }

  clear() {
    for (const ped of this.peds) this.game.scene.remove(ped.mesh);
    this.peds.length = 0;
  }
}
