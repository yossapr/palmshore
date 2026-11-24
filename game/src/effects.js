// Particles and light: muzzle flashes, sparks, tyre dust, smoke, fire and explosions.
// All generated in code, all cheap sprites, all gone in a moment.

import { TAU } from './math.js';

function radialTexture(inner, outer, size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.4, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function muzzleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.translate(48, 48);
  ctx.fillStyle = 'rgba(255, 232, 170, 0.95)';
  ctx.beginPath();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * TAU;
    const radius = i % 2 === 0 ? 42 : 12;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 150, 60, 0.8)';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, TAU);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Effects {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.particles = [];
    this.textures = {
      smoke: radialTexture('rgba(210, 200, 184, 0.72)', 'rgba(120, 110, 100, 0.32)'),
      spark: radialTexture('rgba(255, 246, 200, 1)', 'rgba(255, 170, 60, 0.5)', 32),
      fire: radialTexture('rgba(255, 230, 150, 0.95)', 'rgba(255, 90, 40, 0.55)'),
      dust: radialTexture('rgba(228, 204, 164, 0.6)', 'rgba(170, 145, 108, 0.25)'),
      blood: radialTexture('rgba(150, 40, 40, 0.8)', 'rgba(80, 20, 20, 0.25)', 32),
      muzzle: muzzleTexture(),
      glow: radialTexture('rgba(255, 241, 200, 0.95)', 'rgba(255, 180, 90, 0.3)'),
    };
    this.budget = 260;
  }

  add(type, x, y, z, options = {}) {
    if (this.particles.length > this.budget) return null;
    const texture = this.textures[options.texture ?? type] ?? this.textures.spark;
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: options.color ?? '#ffffff',
      transparent: true,
      depthWrite: false,
      blending: options.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      opacity: options.opacity ?? 0.9,
    });
    const sprite = new THREE.Sprite(material);
    const scale = options.scale ?? 1;
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(x, y, z);
    this.scene.add(sprite);
    const particle = {
      sprite,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      vz: options.vz ?? 0,
      gravity: options.gravity ?? 0,
      life: options.life ?? 0.6,
      maxLife: options.life ?? 0.6,
      grow: options.grow ?? 0,
      fade: options.fade ?? true,
      floor: options.floor ?? 0.1,
      drift: options.drift ?? 0,
    };
    this.particles.push(particle);
    return particle;
  }

  spark(x, y, z, count = 5) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      this.add('spark', x, y, z, {
        scale: 0.12 + Math.random() * 0.12,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: 1 + Math.random() * 2.4,
        vz: Math.sin(angle) * (2 + Math.random() * 3),
        gravity: 9,
        life: 0.25 + Math.random() * 0.25,
        additive: true,
        color: '#ffd489',
      });
    }
  }

  dust(x, z, count = 1) {
    for (let i = 0; i < count; i += 1) {
      this.add('dust', x + (Math.random() - 0.5) * 1.5, 0.24, z + (Math.random() - 0.5) * 1.5, {
        scale: 1.2 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.4 + Math.random() * 0.4,
        vz: (Math.random() - 0.5) * 0.8,
        life: 0.8 + Math.random() * 0.8,
        grow: 1.4,
        color: '#d9c29a',
        opacity: 0.4,
      });
    }
  }

  smoke(x, y, z, strength = 1) {
    this.add('smoke', x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, {
      scale: 0.6 + strength * 0.5,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 1.0 + Math.random() * 0.8,
      vz: (Math.random() - 0.5) * 0.6,
      life: 1.2 + Math.random() * 1.4,
      grow: 1.9,
      color: strength > 0.9 ? '#4f4a44' : '#8c8378',
      opacity: 0.42,
    });
  }

  fire(x, y, z) {
    this.add('fire', x + (Math.random() - 0.5) * 0.7, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.7, {
      scale: 0.35 + Math.random() * 0.4,
      vy: 1.6 + Math.random() * 1.4,
      life: 0.32 + Math.random() * 0.3,
      additive: true,
      color: '#ff9a4a',
    });
  }

  blood(x, y, z) {
    for (let i = 0; i < 7; i += 1) {
      const angle = Math.random() * TAU;
      this.add('blood', x, y, z, {
        scale: 0.2 + Math.random() * 0.28,
        vx: Math.cos(angle) * (1 + Math.random() * 2.4),
        vy: 0.8 + Math.random() * 1.6,
        vz: Math.sin(angle) * (1 + Math.random() * 2.4),
        gravity: 8,
        life: 0.5 + Math.random() * 0.4,
        color: '#8e2f2f',
      });
    }
  }

  muzzle(x, y, z, angle) {
    this.add('muzzle', x, y, z, {
      scale: 1.3 + Math.random() * 0.6,
      life: 0.075,
      additive: true,
      opacity: 1,
      texture: 'muzzle',
    });
    const dir = {
      x: Math.cos(angle) * 0.25,
      z: Math.sin(angle) * 0.25,
    };
    this.add('glow', x + dir.x, y, z + dir.z, {
      scale: 1.8,
      life: 0.1,
      additive: true,
      opacity: 0.55,
      texture: 'glow',
      color: '#ffca7a',
    });
    for (let i = 0; i < 2; i += 1) {
      this.add('spark', x, y, z, {
        scale: 0.14,
        vx: Math.cos(angle + (Math.random() - 0.5) * 0.5) * 5,
        vy: 0.8 + Math.random(),
        vz: Math.sin(angle + (Math.random() - 0.5) * 0.5) * 5,
        gravity: 7,
        life: 0.16,
        additive: true,
        color: '#ffe3a0',
      });
    }
  }

  explosion(x, y, z) {
    this.add('glow', x, y + 0.8, z, {
      scale: 7, life: 0.22, additive: true, opacity: 1, texture: 'glow', color: '#ffd08a',
    });
    this.add('fire', x, y + 0.6, z, {
      scale: 3.4, life: 0.4, additive: true, opacity: 1, texture: 'fire', color: '#ffb058', grow: 2,
    });
    for (let i = 0; i < 18; i += 1) {
      const angle = Math.random() * TAU;
      this.add('fire', x, y + 0.4, z, {
        scale: 0.5 + Math.random(),
        vx: Math.cos(angle) * (2 + Math.random() * 5),
        vy: 2 + Math.random() * 4,
        vz: Math.sin(angle) * (2 + Math.random() * 5),
        gravity: 5,
        life: 0.4 + Math.random() * 0.5,
        additive: true,
        color: '#ff9a4a',
      });
    }
    for (let i = 0; i < 12; i += 1) {
      this.add('smoke', x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, {
        scale: 1.4 + Math.random() * 2,
        vy: 1.6 + Math.random() * 2,
        life: 1.6 + Math.random() * 1.6,
        grow: 2.4,
        color: '#3e3a36',
        opacity: 0.55,
      });
    }
  }

  money(x, z) {
    for (let i = 0; i < 5; i += 1) {
      this.add('glow', x, 1.1, z, {
        scale: 0.28,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 1.6 + Math.random(),
        vz: (Math.random() - 0.5) * 1.6,
        gravity: 4,
        life: 0.7,
        additive: true,
        texture: 'glow',
        color: '#ffd166',
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y = Math.max(p.floor, p.sprite.position.y + p.vy * dt);
      p.sprite.position.z += p.vz * dt;
      if (p.drift) p.sprite.position.x += p.drift * dt;
      const t = p.life / p.maxLife;
      const scale = p.sprite.scale.x + p.grow * dt;
      p.sprite.scale.set(scale, scale, 1);
      if (p.fade) p.sprite.material.opacity = Math.min(1, t * 1.8);
    }
  }
}
