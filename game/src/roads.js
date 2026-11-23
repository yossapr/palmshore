// The street plan: six avenues north to south, five boulevards east to west, the blocks between
// them, and the queries the rest of the game uses to place things on the network. The grid is
// fixed (a hand-laid city, not a random one); its buildings and props are what the seed varies.

export const ROAD_HALF = 54;
export const WALK = 26;
export const BLOCK_INSET = ROAD_HALF + WALK;
export const AXIS_X = 'x'; // a road running east-west (varies in x, fixed y)
export const AXIS_Y = 'y'; // a road running north-south
/** Lane centre offsets either side of a road's centreline; [kerb, inside]. */
export const LANES = [17, 40];

export const VX = [300, 1000, 1700, 2400, 3100, 3800];
export const HY = [260, 960, 1660, 2360, 3060];

export const AVENUE_NAMES = ['Sunmint Avenue', 'Palmetto Way', 'Verano Boulevard', 'Neon Row', 'Coral Drive', 'Ocean Drive'];
export const STREET_NAMES = ['Sunray Boulevard', 'Palmshore Boulevard', 'Coral Avenue', 'Gannet Road', 'Marina Way'];

const PARK_CELL = { vi: 2, hi: 2 };

export function roadName(axis, index) {
  return axis === AXIS_X ? STREET_NAMES[index] ?? 'Service Road' : AVENUE_NAMES[index] ?? 'Service Road';
}

export function nodePoint(vi, hi) {
  return { x: VX[vi], y: HY[hi] };
}

/** The walkable loop a pedestrian follows round a block, down the middle of its pavement band. */
export function sidewalkLoop(block) {
  const inset = BLOCK_INSET - 13;
  return {
    x0: block.x0 + inset,
    y0: block.y0 + inset,
    x1: block.x1 - inset,
    y1: block.y1 - inset,
  };
}

function districtOf(cx, cy, vi, hi) {
  if (vi === PARK_CELL.vi && hi === PARK_CELL.hi) return 'park';
  if (cx > 3300) return 'beach';
  if (cy > 2540 && cx < 3160) return 'docks';
  if (cx < 1480) return 'suburb';
  if (cy < 900) return 'midtown';
  return 'downtown';
}

export function makeBlocks() {
  const blocks = [];
  for (let hi = 0; hi < HY.length - 1; hi += 1) {
    for (let vi = 0; vi < VX.length - 1; vi += 1) {
      const x0 = VX[vi];
      const y0 = HY[hi];
      const x1 = VX[vi + 1];
      const y1 = HY[hi + 1];
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtOf(cx, cy, vi, hi);
      blocks.push({
        id: `b${vi}-${hi}`, vi, hi, x0, y0, x1, y1, cx, cy, district,
        sidewalk: sidewalkLoop({ x0, y0, x1, y1 }),
      });
    }
  }
  return blocks;
}

export function makeIntersections() {
  const nodes = [];
  for (let hi = 0; hi < HY.length; hi += 1) {
    for (let vi = 0; vi < VX.length; vi += 1) nodes.push({ vi, hi, x: VX[vi], y: HY[hi] });
  }
  return nodes;
}

/** What the HUD calls the ground under a point. */
export function districtAt(x, y) {
  if (x > 4132) return { key: 'sea', label: 'Palmshore Bay' };
  if (x > 3878) return { key: 'beach', label: 'Coral Sands' };
  if (x > 3800 + BLOCK_INSET) return { key: 'beach', label: 'Ocean Walk' };
  if (y < 30 || y > 3250 || x < 40) return { key: 'edge', label: 'City Limits' };
  const vi = VX.findIndex((v, i) => x >= v && (i === VX.length - 1 || x < VX[i + 1]));
  const hi = HY.findIndex((v, i) => y >= v && (i === HY.length - 1 || y < HY[i + 1]));
  if (vi >= 0 && hi >= 0 && vi < VX.length - 1 && hi < HY.length - 1) {
    const block = { x0: VX[vi], y0: HY[hi], x1: VX[vi + 1], y1: HY[hi + 1], cx: (VX[vi] + VX[vi + 1]) / 2, cy: (HY[hi] + HY[hi + 1]) / 2 };
    const key = districtOf(block.cx, block.cy, vi, hi);
    return { key, label: DISTRICT_LABEL[key] ?? 'Palmshore' };
  }
  if (x > 3100) return { key: 'beach', label: 'Coral Strip' };
  if (y > 2540) return { key: 'docks', label: 'Gannet Docks' };
  if (x < 1480) return { key: 'suburb', label: 'Sunmint Acres' };
  return { key: 'downtown', label: 'Verano Heights' };
}

const DISTRICT_LABEL = {
  downtown: 'Verano Heights',
  beach: 'Coral Strip',
  docks: 'Gannet Docks',
  suburb: 'Sunmint Acres',
  midtown: 'Neon Row',
  park: 'Palmshore Park',
};

export const LANDMARKS = [
  { x: 2750, y: 1310, name: 'VERANO TOWER', district: 'downtown' },
  { x: 3450, y: 620, name: 'THE NAUTILUS', district: 'beach' },
  { x: 2035, y: 2010, name: 'PALMSHORE PARK', district: 'park' },
  { x: 1350, y: 2710, name: 'GULL BAY DOCKS', district: 'docks' },
  { x: 650, y: 610, name: 'SUNMINT MOTEL', district: 'suburb' },
];

/** A lane point on the nearest road: used to spawn rescue traffic and police out of sight. */
export function nearestLanePoint(x, y, axisPreference = null) {
  let best = null;
  for (let hi = 0; hi < HY.length; hi += 1) {
    for (const dir of [-1, 1]) {
      const lane = HY[hi] + dir * LANES[0];
      const d = Math.abs(y - lane);
      if (!best || d < best.d) best = { d, x, y: lane, axis: AXIS_X, road: hi, dir };
    }
  }
  for (let vi = 0; vi < VX.length; vi += 1) {
    for (const dir of [-1, 1]) {
      const lane = VX[vi] - dir * LANES[0];
      const d = Math.abs(x - lane);
      if (!best || d < best.d) best = { d, x: lane, y, axis: AXIS_Y, road: vi, dir };
    }
  }
  if (axisPreference === AXIS_Y) {
    let bestY = null;
    for (let vi = 0; vi < VX.length; vi += 1) {
      for (const dir of [-1, 1]) {
        const lane = VX[vi] - dir * LANES[0];
        const d = Math.abs(x - lane);
        if (!bestY || d < bestY.d) bestY = { d, x: lane, y, axis: AXIS_Y, road: vi, dir };
      }
    }
    return bestY;
  }
  return best;
}

/** Walkable ground: not inside a building, not in the sea, not past the city edge. */
export function isOnStreet(x, y) {
  for (let vi = 0; vi < VX.length; vi += 1) if (Math.abs(x - VX[vi]) <= ROAD_HALF) return true;
  for (let hi = 0; hi < HY.length; hi += 1) if (Math.abs(y - HY[hi]) <= ROAD_HALF) return true;
  return false;
}
