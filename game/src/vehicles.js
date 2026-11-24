// Cars: low-poly bodies with wheels, glass, lit lamps and a police light bar.
// One arcade physics step serves the player, the traffic and the pursuit.

import { CAR_MODELS } from './config.js';
import { clamp, wrapAngle, angleLerp, dist } from './math.js';

const geo = {
  body: new THREE.BoxGeometry(1, 1, 1),
  wheel: new THREE.CylinderGeometry(0.34, 0.34, 0.25, 8),
  hub: new THREE.CylinderGeometry(0.17, 0.17, 0.27, 6),
};

const shared = {
  tyre: new THREE.MeshLambertMaterial({ color: '#1b1d1f', flatShading: true }),
  hub: new THREE.MeshLambertMaterial({ color: '#8d9498', flatShading: true }),
  glass: new THREE.MeshLambertMaterial({ color: '#243a44', emissive: '#5c7e88', emissiveIntensity: 0.18 }),
  headlight: new THREE.MeshBasicMaterial({ color: '#fff0c2' }),
  taillight: new THREE.MeshBasicMaterial({ color: '#ff4a3a' }),
  black: new THREE.MeshLambertMaterial({ color: '#151b1e' }),
  chrome: new THREE.MeshLambertMaterial({ color: '#b9b9ae' }),
  policeBlue: new THREE.MeshBasicMaterial({ color: '#2f7dff' }),
  policeRed: new THREE.MeshBasicMaterial({ color: '#ff3b3b' }),
  policeOff: new THREE.MeshBasicMaterial({ color: '#27323c' }),
  taxiSign: new THREE.MeshBasicMaterial({ color: '#ffe08a' }),
};

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(geo.body, material);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function buildCarMesh(car) {
  const model = CAR_MODELS[car.modelId];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: car.color, flatShading: true });
  car.bodyMat = bodyMat;
  car.baseColor = new THREE.Color(car.color);
  const dark = new THREE.Color(car.color).multiplyScalar(0.55);
  const darkMat = new THREE.MeshLambertMaterial({ color: dark, flatShading: true });
  const L = model.length;
  const W = model.width;
  const H = model.height;

  const chassis = box(L * 0.98, 0.22, W * 1.0, shared.black, 0, 0.3, 0);
  group.add(chassis);
  const body = box(L, H * 0.42, W, bodyMat, 0, 0.62, 0);
  group.add(body);
  if (model.kind === 'van') {
    group.add(box(L * 0.94, H * 0.72, W * 0.96, bodyMat, 0.1, 1.02, 0));
    group.add(box(L * 0.16, H * 0.32, W * 0.9, shared.glass, L * 0.4, 1.12, 0));
  } else {
    const cabin = box(L * 0.44, H * 0.42, W * 0.82, shared.glass, -L * 0.06, H * 0.34 + 0.62, 0);
    group.add(cabin);
    group.add(box(L * 0.34, 0.08, W * 0.78, bodyMat, -L * 0.08, H * 0.34 + 0.62 + H * 0.2, 0));
    group.add(box(L * 0.1, H * 0.3, W * 0.8, darkMat, L * 0.22, 0.86, 0));
  }
  // Lights.
  for (const side of [-1, 1]) {
    group.add(box(0.08, 0.15, W * 0.22, shared.headlight, L * 0.5, 0.62, side * W * 0.29));
    group.add(box(0.07, 0.16, W * 0.2, shared.taillight, -L * 0.5, 0.64, side * W * 0.3));
  }
  // Wheels.
  car.wheels = [];
  for (const fx of [-1, 1]) {
    for (const fz of [-1, 1]) {
      const wheel = new THREE.Mesh(geo.wheel, shared.tyre);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(fx * L * 0.31, 0.34, fz * (W * 0.5 + 0.04));
      wheel.castShadow = true;
      group.add(wheel);
      const hub = new THREE.Mesh(geo.hub, shared.hub);
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(wheel.position);
      group.add(hub);
      car.wheels.push(wheel);
    }
  }
  // Bumpers.
  group.add(box(0.12, 0.18, W * 0.94, shared.chrome, L * 0.51, 0.4, 0));
  group.add(box(0.1, 0.16, W * 0.92, shared.chrome, -L * 0.51, 0.4, 0));
  group.add(box(0.04, 0.12, 0.5, shared.black, L * 0.52, 0.46, 0));

  if (model.kind === 'police') {
    for (const side of [-1, 1]) {
      group.add(box(L * 0.55, 0.34, 0.035, shared.black, 0, 0.68, side * (W * 0.5 + 0.02)));
      const decal = box(L * 0.32, 0.16, 0.02, shared.headlight, 0, 0.8, side * (W * 0.5 + 0.045));
      group.add(decal);
    }
    const barBase = box(0.2, 0.1, W * 0.62, shared.black, -0.1, H + 0.64, 0);
    group.add(barBase);
    car.sirenMats = [shared.policeRed, shared.policeBlue];
    car.sirenLamps = [];
    for (const z of [-0.28, 0.28]) {
      const lamp = box(0.18, 0.16, W * 0.22, shared.policeOff, -0.1, H + 0.74, z);
      car.sirenLamps.push(lamp);
      group.add(lamp);
    }
  }
  if (model.kind === 'taxi') {
    group.add(box(0.7, 0.2, 0.34, shared.taxiSign, -0.1, H * 0.78 + 0.66, 0));
    group.add(box(L * 0.9, 0.08, W + 0.02, shared.black, 0, 0.5, 0));
  }
  if (model.id === 'regent') {
    group.add(box(L * 0.86, 0.03, 0.5, new THREE.MeshBasicMaterial({ color: '#d8b25e' }), 0, H * 0.43 + 0.63, 0));
    group.add(box(0.6, 0.18, 0.7, shared.black, L * 0.28, H * 0.43 + 0.76, 0));
  }
  group.rotation.y = -car.heading;
  return group;
}

export class Vehicles {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.list = [];
    this.nextId = 1;
  }

  create(modelId, options = {}) {
    const model = CAR_MODELS[modelId] ?? CAR_MODELS.marlin;
    const color = options.color ?? model.colors[Math.floor((options.colorSeed ?? this.list.length) % model.colors.length)];
    const car = {
      id: this.nextId,
      modelId: model.id,
      model,
      color,
      x: options.x ?? 0,
      z: options.z ?? 0,
      heading: options.heading ?? 0,
      vx: 0,
      vz: 0,
      speed: 0,
      damage: options.damage ?? 0,
      driver: options.driver ?? 'traffic',
      controls: { throttle: 0, brake: 0, steer: 0, handbrake: false },
      siren: options.siren ?? false,
      callsign: options.callsign ?? null,
      role: options.role ?? null,
      ai: options.ai ?? null,
      dead: false,
      wrecked: false,
      exploded: false,
      smokeClock: 0,
      impactClock: 0,
      entered: false,
      lock: options.lock ?? false,
      target: options.target ?? false,
    };
    this.nextId += 1;
    car.mesh = buildCarMesh(car);
    car.mesh.position.set(car.x, this.world.heightAt(car.x, car.z) + 0.02, car.z);
    this.scene.add(car.mesh);
    this.list.push(car);
    return car;
  }

  remove(car) {
    const index = this.list.indexOf(car);
    if (index >= 0) this.list.splice(index, 1);
    this.scene.remove(car.mesh);
  }

  setControls(car, throttle, brake, steer, handbrake = false) {
    car.controls.throttle = clamp(throttle, -1, 1);
    car.controls.brake = clamp(brake, 0, 1);
    car.controls.steer = clamp(steer, -1, 1);
    car.controls.handbrake = handbrake;
  }

  damageCar(car, amount) {
    if (car.wrecked) return;
    car.damage = clamp(car.damage + amount, 0, 100);
    if (car.damage >= 100) {
      car.wrecked = true;
      car.speed = 0;
      car.controls.throttle = 0;
      car.controls.brake = 1;
      car.mesh.rotation.z = 0.02;
    }
  }

  step(car, dt) {
    const model = car.model;
    if (car.wrecked) {
      car.speed *= Math.max(0, 1 - dt * 2.5);
      car.vx *= Math.max(0, 1 - dt * 2.5);
      car.vz *= Math.max(0, 1 - dt * 2.5);
      car.x += car.vx * dt;
      car.z += car.vz * dt;
      return;
    }
    const controls = car.controls;
    const forward = { x: Math.cos(car.heading), z: Math.sin(car.heading) };
    const right = { x: -Math.sin(car.heading), z: Math.cos(car.heading) };
    let vf = car.vx * forward.x + car.vz * forward.z;
    let vr = car.vx * right.x + car.vz * right.z;
    const damagePenalty = 1 - car.damage * 0.004;

    if (controls.throttle !== 0) {
      const dir = controls.throttle > 0 ? 1 : -1;
      const force = model.accel * damagePenalty * (dir > 0 ? 1 : 0.62);
      vf += dir * force * Math.abs(controls.throttle) * dt;
    }
    if (controls.brake > 0) {
      const decel = model.brake * controls.brake * dt;
      if (Math.abs(vf) <= decel) vf = 0;
      else vf -= Math.sign(vf) * decel;
    }
    // Rolling and aero drag.
    vf -= Math.sign(vf) * (0.55 + Math.abs(vf) * 0.035) * dt;
    if (vf > model.maxSpeed * damagePenalty) vf = model.maxSpeed * damagePenalty;
    if (vf < -model.maxSpeed * 0.42) vf = -model.maxSpeed * 0.42;

    const grip = controls.handbrake ? 1.15 : model.grip;
    vr *= Math.exp(-grip * dt);

    const steerAuthority = clamp(Math.abs(vf) / 6, 0, 1);
    const turn = model.turn * steerAuthority * controls.steer * dt * (vf < -0.4 ? -1 : 1);
    car.heading = wrapAngle(car.heading + turn);
    if (controls.handbrake) {
      vf *= 1 - 0.6 * dt;
      car.heading += controls.steer * 0.4 * steerAuthority * dt;
    }

    car.vx = forward.x * vf + right.x * vr;
    car.vz = forward.z * vf + right.z * vr;
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    car.speed = vf;

    const beforeX = car.x;
    const beforeZ = car.z;
    this.world.resolveCircle(car, 1.32);
    const shoved = Math.hypot(car.x - beforeX, car.z - beforeZ);
    car.impactClock = Math.max(0, car.impactClock - dt);
    if (shoved > 0.01 && car.impactClock <= 0) {
      const impact = Math.min(45, Math.abs(vf) * 1.6 + 4);
      if (impact > 5) this.damageCar(car, impact * 0.35);
      car.speed *= 0.3;
      car.vx *= -0.18;
      car.vz *= -0.18;
      car.impactClock = 0.28;
      if (this.game) {
        this.game.chase.kick(0.24);
        this.game.effects.spark(car.x + Math.cos(car.heading) * 2, 0.6, car.z + Math.sin(car.heading) * 2, 4);
        if (impact > 12) this.game.audio?.crunch();
      }
    }
    if (car.x > this.world.roads.beachX + 6) {
      car.x = this.world.roads.beachX + 6;
      car.speed *= 0.6;
    }
    if (car.x >= this.world.roads.beachX + 4 && Math.abs(vf) > 10) {
      this.game?.effects.dust(car.x, car.z, 1);
    }
  }

  update(dt) {
    const time = this.game?.tick ?? 0;
    for (const car of this.list) {
      this.step(car, dt);
      const ground = this.world.heightAt(car.x, car.z) + 0.02;
      car.mesh.position.set(car.x, ground, car.z);
      car.mesh.rotation.y = -car.heading;
      if (car.wheels) {
        for (const wheel of car.wheels) wheel.rotation.y += car.speed * dt * 1.4;
      }
      if (car.bodyMat) {
        const t = car.damage / 100;
        car.bodyMat.color.copy(car.baseColor).lerp(new THREE.Color('#2a2b2a'), t * 0.75);
      }
      if (car.damage > 52 && !car.wrecked) {
        car.smokeClock += dt;
        if (car.smokeClock > 0.22 + (100 - car.damage) * 0.005) {
          car.smokeClock = 0;
          this.game?.effects.smoke(car.x - Math.cos(car.heading) * 1.6, 0.8, car.z - Math.sin(car.heading) * 1.6, 0.6);
        }
      }
      if (car.wrecked) {
        car.smokeClock += dt;
        if (car.smokeClock > 0.18) {
          car.smokeClock = 0;
          this.game?.effects.smoke(car.x, 0.9, car.z, 1.1);
          this.game?.effects.fire(car.x, 0.9, car.z);
        }
        if (!car.exploded && car.damage >= 100) {
          car.exploded = true;
          this.game?.effects.explosion(car.x, 1, car.z);
          this.game?.audio?.explosion();
          if (dist(car.x, car.z, this.game.player.x, this.game.player.z) < 9) {
            this.game.player.hurt(28, 'explosion');
          }
        }
      }
      if (car.sirenLamps) {
        const phase = Math.floor(time * 7) % 2;
        car.sirenLamps[0].material = phase === 0 ? shared.policeRed : shared.policeOff;
        car.sirenLamps[1].material = phase === 1 ? shared.policeBlue : shared.policeOff;
      }
    }
    // Car against car.
    for (let i = 0; i < this.list.length; i += 1) {
      const a = this.list[i];
      for (let j = i + 1; j < this.list.length; j += 1) {
        const b = this.list[j];
        if (Math.abs(a.x - b.x) > 12 || Math.abs(a.z - b.z) > 12) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const minD = (a.model.length + b.model.length) * 0.34;
        if (d >= minD || d < 0.0001) continue;
        const nx = dx / d;
        const nz = dz / d;
        const push = (minD - d) / 2;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        const rel = Math.abs(a.speed) + Math.abs(b.speed);
        if (rel > 5 && a.impactClock <= 0 && b.impactClock <= 0) {
          this.damageCar(a, Math.min(18, rel * 0.4));
          this.damageCar(b, Math.min(18, rel * 0.4));
          a.impactClock = 0.25;
          b.impactClock = 0.25;
          a.speed *= 0.55;
          b.speed *= 0.55;
          this.game?.effects.spark((a.x + b.x) / 2, 0.8, (a.z + b.z) / 2, 6);
          this.game?.chase.kick(0.22);
          this.game?.audio?.crunch();
        }
      }
    }
  }

  nearest(x, z, maxDist = 6) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.list) {
      if (car.wrecked) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  driveToward(car, tx, tz, targetSpeed, dt, options = {}) {
    const desired = Math.atan2(tz - car.z, tx - car.x);
    const diff = wrapAngle(desired - car.heading);
    const steer = clamp(diff * 2.6, -1, 1);
    const speedError = targetSpeed - Math.abs(car.speed);
    let throttle = 0;
    let brake = 0;
    if (speedError > 0.4) throttle = clamp(speedError * 0.35, 0.18, 1);
    if (speedError < -1.5) brake = clamp(-speedError * 0.22, 0.2, 1);
    if (options.handbrake) brake = 0.6;
    this.setControls(car, throttle, brake, steer, !!options.handbrake);
    void dt;
  }
}
