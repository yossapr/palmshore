// The crowd: civilians walking the block perimeters, fleeing gunfire, dropping their wallets
// when robbed and going down when a car finds them. Their bodies come from people.js.

import { CITY, PALETTE } from './config.js';
import { makePerson } from './people.js';
import { clamp, dist, lerp, wrapAngle } from './math.js';
import { streamOf } from './random.js';

const SIDEWALK = 12;

function pointOnBlock(block, side, t) {
  const inset = SIDEWALK + 4;
  const x0 = block.x + inset;
  const y0 = block.y + inset;
  const x1 = block.x + block.w - inset;
  const y1 = block.y + block.h - inset;
  if (side === 0) return { x: lerp(x0, x1, t), y: y0, tx: 1, ty: 0 };
  if (side === 1) return { x: x1, y: lerp(y0, y1, t), tx: 0, ty: 1 };
  if (side === 2) return { x: lerp(x1, x0, t), y: y1, tx: -1, ty: 0 };
  return { x: x0, y: lerp(y1, y0, t), tx: 0, ty: -1 };
}

export function createPed(seed, block, side, t, clockwise) {
  const rng = streamOf(seed, 71);
  const p = pointOnBlock(block, side, t);
  const person = makePerson(rng, {
    x: p.x,
    y: p.y,
    angle: Math.atan2(p.ty, p.tx),
    speed: rng.range(30, 54),
    shirt: rng.pick(PALETTE.shirts),
    pants: rng.pick(PALETTE.pants),
    skin: rng.pick(PALETTE.skin),
    hair: rng.pick(PALETTE.hair),
    hat: rng.chance(0.1) ? 'sunhat' : null,
    kind: 'ped',
    bag: rng.chance(0.22),
  });
  person.block = block;
  person.side = side;
  person.t = t;
  person.dir = clockwise ? 1 : -1;
  person.panic = 0;
  person.homeSeed = seed;
  person.offset = rng.range(-4, 4);
  return person;
}

export function createPedestrians(world, seed) {
  const rng = streamOf(seed, 44);
  const people = [];
  const candidates = world.blocks.filter((b) => b.district !== 'docks');
  for (let i = 0; i < 92; i += 1) {
    const block = rng.pick(candidates);
    people.push(createPed(seed + i * 13, block, rng.int(0, 3), rng.range(0.02, 0.98), rng.chance(0.5)));
  }
  for (let i = 0; i < 8; i += 1) {
    const x = world.roads.node(CITY.cols, rng.int(0, CITY.rows - 1));
    const p = makePerson(rng, {
      x: x.x + rng.range(-60, 40),
      y: x.y + rng.range(40, 220),
      angle: rng.range(0, 6.28),
      shirt: rng.pick(PALETTE.shirts),
      hat: 'sunhat',
      bag: true,
    });
    p.beach = true;
    p.vx = 0;
    p.vy = 0;
    people.push(p);
  }

  function panicAt(x, y, radius = 320, source = null) {
    for (const person of people) {
      if (person.dead || person.kind !== 'ped') continue;
      if (dist(x, y, person.x, person.y) < radius) {
        person.panic = Math.max(person.panic, 4.5 + Math.random() * 3);
        person.fleeFrom = source ?? { x, y };
      }
    }
  }

  function hurt(person, amount, game, byPlayer = false) {
    if (person.dead) return;
    person.health -= amount;
    person.hurtFlash = 1;
    game.effects?.blood(person.x, person.y, 3);
    if (person.health <= 0) {
      person.dead = true;
      person.deadTimer = 0;
      game.effects?.blood(person.x, person.y, 8);
      game.audio?.play('bodyfall', person.x, person.y);
      if (byPlayer) {
        game.police?.addHeat(0.55);
        game.stats.kills = (game.stats.kills ?? 0) + 1;
      }
      if (Math.random() < 0.3) game.combat?.spawnPickup(game, person.x, person.y, 'cash', 40 + Math.floor(Math.random() * 90));
      panicAt(person.x, person.y, 340);
    } else {
      panicAt(person.x, person.y, 220);
    }
  }

  function nearestRobTarget(player) {
    let best = null;
    let bestD = player.robRange ?? 86;
    for (const person of people) {
      if (person.dead || person.kind !== 'ped' || person.robbed) continue;
      const d = dist(player.x, player.y, person.x, person.y);
      if (d > bestD) continue;
      const a = Math.atan2(person.y - player.y, person.x - player.x);
      if (Math.abs(wrapAngle(a - player.aim)) > 0.95) continue;
      best = person;
      bestD = d;
    }
    return best;
  }

  function update(game, dt) {
    const player = game.player;
    for (const person of people) {
      if (person.dead) {
        person.deadTimer += dt;
        person.hurtFlash = Math.max(0, person.hurtFlash - dt * 3);
        if (person.kind === 'ped' && person.deadTimer > 26) {
          person.dead = false;
          person.health = person.maxHealth;
          person.x = person.block ? person.block.x + 30 : person.x;
          person.y = person.block ? person.block.y + 30 : person.y;
          person.panic = 1;
        }
        continue;
      }
      person.hurtFlash = Math.max(0, person.hurtFlash - dt * 4);
      if (person.panic > 0) {
        person.panic -= dt;
        const from = person.fleeFrom ?? player;
        const away = Math.atan2(person.y - from.y, person.x - from.x);
        const speed = 150 + (person.panic > 2 ? 30 : 0);
        const nx = person.x + Math.cos(away) * speed * dt;
        const ny = person.y + Math.sin(away) * speed * dt;
        const res = game.world.collideCircle(nx, ny, 8);
        if (!res.hit) {
          person.x = nx;
          person.y = ny;
        } else {
          // Skitter along the wall instead of into it.
          const tangent = away + (person.homeSeed % 2 ? 1.2 : -1.2);
          const sx = person.x + Math.cos(tangent) * speed * dt;
          const sy = person.y + Math.sin(tangent) * speed * dt;
          const side = game.world.collideCircle(sx, sy, 8);
          if (!side.hit) {
            person.x = sx;
            person.y = sy;
            person.angle = tangent;
          }
        }
        person.angle = Math.atan2(Math.sin(away), Math.cos(away));
        person.walk = speed;
        person.phase += dt * 16;
        continue;
      }
      if (person.beach) {
        person.x += Math.cos(person.angle) * 18 * dt;
        person.y += Math.sin(person.angle) * 18 * dt;
        if (person.x > game.world.width - 450 || person.x < game.world.width - 900 || person.y > game.world.height - 420) {
          person.angle += Math.PI * 0.7;
        }
        person.phase += dt * 4;
        person.walk = 18;
        continue;
      }
      if (!person.block) continue;
      const len = person.block.w;
      person.t += (person.dir * person.speed * dt) / len;
      if (person.t > 1) {
        person.t = 0;
        person.side = (person.side + 1) % 4;
        const p = pointOnBlock(person.block, person.side, 0);
        person.x = p.x;
        person.y = p.y;
        person.angle = Math.atan2(p.ty, p.tx);
      } else if (person.t < 0) {
        person.t = 1;
        person.side = (person.side + 3) % 4;
        const p = pointOnBlock(person.block, person.side, 1);
        person.x = p.x;
        person.y = p.y;
        person.angle = Math.atan2(-p.ty, -p.tx);
      }
      const p = pointOnBlock(person.block, person.side, person.t);
      person.x = p.x;
      person.y = p.y;
      person.angle = Math.atan2(p.ty * person.dir, p.tx * person.dir);
      person.walk = person.speed;
      person.phase += dt * 7;
    }

    // Cars vs people: anyone hit by a moving car goes down.
    for (const car of game.vehicles) {
      if (car.removed || car.exploded) continue;
      const speed = Math.hypot(car.vx, car.vy);
      if (speed < 46) continue;
      for (const person of people) {
        if (person.dead) continue;
        if (Math.abs(person.x - car.x) > 60 || Math.abs(person.y - car.y) > 60) continue;
        if (dist(person.x, person.y, car.x, car.y) < car.length * 0.45 + 8) {
          hurt(person, speed > 160 ? 200 : 45, game, car.driver === 'player');
          person.panic = 0;
          const away = Math.atan2(person.y - car.y, person.x - car.x);
          person.x += Math.cos(away) * 16;
          person.y += Math.sin(away) * 16;
          car.vx *= 0.82;
          car.vy *= 0.82;
          game.effects?.blood(person.x, person.y, 5);
        }
      }
    }
  }

  return { people, update, panicAt, hurt, nearestRobTarget };
}
