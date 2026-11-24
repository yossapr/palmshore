// Palmshore's built world: city blocks, low-poly buildings with lit storefronts, palms,
// beach, marina piers, sea and the props that make a street feel inhabited.

import {
  WORLD, CITY, CLOCK, DISTRICTS, districtFor, STOREFRONTS,
  BUILDING_PLATES,
} from './config.js';
import { TAU, clamp } from './math.js';
import { Rng } from './random.js';

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const signCache = new Map();
const plateCache = new Map();

function signTexture(name, accent) {
  if (signCache.has(name)) return signCache.get(name);
  const canvas = canvas2d(640, 160);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1e24';
  ctx.fillRect(0, 0, 640, 160);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, 160);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let i = 0; i < 8; i += 1) ctx.fillRect(24 + i * 78, 0, 1, 160);
  ctx.strokeStyle = 'rgba(247, 239, 220, 0.32)';
  ctx.lineWidth = 3;
  ctx.strokeRect(7, 7, 626, 146);
  ctx.fillStyle = '#f7efdc';
  ctx.font = '800 52px "Arial Black", "Arial Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 52;
  while (ctx.measureText(name).width > 556 && size > 24) {
    size -= 2;
    ctx.font = `800 ${size}px "Arial Black", "Arial Bold", sans-serif`;
  }
  ctx.fillText(name, 326, 70);
  ctx.fillStyle = accent;
  ctx.font = '700 22px "Trebuchet MS", Arial, sans-serif';
  ctx.fillText('PALMSHORE · OPEN LATE', 326, 124);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  signCache.set(name, texture);
  return texture;
}

function plateTexture(number) {
  if (plateCache.has(number)) return plateCache.get(number);
  const canvas = canvas2d(256, 96);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9cfba';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#23343a';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 246, 86);
  ctx.fillStyle = '#23343a';
  ctx.font = '800 54px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(number, 128, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  plateCache.set(number, texture);
  return texture;
}

let glowTexture = null;
function glowSpriteTexture() {
  if (glowTexture) return glowTexture;
  const canvas = canvas2d(128, 128);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 225, 170, 0.95)');
  grad.addColorStop(0.35, 'rgba(255, 190, 110, 0.35)');
  grad.addColorStop(1, 'rgba(255, 170, 80, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  glowTexture = t;
  return t;
}

function verticalSignTexture(name, accent) {
  const key = `v:${name}`;
  if (signCache.has(key)) return signCache.get(key);
  const canvas = canvas2d(128, 512);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0e1d24';
  ctx.fillRect(0, 0, 128, 512);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 120, 504);
  ctx.font = '800 44px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letters = name.replace(/ /g, '').slice(0, 10).split('');
  letters.forEach((letter, i) => {
    ctx.fillStyle = i % 2 === 0 ? '#f7efdc' : accent;
    ctx.fillText(letter, 64, 60 + i * 44);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  signCache.set(key, texture);
  return texture;
}

function sidewalkTexture() {
  const key = 'sidewalk-tile';
  if (signCache.has(key)) return signCache.get(key);
  const canvas = canvas2d(256, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cdc4ae';
  ctx.fillRect(0, 0, 256, 256);
  const rng = new Rng(0x51de);
  for (let i = 0; i < 500; i += 1) {
    const r = rng.int(80, 150);
    const g = rng.int(76, 140);
    const b = rng.int(66, 120);
    ctx.fillStyle = `rgba(${r},${g},${b},${rng.range(0.035, 0.12)})`;
    ctx.fillRect(rng.range(0, 256), rng.range(0, 256), rng.range(1, 4), rng.range(1, 2));
  }
  ctx.strokeStyle = 'rgba(96, 88, 74, 0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(110, 100, 82, 0.18)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    let x = rng.range(10, 240);
    let y = rng.range(10, 240);
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j += 1) {
      x += rng.range(-14, 14);
      y += rng.range(4, 20);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.anisotropy = 4;
  signCache.set(key, texture);
  return texture;
}

export class World {
  constructor(scene, roads, seed = WORLD.seed) {
    this.scene = scene;
    this.roads = roads;
    this.seed = seed;
    this.rng = new Rng(seed ^ 0xc17d);
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.colliders = [];
    this.buildings = [];
    this.props = [];
    this.landmarks = new Map();
    this.storefronts = [];
    this.materials = new Map();
    this.signIndex = 0;
    this.plateIndex = 0;
    this.blockInfo = new Map();

    this.buildGround();
    this.buildBlocks();
    this.buildBeach();
    this.buildMarina();
    this.buildSkyline();
    this.buildPalmLines();
    this.buildStreetlights();
  }

  key(col, row) {
    return `${col},${row}`;
  }

  material(color, options = {}) {
    const cacheKey = `${color}|${options.emissive ?? ''}|${options.emissiveIntensity ?? ''}|${options.transparent ?? ''}`;
    if (this.materials.has(cacheKey)) return this.materials.get(cacheKey);
    const mat = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      emissive: options.emissive ?? '#000000',
      emissiveIntensity: options.emissiveIntensity ?? 1,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
    });
    this.materials.set(cacheKey, mat);
    return mat;
  }

  box(w, h, d, x, y, z, color, parent = this.group, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.material(color, opts));
    mesh.position.set(x, y, z);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1500, 1100),
      this.material('#8a8a6c'),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(240, -0.06, 150);
    ground.receiveShadow = true;
    this.group.add(ground);

    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 900),
      new THREE.MeshPhongMaterial({
        color: CLOCK.water, specular: '#ffd7a0', shininess: 70, flatShading: false,
      }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(CITY.waterX + 520, -0.09, 150);
    sea.receiveShadow = true;
    sea.name = 'sea';
    this.group.add(sea);
    this.sea = sea;

    // Warm glints on the water so the horizon reads as sea, not a blue wall.
    const glintMat = new THREE.MeshBasicMaterial({ color: '#bfe6df', transparent: true, opacity: 0.22 });
    for (let i = 0; i < 44; i += 1) {
      const w = this.rng.range(4, 20);
      const glint = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.35 + this.rng.range(0, 0.5)), glintMat);
      glint.rotation.x = -Math.PI / 2;
      glint.position.set(CITY.waterX + this.rng.range(2, 260), 0.02, this.rng.range(-20, 360));
      this.group.add(glint);
    }
  }

  buildBlocks() {
    const walk = WORLD.walk;
    for (let col = 0; col < WORLD.cols; col += 1) {
      for (let row = 0; row < WORLD.rows; row += 1) {
        const rect = this.roads.blockRect(col, row);
        const districtId = districtFor(col, row);
        const district = DISTRICTS[districtId];
        const info = { col, row, rect, districtId, buildings: [] };
        this.blockInfo.set(this.key(col, row), info);
        if (districtId === 'sabal') {
          this.buildPark(rect, district);
          continue;
        }
        // Curb, then a raised concrete sidewalk slab.
        this.box(rect.w + 0.5, 0.13, rect.d + 0.5, rect.x + rect.w / 2, 0.045, rect.z + rect.d / 2, CLOCK.curb, this.group, { castShadow: false });
        this.box(rect.w, 0.2, rect.d, rect.x + rect.w / 2, 0.1, rect.z + rect.d / 2, CLOCK.sidewalk, this.group, { castShadow: false });
        const walkMat = new THREE.MeshLambertMaterial({ map: sidewalkTexture() });
        const walkTop = new THREE.Mesh(new THREE.PlaneGeometry(rect.w, rect.d), walkMat);
        walkTop.rotation.x = -Math.PI / 2;
        walkTop.position.set(rect.x + rect.w / 2, 0.202, rect.z + rect.d / 2);
        walkTop.receiveShadow = true;
        this.group.add(walkTop);
        this.buildLots(info, district, walk);
      }
    }
  }

  buildLots(info, district, walk) {
    const { rect, col, row } = info;
    const inner = {
      x: rect.x + walk,
      z: rect.z + walk,
      w: rect.w - walk * 2,
      d: rect.d - walk * 2,
    };
    let plots = [];
    const style = district.style;
    if (style === 'glass') {
      // A tower and a low annex, or a single tower with a plaza.
      if (this.rng.chance(0.55)) {
        const tw = inner.w * 0.72;
        const td = inner.d * 0.72;
        plots.push({ x: inner.x + 1.5, z: inner.z + 1.5, w: tw, d: td, tall: true });
        plots.push({
          x: inner.x + tw + 4, z: inner.z + inner.d - 13,
          w: Math.max(7, inner.w - tw - 5), d: 12, tall: false,
        });
      } else {
        plots.push({ x: inner.x + 2, z: inner.z + 2, w: inner.w - 4, d: inner.d - 4, tall: true });
      }
    } else if (style === 'beach' || style === 'hill') {
      const gap = 2.4;
      const halfW = (inner.w - gap) / 2;
      const halfD = (inner.d - gap) / 2;
      for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
          plots.push({
            x: inner.x + i * (halfW + gap) + this.rng.range(0.4, 1.2),
            z: inner.z + j * (halfD + gap) + this.rng.range(0.4, 1.2),
            w: halfW - this.rng.range(1, 2.4),
            d: halfD - this.rng.range(1, 2.4),
            tall: false,
          });
        }
      }
    } else if (style === 'industrial') {
      plots.push({ x: inner.x + 1, z: inner.z + 1, w: inner.w - 2, d: inner.d * 0.7, tall: false, industrial: true });
      plots.push({ x: inner.x + 3, z: inner.z + inner.d * 0.74, w: inner.w * 0.36, d: inner.d * 0.22, tall: false, low: true });
    } else {
      plots.push({ x: inner.x + 1.5, z: inner.z + 1.5, w: inner.w - 3, d: inner.d * 0.56, tall: false });
      plots.push({ x: inner.x + 4, z: inner.z + inner.d * 0.6, w: inner.w - 8, d: inner.d * 0.34, tall: false, low: true });
    }
    for (const plot of plots) {
      if (plot.w < 5 || plot.d < 5) continue;
      this.buildBuilding(info, district, plot);
    }
  }

  buildBuilding(info, district, plot) {
    const rng = this.rng;
    const hRange = district.heights;
    let height = rng.range(hRange[0], hRange[1]);
    if (plot.tall) height = Math.max(height, rng.range(hRange[0] * 0.8, hRange[1]));
    if (plot.low) height = Math.max(2.6, height * 0.35);
    const color = rng.pick(district.palette);
    const roofColor = rng.pick(district.roofs);
    const base = 0.2;
    const cx = plot.x + plot.w / 2;
    const cz = plot.z + plot.d / 2;
    const isGlass = district.style === 'glass';
    this.box(plot.w, height, plot.d, cx, base + height / 2, cz, color);

    // Roof cap / parapet and rooftop machinery.
    this.box(plot.w + 0.35, 0.35, plot.d + 0.35, cx, base + height + 0.17, cz, roofColor, this.group, { castShadow: false });
    const roofY = base + height + 0.35;
    const details = plot.tall ? 3 : 2;
    for (let i = 0; i < details; i += 1) {
      const type = rng.int(0, 3);
      const dx = cx + rng.range(-plot.w * 0.3, plot.w * 0.3);
      const dz = cz + rng.range(-plot.d * 0.3, plot.d * 0.3);
      if (type === 0) {
        this.box(rng.range(1.2, 2.4), 0.8, rng.range(1.2, 2.2), dx, roofY + 0.4, dz, '#6b7275', this.group, { castShadow: false });
      } else if (type === 1) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.6, 8), this.material('#7f6b53'));
        tank.position.set(dx, roofY + 0.8, dz);
        tank.castShadow = true;
        this.group.add(tank);
      } else if (type === 2) {
        this.box(0.6, 1.5, 0.6, dx, roofY + 0.75, dz, '#5b6265', this.group, { castShadow: false });
      } else {
        this.box(1.4, 0.5, 1.4, dx, roofY + 0.25, dz, '#8c7f6c', this.group, { castShadow: false });
      }
    }
    if (height > 20) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 5, 4), this.material('#3b4448'));
      mast.position.set(cx, roofY + 2.5, cz);
      this.group.add(mast);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), new THREE.MeshBasicMaterial({ color: '#ff5c5c' }));
      light.position.set(cx, roofY + 5, cz);
      this.group.add(light);
    }

    // Ground floor: a darker plinth, a continuous glazing band and a warm cornice.
    const plinth = this.material(roofColor);
    this.box(plot.w + 0.22, 0.62, plot.d + 0.22, cx, base + 0.31, cz, roofColor, this.group, { castShadow: false });
    const groundGlass = new THREE.Mesh(
      new THREE.BoxGeometry(plot.w + 0.16, 1.5, plot.d + 0.16),
      this.material('#2f515b', { emissive: '#c47a3a', emissiveIntensity: 0.4 }),
    );
    groundGlass.position.set(cx, base + 1.62, cz);
    this.group.add(groundGlass);
    this.box(plot.w + 0.34, 0.18, plot.d + 0.34, cx, base + 2.52, cz, '#b9a98d', this.group, { castShadow: false });
    void plinth;

    // Window bands: one long dark strip per floor, a cheap convincing skyline detail.
    const floors = Math.max(1, Math.floor((height - 2.4) / 3.1));
    const glassMat = isGlass ? this.material(district.glass, { emissive: '#b06a35', emissiveIntensity: 0.28 }) : this.material('#2c4650', { emissive: '#a45c2a', emissiveIntensity: 0.2 });
    for (let f = 0; f < floors; f += 1) {
      const y = base + 3.1 + f * 3.1;
      if (y > base + height - 1) break;
      const band = new THREE.Mesh(new THREE.BoxGeometry(plot.w + 0.03, 0.9, plot.d + 0.03), glassMat);
      band.position.set(cx, y, cz);
      band.castShadow = false;
      band.receiveShadow = false;
      this.group.add(band);
    }
    // Corner fins give the low-poly boxes a sense of structure.
    for (const [fx, fz] of [
      [plot.x + 0.28, plot.z + 0.28], [plot.x + plot.w - 0.28, plot.z + 0.28],
      [plot.x + 0.28, plot.z + plot.d - 0.28], [plot.x + plot.w - 0.28, plot.z + plot.d - 0.28],
    ]) {
      this.box(0.42, height, 0.42, fx, base + height / 2, fz, roofColor, this.group, { castShadow: false });
    }

    // Street-facing frontage: glass, awning and sign.
    const side = this.frontSide(info, plot);
    const sign = this.storefrontFor(info, district);
    if (sign) {
      this.addStorefront(plot, side, sign, district, height, base);
    } else {
      this.addPlainFront(plot, side, district, base);
    }
    // A small building number plate by the door.
    const plate = BUILDING_PLATES[this.plateIndex % BUILDING_PLATES.length];
    this.plateIndex += 1;
    this.addPlate(plot, side, plate, base);
    const building = {
      id: this.buildings.length,
      x: plot.x, z: plot.z, w: plot.w, d: plot.d, h: height,
      cx, cz, color, roofColor, district: district.id,
      name: sign?.name ?? null, side, plot,
    };
    this.buildings.push(building);
    info.buildings.push(building);
    this.colliders.push({ x: plot.x, z: plot.z, w: plot.w, d: plot.d, h: height });
    if (sign) this.storefronts.push({ ...sign, x: cx, z: cz, building });
  }

  frontSide(info, plot) {
    const rect = info.rect;
    const distances = [
      { side: 'w', d: plot.x - rect.x },
      { side: 'e', d: rect.x + rect.w - (plot.x + plot.w) },
      { side: 'n', d: plot.z - rect.z },
      { side: 's', d: rect.z + rect.d - (plot.z + plot.d) },
    ];
    distances.sort((a, b) => a.d - b.d);
    // Bias toward the sea-facing side on the last column so the strip reads as beachfront.
    return distances[0].side;
  }

  storefrontFor(info, district) {
    if (!this.rng.chance(district.storefront)) return null;
    // Iconic names are pinned to the blocks the story uses.
    const pinned = {
      '5,2': 'SUNFADE LIQUOR',
      '5,3': 'MANGO TANGO',
      '6,3': 'SEAGLASS HOTEL',
      '5,4': 'MARLIN HARDWARE',
      '5,1': 'PELICAN PAWN',
      '6,2': 'THE NEON CONCH',
    };
    const pinName = pinned[this.key(info.col, info.row)];
    if (pinName) {
      const found = STOREFRONTS.find((s) => s.name === pinName);
      if (found && ![...this.landmarks.keys()].includes(found.name)) {
        this.landmarks.set(found.name, { x: info.rect.x + info.rect.w / 2, z: info.rect.z + info.rect.d / 2 });
        return found;
      }
    }
    const candidates = STOREFRONTS.filter((s) => !this.landmarks.has(s.name));
    const entry = (candidates.length ? candidates : STOREFRONTS)[this.signIndex % (candidates.length || STOREFRONTS.length)];
    this.signIndex += 1;
    if (!this.landmarks.has(entry.name)) {
      this.landmarks.set(entry.name, { x: info.rect.x + info.rect.w / 2, z: info.rect.z + info.rect.d / 2 });
    }
    return entry;
  }

  frontTransform(plot, side) {
    if (side === 'w') return { x: plot.x - 0.06, z: plot.z + plot.d / 2, rot: -Math.PI / 2, width: plot.d };
    if (side === 'e') return { x: plot.x + plot.w + 0.06, z: plot.z + plot.d / 2, rot: Math.PI / 2, width: plot.d };
    if (side === 'n') return { x: plot.x + plot.w / 2, z: plot.z - 0.06, rot: Math.PI, width: plot.w };
    return { x: plot.x + plot.w / 2, z: plot.z + plot.d + 0.06, rot: 0, width: plot.w };
  }

  addStorefront(plot, side, sign, district, height, base) {
    const t = this.frontTransform(plot, side);
    const width = Math.min(t.width - 1.2, 11);
    // A door and a pair of low windows on the frontage.
    const outward = this.outward(side);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 2.15),
      new THREE.MeshLambertMaterial({ color: '#3c2c22', emissive: '#ffb45e', emissiveIntensity: 0.18 }),
    );
    const doorAlong = Math.max(1.2, width * 0.28);
    door.position.set(
      t.x + Math.cos(t.rot) * doorAlong + outward.x * 0.09,
      base + 1.28,
      t.z + Math.sin(t.rot) * doorAlong + outward.z * 0.09,
    );
    door.rotation.y = t.rot;
    this.group.add(door);
    const zOffset = t.rot === 0 || t.rot === Math.PI ? 1 : 0;
    const xOffset = t.rot === -Math.PI / 2 || t.rot === Math.PI / 2 ? 1 : 0;
    // Warm shop glass.
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 2.15),
      new THREE.MeshBasicMaterial({ color: '#ffb45e', transparent: true, opacity: 0.44, side: THREE.DoubleSide }),
    );
    glass.position.set(t.x + xOffset * 0.02, base + 1.35, t.z + zOffset * 0.02);
    glass.rotation.y = t.rot;
    this.group.add(glass);
    // Awning.
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.12, 1.35),
      this.material(sign.color, { emissive: sign.color, emissiveIntensity: 0.08 }),
    );
    awning.position.set(t.x + Math.sin(t.rot + Math.PI / 2) * 0, base + 2.62, t.z);
    awning.position.x += outward.x * 0.65;
    awning.position.z += outward.z * 0.65;
    awning.rotation.y = t.rot;
    awning.castShadow = true;
    this.group.add(awning);
    // Sign above the awning.
    const tex = signTexture(sign.name, sign.color);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.23), mat);
    signMesh.position.set(t.x + outward.x * 0.05, base + 3.5, t.z + outward.z * 0.05);
    signMesh.rotation.y = t.rot;
    this.group.add(signMesh);
    // Blade sign at the corner, readable from down the street.
    const cornerOffset = width / 2 - 0.4;
    const along = { x: Math.cos(t.rot), z: Math.sin(t.rot) };
    const bx = t.x + along.x * cornerOffset;
    const bz = t.z + along.z * cornerOffset;
    const blade = new THREE.Group();
    blade.position.set(bx, base + 4.55, bz);
    blade.rotation.y = t.rot + Math.PI / 2;
    const bladeMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide });
    const bladePlane = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.98), bladeMat);
    bladePlane.position.z = 0.012;
    blade.add(bladePlane);
    const bladeBack = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.98), bladeMat);
    bladeBack.rotation.y = Math.PI;
    bladeBack.position.z = -0.012;
    blade.add(bladeBack);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), this.material('#2c383d'));
    bracket.position.set(0, 0.55, 0.35);
    blade.add(bracket);
    this.group.add(blade);
    // Landmark storefronts get a rooftop billboard and a tall neon blade, so the
    // beachfront reads as a named strip from down the road.
    const iconic = ['SUNFADE LIQUOR', 'MANGO TANGO', 'SEAGLASS HOTEL', 'THE NEON CONCH', 'PELICAN PAWN', 'MARLIN HARDWARE'];
    if (iconic.includes(sign.name)) {
      const rooftop = new THREE.Group();
      const billW = Math.min(plot.w - 1, 8);
      const bill = new THREE.Mesh(
        new THREE.PlaneGeometry(billW, billW * 0.23),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
      );
      bill.position.set(t.x + outward.x * 0.7, base + Math.max(height + 2.4, 7.2), t.z + outward.z * 0.7);
      bill.rotation.y = t.rot;
      rooftop.add(bill);
      for (const dx of [-billW * 0.33, billW * 0.33]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), this.material('#2c383d'));
        pole.position.set(
          t.x + outward.x * 0.7 + Math.cos(t.rot) * dx,
          base + Math.max(height + 1.1, 5.9),
          t.z + outward.z * 0.7 + Math.sin(t.rot) * dx,
        );
        rooftop.add(pole);
      }
      this.group.add(rooftop);
      const vtex = verticalSignTexture(sign.name, sign.color);
      const vmat = new THREE.MeshBasicMaterial({ map: vtex, side: THREE.FrontSide });
      const vgroup = new THREE.Group();
      vgroup.position.set(t.x + outward.x * 0.55, base + 4.7, t.z + outward.z * 0.55);
      vgroup.rotation.y = t.rot + Math.PI / 2;
      const vplane = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 4.0), vmat);
      vplane.position.z = 0.07;
      vgroup.add(vplane);
      const vback = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 4.0), vmat);
      vback.rotation.y = Math.PI;
      vback.position.z = -0.07;
      vgroup.add(vback);
      this.group.add(vgroup);
    }
    void district;
    void height;
  }

  addPlainFront(plot, side, district, base) {
    const t = this.frontTransform(plot, side);
    const width = Math.min(t.width - 1.5, 9);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 1.9),
      new THREE.MeshBasicMaterial({
        color: district.style === 'industrial' ? '#60757a' : '#79a3ad',
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    glass.position.set(t.x, base + 1.2, t.z);
    glass.rotation.y = t.rot;
    this.group.add(glass);
  }

  addPlate(plot, side, number, base) {
    const t = this.frontTransform(plot, side);
    const tex = plateTexture(number);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.43), mat);
    const outward = this.outward(side);
    plate.position.set(t.x + outward.x * 0.08, base + 2.9, t.z + outward.z * 0.08);
    plate.rotation.y = t.rot;
    this.group.add(plate);
  }

  outward(side) {
    if (side === 'w') return { x: -1, z: 0 };
    if (side === 'e') return { x: 1, z: 0 };
    if (side === 'n') return { x: 0, z: -1 };
    return { x: 0, z: 1 };
  }

  buildPark(rect, district) {
    this.box(rect.w + 0.4, 0.1, rect.d + 0.4, rect.x + rect.w / 2, 0.03, rect.z + rect.d / 2, '#9c937c', this.group, { castShadow: false });
    this.box(rect.w, 0.16, rect.d, rect.x + rect.w / 2, 0.09, rect.z + rect.d / 2, CLOCK.grass, this.group, { castShadow: false });
    const cx = rect.x + rect.w / 2;
    const cz = rect.z + rect.d / 2;
    // Paths.
    this.box(rect.w, 0.03, 3.2, cx, 0.19, cz, '#d4c6a8', this.group, { castShadow: false, receiveShadow: true });
    this.box(3.2, 0.03, rect.d, cx, 0.19, cz, '#d4c6a8', this.group, { castShadow: false, receiveShadow: true });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.6, 12), this.material('#cfc5b0'));
    basin.position.set(cx, 0.45, cz);
    basin.castShadow = true;
    this.group.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.1, 12), this.material('#5aa9b0', { emissive: '#2d6e74', emissiveIntensity: 0.4 }));
    water.position.set(cx, 0.77, cz);
    this.group.add(water);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 3.4, 8), this.material('#d9cfba'));
    column.position.set(cx, 2.1, cz);
    column.castShadow = true;
    this.group.add(column);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.7, 0.5, 10), this.material('#d9cfba'));
    bowl.position.set(cx, 3.6, cz);
    bowl.castShadow = true;
    this.group.add(bowl);
    this.colliders.push({ x: cx - 4.4, z: cz - 4.4, w: 8.8, d: 8.8, h: 1 });
    // Park benches and palms.
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * TAU;
      const px = cx + Math.cos(angle) * 11;
      const pz = cz + Math.sin(angle) * 11;
      this.makeBench(px, pz, angle + Math.PI / 2);
      if (i % 2 === 0) this.makePalm(px + 2, pz + 1.5, 0.8 + (i % 3) * 0.1);
    }
    this.landmarks.set('SABAL FOUNTAIN', { x: cx, z: cz });
    void district;
  }

  buildBeach() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.waterX - CITY.beachX + 10, WORLD.rows * WORLD.pitch + 240),
      this.material(CLOCK.sand),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set((CITY.beachX + CITY.waterX) / 2, 0.005, (WORLD.rows * WORLD.pitch) / 2);
    sand.receiveShadow = true;
    this.group.add(sand);
    // Boardwalk.
    this.box(3.4, 0.12, WORLD.rows * WORLD.pitch + 60, CITY.beachX + 2.4, 0.08, (WORLD.rows * WORLD.pitch) / 2, '#a98a62', this.group, { castShadow: false });
    // Foam at the waterline.
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, WORLD.rows * WORLD.pitch + 240),
      new THREE.MeshBasicMaterial({ color: '#f2f0dd', transparent: true, opacity: 0.55 }),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(CITY.waterX + 0.4, 0.03, (WORLD.rows * WORLD.pitch) / 2);
    this.group.add(foam);
    // Umbrellas, towels and a lifeguard tower.
    for (let i = 0; i < 9; i += 1) {
      const x = CITY.beachX + this.rng.range(9, 36);
      const z = this.rng.range(20, WORLD.rows * WORLD.pitch - 10);
      this.makeUmbrella(x, z, this.rng.pick(['#ff7d64', '#ffd166', '#5fc7c0', '#ff9fb0']));
      const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), this.material(this.rng.pick(['#e8d9b8', '#e28c78', '#7fb7c4'])));
      towel.rotation.x = -Math.PI / 2;
      towel.rotation.z = this.rng.range(0, TAU);
      towel.position.set(x + 1.8, 0.035, z + 0.8);
      towel.receiveShadow = true;
      this.group.add(towel);
    }
    this.makeLifeguardTower(CITY.beachX + 30, 158);
    for (let i = 0; i < 3; i += 1) {
      const x = CITY.beachX + 13 + i * 13;
      const z = 34 + i * 52;
      const shack = new THREE.Group();
      shack.position.set(x, 0.02, z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.3, 3.0), this.material(['#e8b54a', '#ff8a5b', '#7fc9c0'][i]));
      body.position.y = 1.15;
      body.castShadow = true;
      shack.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 3.5), this.material('#f2e2bf'));
      roof.position.y = 2.4;
      roof.rotation.z = 0.05;
      shack.add(roof);
      const hatch = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), new THREE.MeshBasicMaterial({ color: '#2a4a50', side: THREE.DoubleSide }));
      hatch.position.set(0, 1.5, 1.51);
      shack.add(hatch);
      this.group.add(shack);
    }
    this.landmarks.set('CORAL BEACH', { x: CITY.beachX + 24, z: 150 });
  }

  buildMarina() {
    const zBase = WORLD.originZ + 4 * WORLD.pitch;
    for (let i = 0; i < 3; i += 1) {
      const z = zBase + 8 + i * 16;
      this.box(30, 0.25, 4.2, CITY.beachX + 28, 0.16, z, '#9a7a55', this.group, { castShadow: false });
      for (let j = 0; j < 4; j += 1) {
        const px = CITY.beachX + 17 + j * 7;
        this.box(0.35, 1.2, 0.35, px, 0.6, z - 1.7, '#57442f', this.group, { castShadow: false });
      }
      // A moored boat alongside each pier.
      const boat = new THREE.Group();
      boat.position.set(CITY.beachX + 24, 0.15, z + 4.3);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.7, 1.8), this.material(this.rng.pick(['#e9e4d2', '#cf6f55', '#4c8f96'])));
      hull.position.y = 0.35;
      hull.castShadow = true;
      boat.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), this.material('#e9e4d2'));
      bow.rotation.z = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(3.4, 0.45, 0);
      boat.add(bow);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.3), this.material('#dfd7c2'));
      cabin.position.set(-0.8, 1.1, 0);
      boat.add(cabin);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 5), this.material('#4d4234'));
      mast.position.set(-1.2, 2.1, 0);
      boat.add(mast);
      this.group.add(boat);
    }
    this.landmarks.set('MARLIN DOCKS', { x: CITY.beachX + 18, z: zBase + 22 });
  }

  buildSkyline() {
    const rng = new Rng(this.seed ^ 0x8811);
    const mat = this.material('#b99279');
    for (let i = 0; i < 26; i += 1) {
      const west = i < 14;
      const w = rng.range(10, 30);
      const d = rng.range(10, 30);
      const h = rng.range(12, 48);
      const x = west ? rng.range(-120, -40) : rng.range(20, 420);
      const z = west ? rng.range(20, 360) : rng.range(-140, -50);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, h / 2, z);
      this.group.add(mesh);
    }
    // Distant island on the sea horizon.
    const island = new THREE.Mesh(
      new THREE.ConeGeometry(52, 16, 5),
      this.material('#8b8a76'),
    );
    island.position.set(CITY.waterX + 360, 2, 70);
    island.rotation.y = 0.4;
    this.group.add(island);
  }

  buildPalmLines() {
    const promenade = [];
    for (let row = 0; row < WORLD.rows; row += 1) {
      promenade.push({ x: CITY.beachX + 7.2, z: CITY.gridZ(row) + 15 });
      promenade.push({ x: CITY.beachX + 7.2, z: CITY.gridZ(row) + 44 });
    }
    for (const p of promenade) this.makePalm(p.x, p.z, this.rng.range(0.9, 1.25));
    // Sidewalk palms at Coral Strip street corners.
    const beachBlocks = [[5, 2], [5, 3], [6, 2], [6, 3], [6, 4], [5, 4]];
    for (const [col, row] of beachBlocks) {
      const rect = this.roads.blockRect(col, row);
      for (const corner of [
        [rect.x + 1.8, rect.z + 1.8], [rect.x + rect.w - 1.8, rect.z + 1.8],
        [rect.x + 1.8, rect.z + rect.d - 1.8], [rect.x + rect.w - 1.8, rect.z + rect.d - 1.8],
      ]) {
        if (this.rng.chance(0.55)) this.makePalm(corner[0], corner[1], this.rng.range(0.7, 1.05));
      }
    }
    // Docks and park palms.
    for (let i = 0; i < 8; i += 1) {
      this.makePalm(CITY.beachX + this.rng.range(4, 20), WORLD.originZ + 4 * WORLD.pitch + this.rng.range(4, 70), this.rng.range(0.7, 1.1));
    }
  }

  buildStreetlights() {
    for (let col = 1; col < WORLD.cols; col += 2) {
      for (let row = 1; row < WORLD.rows; row += 2) {
        const rect = this.roads.blockRect(col, row);
        this.makeStreetlight(rect.x + rect.w - 1.2, rect.z + rect.d - 1.2, 'se');
        this.makeStreetlight(rect.x + 1.2, rect.z + 1.2, 'nw');
      }
    }
    this.makeStreetlight(CITY.beachX - 1.4, 100, 'se');
    this.makeStreetlight(CITY.beachX - 1.4, 180, 'se');
    this.makeStreetlight(CITY.beachX - 1.4, 245, 'se');
    // Street furniture on the coral blocks that frame the story shots.
    for (const [col, row] of [[5, 2], [5, 3], [6, 3], [5, 4]]) {
      const rect = this.roads.blockRect(col, row);
      this.makeBench(rect.x + 5, rect.z + rect.d - 1.5, 0);
      this.makeBin(rect.x + 8.2, rect.z + rect.d - 1.4);
      if (col === 5 && row === 2) {
        this.makeBusStop(rect.x + rect.w - 6, rect.z + 1.6, 0);
        this.makeHydrant(rect.x + rect.w - 10, rect.z + 1.2);
      }
      if (col === 5 && row === 3) {
        this.makeHydrant(rect.x + rect.w - 2.2, rect.z + 9);
      }
    }
  }

  makePalm(x, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0.2, z);
    const lean = this.rng.range(-0.12, 0.12);
    const height = this.rng.range(5.6, 8.2) * scale;
    const trunkMat = this.material('#8a6a4a');
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.28 * scale, height, 6), trunkMat);
    trunk.position.set(lean * height * 0.5, height / 2, 0);
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    g.add(trunk);
    const frondMat = this.material(this.rng.chance(0.5) ? '#4f7d46' : '#5f8f4e');
    const top = new THREE.Vector3(lean * height, height, 0);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * TAU + this.rng.range(-0.12, 0.12);
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.22 * scale, 2.9 * scale, 3), frondMat);
      frond.position.set(top.x + Math.cos(angle) * 1.25, top.y - 0.25, Math.sin(angle) * 1.25);
      frond.rotation.z = Math.PI / 2 + this.rng.range(-0.3, 0.1);
      frond.rotation.y = angle;
      frond.castShadow = true;
      g.add(frond);
    }
    const coconutMat = this.material('#5c4531');
    for (let i = 0; i < 3; i += 1) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 5, 4), coconutMat);
      nut.position.set(top.x + Math.cos(i * 2.1) * 0.3, top.y - 0.2, Math.sin(i * 2.1) * 0.3);
      g.add(nut);
    }
    this.group.add(g);
    this.props.push({ type: 'palm', x, z, radius: 0.35 });
  }

  makeStreetlight(x, z, corner) {
    const g = new THREE.Group();
    g.position.set(x, 0.2, z);
    const poleMat = this.material('#2c363a');
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.4, 6), poleMat);
    pole.position.y = 3.2;
    pole.castShadow = true;
    g.add(pole);
    const dir = corner === 'se' ? -1 : 1;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), poleMat);
    arm.position.set(dir * 0.7, 6.3, 0);
    g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.32), this.material('#3b464a'));
    head.position.set(dir * 1.35, 6.2, 0);
    g.add(head);
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe1a6' });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), bulbMat);
    bulb.position.set(dir * 1.35, 6.1, 0);
    g.add(bulb);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSpriteTexture(), color: '#ffd9a0', transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.scale.set(3.2, 3.2, 1);
    sprite.position.set(dir * 1.35, 6.05, 0);
    g.add(sprite);
    this.group.add(g);
    this.props.push({ type: 'lamp', x, z, radius: 0.25 });
  }

  makeBench(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, 0.2, z);
    g.rotation.y = rot;
    const wood = this.material('#8b6545');
    for (let i = 0; i < 3; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.18), wood);
      slat.position.set(0, 0.48, -0.2 + i * 0.2);
      slat.castShadow = true;
      g.add(slat);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 0.08), wood);
    back.position.set(0, 0.72, -0.3);
    back.rotation.x = -0.2;
    back.castShadow = true;
    g.add(back);
    const metal = this.material('#3b4245');
    for (const dx of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.42), metal);
      leg.position.set(dx, 0.24, 0);
      g.add(leg);
    }
    this.group.add(g);
    this.props.push({ type: 'bench', x, z, radius: 0.8 });
  }

  makeBin(x, z) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.9, 8), this.material('#4f6b5d'));
    bin.position.set(x, 0.65, z);
    bin.castShadow = true;
    this.group.add(bin);
    this.props.push({ type: 'bin', x, z, radius: 0.3 });
  }

  makeHydrant(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0.2, z);
    const mat = this.material('#c9553f');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.62, 7), mat);
    body.position.y = 0.31;
    body.castShadow = true;
    g.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 5), mat);
    cap.position.y = 0.66;
    g.add(cap);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.13), mat);
    bar.position.y = 0.46;
    g.add(bar);
    this.group.add(g);
    this.props.push({ type: 'hydrant', x, z, radius: 0.25 });
  }

  makeBusStop(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, 0.2, z);
    g.rotation.y = rot;
    const metal = this.material('#46555b');
    const glass = new THREE.MeshBasicMaterial({ color: '#9fd0d8', transparent: true, opacity: 0.24, side: THREE.DoubleSide });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), glass);
    back.position.set(0, 1.3, -0.7);
    g.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.8), metal);
    roof.position.set(0, 2.55, 0);
    roof.castShadow = true;
    g.add(roof);
    for (const dx of [-1.55, 1.55]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.1), metal);
      post.position.set(dx, 1.25, -0.7);
      post.castShadow = true;
      g.add(post);
    }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.5), this.material('#8b6545'));
    bench.position.set(0, 0.62, -0.25);
    g.add(bench);
    const signCanvas = canvas2d(256, 128);
    const ctx = signCanvas.getContext('2d');
    ctx.fillStyle = '#10232b';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(0, 0, 256, 10);
    ctx.fillStyle = '#f7efdc';
    ctx.font = '800 34px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUS', 128, 58);
    ctx.font = '700 20px "Trebuchet MS", sans-serif';
    ctx.fillText('SUNBURST 2', 128, 94);
    const tex = new THREE.CanvasTexture(signCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    sign.position.set(1.55, 2.1, -0.66);
    g.add(sign);
    this.group.add(g);
    this.props.push({ type: 'busstop', x, z, radius: 1.4 });
  }

  makeUmbrella(x, z, color) {
    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 5), this.material('#d8cfba'));
    pole.position.y = 1.2;
    g.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 8), this.material(color));
    top.position.y = 2.3;
    top.rotation.z = 0.08;
    top.castShadow = true;
    g.add(top);
    this.group.add(g);
  }

  makeLifeguardTower(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    const legMat = this.material('#c9b58f');
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), legMat);
      leg.position.set(dx, 1.3, dz);
      leg.castShadow = true;
      g.add(leg);
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.6), this.material('#e8d9b8'));
    hut.position.y = 3.4;
    hut.castShadow = true;
    g.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 4), this.material('#c96f55'));
    roof.position.y = 4.7;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ color: '#ff6f61', side: THREE.DoubleSide }));
    flag.position.set(1.6, 5.1, 0);
    g.add(flag);
    this.group.add(g);
    this.props.push({ type: 'tower', x, z, radius: 1.6 });
  }

  heightAt(x, z) {
    if (x >= CITY.beachX) return 0.02;
    for (const info of this.blockInfo.values()) {
      const r = info.rect;
      if (x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) {
        return info.districtId === 'sabal' ? 0.13 : 0.2;
      }
    }
    return 0.02;
  }

  districtAt(x, z) {
    const col = Math.floor(x / WORLD.pitch);
    const row = Math.floor(z / WORLD.pitch);
    if (col < 0 || row < 0 || col >= WORLD.cols || row >= WORLD.rows) {
      if (x >= CITY.beachX) return DISTRICTS.coral;
      return DISTRICTS.coral;
    }
    return DISTRICTS[districtFor(col, row)];
  }

  nearestBuilding(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      const d = Math.hypot(b.cx - x, b.cz - z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  collides(x, z, radius) {
    for (const c of this.colliders) {
      const nx = clamp(x, c.x, c.x + c.w);
      const nz = clamp(z, c.z, c.z + c.d);
      if ((x - nx) ** 2 + (z - nz) ** 2 < radius * radius) return c;
    }
    return null;
  }

  resolveCircle(obj, radius) {
    let x = obj.x;
    let z = obj.z;
    for (let pass = 0; pass < 3; pass += 1) {
      let bumped = false;
      for (const c of this.colliders) {
        const nx = clamp(x, c.x, c.x + c.w);
        const nz = clamp(z, c.z, c.z + c.d);
        let dx = x - nx;
        let dz = z - nz;
        let d = Math.hypot(dx, dz);
        if (d >= radius) continue;
        if (d < 0.0001) {
          dx = x - (c.x + c.w / 2);
          dz = z - (c.z + c.d / 2);
          d = Math.hypot(dx, dz) || 1;
        }
        const push = radius - d;
        x += (dx / d) * push;
        z += (dz / d) * push;
        bumped = true;
      }
      if (!bumped) break;
    }
    obj.x = x;
    obj.z = z;
  }

  update(time) {
    if (this.sea) {
      this.sea.material.emissive = new THREE.Color('#0b2c33');
      this.sea.position.z = 150 + Math.sin(time * 0.1) * 0.4;
    }
  }
}

export { signTexture, plateTexture, glowSpriteTexture };
