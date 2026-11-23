// The HUD and every menu: wanted stars, money, weapon and ammo, health and armour, the mission
// banner and dialogue box, notifications, the speedometer and crosshair, plus the title screen,
// pause menu, wasted/busted screens and the end card. Draws over render.js's frame.

import { FONT, PALETTE, WEAPONS, PLAYER } from './config.js';
import { clamp } from './math.js';
import { drawMinimap } from './minimap.js';
import { worldToScreen } from './camera.js';

const GOLD = PALETTE.gold;
const CREAM = PALETTE.cream;

export function drawHud(ctx, game, width, height) {
  if (game.mode === 'title') {
    drawTitle(ctx, game, width, height);
    return;
  }
  drawStatus(ctx, game, width, height);
  if (game.mode === 'dead') drawWasted(ctx, game, width, height);
  else if (game.mode === 'busted') drawBusted(ctx, game, width, height);
  else if (game.mode === 'paused') drawPause(ctx, game, width, height);
  else if (game.mode === 'endcard') drawEndCard(ctx, game, width, height);
  else if (game.mode === 'shot') drawShotHud(ctx, game, width, height);
}

function drawStatus(ctx, game, width, height) {
  drawMissionBanner(ctx, game);
  drawWanted(ctx, game, width);
  drawMoneyAndWeapon(ctx, game, width);
  drawMinimap(ctx, game, 100, height - 116, 78);
  drawObjectiveArrow(ctx, game, width, height);
  drawNotifications(ctx, game, width);
  drawBossBar(ctx, game, width);
  if (!game.dialogue) {
    drawHealthBars(ctx, game, height);
    if (game.player.inCar) drawSpeedometer(ctx, game, width, height);
    drawPrompt(ctx, game, width, height);
    if (game.activity.active) drawActivity(ctx, game, height);
    drawDistrict(ctx, game, height);
    if (game.mode === 'play' && game.time < 26) drawControlsHint(ctx, game, width, height);
    if (!game.player.inCar && game.player.weapon !== 'fists' && game.mode === 'play') drawCrosshair(ctx, game);
  }
  drawDialogue(ctx, game, width, height);
  if (game.missionPassed) drawMissionPassed(ctx, game, width, height);
}

function drawMissionBanner(ctx, game) {
  const objective = game.objective;
  const x = 24;
  const y = 18;
  if (!objective) {
    ctx.save();
    ctx.fillStyle = 'rgba(28,23,18,0.55)';
    roundPanel(ctx, x, y, 260, 46, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(242,193,78,0.9)';
    ctx.fillRect(x, y + 8, 3, 30);
    ctx.fillStyle = CREAM;
    ctx.font = `800 13px ${FONT.display}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('PALMSHORE', x + 14, y + 17);
    ctx.fillStyle = game.wanted.level > 0 ? 'rgba(240,160,120,0.9)' : 'rgba(230,218,193,0.72)';
    ctx.font = `500 12px ${FONT.ui}`;
    const sub = game.wanted.level > 0
      ? `Wanted level ${game.wanted.level}${game.heli ? '  ·  air unit overhead' : '  ·  break line of sight'}`
      : game.activity.active
        ? 'Courier run  ·  follow the gold blip'
        : game.storyDone
          ? 'The city is yours  ·  free roam'
          : 'Free roam  ·  find the gold marker';
    ctx.fillText(sub, x + 14, y + 33);
    ctx.restore();
    return;
  }
  ctx.save();
  const w = Math.min(430, 250 + objective.label.length * 5.6);
  ctx.fillStyle = 'rgba(26,21,16,0.8)';
  roundPanel(ctx, x, y, w, 76, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,193,78,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.fillRect(x, y + 8, 3.5, 60);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(242,193,78,0.92)';
  ctx.font = `800 10px ${FONT.ui}`;
  ctx.fillText(`MISSION ${objective.number}   ·   ${objective.title.toUpperCase()}`, x + 15, y + 15);
  ctx.fillStyle = CREAM;
  ctx.font = `700 16px ${FONT.ui}`;
  wrapped(ctx, objective.label, x + 15, y + 36, w - 110, 19, 1);
  ctx.fillStyle = 'rgba(230,218,193,0.72)';
  ctx.font = `500 11px ${FONT.ui}`;
  const distance = objective.distance != null ? `${Math.round(objective.distance / 10)} m` : '';
  const extra = objective.extra ? `  ·  ${objective.extra}` : '';
  ctx.fillText(`${distance}${extra}`, x + 15, y + 62);
  if (objective.hint) {
    ctx.save();
    ctx.fillStyle = 'rgba(28,23,18,0.55)';
    roundPanel(ctx, x, y + 84, Math.min(w, objective.hint.length * 6 + 28), 26, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(236,224,198,0.8)';
    ctx.font = `500 11px ${FONT.ui}`;
    ctx.fillText(objective.hint, x + 12, y + 97);
    ctx.restore();
  }
  ctx.restore();
}

function drawWanted(ctx, game, width) {
  const level = game.wanted.level;
  const stars = 5;
  const size = 17;
  const gap = 5;
  const total = stars * (size * 2 + gap);
  const startX = width - 26 - total;
  const y = 22;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(28,23,18,0.62)';
  roundPanel(ctx, startX - 13, y - 8, total + 26, 36, 9);
  ctx.fill();
  const flashing = game.wanted.fade > 0 && game.wanted.heat > 0;
  for (let i = 0; i < stars; i += 1) {
    const filled = i < level;
    const px = startX + i * (size * 2 + gap) + size;
    const pulse = flashing ? 0.55 + 0.45 * Math.sin(game.time * 9 + i * 0.8) : 1;
    ctx.globalAlpha = filled ? pulse : 0.32;
    star(ctx, px, y + 10, size, i < level ? GOLD : 'rgba(246,234,210,0.3)', i < level);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}


/** A gold chevron at the screen edge pointing at an off-screen objective or courier drop. */
function drawObjectiveArrow(ctx, game, width, height) {
  if (game.mode === 'shot') return;
  const target = game.objective ?? game.activityObjective;
  if (!target || target.x == null) return;
  const point = worldToScreen(game.camera, target.x, target.y, width, height);
  const marginX = 92;
  const marginTop = 96;
  const marginBottom = 132;
  if (point.x > marginX && point.x < width - marginX && point.y > marginTop && point.y < height - marginBottom) return;
  const cx = width / 2;
  const cy = height / 2;
  const angle = Math.atan2(point.y - cy, point.x - cx);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // Intersect the ray with the inset rectangle.
  const left = marginX;
  const right = width - marginX;
  const top = marginTop;
  const bottom = height - marginBottom;
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (right - cx) / dx);
  if (dx < 0) t = Math.min(t, (left - cx) / dx);
  if (dy > 0) t = Math.min(t, (bottom - cy) / dy);
  if (dy < 0) t = Math.min(t, (top - cy) / dy);
  const x = cx + dx * t;
  const y = cy + dy * t;
  const distance = target.distance ?? Math.hypot(target.x - game.player.x, target.y - game.player.y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(26,21,16,0.62)';
  ctx.beginPath();
  ctx.arc(0, 0, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = target === game.objective ? '#ffd76a' : '#f2a23e';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-4, -9);
  ctx.lineTo(-1, 0);
  ctx.lineTo(-4, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(250,238,214,0.82)';
  ctx.font = `700 10px ${FONT.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = distance > 950 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance / 10)} m`;
  ctx.fillText(label, x, y + 32);
  ctx.restore();
}

function drawMoneyAndWeapon(ctx, game, width) {
  const player = game.player;
  const x = width - 26;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(28,23,18,0.62)';
  roundPanel(ctx, x - 216, 64, 216, 62, 9);
  ctx.fill();
  ctx.fillStyle = '#9fd18a';
  ctx.font = `800 24px ${FONT.display}`;
  ctx.fillText(`$${money(player.cash)}`, x - 12, 82);
  ctx.fillStyle = 'rgba(230,218,193,0.7)';
  ctx.font = `600 11px ${FONT.ui}`;
  const weapon = WEAPONS[player.weapon];
  const ammo = player.weapon === 'fists' ? '—' : `${player.ammo[player.weapon] ?? 0}`;
  ctx.fillText(`${weapon.name.toUpperCase()}   ${ammo}`, x - 12, 105);
  if (player.armour > 0) {
    ctx.fillStyle = 'rgba(126,176,207,0.85)';
    ctx.fillText(`ARMOUR ${Math.round(player.armour)}`, x - 120, 105);
  }
  ctx.restore();
}

function drawHealthBars(ctx, game, height) {
  const player = game.player;
  const x = 194;
  const y = height - 66;
  ctx.save();
  ctx.fillStyle = 'rgba(28,23,18,0.62)';
  roundPanel(ctx, x - 8, y - 14, 236, 54, 9);
  ctx.fill();
  bar(ctx, x, y, 220, 13, player.health / PLAYER.maxHealth, PALETTE.health, '#3c5b35');
  if (player.armour > 0) bar(ctx, x, y + 19, 220, 8, player.armour / PLAYER.maxArmour, PALETTE.armour, '#2c4a5c');
  ctx.fillStyle = 'rgba(236,224,198,0.65)';
  ctx.font = `700 9px ${FONT.ui}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HEALTH', x, y - 6);
  if (player.armour > 0) ctx.fillText('ARMOUR', x, y + 34);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(player.health)}`, x + 220, y - 6);
  ctx.restore();
}

function bar(ctx, x, y, w, h, ratio, color, back) {
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = back;
  ctx.fill();
  if (ratio > 0.01) {
    roundRectPath(ctx, x, y, Math.max(h, w * clamp(ratio, 0, 1)), h, h / 2);
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, lighten(color));
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,16,12,0.5)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.stroke();
}

function drawSpeedometer(ctx, game, width, height) {
  const car = game.player.inCar;
  ctx.save();
  const cx = width - 94;
  const cy = height - 62;
  ctx.fillStyle = 'rgba(28,23,18,0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fill();
  const speed = car ? Math.hypot(car.vx, car.vy) : 0;
  const mph = Math.round(speed * 0.62);
  const start = Math.PI * 0.78;
  const end = Math.PI * 0.22 + Math.PI * 2;
  ctx.strokeStyle = 'rgba(236,224,198,0.22)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 39, start, end);
  ctx.stroke();
  const ratio = clamp(mph / 240, 0, 1);
  ctx.strokeStyle = ratio > 0.85 ? PALETTE.coral : GOLD;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 39, start, start + (end - start) * ratio);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CREAM;
  ctx.font = `800 25px ${FONT.display}`;
  ctx.fillText(String(mph), cx, cy + 1);
  ctx.fillStyle = 'rgba(236,224,198,0.7)';
  ctx.font = `700 9px ${FONT.ui}`;
  ctx.fillText('MPH', cx, cy + 22);
  ctx.restore();
}

function drawNotifications(ctx, game, width) {
  const list = game.notifications.slice(-4);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = 118;
  for (const note of list) {
    const alpha = clamp(note.life / Math.min(1, note.max), 0, 1);
    ctx.globalAlpha = alpha;
    const color = note.kind === 'danger' ? 'rgba(150,50,42,0.85)' : note.kind === 'mission' ? 'rgba(122,92,34,0.9)' : 'rgba(30,25,20,0.78)';
    ctx.font = `700 13px ${FONT.ui}`;
    const textWidth = ctx.measureText(note.text).width;
    ctx.fillStyle = color;
    roundPanel(ctx, width / 2 - textWidth / 2 - 16, y - 12, textWidth + 32, 26, 13);
    ctx.fill();
    ctx.fillStyle = note.kind === 'danger' ? '#ffe1d2' : note.kind === 'mission' ? '#ffe6a8' : CREAM;
    ctx.fillText(note.text, width / 2, y + 1);
    y += 32;
  }
  ctx.restore();
}

function drawPrompt(ctx, game, width, height) {
  if (game.mode !== 'play') return;
  const prompt = game.prompt ?? game.markerPrompt;
  if (!prompt) return;
  ctx.save();
  ctx.font = `600 13px ${FONT.ui}`;
  const keyWidth = 26;
  const textWidth = ctx.measureText(prompt.text).width;
  const total = keyWidth + 10 + textWidth;
  const x = width / 2 - total / 2;
  const y = height - 100;
  ctx.fillStyle = 'rgba(26,21,16,0.78)';
  roundPanel(ctx, x - 12, y - 15, total + 24, 32, 8);
  ctx.fill();
  ctx.fillStyle = GOLD;
  roundPanel(ctx, x, y - 10, keyWidth, 22, 5);
  ctx.fill();
  ctx.fillStyle = '#241d16';
  ctx.font = `800 12px ${FONT.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(prompt.key, x + keyWidth / 2, y + 1.5);
  ctx.fillStyle = CREAM;
  ctx.font = `600 13px ${FONT.ui}`;
  ctx.textAlign = 'left';
  ctx.fillText(prompt.text, x + keyWidth + 10, y + 1);
  ctx.restore();
}

function drawBossBar(ctx, game, width) {
  if (!game.boss) return;
  const w = 320;
  const x = width / 2 - w / 2;
  const y = 26;
  ctx.save();
  ctx.fillStyle = 'rgba(26,21,16,0.75)';
  roundPanel(ctx, x - 12, y - 10, w + 24, 40, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(236,224,198,0.8)';
  ctx.font = `800 11px ${FONT.ui}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(game.boss.name ?? 'BRASSLINE', x, y);
  ctx.fillStyle = 'rgba(60,30,26,0.9)';
  ctx.fillRect(x, y + 12, w, 7);
  ctx.fillStyle = PALETTE.coral;
  ctx.fillRect(x, y + 12, w * clamp(game.boss.health / game.boss.max, 0, 1), 7);
  ctx.restore();
}

function drawActivity(ctx, game, height) {
  const objective = game.activityObjective;
  if (!objective) return;
  ctx.save();
  ctx.fillStyle = 'rgba(26,21,16,0.7)';
  roundPanel(ctx, 194, height - 152, 236, 46, 8);
  ctx.fill();
  ctx.fillStyle = '#f2a23e';
  ctx.fillRect(194, height - 146, 3, 34);
  ctx.fillStyle = CREAM;
  ctx.font = `700 12px ${FONT.ui}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(objective.label, 208, height - 134);
  ctx.fillStyle = 'rgba(236,224,198,0.66)';
  ctx.font = `600 11px ${FONT.ui}`;
  const seconds = Math.max(0, Math.ceil(objective.timer));
  ctx.fillText(`${Math.round(objective.distance / 10)} m   ·   ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, 208, height - 118);
  ctx.restore();
}

function drawDistrict(ctx, game, height) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(246,234,210,0.72)';
  ctx.font = `800 10px ${FONT.ui}`;
  ctx.fillText(game.districtLabel.toUpperCase(), 100, height - 8);
  ctx.restore();
}

function drawDialogue(ctx, game, width, height) {
  const dialogue = game.dialogue;
  if (!dialogue) return;
  const current = dialogue.lines[dialogue.index];
  const w = Math.min(760, width - 120);
  const h = 120;
  const x = width / 2 - w / 2;
  const y = height - h - 26;
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,12,0.92)';
  roundPanel(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,193,78,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Portrait medallion.
  const cx = x + 48;
  const cy = y + 50;
  ctx.fillStyle = current.speaker.color;
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(28,22,16,0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = current.speaker.color;
  ctx.font = `800 24px ${FONT.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = current.speaker.name.split(' ').map((part) => part[0]).slice(0, 2).join('');
  ctx.fillText(initials, cx, cy + 1);
  // Name and text.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = current.speaker.color;
  ctx.font = `800 13px ${FONT.display}`;
  ctx.fillText(current.speaker.name, x + 94, y + 30);
  ctx.fillStyle = CREAM;
  ctx.font = `500 15px ${FONT.ui}`;
  const shown = current.text.slice(0, Math.floor(dialogue.reveal));
  wrapped(ctx, shown, x + 94, y + 54, w - 124, 22, 3);
  ctx.fillStyle = 'rgba(236,224,198,0.5)';
  ctx.font = `700 9px ${FONT.ui}`;
  ctx.textAlign = 'right';
  ctx.fillText('SPACE / E  ▸', x + w - 18, y + h - 12);
  ctx.textAlign = 'left';
  ctx.fillText(`${dialogue.index + 1} / ${dialogue.lines.length}`, x + 18, y + h - 12);
  ctx.restore();
}

function drawMissionPassed(ctx, game, width, height) {
  const info = game.missionPassed;
  const alpha = clamp(info.timer / 1.2, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  const w = 430;
  const x = width / 2 - w / 2;
  const y = height * 0.3;
  ctx.fillStyle = 'rgba(18,14,10,0.82)';
  roundPanel(ctx, x, y, w, 104, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,193,78,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = `800 30px ${FONT.display}`;
  ctx.fillText('MISSION PASSED', width / 2, y + 34);
  ctx.fillStyle = CREAM;
  ctx.font = `600 14px ${FONT.ui}`;
  ctx.fillText(info.title.toUpperCase(), width / 2, y + 61);
  ctx.fillStyle = '#9fd18a';
  ctx.font = `800 18px ${FONT.display}`;
  ctx.fillText(`+ $${money(info.reward)}`, width / 2, y + 85);
  ctx.restore();
}

function drawControlsHint(ctx, game, width, height) {
  const lines = game.player.inCar
    ? ['W / S  throttle & brake', 'A / D  steer', 'SPACE  handbrake', 'E  get out   ·   LMB  drive-by', 'H  horn']
    : ['WASD  walk   ·   SHIFT  run', 'LMB  shoot   ·   SPACE  punch', 'E  steal a car / interact', '1 2 3  weapons', 'ESC  pause'];
  ctx.save();
  ctx.globalAlpha = clamp((26 - game.time) / 4, 0, 1) * 0.85;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(24,19,15,0.5)';
  roundPanel(ctx, width - 262, height - 174, 238, lines.length * 19 + 20, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(236,224,198,0.85)';
  ctx.font = `500 11px ${FONT.ui}`;
  lines.forEach((line, i) => ctx.fillText(line, width - 38, height - 160 + i * 19));
  ctx.restore();
}

function drawCrosshair(ctx, game) {
  const mouse = game.input.mouse;
  if (!mouse) return;
  const overTarget = game.aimTarget ?? false;
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = overTarget ? '#e2604a' : 'rgba(246,234,210,0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(-8, 0);
  ctx.moveTo(8, 0);
  ctx.lineTo(12, 0);
  ctx.moveTo(0, -12);
  ctx.lineTo(0, -8);
  ctx.moveTo(0, 8);
  ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.fillStyle = overTarget ? '#e2604a' : 'rgba(246,234,210,0.9)';
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
  ctx.restore();
}

function drawTitle(ctx, game, width, height) {
  // Dim the live city behind the title.
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(20,16,12,0.58)');
  gradient.addColorStop(0.55, 'rgba(20,16,12,0.28)');
  gradient.addColorStop(1, 'rgba(20,16,12,0.78)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  // Sun to the north-west, matching the shadows thrown across the city.
  const sunX = width * 0.16;
  const sunY = -70;
  const sun = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 300);
  sun.addColorStop(0, 'rgba(255,238,184,0.5)');
  sun.addColorStop(0.35, 'rgba(255,202,120,0.18)');
  sun.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - 320, sunY - 60, 640, 620);
  // Palm silhouettes at the corners.
  silhouettePalm(ctx, 60, height + 20, 150, -0.12);
  silhouettePalm(ctx, width - 56, height + 24, 176, 0.1);
  silhouettePalm(ctx, width * 0.86, height + 30, 120, 0.2);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(242,193,78,0.9)';
  ctx.font = `800 13px ${FONT.ui}`;
  ctx.fillText('A  SUN-BLEACHED  CRIME  STORY', 68, height * 0.34);
  ctx.fillStyle = 'rgba(28,22,16,0.55)';
  ctx.font = `800 ${Math.min(112, width * 0.085)}px ${FONT.display}`;
  ctx.fillText('PALMSHORE', 62, height * 0.52);
  const titleGradient = ctx.createLinearGradient(0, height * 0.4, 0, height * 0.55);
  titleGradient.addColorStop(0, '#fff4d6');
  titleGradient.addColorStop(0.55, '#f4dca8');
  titleGradient.addColorStop(1, '#e0a95c');
  ctx.fillStyle = titleGradient;
  ctx.fillText('PALMSHORE', 68, height * 0.515);
  ctx.strokeStyle = 'rgba(60,38,22,0.45)';
  ctx.lineWidth = 1.4;
  ctx.strokeText('PALMSHORE', 68, height * 0.515);
  ctx.fillStyle = 'rgba(246,234,210,0.78)';
  ctx.font = `500 14px ${FONT.ui}`;
  ctx.fillText('Five jobs. One marina. A city that pays its own way.', 70, height * 0.58);

  // Menu.
  const items = game.titleItems;
  ctx.font = `800 15px ${FONT.display}`;
  items.forEach((item, i) => {
    const y = height * 0.69 + i * 29;
    const selected = i === game.titleIndex;
    if (selected) {
      ctx.fillStyle = 'rgba(242,193,78,0.16)';
      roundPanel(ctx, 60, y - 17, 300, 26, 5);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillRect(60, y - 17, 3, 26);
    }
    ctx.fillStyle = selected ? GOLD : 'rgba(236,224,198,0.75)';
    ctx.fillText(item.label, 74, y);
  });
  // Controls column.
  ctx.textAlign = 'right';
  ctx.shadowColor = 'rgba(16,12,8,0.75)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = 'rgba(246,234,210,0.85)';
  ctx.font = `800 10px ${FONT.ui}`;
  ctx.fillText('ON FOOT', width - 62, height * 0.55);
  ctx.font = `500 11px ${FONT.ui}`;
  ctx.fillStyle = 'rgba(236,224,198,0.66)';
  ['WASD  move    SHIFT  sprint', 'MOUSE  aim    LMB  shoot', 'E  steal / interact    SPACE  punch', '1 2 3  weapons'].forEach((line, i) => {
    ctx.fillText(line, width - 62, height * 0.58 + i * 17);
  });
  ctx.fillStyle = 'rgba(246,234,210,0.85)';
  ctx.font = `800 10px ${FONT.ui}`;
  ctx.fillText('DRIVING', width - 62, height * 0.74);
  ctx.font = `500 11px ${FONT.ui}`;
  ctx.fillStyle = 'rgba(236,224,198,0.66)';
  ['W / S  throttle & brake   A / D  steer', 'SPACE  handbrake   E  get out   H  horn', 'ESC  pause'].forEach((line, i) => {
    ctx.fillText(line, width - 62, height * 0.77 + i * 17);
  });
  ctx.fillStyle = 'rgba(236,224,198,0.55)';
  ctx.font = `500 10px ${FONT.ui}`;
  ctx.fillText('Every pixel drawn with Canvas 2D. Every sound synthesised. No network, no assets.', width - 62, height - 22);
  ctx.restore();
}

function drawPause(ctx, game, width, height) {
  ctx.fillStyle = 'rgba(16,12,9,0.66)';
  ctx.fillRect(0, 0, width, height);
  const w = 520;
  const h = 340;
  const x = width / 2 - w / 2;
  const y = height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(26,21,16,0.94)';
  roundPanel(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,193,78,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = `800 30px ${FONT.display}`;
  ctx.fillText('PAUSED', x + 34, y + 46);
  ctx.fillStyle = 'rgba(236,224,198,0.55)';
  ctx.font = `600 11px ${FONT.ui}`;
  ctx.fillText('PALMSHORE  ·  THE CITY WAITS', x + 36, y + 70);
  const items = game.pauseItems;
  items.forEach((item, i) => {
    const iy = y + 106 + i * 36;
    const selected = i === game.pauseIndex;
    if (selected) {
      ctx.fillStyle = 'rgba(242,193,78,0.14)';
      roundPanel(ctx, x + 30, iy - 16, 260, 30, 5);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillRect(x + 30, iy - 16, 3, 30);
    }
    ctx.fillStyle = selected ? GOLD : 'rgba(236,224,198,0.8)';
    ctx.font = `700 14px ${FONT.display}`;
    ctx.fillText(item.label, x + 46, iy);
  });
  ctx.fillStyle = 'rgba(236,224,198,0.64)';
  ctx.font = `500 11px ${FONT.ui}`;
  const help = game.player.inCar
    ? ['W/S throttle, A/D steer, SPACE handbrake', 'E leave car, LMB drive-by, H horn', 'Wanted level fades when you break line of sight']
    : ['WASD walk, SHIFT run, E steal/interact', 'LMB fire, SPACE punch, 1/2/3 weapons', 'Gold markers start jobs; shops sell ammo and care'];
  help.forEach((line, i) => ctx.fillText(line, x + 310, y + 120 + i * 22));
  ctx.fillStyle = 'rgba(236,224,198,0.4)';
  ctx.font = `500 10px ${FONT.ui}`;
  ctx.fillText('↑ ↓  choose   ·   ENTER  select   ·   ESC  resume', x + 34, y + h - 24);
  ctx.restore();
}

function drawWasted(ctx, game, width, height) {
  ctx.fillStyle = `rgba(40,14,12,${0.55 + Math.sin(game.time * 2) * 0.03})`;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20,12,10,0.6)';
  ctx.font = `800 96px ${FONT.display}`;
  ctx.fillText('WASTED', width / 2 + 4, height * 0.4 + 4);
  ctx.fillStyle = '#f0d9b6';
  ctx.fillText('WASTED', width / 2, height * 0.4);
  ctx.fillStyle = 'rgba(246,234,210,0.8)';
  ctx.font = `600 16px ${FONT.ui}`;
  ctx.fillText(`The clinic billed you $${PLAYER.respawnCost}. They always do.`, width / 2, height * 0.52);
  ctx.fillStyle = GOLD;
  ctx.font = `800 13px ${FONT.ui}`;
  ctx.fillText(`RESPAWNING IN ${Math.max(0, Math.ceil(game.respawnTimer))}`, width / 2, height * 0.62);
  ctx.fillStyle = 'rgba(236,224,198,0.55)';
  ctx.font = `500 11px ${FONT.ui}`;
  ctx.fillText('ENTER  respawn now', width / 2, height * 0.7);
  ctx.restore();
}

function drawBusted(ctx, game, width, height) {
  ctx.fillStyle = 'rgba(12,20,34,0.62)';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(12,20,32,0.6)';
  ctx.font = `800 96px ${FONT.display}`;
  ctx.fillText('BUSTED', width / 2 + 4, height * 0.4 + 4);
  ctx.fillStyle = '#dbe6f2';
  ctx.fillText('BUSTED', width / 2, height * 0.4);
  ctx.fillStyle = 'rgba(230,238,246,0.8)';
  ctx.font = `600 16px ${FONT.ui}`;
  ctx.fillText(`Bail and a lawyer: $${PLAYER.bustCost}. Your guns stayed with the desk sergeant.`, width / 2, height * 0.52);
  ctx.fillStyle = GOLD;
  ctx.font = `800 13px ${FONT.ui}`;
  ctx.fillText(`RELEASED IN ${Math.max(0, Math.ceil(game.respawnTimer))}`, width / 2, height * 0.62);
  ctx.fillStyle = 'rgba(236,224,198,0.55)';
  ctx.font = `500 11px ${FONT.ui}`;
  ctx.fillText('ENTER  walk out', width / 2, height * 0.7);
  ctx.restore();
}

function drawEndCard(ctx, game, width, height) {
  ctx.fillStyle = 'rgba(16,12,9,0.8)';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = `800 12px ${FONT.ui}`;
  ctx.fillText('PALMSHORE  ·  END OF THE LINE', width / 2, height * 0.22);
  ctx.fillStyle = CREAM;
  ctx.font = `800 54px ${FONT.display}`;
  ctx.fillText('THE TIDE TURNS', width / 2, height * 0.38);
  ctx.fillStyle = 'rgba(236,224,198,0.82)';
  ctx.font = `500 15px ${FONT.ui}`;
  ctx.fillText('Brassline is gone. The Gulls are scattered. Verano Land is a footnote.', width / 2, height * 0.5);
  ctx.fillText('Palmshore belongs to the people who were already here.', width / 2, height * 0.55);
  ctx.fillStyle = 'rgba(242,193,78,0.9)';
  ctx.font = `800 12px ${FONT.ui}`;
  ctx.fillText(`MISSIONS ${game.stats.missions}   ·   CASH $${money(game.player.cash)}   ·   DELIVERIES ${game.stats.deliveries}   ·   KO'S ${game.stats.kills}`, width / 2, height * 0.65);
  ctx.fillStyle = 'rgba(236,224,198,0.6)';
  ctx.font = `600 12px ${FONT.ui}`;
  ctx.fillText('ENTER  keep driving   ·   the city is still yours', width / 2, height * 0.75);
  ctx.restore();
}

/** In screenshot mode the HUD is drawn without the minimap calls that depend on interaction. */
function drawShotHud(ctx, game, width, height) {
  if (game.dialogue) drawDialogue(ctx, game, width, height);
  if (game.missionPassed) drawMissionPassed(ctx, game, width, height);
}

function star(ctx, cx, cy, radius, color, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.44;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(64,44,18,0.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function roundPanel(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + lines * lineHeight);
}

function money(value) {
  return Math.max(0, Math.round(value)).toLocaleString('en-US');
}

function lighten(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((value >> 16) & 255) + 40);
  const g = Math.min(255, ((value >> 8) & 255) + 40);
  const b = Math.min(255, (value & 255) + 40);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function silhouettePalm(ctx, x, y, size, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = 'rgba(22,18,14,0.82)';
  ctx.lineWidth = size * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.45, size * 0.03, -size * 0.78);
  ctx.stroke();
  ctx.fillStyle = 'rgba(22,18,14,0.82)';
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(size * 0.03, -size * 0.78);
    ctx.quadraticCurveTo(
      Math.cos(a) * size * 0.32, -size * 0.78 + Math.sin(a) * size * 0.22 - size * 0.08,
      Math.cos(a) * size * 0.55, -size * 0.78 + Math.sin(a) * size * 0.34,
    );
    ctx.quadraticCurveTo(Math.cos(a) * size * 0.3, -size * 0.74 + Math.sin(a) * size * 0.28, size * 0.03, -size * 0.78);
    ctx.fill();
  }
  ctx.restore();
}

export { drawMinimap, wrapped, money };
