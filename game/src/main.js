// Palmshore boots here: build the stage, the street, the people, the police and the HUD,
// then run the fixed-step simulation. Query ?shot=... runs a deterministic capture scene.

import { WORLD, CITY, CLOCK, SHOT_SAVE, GAME } from './config.js';
import { Renderer } from './render.js';
import { Roads } from './roads.js';
import { World } from './world.js';
import { ChaseCamera } from './camera.js';
import { Input } from './input.js';
import { Vehicles } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Story } from './story.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { readSave, writeSave, applySave, hasSave } from './save.js';
import { prepareShot } from './shots.js';
import { clamp } from './math.js';

class Game {
  constructor() {
    this.worldCanvas = document.getElementById('world');
    this.hudCanvas = document.getElementById('hud');
    this.renderer = new Renderer(this.worldCanvas);
    this.scene = this.renderer.scene;
    this.roads = new Roads(WORLD.seed);
    this.roads.buildMeshes(this.scene);
    this.world = new World(this.scene, this.roads, WORLD.seed);
    this.chase = new ChaseCamera(this.renderer.camera);
    this.input = new Input(this.hudCanvas);
    this.effects = new Effects(this.scene, this);
    this.audio = new Audio();
    this.vehicles = new Vehicles(this.scene, this.world, this);
    this.player = new Player(this);
    this.pedestrians = new Pedestrians(this, 32);
    this.traffic = new Traffic(this, 18);
    this.police = new Police(this);
    this.combat = new Combat(this);
    this.story = new Story(this);
    this.missions = new Missions(this);
    this.hud = new Hud(this, this.hudCanvas);
    this.mode = 'title';
    this.tick = 0;
    this.timeScale = 1;
    this.savedGame = readSave();
    this.shotFrozen = false;
    this.shotName = null;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.titleCamera = { x: 414, y: 7.5, z: 238, lookX: 392, lookY: 1.4, lookZ: 142 };
    this.chase.reset({ x: this.player.x, y: this.player.y + 0.4, z: this.player.z, heading: this.player.heading }, this.player.heading);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
    this.lastTime = 0;
  }

  resize() {
    this.width = Math.max(640, window.innerWidth);
    this.height = Math.max(360, window.innerHeight);
    this.renderer.resize(this.width, this.height);
    this.hud.resize(this.width, this.height);
  }

  placeTitleCamera() {
    const cam = this.renderer.camera;
    cam.position.set(this.titleCamera.x, this.titleCamera.y, this.titleCamera.z);
    cam.lookAt(this.titleCamera.lookX, this.titleCamera.lookY, this.titleCamera.lookZ);
    cam.fov = 60;
    cam.updateProjectionMatrix();
  }

  startNew() {
    this.audio.unlock();
    this.mode = 'playing';
    this.timeScale = 1;
    this.player.applySave({
      money: 850,
      rp: 0,
      deaths: 0,
      arrests: 0,
      currentWeapon: 'sidearm',
      weapons: {
        sidearm: { ammo: 12, reserve: 48 },
        smg: { ammo: 0, reserve: 0 },
        shotgun: { ammo: 0, reserve: 0 },
        rifle: { ammo: 0, reserve: 0 },
      },
    });
    this.player.weapons.smg.owned = false;
    this.player.weapons.shotgun.owned = false;
    this.player.weapons.rifle.owned = false;
    this.player.health = 100;
    this.player.armour = 15;
    this.player.dead = false;
    this.player.deadKind = null;
    this.player.respawnTimer = 0;
    this.player.setPosition(361.2, 152, -Math.PI / 2);
    this.missions.missionIndex = 0;
    this.missions.completed = [];
    this.missions.storyComplete = false;
    this.missions.active = null;
    this.missions.courier = null;
    this.missions.clearTargets();
    this.missions.courierDone = 0;
    this.police.clearWanted();
    this.story.clear();
    this.chase.lockedYaw = false;
    this.chase.setMode('foot');
    this.chase.yaw = -Math.PI / 2;
    this.chase.aimYaw = -Math.PI / 2;
    this.chase.reset({ x: 361.2, y: 0.4, z: 152, heading: -Math.PI / 2 }, -Math.PI / 2);
    this.hud.toast('WELCOME TO PALMSHORE · GOLDEN HOUR', '#ffc857', 4);
    this.story.say('marisol', 'Rook. You look like rent is due and the rent disagrees. Come see me at the Neon Conch.', 7);
    this.savedGame = null;
    document.getElementById('boot')?.classList.add('hidden');
    this.input.capturePointer = true;
  }

  continueGame() {
    const data = readSave();
    if (!data) return false;
    this.audio.unlock();
    applySave(this, data);
    this.mode = 'playing';
    this.timeScale = 1;
    this.player.dead = false;
    this.story.clear();
    this.chase.lockedYaw = false;
    this.chase.setMode('foot');
    this.chase.reset({ x: this.player.x, y: this.player.y + 0.4, z: this.player.z, heading: this.player.heading }, this.player.heading);
    this.hud.toast('SHIFT RESUMED · SLOT 01', '#6fe0c0', 3.4);
    this.savedGame = data;
    document.getElementById('boot')?.classList.add('hidden');
    this.input.capturePointer = true;
    return true;
  }

  saveGame() {
    if (writeSave(this, 1)) this.savedGame = readSave();
  }

  quitToTitle() {
    this.mode = 'title';
    this.timeScale = 1;
    this.story.clear();
    this.police.clearWanted();
    this.savedGame = readSave();
    this.input.capturePointer = false;
    document.exitPointerLock?.();
    this.placeTitleCamera();
  }

  togglePause() {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.input.capturePointer = false;
      document.exitPointerLock?.();
      this.audio.setEngine(0, false);
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      this.input.capturePointer = true;
    }
  }

  handleGlobalKeys() {
    const input = this.input;
    if (input.wasPressed('KeyM')) {
      this.audio.muted = !this.audio.muted;
      if (this.audio.master) this.audio.master.gain.value = this.audio.muted ? 0 : 0.5;
      this.hud.toast(this.audio.muted ? 'AUDIO MUTED' : 'AUDIO ON', '#8ed6e8', 1.6);
    }
    if (this.mode === 'title') {
      if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter')) this.startNew();
      if (input.wasPressed('KeyC') && hasSave()) this.continueGame();
      return;
    }
    if (this.mode === 'paused') {
      if (input.wasPressed('Escape') || input.wasPressed('KeyP')) this.togglePause();
      if (input.wasPressed('KeyS')) this.saveGame();
      if (input.wasPressed('KeyQ')) this.quitToTitle();
      return;
    }
    if (this.mode === 'playing') {
      if (input.wasPressed('Escape') || input.wasPressed('KeyP')) this.togglePause();
    }
    if ((this.mode === 'wasted' || this.mode === 'busted') && input.wasPressed('Enter')) {
      this.player.respawnTimer = 0;
    }
  }

  updateCamera(dt) {
    const player = this.player;
    if (player.car) {
      const car = player.car;
      this.chase.update(
        { x: car.x, y: car.mesh.position.y + 0.55, z: car.z, heading: car.heading },
        dt,
        { mode: 'car', speed: car.speed },
      );
    } else {
      this.chase.update(
        { x: player.x, y: player.y + 0.8, z: player.z, heading: player.heading },
        dt,
        { mode: 'foot', moving: player.moving, speed: player.speed },
      );
    }
  }

  step(dt) {
    const sim = dt * this.timeScale;
    this.tick += sim;
    this.player.update(sim, this.input);
    if (this.player.car) {
      this.player.x = this.player.car.x;
      this.player.z = this.player.car.z;
      if (this.player.car.wrecked) this.player.exitCar(true);
    }
    this.traffic.update(sim);
    this.police.update(sim);
    this.missions.update(sim);
    this.vehicles.update(sim);
    if (this.player.car) {
      this.player.x = this.player.car.x;
      this.player.z = this.player.car.z;
      this.player.y = this.player.car.mesh.position.y;
    }
    this.pedestrians.update(sim);
    this.combat.update(sim);
    this.effects.update(sim);
    this.story.update(dt);
    this.hud.update(dt);
    this.updateCamera(dt);
    this.renderer.update(this.player.car ? this.player.car : this.player, this.tick);
    this.roads.updateSignals(this.tick);
    this.world.update(this.tick);
    this.audio.setEngine(this.player.car ? this.player.car.speed : 0, !!this.player.car);
    this.audio.update(dt, this);
  }

  titleFrame(dt) {
    this.tick += dt * 0.35;
    this.traffic.update(dt);
    this.pedestrians.update(dt);
    this.effects.update(dt);
    this.hud.update(dt);
    this.roads.updateSignals(this.tick);
    this.world.update(this.tick);
    this.renderer.update({ x: 404, z: 186 }, this.tick);
    this.placeTitleCamera();
    this.audio.update(dt, this);
  }

  render() {
    this.renderer.render();
    this.hud.draw();
  }

  frame(dt) {
    const input = this.input;
    if (!this.shotFrozen && this.mode !== 'title') {
      const delta = input.consumeMouseDelta();
      if (delta.dx || delta.dy) this.chase.orbit(delta.dx, delta.dy);
    } else {
      input.consumeMouseDelta();
    }
    this.handleGlobalKeys();
    if (this.mode === 'title') {
      this.titleFrame(dt);
    } else if (this.mode === 'paused') {
      this.hud.update(dt);
      this.placePauseCamera();
    } else if (this.mode === 'wasted' || this.mode === 'busted') {
      this.player.update(dt, input);
      this.effects.update(dt);
      this.hud.update(dt);
      this.updateCamera(dt);
      this.renderer.update(this.player, this.tick);
    } else {
      this.step(dt);
    }
    this.render();
    input.endFrame();
  }

  placePauseCamera() {
    if (this.player.car) {
      const car = this.player.car;
      this.renderer.camera.position.set(car.x - Math.cos(car.heading) * 8, car.mesh.position.y + 3.4, car.z - Math.sin(car.heading) * 8);
      this.renderer.camera.lookAt(car.x, car.mesh.position.y + 1, car.z);
    } else {
      this.chase.update({ x: this.player.x, y: this.player.y + 0.8, z: this.player.z, heading: this.player.heading }, 1 / 60, { mode: 'foot', moving: false, speed: 0 });
    }
  }

  runShot(kind) {
    this.shotName = kind;
    document.getElementById('boot')?.classList.add('hidden');
    this.input.capturePointer = false;
    this.resize();
    prepareShot(this, kind);
    this.player.applySave(SHOT_SAVE);
    const ticks = this.shotTicks ?? 60;
    for (let i = 0; i < ticks; i += 1) this.step(1 / 60);
    if (this.onShotFreeze) this.onShotFreeze();
    this.shotFrozen = true;
    this.render();
    window.__PALMSHORE_READY__ = true;
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

function boot() {
  const game = new Game();
  window.__PALMSHORE_GAME__ = game;
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    game.runShot(shot);
    return;
  }
  document.getElementById('boot')?.classList.add('hidden');
  game.placeTitleCamera();
  game.render();
  let last = performance.now();
  const loop = (now) => {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    game.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

try {
  boot();
} catch (error) {
  window.__PALMSHORE_ERROR__ = error.stack ?? String(error);
  console.error(error);
  const bootEl = document.getElementById('boot');
  if (bootEl) {
    bootEl.innerHTML = `<div><div class="mark">PALMSHORE</div><div class="sub">ENGINE FAULT · ${String(error.message ?? error).toUpperCase()}</div></div>`;
  }
}

export { Game, CITY, GAME };
