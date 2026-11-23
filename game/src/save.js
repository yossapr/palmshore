// The save file: progress, cash, weapons and the player's last corner of the city, kept in
// localStorage (this browser only). It loads on boot so a reload resumes where the player was.

import { SAVE_KEY, SETTINGS_KEY } from './config.js';

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  const data = read(SAVE_KEY);
  if (!data || data.version !== 2) return null;
  return data;
}

export function saveProgress(game) {
  const player = game.player;
  return write(SAVE_KEY, {
    version: 2,
    cash: Math.max(0, Math.floor(player.cash)),
    missionIndex: game.missionIndex,
    storyDone: game.storyDone,
    weapons: { current: player.weapon, ammo: player.ammo },
    armour: Math.round(player.armour),
    health: Math.round(player.health),
    x: Math.round(player.x),
    y: Math.round(player.y),
    stats: { ...game.stats },
    savedAt: Date.now(),
  });
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Private windows refuse storage; nothing to clear.
  }
}

export function loadSettings() {
  const data = read(SETTINGS_KEY);
  return { sound: data?.sound !== false };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}
