// The camera: it trails the player (or the car) with a little look-ahead in the direction of
// travel, widens as the speed rises, shakes on impacts, and never shows the void past the city.

import { CAMERA, WORLD } from './config.js';
import { clamp, damp } from './math.js';
import { speedOf } from './vehicles.js';

export function createCamera(x, y) {
  return {
    x, y, zoom: CAMERA.foot, targetZoom: CAMERA.foot, shakeX: 0, shakeY: 0,
    bounds: { x0: x - 900, y0: y - 500, x1: x + 900, y1: y + 500 },
  };
}

export function cameraFocus(game) {
  const player = game.player;
  if (player.inCar) {
    const car = player.inCar;
    return { x: car.x, y: car.y, vx: car.vx, vy: car.vy, speed: speedOf(car) };
  }
  return { x: player.x, y: player.y, vx: player.vx, vy: player.vy, speed: Math.hypot(player.vx, player.vy) };
}

export function updateCamera(camera, game, dt, viewWidth, viewHeight) {
  const focus = cameraFocus(game);
  const ahead = CAMERA.lookAhead;
  const targetX = focus.x + focus.vx * ahead;
  const targetY = focus.y + focus.vy * ahead;
  const rate = CAMERA.smooth;
  camera.x = damp(camera.x, targetX, rate, dt);
  camera.y = damp(camera.y, targetY, rate, dt);
  const carSpeed = focus.speed ?? 0;
  const base = game.player.inCar ? CAMERA.car : CAMERA.foot;
  const speedZoom = game.player.inCar
    ? clamp(carSpeed / 330, 0, 1) * (base - CAMERA.min)
    : 0;
  camera.targetZoom = game.cameraOverride ?? base - speedZoom;
  camera.zoom = damp(camera.zoom, camera.targetZoom, CAMERA.zoomSmooth, dt);
  const halfW = viewWidth / (2 * camera.zoom);
  const halfH = viewHeight / (2 * camera.zoom);
  camera.x = clamp(camera.x, halfW - 120, Math.max(halfW - 120, WORLD.width + 1000 - halfW));
  camera.y = clamp(camera.y, halfH - 90, Math.max(halfH - 90, WORLD.height + 60 - halfH));
  if (game.shake > 0.05) {
    camera.shakeX = (Math.random() - 0.5) * game.shake;
    camera.shakeY = (Math.random() - 0.5) * game.shake;
  } else {
    camera.shakeX = 0;
    camera.shakeY = 0;
  }
  camera.bounds = {
    x0: camera.x - halfW - 80,
    y0: camera.y - halfH - 80,
    x1: camera.x + halfW + 80,
    y1: camera.y + halfH + 80,
  };
}

export function worldToScreen(camera, x, y, width, height) {
  return {
    x: (x - camera.x) * camera.zoom + width / 2 + camera.shakeX,
    y: (y - camera.y) * camera.zoom + height / 2 + camera.shakeY,
  };
}

export function screenToWorld(camera, x, y, width, height) {
  return {
    x: (x - width / 2 - camera.shakeX) / camera.zoom + camera.x,
    y: (y - height / 2 - camera.shakeY) / camera.zoom + camera.y,
  };
}
