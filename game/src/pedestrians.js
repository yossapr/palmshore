// The people on the pavements. They walk the blocks on their own loops, sit on the beach, scatter
// when a gun goes off, and pick themselves up and carry on once the panic fades. The population
// is kept topped up around the player and culled far away.

import { createPerson, hurtPerson } from './people.js';
import { resolveCircle } from './world.js';
import { clamp } from './math.js';
import { speedOf } from './vehicles.js';

const PED_TARGET = 34;

function loopPoint(loop, t) {
  const w = loop.x1 - loop.x0;
  const h = loop.y1 - loop.y0;
  const perimeter = (w + h) * 2;
  let d = ((t % perimeter) + perimeter) % perimeter;
  if (d < w) return { x: loop.x0 + d, y: loop.y0, angle: 0 };
  d -= w;
  if (d < h) return { x: loop.x1, y: loop.y0 + d, angle: Math.PI / 2 };
  d -= h;
  if (d < w) return { x: loop.x1 - d, y: loop.y1, angle: Math.PI };
  d -= w;
  return { x: loop.x0, y: loop.y1 - d, angle: -Math.PI / 2 };
}

function nearestBlock(game, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const block of game.world.blocks) {
    const d = Math.hypot(block.cx - x, block.cy - y);
    if (d < bestD) {
      bestD = d;
      best = block;
    }
  }
  return best;
}

function loopParamFor(loop, x, y) {
  const w = loop.x1 - loop.x0;
  const h = loop.y1 - loop.y0;
  const perimeter = (w + h) * 2;
  const distances = [
    { t: clamp(x - loop.x0, 0, w), d: Math.abs(y - loop.y0) },
    { t: w + clamp(y - loop.y0, 0, h), d: Math.abs(x - loop.x1) },
    { t: w + h + clamp(loop.x1 - x, 0, w), d: Math.abs(y - loop.y1) },
    { t: 2 * w + h + clamp(loop.y1 - y, 0, h), d: Math.abs(x - loop.x0) },
  ];
  distances.sort((a, b) => a.d - b.d);
  return ((distances[0].t % perimeter) + perimeter) % perimeter;
}

export function attachToNearestBlock(game, person) {
  const block = nearestBlock(game, person.x, person.y);
  if (!block) return;
  person.route = { kind: 'block', block };
  person.routeT = loopParamFor(block.sidewalk, person.x, person.y);
  person.routeDir = game.rand() < 0.5 ? 1 : -1;
  person.state = 'walk';
  person.panic = 0;
}

export function createCivilianAt(game, x, y, options = {}) {
  const person = createPerson(game, { team: 'civil', x, y, ...options });
  if (options.beach) {
    person.route = { kind: 'beach' };
    person.routeT = y;
    person.routeDir = game.rand() < 0.5 ? 1 : -1;
  } else {
    attachToNearestBlock(game, person);
    const loop = person.route?.block?.sidewalk;
    if (loop) {
      const point = loopPoint(loop, person.routeT);
      person.x = point.x;
      person.y = point.y;
    }
  }
  return person;
}

export function spawnPedestrian(game, nearX = null, nearY = null) {
  const player = game.player;
  const baseX = nearX ?? player.x;
  const baseY = nearY ?? player.y;
  // The beach gets a share of the population: strollers and joggers by the water.
  if (game.rand() < 0.18) {
    const y = clamp(baseY + (game.rand() - 0.5) * 1100, 180, 3160);
    return createCivilianAt(game, 3940 + game.rand() * 70, y, { beach: true });
  }
  let block = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = game.world.blocks[Math.floor(game.rand() * game.world.blocks.length)];
    const distance = Math.hypot(candidate.cx - baseX, candidate.cy - baseY);
    if (distance > 260 && distance < 1250) {
      block = candidate;
      break;
    }
    if (!block) block = candidate;
  }
  if (!block) block = nearestBlock(game, baseX, baseY);
  const point = loopPoint(block.sidewalk, game.rand() * 1200);
  const person = createPerson(game, { team: 'civil', x: point.x, y: point.y });
  person.route = { kind: 'block', block };
  person.routeT = loopParamFor(block.sidewalk, point.x, point.y);
  person.routeDir = game.rand() < 0.5 ? 1 : -1;
  person.state = game.rand() < 0.18 ? 'idle' : 'walk';
  person.timer = 1 + game.rand() * 4;
  return person;
}

export function seedPedestrians(game) {
  const civil = game.people.filter((p) => p.team === 'civil').length;
  for (let i = civil; i < PED_TARGET; i += 1) spawnPedestrian(game);
}

export function updatePedestrians(game, dt) {
  const player = game.player;
  let civilianCount = 0;

  for (let i = game.people.length - 1; i >= 0; i -= 1) {
    const person = game.people[i];
    if (person.team !== 'civil') continue;
    civilianCount += 1;
    if (person.dead) continue;

    const far = Math.hypot(person.x - player.x, person.y - player.y);
    if (far > 1750 && !person.missionTag) {
      game.people.splice(i, 1);
      civilianCount -= 1;
      continue;
    }

    person.hitFlash = Math.max(0, person.hitFlash - dt);
    if (person.panic > 0) {
      person.panic -= dt;
      person.state = 'flee';
      const from = person.fleeFrom ?? { x: player.x, y: player.y };
      let away = Math.atan2(person.y - from.y, person.x - from.x);
      away += (game.rand() - 0.5) * 0.35;
      const speed = 128 + (person.id % 5) * 6;
      person.vx = Math.cos(away) * speed;
      person.vy = Math.sin(away) * speed;
      if (person.panic <= 0) attachToNearestBlock(game, person);
    } else if (person.state === 'idle') {
      person.timer -= dt;
      person.vx = 0;
      person.vy = 0;
      if (person.timer <= 0) {
        person.state = 'walk';
        person.timer = 3 + game.rand() * 6;
      }
    } else if (person.route?.kind === 'beach') {
      person.routeT += person.routeDir * person.speed * dt;
      if (person.routeT < 150 || person.routeT > 3180) person.routeDir *= -1;
      person.x = 3936 + (person.id % 7) * 11;
      person.y = clamp(person.routeT, 150, 3180);
      person.angle = person.routeDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      person.vx = 0;
      person.vy = person.routeDir * person.speed;
    } else if (person.route?.kind === 'block') {
      const loop = person.route.block.sidewalk;
      person.routeT += person.routeDir * person.speed * dt;
      const point = loopPoint(loop, person.routeT);
      person.vx = (point.x - person.x) / Math.max(dt, 0.001) * 0.6;
      person.vy = (point.y - person.y) / Math.max(dt, 0.001) * 0.6;
      person.x = point.x;
      person.y = point.y;
      person.angle = point.angle + (person.routeDir > 0 ? 0 : Math.PI);
      if (person.timer > 0) {
        person.timer -= dt;
        if (person.timer <= 0) {
          person.state = 'walk';
          person.timer = 6 + game.rand() * 8;
        }
      }
    } else {
      attachToNearestBlock(game, person);
    }

    if (person.state !== 'block') {
      person.x += person.vx * dt;
      person.y += person.vy * dt;
      const resolved = resolveCircle(game.world, person.x, person.y, person.radius);
      person.x = resolved.x;
      person.y = resolved.y;
      if (person.state === 'flee') {
        person.angle = Math.atan2(person.vy, person.vx);
        person.walkPhase += dt * 16;
      }
    }
    if (person.state === 'walk') person.walkPhase += dt * 7;

    // Being clipped by a car hurts, and killing someone with a car is still murder.
    for (const car of game.vehicles) {
      if (car.exploded) continue;
      const speed = speedOf(car);
      if (speed < 80) continue;
      const d = Math.hypot(car.x - person.x, car.y - person.y);
      if (d < car.width * 0.8 + person.radius) {
        hurtPerson(game, person, Math.min(100, speed * 0.34), car === player.inCar ? 'player' : 'traffic', person.x, person.y);
        const a = Math.atan2(person.y - car.y, person.x - car.x);
        person.vx = Math.cos(a) * 200;
        person.vy = Math.sin(a) * 200;
        person.panic = 5;
        person.fleeFrom = { x: car.x, y: car.y };
        break;
      }
    }
  }

  if (civilianCount < PED_TARGET - 4) {
    spawnPedestrian(game);
    if (civilianCount < PED_TARGET - 14) spawnPedestrian(game);
  }
}
