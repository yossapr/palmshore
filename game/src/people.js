// The people of Palmshore: how a body is put together (skin, hair, shirt, hat, gun) and how it
// is drawn from above, with a soft ink shadow. Pedestrians, cops, goons and the player all use
// this one person model so the street reads at a glance.

import { PALETTE, SUN } from './config.js';
import { roundRectPath, hash2 } from './math.js';

export function makePerson(rng, opts = {}) {
  return {
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    angle: opts.angle ?? rng.range(0, 6.28),
    skin: opts.skin ?? rng.pick(PALETTE.skin),
    hair: opts.hair ?? rng.pick(PALETTE.hair),
    shirt: opts.shirt ?? rng.pick(PALETTE.shirts),
    pants: opts.pants ?? rng.pick(PALETTE.pants),
    hat: opts.hat ?? null,
    hatColor: opts.hatColor ?? PALETTE.cream,
    bag: opts.bag ?? rng.chance(0.18),
    phase: rng.range(0, 6.28),
    speed: opts.speed ?? rng.range(34, 58),
    walk: 0,
    kind: opts.kind ?? 'ped',
    armed: opts.armed ?? false,
    gun: opts.gun ?? null,
    health: opts.health ?? 100,
    maxHealth: opts.health ?? 100,
    dead: false,
    deadTimer: 0,
    panic: 0,
    fleeing: false,
    robbed: false,
    hurtFlash: 0,
    radius: 10,
    name: opts.name ?? null,
    boss: opts.boss ?? false,
    shootCooldown: rng.range(0.2, 1.1),
    accent: opts.accent ?? null,
  };
}

/** A top-down body: shadow, legs, shoulders, arms, head, and a gun when armed. */
export function drawPerson(ctx, p, time, opts = {}) {
  const dark = p.dead;
  ctx.save();
  ctx.translate(p.x, p.y);

  // Ink shadow, offset toward the sun's far side.
  ctx.fillStyle = 'rgba(30,25,20,0.22)';
  ctx.beginPath();
  ctx.ellipse(SUN.dx * 0.7, SUN.dy * 0.8, 9.5, 6.4, p.angle, 0, Math.PI * 2);
  ctx.fill();

  if (dark) {
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(90,45,38,0.5)';
    ctx.beginPath();
    ctx.ellipse(2, 2, 8, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.pants;
    roundRectPath(ctx, -5, -10, 10, 20, 3);
    ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.arc(-4, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const moving = Math.abs(p.walk ?? 0) > 0.1;
  const swing = moving ? Math.sin(p.phase) * 4.2 : 0;
  ctx.rotate(p.angle);

  // Legs (behind the body).
  ctx.strokeStyle = p.pants;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-1, -3.4);
  ctx.lineTo(-1 + swing * 0.5, -3.4);
  ctx.lineTo(2 + swing, -6.6);
  ctx.moveTo(-1, 3.4);
  ctx.lineTo(-1 - swing * 0.5, 3.4);
  ctx.lineTo(2 - swing, 6.6);
  ctx.stroke();

  // Shoulders: a rounded slab across the direction of travel.
  ctx.fillStyle = p.shirt;
  roundRectPath(ctx, -5.2, -6.4, 11.4, 12.8, 4.4);
  ctx.fill();
  if (p.kind === 'cop') {
    ctx.fillStyle = '#25384f';
    roundRectPath(ctx, -5.2, -6.4, 11.4, 12.8, 4.4);
    ctx.fill();
    ctx.fillStyle = '#d8dde0';
    ctx.fillRect(-1.2, -5, 2.2, 10);
    ctx.fillStyle = '#e8c34a';
    ctx.fillRect(-4.4, -1.6, 2, 1.5);
  } else if (p.kind === 'enemy') {
    ctx.strokeStyle = 'rgba(20,15,12,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-5, -6, 10, 12);
    if (p.boss) {
      ctx.fillStyle = p.accent ?? PALETTE.coralDeep;
      ctx.fillRect(-5, -6.4, 10.4, 2.6);
    }
  } else if (p.bag) {
    ctx.fillStyle = 'rgba(40,32,25,0.5)';
    ctx.beginPath();
    ctx.ellipse(-3.5, 5.6, 3.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Arms.
  ctx.strokeStyle = p.skin;
  ctx.lineWidth = 2.5;
  const armSwing = moving ? Math.cos(p.phase) * 2.6 : 0;
  if (p.armed) {
    const kick = p.recoil ?? 0;
    ctx.beginPath();
    ctx.moveTo(0, -5.6);
    ctx.lineTo(7.5 - kick * 2, -2.6);
    ctx.moveTo(0, 5.6);
    ctx.lineTo(7.5 - kick * 2, 2.6);
    ctx.stroke();
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(8.4 - kick * 2, -1.7, 7.4, 3.2);
    ctx.fillStyle = '#4a453d';
    ctx.fillRect(8.4 - kick * 2, -1.7, 3, 3.2);
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -5.6);
    ctx.lineTo(4 + armSwing * 0.2, -8.2);
    ctx.moveTo(0, 5.6);
    ctx.lineTo(4 - armSwing * 0.2, 8.2);
    ctx.stroke();
  }

  // Head and hair.
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(2.4, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(1.2, 0, 4.5, Math.PI * 0.55, Math.PI * 1.45);
  ctx.fill();
  if (p.hat) {
    ctx.fillStyle = p.hatColor;
    ctx.beginPath();
    ctx.arc(2.4, 0, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.arc(2.4, 0, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.kind === 'cop') {
    ctx.fillStyle = '#1c2b3d';
    ctx.beginPath();
    ctx.arc(2.4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c34a';
    ctx.beginPath();
    ctx.arc(2.8, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (p.hurtFlash > 0) {
    ctx.globalAlpha = Math.min(1, p.hurtFlash) * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A pedestrian's look, stable per position and seed so nobody changes clothes every frame. */
export function tintFor(x, y, seed) {
  const n = hash2(Math.round(x) + seed, Math.round(y));
  return PALETTE.shirts[Math.floor(n * PALETTE.shirts.length)];
}
