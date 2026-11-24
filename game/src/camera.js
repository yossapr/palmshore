// The chase camera: a smooth spring behind the player on foot or behind the car at speed.
// It also owns the aim yaw the character and the weapon code read.

import { clamp, lerp, wrapAngle } from './math.js';
import { VIEW, WORLD } from './config.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = -Math.PI / 2;
    this.pitch = 0.13;
    this.distance = 5.2;
    this.height = 2.8;
    this.mode = 'foot';
    this.shake = 0;
    this.shakeT = 0;
    this.speed = 0;
    this.position = { x: 0, y: 4, z: 0 };
    this.look = { x: 0, y: 1.2, z: 0 };
    this.currentPos = new THREE.Vector3();
    this.currentLook = new THREE.Vector3();
    this.initialised = false;
    this.aimYaw = this.yaw;
    this.lockedYaw = false;
    this.baseDistance = this.distance;
    this.baseHeight = this.height;
  }

  setMode(mode) {
    this.mode = mode;
    this.baseDistance = mode === 'car' ? 7.4 : 5.6;
    this.baseHeight = mode === 'car' ? 3.15 : 2.95;
  }

  reset(target, yaw = target.heading ?? 0) {
    this.yaw = yaw;
    this.aimYaw = yaw;
    this.speed = 0;
    const forward = this.forward();
    this.currentPos.set(
      target.x - forward.x * this.baseDistance,
      (target.y ?? 0) + this.baseHeight,
      target.z - forward.z * this.baseDistance,
    );
    this.currentLook.set(target.x + forward.x * 5, (target.y ?? 0) + 1.3, target.z + forward.z * 5);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
    this.initialised = true;
  }

  forward() {
    return { x: Math.cos(this.yaw), z: Math.sin(this.yaw) };
  }

  orbit(dx, dy) {
    if (this.lockedYaw) return;
    this.yaw = wrapAngle(this.yaw - dx * 0.0026);
    this.pitch = clamp(this.pitch + dy * 0.0018, -0.12, 0.42);
  }

  setShot(yaw, opts = {}) {
    this.lockedYaw = true;
    this.yaw = yaw;
    this.aimYaw = yaw;
    if (opts.distance) this.baseDistance = opts.distance;
    if (opts.height) this.baseHeight = opts.height;
    if (opts.pitch !== undefined) this.pitch = opts.pitch;
  }

  update(target, dt, options = {}) {
    const mode = options.mode ?? 'foot';
    const speed = options.speed ?? 0;
    const heading = target.heading ?? this.yaw;
    this.speed = speed;
    this.mode = mode;
    if (mode === 'car') {
      this.baseDistance = lerp(this.baseDistance, 7.2 + clamp(speed * 0.035, 0, 1.1), Math.min(1, dt * 2));
      this.baseHeight = lerp(this.baseHeight, 3.05, Math.min(1, dt * 2));
      if (!this.lockedYaw) {
        const follow = clamp(speed / 8, 0.35, 1);
        this.yaw = this.yaw + wrapAngle(heading - this.yaw) * Math.min(1, dt * 3.4 * follow);
      }
    } else {
      this.baseDistance = lerp(this.baseDistance, 5.6 + (options.aiming ? 0.9 : 0), Math.min(1, dt * 2));
      this.baseHeight = lerp(this.baseHeight, 2.95, Math.min(1, dt * 2));
      if (!this.lockedYaw && options.moveYaw !== undefined && options.moving) {
        const delta = wrapAngle(options.moveYaw - this.yaw);
        this.yaw = this.yaw + delta * Math.min(1, dt * 1.1);
      }
    }
    this.aimYaw = this.yaw;

    const forward = this.forward();
    const dist = this.baseDistance;
    const height = this.baseHeight + this.pitch * 2.2;
    let desiredX = target.x - forward.x * dist;
    let desiredZ = target.z - forward.z * dist;
    let desiredY = (target.y ?? 0) + height;
    // Keep the camera inside the city and above the pavement.
    desiredX = clamp(desiredX, 4, WORLD.cols * WORLD.pitch + WORLD.roadHalf + WORLD.beach - 2);
    desiredZ = clamp(desiredZ, 2, WORLD.rows * WORLD.pitch - 2);
    desiredY = Math.max(desiredY, 1.1);

    const catchUp = this.initialised ? 1 - Math.exp(-dt * 8.5) : 1;
    this.currentPos.x = lerp(this.currentPos.x, desiredX, catchUp);
    this.currentPos.y = lerp(this.currentPos.y, desiredY, catchUp);
    this.currentPos.z = lerp(this.currentPos.z, desiredZ, catchUp);

    const lookAhead = mode === 'car' ? 7.5 + clamp(speed * 0.18, 0, 5) : 3.2;
    const lookY = (target.y ?? 0) + (mode === 'car' ? 1.0 : 1.35) - this.pitch * 1.4;
    this.currentLook.x = lerp(this.currentLook.x, target.x + forward.x * lookAhead, 1 - Math.exp(-dt * 9));
    this.currentLook.y = lerp(this.currentLook.y, lookY, 1 - Math.exp(-dt * 8));
    this.currentLook.z = lerp(this.currentLook.z, target.z + forward.z * lookAhead, 1 - Math.exp(-dt * 9));

    this.shakeT += dt;
    this.shake = Math.max(0, this.shake - dt * 2.8);
    const sx = this.shake ? Math.sin(this.shakeT * 67) * this.shake * 0.22 : 0;
    const sy = this.shake ? Math.cos(this.shakeT * 81) * this.shake * 0.16 : 0;

    this.camera.position.set(
      this.currentPos.x + sx,
      this.currentPos.y + sy,
      this.currentPos.z,
    );
    this.camera.lookAt(this.currentLook.x, this.currentLook.y, this.currentLook.z);
    this.camera.fov = lerp(this.camera.fov, VIEW.fov + clamp(speed * 0.28, 0, 9), Math.min(1, dt * 2));
    this.camera.updateProjectionMatrix();
    this.initialised = true;
  }

  kick(amount) {
    this.shake = Math.max(this.shake, amount);
    this.shakeT = 0;
  }

  getAimDirection() {
    return { x: Math.cos(this.aimYaw), z: Math.sin(this.aimYaw) };
  }
}
