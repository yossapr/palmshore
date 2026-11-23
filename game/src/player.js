// The player: Ray Calderón on foot or at the wheel of whatever he just took. This file owns
// walking and running, getting in and out, aiming, shooting, robbing, taking damage, dying,
// being busted and coming back. It never draws.

import { PLAYER, WEAPONS, WEAPON_ORDER, PALETTE } from './config.js';
import { clamp, damp, dist, wrapAngle } from './math.js';
import { stepVehicle, nearestEnterable, exitSpot } from './vehicles.js';

export function createPlayer(x, y) {
  const player = {
    x,
    y,
    angle: -0.4,
    aim: -0.4,
    vx: 0,
    vy: 0,
    mode: 'foot',
    car: null,
    health: PLAYER.health,
    maxHealth: PLAYER.health,
    armour: 0,
    maxArmour: 100,
    money: 320,
    weapon: 'fists',
    weapons: {
      fists: { ammo: Infinity },
      pistol: { ammo: 9 },
      shotgun: { ammo: 0 },
      smg: { ammo: 0 },
    },
    unlocked: { fists: true, pistol: true, shotgun: false, smg: false },
    walk: 0,
    phase: 0,
    fireTimer: 0,
    hurtTimer: 0,
    hurtFlash: 0,
    dead: false,
    busted: false,
    deadTimer: 0,
    aimBlend: 0,
    recoil: 0,
    inCarTime: 0,
    escapeTime: 0,
    lastSafe: { x, y },
    name: 'RAY',

    hurt(amount, cause = 'bullet') {
      if (player.dead) return;
      if (player.hurtTimer > 0.06) return;
      player.hurtTimer = PLAYER.hurtCooldown;
      let left = amount;
      if (player.armour > 0) {
        const absorbed = Math.min(player.armour, left * 0.62);
        player.armour -= absorbed;
        left -= absorbed;
      }
      player.health -= left;
      player.hurtFlash = 1;
      gameRef?.effects?.blood(player.x, player.y, 4);
      gameRef?.audio?.play(cause === 'explosion' ? 'explosion' : 'hurt', player.x, player.y);
      gameRef?.camera?.shake(5, 0.25);
      if (player.health <= 0) player.die(gameRef);
    },

    die(game) {
      if (player.dead) return;
      player.dead = true;
      player.deadTimer = 0;
      player.health = 0;
      if (player.car) {
        player.car.driver = null;
        player.car = null;
      }
      player.mode = 'foot';
      gameRef?.effects?.blood(player.x, player.y, 12);
      gameRef?.audio?.play('wasted', player.x, player.y);
      gameRef?.camera?.shake(10, 0.6);
    },

    drown() {
      if (player.dead) return;
      if (player.mode === 'car') {
        const car = player.car;
        if (car) {
          car.driver = null;
          car.vx *= 0.2;
          car.vy *= 0.2;
        }
        player.car = null;
        player.mode = 'foot';
      }
      gameRef?.effects?.splash(player.x, player.y);
      player.health = 0;
      player.die(gameRef);
      return;
    },

    bustedBy(game) {
      if (player.dead || player.busted) return;
      player.busted = true;
      player.deadTimer = 0;
      if (player.car) {
        player.car.driver = null;
        player.car = null;
      }
      player.mode = 'foot';
      game.audio?.play('busted', player.x, player.y);
    },

    enterCar(game, car) {
      if (!car || car.removed || car.exploded) return;
      if (player.car) player.car.driver = null;
      player.car = car;
      car.driver = 'player';
      car.parked = false;
      car.ai = null;
      player.mode = 'car';
      player.inCarTime = 0;
      player.x = car.x;
      player.y = car.y;
      game.audio?.play('door', car.x, car.y);
      game.effects?.text(car.x, car.y - 30, VEHICLE_LABEL(car), '#f3e8c8');
      game.police?.addHeat(0.06);
    },

    exitCar(game) {
      if (!player.car) return;
      const car = player.car;
      car.driver = null;
      car.vx *= 0.55;
      car.vy *= 0.55;
      const spot = exitSpot(car);
      const res = game.world.collideCircle(spot.x, spot.y, PLAYER.radius);
      player.x = res.hit ? car.x : spot.x;
      player.y = res.hit ? car.y : spot.y;
      player.mode = 'foot';
      player.car = null;
      player.angle = car.angle;
      player.aim = car.angle;
      game.audio?.play('door', car.x, car.y);
      player.inCarTime = 0;
    },

    switchWeapon(game, name) {
      if (!player.unlocked[name]) return;
      if (name !== 'fists' && player.weapons[name].ammo <= 0) {
        game.effects?.text(player.x, player.y - 30, 'NO AMMO', '#e7b9a3');
        return;
      }
      player.weapon = name;
      game.audio?.play('click', player.x, player.y);
    },
  };

  let gameRef = null;

  function labelFor(car) {
    if (car.police) return 'POLICE CRUISER';
    if (car.taxi) return 'TAXI';
    return car.type === 'sports' ? 'SPORTS COUPE' : car.type === 'van' ? 'VAN' : car.type === 'truck' ? 'TRUCK' : car.type === 'pickup' ? 'PICKUP' : 'SEDAN';
  }
  const VEHICLE_LABEL = labelFor;

  player.attach = (game) => {
    gameRef = game;
  };

  player.update = (game, dt) => {
    gameRef = game;
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt * 3);
    player.fireTimer = Math.max(0, player.fireTimer - dt);
    player.recoil = Math.max(0, player.recoil - dt * 5);
    const input = game.input;

    if (player.dead || player.busted) {
      player.deadTimer += dt;
      return;
    }

    const mouse = game.camera.screenToWorld(input.mouse.x, input.mouse.y);
    const aim = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    player.aim = aim;

    if (player.mode === 'car' && player.car) {
      const car = player.car;
      if (car.removed || car.exploded) {
        player.car = null;
        player.mode = 'foot';
      } else {
        player.inCarTime += dt;
        const throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
        const steer = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
        stepVehicle(car, dt, { throttle, steer, handbrake: input.down('Space'), brake: input.down('KeyS') && car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle) > 0 }, game);
        player.x = car.x;
        player.y = car.y;
        player.angle = car.angle;
        if (input.pressed('KeyE')) {
          player.exitCar(game);
          return;
        }
        if (input.pressed('KeyH')) game.audio?.play('horn', car.x, car.y);
        if (input.mouse.left) player.tryShoot(game, true);
        if (input.pressed('Digit1')) player.switchWeapon(game, 'fists');
        if (input.pressed('Digit2')) player.switchWeapon(game, 'pistol');
        if (input.pressed('Digit3')) player.switchWeapon(game, 'shotgun');
        if (input.pressed('Digit4')) player.switchWeapon(game, 'smg');
        maybeSirens(game, car);
        return;
      }
    }

    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const mx = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    const my = (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) - (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);
    const moving = mx !== 0 || my !== 0;
    const speed = run ? PLAYER.run : PLAYER.walk;
    const norm = moving ? Math.hypot(mx, my) : 1;
    const targetVx = (mx / norm) * speed;
    const targetVy = (my / norm) * speed;
    player.vx = damp(player.vx, targetVx, PLAYER.accel, dt);
    player.vy = damp(player.vy, targetVy, PLAYER.accel, dt);
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    const res = game.world.collideCircle(player.x, player.y, PLAYER.radius);
    if (res.hit) {
      if (res.hit.water) {
        player.x -= player.vx * dt;
        player.y -= player.vy * dt;
      } else {
        player.x = res.x;
        player.y = res.y;
      }
    }
    player.x = clamp(player.x, 20, game.world.width - 20);
    player.y = clamp(player.y, 20, game.world.height - 20);
    if (Math.hypot(player.vx, player.vy) > 4) {
      player.angle = Math.atan2(player.vy, player.vx);
      player.walk = speed;
      player.phase += dt * (run ? 13 : 8);
    } else {
      player.walk = 0;
      player.angle = damp(player.angle, aim, 10, dt);
    }
    player.aimBlend = damp(player.aimBlend, 1, 10, dt);

    if (input.pressed('KeyE')) {
      // Story and courier interactions own the key when they are offered; otherwise E is a car door.
      if (!game.missions?.interactHint) {
        const car = nearestEnterable(game, player.x, player.y, PLAYER.enterRange);
        if (car) {
          player.enterCar(game, car);
          return;
        }
      }
    }
    if (input.pressed('KeyR')) player.tryRob(game);
    if (input.mouse.left) player.tryShoot(game, false);
    for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
      if (input.pressed(`Digit${i + 1}`)) player.switchWeapon(game, WEAPON_ORDER[i]);
    }
    if (input.pressed('KeyQ')) {
      const idx = WEAPON_ORDER.indexOf(player.weapon);
      player.switchWeapon(game, WEAPON_ORDER[(idx + 1) % WEAPON_ORDER.length]);
    }
    if (input.pressed('KeyH')) game.audio?.play('horn', player.x, player.y);

    // A car that runs Ray down hurts him and shoves him aside.
    for (const car of game.vehicles) {
      if (car.removed || car.exploded) continue;
      const sp = Math.hypot(car.vx, car.vy);
      if (sp < 60) continue;
      if (dist(car.x, car.y, player.x, player.y) < car.length * 0.42 + 8) {
        const away = Math.atan2(player.y - car.y, player.x - car.x);
        player.x += Math.cos(away) * 20;
        player.y += Math.sin(away) * 20;
        player.hurt(sp > 190 ? 45 : 16, 'car');
        player.vx += Math.cos(away) * 90;
        player.vy += Math.sin(away) * 90;
      }
    }
  };

  player.tryShoot = (game, inCar) => {
    if (player.fireTimer > 0) return;
    const name = player.weapon;
    const w = WEAPONS[name];
    if (w.melee) {
      game.combat.melee(game);
      player.fireTimer = w.rate;
      player.recoil = 1;
      return;
    }
    if (player.weapons[name].ammo <= 0) {
      game.effects?.text(player.x, player.y - 28, 'CLICK', '#e7b9a3');
      game.audio?.play('click', player.x, player.y);
      player.fireTimer = 0.3;
      return;
    }
    player.weapons[name].ammo -= 1;
    player.fireTimer = w.rate;
    player.recoil = 1;
    const spread = inCar ? 0.09 : 0;
    game.combat.shootWeapon(game, name, player.x + Math.cos(player.aim) * 16, player.y + Math.sin(player.aim) * 16, player.aim + (Math.random() - 0.5) * spread, 'player');
    player.aimBlend = 1;
  };

  player.tryRob = (game) => {
    const target = game.pedestrians?.nearestRobTarget(player);
    if (!target) return false;
    target.robbed = true;
    const amount = 25 + Math.floor(Math.random() * 110);
    player.money += amount;
    game.stats.earned = (game.stats.earned ?? 0) + amount;
    game.effects?.text(target.x, target.y - 20, `+$${amount}`, '#f7dfa0');
    game.pedestrians.panicAt(target.x, target.y, 240, { x: player.x, y: player.y });
    game.police?.addHeat(0.22);
    game.audio?.play('pickup', target.x, target.y);
    return true;
  };

  function maybeSirens(game, car) {
    if (!car.police) return;
    car.siren = game.input.down('KeyH') ? true : car.siren;
  }

  return player;
}

/** The player's look, used by the renderer. */
export const PLAYER_LOOK = {
  shirt: PALETTE.cream,
  pants: '#39465a',
  skin: '#d8a077',
  hair: '#2b2119',
  accent: PALETTE.coral,
};
