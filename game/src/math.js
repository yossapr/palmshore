// Small, boring maths used everywhere. Kept free of game state.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function approach(value, target, delta) {
  if (value < target) return Math.min(value + delta, target);
  if (value > target) return Math.max(value - delta, target);
  return target;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function angleLerp(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function vecFromAngle(a, length = 1) {
  return { x: Math.cos(a) * length, y: Math.sin(a) * length };
}

// Distance from a point to a segment, with the closest point returned as well.
export function segmentPoint(ax, ay, bx, by, px, py) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1);
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return { t, x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
}

export function segmentHitsCircle(ax, ay, bx, by, cx, cy, r) {
  return segmentPoint(ax, ay, bx, by, cx, cy).dist <= r;
}

export function segmentHitsRect(ax, ay, bx, by, rect) {
  // Liang-Barsky clipping against an axis-aligned rectangle.
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const checks = [
    [-dx, ax - rect.x],
    [dx, rect.x + rect.w - ax],
    [-dy, ay - rect.y],
    [dy, rect.y + rect.h - ay],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return true;
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

export function circleRect(x, y, r, rect) {
  const nx = clamp(x, rect.x, rect.x + rect.w);
  const ny = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nx;
  const dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  const d = Math.sqrt(d2) || 0.0001;
  return { x: nx, y: ny, nx: dx / d, ny: dy / d, depth: r - d };
}

export function moveCircle(obj, dx, dy, radius, rects) {
  let x = obj.x + dx;
  let y = obj.y + dy;
  for (let pass = 0; pass < 3; pass += 1) {
    let bumped = false;
    for (const rect of rects) {
      const hit = circleRect(x, y, radius, rect);
      if (!hit) continue;
      x += hit.nx * hit.depth;
      y += hit.ny * hit.depth;
      bumped = true;
    }
    if (!bumped) break;
  }
  return { x, y };
}

export function nearestIndex(list, x, y, maxDist = Infinity) {
  let best = -1;
  let bestD = maxDist;
  for (let i = 0; i < list.length; i += 1) {
    const d = dist(x, y, list[i].x, list[i].y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function formatMoney(n) {
  const rounded = Math.round(n);
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return `${negative ? '-' : ''}$${out}`;
}

export function pad(n, size) {
  return String(n).padStart(size, '0');
}

export function formatDistance(px) {
  return `${Math.max(0, Math.round(px / 5))} M`;
}

export function niceAngle(a) {
  const deg = Math.round((a * 180) / Math.PI);
  return ((deg % 360) + 360) % 360;
}

export function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function rect(x, y, w, h) {
  return { x, y, w, h };
}

export function rectCenter(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rectExpand(r, amount) {
  return { x: r.x - amount, y: r.y - amount, w: r.w + amount * 2, h: r.h + amount * 2 };
}

export function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function polygonPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function blink(t, rate = 2) {
  return (t * rate) % 1 < 0.55;
}
