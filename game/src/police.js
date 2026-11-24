// Palmshore PD: a wanted level that buys cruisers, foot officers, roadblocks and a
// helicopter, each with a role and a callsign, and loses interest when you break contact.

import { CAR_MODELS, DISTRICTS, WORLD, CITY } from './config.js';
import { TAU, clamp, dist, angleTo, wrapAngle, segmentHitsRect } from './math.js';
import { Rng } from './random.js';
import { makePerson, animatePerson, POLICE_SPEC } from './people.js';

const ROLES = ['PURSUIT', 'RAMMING', 'MARKSMAN', 'BLOCKADE'];

function buildHeli() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: '#203243', flatShading: true });
  const trimMat = new THREE.MeshLambertMaterial({ color: '#e8e4d8', flatShading: true });
  const glassMat = new THREE.MeshLambertMaterial({ color: '#2c4854', emissive: '#6d8f99', emissiveIntensity: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 1.4), bodyMat);
  body.castShadow = true;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.2), glassMat);
  nose.position.set(1.7, 0.15, 0);
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 0.32), bodyMat);
  tail.position.set(-3.1, 0.3, 0);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.16), trimMat);
  fin.position.set(-5.0, 0.7, 0);
  group.add(fin);
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.05, 0);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.06, 0.24), new THREE.MeshLambertMaterial({ color: '#2b3236' }));
    blade.rotation.y = angle;
    rotor.add(blade);
  }
  group.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), new THREE.MeshLambertMaterial({ color: '#2b3236' }));
  tailRotor.position.set(-5.0, 0.7, 0.12);
  group.add(tailRotor);
  const skidMat = new THREE.MeshLambertMaterial({ color: '#39454b' });
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.1), skidMat);
    skid.position.set(0, -0.75, side * 0.55);
    group.add(skid);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: '#ff3b3b' }));
  beacon.position.set(0, 0.65, 0.45);
  group.add(beacon);
  const search = new THREE.Mesh(
    new THREE.ConeGeometry(3.6, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffe6a8', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  search.position.y = -7;
  group.add(search);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 16),
    new THREE.MeshBasicMaterial({ color: '#ffe6a8', transparent: true, opacity: 0.2, depthWrite: false }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -13.8;
  group.add(spot);
  return { group, rotor, tailRotor, beacon };
}

export class Police {
  constructor(game) {
    this.game = game;
    this.wanted = 0;
    this.heat = 0;
    this.units = [];
    this.officers = [];
    this.heli = null;
    this.callsignCounter = 11;
    this.spawnClock = 0;
    this.roadblock = null;
    this.roadblockClock = 0;
    this.lastCrime = -99;
    this.lastSeen = null;
    this.contactTimer = 0;
    this.rng = new Rng(WORLD.seed ^ 0x5eed);
    this.clearClock = 0;
    this.hudPulse = 0;
    this.arrestTarget = null;
    this.arrestClock = 0;
    this.footSpawnClock = 0;
    this.reportLine = 'NO ACTIVE UNITS';
  }

  get stars() {
    return clamp(Math.ceil(this.wanted - 0.001), 0, 5);
  }

  reportCrime(amount, kind = 'CRIME') {
    if (this.game.mode !== 'playing') return;
    this.wanted = clamp(this.wanted + amount, 0, 5);
    this.heat += amount;
    this.lastCrime = this.game.tick;
    this.lastSeen = { x: this.game.player.x, z: this.game.player.z };
    this.contactTimer = 12;
    this.hudPulse = 1;
    this.game.hud?.flashWanted?.(kind);
    if (this.wanted >= 1 && this.units.length === 0) this.spawnClock = 0.4;
  }

  reportGunshot(x, z) {
    this.lastSeen = { x, z };
    this.contactTimer = Math.max(this.contactTimer, 9);
    for (const unit of this.units) unit.alerted = true;
    void x;
    void z;
  }

  nextCallsign() {
    const callsign = `P-${this.callsignCounter}`;
    this.callsignCounter += 3;
    if (this.callsignCounter > 39) this.callsignCounter = 11;
    return callsign;
  }

  spawnCruiser(role, options = {}) {
    const player = this.game.player;
    let spot = null;
    if (options.x !== undefined) {
      spot = { x: options.x, z: options.z, heading: options.heading ?? 0 };
    } else {
      for (let tries = 0; tries < 20; tries += 1) {
        spot = this.game.roads.spawnLane(this.rng, player);
        if (!spot) continue;
        const d = dist(spot.x, spot.z, player.x, player.z);
        if (d > 55 && d < 135) break;
        spot = null;
      }
    }
    if (!spot) return null;
    const car = this.game.vehicles.create('cruiser', {
      x: spot.x, z: spot.z, heading: spot.heading,
      driver: 'police', siren: true, colorSeed: 0,
    });
    car.role = role;
    car.callsign = this.nextCallsign();
    const unit = {
      kind: 'car', car, callsign: car.callsign, role, alive: true,
      cooldown: this.rng.range(0.6, 1.8), life: 0, alerted: true,
    };
    car.unit = unit;
    this.units.push(unit);
    if (role === 'BLOCKADE') {
      car.speed = 0;
      car.vx = 0;
      car.vz = 0;
    }
    return unit;
  }

  spawnOfficer(role = 'MARKSMAN', options = {}) {
    const player = this.game.player;
    let x = options.x;
    let z = options.z;
    if (x === undefined) {
      for (let tries = 0; tries < 18; tries += 1) {
        const angle = this.rng.range(0, TAU);
        const radius = this.rng.range(17, 32);
        x = player.x + Math.cos(angle) * radius;
        z = player.z + Math.sin(angle) * radius;
        if (!this.game.world.collides(x, z, 0.6)) break;
      }
    }
    const person = makePerson(POLICE_SPEC);
    const officer = {
      kind: 'foot', x, z, heading: -Math.PI / 2, health: 100, alive: true,
      callsign: this.nextCallsign(), role, mesh: person.group, person,
      cooldown: this.rng.range(0.5, 1.5), walkTime: 0, alerted: true,
      fireRange: role === 'MARKSMAN' ? 34 : 24,
      tag: options.tag ?? null,
    };
    person.group.position.set(x, this.game.world.heightAt(x, z), z);
    this.game.scene.add(person.group);
    this.officers.push(officer);
    this.units.push(officer);
    return officer;
  }

  spawnHeli() {
    const built = buildHeli();
    const unit = {
      kind: 'air', callsign: 'AIR-1', role: 'AIR SUPPORT', alive: true,
      angle: this.rng.range(0, TAU), x: this.game.player.x + 22, z: this.game.player.z - 10,
      y: 22, ...built,
    };
    unit.group.position.set(unit.x, unit.y, unit.z);
    this.game.scene.add(unit.group);
    this.heli = unit;
    this.units.push(unit);
    return unit;
  }

  seedShotUnits() {
    const player = this.game.player;
    // Deterministic close pursuit for a capture: two cruisers and a marksman on foot.
    this.spawnCruiser('PURSUIT', { x: player.x + 16, z: player.z - 22, heading: Math.PI });
    this.spawnCruiser('RAMMING', { x: player.x - 14, z: player.z + 18, heading: 0 });
    this.spawnOfficer('MARKSMAN', { x: player.x + 4.5, z: player.z + 6.5 });
    this.spawnHeli();
    this.wanted = 4.15;
    this.lastSeen = { x: player.x, z: player.z };
    this.contactTimer = 60;
    this.lastCrime = this.game.tick;
    this.reportLine = 'AIR UNIT DEPLOYED';
    for (const unit of this.units) {
      if (unit.car) {
        unit.car.speed = 0;
        unit.car.vx = 0;
        unit.car.vz = 0;
      }
    }
  }

  tableUnits() {
    return this.units
      .filter((unit) => unit.alive)
      .map((unit) => ({
        callsign: unit.callsign,
        role: unit.role,
        distance: Math.round(dist(unit.x ?? unit.car.x, unit.z ?? unit.car.z, this.game.player.x, this.game.player.z)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }

  nearestUnitDistance() {
    let best = Infinity;
    for (const unit of this.units) {
      if (!unit.alive) continue;
      const x = unit.kind === 'car' ? unit.car.x : unit.x;
      const z = unit.kind === 'car' ? unit.car.z : unit.z;
      best = Math.min(best, dist(x, z, this.game.player.x, this.game.player.z));
    }
    return best;
  }

  nearestUnit() {
    let best = null;
    let bestD = Infinity;
    for (const unit of this.units) {
      if (!unit.alive) continue;
      const x = unit.kind === 'car' ? unit.car.x : unit.x;
      const z = unit.kind === 'car' ? unit.car.z : unit.z;
      const d = dist(x, z, this.game.player.x, this.game.player.z);
      if (d < bestD) {
        bestD = d;
        best = unit;
      }
    }
    return best;
  }

  lineOfSight(fromX, fromZ, toX, toZ) {
    for (const rect of this.game.world.colliders) {
      if (segmentHitsRect(fromX, fromZ, toX, toZ, rect)) return false;
    }
    return true;
  }

  updateCruiser(unit, dt) {
    const car = unit.car;
    const player = this.game.player;
    if (car.wrecked) {
      car.controls.brake = 1;
      unit.life += dt;
      if (unit.life > 2 && !unit.deadMarked) {
        unit.deadMarked = true;
        unit.alive = false;
        this.game.effects.explosion(car.x, 1, car.z);
        this.game.police.reportCrime(0.6, 'POLICE VEHICLE');
      }
      return;
    }
    const d = dist(car.x, car.z, player.x, player.z);
    const lead = Math.min(2.2, d * 0.04);
    const tx = player.x + (player.car ? player.car.vx * lead : 0);
    const tz = player.z + (player.car ? player.car.vz * lead : 0);
    let targetSpeed = unit.role === 'RAMMING' ? 34 : unit.role === 'MARKSMAN' ? 16 : 30;
    if (d < 10 && unit.role === 'MARKSMAN') targetSpeed = 0;
    if (unit.role === 'BLOCKADE') {
      targetSpeed = d < 26 ? 0 : 12;
    }
    const desired = angleTo(car.x, car.z, tx, tz);
    if (d > 3) {
      this.game.vehicles.driveToward(car, tx, tz, targetSpeed, dt, {
        handbrake: unit.role === 'RAMMING' && d < 7,
      });
    } else {
      this.game.vehicles.setControls(car, 0, 1, 0, false);
    }
    unit.cooldown -= dt;
    if (unit.cooldown <= 0 && d < 32 && this.lineOfSight(car.x, car.z, player.x, player.z)) {
      unit.cooldown = unit.role === 'MARKSMAN' ? 2.0 : 1.5;
      const angle = desired + (this.rng.float() - 0.5) * 0.13;
      this.game.combat.fire('police', 'sidearm', {
        x: car.x + Math.cos(car.heading) * 2.6,
        y: 1.25,
        z: car.z + Math.sin(car.heading) * 2.6,
      }, angle, { owner: 'police', damage: 7, spread: 0.05 });
    }
    if (d < 2.2 && Math.abs(car.speed) > 6 && player.car) {
      player.hurt(5, 'ram');
    }
  }

  updateOfficer(officer, dt) {
    const game = this.game;
    const player = game.player;
    if (!officer.alive) return;
    const d = dist(officer.x, officer.z, player.x, player.z);
    const angle = angleTo(officer.x, officer.z, player.x, player.z);
    officer.heading = angle;
    let speed = 0;
    if (d > 8) {
      speed = officer.role === 'MARKSMAN' ? 2.4 : 3.1;
      officer.x += Math.cos(angle) * speed * dt;
      officer.z += Math.sin(angle) * speed * dt;
      officer.walkTime += dt;
    } else if (d < 4 && !player.car) {
      this.arrestClock += dt;
      if (this.arrestClock > 1.1 && this.wanted > 0.3) {
        this.arrestClock = 0;
        player.bust();
      }
    } else {
      this.arrestClock = Math.max(0, this.arrestClock - dt);
    }
    game.world.resolveCircle(officer, 0.35);
    officer.mesh.position.set(officer.x, game.world.heightAt(officer.x, officer.z), officer.z);
    officer.mesh.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));
    animatePerson(officer.person, officer.walkTime, speed > 0, speed);
    officer.cooldown -= dt;
    if (officer.cooldown <= 0 && d < officer.fireRange && this.lineOfSight(officer.x, officer.z, player.x, player.z)) {
      officer.cooldown = 1.25 + this.rng.float() * 0.6;
      game.combat.fire('police', 'sidearm', {
        x: officer.x + Math.cos(angle) * 0.65,
        y: 1.35,
        z: officer.z + Math.sin(angle) * 0.65,
      }, angle, { owner: 'police', damage: 8, spread: 0.055 });
    }
    void dt;
  }

  updateHeli(dt) {
    const heli = this.heli;
    if (!heli) return;
    const player = this.game.player;
    heli.angle += dt * 0.5;
    const radius = 26;
    const tx = player.x + Math.cos(heli.angle) * radius;
    const tz = player.z + Math.sin(heli.angle) * radius;
    heli.x += (tx - heli.x) * Math.min(1, dt * 1.4);
    heli.z += (tz - heli.z) * Math.min(1, dt * 1.4);
    heli.group.position.set(heli.x, heli.y, heli.z);
    heli.group.rotation.y = player.heading;
    heli.rotor.rotation.y += dt * 24;
    heli.tailRotor.rotation.x += dt * 30;
    heli.beacon.material.color.setHex(Math.floor(this.game.tick * 4) % 2 === 0 ? '#ff3b3b' : '#301010');
    heli.cooldown = (heli.cooldown ?? 1.6) - dt;
    if (heli.cooldown <= 0 && this.wanted >= 4.2 && dist(heli.x, heli.z, player.x, player.z) < 40) {
      heli.cooldown = 2.2;
      const angle = angleTo(heli.x, heli.z, player.x, player.z) + (this.rng.float() - 0.5) * 0.1;
      this.game.combat.fire('police', 'rifle', {
        x: heli.x, y: heli.y - 1, z: heli.z,
      }, angle, { owner: 'police', damage: 9, spread: 0.02 });
    }
  }

  update(dt) {
    const game = this.game;
    this.hudPulse = Math.max(0, this.hudPulse - dt * 2);
    if (game.mode !== 'playing') return;
    if (this.hold) {
      this.reportLine = this.buildReportLine(this.nearestUnitDistance());
      return;
    }
    if (this.wanted <= 0.001) {
      if (this.units.length) this.clearUnits();
      this.reportLine = 'NO ACTIVE UNITS';
      return;
    }
    this.contactTimer = Math.max(0, this.contactTimer - dt);
    this.spawnClock -= dt;
    this.footSpawnClock -= dt;
    this.roadblockClock -= dt;

    const nearest = this.nearestUnitDistance();
    const escaping = nearest > 72 && game.tick - this.lastCrime > 7;
    if (escaping && this.contactTimer <= 0) {
      this.wanted = Math.max(0, this.wanted - dt * 0.085);
      if (this.wanted < 0.2) {
        this.wanted = 0;
        this.clearUnits();
        game.hud?.toast('HEAT LOST', '#6fe0c0');
        return;
      }
    }

    const desiredUnits = clamp(Math.floor(this.wanted) + 1, 1, 6);
    if (this.spawnClock <= 0 && this.units.filter((u) => u.kind === 'car' && u.alive).length < desiredUnits) {
      this.spawnClock = 2.6 + this.rng.float() * 2;
      this.spawnCruiser(ROLES[(this.units.length + this.callsignCounter) % ROLES.length]);
    }
    if (this.wanted >= 2 && this.footSpawnClock <= 0 && this.officers.filter((o) => o.alive).length < 2) {
      this.footSpawnClock = 5;
      this.spawnOfficer(this.wanted >= 3 ? 'MARKSMAN' : 'PURSUIT');
    }
    if (this.wanted >= 4 && !this.heli) this.spawnHeli();
    if (this.wanted >= 3 && this.roadblockClock <= 0 && !this.roadblock) this.makeRoadblock();

    for (const unit of this.units) {
      if (!unit.alive) continue;
      if (unit.kind === 'car') this.updateCruiser(unit, dt);
      else if (unit.kind === 'foot') this.updateOfficer(unit, dt);
    }
    this.updateHeli(dt);
    if (this.roadblock) {
      this.roadblock.time -= dt;
      if (this.roadblock.time <= 0) {
        for (const unit of this.roadblock.units) {
          if (unit.alive) {
            unit.alive = false;
            this.game.vehicles.remove(unit.car);
          }
        }
        this.roadblock = null;
      }
    }
    for (const unit of this.units.slice()) {
      if (!unit.alive) {
        if (unit.removeTimer === undefined) unit.removeTimer = 6;
        unit.removeTimer -= dt;
        if (unit.removeTimer <= 0) this.removeUnit(unit);
      }
    }
    this.contactTimer = Math.max(this.contactTimer, nearest < 45 ? 5 : 0);
    this.reportLine = this.buildReportLine(nearest);
  }

  buildReportLine(nearest) {
    if (this.heli && this.heli.alive) return 'AIR UNIT DEPLOYED';
    if (this.roadblock) {
      const district = this.game.world.districtAt(this.roadblock.x, this.roadblock.z);
      return `ROADBLOCK AT ${district.short}`;
    }
    if (!Number.isFinite(nearest)) return 'SEARCHING THE STRIP';
    if (nearest < 26) return 'PURSUIT IN CONTACT';
    return `SEARCHING — ${Math.round(nearest)} M`;
  }

  makeRoadblock() {
    const game = this.game;
    const player = game.player;
    const heading = player.heading;
    const forward = { x: Math.cos(heading), z: Math.sin(heading) };
    let bestNode = null;
    let bestScore = Infinity;
    for (const node of game.roads.nodes) {
      const dx = node.x - player.x;
      const dz = node.z - player.z;
      const ahead = dx * forward.x + dz * forward.z;
      const lateral = Math.abs(dx * -forward.z + dz * forward.x);
      const d = Math.hypot(dx, dz);
      if (ahead > 38 && ahead < 125 && lateral < 80 && d < bestScore) {
        bestScore = d;
        bestNode = node;
      }
    }
    if (!bestNode) return;
    const side = { x: -forward.z, z: forward.x };
    const units = [];
    for (const offset of [-3.6, 3.6]) {
      const unit = this.spawnCruiser('BLOCKADE', {
        x: bestNode.x + side.x * offset,
        z: bestNode.z + side.z * offset,
        heading: Math.atan2(-forward.z, -forward.x),
      });
      if (unit) units.push(unit);
    }
    if (units.length) {
      this.roadblock = { node: bestNode, x: bestNode.x, z: bestNode.z, time: 32, units };
      this.roadblockClock = 35;
      const district = game.world.districtAt(bestNode.x, bestNode.z);
      game.hud?.toast(`ROADBLOCK · ${district.name}`, '#79b8ff');
    }
  }

  damageOfficer(officer, amount) {
    officer.health -= amount;
    if (officer.health <= 0 && officer.alive) {
      officer.alive = false;
      officer.mesh.rotation.x = -Math.PI / 2;
      officer.mesh.position.y = 0.28;
      officer.removeTimer = 14;
      this.reportCrime(0.9, 'OFFICER DOWN');
    }
  }

  removeUnit(unit) {
    const index = this.units.indexOf(unit);
    if (index >= 0) this.units.splice(index, 1);
    if (unit.kind === 'car') this.game.vehicles.remove(unit.car);
    if (unit.kind === 'foot') {
      this.game.scene.remove(unit.mesh);
      const oi = this.officers.indexOf(unit);
      if (oi >= 0) this.officers.splice(oi, 1);
    }
    if (unit.kind === 'air') {
      this.game.scene.remove(unit.group);
      this.heli = null;
    }
  }

  clearUnits() {
    for (const unit of this.units.slice()) this.removeUnit(unit);
    this.units.length = 0;
    this.officers.length = 0;
    this.heli = null;
    this.roadblock = null;
    this.roadblockClock = 5;
    this.arrestClock = 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.heat = 0;
    this.clearUnits();
    this.reportLine = 'NO ACTIVE UNITS';
  }

  onPlayerDown() {
    this.contactTimer = 0;
    this.clearWanted();
  }

  get wantedFraction() {
    return clamp(this.wanted / 5, 0, 1);
  }

  responseDistrict() {
    const district = this.game.world.districtAt(this.game.player.x, this.game.player.z);
    return DISTRICTS[district.id] ?? district;
  }

  get cityBounds() {
    return { WORLD, CITY };
  }

  distanceToNearestOfficer() {
    let d = Infinity;
    for (const officer of this.officers) {
      if (officer.alive) d = Math.min(d, dist(officer.x, officer.z, this.game.player.x, this.game.player.z));
    }
    return d;
  }

  crimes() {
    return { wanted: this.wanted, stars: this.stars, line: this.reportLine };
  }

  seedHeliAngle(angle) {
    if (this.heli) {
      this.heli.angle = angle;
      this.heli.x = this.game.player.x + Math.cos(angle) * 26;
      this.heli.z = this.game.player.z + Math.sin(angle) * 26;
    }
  }

  get carModels() {
    return CAR_MODELS;
  }

  teleportUnitsToPlayer() {
    for (const unit of this.units) {
      if (unit.kind === 'car') {
        unit.car.x = this.game.player.x + this.rng.range(-18, 18);
        unit.car.z = this.game.player.z + this.rng.range(-18, 18);
      }
    }
  }
}
