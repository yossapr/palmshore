// The street grid: intersection graph, lanes, light cycles, and the low-poly road surface
// with baked lane paint and crossings. Everything the traffic AI and the map need lives here.

import { WORLD, CITY, STREETS_H, STREETS_V, CLOCK } from './config.js';
import { TAU, clamp } from './math.js';
import { Rng } from './random.js';

export const LANE = 3.8;
export const ROAD_HALF = WORLD.roadHalf;

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function textureFromCanvas(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class Roads {
  constructor(seed) {
    this.seed = seed;
    this.cols = WORLD.cols;
    this.rows = WORLD.rows;
    this.nodes = [];
    this.hNames = STREETS_H;
    this.vNames = STREETS_V;
    this.rng = new Rng(seed ^ 0x51a7);
    for (let col = 0; col <= this.cols; col += 1) {
      for (let row = 0; row <= this.rows; row += 1) {
        this.nodes.push({
          index: col * (this.rows + 1) + row,
          col, row,
          x: CITY.gridX(col),
          z: CITY.gridZ(row),
          phase: (col * 3.1 + row * 5.7) % 18,
        });
      }
    }
    this.hEdges = [];
    this.vEdges = [];
    for (let row = 0; row <= this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        this.hEdges.push({
          axis: 'h', col, row,
          x0: this.node(col, row).x, x1: this.node(col + 1, row).x,
          z: this.node(col, row).z,
          name: this.hNames[row] ?? 'COAST RD',
        });
      }
    }
    for (let col = 0; col <= this.cols; col += 1) {
      for (let row = 0; row < this.rows; row += 1) {
        this.vEdges.push({
          axis: 'v', col, row,
          z0: this.node(col, row).z, z1: this.node(col, row + 1).z,
          x: this.node(col, row).x,
          name: this.vNames[col] ?? 'SHORE LN',
        });
      }
    }
    this.signalHeads = [];
    this.materials = [];
  }

  node(col, row) {
    return this.nodes[clamp(col, 0, this.cols) * (this.rows + 1) + clamp(row, 0, this.rows)];
  }

  nearestNode(x, z) {
    let best = this.nodes[0];
    let bestD = Infinity;
    for (const node of this.nodes) {
      const d = (node.x - x) ** 2 + (node.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    return best;
  }

  nearestRoad(x, z) {
    let best = null;
    for (const edge of this.hEdges) {
      if (x < edge.x0 - 2 || x > edge.x1 + 2) continue;
      const d = Math.abs(z - edge.z);
      if (d < (best?.d ?? 9999)) {
        best = { axis: 'h', d, x: clamp(x, edge.x0, edge.x1), z: edge.z, name: edge.name, edge };
      }
    }
    for (const edge of this.vEdges) {
      if (z < edge.z0 - 2 || z > edge.z1 + 2) continue;
      const d = Math.abs(x - edge.x);
      if (d < (best?.d ?? 9999)) {
        best = { axis: 'v', d, x: edge.x, z: clamp(z, edge.z0, edge.z1), name: edge.name, edge };
      }
    }
    return best;
  }

  isRoad(x, z) {
    const road = this.nearestRoad(x, z);
    return !!road && road.d <= ROAD_HALF;
  }

  lightState(node, axis, time) {
    const t = (time + node.phase) % 18;
    if (axis === 'v') {
      if (t < 7.4) return 'green';
      if (t < 8.6) return 'amber';
      return 'red';
    }
    if (t >= 9 && t < 16.4) return 'green';
    if (t >= 16.4 && t < 17.6) return 'amber';
    if (t < 0.6) return 'amber';
    return 'red';
  }

  spawnLane(rng, near) {
    const pool = [];
    for (const edge of this.hEdges) {
      if (near && Math.hypot((edge.x0 + edge.x1) / 2 - near.x, edge.z - near.z) > 190) continue;
      pool.push(edge);
    }
    for (const edge of this.vEdges) {
      if (near && Math.hypot(edge.x - near.x, (edge.z0 + edge.z1) / 2 - near.z) > 190) continue;
      pool.push(edge);
    }
    const edge = rng.pick(pool);
    const dir = rng.chance(0.5) ? 1 : -1;
    if (edge.axis === 'h') {
      return {
        x: rng.range(edge.x0 + 5, edge.x1 - 5),
        z: edge.z + dir * LANE,
        heading: dir > 0 ? 0 : Math.PI,
        axis: 'h', dir, edge,
      };
    }
    return {
      x: edge.x + dir * LANE,
      z: rng.range(edge.z0 + 5, edge.z1 - 5),
      heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      axis: 'v', dir, edge,
    };
  }

  stepNode(col, row, dx, dy) {
    const nc = col + dx;
    const nr = row + dy;
    if (nc < 0 || nc > this.cols || nr < 0 || nr > this.rows) return null;
    return this.node(nc, nr);
  }

  blockRect(col, row) {
    const x0 = CITY.gridX(col) + ROAD_HALF;
    const x1 = CITY.gridX(col + 1) - ROAD_HALF;
    const z0 = CITY.gridZ(row) + ROAD_HALF;
    const z1 = CITY.gridZ(row + 1) - ROAD_HALF;
    return { x: x0, z: z0, w: x1 - x0, d: z1 - z0 };
  }

  // ---------------------------------------------------------------- 3D surfaces
  buildMeshes(scene) {
    const asphaltTex = textureFromCanvas(this.paintRoadTexture());
    const crossTex = textureFromCanvas(this.paintIntersectionTexture());
    this.materials.push(asphaltTex, crossTex);
    this.roadMaterial = new THREE.MeshLambertMaterial({ map: asphaltTex, color: '#ffffff' });
    this.crossMaterial = new THREE.MeshLambertMaterial({ map: crossTex });
    this.roadMaterial.map.wrapS = THREE.ClampToEdgeWrapping;
    this.roadMaterial.map.wrapT = THREE.ClampToEdgeWrapping;

    const group = new THREE.Group();
    group.name = 'roads';
    for (const edge of this.hEdges) {
      const geometry = new THREE.PlaneGeometry(edge.x1 - edge.x0, ROAD_HALF * 2);
      const mesh = new THREE.Mesh(geometry, this.roadMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((edge.x0 + edge.x1) / 2, 0.012, edge.z);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const edge of this.vEdges) {
      const geometry = new THREE.PlaneGeometry(edge.z1 - edge.z0, ROAD_HALF * 2);
      const mesh = new THREE.Mesh(geometry, this.roadMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(edge.x, 0.014, (edge.z0 + edge.z1) / 2);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const node of this.nodes) {
      const geometry = new THREE.PlaneGeometry(ROAD_HALF * 2 + 0.2, ROAD_HALF * 2 + 0.2);
      const mesh = new THREE.Mesh(geometry, this.crossMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(node.x, 0.026, node.z);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.buildSignals(group);
    scene.add(group);
    this.group = group;
  }

  paintRoadTexture() {
    const canvas = makeCanvas(1024, 256);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CLOCK.asphalt;
    ctx.fillRect(0, 0, 1024, 256);
    const rng = new Rng(0xa5f01);
    for (let i = 0; i < 900; i += 1) {
      const shade = rng.int(0, 26);
      ctx.fillStyle = `rgba(${shade + 30},${shade + 34},${shade + 36},${rng.range(0.05, 0.18)})`;
      ctx.fillRect(rng.range(0, 1024), rng.range(0, 256), rng.range(1, 9), rng.range(1, 3));
    }
    // Patched repairs, oil stains and a faint warm wash from the low sun.
    for (let i = 0; i < 16; i += 1) {
      ctx.fillStyle = `rgba(18, 22, 24, ${rng.range(0.08, 0.2)})`;
      ctx.fillRect(rng.range(0, 1000), rng.range(20, 230), rng.range(20, 70), rng.range(3, 8));
    }
    ctx.fillStyle = 'rgba(255, 196, 120, 0.05)';
    ctx.fillRect(0, 0, 1024, 60);
    const mPerPx = 62 / 1024;
    const yFor = (metres) => 128 + metres * (256 / 15.2);
    // Edge lines.
    ctx.fillStyle = 'rgba(240, 235, 214, 0.5)';
    ctx.fillRect(0, yFor(-6.7), 1024, 2);
    ctx.fillRect(0, yFor(6.7), 1024, 2);
    // Double yellow centre.
    ctx.fillStyle = 'rgba(226, 181, 75, 0.9)';
    ctx.fillRect(0, 126, 1024, 2.5);
    ctx.fillRect(0, 131, 1024, 2.5);
    // Dashed lane dividers.
    ctx.fillStyle = 'rgba(238, 234, 214, 0.55)';
    for (let x = 0; x < 1024; x += 104) {
      for (const off of [-LANE, LANE]) {
        ctx.fillRect(x, yFor(off) - 1, 46, 2.5);
      }
    }
    // Manholes and tyre polish.
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = 'rgba(24, 28, 30, 0.55)';
      ctx.beginPath();
      ctx.arc(rng.range(30, 1000), rng.range(30, 226), rng.range(5, 8), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(22, 26, 28, 0.16)';
    ctx.fillRect(0, yFor(-1.4), 1024, 1.4 * (256 / 15.2));
    ctx.fillRect(0, yFor(1.0), 1024, 0.8 * (256 / 15.2));
    void mPerPx;
    return canvas;
  }

  paintIntersectionTexture() {
    const canvas = makeCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CLOCK.asphalt;
    ctx.fillRect(0, 0, 256, 256);
    const rng = new Rng(0x77b3);
    for (let i = 0; i < 200; i += 1) {
      ctx.fillStyle = `rgba(28, 32, 34, ${rng.range(0.04, 0.15)})`;
      ctx.fillRect(rng.range(0, 256), rng.range(0, 256), rng.range(2, 14), rng.range(1, 3));
    }
    ctx.fillStyle = 'rgba(246, 241, 222, 0.72)';
    // Zebra stripes on all four sides, just inside the 15.2 m box.
    const band = 22;
    for (let i = 0; i < 6; i += 1) {
      const p = 58 + i * 24;
      ctx.fillRect(p, 4, 9, band);
      ctx.fillRect(p, 256 - 4 - band, 9, band);
      ctx.fillRect(4, p, band, 9);
      ctx.fillRect(256 - 4 - band, p, band, 9);
    }
    // Stop lines.
    ctx.fillStyle = 'rgba(246, 241, 222, 0.8)';
    ctx.fillRect(34, 30, 188, 3);
    ctx.fillRect(34, 223, 188, 3);
    ctx.fillRect(30, 34, 3, 188);
    ctx.fillRect(223, 34, 3, 188);
    return canvas;
  }

  buildSignals(parent) {
    const poleMat = new THREE.MeshLambertMaterial({ color: '#232c31' });
    const headMat = new THREE.MeshLambertMaterial({ color: '#1a2226' });
    const offMat = new THREE.MeshBasicMaterial({ color: '#30383a' });
    const redMat = new THREE.MeshBasicMaterial({ color: '#ff4d4d' });
    const amberMat = new THREE.MeshBasicMaterial({ color: '#ffbf47' });
    const greenMat = new THREE.MeshBasicMaterial({ color: '#62e38c' });
    const materials = { offMat, redMat, amberMat, greenMat };
    this.signalMaterials = materials;
    for (const node of this.nodes) {
      if (node.col === 0 || node.row === 0) continue;
      const g = new THREE.Group();
      const x = node.x - ROAD_HALF - 1.4;
      const z = node.z + ROAD_HALF + 1.4;
      g.position.set(x, 0.18, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.4, 6), poleMat);
      pole.position.y = 2.2;
      pole.castShadow = true;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.1), poleMat);
      arm.position.set(0, 4.2, -1.5);
      arm.castShadow = true;
      g.add(arm);
      // One head facing the northbound lane and one facing the eastbound lane.
      const headA = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.05, 0.24), headMat);
      headA.position.set(0, 4.0, -2.4);
      g.add(headA);
      const headB = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.05, 0.38), headMat);
      headB.position.set(0.55, 4.0, -1.0);
      g.add(headB);
      const axisLights = [
        { axis: 'v', head: headA, dots: [] },
        { axis: 'h', head: headB, dots: [] },
      ];
      for (const entry of axisLights) {
        for (let i = 0; i < 3; i += 1) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), offMat);
          dot.position.set(0, 0.3 - i * 0.3, 0.14);
          entry.head.add(dot);
          entry.dots.push(dot);
        }
      }
      this.signalHeads.push({ node, lights: axisLights });
      parent.add(g);
    }
  }

  updateSignals(time) {
    for (const signal of this.signalHeads) {
      for (const light of signal.lights) {
        const state = this.lightState(signal.node, light.axis, time);
        light.dots[0].material = state === 'red' ? this.signalMaterials.redMat : this.signalMaterials.offMat;
        light.dots[1].material = state === 'amber' ? this.signalMaterials.amberMat : this.signalMaterials.offMat;
        light.dots[2].material = state === 'green' ? this.signalMaterials.greenMat : this.signalMaterials.offMat;
      }
    }
  }

  buildStreetSigns(parent) {
    const poleMat = new THREE.MeshLambertMaterial({ color: '#2a3439' });
    const posts = [
      { node: this.node(7, 3), name: 'TIDE AVE', rotate: Math.PI / 2 },
      { node: this.node(6, 3), name: 'CORAL WAY', rotate: 0 },
      { node: this.node(5, 2), name: 'MARLIN DR', rotate: Math.PI / 2 },
      { node: this.node(2, 2), name: 'PALMETTO BLVD', rotate: 0 },
      { node: this.node(4, 4), name: 'DOCK LN', rotate: Math.PI / 2 },
    ];
    for (const spec of posts) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 5), poleMat);
      pole.position.set(spec.node.x + ROAD_HALF + 1.5, 1.8, spec.node.z - ROAD_HALF - 1.5);
      pole.castShadow = true;
      parent.add(pole);
      const texture = textureFromCanvas(this.namePlate(spec.name));
      this.materials.push(texture);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.5), mat);
      sign.position.copy(pole.position);
      sign.position.y = 3.3;
      sign.rotation.y = spec.rotate;
      parent.add(sign);
    }
  }

  namePlate(name) {
    const canvas = makeCanvas(512, 128);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#173226';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#f2e9d2';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = '#f2e9d2';
    ctx.font = '700 54px "Trebuchet MS", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 256, 68);
    return canvas;
  }
}
