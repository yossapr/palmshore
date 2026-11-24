// Rook: the body on foot, the hands on the wheel, the wallet, the weapons and the
// health bar. Everything the HUD reads about the player comes from this object.

import { WEAPONS, RANKS, CITY, WORLD, SHOT_SAVE } from './config.js';
import { clamp, dist, wrapAngle } from './math.js';
import { makePerson, animatePerson, PLAYER_SPEC } from './people.js';

const WEAPON_ORDER = ['fists', 'sidearm', 'smg', 'shotgun', 'rifle'];

export class Player {
  constructor(game) {
    this.game = game;
    this.x = 361.2;
    this.z = 152;
    this.y = 0.2;
    this.heading = -Math.PI / 2;
    this.speed = 0;
    this.moving = false;
    this.aiming = false;
    this.health = 100;
    this.armour = 0;
    this.money = 18450;
    this.rp = 620;
    this.deaths = 0;
    this.arrests = 0;
    this.car = null;
    this.weapons = {};
    for (const id of ['sidearm', 'smg', 'shotgun', 'rifle']) {
      const def = WEAPONS.find((w) => w.id === id);
      this.weapons[id] = { ammo: def.ammo, reserve: def.reserve, owned: true };
    }
    this.currentWeapon = 'smg';
    this.fireClock = 0;
    this.reloadTimer = 0;
    this.reloadWeapon = null;
    this.footPhase = 0;
    this.footTime = 0;
    this.jumpY = 0;
    this.jumpVel = 0;
    this.dead = false;
    this.deadKind = null;
    this.respawnTimer = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.focusTimer = 0;
    this.windTimer = 0;
    this.cooldowns = { focus: 0, wind: 0, patch: 0 };
    this.pickups = [];
    this.pickupTimer = 0;
    this.kills = 0;
    this.robberies = 0;
    this.distanceDriven = 0;
    this.lastCarX = 0;
    this.lastCarZ = 0;
    this.person = makePerson(PLAYER_SPEC);
    this.mesh = this.person.group;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = Math.atan2(Math.cos(this.heading), Math.sin(this.heading));
    this.game.scene.add(this.mesh);
    this.spawnPickups();
  }

  get currentDef() {
    return WEAPONS.find((weapon) => weapon.id === this.currentWeapon) ?? WEAPONS[1];
  }

  get rank() {
    let rank = RANKS[0];
    for (const entry of RANKS) if (this.rp >= entry.rp) rank = entry;
    return rank;
  }

  get rankProgress() {
    const rank = this.rank;
    const index = RANKS.indexOf(rank);
    const next = RANKS[index + 1];
    if (!next) return 1;
    return clamp((this.rp - rank.rp) / (next.rp - rank.rp), 0, 1);
  }

  get nextRankRp() {
    const index = RANKS.indexOf(this.rank);
    return RANKS[index + 1]?.rp ?? this.rp;
  }

  applySave(data = SHOT_SAVE) {
    this.money = data.money ?? 18450;
    this.rp = data.rp ?? 620;
    this.deaths = data.deaths ?? 0;
    this.arrests = data.arrests ?? 0;
    this.currentWeapon = data.currentWeapon ?? 'smg';
    if (data.weapons) {
      for (const [id, slot] of Object.entries(data.weapons)) {
        if (this.weapons[id]) {
          this.weapons[id].ammo = slot.ammo;
          this.weapons[id].reserve = slot.reserve;
        }
      }
    }
  }

  snapshot() {
    const weapons = {};
    for (const id of ['sidearm', 'smg', 'shotgun', 'rifle']) {
      weapons[id] = { ammo: this.weapons[id].ammo, reserve: this.weapons[id].reserve };
    }
    return {
      money: this.money,
      rp: this.rp,
      deaths: this.deaths,
      arrests: this.arrests,
      currentWeapon: this.currentWeapon,
      weapons,
    };
  }

  spawnPickups() {
    const specs = [
      { type: 'health', x: 341, z: 146 },
      { type: 'cash', x: 403, z: 196 },
      { type: 'armour', x: 232, z: 143 },
      { type: 'ammo', x: 175, z: 207 },
      { type: 'cash', x: 449, z: 236 },
      { type: 'health', x: 300, z: 275 },
      { type: 'armour', x: 93, z: 285 },
      { type: 'ammo', x: 402, z: 92 },
    ];
    for (const spec of specs) this.createPickup(spec);
  }

  createPickup(spec) {
    const colors = { health: '#6fe0a0', armour: '#79b8ff', ammo: '#ffc857', cash: '#a6e07a' };
    const color = colors[spec.type] ?? '#ffc857';
    const group = new THREE.Group();
    group.position.set(spec.x, 0.8, spec.z);
    const mat = new THREE.MeshBasicMaterial({ color });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), mat);
    group.add(core);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.03, 4, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.78;
    group.add(glow);
    this.game.scene.add(group);
    const pickup = { ...spec, group, core, ring, active: true, timer: 0, color };
    this.pickups.push(pickup);
    return pickup;
  }

  update(dt, input) {
    this.fireClock = Math.max(0, this.fireClock - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.4);
    for (const key of Object.keys(this.cooldowns)) this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    if (this.focusTimer > 0) {
      this.focusTimer -= dt;
      this.game.timeScale = 0.55;
      if (this.focusTimer <= 0) this.game.timeScale = 1;
    }
    if (this.windTimer > 0) this.windTimer -= dt;
    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }
    this.aiming = input.mouse.down || input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (this.car) this.updateDriving(dt, input);
    else this.updateFoot(dt, input);
    this.updatePickups(dt);
    this.handleAbilities(input);
  }

  updateFoot(dt, input) {
    const game = this.game;
    const axis = input.axis();
    const yaw = game.chase.aimYaw;
    const forward = { x: Math.cos(yaw), z: Math.sin(yaw) };
    const right = { x: -Math.sin(yaw), z: Math.cos(yaw) };
    let mx = forward.x * -axis.y + right.x * axis.x;
    let mz = forward.z * -axis.y + right.z * axis.x;
    const len = Math.hypot(mx, mz);
    this.moving = len > 0.05;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight') || this.windTimer > 0;
    const walkSpeed = (sprint ? 7.4 : 4.4) + (this.windTimer > 0 ? 1.5 : 0);
    if (this.moving) {
      mx /= len;
      mz /= len;
      this.x += mx * walkSpeed * dt;
      this.z += mz * walkSpeed * dt;
      this.footPhase += dt * (sprint ? 12 : 8);
      this.speed = walkSpeed;
    } else {
      this.speed = 0;
    }
    this.heading = yaw;
    // Jump is cosmetic but it sells the body.
    if (input.wasPressed('Space') && this.jumpY <= 0.01) this.jumpVel = 4.2;
    this.jumpVel -= 14 * dt;
    this.jumpY = Math.max(0, this.jumpY + this.jumpVel * dt);
    if (this.jumpY === 0) this.jumpVel = 0;

    game.world.resolveCircle(this, 0.42);
    this.x = clamp(this.x, 1.5, game.world.roads.beachX + 44);
    this.z = clamp(this.z, 1.5, WORLD.rows * WORLD.pitch + 42);
    this.y = game.world.heightAt(this.x, this.z);
    this.mesh.visible = true;
    this.mesh.position.set(this.x, this.y + this.jumpY, this.z);
    this.mesh.rotation.y = Math.atan2(Math.cos(this.heading), Math.sin(this.heading));
    animatePerson(this.person, this.footPhase, this.moving, this.speed / 4);
    if (this.aiming) {
      this.person.arms[1].rotation.x = -1.35;
      this.person.arms[0].rotation.x = -1.15;
    }
    // Interactions.
    if (input.wasPressed('KeyF')) {
      const car = game.vehicles.nearest(this.x, this.z, 4.2);
      if (car) this.enterCar(car);
    }
    if (input.wasPressed('KeyE')) {
      const handled = game.missions?.tryInteract?.();
      if (!handled) {
        const ped = game.pedestrians.nearest(this.x, this.z, 2.4);
        if (ped && !ped.robbed) {
          const amount = game.pedestrians.rob(ped);
          if (amount > 0) {
            this.money += amount;
            this.robberies += 1;
            game.police.reportCrime(0.45, 'ROBBERY');
            game.effects.money(ped.x, ped.z);
            game.audio?.pickup('cash');
            game.hud?.toast(`+$${amount} · STREET TAX`, '#ffc857');
          }
        }
      }
    }
    this.handleWeaponKeys(input);
    if (input.wasPressed('KeyR')) this.beginReload();
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (input.mouse.down && this.fireClock <= 0) this.fire(yaw, false);
    if (input.mouse.rightClicked) this.fire(yaw, false);
    if (input.mouse.rightClicked) game.combat.melee(this.x, this.z, yaw, 2.3, 18);
  }

  updateDriving(dt, input) {
    const game = this.game;
    const car = this.car;
    if (!car || car.wrecked) {
      if (car && car.wrecked) this.exitCar(true);
      return;
    }
    let throttle = 0;
    let brake = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle = 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
      if (car.speed > 1.2) brake = 1;
      else throttle = -0.85;
    }
    const steer = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0)
      - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    const handbrake = input.isDown('Space');
    game.vehicles.setControls(car, throttle, brake, steer, handbrake);
    if (this.windTimer > 0 && throttle > 0.1) {
      car.vx += Math.cos(car.heading) * 9 * dt;
      car.vz += Math.sin(car.heading) * 9 * dt;
      game.effects.dust(car.x - Math.cos(car.heading) * 2, car.z - Math.sin(car.heading) * 2, 1);
    }
    if (input.wasPressed('KeyF')) this.exitCar(false);
    this.handleWeaponKeys(input);
    if (input.wasPressed('KeyR')) this.beginReload();
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (input.mouse.down && this.fireClock <= 0) {
      const origin = {
        x: car.x + Math.cos(car.heading) * 2.6,
        y: 1.2,
        z: car.z + Math.sin(car.heading) * 2.6,
      };
      this.firePlayback(game.chase.aimYaw, origin, true);
      game.effects.muzzle(origin.x, 1.3, origin.z, game.chase.aimYaw);
    }
    if (input.isDown('Space') && Math.abs(car.speed) > 10) {
      if (Math.random() < 0.2) game.effects.dust(car.x, car.z, 1);
    }
    if (game.tick % 0.2 < dt) game.audio?.setEngine(car.speed, true);
    this.x = car.x;
    this.z = car.z;
    this.y = car.mesh.position.y;
    this.mesh.visible = false;
    this.distanceDriven += Math.abs(car.speed) * dt;
  }

  handleWeaponKeys(input) {
    for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
      if (input.wasPressed(`Digit${i + 1}`)) {
        const id = WEAPON_ORDER[i];
        if (id === 'fists' || this.weapons[id]?.owned) {
          this.currentWeapon = id;
          this.reloadTimer = 0;
          this.game.audio?.ui();
        }
      }
    }
    if (input.wasPressed('KeyQ')) {
      const index = WEAPON_ORDER.indexOf(this.currentWeapon);
      for (let i = 1; i <= WEAPON_ORDER.length; i += 1) {
        const next = WEAPON_ORDER[(index + i) % WEAPON_ORDER.length];
        if (next === 'fists' || this.weapons[next]?.owned) {
          this.currentWeapon = next;
          break;
        }
      }
    }
  }

  beginReload() {
    const def = this.currentDef;
    if (def.melee) return;
    const slot = this.weapons[def.id];
    if (!slot || this.reloadTimer > 0 || slot.ammo >= def.ammo || slot.reserve <= 0) return;
    this.reloadTimer = 1.05;
    this.reloadWeapon = def.id;
    this.game.audio?.ui();
  }

  finishReload() {
    const def = this.currentDef;
    const slot = this.weapons[def.id];
    if (slot) {
      const need = def.ammo - slot.ammo;
      const take = Math.min(need, slot.reserve);
      slot.ammo += take;
      slot.reserve -= take;
    }
    this.reloadTimer = 0;
    this.reloadWeapon = null;
  }

  fire(angle, fromCar) {
    const game = this.game;
    const def = this.currentDef;
    if (def.melee) {
      game.combat.melee(this.x, this.z, angle, def.range + 0.5, def.damage);
      return;
    }
    if (this.reloadTimer > 0) return;
    const slot = this.weapons[def.id];
    if (!slot || slot.ammo <= 0) {
      this.beginReload();
      game.audio?.ui();
      return;
    }
    slot.ammo -= 1;
    this.fireClock = def.rate;
    const origin = fromCar && this.car
      ? { x: this.car.x + Math.cos(angle) * 2, y: 1.3, z: this.car.z + Math.sin(angle) * 2 }
      : { x: this.x + Math.cos(angle) * 0.75, y: 1.35, z: this.z + Math.sin(angle) * 0.75 };
    game.combat.fire('player', def.id, origin, angle, { owner: 'player' });
    game.police.reportCrime(def.id === 'shotgun' || def.id === 'rifle' ? 0.8 : 0.55, 'GUNSHOT');
    game.pedestrians.fleeAt(this.x, this.z, 34);
    if (slot.ammo <= 0) this.beginReload();
  }

  firePlayback(angle, origin, fromCar) {
    const game = this.game;
    const def = this.currentDef;
    if (def.melee) {
      game.combat.melee(this.car?.x ?? this.x, this.car?.z ?? this.z, angle, 2.6, def.damage);
      return;
    }
    if (this.reloadTimer > 0) return;
    const slot = this.weapons[def.id];
    if (!slot || slot.ammo <= 0) return;
    slot.ammo -= 1;
    this.fireClock = def.rate;
    game.combat.fire('player', def.id, origin, angle, { owner: 'player', spread: (def.spread ?? 0.02) * 1.5 });
    game.police.reportCrime(0.7, 'DRIVE-BY');
    void fromCar;
  }

  enterCar(car) {
    if (!car || car.wrecked) return false;
    this.car = car;
    car.driver = 'player';
    car.ai = null;
    car.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.mesh.visible = false;
    this.game.chase.setMode('car');
    this.game.chase.snapTo?.(car);
    this.game.audio?.ui();
    if (car.modelId === 'cruiser') this.game.police.reportCrime(1.6, 'POLICE VEHICLE');
    this.game.hud?.toast(`${car.model.name} · ACQUIRED`, '#ffc857');
    return true;
  }

  exitCar(forced = false) {
    const car = this.car;
    if (!car) return;
    const side = { x: -Math.sin(car.heading), z: Math.cos(car.heading) };
    let px = car.x + side.x * 2.5;
    let pz = car.z + side.z * 2.5;
    if (this.game.world.collides(px, pz, 0.5)) {
      px = car.x - side.x * 2.5;
      pz = car.z - side.z * 2.5;
    }
    this.x = px;
    this.z = pz;
    this.heading = car.heading;
    car.driver = null;
    car.controls = { throttle: 0, brake: 0, steer: 0, handbrake: true };
    this.car = null;
    this.mesh.visible = true;
    this.game.chase.setMode('foot');
    if (!forced) this.game.hud?.toast('ON FOOT', '#d9d0bb');
  }

  handleAbilities(input) {
    const game = this.game;
    if (input.wasPressed('KeyZ') && this.cooldowns.focus <= 0) {
      this.cooldowns.focus = 26;
      this.focusTimer = 4;
      game.timeScale = 0.55;
      game.audio?.tone?.(300, 0.5, 0.12, 'sine', 200);
      game.hud?.toast('FOCUS · WORLD SLOWED', '#8ed6e8');
    }
    if (input.wasPressed('KeyC') && this.cooldowns.wind <= 0) {
      this.cooldowns.wind = 12;
      this.windTimer = 2.6;
      game.audio?.tone?.(220, 0.25, 0.1, 'sawtooth', 180);
      game.hud?.toast(this.car ? 'SIDEWINDER · NITROUS' : 'SIDEWINDER · SPRINT', '#ffc857');
    }
    if (input.wasPressed('KeyX') && this.cooldowns.patch <= 0) {
      if (this.money >= 250 && this.health < 100) {
        this.money -= 250;
        this.health = Math.min(100, this.health + 35);
        this.cooldowns.patch = 18;
        game.audio?.pickup('health');
        game.hud?.toast('PATCHED UP · +35 HEALTH', '#6fe0a0');
      } else {
        game.hud?.toast(this.health >= 100 ? 'HEALTH ALREADY FULL' : 'NEED $250', '#ff8f8f');
      }
    }
  }

  updatePickups(dt) {
    for (const pickup of this.pickups) {
      pickup.group.rotation.y += dt * 1.4;
      pickup.core.rotation.x += dt * 0.8;
      pickup.group.position.y = 0.8 + Math.sin(this.game.tick * 2 + pickup.x) * 0.08;
      if (!pickup.active) {
        pickup.timer -= dt;
        if (pickup.timer <= 0) {
          pickup.active = true;
          pickup.group.visible = true;
        }
        continue;
      }
      if (dist(this.x, this.z, pickup.x, pickup.z) < 1.7) this.collectPickup(pickup);
    }
  }

  collectPickup(pickup) {
    const game = this.game;
    pickup.active = false;
    pickup.timer = 55;
    pickup.group.visible = false;
    if (pickup.type === 'cash') {
      const amount = 90 + Math.floor((pickup.x * 7 + pickup.z * 3) % 140);
      this.money += amount;
      game.hud?.toast(`+$${amount}`, '#a6e07a');
    } else if (pickup.type === 'health') {
      this.health = Math.min(100, this.health + 35);
      game.hud?.toast('+35 HEALTH', '#6fe0a0');
    } else if (pickup.type === 'armour') {
      this.armour = Math.min(100, this.armour + 30);
      game.hud?.toast('+30 ARMOUR', '#79b8ff');
    } else if (pickup.type === 'ammo') {
      const def = this.currentDef;
      const slot = this.weapons[def.id];
      if (slot) slot.reserve += def.ammo * 3;
      game.hud?.toast('AMMO RESTOCKED', '#ffc857');
    }
    game.effects.money(pickup.x, pickup.z);
    game.audio?.pickup(pickup.type);
  }

  hurt(amount, source = 'gunfire') {
    if (this.dead || this.invuln > 0) return;
    let remaining = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, remaining * 0.62);
      this.armour -= absorbed;
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    this.hitFlash = 1;
    this.invuln = 0.15;
    this.game.chase.kick(0.5);
    if (this.health <= 0) this.die(source === 'arrest' ? 'busted' : 'wasted');
  }

  die(kind) {
    if (this.dead) return;
    this.dead = true;
    this.deadKind = kind;
    this.respawnTimer = 3.8;
    this.health = 0;
    if (this.car) this.exitCar(true);
    this.game.mode = kind === 'busted' ? 'busted' : 'wasted';
    this.game.police.onPlayerDown();
    this.game.audio?.crunch();
    this.mesh.rotation.z = Math.PI / 2;
  }

  bust() {
    if (this.dead) return;
    this.dead = true;
    this.deadKind = 'busted';
    this.respawnTimer = 3.8;
    this.arrests += 1;
    if (this.car) this.exitCar(true);
    this.game.mode = 'busted';
    this.game.police.onPlayerDown();
  }

  respawn() {
    const kind = this.deadKind;
    const cost = kind === 'busted' ? 750 : 500;
    this.money = Math.max(0, this.money - cost);
    this.dead = false;
    this.deadKind = null;
    this.health = 100;
    this.armour = kind === 'busted' ? 0 : 20;
    this.invuln = 3;
    this.game.mode = 'playing';
    this.game.timeScale = 1;
    this.x = kind === 'busted' ? 192 : 74;
    this.z = kind === 'busted' ? 106 : 262;
    this.heading = -Math.PI / 2;
    this.jumpY = 0;
    this.jumpVel = 0;
    this.mesh.rotation.z = 0;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, this.game.world.heightAt(this.x, this.z), this.z);
    this.game.police.clearWanted();
    this.game.chase.snap = true;
    this.game.hud?.toast(kind === 'busted' ? `RELEASED · -$${cost}` : `HOSPITAL BILL · -$${cost}`, '#ff8f8f');
  }

  addMoney(amount, label) {
    this.money = Math.max(0, this.money + amount);
    this.game.hud?.toast(label ?? `${amount >= 0 ? '+' : '-'}$${Math.abs(amount)}`, amount >= 0 ? '#a6e07a' : '#ff8f8f');
    if (amount > 0) this.game.audio?.cash();
  }

  addRp(amount) {
    this.rp += amount;
    this.game.hud?.toast(`+${amount} RP`, '#8ed6e8');
  }

  setPosition(x, z, heading = this.heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.y = this.game.world.heightAt(x, z);
    this.mesh.position.set(x, this.y, z);
    this.mesh.rotation.y = Math.atan2(Math.cos(heading), Math.sin(heading));
  }

  aimAngle() {
    return this.game.chase.aimYaw;
  }

  static get weaponOrder() {
    return WEAPON_ORDER;
  }

  static get cityBounds() {
    return { maxX: CITY.waterX, maxZ: CITY.maxZ, minX: 1, minZ: 1 };
  }
}
