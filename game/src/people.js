// Low-poly people, their walk cycles, and the vector portraits the dialogue box uses.

import { FONTS, UI } from './config.js';
import { TAU, clamp, lerp } from './math.js';

const materialCache = new Map();

export function personMaterial(color) {
  if (materialCache.has(color)) return materialCache.get(color);
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  materialCache.set(color, mat);
  return mat;
}

export const PLAYER_SPEC = {
  id: 'rook',
  name: 'ROOK',
  skin: '#b97c50',
  skinShadow: '#8d5a38',
  hair: '#221d1b',
  shirt: '#f0e4c8',
  jacket: '#2c3a40',
  pants: '#3f4a58',
  accent: '#ff7d64',
  style: 'player',
};

export const POLICE_SPEC = {
  id: 'officer',
  name: 'PALMSHORE PD',
  skin: '#c78e63',
  skinShadow: '#996744',
  hair: '#2a2420',
  shirt: '#20344a',
  jacket: '#16283a',
  pants: '#1d2c3c',
  accent: '#79b8ff',
  style: 'police',
};

export function makePerson(spec = PLAYER_SPEC, options = {}) {
  const group = new THREE.Group();
  const scale = options.scale ?? 1;
  const skin = personMaterial(spec.skin);
  const shirt = personMaterial(spec.shirt);
  const jacket = personMaterial(spec.jacket ?? spec.shirt);
  const pants = personMaterial(spec.pants ?? '#3d4148');
  const hair = personMaterial(spec.hair ?? '#2c2420');
  const dark = personMaterial('#1b2124');

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.32), jacket);
  body.position.y = 1.14;
  body.castShadow = true;
  group.add(body);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.44, 0.05), shirt);
  chest.position.set(0, 1.17, 0.19);
  group.add(chest);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.3), pants);
  hips.position.y = 0.72;
  group.add(hips);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 8, 6), skin);
  head.position.y = 1.65;
  head.castShadow = true;
  group.add(head);
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.34), hair);
  hairMesh.position.set(0, 1.79, -0.015);
  group.add(hairMesh);
  if (spec.style === 'police') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.36), dark);
    cap.position.set(0, 1.82, -0.01);
    group.add(cap);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.18), dark);
    visor.position.set(0, 1.76, 0.16);
    group.add(visor);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.38, 0.36), dark);
    vest.position.y = 1.2;
    group.add(vest);
  }
  if (spec.style === 'player') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.08, 0.35), personMaterial('#d9503f'));
    cap.position.set(0, 1.83, -0.01);
    group.add(cap);
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.14, 0.72, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.66, 0.2), pants);
    leg.position.y = -0.34;
    leg.castShadow = true;
    pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.28), dark);
    shoe.position.set(0, -0.68, 0.04);
    pivot.add(shoe);
    group.add(pivot);
    legs.push(pivot);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 1.38, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.58, 0.17), jacket);
    arm.position.y = -0.3;
    arm.castShadow = true;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), skin);
    hand.position.y = -0.62;
    pivot.add(hand);
    group.add(pivot);
    arms.push(pivot);
  }
  group.scale.setScalar(scale);
  return {
    group,
    body,
    head,
    hair: hairMesh,
    legs,
    arms,
    spec,
    phase: options.phase ?? 0,
    aim: 0,
  };
}

export function animatePerson(person, time, moving, speed = 1) {
  const rate = 7.2 + speed * 1.4;
  const swing = moving ? Math.sin(time * rate + person.phase) * 0.52 : 0;
  person.legs[0].rotation.x = swing;
  person.legs[1].rotation.x = -swing;
  person.arms[0].rotation.x = -swing * 0.75;
  person.arms[1].rotation.x = swing * 0.75;
  person.arms[0].rotation.z = 0.08;
  person.arms[1].rotation.z = -0.08;
  person.body.position.y = 1.14 + (moving ? Math.abs(Math.sin(time * rate + person.phase)) * 0.035 : 0);
  person.head.position.y = 1.65 + (moving ? Math.abs(Math.sin(time * rate + person.phase)) * 0.02 : 0);
}

export function setPersonAim(person, amount) {
  if (!person.arms) return;
  person.arms[0].rotation.x = lerp(person.arms[0].rotation.x, -1.35, amount);
  person.arms[1].rotation.x = lerp(person.arms[1].rotation.x, -1.35, amount);
  person.arms[0].rotation.z = lerp(person.arms[0].rotation.z, 0.3, amount);
  person.arms[1].rotation.z = lerp(person.arms[1].rotation.z, -0.1, amount);
}

// ---------------------------------------------------------------- portraits
export function drawPortrait(ctx, x, y, size, spec, time, accent = '#ffc857') {
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, size, size, Math.round(size * 0.1));
  ctx.clip();
  const bg = ctx.createLinearGradient(x, y, x, y + size);
  bg.addColorStop(0, spec.portraitBg ?? '#1b3947');
  bg.addColorStop(1, '#0b171d');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, size, size);
  // Halo and halftone.
  ctx.fillStyle = `${accent}22`;
  ctx.beginPath();
  ctx.arc(x + size * 0.5, y + size * 0.47, size * 0.37, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `${accent}33`;
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 6; j += 1) {
      ctx.beginPath();
      ctx.arc(x + size * (0.12 + i * 0.15), y + size * (0.12 + j * 0.15), 1, 0, TAU);
      ctx.fill();
    }
  }
  const s = size / 100;
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  // Shoulders / jacket.
  ctx.fillStyle = spec.jacket ?? '#2c3a40';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.08, y + size * 0.98);
  ctx.quadraticCurveTo(cx, y + size * 0.62, x + size * 0.92, y + size * 0.98);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = spec.shirt ?? '#f0e4c8';
  ctx.beginPath();
  ctx.moveTo(cx - 12 * s, y + size * 0.72);
  ctx.lineTo(cx + 12 * s, y + size * 0.72);
  ctx.lineTo(cx + 6 * s, y + size * 0.98);
  ctx.lineTo(cx - 6 * s, y + size * 0.98);
  ctx.closePath();
  ctx.fill();
  // Neck and head.
  ctx.fillStyle = spec.skinShadow ?? '#8d5a38';
  ctx.fillRect(cx - 7 * s, cy + 4 * s, 14 * s, 16 * s);
  ctx.fillStyle = spec.skin ?? '#b97c50';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 6 * s, 20 * s, 24 * s, 0, 0, TAU);
  ctx.fill();
  // Ears.
  ctx.beginPath();
  ctx.ellipse(cx - 20 * s, cy - 2 * s, 4 * s, 6 * s, 0, 0, TAU);
  ctx.ellipse(cx + 20 * s, cy - 2 * s, 4 * s, 6 * s, 0, 0, TAU);
  ctx.fill();
  // Hair.
  ctx.fillStyle = spec.hair ?? '#221d1b';
  if (spec.hairStyle === 'bald') {
    ctx.fillStyle = spec.skinShadow ?? '#8d5a38';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 14 * s, 19 * s, 14 * s, 0, Math.PI, TAU);
    ctx.fill();
  } else if (spec.hairStyle === 'mullet') {
    ctx.fillRect(cx - 22 * s, cy - 22 * s, 44 * s, 13 * s);
    ctx.fillRect(cx - 25 * s, cy - 12 * s, 7 * s, 30 * s);
    ctx.fillRect(cx + 18 * s, cy - 12 * s, 7 * s, 30 * s);
  } else if (spec.hairStyle === 'bob') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 15 * s, 23 * s, 17 * s, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(cx - 23 * s, cy - 15 * s, 8 * s, 28 * s);
    ctx.fillRect(cx + 15 * s, cy - 15 * s, 8 * s, 28 * s);
  } else if (spec.hairStyle === 'fedora') {
    ctx.fillRect(cx - 25 * s, cy - 22 * s, 50 * s, 6 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 15 * s, cy - 22 * s);
    ctx.lineTo(cx + 15 * s, cy - 22 * s);
    ctx.lineTo(cx + 11 * s, cy - 34 * s);
    ctx.lineTo(cx - 11 * s, cy - 34 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = spec.accent ?? '#c9a27a';
    ctx.fillRect(cx - 15 * s, cy - 21 * s, 30 * s, 3 * s);
  } else {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 17 * s, 21 * s, 12 * s, 0, Math.PI, TAU);
    ctx.fill();
  }
  // Eyes, brows, nose and mouth.
  const blink = (time * 0.42 + (spec.blink ?? 0)) % 4 > 3.92;
  if (spec.glasses === 'shades') {
    ctx.fillStyle = '#101619';
    ctx.fillRect(cx - 17 * s, cy - 8 * s, 14 * s, 7 * s);
    ctx.fillRect(cx + 3 * s, cy - 8 * s, 14 * s, 7 * s);
    ctx.fillRect(cx - 3 * s, cy - 6 * s, 6 * s, 2 * s);
  } else if (spec.glasses === 'aviators') {
    ctx.fillStyle = 'rgba(210, 160, 80, 0.75)';
    ctx.beginPath();
    ctx.ellipse(cx - 10 * s, cy - 5 * s, 9 * s, 6 * s, 0, 0, TAU);
    ctx.ellipse(cx + 10 * s, cy - 5 * s, 9 * s, 6 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#c9a25a';
    ctx.lineWidth = 1.4 * s;
    ctx.stroke();
  } else if (blink) {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 13 * s, cy - 5 * s);
    ctx.lineTo(cx - 5 * s, cy - 5 * s);
    ctx.moveTo(cx + 5 * s, cy - 5 * s);
    ctx.lineTo(cx + 13 * s, cy - 5 * s);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#161b1e';
    ctx.beginPath();
    ctx.arc(cx - 9 * s, cy - 5 * s, 2.3 * s, 0, TAU);
    ctx.arc(cx + 9 * s, cy - 5 * s, 2.3 * s, 0, TAU);
    ctx.fill();
  }
  if (spec.brows !== false) {
    ctx.strokeStyle = spec.hair ?? '#221d1b';
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 15 * s, cy - 12 * s);
    ctx.lineTo(cx - 5 * s, cy - 13 * s);
    ctx.moveTo(cx + 5 * s, cy - 13 * s);
    ctx.lineTo(cx + 15 * s, cy - 12 * s);
    ctx.stroke();
  }
  ctx.strokeStyle = spec.skinShadow ?? '#8d5a38';
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 3 * s);
  ctx.lineTo(cx - 2 * s, cy + 5 * s);
  ctx.lineTo(cx + 2 * s, cy + 5 * s);
  ctx.stroke();
  if (spec.moustache) {
    ctx.fillStyle = spec.hair ?? '#221d1b';
    ctx.fillRect(cx - 11 * s, cy + 9 * s, 22 * s, 3.5 * s);
  }
  ctx.strokeStyle = spec.lip ?? '#7a4a3c';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 8 * s, cy + 14 * s);
  ctx.quadraticCurveTo(cx, cy + 17 * s, cx + 8 * s, cy + 14 * s);
  ctx.stroke();
  if (spec.beard) {
    ctx.fillStyle = spec.hair ?? '#221d1b';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 16 * s, 17 * s, 12 * s, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (spec.earring) {
    ctx.fillStyle = '#ffc857';
    ctx.beginPath();
    ctx.arc(cx + 21 * s, cy + 5 * s, 2.4 * s, 0, TAU);
    ctx.fill();
  }
  if (spec.scar) {
    ctx.strokeStyle = '#7d4436';
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy - 14 * s);
    ctx.lineTo(cx - 8 * s, cy + 1 * s);
    ctx.stroke();
  }
  ctx.restore();
  // Frame and corner cut.
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRectPath(ctx, x, y, size, size, Math.round(size * 0.1));
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(x, y + size - 3, size, 3);
  ctx.restore();
}

export function roundRectPath(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawSilhouette(ctx, x, y, w, h, spec, accent) {
  ctx.save();
  ctx.fillStyle = accent ?? UI.gold;
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.38, w * 0.22, h * 0.22, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.16, y + h);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.56, x + w * 0.84, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  void spec;
  void FONTS;
  void clamp;
}
