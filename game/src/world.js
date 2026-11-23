// Palmshore itself: the blocks are generated from the road plan and the seed, then filled with
// buildings, palms, street furniture, beach props, parking lots and the named places the story
// visits. This file also owns collision (buildings, the sea, the city edge) and line of sight.

import { createRandom, makeHelpers } from './random.js';
import {
  BLOCK_INSET, HY, LANES, ROAD_HALF, VX, makeBlocks, makeIntersections, sidewalkLoop,
} from './roads.js';
import { clamp, pushOutOfRect, segmentHitsRect } from './math.js';
import { DISTRICTS, PALETTE, WORLD } from './config.js';

/** Places the story and the side activities meet the player at, all on walkable ground. */
export const PLACES = {
  pawn: { x: 1068, y: 1028, label: "Sonny's Pawn" },
  clinic: { x: 2468, y: 1728, label: 'Sunny Palms Clinic' },
  ammo: { x: 1768, y: 2428, label: 'Dockside Sporting' },
  diner: { x: 368, y: 1028, label: 'The Sunray Diner' },
  marina: { x: 3978, y: 2798, label: 'Marina 7' },
  beachLot: { x: 3980, y: 1180, label: 'Coral Sands Lot' },
  park: { x: 2050, y: 2010, label: 'Palmshore Park' },
  docks: { x: 1400, y: 2420, label: 'Gannet Docks' },
  strip: [
    { x: 3468, y: 1728, label: 'Tide Line Surf' },
    { x: 3468, y: 2028, label: 'Coral Cream' },
    { x: 3468, y: 2160, label: 'Gull Postcards' },
  ],
};

const PARKING_LOTS = [
  { x: 3902, y: 1082, w: 202, h: 214, angle: 0 },
  { x: 3902, y: 2500, w: 202, h: 150, angle: 0 },
  { x: 1080, y: 2452, w: 240, h: 120, angle: 0 },
  { x: 2506, y: 2432, w: 250, h: 130, angle: 0 },
];

function innerRect(block) {
  return {
    x: block.x0 + BLOCK_INSET + 12,
    y: block.y0 + BLOCK_INSET + 12,
    w: block.x1 - block.x0 - (BLOCK_INSET + 12) * 2,
    h: block.y1 - block.y0 - (BLOCK_INSET + 12) * 2,
  };
}

const ROOF_SIGNS = ['VERANO', 'SUNRAY', 'NAUTILUS', 'PALMSHORE', 'TIDE LINE', 'CORAL ARMS'];
const SHOP_SIGNS = ['SUNRAY', 'TIDE LINE', 'CORAL CREAM', 'PALM POST', 'NEON ROW', 'GULL POSTCARDS'];

/** The side of the block a building turns its frontage to: the one nearest the pavement. */
function frontSide(inner, x, y, w, h) {
  const gaps = [
    { side: 'n', gap: y - inner.y },
    { side: 'e', gap: inner.x + inner.w - (x + w) },
    { side: 's', gap: inner.y + inner.h - (y + h) },
    { side: 'w', gap: x - inner.x },
  ];
  gaps.sort((a, b) => a.gap - b.gap);
  return gaps[0].side;
}

function addBuilding(world, block, x, y, w, h, district, floors, style, rand, helpers, detail) {
  const districtInfo = DISTRICTS[district];
  const roof = helpers.pick(districtInfo.roof);
  const inner = innerRect(block);
  const building = {
    id: world.buildings.length,
    x, y, w, h, district, floors, style,
    roof,
    edge: shade(roof, -18),
    light: shade(roof, 14),
    seed: Math.floor(rand() * 1e6),
    front: frontSide(inner, x, y, w, h),
    vents: [],
    units: [],
    pool: false,
    sign: null,
    entrance: {
      t: detail.chance(0.5) ? detail.range(0.24, 0.4) : detail.range(0.6, 0.76),
      awning: style !== 'house' && detail.chance(style === 'shop' ? 0.9 : 0.6),
    },
  };
  // The original vent roll is kept verbatim so the seeded city layout is unchanged: the new
  // decoration draws all come from the separate detail stream below.
  const count = Math.max(2, Math.floor((w * h) / 16000));
  for (let i = 0; i < count; i += 1) {
    building.vents.push({
      x: helpers.range(0.16, 0.82), y: helpers.range(0.16, 0.82),
      w: helpers.range(9, 34), h: helpers.range(8, 26), kind: helpers.chance(0.4) ? 'tank' : 'ac',
    });
  }
  // One to three rooftop units: AC boxes, vents, tanks and skylights.
  const kinds = style === 'warehouse' ? ['vent', 'skylight', 'ac']
    : style === 'house' ? ['vent', 'ac']
      : ['ac', 'tank', 'skylight', 'vent'];
  const unitCount = detail.int(1, 3);
  for (let i = 0; i < unitCount; i += 1) {
    const kind = detail.pick(kinds);
    building.units.push({
      kind,
      x: detail.range(0.2, 0.8),
      y: detail.range(0.2, 0.8),
      w: kind === 'skylight' ? detail.range(26, 46) : detail.range(11, 22),
      h: kind === 'skylight' ? detail.range(13, 20) : detail.range(10, 19),
      rot: detail.chance(0.3) ? Math.PI / 2 : 0,
    });
  }
  if (district === 'beach' && helpers.chance(0.55) && w > 100) building.pool = true;
  else if ((style === 'hotel' || style === 'tower') && w > 155 && h > 155 && detail.chance(0.16)) building.pool = true;
  // Resort roofs get sun loungers and a parasol, so the pale decks read as terraces.
  if (style === 'hotel' || district === 'beach') {
    building.loungers = [];
    const loungers = detail.int(4, 7);
    for (let i = 0; i < loungers; i += 1) {
      building.loungers.push({
        x: detail.range(0.14, 0.86),
        y: detail.range(0.5, 0.9),
        rot: detail.chance(0.5) ? 0 : Math.PI / 2,
        color: detail.pick(['#f6ead2', '#e2604a', '#4f9f92', '#f2b94b']),
      });
    }
    building.cabana = { x: detail.range(0.12, 0.3), y: detail.range(0.12, 0.3) };
    // A clipped row of planters along the street edge reads as a roof garden.
    building.roofPlanters = [];
    const planterCount = detail.int(3, 4);
    for (let i = 0; i < planterCount; i += 1) {
      building.roofPlanters.push({
        x: 0.16 + (i / Math.max(1, planterCount - 1)) * 0.66,
        y: 0.88 + detail.range(-0.02, 0.02),
      });
    }
  }
  if (style === 'tower' && w > 220 && helpers.chance(0.4)) building.sign = helpers.pick(['VERANO', 'NAUTILUS', 'SUNRAY', 'TIDELINE']);
  if (district === 'docks' && helpers.chance(0.3)) building.sign = 'GULL FREIGHT';
  if (style === 'hotel' && helpers.chance(0.55)) building.sign = helpers.pick(['NAUTILUS', 'CORAL ARMS', 'SUNRAY MOTEL', "GULL'S REST"]);
  if (style === 'tower' && floors >= 6 && w > 190) building.helipad = helpers.chance(0.45);
  if (style === 'tower' && w > 210 && helpers.chance(0.5)) {
    building.billboard = {
      text: helpers.pick(['PALMSHORE', 'SUNRAY', 'TIDE LINE', 'VERANO', 'NEON ROW']),
      color: helpers.pick(['#d96450', '#4f9f92', '#f2b94b', '#6f8fb5']),
    };
  }
  if ((style === 'tower' || style === 'hotel' || style === 'warehouse') && w > 140 && h > 120 && helpers.chance(0.7)) {
    building.hut = {
      x: helpers.range(0.12, 0.55), y: helpers.range(0.12, 0.55),
      w: helpers.range(26, 52), h: helpers.range(24, 48),
    };
  }
  // Extra names for the skyline, drawn from the decoration stream so the layout stream is untouched.
  if (!building.sign) {
    if (style === 'tower' && w > 170 && detail.chance(0.7)) building.sign = detail.pick(ROOF_SIGNS);
    else if (style === 'shop' && detail.chance(0.5)) building.sign = detail.pick(SHOP_SIGNS);
  }
  world.buildings.push(building);
  return building;
}

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = clamp(((value >> 16) & 255) + amount, 0, 255);
  const g = clamp(((value >> 8) & 255) + amount, 0, 255);
  const b = clamp((value & 255) + amount, 0, 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function fillBlock(world, block, rand, helpers, detail) {
  const inner = innerRect(block);
  const style = block.district;
  if (style === 'park') return;
  if (style === 'downtown') {
    const cols = helpers.chance(0.45) ? 1 : 2;
    const rows = helpers.chance(0.5) ? 2 : 1;
    const gap = 22;
    const cw = (inner.w - gap * (cols - 1)) / cols;
    const ch = (inner.h - gap * (rows - 1)) / rows;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (helpers.chance(0.08)) continue;
        const margin = helpers.range(5, 20);
        addBuilding(world, block, inner.x + c * (cw + gap) + margin, inner.y + r * (ch + gap) + margin,
          cw - margin * 2, ch - margin * 2, style, helpers.int(3, 9), 'tower', rand, helpers, detail);
      }
    }
    return;
  }
  if (style === 'beach') {
    const cols = 3;
    const gap = 18;
    const cw = (inner.w - gap * (cols - 1)) / cols;
    for (let c = 0; c < cols; c += 1) {
      const depth = helpers.range(inner.h * 0.55, inner.h * 0.96);
      addBuilding(world, block, inner.x + c * (cw + gap) + 3, inner.y + helpers.range(0, inner.h - depth),
        cw - 6, depth, style, helpers.int(1, 4), 'hotel', rand, helpers, detail);
    }
    return;
  }
  if (style === 'suburb') {
    const cols = 2;
    const rows = 2;
    const cw = inner.w / cols;
    const ch = inner.h / rows;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (helpers.chance(0.15)) continue;
        const w = cw * helpers.range(0.42, 0.58);
        const h = ch * helpers.range(0.34, 0.46);
        addBuilding(world, block, inner.x + c * cw + helpers.range(20, cw - w - 20),
          inner.y + r * ch + helpers.range(28, ch - h - 24), w, h, style, 1, 'house', rand, helpers, detail);
        world.props.push({ kind: 'driveway', x: inner.x + c * cw + 24, y: inner.y + r * ch + ch - 52, w: w + 20, h: 42 });
      }
    }
    return;
  }
  if (style === 'docks') {
    const w = inner.w * helpers.range(0.34, 0.44);
    addBuilding(world, block, inner.x + 4, inner.y + 6, w, inner.h * 0.7, style, 1, 'warehouse', rand, helpers, detail);
    addBuilding(world, block, inner.x + inner.w - w - 4, inner.y + inner.h * 0.28, w, inner.h * 0.68, style, 1, 'warehouse', rand, helpers, detail);
    for (let i = 0; i < 5; i += 1) {
      world.props.push({
        kind: helpers.chance(0.6) ? 'container' : 'crate',
        x: inner.x + helpers.range(0.1, 0.85) * inner.w,
        y: inner.y + helpers.range(0.08, 0.9) * inner.h,
        angle: helpers.chance(0.5) ? 0 : Math.PI / 2,
        color: helpers.pick(['#a8523f', '#4e7f86', '#b78a43', '#73805f']),
      });
    }
    return;
  }
  // Midtown: shopfronts facing the street.
  const cols = 3;
  const gap = 16;
  const cw = (inner.w - gap * (cols - 1)) / cols;
  for (let c = 0; c < cols; c += 1) {
    addBuilding(world, block, inner.x + c * (cw + gap), inner.y + helpers.range(0, inner.h * 0.3),
      cw, inner.h * helpers.range(0.62, 0.9), style, helpers.int(1, 3), 'shop', rand, helpers, detail);
  }
}

function addPalms(world, helpers, detail) {
  // The beach line, in two staggered rows, is the city's signature.
  for (let y = 120; y < WORLD.height - 100; y += 96) {
    for (const [x, jitter] of [[3928, 18], [4062, 26]]) {
      if (helpers.chance(0.13)) continue;
      world.palms.push({ x: x + helpers.range(-jitter, jitter), y: y + helpers.range(-26, 26), size: helpers.range(0.85, 1.3), seed: helpers.range(0, 6.28) });
    }
  }
  // Sidewalk corners and the park get the rest.
  for (const block of world.blocks) {
    if (block.district === 'park') {
      for (let i = 0; i < 18; i += 1) {
        world.palms.push({
          x: block.x0 + helpers.range(140, block.x1 - block.x0 - 140),
          y: block.y0 + helpers.range(140, block.y1 - block.y0 - 140),
          size: helpers.range(0.9, 1.45), seed: helpers.range(0, 6.28),
        });
      }
      continue;
    }
    const loop = block.sidewalk;
    for (let i = 0; i < 4; i += 1) {
      const side = i % 4;
      const t = helpers.range(0.2, 0.8);
      const x = side === 0 || side === 2 ? loop.x0 + (loop.x1 - loop.x0) * t : side === 1 ? loop.x1 : loop.x0;
      const y = side === 1 || side === 3 ? loop.y0 + (loop.y1 - loop.y0) * t : side === 2 ? loop.y1 : loop.y0;
      world.palms.push({ x, y, size: helpers.range(0.7, 1.05), seed: helpers.range(0, 6.28) });
    }
    // Two more on the other stretches of pavement, from the decoration stream.
    for (let i = 0; i < 2; i += 1) {
      const side = detail.int(0, 3);
      const t = detail.range(0.12, 0.88);
      const x = side === 0 || side === 2 ? loop.x0 + (loop.x1 - loop.x0) * t : side === 1 ? loop.x1 : loop.x0;
      const y = side === 1 || side === 3 ? loop.y0 + (loop.y1 - loop.y0) * t : side === 2 ? loop.y1 : loop.y0;
      world.palms.push({ x, y, size: detail.range(0.72, 1.1), seed: detail.range(0, 6.28) });
    }
  }
}

function addStreetProps(world, rand, helpers, detail) {
  for (const block of world.blocks) {
    if (block.district === 'park') continue;
    const loop = block.sidewalk;
    const count = block.district === 'downtown' ? 6 : 4;
    for (let i = 0; i < count; i += 1) {
      const side = i % 4;
      const t = (i * 0.37 + 0.18) % 1;
      const x = side === 0 || side === 2 ? loop.x0 + (loop.x1 - loop.x0) * t : side === 1 ? loop.x1 : loop.x0;
      const y = side === 1 || side === 3 ? loop.y0 + (loop.y1 - loop.y0) * t : side === 2 ? loop.y1 : loop.y0;
      world.props.push({ kind: helpers.pick(['lamp', 'hydrant', 'bench', 'bin']), x, y, angle: helpers.range(0, 6.28), seed: helpers.range(0, 100) });
    }
    if (block.district === 'downtown' || block.district === 'docks') {
      world.props.push({ kind: 'dumpster', x: loop.x0 + helpers.range(60, 200), y: loop.y1 - 6, angle: 0 });
    }
    if (block.district === 'downtown' || block.district === 'midtown' || block.district === 'beach') {
      for (let i = 0; i < 3; i += 1) {
        const side = i % 4;
        const t = 0.25 + i * 0.2;
        const x = side === 0 || side === 2 ? loop.x0 + (loop.x1 - loop.x0) * t : side === 1 ? loop.x1 : loop.x0;
        const y = side === 1 || side === 3 ? loop.y0 + (loop.y1 - loop.y0) * t : side === 2 ? loop.y1 : loop.y0;
        world.props.push({ kind: 'planter', x, y, angle: 0 });
      }
    }
    if (block.district === 'suburb') {
      const inner = innerRect(block);
      for (let i = 0; i < 3; i += 1) {
        world.props.push({ kind: 'hedge', x: inner.x + 12, y: inner.y + 30 + i * 150, w: 34, h: 90 });
      }
    }
  }
  // Lamps at regular intervals, hydrants on the corners, benches and bins along the frontages.
  for (const block of world.blocks) {
    if (block.district === 'park') continue;
    const loop = block.sidewalk;
    const sides = [
      { ax: loop.x0, ay: loop.y0, bx: loop.x1, by: loop.y0, nx: 0, ny: -1 },
      { ax: loop.x1, ay: loop.y0, bx: loop.x1, by: loop.y1, nx: 1, ny: 0 },
      { ax: loop.x1, ay: loop.y1, bx: loop.x0, by: loop.y1, nx: 0, ny: 1 },
      { ax: loop.x0, ay: loop.y1, bx: loop.x0, by: loop.y0, nx: -1, ny: 0 },
    ];
    // One lamp per pavement, centred on the block, keeps the street lit without doubling the prop count.
    for (const side of sides) {
      if (detail.chance(0.1)) continue;
      const t = block.vi % 2 === 0 ? 0.42 : 0.58;
      world.props.push({
        kind: 'lamp',
        x: side.ax + (side.bx - side.ax) * t,
        y: side.ay + (side.by - side.ay) * t,
        nx: side.nx, ny: side.ny, seed: detail.range(0, 100),
      });
    }
    world.props.push({ kind: 'hydrant', x: loop.x1 - 9, y: loop.y0 + 9, angle: 0 });
    if (block.district !== 'suburb') {
      world.props.push({ kind: 'bench', x: loop.x0 + (loop.x1 - loop.x0) * 0.5, y: loop.y1, angle: 0 });
      world.props.push({ kind: 'bin', x: loop.x0 + (loop.x1 - loop.x0) * 0.5 + 30, y: loop.y1, angle: 0 });
    }
    if (block.district !== 'suburb' && block.district !== 'docks') {
      const y = loop.y0 + (loop.y1 - loop.y0) * (block.vi % 2 === 0 ? 0.42 : 0.62);
      world.props.push({ kind: 'busStop', x: loop.x0, y, nx: -1, ny: 0, angle: 0 });
    }
  }
  // Boats offshore and a working ship in the roadstead.
  world.props.push(
    { kind: 'sailboat', x: 4228, y: 1488, angle: 0.15, color: '#f4efe0' },
    { kind: 'sailboat', x: 4266, y: 1742, angle: -0.2, color: '#8fc6c3' },
    { kind: 'sailboat', x: 4214, y: 2330, angle: 0.3, color: '#e3b25e' },
    { kind: 'boat', x: 4250, y: 760, angle: 0.1, color: '#f4efe0' },
    { kind: 'ship', x: 4368, y: 2250, angle: Math.PI / 2, color: '#3f5b66' },
  );
  // Beach furniture: umbrellas, towels, a lifeguard tower and the pier.
  const onLot = (x, y) => PARKING_LOTS.some((lot) => x > lot.x - 10 && x < lot.x + lot.w + 10 && y > lot.y - 10 && y < lot.y + lot.h + 10);
  for (let y = 300; y < 3200; y += 150) {
    if (y > 2600 && y < 3060) continue;
    const x = 3990 + helpers.range(-30, 34);
    const uy = y + helpers.range(-30, 30);
    if (onLot(x, uy)) continue;
    world.props.push({ kind: 'umbrella', x, y: uy, color: helpers.pick(['#e2604a', '#4f9f92', '#f2b94b', '#d8c8a8']) });
    if (helpers.chance(0.7)) {
      const tx = x + helpers.range(-30, 30);
      const ty = uy + helpers.range(20, 50);
      if (!onLot(tx, ty)) world.props.push({ kind: 'towel', x: tx, y: ty, angle: helpers.range(-0.4, 0.4), color: helpers.pick(['#f2d9b4', '#7fb3b0', '#e5a68f']) });
    }
  }
  world.props.push({ kind: 'lifeguard', x: 4032, y: 860, angle: Math.PI / 2 });
  world.props.push({ kind: 'lifeguard', x: 4032, y: 2280, angle: Math.PI / 2 });
  world.props.push({ kind: 'pier', x: 4044, y: 2860, w: 250, h: 46 });
  world.props.push({ kind: 'pierSign', x: 3940, y: 2816, label: 'MARINA 7' });
  for (let i = 0; i < 5; i += 1) {
    world.props.push({ kind: 'boat', x: 4210 + helpers.range(-40, 80), y: 2860 + (i - 2) * 74, angle: helpers.range(-0.08, 0.08), color: helpers.pick(['#f4efe0', '#8fc6c3', '#e3b25e']) });
  }
  // Docks: a crane on the south fringe and a container ship silhouette offshore.
  world.props.push({ kind: 'crane', x: 1170, y: 3190, angle: 0 });
  world.props.push({ kind: 'crane', x: 2860, y: 3190, angle: 0 });
  world.props.push({ kind: 'parking', x: 3902, y: 1082, w: 202, h: 214 });
  world.props.push({ kind: 'parking', x: 3902, y: 2500, w: 202, h: 150 });
  world.props.push({ kind: 'parking', x: 1080, y: 2452, w: 240, h: 120 });
  world.props.push({ kind: 'parking', x: 2506, y: 2432, w: 250, h: 130 });
  // Park furniture and a bandstand.
  const park = world.blocks.find((b) => b.district === 'park');
  if (park) {
    for (let i = 0; i < 7; i += 1) {
      world.props.push({ kind: 'parkBench', x: park.x0 + 190 + i * 62, y: park.y0 + 300, angle: 0 });
    }
    world.props.push({ kind: 'bandstand', x: park.cx + 66, y: park.cy + 40 });
    world.props.push({ kind: 'fountain', x: park.cx - 120, y: park.cy + 90 });
  }
}

function addParkedCars(world, helpers) {
  const types = ['sedan', 'sedan', 'sports', 'muscle', 'van', 'pickup', 'taxi'];
  for (const lot of PARKING_LOTS) {
    const columns = Math.max(2, Math.floor(lot.w / 50));
    const rows = Math.max(1, Math.floor(lot.h / 62));
    for (let c = 0; c < columns; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (helpers.chance(0.18)) continue;
        world.parked.push({
          type: helpers.pick(types),
          x: lot.x + 30 + c * ((lot.w - 60) / Math.max(1, columns - 1)),
          y: lot.y + 46 + r * ((lot.h - 70) / Math.max(1, rows - 1)),
          angle: Math.PI / 2,
          color: null,
        });
      }
    }
  }
  // A handful of cars pulled up on the dock aprons and the beach lot's far row.
  for (let i = 0; i < 4; i += 1) {
    world.parked.push({
      type: helpers.pick(types),
      x: 1130 + i * 54, y: 3036, angle: 0, color: null,
    });
  }
}

export function createWorld(seed) {
  const rand = createRandom(seed);
  const helpers = makeHelpers(rand);
  const detail = makeHelpers(createRandom(seed * 31 + 977));
  const world = {
    seed,
    width: WORLD.width,
    height: WORLD.height,
    waterX: WORLD.waterX,
    sandX: WORLD.sandX,
    blocks: makeBlocks(),
    intersections: makeIntersections(),
    buildings: [],
    palms: [],
    props: [],
    parked: [],
    lots: PARKING_LOTS,
    places: PLACES,
    pickups: [],
    scorches: [],
    time: 0,
  };
  for (const block of world.blocks) fillBlock(world, block, rand, helpers, detail);
  addPalms(world, helpers, detail);
  addStreetProps(world, rand, helpers, detail);
  addParkedCars(world, helpers);
  // A handful of pickups seeded around the city, so free roam always has something to find.
  world.pickups.push(
    { kind: 'health', x: PLACES.clinic.x + 26, y: PLACES.clinic.y, amount: 50 },
    { kind: 'health', x: PLACES.diner.x - 24, y: PLACES.diner.y + 8, amount: 35 },
    { kind: 'armour', x: PLACES.ammo.x + 24, y: PLACES.ammo.y + 8, amount: 50 },
    { kind: 'ammo', x: PLACES.ammo.x - 20, y: PLACES.ammo.y - 12, amount: 24, weapon: 'pistol' },
    { kind: 'ammo', x: PLACES.park.x + 40, y: PLACES.park.y - 60, amount: 18, weapon: 'pistol' },
    { kind: 'cash', x: PLACES.beachLot.x - 60, y: PLACES.beachLot.y + 60, amount: 40 },
    { kind: 'cash', x: PLACES.docks.x + 260, y: PLACES.docks.y + 30, amount: 60 },
    { kind: 'health', x: PLACES.marina.x - 30, y: PLACES.marina.y - 60, amount: 40 },
  );
  return world;
}

/** True at a point no person or car can stand: inside a building, or out in the sea. */
export function isSolid(world, x, y, radius = 0) {
  if (x > world.waterX - radius && !(x < 4268 && Math.abs(y - 2860) < 24)) return true;
  if (x < 16 || y < 16 || x > world.width - 10 || y > world.height - 16) return true;
  for (const b of world.buildings) {
    if (x > b.x - radius && x < b.x + b.w + radius && y > b.y - radius && y < b.y + b.h + radius) return true;
  }
  return false;
}

/** Slide a circle out of the buildings, the sea and the city edge. Returns the new centre. */
export function resolveCircle(world, x, y, radius) {
  let nx = x;
  let ny = y;
  let hit = false;
  for (const b of world.buildings) {
    if (nx < b.x - radius || nx > b.x + b.w + radius || ny < b.y - radius || ny > b.y + b.h + radius) continue;
    const pushed = pushOutOfRect(nx, ny, radius, b);
    if (pushed) {
      nx = pushed.x;
      ny = pushed.y;
      hit = true;
    }
  }
  const onPier = nx < 4268 && Math.abs(ny - 2860) < 26;
  if (nx > world.waterX - radius && !onPier) {
    nx = world.waterX - radius;
    hit = true;
  }
  const cx = clamp(nx, 18, world.width - 18);
  const cy = clamp(ny, 18, world.height - 18);
  if (cx !== nx || cy !== ny) hit = true;
  return { x: cx, y: cy, hit };
}

/** Does the straight line between two points cross a building? */
export function hasLineOfSight(world, x1, y1, x2, y2) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (const b of world.buildings) {
    if (b.x > maxX || b.x + b.w < minX || b.y > maxY || b.y + b.h < minY) continue;
    if (segmentHitsRect(x1, y1, x2, y2, b)) return false;
  }
  return true;
}

export { innerRect, PARKING_LOTS };
