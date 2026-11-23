// Boot, the loop and the screens. Builds the city once from the seed, runs the simulation in
// short variable steps, then draws the world and whichever screen sits over it: title, intro,
// play, pause, wasted, busted, ending. ?shot=<scene> hands over to shots.js for a still frame.

import { MAX_FRAME, CITY } from './config.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createCamera } from './camera.js';
import { createMinimap } from './minimap.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createParkedVehicles, resolveVehiclePairs, createVehicle } from './vehicles.js';
import { hasSave, saveGame, readSave, applySave } from './save.js';
import { stageShot } from './shots.js';
import { PALETTE, FONT } from './config.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;
const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
let game = null;

function resize() {
  const w = Math.max(320, window.innerWidth);
  const h = Math.max(240, window.innerHeight);
  canvas.width = Math.floor(w);
  canvas.height = Math.floor(h);
  if (game) game.camera.resize(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function spawnPoint(world) {
  const base = world.landmarks.spawn ?? world.landmarks.safehouse?.door ?? { x: 400, y: 400 };
  for (const off of [{ x: 0, y: 0 }, { x: 26, y: 0 }, { x: -26, y: 0 }, { x: 0, y: 26 }, { x: 0, y: -26 }]) {
    const res = world.collideCircle(base.x + off.x, base.y + off.y, 11);
    if (!res.hit) return { x: base.x + off.x, y: base.y + off.y };
  }
  const node = world.roads.node(2, 3);
  return { x: node.x, y: node.y + 30 };
}

function createGame(seedValue) {
  const world = createWorld(seedValue);
  const spawn = spawnPoint(world);
  const player = createPlayer(spawn.x, spawn.y);
  const effects = createEffects();
  const g = {
    seed: seedValue,
    world,
    player,
    effects,
    audio: createAudio(),
    combat: createCombat(),
    camera: createCamera(canvas.width, canvas.height),
    minimap: createMinimap(world),
    hud: createHud(canvas),
    renderer: createRenderer(canvas),
    traffic: null,
    pedestrians: null,
    police: null,
    missions: null,
    vehicles: [],
    enemies: [],
    input: null,
    stats: { kills: 0, earned: 0, missions: 0, deliveries: 0, spent: 0 },
    time: 0,
    screen: 'title',
    menu: { index: 0, items: [] },
    downTimer: 0,
    endTimer: 0,
    endCost: 0,
    endingDone: false,
    missionResult: null,
    shotTime: 0,
    savedLabel: 0,
  };
  g.input = createInput(canvas);
  g.player.attach(g);
  g.traffic = createTraffic(world, seedValue, 32);
  g.vehicles = createParkedVehicles(world).concat(g.traffic.cars);
  g.pedestrians = createPedestrians(world, seedValue);
  g.police = createPolice(world, seedValue);
  g.missions = createMissions(world, seedValue);
  g.combat.createWorldPickups(world);
  g.renderer.attach(g);
  g.audio.setListener(spawn.x, spawn.y, g);
  return g;
}

function buildTitleMenu(g) {
  const items = [{ label: 'NEW GAME', note: 'the Sunray is waiting', action: 'new' }];
  if (hasSave()) items.push({ label: 'CONTINUE', note: 'pick up where Ray left off', action: 'continue' });
  items.push({ label: `SOUND: ${g.audio.enabled ? 'ON' : 'OFF'}`, note: 'music · engines · sirens', action: 'sound' });
  g.menu = { items, index: Math.min(g.menu?.index ?? 0, items.length - 1) };
}

function buildPauseMenu(g) {
  const items = [
    { label: 'RESUME', action: 'resume' },
    { label: 'SAVE GAME', action: 'save' },
  ];
  if (hasSave()) items.push({ label: 'LOAD GAME', action: 'load' });
  items.push({ label: `SOUND: ${g.audio.enabled ? 'ON' : 'OFF'}`, action: 'sound' });
  items.push({ label: 'RETURN TO TITLE', action: 'title' });
  g.menu = { items, index: 0 };
}

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

function resetRun(g) {
  const world = g.world;
  const spawn = spawnPoint(world);
  const p = g.player;
  p.x = spawn.x;
  p.y = spawn.y;
  p.health = 100;
  p.armour = 0;
  p.money = 320;
  p.dead = false;
  p.busted = false;
  p.mode = 'foot';
  p.car = null;
  p.weapon = 'pistol';
  p.weapons = { fists: { ammo: Infinity }, pistol: { ammo: 9 }, shotgun: { ammo: 0 }, smg: { ammo: 0 } };
  p.unlocked = { fists: true, pistol: true, shotgun: false, smg: false };
  g.stats = { kills: 0, earned: 0, missions: 0, deliveries: 0, spent: 0 };
  g.missions.restoreCompleted([]);
  g.missions.clearResult();
  g.missions.abandon();
  g.missions.resetCooldown();
  g.missions.endingDone = false;
  g.missionResult = null;
  g.police.clear(g);
  g.enemies = [];
  g.endingDone = false;
  g.player.angle = -0.5;
  g.player.aim = -0.5;
  g.gameIntroTimer = 0;
  g.camera.fixed = false;
  g.camera.snap(p.x, p.y);
  g.screen = 'intro';
  announce('Palmshore. Walk into the coral mission marker and press E.');
}

function startPlay(g, loaded = false) {
  g.screen = 'play';
  g.camera.fixed = false;
  g.camera.snap(g.player.x, g.player.y);
  g.hud.notify(loaded ? 'WELCOME BACK TO PALMSHORE' : 'PALMSHORE · FRIDAY, 4:12 PM', 'gold', 4.5);
  g.hud.notify('CORAL MARKER · PRESS E TO START A JOB', 'ink', 6);
  g.player.dead = false;
  g.player.busted = false;
  g.downTimer = 0;
  g.audio.resume();
}

function toggleSound(g) {
  const on = g.audio.toggle();
  g.hud.notify(on ? 'SOUND ON' : 'SOUND OFF', 'ink', 2);
  if (g.screen === 'title') buildTitleMenu(g);
  else if (g.screen === 'paused') buildPauseMenu(g);
}

function menuNavigation(g) {
  const inp = g.input;
  const n = g.menu.items.length;
  if (inp.pressed('ArrowUp') || inp.pressed('KeyW')) {
    g.menu.index = (g.menu.index - 1 + n) % n;
    g.audio.play('ui');
  }
  if (inp.pressed('ArrowDown') || inp.pressed('KeyS')) {
    g.menu.index = (g.menu.index + 1) % n;
    g.audio.play('ui');
  }
  if (inp.pressed('Enter') || inp.pressed('NumpadEnter') || inp.pressed('Space')) {
    return g.menu.items[g.menu.index]?.action ?? null;
  }
  return null;
}

function handleTitle(g) {
  const action = menuNavigation(g);
  if (!action) return;
  if (action === 'new') {
    resetRun(g);
  } else if (action === 'continue') {
    const data = readSave();
    if (data) {
      applySave(g, data);
      startPlay(g, true);
    } else {
      g.hud.notify('NO SAVED RUN FOUND', 'coral', 3);
    }
  } else if (action === 'sound') {
    toggleSound(g);
  }
}

function handlePause(g) {
  if (g.input.pressed('Escape')) {
    g.screen = 'play';
    g.audio.play('ui');
    return;
  }
  const action = menuNavigation(g);
  if (!action) return;
  if (action === 'resume') {
    g.screen = 'play';
  } else if (action === 'save') {
    const ok = saveGame(g);
    g.hud.notify(ok ? 'GAME SAVED · CASA LUNA' : 'COULD NOT SAVE', ok ? 'teal' : 'coral', 3);
    buildPauseMenu(g);
  } else if (action === 'load') {
    const data = readSave();
    if (data) {
      applySave(g, data);
      startPlay(g, true);
    }
  } else if (action === 'sound') {
    toggleSound(g);
  } else if (action === 'title') {
    g.screen = 'title';
    buildTitleMenu(g);
    g.camera.fixed = true;
  }
}

function respawn(g, busted) {
  const p = g.player;
  const cost = Math.min(busted ? 180 : 250, Math.max(0, p.money));
  p.money -= cost;
  g.stats.spent = (g.stats.spent ?? 0) + cost;
  const place = busted ? g.world.landmarks.police : g.world.landmarks.hospital;
  const fallback = g.world.landmarks.safehouse;
  let spot = place?.door ?? fallback?.door ?? g.world.landmarks.spawn;
  let res = g.world.collideCircle(spot.x, spot.y, 11);
  if (res.hit) {
    spot = fallback?.door ?? g.world.landmarks.spawn;
    res = g.world.collideCircle(spot.x, spot.y, 11);
  }
  p.x = res.hit ? g.world.landmarks.spawn.x : spot.x;
  p.y = res.hit ? g.world.landmarks.spawn.y : spot.y;
  p.health = 100;
  p.armour = 0;
  p.dead = false;
  p.busted = false;
  p.mode = 'foot';
  p.car = null;
  p.vx = 0;
  p.vy = 0;
  if (busted) {
    for (const name of ['pistol', 'shotgun', 'smg']) p.weapons[name].ammo = Math.floor(p.weapons[name].ammo * 0.5);
  }
  p.hurtTimer = 0;
  g.police.clear(g);
  g.downTimer = 0;
  g.screen = 'play';
  g.menu = { index: 0, items: [] };
  g.camera.snap(p.x, p.y);
  g.hud.notify(busted ? 'RELEASED · BAIL PAID' : 'PATCHED UP · BILL PAID', 'ink', 4);
  announce(busted ? 'Busted. Released from the police station.' : 'Wasted. Woke up at St. Augustine.');
  g.audio.play('ui');
}

function simulate(g, dt) {
  const p = g.player;
  p.update(g, dt);
  g.traffic.update(g, dt);
  g.police.update(g, dt);
  g.missions.update(g, dt);
  g.pedestrians.update(g, dt);
  g.combat.updateBullets(g, dt);
  g.combat.updatePickups(g, dt);
  resolveVehiclePairs(g);
  g.effects.update(dt);
  g.hud.update(g, dt);
  g.camera.follow(g, dt);
  g.camera.updateShake(dt);
  g.time += dt;
  g.audio.setListener(g.camera.x, g.camera.y, g);
  g.audio.update(dt);
  // Recycle dead vehicles now and then.
  if (Math.random() < dt * 2) g.vehicles = g.vehicles.filter((c) => !c.removed);
  g.enemies = g.enemies.filter((e) => !e.removed && !(e.dead && e.deadTimer > 30));
}

function simulateAmbient(g, dt) {
  g.traffic.update(g, dt);
  g.pedestrians.update(g, dt);
  g.effects.update(dt);
  g.hud.update(g, dt);
  g.audio.setListener(g.camera.x, g.camera.y, g);
  g.audio.update(dt);
  g.time += dt;
}

function handleDown(g, dt) {
  if (g.screen !== 'play') return;
  const p = g.player;
  if (p.dead || p.busted) {
    g.downTimer += dt;
    if (g.downTimer > 1.15) {
      g.screen = p.busted ? 'busted' : 'dead';
      g.endTimer = 0;
      g.endCost = Math.min(p.busted ? 180 : 250, Math.max(0, p.money));
      g.missions.abandon();
      g.missions.clearResult();
      g.missionResult = null;
      g.police.clear(g);
      g.audio.play(p.busted ? 'busted' : 'wasted');
      announce(p.busted ? 'Busted.' : 'Wasted.');
    }
  }
}

function handleMissionResult(g, dt) {
  const result = g.missionResult;
  if (!result) return;
  const done = result.timer > 4.8 || g.input.pressed('Enter') || g.input.pressed('NumpadEnter');
  if (!done) return;
  const wasEnding = g.missions.ending && result.passed;
  g.missions.clearResult();
  g.missionResult = null;
  if (result.passed) {
    saveGame(g);
    g.savedLabel = 3;
    if (wasEnding && !g.endingDone) {
      g.endingDone = true;
      g.screen = 'ending';
      g.endTimer = 0;
    }
  }
}

function update(g, dt) {
  if (g.screen === 'title') {
    simulateAmbient(g, dt);
    const base = g.world.landmarks.coralArms ?? g.world.landmarks.sunray ?? { x: 400, y: 400 };
    const t = g.time;
    g.camera.fixed = true;
    g.camera.pose(base.x + Math.sin(t * 0.045) * 120, base.y + Math.cos(t * 0.031) * 60, canvas.height / 560);
    g.hud.update(g, dt);
    handleTitle(g);
    return;
  }
  if (g.screen === 'intro') {
    simulateAmbient(g, dt);
    g.gameIntroTimer = (g.gameIntroTimer ?? 0) + dt;
    g.camera.follow(g, dt);
    g.camera.updateShake(dt);
    if (g.gameIntroTimer > 9 || g.input.pressed('Enter') || g.input.pressed('NumpadEnter') || g.input.pressed('Space')) {
      startPlay(g);
    }
    return;
  }
  if (g.screen === 'play') {
    if (g.input.pressed('Escape')) {
      g.screen = 'paused';
      buildPauseMenu(g);
      g.audio.play('ui');
      return;
    }
    simulate(g, dt);
    handleDown(g, dt);
    handleMissionResult(g, dt);
    if (g.savedLabel > 0) g.savedLabel -= dt;
    return;
  }
  if (g.screen === 'paused') {
    handlePause(g);
    return;
  }
  if (g.screen === 'dead' || g.screen === 'busted') {
    g.endTimer += dt;
    g.effects.update(dt);
    g.camera.updateShake(dt);
    g.audio.update(dt);
    if (g.endTimer > 0.6 && (g.input.pressed('Enter') || g.input.pressed('NumpadEnter') || g.input.pressed('Space'))) {
      respawn(g, g.screen === 'busted');
    }
    return;
  }
  if (g.screen === 'ending') {
    g.endTimer += dt;
    g.effects.update(dt);
    g.camera.follow(g, dt);
    g.audio.update(dt);
    if (g.endTimer > 1 && (g.input.pressed('Enter') || g.input.pressed('NumpadEnter') || g.input.pressed('Space'))) {
      g.screen = 'play';
      g.hud.notify('FREE ROAM · THE CITY IS YOURS', 'gold', 5);
      g.missions.clearResult();
    }
  }
}

function draw(g) {
  g.renderer.draw(g, g.time);
  const ctx = g.renderer.ctx;
  if (g.screen === 'title') {
    g.hud.drawTitle(ctx, g);
  } else if (g.screen === 'intro') {
    g.hud.drawIntro(ctx, g);
  } else {
    g.hud.draw(ctx, g);
    if (g.screen === 'paused') g.hud.drawPause(ctx, g);
    else if (g.screen === 'dead' || g.screen === 'busted') g.hud.drawEnd(ctx, g, g.screen, g.endCost);
    else if (g.screen === 'ending') g.hud.drawEnding(ctx, g);
    if (g.screen === 'play' && g.missionResult) g.hud.drawMissionResult(ctx, g, g.missionResult);
    if (g.savedLabel > 0) {
      ctx.fillStyle = 'rgba(247,237,215,0.55)';
      ctx.font = '600 10px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SAVED', 24, canvas.height - 58);
    }
  }
}

// ---- boot -----------------------------------------------------------------------------------
resize();
game = createGame(seed);
buildTitleMenu(game);

if (shot) {
  // A still frame: stage the scene, settle the camera, paint three times, then say it is ready.
  game.screen = 'play';
  game.camera.fixed = true;
  game.shotTime = stageShot(shot, game);
  game.time = game.shotTime;
  let painted = 0;
  const paint = () => {
    game.renderer.draw(game, game.shotTime);
    game.hud.draw(game.renderer.ctx, game, { shot: true });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      document.body.dataset.shotReady = 'true';
    }
  };
  requestAnimationFrame(paint);
} else {
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
    last = now;
    update(game, dt);
    draw(game);
    game.input.endFrame();
  };
  window.addEventListener('keydown', () => game.audio.resume(), { once: true });
  window.addEventListener('pointerdown', () => game.audio.resume(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'paused';
      buildPauseMenu(game);
    }
  });
  requestAnimationFrame(frame);
}

window.__palmshore = { get game() { return game; }, createVehicle, PALETTE, FONT, CITY };
