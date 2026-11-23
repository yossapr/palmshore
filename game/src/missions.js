// Mission flow and free-roam activities: markers, the dialogue box, stage checks, the Gulls, the
// courier run, shop counters and the objective the HUD and minimap point at. Story data lives in
// story.js; this file turns it into play.

import { MISSIONS, CHARACTERS } from './story.js';
import { PLACES } from './world.js';
import { createPerson } from './people.js';
import { npcFire } from './combat.js';
import { addHeat } from './police.js';
import { spawnVehicle } from './vehicles.js';
import { giveWeapon } from './player.js';
import { saveProgress } from './save.js';
import { WEAPONS } from './config.js';
import { hasLineOfSight } from './world.js';

const COURIER_START = { x: 2606, y: 2480, label: 'Courier dispatch' };
const COURIER_POINTS = [PLACES.pawn, PLACES.clinic, PLACES.ammo, PLACES.park, PLACES.strip[0], PLACES.strip[1], PLACES.diner, PLACES.marina];
const SHOP_RADIUS = 74;

export function initMissions(game) {
  game.missionIndex = 0;
  game.mission = null;
  game.dialogue = null;
  game.markers = [];
  game.objective = null;
  game.missionPassed = null;
  game.activity = { active: false, stage: 0, timer: 0, points: [], cooldown: 0 };
  game.storyDone = false;
}

function speakerOf(key) {
  return CHARACTERS[key] ?? { name: key, color: '#f2c14e' };
}

function queueDialogue(game, lines, onDone = null) {
  if (!lines || lines.length === 0) {
    if (onDone) onDone();
    return;
  }
  game.dialogue = {
    lines: lines.map((entry) => ({ speaker: speakerOf(entry.speaker), text: entry.text })),
    index: 0,
    reveal: 0,
    onDone,
  };
}

export function updateDialogue(game, dt, input) {
  const dialogue = game.dialogue;
  if (!dialogue) return false;
  const current = dialogue.lines[dialogue.index];
  dialogue.reveal = Math.min(current.text.length, dialogue.reveal + dt * 52);
  const advance = input.takeAny('Space', 'Enter', 'KeyE') || input.takeClick();
  if (advance) {
    if (dialogue.reveal < current.text.length - 1) {
      dialogue.reveal = current.text.length;
    } else if (dialogue.index < dialogue.lines.length - 1) {
      dialogue.index += 1;
      dialogue.reveal = 0;
      game.audio.ui();
    } else {
      const done = dialogue.onDone;
      game.dialogue = null;
      game.audio.ui();
      if (done) done();
    }
  }
  return true;
}

export function startStoryMission(game, index) {
  const def = MISSIONS[index];
  if (!def) return;
  game.mission = {
    def,
    no: index + 1,
    stage: 0,
    phase: 'intro',
    timer: 0,
    car: null,
    enemies: [],
    points: [],
    visited: [],
    spawnPoint: def.start,
  };
  game.audio.mission();
  game.notify(`MISSION STARTED — ${def.title}`, 3.4, 'mission');
  queueDialogue(game, def.intro, () => beginStage(game, 0));
}

function clearMissionEnemies(game) {
  if (!game.mission) return;
  const ids = new Set(game.mission.enemies.map((enemy) => enemy.id));
  game.people = game.people.filter((person) => !ids.has(person.id));
  game.mission.enemies = [];
}

export function failMission(game, reason = 'Mission failed') {
  if (!game.mission) return;
  clearMissionEnemies(game);
  if (game.mission.car && game.mission.car.mission) game.mission.car.mission = null;
  game.mission = null;
  game.objective = null;
  game.boss = null;
  game.notify(reason.toUpperCase(), 4, 'danger');
  game.audio.fail();
}

function spendAmmoPickup(game) {
  game.notify('Envelope collected', 1.8);
  game.audio.cash();
}

function beginStage(game, index) {
  const mission = game.mission;
  if (!mission) return;
  const stage = mission.def.stages[index];
  mission.stage = index;
  mission.timer = 0;
  mission.phase = 'active';
  mission.stageLabel = stage.label;
  game.audio.ui();
  if (stage.spawnCar) {
    if (mission.car) {
      const position = game.vehicles.indexOf(mission.car);
      if (position >= 0) game.vehicles.splice(position, 1);
    }
    // Clear a little room in the parking lot so the target car is never buried.
    for (let i = game.vehicles.length - 1; i >= 0; i -= 1) {
      const car = game.vehicles[i];
      if (car.parked && Math.hypot(car.x - stage.spawnCar.x, car.y - stage.spawnCar.y) < 62) game.vehicles.splice(i, 1);
    }
    mission.car = spawnVehicle(game, stage.spawnCar.type, stage.spawnCar.x, stage.spawnCar.y, stage.spawnCar.angle, {
      color: stage.spawnCar.color, label: stage.spawnCar.label, mission: mission.def.id, parked: true,
    });
    mission.car.health = mission.car.maxHealth;
    mission.spawnPoint = { x: stage.spawnCar.x, y: stage.spawnCar.y };
  }
  if (stage.kind === 'kill') {
    mission.enemies = [];
    for (const spawn of stage.spawn) {
      const enemy = createPerson(game, {
        team: 'gang', x: spawn.x, y: spawn.y, health: spawn.health ?? 90, armed: true,
        weapon: spawn.weapon ?? 'pistol', speed: 84, missionTag: mission.def.id,
      });
      enemy.state = 'chase';
      enemy.home = { x: spawn.x, y: spawn.y };
      enemy.boss = !!spawn.boss;
      enemy.name = spawn.name ?? null;
      if (enemy.boss) {
        enemy.radius = 13;
        enemy.appearance.shirt = '#e6dcc2';
        game.boss = { name: enemy.name, health: enemy.health, max: enemy.health, person: enemy };
      }
      mission.enemies.push(enemy);
    }
    mission.totalEnemies = stage.spawn.length;
  }
  if (stage.kind === 'collect') {
    mission.points = stage.points.map((point, i) => ({ ...point, done: false, index: i }));
    mission.visited = stage.points.map(() => false);
  }
  if (stage.kind === 'escape') {
    addHeat(game, stage.heat ?? 90, 'the heat is on');
  }
  if (stage.taunt) queueDialogue(game, [stage.taunt]);
  game.notify(stage.label, 2.6, 'mission');
}

function completeStage(game) {
  const mission = game.mission;
  if (!mission) return;
  mission.stage += 1;
  if (mission.stage >= mission.def.stages.length) {
    completeMission(game);
  } else {
    beginStage(game, mission.stage);
  }
}

function completeMission(game) {
  const mission = game.mission;
  if (!mission) return;
  const def = mission.def;
  clearMissionEnemies(game);
  game.boss = null;
  if (mission.car) {
    mission.car.mission = null;
    mission.car.label = null;
  }
  game.player.cash += def.reward;
  game.missionIndex = Math.min(MISSIONS.length, mission.no);
  game.mission = null;
  game.stats.missions += 1;
  if (def.unlocks?.weapon) giveWeapon(game, def.unlocks.weapon, def.unlocks.ammo ?? 20);
  if (def.unlocks?.armour) game.player.armour = 100;
  game.missionPassed = { title: def.title, reward: def.reward, timer: 6.5 };
  game.audio.mission();
  game.notify(`MISSION PASSED — ${def.title}  ·  +$${def.reward}`, 5, 'mission');
  if (def.end) game.storyDone = true;
  queueDialogue(game, def.outro, () => {
    saveProgress(game);
    if (def.end) game.showEndCard();
  });
}

export function updateMissions(game, dt, input) {
  // Markers are rebuilt every frame; the nearest one under the reticle becomes the prompt.
  game.markers = [];
  game.markerPrompt = null;
  game.markerFocus = null;
  if (game.activity.cooldown > 0) game.activity.cooldown -= dt;
  if (game.missionPassed) {
    game.missionPassed.timer -= dt;
    if (game.missionPassed.timer <= 0) game.missionPassed = null;
  }

  if (game.mission) {
    updateMission(game, dt);
  } else if (!game.storyDone && game.missionIndex < MISSIONS.length) {
    const def = MISSIONS[game.missionIndex];
    game.markers.push({
      x: def.start.x, y: def.start.y, kind: 'mission', label: def.startLabel,
      action: () => startStoryMission(game, game.missionIndex), prompt: `Start “${def.title}”`,
    });
  }

  if (!game.mission && !game.storyDone) {
    game.markers.push({
      x: COURIER_START.x, y: COURIER_START.y, kind: 'activity', label: 'Sunray Couriers',
      action: () => startCourier(game), prompt: 'Take a courier run',
    });
  }
  game.markers.push(
    { x: PLACES.ammo.x, y: PLACES.ammo.y, kind: 'shop', label: 'Dockside Sporting', action: () => buyAmmo(game), prompt: 'Buy ammo & armour' },
    { x: PLACES.clinic.x, y: PLACES.clinic.y, kind: 'shop', label: 'Sunny Palms Clinic', action: () => healAtClinic(game), prompt: 'Treatment ($100)' },
    { x: PLACES.diner.x, y: PLACES.diner.y, kind: 'shop', label: 'Sunray Diner', action: () => eatAtDiner(game), prompt: 'Eat ($40)' },
    { x: PLACES.pawn.x, y: PLACES.pawn.y, kind: 'shop', label: "Sonny's Pawn", action: () => armourAtPawn(game), prompt: 'Buy armour ($200)' },
  );

  const player = game.player;
  let nearest = null;
  let nearestDistance = 78;
  for (const marker of game.markers) {
    const distance = Math.hypot(marker.x - player.x, marker.y - player.y);
    marker.distance = distance;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = marker;
    }
  }
  if (nearest && nearest.kind !== 'shop') {
    game.markerPrompt = { key: 'E', text: nearest.prompt };
  } else if (nearest && nearest.distance < SHOP_RADIUS) {
    game.markerPrompt = { key: 'E', text: nearest.prompt };
  }
  game.markerFocus = nearest;

  updateActivity(game, dt);
  updateMissionEnemies(game, dt);
}

function updateMission(game, dt) {
  const mission = game.mission;
  if (!mission || mission.phase !== 'active') return;
  const stage = mission.def.stages[mission.stage];
  if (!stage) return;
  const player = game.player;
  mission.timer += dt;
  let blipX = stage.at?.x ?? null;
  let blipY = stage.at?.y ?? null;
  if (stage.kind === 'steal') {
    if (mission.car && mission.car.exploded) {
      mission.car = null;
    }
    if (!mission.car) {
      const spawn = stage.spawnCar;
      mission.car = spawnVehicle(game, spawn.type, spawn.x, spawn.y, spawn.angle, {
        color: spawn.color, label: spawn.label, mission: mission.def.id, parked: true,
      });
      mission.car.health = mission.car.maxHealth;
      game.notify('The car was wrecked — another one is waiting', 3);
    }
    blipX = mission.car.x;
    blipY = mission.car.y;
    if (player.inCar && player.inCar === mission.car) completeStage(game);
  } else if (stage.kind === 'goto') {
    if (Math.hypot(player.x - stage.at.x, player.y - stage.at.y) < (stage.radius ?? 70)) completeStage(game);
  } else if (stage.kind === 'drive') {
    if (player.inCar) {
      if (player.inCar.exploded) {
        game.notify('The delivery car is wrecked', 3, 'danger');
      } else if (Math.hypot(player.inCar.x - stage.at.x, player.inCar.y - stage.at.y) < (stage.radius ?? 100)) {
        completeStage(game);
      }
    }
  } else if (stage.kind === 'collect') {
    const point = mission.points.find((entry) => !entry.done);
    if (point) {
      blipX = point.x;
      blipY = point.y;
      if (Math.hypot(player.x - point.x, player.y - point.y) < (stage.radius ?? 58)) {
        point.done = true;
        spendAmmoPickup(game);
        if (mission.points.every((entry) => entry.done)) {
          completeStage(game);
        } else {
          game.notify(mission.def.stages[mission.stage].label, 1.8);
        }
      }
    }
  } else if (stage.kind === 'kill') {
    const alive = mission.enemies.filter((enemy) => !enemy.dead);
    if (alive.length > 0) {
      let closest = alive[0];
      let best = Infinity;
      for (const enemy of alive) {
        const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (d < best) {
          best = d;
          closest = enemy;
        }
      }
      blipX = closest.x;
      blipY = closest.y;
      game.objectiveExtra = `${mission.totalEnemies - alive.length}/${mission.totalEnemies} down`;
    } else {
      completeStage(game);
    }
  } else if (stage.kind === 'escape') {
    blipX = null;
    blipY = null;
    if (game.wanted.level === 0 && game.wanted.heat < 1) {
      game.objectiveExtra = null;
      completeStage(game);
    }
  }

  if (!game.mission) return;
  const current = game.mission.def.stages[game.mission.stage];
  if (!current) return;
  game.objective = {
    mission: game.mission,
    title: game.mission.def.title,
    label: current.label,
    hint: current.hint ?? null,
    extra: game.objectiveExtra ?? null,
    x: blipX,
    y: blipY,
    number: game.mission.no,
    distance: blipX !== null ? Math.hypot(blipX - player.x, blipY - player.y) : null,
  };
}

function updateMissionEnemies(game, dt) {
  const mission = game.mission;
  if (!mission) return;
  const player = game.player;
  for (const enemy of mission.enemies) {
    if (enemy.dead) continue;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    const target = player.inCar ?? player;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const los = hasLineOfSight(game.world, enemy.x, enemy.y, target.x, target.y);
    if (distance > 820) {
      // Hold the ground they were posted on rather than chase across the whole city.
      const home = enemy.home ?? { x: enemy.x, y: enemy.y };
      const homeAngle = Math.atan2(home.y - enemy.y, home.x - enemy.x);
      if (Math.hypot(home.x - enemy.x, home.y - enemy.y) > 40) {
        enemy.x += Math.cos(homeAngle) * 60 * dt;
        enemy.y += Math.sin(homeAngle) * 60 * dt;
        enemy.angle = homeAngle;
      }
      continue;
    }
    if (distance > 150) {
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;
      enemy.angle = angle;
      enemy.walkPhase += dt * 10;
    } else {
      enemy.angle = angle;
    }
    if (los && distance < 460) {
      npcFire(game, enemy, target.x + (game.rand() - 0.5) * 22, target.y + (game.rand() - 0.5) * 22, 0.14);
    }
    if (enemy.boss) {
      game.boss = { name: enemy.name ?? 'BRASSLINE', health: Math.max(0, enemy.health), max: enemy.maxHealth, person: enemy };
    }
    // Keep the gang off the rooftops.
    if (game.world.buildings.some((b) => enemy.x > b.x - 6 && enemy.x < b.x + b.w + 6 && enemy.y > b.y - 6 && enemy.y < b.y + b.h + 6)) {
      enemy.x -= Math.cos(angle) * 40 * dt;
      enemy.y -= Math.sin(angle) * 40 * dt;
    }
  }
}

function startCourier(game) {
  const activity = game.activity;
  if (activity.active || game.mission) return;
  const pool = [...COURIER_POINTS];
  const points = [];
  while (points.length < 3 && pool.length > 0) {
    const index = Math.floor(game.rand() * pool.length);
    points.push({ ...pool.splice(index, 1)[0], done: false });
  }
  activity.active = true;
  activity.stage = 0;
  activity.points = points;
  activity.timer = 100;
  game.notify('COURIER RUN — three drops, 100 seconds', 3.2, 'mission');
  game.audio.mission();
}

function updateActivity(game, dt) {
  const activity = game.activity;
  if (!activity.active) return;
  activity.timer -= dt;
  const player = game.player;
  const point = activity.points[activity.stage];
  if (!point) {
    finishCourier(game, false);
    return;
  }
  if (activity.timer <= 0) {
    finishCourier(game, false);
    return;
  }
  if (Math.hypot(player.x - point.x, player.y - point.y) < 56) {
    point.done = true;
    activity.stage += 1;
    player.cash += 140;
    game.audio.cash();
    game.notify('Drop delivered  ·  +$140', 2);
    if (activity.stage >= activity.points.length) {
      finishCourier(game, true);
      return;
    }
  }
  if (!game.mission) {
    game.activityObjective = {
      label: `Courier drop ${activity.stage + 1} of ${activity.points.length}`,
      x: point.x,
      y: point.y,
      timer: activity.timer,
      distance: Math.hypot(point.x - player.x, point.y - player.y),
    };
  }
}

function finishCourier(game, success) {
  const activity = game.activity;
  if (success) {
    game.player.cash += 250;
    game.notify('COURIER RUN COMPLETE  ·  +$250', 3.4, 'mission');
    game.audio.mission();
    game.stats.deliveries += 3;
  } else {
    game.notify('Courier run failed', 3, 'danger');
    game.audio.fail();
  }
  activity.active = false;
  activity.stage = 0;
  activity.points = [];
  activity.timer = 0;
  activity.cooldown = 3;
  game.activityObjective = null;
}

function buyAmmo(game) {
  const player = game.player;
  if (player.cash < 120) {
    game.notify('Ammo costs $120 — come back with cash', 2.6);
    return;
  }
  player.cash -= 120;
  player.owned.pistol = true;
  player.ammo.pistol = Math.min(WEAPONS.pistol.ammoMax, player.ammo.pistol + 48);
  if (player.owned.shotgun) player.ammo.shotgun = Math.min(WEAPONS.shotgun.ammoMax, player.ammo.shotgun + 10);
  if (player.owned.smg) player.ammo.smg = Math.min(WEAPONS.smg.ammoMax, player.ammo.smg + 60);
  game.notify('Ammo restocked', 2);
  game.audio.cash();
}

function healAtClinic(game) {
  const player = game.player;
  if (player.health >= 100 && player.armour >= 100) {
    game.notify('You are already in one piece', 2);
    return;
  }
  if (player.cash < 100) {
    game.notify('Treatment costs $100', 2.4);
    return;
  }
  player.cash -= 100;
  player.health = 100;
  player.armour = Math.min(100, player.armour + 30);
  game.notify('Patched up  ·  health restored', 2);
  game.audio.pickup();
}

function eatAtDiner(game) {
  const player = game.player;
  if (player.health >= 100) {
    game.notify('You are not hungry', 2);
    return;
  }
  if (player.cash < 40) {
    game.notify('A plate costs $40', 2.2);
    return;
  }
  player.cash -= 40;
  player.health = Math.min(100, player.health + 45);
  game.notify('Hot plate, cold soda  ·  +45 health', 2.2);
  game.audio.pickup();
}

function armourAtPawn(game) {
  const player = game.player;
  if (player.armour >= 90) {
    game.notify('Your vest is already sound', 2);
    return;
  }
  if (player.cash < 200) {
    game.notify('A vest costs $200', 2.2);
    return;
  }
  player.cash -= 200;
  player.armour = 100;
  game.notify('Armour fitted', 2);
  game.audio.pickup();
}

export function tryInteract(game) {
  const player = game.player;
  let best = null;
  let bestDistance = 86;
  for (const marker of game.markers) {
    const distance = Math.hypot(marker.x - player.x, marker.y - player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = marker;
    }
  }
  if (!best) {
    game.notify('Nothing to use here', 1.6);
    return false;
  }
  best.action();
  return true;
}

/** Everything the minimap and HUD draw as a marker: story starts, the courier, shops, objectives. */
export function missionBlips(game) {
  const blips = [];
  for (const marker of game.markers) {
    if (marker.kind === 'shop') continue;
    if (marker.kind === 'mission') blips.push({ x: marker.x, y: marker.y, kind: 'mission' });
    else blips.push({ x: marker.x, y: marker.y, kind: 'activity' });
  }
  if (game.objective?.x != null) blips.push({ x: game.objective.x, y: game.objective.y, kind: 'objective' });
  if (game.activity.active) {
    const point = game.activity.points[game.activity.stage];
    if (point) blips.push({ x: point.x, y: point.y, kind: 'activity' });
  }
  return blips;
}
