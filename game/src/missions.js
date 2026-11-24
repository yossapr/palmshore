// Five story jobs, the courier activity, markers and the objective state machine that
// the mission card reads. No cutscenes: the city keeps moving around the dialogue.

import { WORLD } from './config.js';
import { TAU, clamp, dist } from './math.js';

const SPOTS = {
  fixer: { x: 362.6, z: 148 },
  sunfade: { x: 362.6, z: 141 },
  neon: { x: 425.4, z: 152 },
  mango: { x: 362.6, z: 210 },
  seaglass: { x: 425.4, z: 214 },
  pawn: { x: 362.6, z: 92 },
  marina: { x: 362.6, z: 278 },
  kestrel: { x: 425.2, z: 96 },
  lantana: { x: 52.5, z: 208 },
  regent: { x: 438.4, z: 158 },
  courier1: { x: 236, z: 104 },
  courier2: { x: 448, z: 250 },
  courier3: { x: 52, z: 252 },
};

export const MISSIONS = [
  {
    id: 0,
    title: 'SUNFADE SHAKEDOWN',
    fixer: 'marisol',
    accent: '#ffc857',
    intro: [
      ['marisol', 'Rook. You look like a man with rent due and no plan. I have both.'],
      ['marisol', 'The clerk at Sunfade is skimming my float. Go remind him whose name is on the awning.'],
    ],
    stages: [
      { kind: 'goto', text: 'Meet Marisol outside Sunfade Liquor.', next: 'Then lean on the clerk.', marker: 'sunfade', radius: 4 },
      { kind: 'intimidate', text: 'Lean on the clerk behind the counter.', next: 'Then lose the cruiser.', marker: 'sunfade', radius: 3, clerk: true, setWanted: 0.9 },
      { kind: 'escape', text: 'Lose the nosy cruiser.', next: 'Return to Marisol at the Neon Conch.', wanted: 1, say: [['dispatch', 'All units, disturbance at Sunfade Liquor. Code two.']] },
      { kind: 'goto', text: 'Return to Marisol at the Neon Conch.', next: 'Reward: $1,200 · 120 RP', marker: 'neon', radius: 4 },
    ],
    outro: [['marisol', 'Clean enough. Keep the change and keep your mouth shut.']],
    reward: { money: 1200, rp: 120 },
  },
  {
    id: 1,
    title: 'CORAL RUN',
    fixer: 'marisol',
    accent: '#8ed6e8',
    intro: [
      ['marisol', 'Dex Calloway has a Marlin GT sitting at the docks with my name in the glovebox.'],
      ['marisol', 'Bring it to Kestrel Yards before he notices. Try not to redecorate it.'],
    ],
    stages: [
      { kind: 'goto', text: 'Meet the dockhand at Marlin Docks.', next: 'Then take the Marlin GT.', marker: 'marina', radius: 4 },
      {
        kind: 'steal', text: 'Steal the Marlin GT from the docks.', next: 'Then run it to Kestrel Yards.',
        marker: 'car', car: { x: 438.2, z: 240, heading: -Math.PI / 2, color: '#7fa8a0', damage: 0, name: 'MARLIN GT' },
      },
      { kind: 'deliver', text: 'Run the Marlin GT to Kestrel Yards.', next: 'Then shake the tail.', marker: 'kestrel', radius: 8, requireCar: true },
      { kind: 'escape', text: 'Shake the tail before it radios in.', next: 'Reward: $1,800 · 150 RP', wanted: 1, say: [['dispatch', 'BOLO: teal Marlin GT, northbound on Tide.']] },
    ],
    outro: [['marisol', 'Dex is going to be insufferable about this. Good.']],
    reward: { money: 1800, rp: 150 },
  },
  {
    id: 2,
    title: 'WRECK THE REGENT',
    fixer: 'marisol',
    accent: '#ff7d64',
    intro: [
      ['marisol', 'Dex keeps a Regent under the Neon Conch like a dog he is proud of.'],
      ['marisol', 'I want it in the sea. Not parked near the sea. In it.'],
    ],
    stages: [
      { kind: 'goto', text: 'Meet Marisol outside the Neon Conch.', next: 'Then find the Regent.', marker: 'neon', radius: 4 },
      {
        kind: 'goto', text: 'Find Dex\'s Regent on Coral Strip.', next: 'Then wreck it.', marker: 'car', radius: 9,
        car: { x: SPOTS.regent.x, z: SPOTS.regent.z, heading: -Math.PI / 2, color: '#7a2f2f', damage: 0, name: 'THE REGENT' },
        say: [['marisol', 'There it is. Burgundy, bad attitude, worse parking.']],
      },
      {
        kind: 'destroy', text: 'Wreck Dex\'s Regent at the Coral Strip.', next: 'Then lose the heat.', marker: 'car', radius: 8,
        say: [['dex', 'That Regent cost more than your whole block, Rook.']],
      },
      {
        kind: 'escape', text: 'Lose the three-star response.', next: 'Reward: $2,400 · 180 RP', wanted: 1,
        setWanted: 3.4, say: [['dispatch', 'All units, shots fired at Coral Strip. Air unit is up.']],
      },
    ],
    outro: [
      ['marisol', 'Dex just watched his inheritance sink. You are officially interesting.'],
    ],
    reward: { money: 2400, rp: 180 },
  },
  {
    id: 3,
    title: 'SALT IN THE WATER',
    fixer: 'salt',
    accent: '#79b8ff',
    intro: [
      ['salt', 'Rook. I found a ledger with your name in it. I can lose it, for a price.'],
      ['salt', 'The evidence van is at Kestrel Yards. Bring it to the docks and we both stay clean.'],
    ],
    stages: [
      { kind: 'goto', text: 'Meet Detective Salt at Pelican Pawn.', next: 'Then take the evidence van.', marker: 'pawn', radius: 4 },
      {
        kind: 'steal', text: 'Steal the evidence van from Kestrel Yards.', next: 'Then deliver it to Marlin Docks.',
        marker: 'car', car: { x: 438.2, z: 96, heading: Math.PI / 2, color: '#d8d2c0', damage: 0, name: 'EVIDENCE VAN' },
        setWanted: 2.2, say: [['dispatch', 'Unit 14, stolen city van heading south on Tide.']],
      },
      { kind: 'deliver', text: 'Deliver the van to Marlin Docks.', next: 'Then lose the four-star response.', marker: 'marina', radius: 8, requireCar: true },
      { kind: 'escape', text: 'Lose the four-star response.', next: 'Reward: $3,200 · 220 RP', wanted: 1, setWanted: 4.0 },
    ],
    outro: [['salt', 'Pleasure doing business. If anyone asks, we never met.']],
    reward: { money: 3200, rp: 220 },
  },
  {
    id: 4,
    title: "PIKE'S LAST TIDE",
    fixer: 'marisol',
    accent: '#ff8fb1',
    intro: [
      ['marisol', 'Pike is moving the ledger through the docks tonight. He has three men and a very large opinion of himself.'],
      ['marisol', 'This is the one, Rook. End it and the strip is ours.'],
    ],
    stages: [
      { kind: 'goto', text: 'Meet Marisol at Marlin Docks.', next: 'Then clear Pike\'s guards.', marker: 'marina', radius: 4 },
      {
        kind: 'kill', text: 'Clear Pike\'s guards off the dock.', next: 'Then face Aurelio Pike.', marker: 'marina', radius: 10,
        guards: [
          { x: 444, z: 270, tag: 'guard', name: 'DOCK GUARD' },
          { x: 454, z: 282, tag: 'guard', name: 'DOCK GUARD' },
          { x: 440, z: 292, tag: 'guard', name: 'DOCK GUARD' },
        ],
        say: [['pike', 'You are standing on my tide, boy.']],
      },
      {
        kind: 'boss', text: 'Put Aurelio Pike down.', next: 'Then outrun the harbour response.', marker: 'boss', radius: 10,
        boss: { x: 458, z: 280, tag: 'pike', name: 'AURELIO PIKE' },
        setWanted: 2.5,
      },
      { kind: 'escape', text: 'Outrun the harbour response.', next: 'Reward: $6,000 · 300 RP', wanted: 1, setWanted: 4.6 },
    ],
    outro: [
      ['marisol', 'The tide came in for Pike. You are the strip now, Rook.'],
      ['marisol', 'Try not to get famous.'],
    ],
    reward: { money: 6000, rp: 300 },
    final: true,
  },
];

function makeMarker(color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.13, 6, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.15, 16, 14, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 8;
  group.add(beam);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshBasicMaterial({ color }),
  );
  gem.position.y = 2.8;
  group.add(gem);
  const iconCanvas = document.createElement('canvas');
  iconCanvas.width = 128;
  iconCanvas.height = 128;
  const ictx = iconCanvas.getContext('2d');
  ictx.fillStyle = color;
  ictx.beginPath();
  ictx.moveTo(64, 4);
  ictx.lineTo(120, 64);
  ictx.lineTo(64, 124);
  ictx.lineTo(8, 64);
  ictx.closePath();
  ictx.fill();
  ictx.fillStyle = '#101b22';
  ictx.font = '800 62px "Arial Black", sans-serif';
  ictx.textAlign = 'center';
  ictx.textBaseline = 'middle';
  ictx.fillText('!', 64, 66);
  const iconTex = new THREE.CanvasTexture(iconCanvas);
  iconTex.colorSpace = THREE.SRGBColorSpace;
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex, transparent: true, depthWrite: false }));
  icon.scale.set(2.3, 2.3, 1);
  icon.position.y = 5.4;
  group.add(icon);
  group.visible = false;
  return { group, ring, gem, icon, color };
}

export class Missions {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.missionIndex = 0;
    this.storyComplete = false;
    this.courier = null;
    this.targetCar = null;
    this.targetPeds = [];
    this.prompt = '';
    this.markers = [makeMarker('#ffc857'), makeMarker('#6fe0c0')];
    for (const marker of this.markers) game.scene.add(marker.group);
    this.time = 0;
    this.completed = [];
    this.lastStage = -1;
  }

  apply(data) {
    this.missionIndex = clamp(data.missionIndex ?? 0, 0, MISSIONS.length);
    this.completed = data.completed ? [...data.completed] : [];
    this.storyComplete = this.missionIndex >= MISSIONS.length;
    this.courierDone = data.courierDone ?? 0;
    if (!this.storyComplete) {
      const def = MISSIONS[this.missionIndex];
      this.active = { def, stage: clamp(data.missionStage ?? 0, 0, def.stages.length - 1) };
      this.enterStage(true);
    }
  }

  serialize() {
    return {
      missionIndex: this.missionIndex,
      missionStage: this.active?.stage ?? 0,
      completed: [...this.completed],
      courierDone: this.courierDone ?? 0,
    };
  }

  spot(name) {
    return SPOTS[name] ?? SPOTS.fixer;
  }

  clearTargets(keepCar = false) {
    for (const ped of this.targetPeds) {
      if (ped.alive) {
        this.game.scene.remove(ped.mesh);
        const index = this.game.pedestrians.peds.indexOf(ped);
        if (index >= 0) this.game.pedestrians.peds.splice(index, 1);
      }
    }
    this.targetPeds = [];
    if (!keepCar && this.targetCar) {
      this.targetCar = null;
    }
  }

  startNext() {
    if (this.active || this.storyComplete) return false;
    const def = MISSIONS[this.missionIndex];
    this.active = { def, stage: 0 };
    this.story.clear?.();
    for (const line of def.intro) this.game.story.say(line[0], line[1], 7.2);
    this.game.hud?.toast(`JOB ACCEPTED · ${def.title}`, def.accent);
    this.game.audio?.ui();
    this.enterStage();
    return true;
  }

  enterStage(replay = false) {
    if (!this.active) return;
    const stage = this.active.def.stages[this.active.stage];
    if (!replay && stage.say) {
      for (const [speaker, text] of stage.say) this.game.story.say(speaker, text, 6.4);
    }
    if (stage.setWanted) this.game.police.reportCrime(stage.setWanted, 'MISSION');
    if (stage.car) {
      if (!this.targetCar) {
        this.targetCar = this.game.vehicles.create(stage.car.name === 'EVIDENCE VAN' ? 'van' : stage.car.name === 'THE REGENT' ? 'regent' : 'marlin', {
          x: stage.car.x, z: stage.car.z, heading: stage.car.heading,
          color: stage.car.color, driver: null, damage: stage.car.damage ?? 0,
          target: true,
        });
        this.targetCar.missionTarget = true;
        this.targetCar.damage = stage.car.damage ?? 0;
        this.targetCar.customName = stage.car.name;
      }
    }
    if (stage.clerk) {
      const clerk = this.game.pedestrians.spawnAt(this.spot('sunfade').x - 0.6, this.spot('sunfade').z, {
        tag: 'clerk', state: 'idle', heading: Math.PI / 2, locked: true,
        spec: { id: 'clerk', skin: '#b97c50', skinShadow: '#8d5a38', hair: '#2a2420', shirt: '#e8d9b8', jacket: '#7a4a3c', pants: '#3d4148', style: 'ped', blink: 1.4 },
      });
      clerk.speed = 0;
      this.targetPeds.push(clerk);
    }
    if (stage.guards) {
      for (const guard of stage.guards) {
        const ped = this.game.pedestrians.spawnAt(guard.x, guard.z, {
          tag: guard.tag, state: 'idle', heading: Math.PI, locked: true,
          spec: { id: 'guard', skin: '#8a5a3c', skinShadow: '#6b422c', hair: '#1b1b1b', shirt: '#4a5b52', jacket: '#2a3532', pants: '#2b2f31', style: 'ped' },
        });
        ped.health = 70;
        ped.guard = true;
        ped.fireClock = 0.8;
        this.targetPeds.push(ped);
      }
    }
    if (stage.boss) {
      const boss = this.game.pedestrians.spawnAt(stage.boss.x, stage.boss.z, {
        tag: stage.boss.tag, state: 'idle', heading: Math.PI, locked: true,
        spec: { id: 'pike', skin: '#d9a77c', skinShadow: '#a97850', hair: '#b9b2a2', shirt: '#f2ead2', jacket: '#d8c9a8', pants: '#b9ac8d', style: 'ped', beard: true },
      });
      boss.health = 260;
      boss.guard = true;
      boss.boss = true;
      boss.fireClock = 0.6;
      this.targetPeds.push(boss);
    }
    this.lastStage = this.active.stage;
    this.updateMarker();
  }

  currentStage() {
    return this.active ? this.active.def.stages[this.active.stage] : null;
  }

  advance() {
    if (!this.active) return;
    const { def } = this.active;
    this.game.audio?.tone?.(520, 0.18, 0.1, 'triangle');
    this.active.stage += 1;
    if (this.active.stage >= def.stages.length) {
      this.completeMission();
    } else {
      this.game.hud?.toast(`STAGE ${this.active.stage + 1}/${def.stages.length}`, def.accent);
      this.enterStage();
    }
  }

  completeMission() {
    const def = this.active.def;
    this.game.player.addMoney(def.reward.money, `+$${def.reward.money.toLocaleString('en-US')} · ${def.title}`);
    this.game.player.addRp(def.reward.rp);
    for (const [speaker, text] of def.outro) this.game.story.say(speaker, text, 7);
    this.completed.push(def.id);
    this.missionIndex += 1;
    this.active = null;
    this.clearTargets();
    this.missionCooldown = 3;
    if (this.missionIndex >= MISSIONS.length) {
      this.storyComplete = true;
      this.game.hud?.toast('STORY COMPLETE · PALMSHORE IS YOURS', '#ffc857');
      this.game.audio?.cash();
    }
    this.game.save?.auto?.();
  }

  startCourier() {
    if (this.active || this.courier) return false;
    this.courier = {
      timer: 150,
      drop: 0,
      drops: [this.spot('courier1'), this.spot('courier2'), this.spot('courier3')],
      names: ['VIREO CENTER', 'MARLIN DOCKS', 'LANTANA HILL'],
      earned: 0,
    };
    this.game.story.say('marisol', 'Three drops. Mango Tango to the docks and back. Clock is running.', 6);
    this.game.hud?.toast('COURIER RUN · 3 DROPS', '#6fe0c0');
    return true;
  }

  courierUpdate(dt) {
    if (!this.courier) return;
    const courier = this.courier;
    courier.timer -= dt;
    if (courier.timer <= 0) {
      this.game.hud?.toast('COURIER RUN FAILED · OUT OF TIME', '#ff8f8f');
      this.courier = null;
      return;
    }
    const target = courier.drops[courier.drop];
    if (target && dist(this.game.player.x, this.game.player.z, target.x, target.z) < 4.2) {
      courier.drop += 1;
      courier.earned += 150;
      this.game.player.addMoney(150, '+$150 · DROP DELIVERED');
      this.game.effects.money(target.x, target.z);
      this.game.audio?.pickup('cash');
      if (courier.drop >= courier.drops.length) {
        this.game.player.addMoney(500, '+$500 · COURIER BONUS');
        this.game.player.addRp(90);
        this.game.hud?.toast('COURIER COMPLETE · +$650', '#6fe0c0');
        this.game.story.say('marisol', 'That is how you make a deadline. Take the rest of the night off.', 5);
        this.courierDone = (this.courierDone ?? 0) + 1;
        this.courier = null;
      } else {
        this.game.hud?.toast(`DROP ${courier.drop}/3 · NEXT: ${courier.names[courier.drop]}`, '#6fe0c0');
      }
    }
  }

  markerPosition() {
    if (this.courier) {
      const target = this.courier.drops[this.courier.drop];
      return target ? { ...target, color: '#6fe0c0' } : null;
    }
    if (this.active) {
      const stage = this.currentStage();
      if (stage.marker === 'car' && this.targetCar) return { x: this.targetCar.x, z: this.targetCar.z, color: '#ffc857' };
      if (stage.marker === 'boss') {
        const boss = this.targetPeds.find((ped) => ped.boss && ped.alive);
        if (boss) return { x: boss.x, z: boss.z, color: '#ff8fb1' };
      }
      if (stage.marker && SPOTS[stage.marker]) return { ...SPOTS[stage.marker], color: '#ffc857' };
      return null;
    }
    return null;
  }

  updateMarker() {
    const marker = this.markers[0];
    const second = this.markers[1];
    const activePos = this.markerPosition();
    if (activePos) {
      marker.group.visible = true;
      marker.group.position.set(activePos.x, this.game.world.heightAt(activePos.x, activePos.z) + 0.05, activePos.z);
      marker.group.scale.setScalar(this.active ? 1 : 0.85);
      marker.color = activePos.color;
      marker.ring.material.color.set(activePos.color);
      marker.gem.material.color.set(activePos.color);
    } else {
      marker.group.visible = false;
    }
    if (!this.active && !this.courier && !this.storyComplete) {
      const fixer = this.spot('fixer');
      second.group.visible = true;
      second.group.position.set(fixer.x, this.game.world.heightAt(fixer.x, fixer.z) + 0.05, fixer.z);
      second.color = '#ffc857';
    } else {
      second.group.visible = false;
    }
  }

  tryInteract() {
    const game = this.game;
    const player = game.player;
    if (this.active) {
      const stage = this.currentStage();
      if (stage.kind === 'intimidate') {
        const clerk = this.targetPeds.find((ped) => ped.tag === 'clerk' && ped.alive);
        if (clerk && dist(player.x, player.z, clerk.x, clerk.z) < 3.2) {
          clerk.state = 'flee';
          clerk.timer = 6;
          clerk.robbed = true;
          game.police.reportCrime(0.8, 'INTIMIDATION');
          game.effects.money(clerk.x, clerk.z);
          game.story.say('clerk', 'Okay! Okay! The float is in the till. Take it. Just do not tell Marisol.', 5);
          this.advance();
          return true;
        }
      }
      return false;
    }
    if (!this.storyComplete && this.missionIndex < MISSIONS.length) {
      const fixer = this.spot('fixer');
      if (dist(player.x, player.z, fixer.x, fixer.z) < 3.6) {
        return this.startNext();
      }
    }
    if (!this.courier) {
      const mango = this.spot('mango');
      if (dist(player.x, player.z, mango.x, mango.z) < 3.6) {
        return this.startCourier();
      }
    }
    return false;
  }

  update(dt) {
    this.time += dt;
    this.courierUpdate(dt);
    if (this.active) {
      const stage = this.currentStage();
      const player = this.game.player;
      let pos = null;
      if (stage.marker === 'car' && this.targetCar) pos = { x: this.targetCar.x, z: this.targetCar.z };
      else if (stage.marker === 'boss') {
        const boss = this.targetPeds.find((ped) => ped.boss && ped.alive);
        if (boss) pos = { x: boss.x, z: boss.z };
      } else if (stage.marker && SPOTS[stage.marker]) pos = SPOTS[stage.marker];
      if (stage.kind === 'goto' && pos) {
        const radius = stage.radius ?? 5;
        if (dist(player.x, player.z, pos.x, pos.z) < radius) this.advance();
      }
      if (stage.kind === 'steal' && this.targetCar && player.car === this.targetCar) this.advance();
      if (stage.kind === 'deliver' && pos) {
        if (dist(player.x, player.z, pos.x, pos.z) < (stage.radius ?? 8)) {
          if (!stage.requireCar || player.car) this.advance();
        }
      }
      if (stage.kind === 'destroy' && this.targetCar && this.targetCar.damage >= 99.5) {
        this.game.effects.explosion(this.targetCar.x, 1.2, this.targetCar.z);
        this.game.hud?.toast('REGENT DESTROYED', '#ff7d64');
        this.advance();
      }
      if (stage.kind === 'escape' && this.game.police.wanted <= (stage.wanted ?? 1)) this.advance();
      if (stage.kind === 'kill') {
        const guards = this.targetPeds.filter((ped) => ped.tag === 'guard');
        if (guards.length && guards.every((ped) => !ped.alive)) this.advance();
      }
      if (stage.kind === 'boss') {
        const boss = this.targetPeds.find((ped) => ped.boss);
        if (boss && !boss.alive) this.advance();
      }
      this.updateGuards(dt);
    }
    this.updateMarker();
    this.updatePrompt();
    for (const marker of this.markers) {
      if (!marker.group.visible) continue;
      marker.gem.rotation.y += dt * 1.7;
      marker.gem.position.y = 2.8 + Math.sin(this.time * 2.2) * 0.22;
      marker.icon.position.y = 5.4 + Math.sin(this.time * 2.2) * 0.2;
      marker.ring.rotation.z += dt * 0.5;
    }
  }

  updateGuards(dt) {
    for (const ped of this.targetPeds) {
      if (!ped.alive || !ped.guard) continue;
      const player = this.game.player;
      const d = dist(ped.x, ped.z, player.x, player.z);
      if (d > 32) continue;
      ped.fireClock = (ped.fireClock ?? 1) - dt;
      ped.heading = Math.atan2(player.z - ped.z, player.x - ped.x);
      ped.mesh.rotation.y = Math.atan2(Math.cos(ped.heading), Math.sin(ped.heading));
      if (ped.fireClock <= 0) {
        ped.fireClock = ped.boss ? 1.1 : 1.7;
        const angle = ped.heading + (this.game.police.rng.float() - 0.5) * 0.09;
        this.game.combat.fire('police', ped.boss ? 'smg' : 'sidearm', {
          x: ped.x + Math.cos(ped.heading) * 0.6, y: 1.3, z: ped.z + Math.sin(ped.heading) * 0.6,
        }, angle, { owner: 'police', damage: ped.boss ? 8 : 6, spread: 0.055 });
      }
    }
  }

  updatePrompt() {
    this.prompt = '';
    const player = this.game.player;
    if (this.active) {
      const stage = this.currentStage();
      if (stage.kind === 'intimidate') {
        const clerk = this.targetPeds.find((ped) => ped.tag === 'clerk' && ped.alive);
        if (clerk && dist(player.x, player.z, clerk.x, clerk.z) < 3.2) this.prompt = 'E · LEAN ON THE CLERK';
      }
      return;
    }
    if (!this.storyComplete && dist(player.x, player.z, this.spot('fixer').x, this.spot('fixer').z) < 3.6) {
      this.prompt = `E · START ${MISSIONS[this.missionIndex]?.title ?? 'JOB'}`;
      return;
    }
    if (!this.courier && dist(player.x, player.z, this.spot('mango').x, this.spot('mango').z) < 3.6) {
      this.prompt = 'E · START COURIER RUN';
    }
  }

  card() {
    if (this.active) {
      const stage = this.currentStage();
      const def = this.active.def;
      return {
        stage: this.active.stage + 1,
        total: def.stages.length,
        title: def.title,
        objective: stage.text,
        next: stage.next,
        accent: def.accent,
        fixer: def.fixer,
      };
    }
    if (this.courier) {
      return {
        stage: this.courier.drop + 1,
        total: 3,
        title: 'COURIER RUN',
        objective: `Drop the package in ${this.courier.names[this.courier.drop]}.`,
        next: `${Math.ceil(this.courier.timer)} SEC · $150 EACH`,
        accent: '#6fe0c0',
        fixer: 'marisol',
      };
    }
    return null;
  }

  blips() {
    const list = [];
    if (this.active) {
      const pos = this.markerPosition();
      if (pos) list.push({ ...pos, color: '#ffc857', kind: 'mission' });
    } else if (!this.storyComplete) {
      list.push({ ...this.spot('fixer'), color: '#ffc857', kind: 'mission' });
      if (!this.courier) list.push({ ...this.spot('mango'), color: '#6fe0c0', kind: 'courier' });
    }
    if (this.courier) {
      const target = this.courier.drops[this.courier.drop];
      if (target) list.push({ ...target, color: '#6fe0c0', kind: 'courier' });
    }
    return list;
  }

  get objectiveDistance() {
    const pos = this.markerPosition();
    if (!pos) return null;
    return dist(pos.x, pos.z, this.game.player.x, this.game.player.z);
  }

  reset() {
    this.active = null;
    this.courier = null;
    this.clearTargets();
  }

  get allMissions() {
    return MISSIONS;
  }

  static get spots() {
    return SPOTS;
  }

  get worldSize() {
    return { WORLD, TAU };
  }
}
