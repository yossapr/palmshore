// The Palmshore P.D.: a wanted level that climbs with each crime, cruisers that chase and shoot,
// foot officers at two stars, a roadblock at three, a helicopter at four, and the slow cooling
// that lets Ray lose them. The stars, the minimap blips and the sirens all come from here.

import { WANTED, PALETTE } from './config.js';
import { makePerson } from './people.js';
import { createVehicle, stepVehicle, damageVehicle } from './vehicles.js';
import { clamp, dist, wrapAngle, angleTo } from './math.js';
import { streamOf } from './random.js';

const STAR_HEAT = 18;

export function createPolice(world, seed) {
  const rng = streamOf(seed, 97);
  const state = {
    heat: 0,
    level: 0,
    escapeTime: 0,
    seen: false,
    spawnTimer: 0,
    footTimer: 0,
    roadblockTimer: 0,
    bustTimer: 0,
    cars: [],
    cops: [],
    heli: null,
    roadblocks: [],
    lastStar: 0,
  };

  function starsForHeat(heat) {
    if (heat <= 0.4) return 0;
    return clamp(Math.ceil(heat / STAR_HEAT), 1, WANTED.max);
  }

  function setLevel(level, game) {
    const target = clamp(level, 0, WANTED.max);
    if (target === 0) {
      clear(game);
      return;
    }
    state.heat = clamp(target * STAR_HEAT, 0, WANTED.max * STAR_HEAT);
    state.level = target;
    if (state.level < state.lastStar) {
      game?.hud?.notify(`WANTED LEVEL ${state.level}`, 'teal');
    }
    state.lastStar = state.level;
  }

  function addHeat(amount, game) {
    state.heat = clamp(state.heat + amount, 0, WANTED.max * STAR_HEAT);
    state.escapeTime = 0;
    const level = starsForHeat(state.heat);
    if (level !== state.level || state.level === 0) {
      state.level = level;
      state.lastStar = level;
      game?.hud?.notify(level >= 4 ? 'PALMSHORE P.D. IS ON YOU' : level >= 2 ? 'POLICE RESPONDING' : 'WANTED', level >= 3 ? 'coral' : 'ink');
    }
  }

  function clear(game) {
    state.heat = 0;
    state.level = 0;
    state.lastStar = 0;
    state.escapeTime = 0;
    state.bustTimer = 0;
    for (const cop of state.cops) cop.removed = true;
    for (const car of state.cars) car.removed = true;
    state.cars = [];
    state.cops = [];
    state.heli = null;
    state.roadblocks = [];
  }

  function spawnCar(game, x, y, angle) {
    const car = createVehicle({ x, y, angle, type: 'police', police: true, driver: 'cop', siren: true });
    car.color = PALETTE.cream;
    game.vehicles.push(car);
    state.cars.push(car);
    return car;
  }

  function spawnFoot(game, x, y, angle = 0) {
    const cop = makePerson(rng, {
      x,
      y,
      angle,
      kind: 'cop',
      armed: true,
      gun: 'pistol',
      health: 105,
      shirt: '#25384f',
      pants: '#1d2530',
      skin: rng.pick(PALETTE.skin),
      hair: rng.pick(PALETTE.hair),
    });
    cop.shootCooldown = rng.range(0.4, 1.2);
    cop.blocked = 0;
    state.cops.push(cop);
    return cop;
  }

  function spawnNearPlayer(game, kind) {
    const p = game.player;
    const angle = rng.range(0, 6.28);
    const d = kind === 'foot' ? 300 : 700;
    let x = p.x + Math.cos(angle) * d;
    let y = p.y + Math.sin(angle) * d;
    x = clamp(x, 90, world.width - 200);
    y = clamp(y, 90, world.height - 200);
    if (world.inWater(x, y)) {
      const node = game.world.roads.node(rng.int(0, 9), rng.int(0, 7));
      x = node.x;
      y = node.y;
    }
    if (kind === 'foot') {
      const cop = spawnFoot(game, x, y, angle + Math.PI);
      cop.spawnedFor = state.level;
      return cop;
    }
    const road = game.world.roads.nearestRoadPoint(x, y);
    const car = spawnCar(game, road.x + rng.range(-20, 20), road.y + rng.range(-20, 20), road.angle);
    car.ai = { mode: 'chase', stuck: 0, reverse: 0, fire: rng.range(0.4, 1.2) };
    return car;
  }

  function addRoadblock(game) {
    const p = game.player;
    const ahead = Math.atan2(p.mode === 'car' ? p.car.vy : p.vy, p.mode === 'car' ? p.car.vx : p.vx) || p.angle;
    const x = clamp(p.x + Math.cos(ahead) * 420, 140, world.width - 240);
    const y = clamp(p.y + Math.sin(ahead) * 420, 140, world.height - 240);
    const road = game.world.roads.nearestRoadPoint(x, y);
    const across = road.angle + Math.PI / 2;
    for (let k = -1; k <= 1; k += 1) {
      const cx = road.x + Math.cos(across) * k * 34;
      const cy = road.y + Math.sin(across) * k * 34;
      if (k === 0) {
        spawnFoot(game, cx + 26, cy + 22, across + Math.PI);
        continue;
      }
      const car = spawnCar(game, cx, cy, road.angle);
      car.ai = { mode: 'block', stuck: 0, reverse: 0, fire: rng.range(0.6, 1.6) };
      car.vx = 0;
      car.vy = 0;
      state.roadblocks.push(car);
    }
    game.hud?.notify('ROADBLOCK AHEAD', 'coral');
    game.effects?.text(road.x, road.y - 40, 'ROADBLOCK', '#f0c6a6');
  }

  function spawnHeli(game) {
    const p = game.player;
    state.heli = {
      x: p.x - 260,
      y: p.y - 160,
      angle: 0.6,
      orbit: rng.range(0, 6.28),
      fire: 1.2,
      spotlight: 1,
      rotor: 0,
    };
    game.hud?.notify('POLICE HELICOPTER INBOUND', 'coral');
  }

  function driveCop(car, game, dt) {
    if (!car.ai) car.ai = { mode: 'chase', stuck: 0, reverse: 0, fire: 1 };
    const p = game.player;
    const tx = p.mode === 'car' && p.car ? p.car.x : p.x;
    const ty = p.mode === 'car' && p.car ? p.car.y : p.y;
    const d = dist(car.x, car.y, tx, ty);
    let controls = { throttle: 0, steer: 0, handbrake: false };
    if (car.ai.mode === 'block') {
      controls = { throttle: 0, steer: 0, handbrake: true };
    } else if (car.ai.mode === 'chase') {
      const want = Math.atan2(ty - car.y, tx - car.x);
      const diff = wrapAngle(want - car.angle);
      controls.steer = clamp(diff * 2.1, -1, 1);
      controls.throttle = d > 210 ? 1 : d > 110 ? 0.45 : -0.5;
      if (d < 75) controls.throttle = -0.7;
      if (car.ai.reverse > 0) {
        car.ai.reverse -= dt;
        controls.throttle = -1;
        controls.steer = -controls.steer;
      } else if (Math.hypot(car.vx, car.vy) < 18 && d > 100) {
        car.ai.stuck += dt;
        if (car.ai.stuck > 0.9) {
          car.ai.reverse = 0.8;
          car.ai.stuck = 0;
        }
      } else {
        car.ai.stuck = 0;
      }
      if (d > 60 && d < 340 && Math.abs(wrapAngle(Math.atan2(ty - car.y, tx - car.x) - car.angle)) < 0.8) {
        car.ai.fire -= dt;
        if (car.ai.fire <= 0) {
          car.ai.fire = state.level >= 4 ? 0.45 : 0.9;
          game.combat.shootWeapon(game, 'pistol', car.x + Math.cos(car.angle) * 18, car.y + Math.sin(car.angle) * 18, angleTo(car.x, car.y, tx, ty) + (Math.random() - 0.5) * 0.16, 'police');
        }
      }
    }
    stepVehicle(car, dt, controls, game);
    if (d < 120 && Math.hypot(car.vx, car.vy) > 80) {
      car.ai.mode = 'chase';
    }
  }

  function updateCop(cop, game, dt) {
    if (cop.dead) {
      cop.deadTimer += dt;
      return;
    }
    const p = game.player;
    const tx = p.mode === 'car' && p.car ? p.car.x : p.x;
    const ty = p.mode === 'car' && p.car ? p.car.y : p.y;
    const d = dist(cop.x, cop.y, tx, ty);
    cop.shootCooldown -= dt;
    cop.hurtFlash = Math.max(0, cop.hurtFlash - dt * 4);
    if (d > 150 && d < 900) {
      const a = Math.atan2(ty - cop.y, tx - cop.x);
      const nx = cop.x + Math.cos(a) * 76 * dt;
      const ny = cop.y + Math.sin(a) * 76 * dt;
      const res = game.world.collideCircle(nx, ny, 9);
      if (!res.hit) {
        cop.x = nx;
        cop.y = ny;
        cop.phase += dt * 9;
        cop.walk = 76;
        cop.angle = a;
      } else {
        const side = a + 1.1;
        const sx = cop.x + Math.cos(side) * 76 * dt;
        const sy = cop.y + Math.sin(side) * 76 * dt;
        const r2 = game.world.collideCircle(sx, sy, 9);
        if (!r2.hit) {
          cop.x = sx;
          cop.y = sy;
          cop.angle = side;
        }
      }
    } else {
      cop.walk = 0;
      cop.angle = Math.atan2(ty - cop.y, tx - cop.x);
      if (d < 360 && cop.shootCooldown <= 0) {
        cop.shootCooldown = state.level >= 4 ? 0.55 : 1.05;
        game.combat.shootWeapon(game, 'pistol', cop.x + Math.cos(cop.angle) * 14, cop.y + Math.sin(cop.angle) * 14, cop.angle + (Math.random() - 0.5) * 0.18, 'police');
      }
    }
    if (!p.dead && !p.busted && p.mode === 'foot' && d < 34 && Math.hypot(p.vx, p.vy) < 90) {
      state.bustTimer += dt;
      if (state.bustTimer > 1.6) {
        p.bustedBy(game);
        game.hud?.notify('BUSTED', 'coral');
      }
    } else {
      state.bustTimer = Math.max(0, state.bustTimer - dt);
    }
  }

  function update(game, dt) {
    const p = game.player;
    const active = state.level > 0 && !p.dead && !p.busted;
    state.seen = false;
    for (const car of state.cars) {
      if (car.removed || car.exploded) continue;
      if (dist(car.x, car.y, p.x, p.y) < 640) state.seen = true;
    }
    for (const cop of state.cops) {
      if (!cop.dead && dist(cop.x, cop.y, p.x, p.y) < 560) state.seen = true;
    }
    if (state.heli && dist(state.heli.x, state.heli.y, p.x, p.y) < 620) state.seen = true;

    if (active) {
      if (state.seen) {
        state.escapeTime = 0;
      } else {
        state.escapeTime += dt;
        if (state.escapeTime > WANTED.coolAfter) {
          state.heat = Math.max(0, state.heat - WANTED.decayEvery * 4.2 * dt);
        }
      }
      const level = starsForHeat(state.heat);
      if (level !== state.level) {
        state.level = level;
        if (level === 0) {
          game.hud?.notify('YOU LOST THE COPS', 'teal');
          clear(game);
          return;
        }
        state.lastStar = level;
      }
      if (state.level >= 4 && !state.heli) spawnHeli(game);
      if (state.level >= 3 && state.roadblockTimer <= 0) {
        addRoadblock(game);
        state.roadblockTimer = 18;
      }
      state.roadblockTimer -= dt;
      state.spawnTimer -= dt;
      state.footTimer -= dt;
      const liveCars = state.cars.filter((c) => !c.removed && !c.exploded);
      const liveCops = state.cops.filter((c) => !c.dead);
      if (state.spawnTimer <= 0 && liveCars.length < Math.min(WANTED.maxCops, state.level + 1)) {
        state.spawnTimer = state.level >= 4 ? 2.2 : 3.4;
        spawnNearPlayer(game, 'car');
      }
      if (state.footTimer <= 0 && state.level >= 2 && liveCops.length < state.level) {
        state.footTimer = 3.2;
        spawnNearPlayer(game, 'foot');
      }
      if (state.level >= 4 && !state.heli) spawnHeli(game);
    }

    for (const car of state.cars) {
      if (car.removed || car.exploded) continue;
      if (active) driveCop(car, game, dt);
      if (car.removed) continue;
      if (Math.random() < dt * 0.4) car.siren = state.level > 0;
    }
    for (const cop of state.cops) {
      if (active) updateCop(cop, game, dt);
    }

    if (state.heli && active) {
      const heli = state.heli;
      heli.orbit += dt * 0.45;
      const tx = p.x + Math.cos(heli.orbit) * 210;
      const ty = p.y + Math.sin(heli.orbit) * 130 - 40;
      heli.x += (tx - heli.x) * dt * 1.6;
      heli.y += (ty - heli.y) * dt * 1.6;
      heli.rotor += dt * 38;
      heli.fire -= dt;
      if (heli.fire <= 0) {
        heli.fire = state.level >= 5 ? 0.55 : 0.95;
        game.combat.shootWeapon(game, 'pistol', heli.x, heli.y, angleTo(heli.x, heli.y, p.x, p.y) + (Math.random() - 0.5) * 0.2, 'police');
      }
    }

    // Wanted level starts dropping only when nobody has eyes on Ray.
    if (!active) {
      state.heat = Math.max(0, state.heat - WANTED.decayEvery * 2.4 * dt);
      if (state.heat === 0 && state.level !== 0) state.level = 0;
    }

    // Remove cars and bodies once the chase is over.
    if (state.level === 0) {
      for (const car of state.cars) if (!car.removed) car.removed = true;
      for (const cop of state.cops) if (!cop.dead) cop.removed = true;
      state.cars = [];
      state.cops = state.cops.filter((c) => c.dead && c.deadTimer < 8);
      state.heli = null;
    }
  }

  function onCopDown(cop) {
    state.heat = clamp(state.heat + 14, 0, WANTED.max * STAR_HEAT);
    state.escapeTime = 0;
  }

  /** Police fire at a car rather than Ray, used when he is driving. */
  function markSeen() {
    state.escapeTime = 0;
  }

  return {
    state,
    get wanted() {
      return state;
    },
    get cars() {
      return state.cars;
    },
    get cops() {
      return state.cops;
    },
    addHeat: (amount, game) => addHeat(amount, game),
    setWanted: (level, game) => setLevel(level, game),
    clear: (game) => clear(game),
    update,
    onCopDown,
    markSeen,
    spawnFoot: (game, x, y, angle) => spawnFoot(game, x, y, angle),
    spawnCar: (game, x, y, angle) => spawnCar(game, x, y, angle),
    get heli() {
      return state.heli;
    },
    get level() {
      return state.level;
    },
    hurtVehicle: (car, amount, game) => damageVehicle(car, amount, game, 'bullet'),
  };
}
