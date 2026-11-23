// The camera: follows Ray on foot or the car he is driving, leads a little in the direction of
// travel, widens as the speed climbs, and shakes when the world hits back. It also converts
// mouse pixels to world coordinates for aiming.

import { clamp, damp } from './math.js';

const BASE_VIEW = 548;
const CAR_VIEW = 610;

export function createCamera(width, height) {
  const cam = {
    x: 0,
    y: 0,
    zoom: height / BASE_VIEW,
    viewW: width,
    viewH: height,
    shakeMag: 0,
    shakeTime: 0,
    shakeMax: 1,
    offsetX: 0,
    offsetY: 0,
    lookX: 0,
    lookY: 0,
    fixed: false,
    canvasWidth: width,
    canvasHeight: height,

    resize(w, h) {
      cam.canvasWidth = w;
      cam.canvasHeight = h;
      if (!cam.fixed) cam.zoom = h / BASE_VIEW;
    },

    snap(x, y) {
      cam.x = x;
      cam.y = y;
    },

    pose(x, y, zoom) {
      cam.fixed = true;
      cam.x = x;
      cam.y = y;
      cam.zoom = zoom;
    },

    shake(mag, time) {
      cam.shakeMag = Math.max(cam.shakeMag, mag);
      cam.shakeTime = Math.max(cam.shakeTime, time);
      cam.shakeMax = Math.max(cam.shakeMax, time);
    },

    follow(game, dt) {
      const p = game.player;
      const inCar = p.mode === 'car' && p.car;
      const target = inCar ? p.car : p;
      const speed = inCar ? Math.hypot(target.vx, target.vy) : Math.hypot(p.vx, p.vy);
      const lead = clamp(speed * 0.32, 0, 92);
      const ang = inCar ? target.angle : Math.atan2(p.vy, p.vx);
      const tx = target.x + Math.cos(ang) * (speed > 24 ? lead : 0);
      const ty = target.y + Math.sin(ang) * (speed > 24 ? lead : 0);
      const rate = inCar ? 5.2 : 7.5;
      cam.x = damp(cam.x, tx, rate, dt);
      cam.y = damp(cam.y, ty, rate, dt);
      const wantZoom = (inCar ? CAR_VIEW : BASE_VIEW) + clamp(speed * 0.14, 0, 70);
      cam.zoom = damp(cam.zoom, cam.canvasHeight / wantZoom, 2.2, dt);
      cam.lookX = tx;
      cam.lookY = ty;
    },

    updateShake(dt) {
      if (cam.shakeTime > 0) {
        cam.shakeTime -= dt;
        const k = clamp(cam.shakeTime / Math.max(0.001, cam.shakeMax), 0, 1);
        cam.offsetX = (Math.random() - 0.5) * cam.shakeMag * k;
        cam.offsetY = (Math.random() - 0.5) * cam.shakeMag * k;
        if (cam.shakeTime <= 0) cam.shakeMag = 0;
      } else {
        cam.offsetX = 0;
        cam.offsetY = 0;
      }
    },

    /** The world rectangle on screen, with a margin for things just off the edge. */
    view(pad = 90) {
      const w = cam.canvasWidth / cam.zoom;
      const h = cam.canvasHeight / cam.zoom;
      return { x: cam.x - w / 2 - pad, y: cam.y - h / 2 - pad, w: w + pad * 2, h: h + pad * 2 };
    },

    apply(ctx) {
      ctx.setTransform(
        cam.zoom,
        0,
        0,
        cam.zoom,
        cam.canvasWidth / 2 - (cam.x + cam.offsetX) * cam.zoom,
        cam.canvasHeight / 2 - (cam.y + cam.offsetY) * cam.zoom,
      );
    },

    screenToWorld(sx, sy) {
      return {
        x: cam.x + cam.offsetX + (sx - cam.canvasWidth / 2) / cam.zoom,
        y: cam.y + cam.offsetY + (sy - cam.canvasHeight / 2) / cam.zoom,
      };
    },

    worldToScreen(wx, wy) {
      return {
        x: (wx - cam.x - cam.offsetX) * cam.zoom + cam.canvasWidth / 2,
        y: (wy - cam.y - cam.offsetY) * cam.zoom + cam.canvasHeight / 2,
      };
    },
  };
  return cam;
}
