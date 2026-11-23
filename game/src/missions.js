// The mission engine: start markers, steps, objectives, dialogue beats, goons, the chase car,
// heat on escape steps, deadlines, rewards and unlocks, plus the free-roam courier run. The
// story's words live in story.js; this file makes them happen.

import { MISSIONS, PALETTE, WEAPONS } from './config.js';
import { STORY } from './story.js';
import { makePerson } from './people.js';
import { createVehicle, stepVehicle } from './vehicles.js';
import { clamp, dist, wrapAngle } from './math.js';
import { streamOf } from './random.js';

const MISSION_LIST = STORY.missions;

function spotPoint(world, name, offset) {
  const place = world.landmarks[name] ?? world.landmarks.safehouse ?? { x: world.width / 2, y: world.height / 2 };
  const base = place.door ?? place;
  return { x: base.x + (offset?.x ?? 0), y: base.y + (offset?.y ?? 0) };
}

export function createMissions(world, seed) {
  const rng = streamOf(seed, 131);
  const state = {
    active: null,
    stepIndex: 0,
    step: null,
    marker: null,
    currentDialogue: null,
    sayQueue: [],
    sayAge: 0,
    result: null,
    completed: [],
    lastMissionId: null,
    startCooldown: 0,
    stepTimer: 0,
    waveTimer: 0,
    wave: 0,
    missionEnemies: [],
    targetCar: null,
    chaseTimer: 0,
    interactHint: null,
    ending: false,
    activity: {
      active: false,
      deliveries: 0,
      timeLeft: 0,
      marker: null,
      earned: 0,
      target: null,
    },
  };

  function missionAtStart(game) {
    return state.marker;
  }

  function availableMission() {
    return MISSION_LIST[state.completed.length] ?? null;
  }

  function beginDialogue(lines) {
    state.sayQueue = (lines ?? []).map(([who, line]) => ({ who, line }));
    state.sayAge = 0;
    state.currentDialogue = null;
    if (state.sayQueue.length) {
      const first = state.sayQueue.shift();
      state.currentDialogue = { who: first.who, line: first.line, age: 0 };
    }
  }

  function say(who, line) {
    state.sayQueue.push({ who, line });
    if (!state.currentDialogue) {
      const first = state.sayQueue.shift();
      state.currentDialogue = { who: first.who, line: first.line, age: 0 };
    }
  }

  function updateDialogue(dt) {
    if (!state.currentDialogue) {
      if (state.sayQueue.length) {
        const next = state.sayQueue.shift();
        state.currentDialogue = { who: next.who, line: next.line, age: 0 };
      }
      return;
    }
    state.currentDialogue.age += dt;
    const duration = 3.8 + Math.min(3, state.currentDialogue.line.length * 0.024);
    if (state.currentDialogue.age > duration) {
      if (state.sayQueue.length) {
        const next = state.sayQueue.shift();
        state.currentDialogue = { who: next.who, line: next.line, age: 0 };
      } else {
        state.currentDialogue = null;
      }
    }
  }

  function cleanEnemies(game) {
    for (const e of state.missionEnemies) {
      if (!e.dead) {
        e.removed = true;
      }
    }
    state.missionEnemies = [];
    game.enemies = (game.enemies ?? []).filter((e) => !e.removed);
  }

  function spawnGoon(game, x, y, opts = {}) {
    const person = makePerson(rng, {
      x,
      y,
      angle: rng.range(0, 6.28),
      kind: 'enemy',
      armed: true,
      gun: opts.boss ? 'shotgun' : rng.chance(0.25) ? 'smg' : 'pistol',
      health: opts.boss ? 300 : 85,
      shirt: opts.boss ? '#2a2622' : rng.pick(['#3d3a34', '#5c4a3c', '#2c3b3d', '#6b4034']),
      pants: '#2a2a2c',
      skin: rng.pick(PALETTE.skin),
      hair: rng.pick(PALETTE.hair),
      boss: opts.boss ?? false,
      accent: PALETTE.coralDeep,
      name: opts.boss ? 'VARGAS' : null,
    });
    person.shootCooldown = rng.range(0.4, 1.3);
    person.radius = 11;
    game.enemies.push(person);
    state.missionEnemies.push(person);
    return person;
  }

  function spawnRing(game, spot, count, opts = {}) {
    let placed = 0;
    for (let k = 0; k < count; k += 1) {
      const angle = (k / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const radius = opts.radius ?? rng.range(46, 104);
      let x = spot.x + Math.cos(angle) * radius;
      let y = spot.y + Math.sin(angle) * radius;
      for (let tries = 0; tries < 8; tries += 1) {
        const res = world.collideCircle(x, y, 12);
        if (!res.hit) break;
        x = spot.x + Math.cos(angle + tries * 0.8) * (radius + tries * 10);
        y = spot.y + Math.sin(angle + tries * 0.8) * (radius + tries * 10);
      }
      spawnGoon(game, x, y, { boss: opts.boss && k === 0 });
      placed += 1;
    }
    return placed;
  }

  function enterStep(game, index, extraSay) {
    cleanEnemies(game);
    state.stepIndex = index;
    const mission = state.active;
    const step = mission.steps[index];
    state.step = step;
    state.stepTimer = 0;
    state.waveTimer = 0;
    state.wave = 0;
    state.targetCar = null;
    state.chaseTimer = 0;
    const point = spotPoint(game.world, step.spot ?? mission.startSpot, step.offset);
    state.stepPoint = point;
    state.marker = {
      x: point.x,
      y: point.y,
      radius: step.radius ?? 40,
      label: step.label,
      kind: step.type,
      color: step.type === 'collect' ? PALETTE.tealLight : PALETTE.coral,
    };
    if (step.type === 'survive') state.marker.label = 'SURVIVE';
    if (step.type === 'steal') {
      const car = nearestLooseCar(game, game.player.x, game.player.y);
      state.marker.x = car ? car.x : game.player.x + 60;
      state.marker.y = car ? car.y : game.player.y + 60;
      state.marker.radius = 42;
    }
    if (step.type === 'chase') {
      const car = createVehicle({
        x: point.x + 20,
        y: point.y + 26,
        angle: Math.PI / 2,
        type: step.carType ?? 'coupe',
        color: PALETTE.coral,
        driver: 'target',
      });
      car.health = 260;
      car.maxHealth = 260;
      game.vehicles.push(car);
      state.targetCar = car;
      state.marker.x = car.x;
      state.marker.y = car.y;
    }
    if (step.type === 'kill') {
      spawnRing(game, point, step.enemies ?? 3, { boss: step.boss, radius: step.radius ? step.radius * 0.6 : 70 });
    }
    if (step.type === 'escape' && step.heat) {
      game.police.setWanted(step.heat, game);
    }
    const lines = [...(extraSay ?? []), ...(step.say ?? [])];
    beginDialogue(lines);
    game.hud?.notify(step.label.toUpperCase(), 'ink', 3.2);
    state.interactHint = null;
  }

  function nearestLooseCar(game, x, y) {
    let best = null;
    let bestD = 420;
    for (const car of game.vehicles) {
      if (car.removed || car.exploded || car.driver === 'ai' || car.driver === 'cop') continue;
      const d = dist(car.x, car.y, x, y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function start(id, game) {
    const mission = MISSION_LIST.find((m) => m.id === id) ?? availableMission();
    if (!mission) return false;
    state.active = mission;
    state.result = null;
    if (game.hud?.notifications) game.hud.notifications.length = 0;
    state.lastMissionId = mission.id;
    state.startCooldown = 0;
    cleanEnemies(game);
    game.missionResult = null;
    enterStep(game, 0, mission.intro);
    game.audio?.play('mission');
    game.hud?.notify(`MISSION STARTED · ${mission.title}`, 'gold', 4);
    return true;
  }

  function finish(game, passed, reason) {
    const mission = state.active;
    if (!mission) return;
    cleanEnemies(game);
    if (state.targetCar) {
      state.targetCar.driver = null;
    }
    state.marker = null;
    state.targetCar = null;
    state.active = null;
    state.currentDialogue = null;
    state.sayQueue = [];
    state.startCooldown = 6;
    if (passed) {
      if (!state.completed.includes(mission.id)) state.completed.push(mission.id);
      game.player.money += mission.reward;
      game.stats.earned = (game.stats.earned ?? 0) + mission.reward;
      game.stats.missions = state.completed.length;
      if (mission.unlock === 'pistol' || mission.unlock === 'shotgun' || mission.unlock === 'smg') {
        game.player.unlocked[mission.unlock] = true;
        game.player.weapons[mission.unlock].ammo += WEAPONS[mission.unlock].ammo * 2;
        game.player.weapon = mission.unlock;
      }
      if (mission.unlock === 'armour') {
        game.player.armour = 100;
      }
      state.result = {
        passed: true,
        title: mission.title,
        reward: mission.reward,
        unlock: mission.unlockLabel ?? null,
        timer: 0,
        missionId: mission.id,
      };
      game.missionResult = state.result;
      game.audio?.play('mission');
      game.hud?.notify('MISSION PASSED', 'gold', 4);
      if (mission.id === 'lastlight') state.ending = true;
      game.lastMissionOutro = mission.outro;
    } else {
      state.result = {
        passed: false,
        title: mission.title,
        reward: 0,
        reason: reason ?? 'The job fell apart.',
        timer: 0,
        missionId: mission.id,
      };
      game.missionResult = state.result;
      game.audio?.play('fail');
      game.hud?.notify('MISSION FAILED', 'coral', 4);
    }
  }

  function advance(game) {
    if (!state.active) return;
    if (state.stepIndex + 1 >= state.active.steps.length) {
      finish(game, true);
    } else {
      enterStep(game, state.stepIndex + 1);
      game.audio?.play('ui');
    }
  }

  function fail(game, reason) {
    if (state.active) finish(game, false, reason);
  }

  function updateTargetCar(game, dt) {
    const car = state.targetCar;
    const p = game.player;
    if (!car || car.removed || car.exploded) {
      if (state.step?.type === 'chase') {
        if (car) {
          car.driver = null;
        }
        state.chaseTimer += dt;
        if (state.chaseTimer > 0.8) advance(game);
      }
      return;
    }
    state.marker.x = car.x;
    state.marker.y = car.y;
    const away = Math.atan2(car.y - p.y, car.x - p.x);
    const road = world.roads.nearestRoadPoint(car.x, car.y);
    // Prefer an escape heading that stays on the grid.
    let desired = away;
    const candidates = [away, away + 0.5, away - 0.5, away + 1, away - 1, road.angle, road.angle + Math.PI];
    let bestScore = -Infinity;
    for (const a of candidates) {
      const px = car.x + Math.cos(a) * 90;
      const py = car.y + Math.sin(a) * 90;
      if (world.inWater(px, py)) continue;
      let score = Math.cos(wrapAngle(a - away)) * 2;
      if (world.roads.isOnRoad(px, py)) score += 1.5;
      score -= Math.abs(Math.sin(a - away)) * 0.2;
      if (score > bestScore) {
        bestScore = score;
        desired = a;
      }
    }
    const diff = wrapAngle(desired - car.angle);
    let throttle = 1;
    let steer = clamp(diff * 2, -1, 1);
    let handbrake = false;
    if (Math.abs(diff) > 1.8) {
      throttle = 0.2;
      steer = clamp(diff * 1.5, -1, 1);
      handbrake = true;
    }
    const speed = Math.hypot(car.vx, car.vy);
    if (speed < 16 && state.chaseTimer > 0.4) {
      throttle = -1;
      steer = -steer;
    }
    if (speed < 30) state.chaseTimer += dt;
    else state.chaseTimer = 0;
    stepVehicle(car, dt, { throttle, steer, handbrake }, game);
    if (car.burning || (speed < 22 && state.chaseTimer > 1.8) || car.health < 55) {
      car.driver = null;
      car.burning = false;
      car.health = Math.min(car.health, 55);
      car.vx *= 0.4;
      car.vy *= 0.4;
    }
  }

  function updateEnemies(game, dt) {
    const p = game.player;
    for (const e of state.missionEnemies) {
      if (!e || e.removed) continue;
      if (e.dead) {
        e.deadTimer += dt;
        continue;
      }
      e.hurtFlash = Math.max(0, e.hurtFlash - dt * 4);
      e.shootCooldown -= dt;
      const tx = p.mode === 'car' && p.car ? p.car.x : p.x;
      const ty = p.mode === 'car' && p.car ? p.car.y : p.y;
      const d = dist(e.x, e.y, tx, ty);
      const speed = e.boss ? 56 : 78;
      if (d > (e.boss ? 200 : 155) && d < 760) {
        const a = Math.atan2(ty - e.y, tx - e.x);
        const nx = e.x + Math.cos(a) * speed * dt;
        const ny = e.y + Math.sin(a) * speed * dt;
        const res = game.world.collideCircle(nx, ny, e.radius ?? 10);
        if (!res.hit) {
          e.x = nx;
          e.y = ny;
          e.angle = a;
          e.phase += dt * 9;
          e.walk = speed;
        }
      } else {
        e.walk = 0;
        e.angle = Math.atan2(ty - e.y, tx - e.x);
      }
      if (d < (e.boss ? 300 : 340) && e.shootCooldown <= 0) {
        e.shootCooldown = e.boss ? 0.75 : 0.95 + Math.random() * 0.5;
        const gun = e.gun ?? 'pistol';
        game.combat.shootWeapon(game, gun, e.x + Math.cos(e.angle) * 14, e.y + Math.sin(e.angle) * 14, e.angle + (Math.random() - 0.5) * 0.16, 'enemy');
      }
    }
  }

  function updateStep(game, dt) {
    const step = state.step;
    if (!step || !state.active) return;
    const p = game.player;
    const marker = state.marker;
    if (step.type === 'goto') {
      if (marker && dist(p.x, p.y, marker.x, marker.y) < marker.radius) {
        if (!step.needCar || p.mode === 'car') advance(game);
      }
    } else if (step.type === 'steal') {
      if (p.mode === 'car' && p.car) {
        advance(game);
      }
    } else if (step.type === 'kill') {
      const alive = state.missionEnemies.filter((e) => !e.dead);
      if (state.missionEnemies.length > 0 && alive.length === 0) advance(game);
    } else if (step.type === 'collect') {
      if (marker && dist(p.x, p.y, marker.x, marker.y) < marker.radius) {
        game.effects?.ring(marker.x, marker.y, 60, '#f4dfa4');
        game.effects?.text(marker.x, marker.y - 30, 'SECURED', '#f7dfa0');
        game.audio?.play('pickup', marker.x, marker.y);
        advance(game);
      }
    } else if (step.type === 'chase') {
      const car = state.targetCar;
      if (!car || car.removed || car.exploded || car.driver === null) {
        state.chaseTimer += dt;
        if (car) {
          car.driver = null;
          car.vx *= 0.5;
          car.vy *= 0.5;
          state.marker.x = car.x;
          state.marker.y = car.y;
        }
        if (state.chaseTimer > 1.4) advance(game);
      } else {
        updateTargetCar(game, dt);
      }
    } else if (step.type === 'escape') {
      if (game.police.level === 0 && (!step.spot || dist(p.x, p.y, marker.x, marker.y) < marker.radius)) {
        advance(game);
      }
    } else if (step.type === 'survive') {
      state.stepTimer += dt;
      state.waveTimer -= dt;
      if (state.waveTimer <= 0 && state.stepTimer < step.time) {
        state.waveTimer = 9;
        state.wave += 1;
        spawnRing(game, state.stepPoint, 2, { radius: 150 });
        game.hud?.notify(`WAVE ${state.wave}`, 'coral', 2);
      }
      const remaining = Math.max(0, step.time - state.stepTimer);
      state.marker.label = `SURVIVE ${Math.ceil(remaining)}s`;
      if (state.stepTimer >= step.time) advance(game);
    }
    if (state.marker) {
      state.marker.label = step.type === 'survive' ? state.marker.label : step.label;
    }
  }

  // ---- the courier activity ---------------------------------------------------------------
  const COURIER_SPOTS = ['hospital', 'police', 'park', 'coralArms', 'nautilus', 'marina', 'safehouse', 'pier9', 'sunray'];
  const activity = state.activity;

  function nextDelivery(game) {
    const name = COURIER_SPOTS[(state.completed.length + activity.deliveries * 3 + Math.floor(Math.random() * 3)) % COURIER_SPOTS.length];
    const point = spotPoint(game.world, name);
    const base = game.world.landmarks[name]?.door ?? point;
    let spot = null;
    for (const radius of [48, 68, 88]) {
      for (let k = 0; k < 12 && !spot; k += 1) {
        const angle = (k / 12) * Math.PI * 2 + state.completed.length * 0.7;
        const x = base.x + Math.cos(angle) * radius;
        const y = base.y + Math.sin(angle) * radius;
        if (!game.world.collideCircle(x, y, 13).hit) spot = { x, y };
      }
      if (spot) break;
    }
    activity.marker = {
      x: spot?.x ?? point.x,
      y: spot?.y ?? point.y,
      radius: 36,
      label: 'DELIVERY',
      kind: 'delivery',
      color: PALETTE.tealLight,
    };
    activity.target = name;
  }

  function startActivity(game) {
    if (activity.active || state.active) return false;
    activity.active = true;
    if (game.hud?.notifications) game.hud.notifications.length = 0;
    activity.deliveries = 3;
    activity.timeLeft = STORY.activity.seconds;
    activity.earned = 0;
    nextDelivery(game);
    game.audio?.play('ui');
    game.hud?.notify('COURIER RUN · THREE DROPS', 'teal', 4);
    return true;
  }

  function updateActivity(game, dt) {
    if (!activity.active) return;
    activity.timeLeft -= dt;
    const p = game.player;
    if (activity.marker && dist(p.x, p.y, activity.marker.x, activity.marker.y) < activity.marker.radius) {
      activity.deliveries -= 1;
      activity.earned += STORY.activity.perDrop;
      p.money += STORY.activity.perDrop;
      game.stats.earned = (game.stats.earned ?? 0) + STORY.activity.perDrop;
      game.effects?.ring(activity.marker.x, activity.marker.y, 50, '#9ad8cb');
      game.effects?.text(activity.marker.x, activity.marker.y - 24, `+$${STORY.activity.perDrop}`, '#d6f2e8');
      game.audio?.play('pickup', p.x, p.y);
      if (activity.deliveries <= 0) {
        activity.active = false;
        activity.marker = null;
        const total = activity.earned + STORY.activity.bonus;
        p.money += STORY.activity.bonus;
        game.stats.earned += STORY.activity.bonus;
        game.stats.deliveries = (game.stats.deliveries ?? 0) + 3;
        state.result = {
          passed: true,
          title: 'COURIER RUN',
          reward: total,
          unlock: 'THREE PACKAGES DELIVERED',
          timer: 0,
          missionId: null,
        };
        game.missionResult = state.result;
        game.audio?.play('mission');
        return;
      }
      nextDelivery(game);
    }
    if (activity.timeLeft <= 0) {
      activity.active = false;
      activity.marker = null;
      state.result = { passed: false, title: 'COURIER RUN', reward: 0, reason: 'The clock ran out.', timer: 0, missionId: null };
      game.missionResult = state.result;
      game.audio?.play('fail');
    }
  }

  function update(game, dt) {
    if (state.startCooldown > 0) state.startCooldown -= dt;
    updateDialogue(dt);
    updateEnemies(game, dt);
    if (state.result) {
      state.result.timer += dt;
      return;
    }
    if (state.active) {
      updateStep(game, dt);
      state.interactHint = null;
      return;
    }
    updateActivity(game, dt);
    const p = game.player;
    const mission = availableMission();
    const startPoint = mission ? spotPoint(world, mission.startSpot) : null;
    if (mission && startPoint) {
      state.marker = {
        x: startPoint.x,
        y: startPoint.y,
        radius: MISSIONS.markerRadius + 10,
        label: 'START JOB',
        kind: 'start',
        color: PALETTE.coral,
        mission: mission.id,
      };
      const near = dist(p.x, p.y, startPoint.x, startPoint.y) < MISSIONS.markerRadius + 16;
      if (near) {
        state.interactHint = `E  START “${mission.title}”`;
        if (game.input.pressed('KeyE') && state.startCooldown <= 0) start(mission.id, game);
      } else {
        state.interactHint = null;
      }
    } else {
      state.marker = activity.active ? activity.marker : null;
      state.interactHint = null;
    }
    if (activity.active) state.marker = activity.marker;
    const courier = world.landmarks.courier;
    if (!activity.active && !state.active && courier) {
      if (dist(p.x, p.y, courier.x, courier.y) < 56) {
        state.interactHint = 'E  COURIER RUN';
        if (game.input.pressed('KeyE')) startActivity(game);
      }
    }
  }

  /** Stage a mission banner and marker for a screenshot, without spawning its logic. */
  function stage(id, stepIndex, game) {
    const mission = MISSION_LIST.find((m) => m.id === id) ?? MISSION_LIST[0];
    state.active = mission;
    state.stepIndex = stepIndex;
    state.step = mission.steps[stepIndex];
    const point = spotPoint(world, state.step.spot ?? mission.startSpot, state.step.offset);
    state.stepPoint = point;
    state.marker = {
      x: point.x,
      y: point.y,
      radius: state.step.radius ?? 40,
      label: state.step.label,
      kind: state.step.type,
      color: PALETTE.coral,
    };
    state.currentDialogue = null;
    state.sayQueue = [];
    state.result = null;
    return state.marker;
  }

  function stageDialogue(who, line) {
    state.currentDialogue = { who, line, age: 1.4 };
  }

  function abandon() {
    if (!state.active) return;
    state.active = null;
    state.marker = null;
    state.currentDialogue = null;
    state.targetCar = null;
    state.startCooldown = 4;
  }

  return {
    get active() {
      return state.active;
    },
    get step() {
      return state.step;
    },
    get stepIndex() {
      return state.stepIndex;
    },
    get marker() {
      return state.marker;
    },
    get currentDialogue() {
      return state.currentDialogue;
    },
    get result() {
      return state.result;
    },
    get ending() {
      return state.ending;
    },
    get interactHint() {
      return state.interactHint;
    },
    get startCooldown() {
      return state.startCooldown;
    },
    get activity() {
      return state.activity;
    },
    get blips() {
      const out = [];
      if (world.landmarks.courier) {
        out.push({ x: world.landmarks.courier.x, y: world.landmarks.courier.y, color: PALETTE.tealLight });
      }
      return out;
    },
    update,
    start,
    stage,
    stageDialogue,
    fail,
    abandon,
    resetCooldown() {
      state.startCooldown = 0;
    },
    startActivity,
    availableMission,
    indexOfActive() {
      return state.active ? MISSION_LIST.findIndex((m) => m.id === state.active.id) : -1;
    },
    completedCount() {
      return state.completed.length;
    },
    completed() {
      return state.completed;
    },
    lastMissionId() {
      return state.lastMissionId;
    },
    objectiveText() {
      if (!state.step) return '';
      const p = world.landmarks;
      let suffix = '';
      if (state.step.type === 'survive') return `Hold the pier · ${state.marker?.label ?? ''}`;
      return state.step.label + suffix;
    },
    missionTitle() {
      return state.active?.title ?? '';
    },
    lastOutro() {
      return state.active?.outro ?? [];
    },
    clearResult() {
      state.result = null;
    },
    restoreCompleted(list) {
      state.completed = Array.isArray(list) ? list.filter((id) => MISSION_LIST.some((m) => m.id === id)) : [];
    },
  };
}
