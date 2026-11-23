// The street network Palmshore is laid on: a lattice of intersections joined by segments,
// each with two lanes either way. Traffic and police navigate it, the minimap draws it and
// the HUD reads the nearest street's name from it. Nothing here draws a pixel.

import { CITY, CITY_WIDTH, CITY_HEIGHT } from './config.js';
import { TAU } from './math.js';

const LANES = [21, 45];

const VERTICAL_NAMES = ['PALMETTO WAY', 'ALAMEDA ST', 'CYPRESS AVE', 'BISCAYA DR', 'NAUTILUS BLVD', 'CORAL WAY', 'SUNRAY AVE', 'TIDE LINE', 'MARINA DR', 'SUNSET DR', 'OCEAN BLVD'];
const HORIZONTAL_NAMES = ['SUNRISE BLVD', 'VERANO ST', 'CORAL ARMS WAY', 'TIDE LINE', 'PELICAN ST', 'DOCK ST', 'HARBOR WAY', 'MANGROVE AVE', 'SEA WALL'];

export function createRoads() {
  const nodes = [];
  for (let j = 0; j <= CITY.rows; j += 1) {
    const row = [];
    for (let i = 0; i <= CITY.cols; i += 1) {
      row.push({
        i,
        j,
        x: i * CITY.pitch + CITY.roadW / 2,
        y: j * CITY.pitch + CITY.roadW / 2,
      });
    }
    nodes.push(row);
  }

  const verticals = [];
  for (let i = 0; i <= CITY.cols; i += 1) {
    verticals.push({ i, x: i * CITY.pitch + CITY.roadW / 2, name: VERTICAL_NAMES[i] ?? 'OCEAN BLVD', coast: i === CITY.cols });
  }
  const horizontals = [];
  for (let j = 0; j <= CITY.rows; j += 1) {
    horizontals.push({ i: j, y: j * CITY.pitch + CITY.roadW / 2, name: HORIZONTAL_NAMES[j] ?? 'SEA WALL', harbor: j === CITY.rows });
  }

  function node(i, j) {
    const col = nodes[Math.max(0, Math.min(CITY.rows, j))];
    return col ? col[Math.max(0, Math.min(CITY.cols, i))] : null;
  }

  function neighbors(i, j) {
    const out = [];
    if (i > 0) out.push({ i: i - 1, j, dx: -1, dy: 0 });
    if (i < CITY.cols) out.push({ i: i + 1, j, dx: 1, dy: 0 });
    if (j > 0) out.push({ i, j: j - 1, dx: 0, dy: -1 });
    if (j < CITY.rows) out.push({ i, j: j + 1, dx: 0, dy: 1 });
    return out;
  }

  /** A lane's endpoints at a node, offset to the right of travel. */
  function lanePoint(a, dir, lane, t) {
    const nx = node(a.i + dir.dx, a.j + dir.dy);
    const perpX = -dir.dy;
    const perpY = dir.dx;
    const off = LANES[lane % LANES.length];
    const sx = a.x + perpX * off;
    const sy = a.y + perpY * off;
    const ex = nx.x + perpX * off;
    const ey = ny(nx) + perpY * off;
    return { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t, angle: Math.atan2(dir.dy, dir.dx), nx, ex, ey, sx, sy };
  }

  function ny(n) {
    return n.y;
  }

  /** The exact lane centre for a node, a heading and a lane index. */
  function railPoint(n, dir, lane, t, out = {}) {
    const nx = node(n.i + dir.dx, n.j + dir.dy) ?? n;
    const off = LANES[lane % LANES.length];
    const px = -dir.dy;
    const py = dir.dx;
    const sx = n.x + px * off;
    const sy = n.y + py * off;
    const ex = nx.x + px * off;
    const ey = nx.y + py * off;
    out.x = sx + (ex - sx) * t;
    out.y = sy + (ey - sy) * t;
    out.angle = Math.atan2(dir.dy, dir.dx);
    out.sx = sx;
    out.sy = sy;
    out.ex = ex;
    out.ey = ey;
    return out;
  }

  function spawnRoute(rng, near) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const n = near
        ? node(
            Math.max(0, Math.min(CITY.cols, Math.round((near.x - CITY.roadW / 2) / CITY.pitch))),
            Math.max(0, Math.min(CITY.rows, Math.round((near.y - CITY.roadW / 2) / CITY.pitch))),
          )
        : node(rng.int(0, CITY.cols), rng.int(0, CITY.rows));
      const options = neighbors(n.i, n.j);
      if (!options.length) continue;
      const dir = rng.pick(options);
      const lane = rng.int(0, LANES.length - 1);
      const t = rng.range(0.1, 0.9);
      const p = railPoint(n, dir, lane, t);
      return { node: n, dir, lane, t, x: p.x, y: p.y, angle: p.angle };
    }
    const n = node(2, 2);
    const dir = { dx: 1, dy: 0 };
    const p = railPoint(n, dir, 0, 0.3);
    return { node: n, dir, lane: 0, t: 0.3, x: p.x, y: p.y, angle: p.angle };
  }

  function nextRoute(rng, n, dir, lane) {
    const options = neighbors(n.i, n.j).filter((o) => !(o.dx === -dir.dx && o.dy === -dir.dy));
    const choices = options.length ? options : neighbors(n.i, n.j);
    const straight = choices.find((o) => o.dx === dir.dx && o.dy === dir.dy);
    const next = straight && rng.chance(0.56) ? straight : rng.pick(choices);
    const nextLane = rng.chance(0.7) ? lane : rng.int(0, LANES.length - 1);
    return { dir: next, lane: nextLane };
  }

  function nearestLane(x, y) {
    let best = null;
    for (let i = 0; i <= CITY.cols; i += 1) {
      const vx = i * CITY.pitch + CITY.roadW / 2;
      const d = Math.abs(x - vx);
      if (!best || d < best.d) best = { d, axis: 'v', i, x: vx };
    }
    for (let j = 0; j <= CITY.rows; j += 1) {
      const hy = j * CITY.pitch + CITY.roadW / 2;
      const d = Math.abs(y - hy);
      if (!best || d < best.d) best = { d, axis: 'h', i: j, y: hy };
    }
    return best;
  }

  /** A point on the nearest road, with a heading along it: where police and traffic appear. */
  function nearestRoadPoint(x, y) {
    const near = nearestLane(x, y);
    if (near.axis === 'v') {
      const hy = Math.round((y - CITY.roadW / 2) / CITY.pitch) * CITY.pitch + CITY.roadW / 2;
      return { x: near.x, y: Math.max(CITY.roadW / 2, Math.min(CITY_HEIGHT - CITY.roadW / 2, y)), angle: Math.atan2(0, 1), axis: 'v', lineY: hy };
    }
    return { x: Math.max(CITY.roadW / 2, Math.min(CITY_WIDTH - CITY.roadW / 2, x)), y: near.y, angle: 0, axis: 'h' };
  }

  function isOnRoad(x, y) {
    const near = nearestLane(x, y);
    return near.d <= CITY.roadW / 2;
  }

  /** Street names for the HUD: the nearest named road, and its cross street. */
  function streetAt(x, y) {
    const near = nearestLane(x, y);
    if (near.axis === 'v') {
      const h = Math.round((y - CITY.roadW / 2) / CITY.pitch);
      return { street: VERTICAL_NAMES[near.i] ?? 'OCEAN BLVD', cross: HORIZONTAL_NAMES[Math.max(0, Math.min(CITY.rows, h))] ?? 'SEA WALL', district: near.i === CITY.cols ? 'beach' : near.i <= 1 ? 'suburbs' : 'city' };
    }
    const v = Math.round((x - CITY.roadW / 2) / CITY.pitch);
    return { street: HORIZONTAL_NAMES[near.i] ?? 'SEA WALL', cross: VERTICAL_NAMES[Math.max(0, Math.min(CITY.cols, v))] ?? 'OCEAN BLVD', district: 'city' };
  }

  return {
    nodes,
    verticals,
    horizontals,
    lanes: LANES,
    node,
    neighbors,
    lanePoint,
    railPoint,
    spawnRoute,
    nextRoute,
    nearestLane,
    nearestRoadPoint,
    isOnRoad,
    streetAt,
    width: CITY_WIDTH,
    height: CITY_HEIGHT,
  };
}

/** The angle of a direction on the lattice, used when a route turns. */
export function dirAngle(dir) {
  return Math.atan2(dir.dy, dir.dx) < 0 ? Math.atan2(dir.dy, dir.dx) + TAU : Math.atan2(dir.dy, dir.dx);
}
