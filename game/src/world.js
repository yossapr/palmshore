// Builds Palmshore from one numeric seed: ten by eight blocks of downtown towers, beach motels,
// docks warehouses, a palm park and low suburbs, ringed by sand and water. It also owns the
// collision the player, cars and bullets share, and the named places the story visits.
// Nothing in this file draws.

import { CITY, CITY_WIDTH, CITY_HEIGHT, COAST_X, HARBOR_Y, PALETTE } from './config.js';
import { streamOf } from './random.js';
import { createRoads } from './roads.js';
import { clamp, dist } from './math.js';

const DOWNTOWN_NAMES = ['SUNRAY', 'NAUTILUS', 'VERANO', 'MERIDIAN', 'CORAL ARMS', 'PALM ROYALE', 'THE BISCAYNE', 'AZURE', 'CAPRI', 'MARISOL', 'SUNSET TOWER', 'THE REEF', 'GULFSTREAM', 'HALCYON', 'SOLANA', 'MIRADOR', 'BAHIA', 'COSTA VERDE', 'TRADE WINDS', 'SEA GATE', 'FLAMINGO', 'TIDEWATER', 'PELICAN HOUSE'];
const BEACH_NAMES = ['SEA BREEZE', 'THE PELICAN', 'COCONUT', 'SURFCOMBER', 'BLUE HERON', 'MOTEL SOL', 'SALTWATER', 'TIKI', 'CORAL SANDS', 'SAND DOLLAR', 'SEA HORSE', 'THE DRIFTWOOD', 'SUNSET MOTEL', 'PALM COVE', 'LAGUNA', 'MAR AZUL'];
const MIDTOWN_NAMES = ['CAFE VERANO', 'LA PALMA', 'BODEGA', 'RIPTIDE', 'MARIGOLD', 'PAPAYA', 'SUNSPOT', 'VINYL', 'EL REY', 'LAGOON', 'SUNRAY LIQUOR', 'TIDE POOL', 'THE CORNER', 'MERCADO', 'PELICAN CAFE', 'BLUE DOOR', 'SALT & LIME', 'HALO', 'STUDIO 9', 'THE ARCADE', 'PONCE MARKET', 'SUNSET DINER'];
const DOCK_NAMES = ['PIER 9', 'HARBOR COLD STORAGE', 'GULF STAR', 'BARNACLE', 'DOCK 4', 'SEA WALL FREIGHT', 'CRANE 4', 'SALT WORKS', 'TIDE LINE', 'BARGE 2', 'PIER 12', 'ANCHOR FREIGHT', 'DOCKYARD 7', 'THE ICE HOUSE'];
const HOUSE_NAMES = ['CASA LUNA', 'PALM HOUSE', 'EL SOL', 'MIRAMAR', 'CASA CORAL', 'THE SANDS', 'LOS OLIVOS', 'VILLA BAHIA', 'CASA MAR', 'LA CASITA', 'SUNNYSIDE', 'THE LAURELS'];

function districtAt(i, j) {
  if (i === CITY.cols - 1) return 'beach';
  if (i >= 3 && i <= 5 && j <= 1) return 'downtown';
  if (j >= CITY.rows - 2 && i <= 3) return 'docks';
  if ((i === 4 || i === 5) && j === 4) return 'park';
  if (i <= 1 && j <= 4) return 'suburbs';
  if (i <= 2 && j >= 5) return 'suburbs';
  return 'midtown';
}

function shoreline(x) {
  return COAST_X + Math.sin(x * 0.011) * 18 + Math.sin(x * 0.0031 + 1.7) * 26;
}

export function createWorld(seed) {
  const rng = streamOf(seed, 11);
  const roads = createRoads();
  const blocks = [];
  const buildings = [];
  const props = [];
  const palms = [];
  const parked = [];
  const solids = [];
  const landmarks = {};

  // A spatial hash keeps collision queries to the handful of solids under the moving thing.
  const CELL = 256;
  const buckets = new Map();
  const bucketKey = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;

  function addSolid(solid) {
    solid.id = solids.length;
    solids.push(solid);
    const x0 = Math.floor(solid.x / CELL);
    const x1 = Math.floor((solid.x + solid.w) / CELL);
    const y0 = Math.floor(solid.y / CELL);
    const y1 = Math.floor((solid.y + solid.h) / CELL);
    for (let gy = y0; gy <= y1; gy += 1) {
      for (let gx = x0; gx <= x1; gx += 1) {
        const key = `${gx},${gy}`;
        let list = buckets.get(key);
        if (!list) buckets.set(key, (list = []));
        list.push(solid);
      }
    }
  }

  function solidAt(x, y) {
    const list = buckets.get(bucketKey(x, y));
    if (!list) return null;
    for (const s of list) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
    }
    return null;
  }

  function streamAt(x, y) {
    return inWater(x, y);
  }

  function inWater(x, y) {
    if (x > shoreline(x) - 6) return true;
    if (y > HARBOR_Y + 24 + Math.sin(x * 0.02) * 10) return true;
    return false;
  }

  const world = {
    seed,
    width: CITY_WIDTH,
    height: CITY_HEIGHT,
    roads,
    blocks,
    buildings,
    props,
    palms,
    parked,
    solids,
    landmarks,
    water: { coastX: COAST_X, harborY: HARBOR_Y, shoreline },
    inWater,
    streamAt,
    solidAt,
    addSolid,
    isOnLand(x, y) {
      return !inWater(x, y);
    },
  };

  /** Inset a rect and split it into cells with breathing room. */
  function splitLot(lot, nx, ny, gap) {
    const cw = (lot.w - gap * (nx - 1)) / nx;
    const ch = (lot.h - gap * (ny - 1)) / ny;
    const out = [];
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        out.push({ x: lot.x + x * (cw + gap), y: lot.y + y * (ch + gap), w: cw, h: ch });
      }
    }
    return out;
  }

  function faceInfo(rect) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const blockLeft = Math.floor(cx / CITY.pitch);
    void blockLeft;
    // The nearest road centre on each side of the building decides the street face.
    let best = { side: 's', d: Infinity };
    const north = Math.abs(rect.y - (Math.round(rect.y / CITY.pitch) * CITY.pitch + CITY.roadW / 2));
    if (north < best.d) best = { side: 'n', d: north };
    const south = Math.abs(rect.y + rect.h - (Math.round((rect.y + rect.h) / CITY.pitch) * CITY.pitch + CITY.roadW / 2));
    if (south < best.d) best = { side: 's', d: south };
    const west = Math.abs(rect.x - (Math.round(rect.x / CITY.pitch) * CITY.pitch + CITY.roadW / 2));
    if (west < best.d) best = { side: 'w', d: west };
    const east = Math.abs(rect.x + rect.w - (Math.round((rect.x + rect.w) / CITY.pitch) * CITY.pitch + CITY.roadW / 2));
    if (east < best.d) best = { side: 'e', d: east };
    return best.side;
  }

  const usedNames = new Set();
  function uniqueName(name, district) {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    const list = district === 'downtown' ? DOWNTOWN_NAMES
      : district === 'beach' ? BEACH_NAMES
        : district === 'docks' ? DOCK_NAMES
          : district === 'suburbs' ? HOUSE_NAMES : MIDTOWN_NAMES;
    const alt = list.find((n) => !usedNames.has(n));
    if (alt) {
      usedNames.add(alt);
      return alt;
    }
    let n = 2;
    while (usedNames.has(`${name} ${n}`)) n += 1;
    usedNames.add(`${name} ${n}`);
    return `${name} ${n}`;
  }

  function addBuilding(rect, district, name, opts = {}) {
    const b = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.w),
      h: Math.round(rect.h),
      district,
      name: uniqueName(name, district),
      floors: opts.floors ?? 2,
      roof: opts.roof ?? rng.pick(PALETTE.roofs),
      wall: opts.wall ?? rng.pick(PALETTE.walls),
      trim: opts.trim ?? PALETTE.cream,
      sign: opts.sign ?? rng.pick(PALETTE.signs),
      awning: opts.awning ?? (district === 'suburbs' ? false : rng.chance(0.72)),
      awningColor: opts.awningColor ?? rng.pick(PALETTE.awning),
      pool: opts.pool ?? false,
      helipad: opts.helipad ?? false,
      props: [],
      face: faceInfo(rect),
      seed: rng.int(0, 9999),
      landmark: opts.landmark ?? null,
    };
    // Rooftop furniture: one to three pieces, richer towers get a pool or helipad.
    const roofCount = b.floors > 5 ? rng.int(3, 5) : rng.int(2, 3);
    for (let k = 0; k < roofCount; k += 1) {
      b.props.push({
        type: rng.pick(['ac', 'ac', 'vent', 'tank', 'skylight', 'solar', 'stair']),
        x: rect.x + rng.range(0.18, 0.82) * rect.w,
        y: rect.y + rng.range(0.22, 0.78) * rect.h,
        w: rng.range(14, 30),
        h: rng.range(10, 22),
        rot: rng.chance(0.3) ? Math.PI / 2 : 0,
      });
    }
    if (b.floors >= 8) b.helipad = b.helipad || rng.chance(0.28);
    addSolid({ x: b.x, y: b.y, w: b.w, h: b.h, kind: 'building', ref: b });
    buildings.push(b);
    return b;
  }

  function addParkedSpots(lot, district, count, angle) {
    for (let k = 0; k < count; k += 1) {
      const side = rng.int(0, 3);
      let x;
      let y;
      if (side === 0) {
        x = lot.x + rng.range(14, Math.max(20, lot.w - 14));
        y = lot.y + 18;
      } else if (side === 1) {
        x = lot.x + lot.w - 18;
        y = lot.y + rng.range(14, Math.max(20, lot.h - 14));
      } else if (side === 2) {
        x = lot.x + rng.range(14, Math.max(20, lot.w - 14));
        y = lot.y + lot.h - 18;
      } else {
        x = lot.x + 18;
        y = lot.y + rng.range(14, Math.max(20, lot.h - 14));
      }
      if (solidAt(x, y)) continue;
      parked.push({
        x,
        y,
        angle: angle ?? (district === 'beach' ? Math.PI / 2 : rng.chance(0.5) ? Math.PI / 2 : 0),
        type: rng.pick(district === 'beach' ? ['coupe', 'sedan', 'sports', 'van'] : ['sedan', 'coupe', 'taxi', 'van', 'pickup']),
        color: rng.pick(PALETTE.cars),
        district,
      });
    }
  }

  function streetFurniture(block) {
    const inset = CITY.sidewalk + 5;
    const corners = [
      { x: block.x + inset + 4, y: block.y + inset + 4 },
      { x: block.x + block.w - inset - 4, y: block.y + inset + 4 },
      { x: block.x + inset + 4, y: block.y + block.h - inset - 4 },
      { x: block.x + block.w - inset - 4, y: block.y + block.h - inset - 4 },
    ];
    corners.forEach((c, idx) => {
      if (rng.chance(0.72)) props.push({ type: 'lamp', x: c.x, y: c.y, seed: rng.int(0, 999) });
      if (idx === 0 && rng.chance(0.5)) props.push({ type: 'hydrant', x: c.x + 18, y: c.y + 30 });
      if (rng.chance(0.3)) props.push({ type: 'bin', x: c.x - 12, y: c.y + 44, seed: rng.int(0, 999) });
      if (block.district === 'beach' && rng.chance(0.7)) {
        props.push({ type: 'bench', x: c.x + rng.range(20, 60), y: c.y + 4, rot: 0 });
      }
    });
    // Palms along the kerb, plus planters and benches on the busier blocks.
    const leafy = block.district === 'downtown' || block.district === 'beach' || block.district === 'midtown';
    const palmCount = leafy ? 3 : 1;
    for (let k = 0; k < palmCount; k += 1) {
      const side = rng.int(0, 3);
      const along = rng.range(30, block.w - 30);
      const at = CITY.sidewalk - 7;
      palms.push({
        x: side === 0 || side === 2 ? block.x + along : side === 1 ? block.x + block.w - at : block.x + at,
        y: side === 1 || side === 3 ? block.y + along : side === 0 ? block.y + at : block.y + block.h - at,
        size: rng.range(0.8, 1.3),
        lean: rng.range(-0.25, 0.25),
        phase: rng.range(0, 6.28),
      });
    }
    if (leafy && rng.chance(0.7)) {
      props.push({ type: 'planter', x: block.x + block.w * 0.5 + rng.range(-40, 40), y: block.y + block.h - 16 });
    }
    if (leafy && rng.chance(0.4)) {
      props.push({ type: 'bench', x: block.x + 46, y: block.y + block.h - 18, rot: 0 });
    }
    if (rng.chance(0.5)) {
      const side = rng.chance(0.5);
      props.push({
        type: 'busstop',
        x: block.x + (side ? block.w - 30 : 30),
        y: block.y + block.h * 0.55,
        rot: side ? Math.PI : 0,
      });
    }
    if (rng.chance(0.35)) {
      props.push({ type: 'planter', x: block.x + block.w * 0.5, y: block.y + block.h - 14 });
    }
  }

  function parkBlock(block) {
    props.push({ type: 'pond', x: block.x + block.w * 0.54, y: block.y + block.h * 0.5, rx: block.w * 0.28, ry: block.h * 0.22 });
    for (let k = 0; k < 9; k += 1) {
      palms.push({
        x: block.x + rng.range(30, block.w - 30),
        y: block.y + rng.range(30, block.h - 30),
        size: rng.range(0.9, 1.4),
        lean: rng.range(-0.25, 0.25),
        phase: rng.range(0, 6.28),
      });
    }
    for (let k = 0; k < 4; k += 1) {
      props.push({ type: 'bench', x: block.x + 40 + k * (block.w - 80) / 3, y: block.y + block.h - 46, rot: 0 });
    }
    props.push({ type: 'fountain', x: block.x + block.w * 0.2, y: block.y + block.h * 0.28 });
    block.park = true;
  }

  // ---- the blocks -------------------------------------------------------------------------
  for (let j = 0; j < CITY.rows; j += 1) {
    for (let i = 0; i < CITY.cols; i += 1) {
      const district = districtAt(i, j);
      const x = i * CITY.pitch + CITY.roadW;
      const y = j * CITY.pitch + CITY.roadW;
      const block = {
        i,
        j,
        x,
        y,
        w: CITY.blockW,
        h: CITY.blockW,
        district,
        lot: {
          x: x + CITY.sidewalk,
          y: y + CITY.sidewalk,
          w: CITY.blockW - CITY.sidewalk * 2,
          h: CITY.blockW - CITY.sidewalk * 2,
        },
      };
      blocks.push(block);
      if (district === 'park') {
        parkBlock(block);
        streetFurniture(block);
        continue;
      }

      const lot = block.lot;
      if (district === 'downtown') {
        const cells = splitLot(lot, 2, 2, 9);
        for (const cell of cells) {
          if (rng.chance(0.08)) {
            // One cell becomes a pocket plaza with planters and a couple of cars.
            props.push({ type: 'planter', x: cell.x + cell.w * 0.5, y: cell.y + cell.h * 0.4 });
            props.push({ type: 'bench', x: cell.x + cell.w * 0.5, y: cell.y + cell.h * 0.7, rot: rng.range(0, 6.28) });
            palms.push({ x: cell.x + cell.w * 0.3, y: cell.y + cell.h * 0.6, size: rng.range(0.8, 1.15), lean: rng.range(-0.2, 0.2), phase: rng.range(0, 6.28) });
            addParkedSpots(cell, district, rng.int(1, 2));
            continue;
          }
          const r = {
            x: cell.x + rng.range(1, 7),
            y: cell.y + rng.range(1, 7),
            w: cell.w - rng.range(3, 15),
            h: cell.h - rng.range(3, 15),
          };
          if (r.w < 82 || r.h < 74) continue;
          addBuilding(r, district, rng.pick(DOWNTOWN_NAMES), {
            floors: rng.int(5, 14),
            pool: rng.chance(0.34),
            helipad: rng.chance(0.14),
          });
        }
        addParkedSpots(lot, district, rng.int(2, 4));
        for (let k = 0; k < 4; k += 1) {
          const px = k % 2 ? lot.x + lot.w - 12 : lot.x + 12;
          const py = k < 2 ? lot.y + 12 : lot.y + lot.h - 12;
          if (!solidAt(px, py)) props.push({ type: 'planter', x: px, y: py });
        }
      } else if (district === 'beach') {
        const motel = {
          x: lot.x + rng.range(0, 18),
          y: lot.y + rng.range(0, 12),
          w: lot.w - rng.range(10, 34),
          h: lot.h * 0.46,
        };
        addBuilding(motel, district, i === CITY.cols - 1 ? 'SEA BREEZE' : rng.pick(BEACH_NAMES), {
          floors: rng.int(2, 4),
          pool: rng.chance(0.6),
          awning: true,
          awningColor: rng.chance(0.5) ? PALETTE.teal : PALETTE.coral,
        });
        // The courtyard below the motel: pool, loungers, palms, parking.
        props.push({ type: 'pool', x: lot.x + lot.w * 0.32, y: lot.y + lot.h * 0.76, w: 132, h: 66, rot: 0 });
        for (let k = 0; k < 4; k += 1) {
          props.push({ type: 'lounger', x: lot.x + lot.w * 0.32 - 50 + k * 34, y: lot.y + lot.h * 0.76 + 48, rot: 0 });
        }
        for (let k = 0; k < 3; k += 1) {
          palms.push({
            x: lot.x + rng.range(20, lot.w - 20),
            y: lot.y + lot.h * rng.range(0.6, 0.94),
            size: rng.range(0.9, 1.3),
            lean: rng.range(-0.3, 0.3),
            phase: rng.range(0, 6.28),
          });
        }
        addParkedSpots(lot, district, rng.int(2, 4), Math.PI / 2);
      } else if (district === 'suburbs') {
        const cells = splitLot(lot, 2, 2, 20);
        for (const cell of cells) {
          if (rng.chance(0.16)) continue;
          const r = {
            x: cell.x + rng.range(10, 26),
            y: cell.y + rng.range(10, 26),
            w: cell.w - rng.range(30, 60),
            h: cell.h - rng.range(28, 56),
          };
          if (r.w < 90 || r.h < 70) continue;
          addBuilding(r, district, rng.pick(HOUSE_NAMES), { floors: rng.int(1, 2), roof: rng.pick(['#c98f6d', '#b97b5c', '#d4a07a', '#a9705a']), awning: false, pool: rng.chance(0.4) });
          // a driveway and hedge beside each house
          if (rng.chance(0.6)) {
            const dx = r.x + r.w + 12;
            if (dx + 14 < cell.x + cell.w) {
              props.push({ type: 'driveway', x: dx, y: r.y + 12, w: 26, h: 58, rot: 0 });
              parked.push({ x: dx + 13, y: r.y + 34, angle: 0, type: rng.pick(['sedan', 'pickup', 'coupe']), color: rng.pick(PALETTE.cars), district });
            }
          }
          if (rng.chance(0.5)) props.push({ type: 'hedge', x: cell.x + 6, y: cell.y + 6, w: cell.w - 12, h: 10, rot: 0 });
        }
        addParkedSpots(lot, district, rng.int(0, 2));
      } else if (district === 'docks') {
        const warehouse = {
          x: lot.x + 6,
          y: lot.y + 8,
          w: lot.w * 0.66,
          h: lot.h * 0.56,
        };
        addBuilding(warehouse, district, rng.pick(DOCK_NAMES), { floors: rng.int(1, 2), roof: rng.pick(['#8d9490', '#9aa09a', '#7f8a86']), awning: false });
        const yardX = lot.x + lot.w * 0.7;
        for (let k = 0; k < rng.int(2, 4); k += 1) {
          const cw = rng.range(46, 78);
          const ch = rng.range(18, 26);
          const cx = yardX + rng.range(0, Math.max(10, lot.x + lot.w - yardX - cw));
          const cy = lot.y + rng.range(10, lot.h - ch - 20);
          addSolid({ x: cx, y: cy, w: cw, h: ch, kind: 'container' });
          props.push({ type: 'container', x: cx, y: cy, w: cw, h: ch, color: rng.pick([PALETTE.coral, PALETTE.teal, '#b8863f', '#527a8a']) });
        }
        for (let k = 0; k < rng.int(2, 5); k += 1) {
          props.push({ type: 'crate', x: lot.x + rng.range(12, lot.w * 0.62), y: lot.y + lot.h * 0.7 + rng.range(0, 40), w: rng.range(18, 28), h: rng.range(16, 24) });
        }
        if (i <= 1) props.push({ type: 'crane', x: lot.x + lot.w * 0.85, y: lot.y + lot.h * 0.5, rot: rng.range(0, 1.2) });
        addParkedSpots(lot, district, rng.int(1, 3), Math.PI / 2);
      } else {
        const cells = splitLot(lot, 2, 2, 11);
        for (const cell of cells) {
          if (rng.chance(0.18)) {
            props.push({ type: 'planter', x: cell.x + cell.w * 0.5, y: cell.y + cell.h * 0.5 });
            addParkedSpots(cell, district, rng.int(1, 2));
            continue;
          }
          const r = {
            x: cell.x + rng.range(2, 9),
            y: cell.y + rng.range(2, 9),
            w: cell.w - rng.range(4, 17),
            h: cell.h - rng.range(4, 17),
          };
          if (r.w < 82 || r.h < 70) continue;
          addBuilding(r, district, rng.pick(MIDTOWN_NAMES), {
            floors: rng.int(2, 6),
            pool: rng.chance(0.18),
            awningColor: rng.pick(PALETTE.awning),
          });
        }
        addParkedSpots(lot, district, rng.int(1, 3));
      }
      streetFurniture(block);
    }
  }

  // ---- sand, promenade, palms and the pier ------------------------------------------------
  for (let k = 0; k < 120; k += 1) {
    const x = roads.verticals[CITY.cols].x + 60 + rng.range(0, CITY.beachW - 90);
    if (x > shoreline(x) - 34) continue;
    const y = rng.range(60, CITY_HEIGHT - 80);
    const roll = rng();
    if (roll < 0.56) {
      palms.push({ x, y, size: rng.range(0.9, 1.55), lean: rng.range(-0.35, 0.35), phase: rng.range(0, 6.28) });
    } else if (roll < 0.72) {
      props.push({ type: 'umbrella', x, y, color: rng.pick([PALETTE.coral, PALETTE.teal, '#e8b45a']), rot: rng.range(0, 6.28) });
      props.push({ type: 'lounger', x: x + 26, y: y + 14, rot: rng.range(-0.2, 0.2) });
    } else if (roll < 0.8) {
      props.push({ type: 'dune', x, y, w: rng.range(28, 70), h: rng.range(14, 30), rot: rng.range(0, 3.1) });
    } else if (roll < 0.86) {
      props.push({ type: 'lifeguard', x, y, rot: 0 });
    } else if (roll < 0.92) {
      props.push({ type: 'volley', x, y, rot: 0 });
    }
  }
  // A pier that walks out over the water from the beach.
  for (let k = 0; k < 7; k += 1) {
    const px = roads.verticals[CITY.cols].x + 130;
    props.push({ type: 'pier', x: px, y: CITY_HEIGHT * 0.52 + k * 46, w: 30, h: 44, rot: 0 });
  }
  props.push({ type: 'pierhut', x: roads.verticals[CITY.cols].x + 118, y: CITY_HEIGHT * 0.52 + 280, rot: 0 });
  palms.push({ x: roads.verticals[CITY.cols].x + 120, y: CITY_HEIGHT * 0.52 + 330, size: 1.2, lean: 0.2, phase: 1.2 });

  // Docks: bollards, a crane, fishing boats and a long quay.
  for (let x = 120; x < CITY_WIDTH * 0.72; x += 150) {
    props.push({ type: 'bollard', x, y: HARBOR_Y + 8 });
  }
  for (let k = 0; k < 5; k += 1) {
    props.push({ type: 'boat', x: 300 + k * 560 + rng.range(-40, 40), y: HARBOR_Y + 100 + rng.range(-10, 30), rot: rng.range(-0.1, 0.1), color: rng.pick([PALETTE.cream, PALETTE.teal, PALETTE.coral]) });
  }
  for (let k = 0; k < 3; k += 1) {
    props.push({ type: 'hpier', x: 760 + k * 1250, y: HARBOR_Y + 8, w: 38, h: 150 + rng.range(0, 40), rot: 0 });
  }
  props.push({ type: 'ship', x: 1880, y: HARBOR_Y + 130, w: 300, h: 66, rot: 0.02 });
  props.push({ type: 'ship', x: 4100, y: HARBOR_Y + 150, w: 230, h: 54, rot: -0.03 });
  // A second road-side palm line on the coast boulevard.
  for (let y = 90; y < CITY_HEIGHT - 120; y += 150) {
    palms.push({ x: roads.verticals[CITY.cols].x + 54, y: y + rng.range(-20, 20), size: rng.range(1, 1.5), lean: -0.3, phase: rng.range(0, 6.28) });
  }
  for (let k = 0; k < 70; k += 1) {
    const b = rng.pick(blocks);
    if (b.district === 'downtown' || b.district === 'docks') continue;
    const side = rng.int(0, 3);
    const x = side === 0 ? b.x + 6 : side === 1 ? b.x + b.w - 6 : b.x + rng.range(10, b.w - 10);
    const y = side === 2 ? b.y + 6 : side === 3 ? b.y + b.h - 6 : b.y + rng.range(10, b.h - 10);
    palms.push({ x, y, size: rng.range(0.8, 1.2), lean: rng.range(-0.2, 0.2), phase: rng.range(0, 6.28) });
  }

  // ---- named places the story uses --------------------------------------------------------
  function findBuilding(name, district) {
    return buildings.find((b) => b.name === name && (!district || b.district === district)) ?? null;
  }
  function doorOf(b, fallback) {
    if (!b) return fallback;
    const f = b.face;
    if (f === 'n') return { x: b.x + b.w / 2, y: b.y - 26 };
    if (f === 's') return { x: b.x + b.w / 2, y: b.y + b.h + 26 };
    if (f === 'w') return { x: b.x - 26, y: b.y + b.h / 2 };
    return { x: b.x + b.w + 26, y: b.y + b.h / 2 };
  }

  const sunray = findBuilding('SUNRAY', 'downtown') ?? buildings.find((b) => b.district === 'downtown');
  if (sunray) {
    sunray.name = 'SUNRAY';
    sunray.floors = Math.max(8, sunray.floors);
    sunray.pool = true;
    landmarks.sunray = { x: sunray.x + sunray.w / 2, y: sunray.y + sunray.h / 2, building: sunray, door: doorOf(sunray) };
  }
  const nautilus = findBuilding('NAUTILUS', 'downtown') ?? buildings.filter((b) => b.district === 'downtown')[1];
  if (nautilus) {
    nautilus.name = 'NAUTILUS';
    nautilus.floors = Math.max(10, nautilus.floors);
    landmarks.nautilus = { x: nautilus.x + nautilus.w / 2, y: nautilus.y + nautilus.h / 2, building: nautilus, door: doorOf(nautilus) };
  }
  const coral = findBuilding('CORAL ARMS') ?? buildings.find((b) => b.district === 'beach');
  if (coral) {
    coral.name = 'CORAL ARMS';
    landmarks.coralArms = { x: coral.x + coral.w / 2, y: coral.y + coral.h / 2, building: coral, door: doorOf(coral) };
  }
  const warehouse = buildings.find((b) => b.district === 'docks' && b.name === 'PIER 9') ?? buildings.find((b) => b.district === 'docks');
  if (warehouse) {
    warehouse.name = 'PIER 9';
    landmarks.pier9 = { x: warehouse.x + warehouse.w / 2, y: warehouse.y + warehouse.h / 2, building: warehouse, door: doorOf(warehouse) };
  }
  const storage = buildings.find((b) => b.district === 'docks' && b !== warehouse);
  if (storage) {
    storage.name = 'TIDE LINE';
    landmarks.storage = { x: storage.x + storage.w / 2, y: storage.y + storage.h / 2, building: storage, door: doorOf(storage) };
  }
  const hospital = buildings.find((b) => b.district === 'midtown' && b.floors >= 4) ?? buildings.find((b) => b.district === 'midtown');
  if (hospital) {
    hospital.name = 'ST. AUGUSTINE';
    hospital.sign = PALETTE.teal;
    landmarks.hospital = { x: hospital.x + hospital.w / 2, y: hospital.y + hospital.h / 2, building: hospital, door: doorOf(hospital) };
  }
  const police = buildings.find((b) => b.district === 'midtown' && b !== hospital) ?? buildings[0];
  if (police) {
    police.name = 'PALMSHORE P.D.';
    police.sign = '#2b4a6b';
    landmarks.police = { x: police.x + police.w / 2, y: police.y + police.h / 2, building: police, door: doorOf(police) };
  }
  const safe = buildings.find((b) => b.district === 'suburbs') ?? buildings[0];
  if (safe) {
    safe.name = 'CASA LUNA';
    landmarks.safehouse = { x: safe.x + safe.w / 2, y: safe.y + safe.h / 2, building: safe, door: doorOf(safe) };
  }

  const boathouse = roads.node(CITY.cols, CITY.rows);
  landmarks.marina = { x: boathouse.x - 180, y: HARBOR_Y + 60 };
  landmarks.pier = { x: roads.verticals[CITY.cols].x + 145, y: CITY_HEIGHT * 0.52 + 160 };
  const courierBlock = blocks.find((b) => b.i === 5 && b.j === 3) ?? blocks[0];
  landmarks.courier = { x: courierBlock.x + 50, y: courierBlock.y + courierBlock.h - 56 };
  landmarks.park = {
    x: blocks.find((b) => b.i === 4 && b.j === 4).x + CITY.blockW / 2,
    y: blocks.find((b) => b.i === 4 && b.j === 4).y + CITY.blockW / 2,
  };
  for (const key of ['sunray', 'nautilus', 'coralArms', 'pier9', 'storage', 'hospital', 'police', 'safehouse']) {
    if (landmarks[key]?.building) landmarks[key].building.isLandmark = true;
  }
  const landmarkNames = new Set(buildings.filter((b) => b.isLandmark).map((b) => b.name));
  for (const b of buildings) {
    if (b.isLandmark) continue;
    if (landmarkNames.has(b.name)) {
      let n = 2;
      while (landmarkNames.has(`${b.name} ${n}`)) n += 1;
      b.name = `${b.name} ${n}`;
      landmarkNames.add(b.name);
    }
  }

  landmarks.spawn = landmarks.safehouse ? { x: landmarks.safehouse.door.x + 14, y: landmarks.safehouse.door.y + 18 } : { x: roads.node(2, 3).x - 40, y: roads.node(2, 3).y + 46 };

  // ---- collision --------------------------------------------------------------------------
  /** Push a circle out of every solid it overlaps; returns the corrected point and the hit. */
  function collideCircle(x, y, r) {
    let px = x;
    let py = y;
    let hit = null;
    const keys = new Set();
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) keys.add(`${gx + ox},${gy + oy}`);
    }
    for (const key of keys) {
      const list = buckets.get(key);
      if (!list) continue;
      for (const s of list) {
        const nx = clamp(px, s.x, s.x + s.w);
        const ny = clamp(py, s.y, s.y + s.h);
        const dx = px - nx;
        const dy = py - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;
        if (d2 > 0.001) {
          const d = Math.sqrt(d2);
          px = nx + (dx / d) * r;
          py = ny + (dy / d) * r;
          hit = { nx: dx / d, ny: dy / d, depth: r - d, solid: s };
        } else {
          const left = px - s.x;
          const right = s.x + s.w - px;
          const top = py - s.y;
          const bottom = s.y + s.h - py;
          const m = Math.min(left, right, top, bottom);
          if (m === left) { px = s.x - r; hit = { nx: -1, ny: 0, depth: r + left, solid: s }; }
          else if (m === right) { px = s.x + s.w + r; hit = { nx: 1, ny: 0, depth: r + right, solid: s }; }
          else if (m === top) { py = s.y - r; hit = { nx: 0, ny: -1, depth: r + top, solid: s }; }
          else { py = s.y + s.h + r; hit = { nx: 0, ny: 1, depth: r + bottom, solid: s }; }
        }
      }
    }
    // The park pond and the sea wall.
    for (const p of props) {
      if (p.type !== 'pond') continue;
      const dx = px - p.x;
      const dy = py - p.y;
      const d = Math.hypot(dx, dy);
      const rr = Math.min(p.rx, p.ry);
      if (d < rr + r) {
        const k = (rr + r) / Math.max(1, d);
        px = p.x + dx * k;
        py = p.y + dy * k;
        hit = hit ?? { nx: -dx / d, ny: -dy / d, depth: 1, solid: null };
      }
    }
    if (inWater(px, py)) {
      // Callers treat water as a wall and keep their previous dry position.
      hit = { nx: 0, ny: 0, depth: 1, solid: null, water: true };
    }
    return { x: px, y: py, hit };
  }

  function nearBuilding(x, y, radius = 40) {
    for (const b of buildings) {
      if (dist(x, y, b.x + b.w / 2, b.y + b.h / 2) < Math.max(b.w, b.h) / 2 + radius) {
        if (x > b.x - radius && x < b.x + b.w + radius && y > b.y - radius && y < b.y + b.h + radius) return b;
      }
    }
    return null;
  }

  world.collideCircle = collideCircle;
  world.nearBuilding = nearBuilding;
  world.faceInfo = faceInfo;
  world.palms.sort((a, b) => a.y - b.y);
  return world;
}
