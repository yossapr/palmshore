// The game object and one simulation step: owns the state, builds Palmshore, runs the systems in
// order (missions, player, traffic, police, bullets, pedestrians), handles pickups, death and
// arrest, saves, and switches between the title, play, pause, wasted, busted and end-card screens.

import { STEP, PALETTE, PLAYER, WEAPONS, SAVE_KEY, CAMERA } from './config.js';
import { createRandom } from './random.js';
import { createWorld, PLACES } from './world.js';
import { districtAt } from './roads.js';
import { createPlayer, updatePlayer, damagePlayer } from './player.js';
import { createCamera, updateCamera, screenToWorld } from './camera.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWanted, addHeat, updatePolice, clearWanted, policeNear } from './police.js';
import { createVehicle, spawnVehicle, stepVehicle, collideVehicles } from './vehicles.js';
import { updateTraffic, seedTraffic } from './traffic.js';
import { seedPedestrians, updatePedestrians } from './pedestrians.js';
import { updateDeadPeople } from './people.js';
import { initMissions, updateMissions, updateDialogue, tryInteract, failMission } from './missions.js';
import { updateBullets } from './combat.js';
import { updateEffects, addShake, cashBurst, explosion } from './effects.js';
import { loadSave, saveProgress, loadSettings, saveSettings, clearSave } from './save.js';
import { drawHud } from './hud.js';
import { clamp } from './math.js';

export function createGame(canvas, seed) {
  const world = createWorld(seed);
  const renderer = createRenderer(canvas);
  renderer.resize();
  const game = {
    seed,
    rand: createRandom(seed * 977 + 13),
    world,
    renderer,
    canvas,
    input: createInput(canvas),
    audio: createAudio(),
    camera: createCamera(1078, 1080),
    player: createPlayer(),
    people: [],
    vehicles: [],
    bullets: [],
    particles: [],
    marks: [],
    scorches: [],
    pickups: [],
    notifications: [],
    wanted: createWanted(),
    heli: null,
    boss: null,
    mode: 'title',
    time: 0,
    titleTime: 0,
    titleIndex: 0,
    pauseIndex: 0,
    respawnTimer: 0,
    deathReason: null,
    shake: 0,
    hitFlash: 0,
    speedLines: 0,
    prompt: null,
    markerPrompt: null,
    markerFocus: null,
    aimWorld: { x: 0, y: 0 },
    aimTarget: false,
    objective: null,
    objectiveExtra: null,
    markers: [],
    dialogue: null,
    missionPassed: null,
    activityObjective: null,
    districtLabel: 'Verona Heights',
    stats: { missions: 0, deliveries: 0, robberies: 0, kills: 0, shots: 0, distance: 0 },
    shotsFired: 0,
    wantedFlash: 0,
    arrestTimer: 0,
    roadblockTimer: 0,
    cameraOverride: null,
    pauseMessage: null,
    onGunfire: null,
    policeAlarm: null,
    settings: loadSettings(),
    save: loadSave(),
    nextPersonId: 1,
  };
  game.audio.setEnabled(game.settings.sound);
  game.policeNear = () => policeNear(game);
  game.addHeat = (amount, reason) => addHeat(game, amount, reason);
  game.damagePlayer = (amount, source) => damagePlayer(game, amount, source);
  game.tryInteract = () => tryInteract(game);
  game.onExplosion = () => game.audio.explosion();
  game.notify = (text, seconds = 2.6, kind = 'info') => notify(game, text, seconds, kind);
  game.toast = game.notify;
  game.startDeath = (source) => startDeath(game, source);
  game.startBusted = () => startBusted(game);
  game.showEndCard = () => {
    game.mode = 'endcard';
    game.pendingSave = true;
    saveProgress(game);
  };
  game.titleItems = [];
  game.pauseItems = [];
  resetToNewGame(game);
  buildMenuItems(game);
  setTitleCamera(game);
  return game;
}

function buildMenuItems(game) {
  game.titleItems = [
    { label: game.save ? 'ENTER   CONTINUE' : 'ENTER   START STORY' },
    { label: 'N   NEW GAME' },
    { label: `S   SOUND: ${game.audio.enabled ? 'ON' : 'OFF'}` },
  ];
  game.pauseItems = [
    { label: 'RESUME', action: () => togglePause(game) },
    { label: 'SAVE GAME', action: () => { saveProgress(game); game.pauseMessage = 'Saved to this browser'; } },
    { label: `SOUND: ${game.audio.enabled ? 'ON' : 'OFF'}`, action: () => { toggleSound(game); game.pauseItems[2].label = `SOUND: ${game.audio.enabled ? 'ON' : 'OFF'}`; } },
    { label: 'QUIT TO TITLE', action: () => quitToTitle(game) },
  ];
}

export function resetToNewGame(game) {
  game.player = createPlayer();
  game.people = [];
  game.vehicles = [];
  game.bullets = [];
  game.particles = [];
  game.marks = [];
  game.scorches = [];
  game.pickups = game.world.pickups.map((pickup) => ({ ...pickup }));
  game.notifications = [];
  game.wanted = createWanted();
  game.heli = null;
  game.boss = null;
  game.objective = null;
  game.missionPassed = null;
  game.activityObjective = null;
  game.arrestTimer = 0;
  game.roadblockTimer = 0;
  game.respawnTimer = 0;
  game.time = 0;
  game.stats = { missions: 0, deliveries: 0, robberies: 0, kills: 0, shots: 0, distance: 0 };
  game.shotsFired = 0;
  initMissions(game);
  game.nextPersonId = 1;
  // Parked cars from the generator, then moving traffic and people.
  for (const parked of game.world.parked) {
    const car = spawnVehicle(game, parked.type, parked.x, parked.y, parked.angle, { parked: true });
    car.health = car.maxHealth;
    car.vx = 0;
    car.vy = 0;
  }
  seedTraffic(game);
  seedPedestrians(game);
  game.player.x = 1078;
  game.player.y = 1080;
  game.camera = createCamera(game.player.x, game.player.y);
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.camera.zoom = CAMERA.foot;
  game.aimWorld = { x: game.player.x + 100, y: game.player.y };
  game.districtLabel = districtAt(game.player.x, game.player.y).label;
  game.mode = 'title';
}

export function startNewGame(game) {
  resetToNewGame(game);
  game.mode = 'play';
  game.time = 0;
  clearSave();
  game.save = null;
  buildMenuItems(game);
  game.audio.resume();
  game.audio.mission();
  game.notify('PALMSHORE — find the gold marker at the Sunray Diner', 5, 'mission');
}

export function continueGame(game) {
  const save = game.save ?? loadSave();
  if (!save) {
    startNewGame(game);
    return;
  }
  resetToNewGame(game);
  game.mode = 'play';
  game.save = save;
  game.missionIndex = clamp(save.missionIndex ?? 0, 0, 99);
  game.storyDone = !!save.storyDone;
  game.player.cash = save.cash ?? 500;
  game.player.armour = save.armour ?? 0;
  game.player.health = save.health ?? 100;
  if (save.weapons?.ammo) {
    for (const key of Object.keys(save.weapons.ammo)) {
      if (key in game.player.ammo) game.player.ammo[key] = save.weapons.ammo[key];
      if ((save.weapons.ammo[key] ?? 0) > 0 && key in game.player.owned) game.player.owned[key] = true;
    }
  }
  if (save.weapons?.current) game.player.weapon = save.weapons.current;
  if (Number.isFinite(save.x) && Number.isFinite(save.y)) {
    game.player.x = save.x;
    game.player.y = save.y;
  }
  if (save.stats) game.stats = { ...game.stats, ...save.stats };
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.audio.resume();
  game.notify('SAVE LOADED — welcome back to Palmshore', 4, 'mission');
}

export function togglePause(game) {
  if (game.mode === 'play') {
    game.mode = 'paused';
    game.pauseIndex = 0;
    game.pauseMessage = null;
    game.audio.ui();
  } else if (game.mode === 'paused') {
    game.mode = 'play';
    game.pauseMessage = null;
    game.audio.ui();
  }
}

export function runPauseAction(game) {
  const item = game.pauseItems[game.pauseIndex];
  if (item?.action) item.action();
  game.audio.ui();
}

export function toggleSound(game) {
  game.audio.toggle();
  game.settings.sound = game.audio.enabled;
  saveSettings(game.settings);
  game.audio.ui();
}

export function quitToTitle(game) {
  game.mode = 'title';
  game.save = loadSave();
  buildMenuItems(game);
  setTitleCamera(game);
  game.pauseMessage = null;
}

export function respawnNow(game) {
  if (game.mode !== 'dead' && game.mode !== 'busted') return;
  game.mode = 'play';
  game.respawnTimer = 0;
  game.dialogue = null;
  clearWanted(game);
  game.player.inCar = null;
  game.player.health = PLAYER.maxHealth;
  game.player.armour = 0;
  const clinic = PLACES.clinic;
  game.player.x = clinic.x + 18;
  game.player.y = clinic.y + 14;
  game.player.vx = 0;
  game.player.vy = 0;
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.camera.zoom = CAMERA.foot;
  game.hitFlash = 0;
  game.audio.pickup();
}

export function leaveEndCard(game) {
  game.mode = 'play';
  game.showEndCardDone = true;
  game.notify('Free roam — the city is still yours', 3.5);
}

function startDeath(game, source) {
  if (game.mode !== 'play') return;
  game.mode = 'dead';
  game.deathReason = source;
  game.respawnTimer = 3.6;
  game.dialogue = null;
  game.player.inCar = null;
  game.player.cash = Math.max(0, game.player.cash - PLAYER.respawnCost);
  failMission(game, 'You were wasted');
  game.audio.fail();
  addShake(game, 18);
}

function startBusted(game) {
  if (game.mode !== 'play') return;
  game.mode = 'busted';
  game.respawnTimer = 3.6;
  game.dialogue = null;
  game.player.inCar = null;
  game.player.cash = Math.max(0, game.player.cash - PLAYER.bustCost);
  game.player.owned = { fists: true, pistol: true, shotgun: false, smg: false };
  game.player.weapon = 'pistol';
  game.player.ammo = { pistol: 12, shotgun: 0, smg: 0 };
  failMission(game, 'You were busted');
  game.audio.fail();
}

function notify(game, text, seconds, kind) {
  game.notifications.push({ text, life: seconds, max: seconds, kind });
  if (game.notifications.length > 8) game.notifications.shift();
}

function setTitleCamera(game) {
  const width = game.renderer.width;
  const height = game.renderer.height;
  const camera = game.camera;
  camera.x = 3580;
  camera.y = 1520;
  camera.zoom = 0.86;
  camera.shakeX = 0;
  camera.shakeY = 0;
  const halfW = width / (2 * camera.zoom);
  const halfH = height / (2 * camera.zoom);
  camera.bounds = { x0: camera.x - halfW - 80, y0: camera.y - halfH - 80, x1: camera.x + halfW + 80, y1: camera.y + halfH + 80 };
}

export function updateTitle(game, dt) {
  game.titleTime += dt;
  setTitleCamera(game);
  game.camera.y = 800 + Math.sin(game.titleTime * 0.11) * 500 + 400;
  const halfW = game.renderer.width / (2 * game.camera.zoom);
  const halfH = game.renderer.height / (2 * game.camera.zoom);
  game.camera.bounds = {
    x0: game.camera.x - halfW - 80, y0: game.camera.y - halfH - 80,
    x1: game.camera.x + halfW + 80, y1: game.camera.y + halfH + 80,
  };
  updateEffects(game, dt);
  for (const person of game.people) person.walkPhase += dt * 6;
  game.audio.update(game, dt);
}

/** One fixed simulation step. The HUD reads the state this leaves behind. */
export function stepGame(game, dt, input) {
  if (game.mode !== 'play' && game.mode !== 'shot') return;
  game.time += dt;

  // Aiming: the mouse in world space, and whether it is over something that can be shot.
  const mouse = input.mouse;
  game.aimWorld = screenToWorld(game.camera, mouse.x, mouse.y, game.renderer.width, game.renderer.height);
  game.aimTarget = false;
  for (const person of game.people) {
    if (!person.dead && Math.hypot(person.x - game.aimWorld.x, person.y - game.aimWorld.y) < 18) {
      game.aimTarget = true;
      break;
    }
  }
  if (!game.aimTarget) {
    for (const car of game.vehicles) {
      if (Math.hypot(car.x - game.aimWorld.x, car.y - game.aimWorld.y) < 24) {
        game.aimTarget = true;
        break;
      }
    }
  }

  if (game.mode === 'dead' || game.mode === 'busted') return;
  if (input.take('Escape') || input.take('KeyP')) togglePause(game);
  if (game.mode === 'paused') return;

  updateMissions(game, dt, input);
  if (game.dialogue) {
    updateDialogue(game, dt, input);
    updateEffects(game, dt);
    updateNotifications(game, dt);
    updateCamera(game.camera, game, dt, game.renderer.width, game.renderer.height);
    game.audio.update(game, dt);
    game.input.endFrame();
    return;
  }

  updatePlayer(game, dt, input);
  if (game.mode !== 'play') return;

  updateTraffic(game, dt);
  updatePolice(game, dt);
  if (game.mode !== 'play') return;

  // Cars with no AI (parked, abandoned, or the player's) still get physics.
  for (const car of game.vehicles) {
    if (car.exploded) continue;
    if (car.traffic && car.driver === 'traffic') continue;
    if (car.police && car.driver === 'police' && car.ai) continue;
    stepVehicle(game, car, dt);
  }
  collideVehicles(game);
  updateBullets(game, dt);
  updatePedestrians(game, dt);
  updateDeadPeople(game, dt);
  collectPickups(game);
  updateEffects(game, dt);
  updateNotifications(game, dt);
  if (game.wantedFlash > 0) game.wantedFlash -= dt;

  const speed = Math.hypot(game.player.vx, game.player.vy);
  game.stats.distance += speed * dt;
  game.districtLabel = districtAt(game.player.x, game.player.y).label;
  updateCamera(game.camera, game, dt, game.renderer.width, game.renderer.height);
  game.audio.update(game, dt);
}

function updateNotifications(game, dt) {
  for (let i = game.notifications.length - 1; i >= 0; i -= 1) {
    game.notifications[i].life -= dt;
    if (game.notifications[i].life <= 0) game.notifications.splice(i, 1);
  }
}

function collectPickups(game) {
  const player = game.player;
  const reach = player.inCar ? 30 : 24;
  for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = game.pickups[i];
    if (pickup.taken) continue;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    if (Math.hypot(pickup.x - px, pickup.y - py) > reach) continue;
    let picked = false;
    if (pickup.kind === 'health') {
      if (player.health < PLAYER.maxHealth) {
        player.health = Math.min(PLAYER.maxHealth, player.health + (pickup.amount ?? 40));
        game.notify(`+${pickup.amount ?? 40} health`, 1.8);
        picked = true;
      }
    } else if (pickup.kind === 'armour') {
      if (player.armour < PLAYER.maxArmour) {
        player.armour = Math.min(PLAYER.maxArmour, player.armour + (pickup.amount ?? 50));
        game.notify(`+${pickup.amount ?? 50} armour`, 1.8);
        picked = true;
      }
    } else if (pickup.kind === 'ammo') {
      const weapon = pickup.weapon ?? 'pistol';
      player.owned[weapon] = true;
      player.ammo[weapon] = Math.min(WEAPONS[weapon].ammoMax, (player.ammo[weapon] ?? 0) + (pickup.amount ?? 12));
      game.notify(`${WEAPONS[weapon].name} ammo +${pickup.amount ?? 12}`, 1.8);
      picked = true;
    } else if (pickup.kind === 'cash') {
      player.cash += pickup.amount ?? 20;
      game.notify(`+$${pickup.amount ?? 20}`, 1.8);
      cashBurst(game, pickup.x, pickup.y);
      picked = true;
    }
    if (picked) {
      game.audio.pickup();
      game.pickups.splice(i, 1);
    }
  }
}

/** Draw one frame: world through the renderer, HUD on top. */
export function drawGame(game) {
  game.renderer.draw(game);
  drawHud(game.renderer.ctx, game, game.renderer.width, game.renderer.height);
}

export { STEP, PALETTE, SAVE_KEY };
