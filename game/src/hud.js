// The HUD and every menu: minimap frame, health and armour, cash, weapon and ammo, the wanted
// stars, the mission banner, dialogue, notifications, the speedometer, the title screen, pause,
// wasted and busted, and mission results. All screen space, all drawn with the same paper-and-ink
// language as the city.

import { PALETTE, FONT, WEAPONS, WEAPON_ORDER, WANTED } from './config.js';
import { clamp } from './math.js';
import { roundRectPath } from './math.js';

const TONE = {
  ink: '#f4e8cc',
  coral: '#ee9a7c',
  teal: '#8fd2c4',
  gold: '#f0c96a',
};

function money(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function spaced(ctx, text, x, y, spacing) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  return cursor - spacing;
}

function starPath(ctx, cx, cy, r, inner = 0.46) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * inner;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function createHud(canvas) {
  const notifications = [];
  let cashFlash = 0;
  let lastMoney = null;
  let bannerIn = 0;
  let lastMission = null;
  let time = 0;

  function notify(text, tone = 'ink', life = 3.6) {
    notifications.unshift({ text, tone, life, maxLife: life });
    if (notifications.length > 6) notifications.pop();
  }

  function update(game, dt) {
    time += dt;
    for (let i = notifications.length - 1; i >= 0; i -= 1) {
      notifications[i].life -= dt;
      if (notifications[i].life <= 0) notifications.splice(i, 1);
    }
    if (game.player.money !== lastMoney) {
      if (lastMoney !== null) cashFlash = 1;
      lastMoney = game.player.money;
    }
    cashFlash = Math.max(0, cashFlash - dt * 1.4);
    if (game.missions?.active) {
      if (lastMission !== game.missions.active.id) {
        bannerIn = 1;
        lastMission = game.missions.active.id;
      }
    } else {
      lastMission = null;
    }
    bannerIn = Math.max(0, bannerIn - dt * 0.8);
  }

  function draw(ctx, game, opts = {}) {
    const w = canvas.width;
    const h = canvas.height;
    const s = clamp(h / 620, 0.7, 1.25);
    const p = game.player;
    const police = game.police;
    const shot = opts.shot === true;

    // ---- minimap (top left) -------------------------------------------------
    const radius = 74 * s;
    const mx = 18 * s + radius + 4;
    const my = 16 * s + radius + 4;
    const alpha = shot ? 1 : 0.97;
    if (game.minimap) game.minimap.draw(ctx, game, mx, my, radius, alpha);
    ctx.textAlign = 'left';
    ctx.font = `700 ${10.5 * s}px ${FONT.narrow}`;
    const district = game.minimap?.districtLabel(game.world, p.x, p.y) ?? 'PALMSHORE';
    ctx.fillStyle = 'rgba(28,24,20,0.62)';
    const labelW = ctx.measureText(district).width + 16 * s;
    roundRectPath(ctx, mx - labelW / 2, my + radius + 8 * s, labelW, 17 * s, 8 * s);
    ctx.fill();
    ctx.fillStyle = PALETTE.cream;
    ctx.textAlign = 'center';
    ctx.fillText(district, mx, my + radius + 20 * s);
    ctx.textAlign = 'left';
    const street = game.world.roads.streetAt(p.x, p.y);
    ctx.fillStyle = 'rgba(247,237,215,0.72)';
    ctx.font = `600 ${9.5 * s}px ${FONT.narrow}`;
    ctx.fillText(`${street.street} / ${street.cross}`, 22 * s, my + radius + 40 * s);

    // ---- status column (top right) -----------------------------------------
    // One right-aligned column: the wanted stars, then the cash, then health and
    // armour, then the weapon and its ammo. Every row is measured before anything
    // is drawn, so the panel and the bars widen with the text instead of guessing.
    const edge = Math.max(14, 14 * s);
    const padX = 12 * s;
    const padY = 10 * s;
    const rowGap = 7 * s;
    const tightGap = 4 * s;
    const wantedFont = `700 ${8.5 * s}px ${FONT.narrow}`;
    const statFont = `700 ${10 * s}px ${FONT.narrow}`;
    const cashFont = `700 ${27 * s}px ${FONT.display}`;
    const nameFont = `700 ${10.5 * s}px ${FONT.narrow}`;
    const ammoFont = `700 ${21 * s}px ${FONT.display}`;
    const starR = 8 * s;
    const starGap = 5 * s;
    const barH = Math.max(6 * s, 5);

    const measure = (px, font, text) => {
      ctx.font = font;
      const m = ctx.measureText(text);
      const asc = m.actualBoundingBoxAscent || px * 0.74;
      const desc = m.actualBoundingBoxDescent || px * 0.2;
      return { w: m.width, asc, desc, h: asc + desc };
    };

    const cash = money(p.money);
    const weapon = WEAPONS[p.weapon];
    const ammo = p.weapon === 'fists' ? '—' : String(p.weapons[p.weapon].ammo).padStart(2, '0');
    const wantedLabel = WANTED.starsLabel[police.level] ?? 'CLEAR';
    const healthLabel = `HEALTH ${Math.ceil(p.health)}`;
    const armourLabel = `ARMOUR ${Math.ceil(p.armour)}`;
    const cashM = measure(27 * s, cashFont, cash);
    const nameM = measure(10.5 * s, nameFont, weapon.name);
    const ammoM = measure(21 * s, ammoFont, ammo);
    const wantedM = measure(8.5 * s, wantedFont, wantedLabel);
    const healthM = measure(10 * s, statFont, healthLabel);
    const armourM = measure(10 * s, statFont, armourLabel);
    const starRowW = WANTED.max * starR * 2 + (WANTED.max - 1) * starGap;
    const weaponRowW = nameM.w + ammoM.w + 9 * s;
    const contentW = Math.max(starRowW, wantedM.w, cashM.w, weaponRowW, healthM.w, armourM.w, 148 * s);
    const panelX = w - edge - contentW - padX * 2;
    const right = w - edge - padX;
    const left = right - contentW;

    let cursor = edge + padY;
    const wantedBaseline = cursor + wantedM.asc;
    cursor += wantedM.h + 3 * s;
    const starY = cursor + starR;
    cursor += starR * 2 + rowGap;
    const cashBaseline = cursor + cashM.asc;
    cursor += cashM.h + rowGap;
    const healthBaseline = cursor + healthM.asc;
    const healthTop = cursor + healthM.h + 2 * s;
    cursor = healthTop + barH + tightGap;
    const armourBaseline = cursor + armourM.asc;
    const armourTop = cursor + armourM.h + 2 * s;
    cursor = armourTop + barH + rowGap;
    const weaponTop = cursor;
    const weaponBaseline = weaponTop + Math.max(ammoM.asc, nameM.asc);
    const panelH = weaponTop + Math.max(ammoM.h, nameM.h) + padY - edge;

    ctx.fillStyle = 'rgba(29,24,20,0.94)';
    roundRectPath(ctx, panelX, edge, contentW + padX * 2, panelH, 9 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,201,106,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Wanted stars, five to a row, the empty ones dimmed, with the state above them.
    ctx.textAlign = 'right';
    ctx.font = wantedFont;
    ctx.fillStyle = police.level > 0 ? TONE.coral : 'rgba(247,237,215,0.5)';
    ctx.fillText(wantedLabel, right, wantedBaseline);
    const starsX = right - starRowW;
    for (let i = 0; i < WANTED.max; i += 1) {
      const active = i < police.level;
      const cx = starsX + starR + i * (starR * 2 + starGap);
      const blink = active && police.level >= 4 ? 0.6 + 0.4 * Math.sin(time * 8 + i) : 1;
      starPath(ctx, cx, starY, starR);
      ctx.fillStyle = active ? `rgba(240,196,92,${blink})` : 'rgba(247,237,215,0.12)';
      ctx.fill();
      ctx.strokeStyle = active ? 'rgba(50,38,20,0.7)' : 'rgba(247,237,215,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cash on its own line.
    ctx.textAlign = 'right';
    ctx.font = cashFont;
    ctx.lineWidth = 3.5 * s;
    ctx.strokeStyle = 'rgba(28,23,19,0.7)';
    ctx.strokeText(cash, right, cashBaseline);
    ctx.fillStyle = cashFlash > 0 ? '#fff1c2' : PALETTE.cream;
    ctx.fillText(cash, right, cashBaseline);

    // Health and armour: the label sits directly above its bar, never over it.
    const stat = (label, labelBaseline, barTop, value, max, color) => {
      ctx.textAlign = 'left';
      ctx.font = statFont;
      ctx.fillStyle = 'rgba(247,237,215,0.86)';
      ctx.fillText(label, left, labelBaseline);
      ctx.fillStyle = 'rgba(20,18,15,0.62)';
      roundRectPath(ctx, left, barTop, contentW, barH, barH / 2);
      ctx.fill();
      const filled = clamp(value / max, 0, 1) * contentW;
      if (filled > 0) {
        ctx.fillStyle = color;
        roundRectPath(ctx, left, barTop, filled, barH, barH / 2);
        ctx.fill();
      }
    };
    stat(healthLabel, healthBaseline, healthTop, p.health, p.maxHealth, p.health > 45 ? '#7fb98a' : '#d56a55');
    stat(armourLabel, armourBaseline, armourTop, p.armour, 100, '#7fa8c4');

    // Weapon and ammo share the last line.
    ctx.textAlign = 'right';
    ctx.font = ammoFont;
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = 'rgba(28,23,19,0.7)';
    ctx.strokeText(ammo, right, weaponBaseline);
    ctx.fillStyle = PALETTE.cream;
    ctx.fillText(ammo, right, weaponBaseline);
    ctx.font = nameFont;
    ctx.fillStyle = TONE.coral;
    ctx.fillText(weapon.name, right - ammoM.w - 9 * s, weaponBaseline);

    // ---- speedometer (bottom right, fully inside the frame) -----------------
    if (p.mode === 'car' && p.car) {
      const speed = Math.hypot(p.car.vx, p.car.vy);
      const mph = Math.round(speed * 0.42);
      const r = 32 * s;
      const ring = 6 * s;
      const gx = w - edge - (r + ring / 2 + 4 * s);
      const gy = h - edge - (r + ring / 2 + 4 * s);
      ctx.beginPath();
      ctx.arc(gx, gy, r + ring / 2 + 4 * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(24,20,17,0.58)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx, gy, r, Math.PI * 0.78, Math.PI * 2.22);
      ctx.strokeStyle = 'rgba(28,23,19,0.55)';
      ctx.lineWidth = ring;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gx, gy, r, Math.PI * 0.78, Math.PI * (0.78 + 1.44 * clamp(speed / 340, 0, 1)));
      ctx.strokeStyle = p.car.health < 90 ? PALETTE.coral : PALETTE.tealLight;
      ctx.lineWidth = ring * 0.62;
      ctx.stroke();
      ctx.fillStyle = PALETTE.cream;
      ctx.textAlign = 'center';
      ctx.font = `700 ${20 * s}px ${FONT.display}`;
      ctx.fillText(String(mph), gx, gy + 4 * s);
      ctx.font = `600 ${8.5 * s}px ${FONT.narrow}`;
      ctx.fillStyle = 'rgba(247,237,215,0.66)';
      ctx.fillText('MPH', gx, gy + 18 * s);
      if (p.car.burning) {
        ctx.fillStyle = TONE.coral;
        ctx.font = `700 ${9 * s}px ${FONT.narrow}`;
        ctx.fillText('ENGINE FIRE', gx, gy - 20 * s);
      }
    }
    ctx.textAlign = 'left';

    // ---- contextual hint (bottom left) --------------------------------------
    let hint = '';
    if (p.mode === 'foot' && !p.dead) {
      let near = null;
      for (const car of game.vehicles) {
        if (car.removed || car.exploded || car.driver === 'ai' || car.driver === 'cop') continue;
        if (Math.hypot(car.x - p.x, car.y - p.y) < 76) {
          near = car;
          break;
        }
      }
      if (near) hint = 'E  STEAL VEHICLE';
      else if (game.pedestrians?.nearestRobTarget(p)) hint = 'R  ROB';
      else if (game.missions?.interactHint) hint = game.missions.interactHint;
    } else if (p.mode === 'car') {
      hint = 'E  EXIT   ·   SPACE  HANDBRAKE   ·   H  HORN';
    }
    if (hint && !shot) {
      ctx.font = `700 ${10 * s}px ${FONT.narrow}`;
      const hw = ctx.measureText(hint).width + 24 * s;
      ctx.fillStyle = 'rgba(28,24,20,0.58)';
      roundRectPath(ctx, 22 * s, h - 40 * s, hw, 24 * s, 12 * s);
      ctx.fill();
      ctx.fillStyle = PALETTE.cream;
      ctx.fillText(hint, 34 * s, h - 24 * s);
    }

    // ---- notifications (above minimap) --------------------------------------
    let ny = my + radius + 54 * s;
    for (const n of notifications) {
      const k = clamp(n.life / 0.5, 0, 1) * clamp((n.maxLife - n.life) / 0.2, 0, 1);
      ctx.globalAlpha = k;
      ctx.font = `700 ${10 * s}px ${FONT.narrow}`;
      const nw = ctx.measureText(n.text).width + 22 * s;
      ctx.fillStyle = 'rgba(28,24,20,0.66)';
      roundRectPath(ctx, 22 * s, ny, nw, 21 * s, 10 * s);
      ctx.fill();
      ctx.fillStyle = TONE[n.tone] ?? TONE.ink;
      ctx.fillText(n.text, 33 * s, ny + 14 * s);
      ny += 25 * s;
      ctx.globalAlpha = 1;
    }

    // ---- mission banner (top centre) ---------------------------------------
    const mission = game.missions?.active;
    if (mission) {
      const bw = 474 * s;
      const bx = (w - bw) / 2;
      const by = 12 * s;
      const slide = bannerIn > 0 ? -(1 - bannerIn) * 30 : 0;
      ctx.save();
      ctx.translate(0, slide);
      ctx.fillStyle = 'rgba(31,26,22,0.78)';
      roundRectPath(ctx, bx, by, bw, 58 * s, 6 * s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240,201,106,0.55)';
      ctx.lineWidth = 1 * s;
      roundRectPath(ctx, bx + 3 * s, by + 3 * s, bw - 6 * s, 52 * s, 4 * s);
      ctx.stroke();
      ctx.fillStyle = TONE.coral;
      ctx.font = `700 ${8.5 * s}px ${FONT.narrow}`;
      ctx.textAlign = 'left';
      ctx.fillText(`MISSION ${String(game.missions.indexOfActive() + 1).padStart(2, '0')}  ·  ${mission.contact?.toUpperCase() ?? 'ROOK'}`, bx + 16 * s, by + 18 * s);
      ctx.fillStyle = PALETTE.cream;
      ctx.font = `700 ${21 * s}px ${FONT.display}`;
      ctx.fillText(mission.title, bx + 16 * s, by + 39 * s);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(247,237,215,0.82)';
      ctx.font = `600 ${9.5 * s}px ${FONT.narrow}`;
      const objective = game.missions.objectiveText();
      const lines = wrap(ctx, objective, bw * 0.47);
      lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, bx + bw - 16 * s, by + 30 * s + i * 13 * s));
      ctx.restore();
    }

    // ---- free-roam courier panel ------------------------------------------
    const activity = game.missions?.activity;
    if (activity?.active && !mission) {
      const aw = 316 * s;
      const ax = (w - aw) / 2;
      const ay = 12 * s;
      ctx.fillStyle = 'rgba(24,32,30,0.82)';
      roundRectPath(ctx, ax, ay, aw, 42 * s, 6 * s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(108,192,176,0.6)';
      ctx.lineWidth = 1 * s;
      roundRectPath(ctx, ax + 3 * s, ay + 3 * s, aw - 6 * s, 36 * s, 4 * s);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.tealLight;
      ctx.font = `700 ${8.5 * s}px ${FONT.narrow}`;
      ctx.fillText('COURIER RUN', ax + 14 * s, ay + 16 * s);
      ctx.fillStyle = PALETTE.cream;
      ctx.font = `700 ${16 * s}px ${FONT.display}`;
      ctx.fillText(`${activity.deliveries} ${activity.deliveries === 1 ? 'DROP' : 'DROPS'} LEFT`, ax + 14 * s, ay + 32 * s);
      ctx.textAlign = 'right';
      ctx.fillStyle = activity.timeLeft < 20 ? TONE.coral : 'rgba(247,237,215,0.82)';
      ctx.font = `700 ${13 * s}px ${FONT.narrow}`;
      const secs = Math.max(0, Math.ceil(activity.timeLeft));
      ctx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, ax + aw - 14 * s, ay + 27 * s);
      ctx.textAlign = 'left';
    }

    // ---- dialogue (top centre, under the mission banner) --------------------
    const dialogue = game.missions?.currentDialogue;
    if (dialogue) {
      const dw = Math.min(600 * s, w - 400 * s);
      const dx = (w - dw) / 2;
      const dy = mission ? 12 * s + 58 * s + 14 * s : 14 * s;
      const age = dialogue.age ?? 0;
      const alphaD = clamp(age / 0.18, 0, 1);
      ctx.globalAlpha = alphaD;
      ctx.fillStyle = 'rgba(27,23,20,0.83)';
      roundRectPath(ctx, dx, dy, dw, 66 * s, 7 * s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240,201,106,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const name = dialogue.who ?? 'ROOK';
      ctx.font = `700 ${11 * s}px ${FONT.narrow}`;
      const nw = ctx.measureText(name).width + 20 * s;
      ctx.fillStyle = PALETTE.coral;
      roundRectPath(ctx, dx + 13 * s, dy - 8 * s, nw, 17 * s, 8 * s);
      ctx.fill();
      ctx.fillStyle = '#2a211b';
      ctx.textAlign = 'left';
      ctx.fillText(name, dx + 23 * s, dy + 4 * s);
      ctx.fillStyle = PALETTE.cream;
      ctx.font = `500 ${13 * s}px ${FONT.ui}`;
      const textLines = wrap(ctx, `“${dialogue.line}”`, dw - 32 * s);
      textLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, dx + 15 * s, dy + 27 * s + i * 17 * s));
      // A small prompt to move on.
      ctx.fillStyle = 'rgba(247,237,215,0.5)';
      ctx.font = `600 ${8 * s}px ${FONT.narrow}`;
      ctx.textAlign = 'right';
      ctx.fillText('▸', dx + dw - 14 * s, dy + 56 * s);
      ctx.globalAlpha = 1;
    }

    // ---- crosshair ----------------------------------------------------------
    if (!shot && game.screen === 'play') {
      const mxp = game.input.mouse.x;
      const myp = game.input.mouse.y;
      ctx.strokeStyle = 'rgba(247,232,196,0.85)';
      ctx.lineWidth = 1.4;
      const gap = p.mode === 'car' ? 9 : 6;
      const len = 5;
      ctx.beginPath();
      ctx.moveTo(mxp - gap - len, myp);
      ctx.lineTo(mxp - gap, myp);
      ctx.moveTo(mxp + gap, myp);
      ctx.lineTo(mxp + gap + len, myp);
      ctx.moveTo(mxp, myp - gap - len);
      ctx.lineTo(mxp, myp - gap);
      ctx.moveTo(mxp, myp + gap);
      ctx.lineTo(mxp, myp + gap + len);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,196,92,0.9)';
      ctx.beginPath();
      ctx.arc(mxp, myp, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // A little "record" note on the title screen only.
    if (opts.title) {
      ctx.fillStyle = 'rgba(247,237,215,0.4)';
      ctx.font = `600 ${9 * s}px ${FONT.narrow}`;
      ctx.textAlign = 'left';
      ctx.fillText('PALMSHORE · OFFLINE · EVERY PIXEL AND SOUND MADE IN THE BROWSER', 22 * s, h - 18 * s);
    }
  }

  // ---- title screen ---------------------------------------------------------
  function drawTitle(ctx, game) {
    const w = canvas.width;
    const h = canvas.height;
    const s = clamp(h / 720, 0.72, 1.35);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(24,18,14,0.42)');
    grad.addColorStop(0.45, 'rgba(24,18,14,0.18)');
    grad.addColorStop(1, 'rgba(20,15,12,0.82)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sun disc.
    const sunX = w * 0.17;
    const sunY = h * 0.34;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190 * s);
    glow.addColorStop(0, 'rgba(255,224,150,0.85)');
    glow.addColorStop(0.3, 'rgba(247,184,106,0.4)');
    glow.addColorStop(1, 'rgba(247,184,106,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.coral;
    ctx.font = `700 ${12 * s}px ${FONT.narrow}`;
    ctx.fillText('A SUN-BLEACHED CRIME SAGA', 74 * s, h * 0.27);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `700 ${82 * s}px ${FONT.display}`;
    ctx.shadowColor = 'rgba(30,20,12,0.6)';
    ctx.shadowBlur = 22 * s;
    spaced(ctx, 'PALMSHORE', 68 * s, h * 0.48, 4 * s);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(221,107,82,0.9)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(74 * s, h * 0.53);
    ctx.lineTo(w * 0.46, h * 0.53);
    ctx.stroke();
    ctx.fillStyle = 'rgba(247,237,215,0.86)';
    ctx.font = `italic 500 ${17 * s}px ${FONT.display}`;
    ctx.fillText('Three days. One city. Everybody wants a piece of the sun.', 74 * s, h * 0.58);

    const items = game.menu?.items ?? [];
    const startY = h * 0.66;
    items.forEach((item, i) => {
      const selected = i === game.menu.index;
      const y = startY + i * 30 * s;
      if (selected) {
        ctx.fillStyle = 'rgba(221,107,82,0.92)';
        roundRectPath(ctx, 70 * s, y - 16 * s, Math.min(330 * s, ctx.measureText(item.label).width + 40 * s), 26 * s, 4 * s);
        ctx.fill();
      }
      ctx.fillStyle = selected ? '#241a13' : PALETTE.cream;
      ctx.font = `700 ${14 * s}px ${FONT.narrow}`;
      ctx.fillText(`${selected ? '▸ ' : '  '}${item.label}`, 84 * s, y + 2 * s);
      if (item.note) {
        ctx.fillStyle = selected ? 'rgba(30,20,14,0.7)' : 'rgba(247,237,215,0.45)';
        ctx.font = `500 ${9 * s}px ${FONT.narrow}`;
        ctx.fillText(item.note, 84 * s, y + 14 * s);
      }
    });

    // Controls card, bottom right.
    const cw = 330 * s;
    const cx = w - cw - 46 * s;
    const cy = h - 214 * s;
    ctx.fillStyle = 'rgba(24,19,15,0.66)';
    roundRectPath(ctx, cx, cy, cw, 168 * s, 8 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,201,106,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = TONE.gold;
    ctx.font = `700 ${10 * s}px ${FONT.narrow}`;
    ctx.fillText('HOW TO RUN THE CITY', cx + 16 * s, cy + 22 * s);
    const controls = [
      ['WASD', 'walk · drive'],
      ['SHIFT', 'run'],
      ['MOUSE', 'aim · fire'],
      ['E', 'steal · exit car'],
      ['R', 'rob a mark'],
      ['1–4', 'weapons'],
      ['SPACE', 'handbrake / drift'],
      ['ESC', 'pause · save'],
    ];
    controls.forEach((row, i) => {
      ctx.fillStyle = PALETTE.cream;
      ctx.font = `700 ${9.5 * s}px ${FONT.narrow}`;
      ctx.fillText(row[0], cx + 16 * s, cy + 43 * s + i * 15.5 * s);
      ctx.fillStyle = 'rgba(247,237,215,0.62)';
      ctx.font = `500 ${9.5 * s}px ${FONT.narrow}`;
      ctx.fillText(row[1], cx + 88 * s, cy + 43 * s + i * 15.5 * s);
    });
    ctx.fillStyle = 'rgba(247,237,215,0.35)';
    ctx.font = `600 ${8.5 * s}px ${FONT.narrow}`;
    ctx.fillText('↑ ↓  CHOOSE   ·   ENTER  SELECT', 74 * s, h - 34 * s);
  }

  function drawPause(ctx, game) {
    const w = canvas.width;
    const h = canvas.height;
    const s = clamp(h / 720, 0.72, 1.35);
    ctx.fillStyle = 'rgba(18,14,11,0.66)';
    ctx.fillRect(0, 0, w, h);
    const pw = 360 * s;
    const ph = 306 * s;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    ctx.fillStyle = 'rgba(31,25,20,0.95)';
    roundRectPath(ctx, px, py, pw, ph, 8 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,201,106,0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.coral;
    ctx.font = `700 ${10 * s}px ${FONT.narrow}`;
    ctx.fillText('PALMSHORE', w / 2, py + 30 * s);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `700 ${30 * s}px ${FONT.display}`;
    ctx.fillText('PAUSED', w / 2, py + 62 * s);
    const items = game.menu.items;
    items.forEach((item, i) => {
      const y = py + 102 * s + i * 32 * s;
      const selected = i === game.menu.index;
      if (selected) {
        ctx.fillStyle = 'rgba(221,107,82,0.9)';
        roundRectPath(ctx, px + 40 * s, y - 18 * s, pw - 80 * s, 26 * s, 4 * s);
        ctx.fill();
      }
      ctx.fillStyle = selected ? '#241a13' : PALETTE.cream;
      ctx.font = `700 ${13 * s}px ${FONT.narrow}`;
      ctx.fillText(item.label, w / 2, y);
    });
    ctx.fillStyle = 'rgba(247,237,215,0.4)';
    ctx.font = `500 ${9 * s}px ${FONT.narrow}`;
    ctx.fillText(`${money(game.player.money)}  ·  ${game.missions.completedCount()} / 5 MISSIONS`, w / 2, py + ph - 20 * s);
    ctx.textAlign = 'left';
  }

  function drawEnd(ctx, game, kind, cost) {
    const w = canvas.width;
    const h = canvas.height;
    const s = clamp(h / 720, 0.72, 1.35);
    const t = clamp(game.endTimer / 0.7, 0, 1);
    ctx.fillStyle = `rgba(20,13,10,${0.68 * t})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = t;
    ctx.textAlign = 'center';
    ctx.fillStyle = kind === 'busted' ? PALETTE.tealLight : PALETTE.coral;
    ctx.font = `700 ${68 * s}px ${FONT.display}`;
    spaced(ctx, kind === 'busted' ? 'BUSTED' : 'WASTED', w / 2 - 130 * s, h * 0.46, 6 * s);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `italic 500 ${17 * s}px ${FONT.display}`;
    ctx.fillText(kind === 'busted' ? 'The Palm Shore P.D. finally caught up.' : 'The sun sets on another bad idea.', w / 2, h * 0.54);
    ctx.fillStyle = 'rgba(247,237,215,0.7)';
    ctx.font = `600 ${11 * s}px ${FONT.narrow}`;
    ctx.fillText(`${kind === 'busted' ? 'BAIL' : 'MEDICAL BILL'}  ${money(cost)}   ·   PRESS ENTER`, w / 2, h * 0.64);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawMissionResult(ctx, game, result) {
    const w = canvas.width;
    const h = canvas.height;
    const s = clamp(h / 720, 0.72, 1.35);
    const t = clamp(result.timer * 1.5, 0, 1);
    ctx.fillStyle = `rgba(20,15,11,${0.55 * t})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = t;
    const pw = 430 * s;
    const px = (w - pw) / 2;
    const py = h * 0.26;
    ctx.fillStyle = 'rgba(31,25,20,0.94)';
    roundRectPath(ctx, px, py, pw, 190 * s, 8 * s);
    ctx.fill();
    ctx.strokeStyle = result.passed ? 'rgba(240,201,106,0.7)' : 'rgba(221,107,82,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = result.passed ? TONE.gold : PALETTE.coral;
    ctx.font = `700 ${11 * s}px ${FONT.narrow}`;
    ctx.fillText(result.passed ? 'MISSION PASSED' : 'MISSION FAILED', w / 2, py + 30 * s);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `700 ${25 * s}px ${FONT.display}`;
    ctx.fillText(result.title, w / 2, py + 62 * s);
    if (result.passed) {
      ctx.fillStyle = TONE.gold;
      ctx.font = `700 ${29 * s}px ${FONT.display}`;
      ctx.fillText(`+ ${money(result.reward)}`, w / 2, py + 102 * s);
      if (result.unlock) {
        ctx.fillStyle = 'rgba(247,237,215,0.8)';
        ctx.font = `600 ${10 * s}px ${FONT.narrow}`;
        ctx.fillText(`UNLOCKED  ·  ${result.unlock}`, w / 2, py + 124 * s);
      }
    } else {
      ctx.fillStyle = 'rgba(247,237,215,0.75)';
      ctx.font = `500 ${11 * s}px ${FONT.ui}`;
      ctx.fillText(result.reason ?? 'The job went south.', w / 2, py + 100 * s);
    }
    ctx.fillStyle = 'rgba(247,237,215,0.5)';
    ctx.font = `600 ${9 * s}px ${FONT.narrow}`;
    ctx.fillText(result.passed ? 'PRESS ENTER TO KEEP MOVING' : 'PRESS ENTER TO TRY AGAIN', w / 2, py + 168 * s);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawIntro(ctx, game) {
    const w = canvas.width;
    const h = canvas.height;
    const s = clamp(h / 720, 0.72, 1.35);
    ctx.fillStyle = 'rgba(20,15,11,0.5)';
    ctx.fillRect(0, 0, w, h);
    const pw = 560 * s;
    const px = (w - pw) / 2;
    const py = h * 0.22;
    ctx.fillStyle = 'rgba(31,25,20,0.95)';
    roundRectPath(ctx, px, py, pw, 220 * s, 8 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,201,106,0.5)';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.coral;
    ctx.font = `700 ${10 * s}px ${FONT.narrow}`;
    ctx.fillText('PALMSHORE  ·  FRIDAY, 4:12 PM', w / 2, py + 34 * s);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `700 ${27 * s}px ${FONT.display}`;
    ctx.fillText('THE SUN ALWAYS SETS', w / 2, py + 72 * s);
    ctx.fillStyle = 'rgba(247,237,215,0.76)';
    ctx.font = `400 ${12 * s}px ${FONT.ui}`;
    const lines = [
      'Ray Calderón came home for his brother’s funeral and found the',
      'deed to the Sunray Hotel missing. Rook has it. Everybody in this',
      'town owes somebody, and the tide is coming in.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, w / 2, py + 104 * s + i * 17 * s));
    ctx.fillStyle = TONE.gold;
    ctx.font = `600 ${9 * s}px ${FONT.narrow}`;
    ctx.fillText('WALK INTO THE CORAL MARKER ON THE MINIMAP TO START A JOB', w / 2, py + 176 * s);
    ctx.fillStyle = 'rgba(247,237,215,0.45)';
    ctx.font = `500 ${8.5 * s}px ${FONT.narrow}`;
    ctx.fillText('ENTER  BEGIN', w / 2, py + 200 * s);
    ctx.textAlign = 'left';
  }

  function drawEnding(ctx, game) {
    const w = canvas.width;
    const h = canvas.height;
    const s = clamp(h / 720, 0.72, 1.35);
    ctx.fillStyle = 'rgba(18,13,10,0.78)';
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.32, 10, w * 0.5, h * 0.32, w * 0.4);
    glow.addColorStop(0, 'rgba(255,196,120,0.22)');
    glow.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.coral;
    ctx.font = `700 ${11 * s}px ${FONT.narrow}`;
    ctx.fillText('THE SUN SETS ON PALMSHORE', w / 2, h * 0.24);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `700 ${48 * s}px ${FONT.display}`;
    spaced(ctx, 'THE SUNRAY IS YOURS', w / 2 - 300 * s, h * 0.36, 3 * s);
    ctx.fillStyle = 'rgba(247,237,215,0.82)';
    ctx.font = `italic 500 ${15 * s}px ${FONT.display}`;
    ctx.fillText('Vargas is in the water. Lila is on the boat. The deed is in Ray’s pocket.', w / 2, h * 0.44);
    const stats = [
      ['JOBS COMPLETED', `${game.missions.completedCount()} / 5`],
      ['EARNED', money(game.stats.earned ?? 0)],
      ['BODIES', String(game.stats.kills ?? 0)],
      ['CASH ON HAND', money(game.player.money)],
    ];
    stats.forEach((row, i) => {
      const x = w / 2 - 220 * s + i * 150 * s;
      ctx.fillStyle = 'rgba(247,237,215,0.5)';
      ctx.font = `600 ${8.5 * s}px ${FONT.narrow}`;
      ctx.fillText(row[0], x, h * 0.56);
      ctx.fillStyle = TONE.gold;
      ctx.font = `700 ${20 * s}px ${FONT.display}`;
      ctx.fillText(row[1], x, h * 0.56 + 22 * s);
    });
    ctx.fillStyle = 'rgba(247,237,215,0.7)';
    ctx.font = `600 ${11 * s}px ${FONT.narrow}`;
    ctx.fillText('PRESS ENTER TO KEEP ROAMING PALMSHORE', w / 2, h * 0.76);
    ctx.textAlign = 'left';
  }

  return { draw, drawTitle, drawPause, drawEnd, drawMissionResult, drawIntro, drawEnding, notify, update, notifications };
}
