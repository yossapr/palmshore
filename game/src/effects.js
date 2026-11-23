// Particles, skid marks, scorches and screen shake: the small, cheap effects that make the city
// feel alive. Everything is drawn by render.js from these arrays; nothing here touches the DOM.

import { PALETTE } from './config.js';
import { clamp } from './math.js';

const MAX_PARTICLES = 520;
const MAX_MARKS = 700;

export function addParticle(game, particle) {
  if (game.particles.length >= MAX_PARTICLES) game.particles.shift();
  game.particles.push(particle);
}

export function spark(game, x, y, angle, count = 6, color = '#ffd98a') {
  for (let i = 0; i < count; i += 1) {
    const a = angle + (Math.random() - 0.5) * 1.7;
    const speed = 120 + Math.random() * 340;
    addParticle(game, {
      kind: 'spark', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 0.18 + Math.random() * 0.28, max: 0.5, color, size: 1.4 + Math.random() * 1.6,
    });
  }
}

export function muzzleFlash(game, x, y, angle) {
  addParticle(game, { kind: 'flash', x, y, angle, life: 0.07, max: 0.07, size: 20 });
  spark(game, x, y, angle, 4, '#ffe1a0');
  addParticle(game, { kind: 'smoke', x, y, vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30, life: 0.5, max: 0.5, size: 7, grow: 24, color: '#d9cdb4' });
}

export function puff(game, x, y, color = '#d8cfbc', size = 8) {
  addParticle(game, {
    kind: 'smoke', x, y, vx: (Math.random() - 0.5) * 26, vy: (Math.random() - 0.5) * 26 - 8,
    life: 0.7 + Math.random() * 0.6, max: 1.3, size, grow: 22, color,
  });
}

export function tyreSmoke(game, x, y) {
  addParticle(game, {
    kind: 'smoke', x, y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
    life: 0.9, max: 0.9, size: 6, grow: 30, color: '#e6ddca',
  });
}

export function explosion(game, x, y, scale = 1) {
  for (let i = 0; i < 26; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = (50 + Math.random() * 230) * scale;
    addParticle(game, {
      kind: 'fire', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 0.4 + Math.random() * 0.7, max: 1.1, size: 8 + Math.random() * 16, grow: 16, color: Math.random() > 0.5 ? '#ffb03a' : '#e2604a',
    });
  }
  for (let i = 0; i < 16; i += 1) {
    addParticle(game, {
      kind: 'smoke', x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 50,
      vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80,
      life: 1.4 + Math.random() * 1.4, max: 2.8, size: 16, grow: 50, color: '#6d6257',
    });
  }
  addParticle(game, { kind: 'ring', x, y, life: 0.55, max: 0.55, size: 8, grow: 380, color: '#ffd593' });
  game.scorches.push({ x, y, r: 46 * scale, alpha: 0.6 });
  if (game.scorches.length > 60) game.scorches.shift();
  addShake(game, 14 * scale);
}

export function addShake(game, amount) {
  game.shake = clamp(Math.max(game.shake, amount), 0, 26);
}

export function addSkid(game, x1, y1, x2, y2, alpha = 0.5) {
  if (game.marks.length >= MAX_MARKS) game.marks.shift();
  game.marks.push({ x1, y1, x2, y2, alpha, life: 26, max: 26, w: 4 + Math.random() * 2 + alpha * 2 });
}

export function updateEffects(game, dt) {
  const particles = game.particles;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += (p.vx ?? 0) * dt;
    p.y += (p.vy ?? 0) * dt;
    if (p.kind === 'smoke' || p.kind === 'fire') {
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.size += (p.grow ?? 0) * dt;
    } else if (p.kind === 'spark') {
      p.vx *= 0.9;
      p.vy *= 0.9;
    } else if (p.kind === 'debris') {
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.angle += dt * 6;
    }
  }
  for (let i = game.marks.length - 1; i >= 0; i -= 1) {
    const mark = game.marks[i];
    mark.life -= dt;
    if (mark.life <= 0) game.marks.splice(i, 1);
  }
  for (let i = game.scorches.length - 1; i >= 0; i -= 1) {
    game.scorches[i].alpha -= dt * 0.004;
    if (game.scorches[i].alpha <= 0) game.scorches.splice(i, 1);
  }
  game.shake = Math.max(0, game.shake - game.shake * 7 * dt - 0.2 * dt);
  game.hitFlash = Math.max(0, game.hitFlash - dt * 2.2);
  if (game.speedLines > 0) game.speedLines = Math.max(0, game.speedLines - dt * 3);
  if (game.sunPulse === undefined) game.sunPulse = 0;
  game.sunPulse += dt;
}

/** A soft, blood-safe burst where a person is hit. */
export function hitSpark(game, x, y, angle) {
  spark(game, x, y, angle, 5, '#f2c98a');
  addParticle(game, { kind: 'ring', x, y, life: 0.24, max: 0.24, size: 2, grow: 70, color: '#f0d9a8' });
  addParticle(game, { kind: 'smoke', x, y, vx: 0, vy: -10, life: 0.5, max: 0.5, size: 3, grow: 18, color: PALETTE.danger });
}

export function cashBurst(game, x, y) {
  spark(game, x, y, -Math.PI / 2, 8, PALETTE.gold);
}
