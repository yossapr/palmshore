// The shared model for everyone on foot: civilians, police officers and gang members. It owns the
// look of each person, their health, their death, and the heat a crime adds to the wanted level.

import { PALETTE } from './config.js';
import { hitSpark } from './effects.js';
import { damageVehicle } from './vehicles.js';

const SHIRTS = ['#e4d6b8', '#d86a52', '#5d8f93', '#e8b45a', '#8f6f9e', '#6f8f5b', '#d7c0a4', '#b95f5f', '#7f9cb5'];
const PANTS = ['#4b5560', '#6b5b4b', '#3f4a56', '#8a7a62', '#57504a', '#6d7a86'];
const SKINS = ['#d8a87c', '#c08b5f', '#8f6242', '#e7bd94', '#6f4a33', '#b5774f'];
const HAIRS = ['#3b2a20', '#6b4a2c', '#c9a15c', '#2b2b2b', '#8a6b4a', '#d9c9a8'];

export function createPerson(game, options) {
  const rand = game.rand;
  const team = options.team ?? 'civil';
  const person = {
    id: game.nextPersonId++,
    team,
    x: options.x,
    y: options.y,
    angle: options.angle ?? rand() * Math.PI * 2,
    vx: 0,
    vy: 0,
    radius: 8,
    health: options.health ?? 100,
    maxHealth: options.health ?? 100,
    speed: options.speed ?? (team === 'civil' ? 62 : 78),
    armed: options.armed ?? false,
    weapon: options.weapon ?? 'pistol',
    state: options.state ?? 'walk',
    timer: 0,
    walkPhase: rand() * Math.PI * 2,
    dead: false,
    deadTimer: 0,
    hitFlash: 0,
    aim: 0,
    target: null,
    route: null,
    routeT: 0,
    panic: 0,
    aggro: 0,
    group: options.group ?? null,
    missionTag: options.missionTag ?? null,
    cooldown: 0.4 + rand() * 0.6,
    home: team === 'civil' ? { x: options.x, y: options.y } : null,
    fleeFrom: null,
    alerted: false,
    appearance: {
      shirt: options.shirt ?? SHIRTS[Math.floor(rand() * SHIRTS.length)],
      pants: options.pants ?? PANTS[Math.floor(rand() * PANTS.length)],
      skin: options.skin ?? SKINS[Math.floor(rand() * SKINS.length)],
      hair: options.hair ?? HAIRS[Math.floor(rand() * HAIRS.length)],
      hat: Math.random() < 0.15,
    },
  };
  if (team === 'police') {
    person.appearance.shirt = '#2f4e73';
    person.appearance.pants = '#26384f';
    person.appearance.hair = '#2b2b2b';
  } else if (team === 'gang') {
    person.appearance.shirt = options.shirt ?? '#5c4a54';
    person.appearance.hair = '#2b2b2b';
  }
  game.people.push(person);
  return person;
}

export function hurtPerson(game, person, amount, source = 'player', hitX = person.x, hitY = person.y) {
  if (person.dead) return;
  person.health -= amount;
  person.hitFlash = 0.16;
  person.alerted = true;
  if (person.team === 'civil') {
    person.panic = 4;
    person.state = 'flee';
    person.fleeFrom = { x: hitX, y: hitY };
    if (source === 'player') game.addHeat(2, 'assault');
  }
  if (person.team === 'police' && source === 'player') game.addHeat(7, 'assaulting an officer');
  hitSpark(game, hitX, hitY, Math.random() * Math.PI * 2);
  if (person.health <= 0) killPerson(game, person, source);
}

export function killPerson(game, person, source = 'player') {
  if (person.dead) return;
  person.dead = true;
  person.deadTimer = 0;
  person.vx = 0;
  person.vy = 0;
  person.state = 'dead';
  if (source === 'player') {
    if (person.team === 'police') game.addHeat(55, 'officer down');
    else if (person.team === 'civil') game.addHeat(30, 'murder');
    else game.addHeat(12, 'gang violence');
  }
  if (person.team === 'police') {
    game.policeAlarm?.(person.x, person.y);
    game.pickups.push({ x: person.x, y: person.y, kind: 'ammo', weapon: 'pistol', amount: 9 });
  } else if (person.team === 'gang') {
    game.pickups.push({ x: person.x + 4, y: person.y, kind: 'cash', amount: 24 + Math.floor(game.rand() * 50) });
    game.pickups.push({ x: person.x - 6, y: person.y + 4, kind: 'ammo', weapon: 'pistol', amount: 7 });
  } else {
    game.pickups.push({ x: person.x, y: person.y, kind: 'cash', amount: 8 + Math.floor(game.rand() * 34) });
  }
  game.stats.kills += person.team === 'civil' ? 1 : 0;
}

/** A body on the pavement fades out after a while; the city forgets quickly. */
export function updateDeadPeople(game, dt) {
  for (let i = game.people.length - 1; i >= 0; i -= 1) {
    const person = game.people[i];
    if (!person.dead) continue;
    person.deadTimer += dt;
    if (person.deadTimer > 14) game.people.splice(i, 1);
  }
}

export function panicNear(game, x, y, radius, fleeFrom = { x, y }) {
  for (const person of game.people) {
    if (person.dead || person.team !== 'civil') continue;
    const d = Math.hypot(person.x - x, person.y - y);
    if (d < radius) {
      person.panic = 3.5 + game.rand() * 2;
      person.state = 'flee';
      person.fleeFrom = fleeFrom;
    }
  }
}

/** Grenade-free explosion damage shared by burning cars and mission set-pieces. */
export function blastPeople(game, x, y, radius, damage, source = 'explosion') {
  for (const person of game.people) {
    if (person.dead) continue;
    const d = Math.hypot(person.x - x, person.y - y);
    if (d < radius) hurtPerson(game, person, damage * (1 - d / radius), source, person.x, person.y);
  }
  for (const car of game.vehicles) {
    if (car.burning || car.exploded) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < radius * 1.15) damageVehicle(game, car, damage * (1 - d / (radius * 1.15)) * 0.8);
  }
  const player = game.player;
  if (!player.inCar) {
    const d = Math.hypot(player.x - x, player.y - y);
    if (d < radius) game.damagePlayer(damage * (1 - d / radius) * 0.8, 'explosion');
  }
}

export const PERSON_COLORS = { SHIRTS, PANTS, SKINS, HAIRS, PALETTE };
