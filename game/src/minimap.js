// The live minimap: a north-up circle around the player showing the street grid, the sea and
// sand, blocks, mission and activity blips clamped to the rim when they are off the map, the
// police, the helicopter, and a heading arrow for the player. Drawn as a map, not a miniature:
// pale roads on dark blocks so every street reads at a glance.

import { ROAD_HALF, VX, HY } from './roads.js';
import { PALETTE, FONT } from './config.js';
import { missionBlips } from './missions.js';

export function drawMinimap(ctx, game, cx, cy, radius) {
  const player = game.player;
  const worldScale = 0.095;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#5f5748';
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(worldScale, worldScale);
  ctx.translate(-player.x, -player.y);
  const world = game.world;
  // Sea and sand.
  ctx.fillStyle = '#2c7280';
  ctx.fillRect(world.waterX, -400, 1600, world.height + 800);
  ctx.fillStyle = '#c6b184';
  ctx.fillRect(world.sandX, -400, world.waterX - world.sandX, world.height + 800);
  // Blocks.
  for (const block of world.blocks) {
    ctx.fillStyle = block.district === 'park' ? '#5f7d42' : '#756a56';
    ctx.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
  }
  ctx.fillStyle = '#574f41';
  for (const b of world.buildings) ctx.fillRect(b.x, b.y, b.w, b.h);
  // Streets, pale and wide.
  ctx.strokeStyle = '#d8c8a6';
  ctx.lineWidth = ROAD_HALF * 2;
  ctx.beginPath();
  for (const y of HY) {
    ctx.moveTo(0, y);
    ctx.lineTo(world.waterX, y);
  }
  for (const x of VX) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(92,78,58,0.4)';
  ctx.lineWidth = 3.2;
  ctx.setLineDash([16, 18]);
  ctx.beginPath();
  for (const y of HY) {
    ctx.moveTo(0, y);
    ctx.lineTo(world.waterX, y);
  }
  for (const x of VX) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Blips in screen space.
  for (const blip of missionBlips(game)) {
    const color = blip.kind === 'activity' ? '#f2a23e' : '#ffd76a';
    drawBlip(ctx, cx, cy, radius, worldScale, player, blip.x, blip.y, color, blip.kind === 'objective', blip.kind === 'objective' ? 5.4 : 4.6);
  }
  for (const car of game.vehicles) {
    if (!car.police || car.exploded) continue;
    drawBlip(ctx, cx, cy, radius, worldScale, player, car.x, car.y, game.time % 0.6 < 0.3 ? '#f05a48' : '#5a95d6', false, 4);
  }
  for (const person of game.people) {
    if (person.team !== 'police' || person.dead) continue;
    drawBlip(ctx, cx, cy, radius, worldScale, player, person.x, person.y, '#7fb2e0', false, 2.6);
  }
  if (game.heli) drawBlip(ctx, cx, cy, radius, worldScale, player, game.heli.x, game.heli.y, '#f4efe0', false, 4);

  // Player arrow, always at the centre.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(player.inCar ? player.inCar.angle : player.angle);
  ctx.fillStyle = 'rgba(28,22,16,0.65)';
  ctx.beginPath();
  ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8e6';
  ctx.strokeStyle = 'rgba(40,32,22,0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-5.5, -6);
  ctx.lineTo(-2.6, 0);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Rim, north marker.
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(30,24,18,0.9)';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 2.6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(246,234,210,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = 'rgba(31,25,19,0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy - radius + 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `700 12px ${FONT.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy - radius + 2.5);
  ctx.restore();
}

function drawBlip(ctx, cx, cy, radius, scale, player, x, y, color, pulse = false, size = 4.6) {
  const dx = (x - player.x) * scale;
  const dy = (y - player.y) * scale;
  const limit = radius - 12;
  const length = Math.hypot(dx, dy);
  let px = dx;
  let py = dy;
  if (length > limit) {
    px = (dx / length) * limit;
    py = (dy / length) * limit;
  }
  const sx = cx + px;
  const sy = cy + py;
  const pulseSize = pulse ? size + Math.sin(performance.now() / 240) * 1.8 : size;
  ctx.beginPath();
  ctx.arc(sx, sy, pulseSize + 2.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(26,20,14,0.72)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy, pulseSize, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(1.2, pulseSize * 0.38), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,250,238,0.95)';
  ctx.fill();
}
