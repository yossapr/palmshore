// Small maths helpers shared by the simulation: clamping, interpolation, angles, distances and
// the vector test the car and bullet collision code needs. No state, no drawing.

export const TAU = Math.PI * 2;

export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent easing toward a target. */
export function damp(a, b, rate, dt) {
  return lerp(a, b, 1 - Math.exp(-rate * dt));
}

export function sign(value) {
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function angleDiff(a, b) {
  return wrapAngle(b - a);
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function smoothstep(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t) {
  t = clamp(t, 0, 1);
  return 1 - (1 - t) ** 3;
}

/** Deterministic hash noise in [0,1) from two integers, for stable texture-like variation. */
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Circle against an axis-aligned rectangle: the pushed-out position plus the overlap depth. */
export function pushOutRect(x, y, r, rect) {
  const nx = clamp(x, rect.x, rect.x + rect.w);
  const ny = clamp(y, rect.y, rect.y + rect.h);
  let dx = x - nx;
  let dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * r, y: ny + (dy / d) * r, nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Centre inside the rectangle: push out of the nearest side.
  const left = x - rect.x;
  const right = rect.x + rect.w - x;
  const top = y - rect.y;
  const bottom = rect.y + rect.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: rect.x - r, y, nx: -1, ny: 0, depth: r + left };
  if (m === right) return { x: rect.x + rect.w + r, y, nx: 1, ny: 0, depth: r + right };
  if (m === top) return { x, y: rect.y - r, nx: 0, ny: -1, depth: r + top };
  return { x, y: rect.y + rect.h + r, nx: 0, ny: 1, depth: r + bottom };
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Shrink a rect toward its centre, used for parapets and inset roofs. */
export function insetRect(rect, by) {
  return { x: rect.x + by, y: rect.y + by, w: rect.w - by * 2, h: rect.h - by * 2 };
}

/** The facing (a unit vector) of a building toward the nearest road, for signs and awnings. */
export function facingOf(rect, world) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let best = null;
  for (const edge of world.edgesOf(rect)) {
    const d = Math.abs(edge.distance);
    if (!best || d < best.distance) best = { ...edge, distance: d, cx, cy };
  }
  return best;
}
