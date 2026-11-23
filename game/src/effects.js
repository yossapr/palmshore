// The game's smoke and mirrors: skid marks, scorch, muzzle flashes, blood, sparks, fire, dust,
// explosions, rain rings, and the floating cash labels. Two layers: marks that stain the road,
// and things that live in the air above it. All of it is pooled by cap and culled by the camera.

import { clamp } from './math.js';
import { SUN } from './config.js';

const MAX_PARTICLES = 460;
const MAX_SKIDS = 700;
const MAX_TEXT = 24;

export function createEffects() {
  const particles = [];
  const skids = [];
  const scorches = [];
  const texts = [];
  const rings = [];

  function addParticle(kind, x, y, vx, vy, life, size, color, opts = {}) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({
      kind,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size,
      color,
      drag: opts.drag ?? 1.6,
      gravity: opts.gravity ?? 0,
      grow: opts.grow ?? 0,
      rot: Math.random() * 6.28,
      spin: opts.spin ?? 0,
    });
  }

  function skid(x, y, angle) {
    if (skids.length > MAX_SKIDS) skids.shift();
    skids.push({ x, y, angle, life: 24, maxLife: 24 });
  }

  function scorch(x, y) {
    scorches.push({ x, y, r: 34 + Math.random() * 14, life: 60, maxLife: 60 });
  }

  function blood(x, y, count = 3) {
    for (let k = 0; k < count; k += 1) {
      const a = Math.random() * 6.28;
      const s = 20 + Math.random() * 80;
      addParticle('dot', x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.5, 1.4 + Math.random() * 2.6, '#772a25', { drag: 4 });
    }
    if (count > 6) {
      skids.push({ x, y, angle: 0, life: 24, maxLife: 24, blood: true, size: 9 });
    }
  }

  function smoke(x, y, count = 2) {
    for (let k = 0; k < count; k += 1) {
      addParticle('smoke', x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 20, -12 - Math.random() * 18, 1.1 + Math.random() * 1.3, 6 + Math.random() * 8, Math.random() < 0.5 ? '#6b645c' : '#8b8378', { grow: 12, drag: 0.8 });
    }
  }

  function fire(x, y) {
    addParticle('fire', x + (Math.random() - 0.5) * 7, y + (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 16, -26 - Math.random() * 30, 0.35 + Math.random() * 0.3, 4 + Math.random() * 7, Math.random() < 0.5 ? '#f2a33c' : '#e2622f', { grow: 10, drag: 0.6 });
    if (Math.random() < 0.35) smoke(x, y, 1);
  }

  function spark(x, y, count = 4) {
    for (let k = 0; k < count; k += 1) {
      const a = Math.random() * 6.28;
      const s = 60 + Math.random() * 190;
      addParticle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, 0.18 + Math.random() * 0.25, 1 + Math.random() * 1.8, Math.random() < 0.5 ? '#ffd88a' : '#fff2c8', { drag: 3.5 });
    }
  }

  function muzzle(x, y, angle, scale = 1) {
    addParticle('flash', x + Math.cos(angle) * 7, y + Math.sin(angle) * 7, Math.cos(angle) * 40, Math.sin(angle) * 40, 0.075, 6 * scale, '#ffe9ac', { drag: 6 });
    if (particles.length) particles[particles.length - 1].rot = angle;
    for (let k = 0; k < 3; k += 1) {
      const a = angle + (Math.random() - 0.5) * 0.5;
      addParticle('spark', x, y, Math.cos(a) * (140 + Math.random() * 160), Math.sin(a) * (140 + Math.random() * 160), 0.12 + Math.random() * 0.15, 1.4, '#ffd27a', { drag: 5 });
    }
    addParticle('smoke', x, y, Math.cos(angle) * 18, Math.sin(angle) * 18, 0.5, 3, '#a89a86', { grow: 8, drag: 1.2 });
  }

  function swing(x, y, angle) {
    for (let k = 0; k < 4; k += 1) {
      const a = angle - 0.6 + k * 0.4;
      addParticle('dot', x + Math.cos(a) * 18, y + Math.sin(a) * 18, Math.cos(a) * 30, Math.sin(a) * 30, 0.16, 2, '#f4e6c4', { drag: 5 });
    }
  }

  function dust(x, y) {
    if (Math.random() < 0.5) return;
    addParticle('smoke', x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 14, -6, 0.7, 5 + Math.random() * 6, '#d9c399', { grow: 8, drag: 1 });
  }

  function splash(x, y) {
    for (let k = 0; k < 16; k += 1) {
      const a = Math.random() * 6.28;
      const s = 30 + Math.random() * 150;
      addParticle('dot', x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 2 + Math.random() * 3, '#bfe9e2', { drag: 2.4 });
    }
    rings.push({ x, y, r: 6, max: 52, life: 0.7, maxLife: 0.7, color: '#cdeee6' });
  }

  function ring(x, y, max = 60, color = '#fff0c8') {
    rings.push({ x, y, r: 4, max, life: 0.5, maxLife: 0.5, color });
  }

  function explosion(x, y) {
    scorch(x, y);
    ring(x, y, 92, '#ffcf8a');
    for (let k = 0; k < 26; k += 1) {
      const a = Math.random() * 6.28;
      const s = 60 + Math.random() * 260;
      addParticle('fire', x, y, Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6, 0.4 + Math.random() * 0.6, 8 + Math.random() * 16, Math.random() < 0.6 ? '#f3a63e' : '#e0552e', { grow: 14, drag: 2 });
    }
    for (let k = 0; k < 18; k += 1) {
      addParticle('smoke', x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 60, -20 - Math.random() * 50, 1.4 + Math.random() * 1.6, 12 + Math.random() * 20, '#4b4640', { grow: 22, drag: 0.7 });
    }
    for (let k = 0; k < 20; k += 1) {
      const a = Math.random() * 6.28;
      const s = 120 + Math.random() * 340;
      addParticle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.5, 1.6 + Math.random() * 2.4, '#ffd98f', { drag: 1.8 });
    }
  }

  function glass(x, y) {
    for (let k = 0; k < 6; k += 1) {
      const a = Math.random() * 6.28;
      addParticle('dot', x, y, Math.cos(a) * 90, Math.sin(a) * 90, 0.5, 1.3, '#cfe9e6', { drag: 3 });
    }
  }

  function text(x, y, message, color = '#f7e9c0') {
    if (texts.length > MAX_TEXT) texts.shift();
    texts.push({ x, y, message, color, life: 1.5, maxLife: 1.5 });
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vx *= Math.exp(-p.drag * dt);
      p.vy *= Math.exp(-p.drag * dt);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += p.spin * dt;
    }
    for (let i = skids.length - 1; i >= 0; i -= 1) {
      skids[i].life -= dt;
      if (skids[i].life <= 0) skids.splice(i, 1);
    }
    for (let i = scorches.length - 1; i >= 0; i -= 1) {
      scorches[i].life -= dt;
      if (scorches[i].life <= 0) scorches.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.life -= dt;
      r.r += (r.max - r.r) * Math.min(1, dt * 9);
      if (r.life <= 0) rings.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i -= 1) {
      const t = texts[i];
      t.life -= dt;
      t.y -= dt * 20;
      if (t.life <= 0) texts.splice(i, 1);
    }
  }

  function visible(x, y, view, pad = 80) {
    return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
  }

  function drawGround(ctx, view) {
    for (const s of scorches) {
      if (!visible(s.x, s.y, view, 80)) continue;
      const a = clamp(s.life / s.maxLife, 0, 1) * 0.5;
      ctx.fillStyle = `rgba(32,26,22,${a * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of skids) {
      if (!visible(s.x, s.y, view, 40)) continue;
      const a = clamp(s.life / s.maxLife, 0, 1) * 0.45;
      ctx.strokeStyle = s.blood ? `rgba(105,36,30,${a * 0.8})` : `rgba(34,30,27,${a})`;
      ctx.lineWidth = s.blood ? s.size : 3.2;
      ctx.lineCap = 'round';
      if (s.blood) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(105,36,30,${a * 0.7})`;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(s.x - Math.cos(s.angle) * 5, s.y - Math.sin(s.angle) * 5);
        ctx.lineTo(s.x + Math.cos(s.angle) * 5, s.y + Math.sin(s.angle) * 5);
        ctx.stroke();
      }
    }
  }

  function drawAir(ctx, view) {
    for (const p of particles) {
      if (!visible(p.x, p.y, view, 60)) continue;
      const k = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = p.kind === 'smoke' ? k * 0.55 : k;
      ctx.fillStyle = p.color;
      if (p.kind === 'smoke') {
        ctx.beginPath();
        ctx.arc(p.x + SUN.dx * 0.3, p.y + SUN.dy * 0.3, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'fire') {
        ctx.globalAlpha = k * 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'flash') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = k * 0.35;
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = k;
        const flare = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 1.2);
        flare.addColorStop(0, '#fffbe8');
        flare.addColorStop(0.45, '#ffe39a');
        flare.addColorStop(1, 'rgba(255,180,80,0)');
        ctx.fillStyle = flare;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,226,150,0.85)';
        ctx.beginPath();
        ctx.moveTo(p.size * 0.5, 0);
        ctx.lineTo(p.size * 2.5, -p.size * 0.32);
        ctx.lineTo(p.size * 1.5, 0);
        ctx.lineTo(p.size * 2.5, p.size * 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'spark') {
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const r of rings) {
      const k = r.life / r.maxLife;
      ctx.globalAlpha = k * 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.4 * k + 0.6;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const t of texts) {
      const k = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.font = '700 13px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(28,23,19,0.75)';
      ctx.strokeText(t.message, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.message, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  return { skid, scorch, blood, smoke, fire, spark, muzzle, swing, dust, splash, explosion, glass, ring, text, update, drawGround, drawAir, particles, skids, scorches, texts, rings };
}
