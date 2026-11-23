// The player on foot and behind the wheel: walking and running, aiming with the mouse, using a
// weapon, getting in and out of cars, robbing the people on the pavement, and taking damage.

import { PLAYER, WEAPONS } from './config.js';
import { clamp, damp, angleTo, distance } from './math.js';
import { resolveCircle } from './world.js';
import { nearestVehicle, speedOf } from './vehicles.js';
import { fireWeapon, meleeAttack } from './combat.js';
import { createPerson } from './people.js';
import { addParticle } from './effects.js';

export function createPlayer() {
  return {
    x: 1078,
    y: 1080,
    angle: Math.PI / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    health: PLAYER.maxHealth,
    armour: 0,
    cash: 500,
    weapon: 'pistol',
    ammo: { pistol: 36, shotgun: 0, smg: 0 },
    owned: { fists: true, pistol: true, shotgun: false, smg: false },
    inCar: null,
    fireCooldown: 0,
    meleeCooldown: 0,
    robCooldown: 0,
    walkPhase: 0,
    stepTimer: 0,
    hurtTimer: 0,
    inWater: false,
  };
}

export function updatePlayer(game, dt, input) {
  const player = game.player;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.meleeCooldown = Math.max(0, player.meleeCooldown - dt);
  player.robCooldown = Math.max(0, player.robCooldown - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  game.prompt = null;

  if (player.inCar) {
    updateInCar(game, dt, input);
    return;
  }

  const move = input.moveVector();
  const running = input.held('ShiftLeft') || input.held('ShiftRight');
  const speed = running ? PLAYER.run : PLAYER.walk;
  const targetVx = move.x * speed;
  const targetVy = move.y * speed;
  player.vx = damp(player.vx, targetVx, 13, dt);
  player.vy = damp(player.vy, targetVy, 13, dt);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const resolved = resolveCircle(game.world, player.x, player.y, player.radius);
  player.x = resolved.x;
  player.y = resolved.y;
  if (resolved.hit) {
    player.vx *= 0.4;
    player.vy *= 0.4;
  }

  const aim = game.aimWorld;
  if (aim) player.angle = angleTo(player.x, player.y, aim.x, aim.y);
  player.walkPhase += Math.hypot(player.vx, player.vy) * dt * 0.06;

  if (Math.hypot(player.vx, player.vy) > 20) {
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      player.stepTimer = running ? 0.22 : 0.38;
      if (game.world.sandX < player.x) addParticle(game, { kind: 'smoke', x: player.x, y: player.y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 3, grow: 12, color: '#e6d5ae' });
    }
  }

  // Aiming and firing.
  if (input.mouse.down || input.held('Space')) {
    if (player.weapon === 'fists' || input.held('Space')) {
      meleeAttack(game, player, player.angle);
    } else if (player.fireCooldown <= 0) {
      const weapon = WEAPONS[player.weapon];
      if (player.ammo[player.weapon] > 0) {
        fireWeapon(game, {
          x: player.x + Math.cos(player.angle) * 12, y: player.y + Math.sin(player.angle) * 12,
          angle: player.angle, weapon: player.weapon, owner: 'player',
        });
        player.ammo[player.weapon] -= 1;
        player.fireCooldown = weapon.rate;
        player.vx -= Math.cos(player.angle) * weapon.kick;
        player.vy -= Math.sin(player.angle) * weapon.kick;
        game.audio.shoot(player.weapon);
        game.shotsFired += 1;
        game.addHeat(player.weapon === 'shotgun' ? 3.4 : 1.2, 'discharging a firearm');
        game.stats.shots += 1;
      } else {
        player.fireCooldown = 0.3;
        game.notify('Out of ammo — find a pickup or Dockside Sporting');
        game.audio.ui();
      }
    }
  }

  // Weapon switching.
  if (input.take('Digit1')) selectWeapon(game, 'fists');
  if (input.take('Digit2')) selectWeapon(game, 'pistol');
  if (input.take('Digit3')) selectWeapon(game, player.owned.shotgun ? 'shotgun' : 'pistol');

  // Interact: enter a car, rob someone, or use a shop/mission marker (missions.js claims that).
  const carNear = nearestVehicle(game, player.x, player.y, PLAYER.interact + 18, (car) => !car.police || game.wanted.level > 0 || !car.driver);
  let robTarget = null;
  let robDistance = 36;
  for (const person of game.people) {
    if (person.dead || person.team === 'police') continue;
    const d = distance(player.x, player.y, person.x, person.y);
    if (d < robDistance) {
      robDistance = d;
      robTarget = person;
    }
  }
  // A story or activity marker wins over a parked car, so starting a job can never be swallowed
  // by the car sitting on the marker. Shops keep the car priority: you may just be parking.
  const focus = game.markerFocus;
  const focusWins = !!focus && focus.distance < (focus.kind === 'shop' ? 58 : 74) && player.robCooldown <= 0;
  if (focusWins && game.markerPrompt) game.prompt = game.markerPrompt;
  else if (player.robCooldown <= 0 && carNear) game.prompt = { key: 'E', text: carNear.car.driver ? `Carjack the ${carNear.car.stats.name}` : `Steal the ${carNear.car.stats.name}` };
  else if (robTarget && player.robCooldown <= 0) game.prompt = { key: 'E', text: robTarget.team === 'gang' ? 'Shake down the Gull' : 'Rob the passer-by' };
  else if (game.markerPrompt) game.prompt = game.markerPrompt;

  if (input.take('KeyE')) {
    if (focusWins && game.tryInteract) {
      game.tryInteract();
    } else if (carNear) {
      enterVehicle(game, carNear.car);
    } else if (robTarget) {
      robPerson(game, robTarget);
    } else if (game.tryInteract) {
      game.tryInteract();
    }
  }

  // Cars can run the player down.
  for (const car of game.vehicles) {
    if (car.exploded) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    const speedCar = speedOf(car);
    if (d < car.width * 0.8 + player.radius && speedCar > 70 && player.hurtTimer <= 0) {
      damagePlayer(game, Math.min(60, speedCar * 0.14), 'traffic');
      const a = Math.atan2(player.y - car.y, player.x - car.x);
      player.vx = Math.cos(a) * 190;
      player.vy = Math.sin(a) * 190;
      player.hurtTimer = 0.8;
      game.audio.hit();
    }
  }
}

function updateInCar(game, dt, input) {
  const player = game.player;
  const car = player.inCar;
  if (!car || car.exploded) {
    player.inCar = null;
    return;
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.vx = car.vx;
  player.vy = car.vy;
  const controls = input.driving();
  car.controls.throttle = controls.throttle;
  car.controls.brake = controls.brake;
  car.controls.steer = controls.steer;
  car.controls.handbrake = controls.handbrake;
  if (controls.throttle > 0 && car.health < car.maxHealth * 0.4) {
    // A damaged engine coughs and smokes harder.
    if (Math.random() < 0.02) addParticle(game, { kind: 'smoke', x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 5, grow: 20, color: '#4b453d' });
  }
  if (input.take('KeyH')) {
    game.audio.horn();
    car.horn = 0.3;
  }
  game.prompt = { key: 'E', text: 'Get out' };

  // Drive-by: the pistol out the window, less accurate than standing.
  if (input.mouse.down && (player.weapon === 'pistol' || player.weapon === 'smg') && player.fireCooldown <= 0) {
    if (player.ammo[player.weapon] > 0) {
      const aim = game.aimWorld;
      const base = aim ? angleTo(car.x, car.y, aim.x, aim.y) : car.angle;
      const angle = base + (Math.random() - 0.5) * 0.14;
      fireWeapon(game, {
        x: car.x + Math.cos(angle) * 26, y: car.y + Math.sin(angle) * 26,
        angle, weapon: player.weapon, owner: 'player', car,
      });
      player.ammo[player.weapon] -= 1;
      player.fireCooldown = WEAPONS[player.weapon].rate * 1.35;
      game.audio.shoot(player.weapon);
      game.addHeat(1.1, 'discharging a firearm');
      game.stats.shots += 1;
    } else {
      player.fireCooldown = 0.4;
    }
  }
  if (input.take('KeyE')) {
    exitVehicle(game);
  }
}

export function enterVehicle(game, car) {
  const player = game.player;
  if (car.burning > 0 || car.exploded) return false;
  if (car.driver && car.driver !== 'player') {
    // Carjack: whoever was driving scrambles out and runs.
    if (car.traffic) car.traffic.aboard = false;
    car.traffic = null;
    car.driver = 'player';
    createPerson(game, {
      team: 'civil', x: car.x - Math.cos(car.angle) * 22, y: car.y - Math.sin(car.angle) * 22,
      state: 'flee', health: 80,
    }).fleeFrom = { x: car.x, y: car.y };
    game.addHeat(car.police ? 26 : 9, car.police ? 'stealing a police cruiser' : 'grand theft auto');
    game.notify(car.police ? 'You stole a police cruiser' : 'You jacked a car');
  } else {
    car.driver = 'player';
    car.traffic = null;
  }
  car.parked = false;
  car.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  if (car.police) {
    car.siren = true;
    game.addHeat(10, 'stealing a police cruiser');
  }
  game.audio.ui();
  game.toast(`Behind the wheel: ${car.stats.name}`, 2);
  return true;
}

export function exitVehicle(game) {
  const player = game.player;
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  car.driver = null;
  car.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const side = car.angle + Math.PI / 2;
  const offset = car.width * 0.7 + 14;
  const spot = resolveCircle(game.world, car.x + Math.cos(side) * offset, car.y + Math.sin(side) * offset, player.radius);
  player.x = spot.x;
  player.y = spot.y;
  player.vx = 0;
  player.vy = 0;
  game.audio.ui();
}

export function selectWeapon(game, weapon) {
  const player = game.player;
  if (!player.owned[weapon]) return;
  player.weapon = weapon;
  game.audio.ui();
}

export function giveWeapon(game, weapon, amount) {
  const player = game.player;
  player.owned[weapon] = true;
  player.ammo[weapon] = Math.min(WEAPONS[weapon].ammoMax, (player.ammo[weapon] ?? 0) + amount);
  if (player.weapon === 'fists') player.weapon = weapon;
  game.notify(`${WEAPONS[weapon].name} acquired  ·  +${amount} rounds`, 3);
  game.audio.pickup();
}

export function damagePlayer(game, amount, source = 'unknown') {
  const player = game.player;
  if (game.mode === 'dead' || game.mode === 'busted') return;
  if (source !== 'fall') game.hitFlash = Math.min(0.8, game.hitFlash + amount * 0.01);
  let left = amount;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, left * 0.7);
    player.armour -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  game.shake = Math.min(24, game.shake + Math.min(10, amount * 0.22));
  if (player.health <= 0) {
    player.health = 0;
    game.startDeath(source);
  }
}

export function robPerson(game, person) {
  const player = game.player;
  const amount = 12 + Math.floor(game.rand() * 55);
  player.cash += amount;
  player.robCooldown = 1.4;
  person.panic = 6;
  person.state = 'flee';
  person.fleeFrom = { x: player.x, y: player.y };
  game.notify(`Robbed $${amount}`, 2);
  game.audio.cash();
  game.addHeat(3, 'robbery');
  game.stats.robberies += 1;
}

export { clamp };
