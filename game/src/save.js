// localStorage save: a small, fixed-shape snapshot with no timestamps so the same state
// always serialises to the same bytes.

import { GAME } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(GAME.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!readSave();
}

export function writeSave(game, slot = 1) {
  const data = {
    version: 2,
    slot,
    player: game.player.snapshot(),
    missions: game.missions.serialize(),
    freeRoam: {
      courierDone: game.missions.courierDone ?? 0,
      storyComplete: game.missions.storyComplete,
    },
  };
  try {
    window.localStorage.setItem(GAME.saveKey, JSON.stringify(data));
    game.hud?.toast(`SAVED · SLOT 0${slot} · ${game.player.rank.name}`, '#6fe0c0');
    game.audio?.cash();
    return true;
  } catch {
    game.hud?.toast('SAVE FAILED · STORAGE BLOCKED', '#ff8f8f');
    return false;
  }
}

export function applySave(game, data) {
  if (!data) return false;
  game.player.applySave(data.player ?? {});
  if (data.missions) game.missions.apply(data.missions);
  game.police.clearWanted();
  game.player.dead = false;
  game.player.health = 100;
  game.player.armour = 20;
  game.player.setPosition(361.2, 152, -Math.PI / 2);
  game.chase.yaw = -Math.PI / 2;
  game.chase.reset({ x: 361.2, y: 0.4, z: 152, heading: -Math.PI / 2 }, -Math.PI / 2);
  return true;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(GAME.saveKey);
  } catch {
    // Storage can be unavailable in a locked-down browser; nothing to do.
  }
}
