// Save and load through localStorage: money, health, armour, guns, ammo, where Ray is standing,
// which jobs are done and the free-roam stats. One slot, versioned, defended against bad JSON.

import { SAVE_KEY, WEAPON_ORDER } from './config.js';
import { createVehicle } from './vehicles.js';

export function hasSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data && data.v === 2;
  } catch {
    return false;
  }
}

export function saveGame(game) {
  const p = game.player;
  const data = {
    v: 2,
    at: Date.now(),
    money: p.money,
    health: p.health,
    armour: p.armour,
    weapon: p.weapon,
    weapons: Object.fromEntries(WEAPON_ORDER.map((name) => [name, p.weapons[name].ammo])),
    unlocked: { ...p.unlocked },
    position: { x: p.x, y: p.y },
    mode: p.mode,
    car: p.mode === 'car' && p.car ? { x: p.car.x, y: p.car.y, angle: p.car.angle, type: p.car.type, color: p.car.color, health: p.car.health } : null,
    completed: game.missions.completed(),
    stats: { ...game.stats },
    time: game.time,
    wanted: 0,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}


/** Put a saved run back into a freshly built game. */
export function applySave(game, data) {
  if (!data) return false;
  const p = game.player;
  p.money = Number.isFinite(data.money) ? data.money : 320;
  p.health = Number.isFinite(data.health) && data.health > 0 ? data.health : 100;
  p.armour = Number.isFinite(data.armour) ? data.armour : 0;
  p.weapon = data.weapon ?? 'fists';
  for (const name of WEAPON_ORDER) {
    if (data.weapons && Number.isFinite(data.weapons[name])) p.weapons[name].ammo = data.weapons[name];
    p.unlocked[name] = data.unlocked?.[name] ?? (name === 'fists' || name === 'pistol');
  }
  p.dead = false;
  p.busted = false;
  p.mode = 'foot';
  p.car = null;
  const pos = data.position ?? {};
  p.x = Number.isFinite(pos.x) ? pos.x : game.world.landmarks.spawn.x;
  p.y = Number.isFinite(pos.y) ? pos.y : game.world.landmarks.spawn.y;
  game.stats = { ...(data.stats ?? {}), kills: data.stats?.kills ?? 0, earned: data.stats?.earned ?? 0 };
  game.missions.restoreCompleted(data.completed ?? []);
  game.police.clear(game);
  if (data.car) {
    const car = createVehicle({
      x: data.car.x,
      y: data.car.y,
      angle: data.car.angle ?? 0,
      type: data.car.type ?? 'sedan',
      color: data.car.color,
    });
    car.health = data.car.health ?? car.maxHealth;
    game.vehicles.push(car);
    p.enterCar(game, car);
  }
  return true;
}
