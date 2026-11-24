// The minimap: a rotating square of Palmshore with a compass ring, road grid, sea,
// mission blips and live traffic. Drawn in 2D over the WebGL frame.

import { WORLD, CITY, CLOCK, UI } from './config.js';
import { TAU, clamp, dist } from './math.js';

export class Minimap {
  constructor(game) {
    this.game = game;
    this.range = 128;
    this.pulse = 0;
  }

  draw(ctx, x, y, size) {
    const game = this.game;
    const player = game.player;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const pad = size * 0.09;
    const mapSize = size - pad * 2;
    const scale = mapSize / (this.range * 2);
    const heading = player.car ? player.car.heading : player.heading;
    const rotation = -Math.PI / 2 - heading;

    ctx.save();
    // Panel.
    ctx.fillStyle = 'rgba(10, 20, 25, 0.92)';
    rounded(ctx, x, y, size, size, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(247, 239, 220, 0.3)';
    ctx.lineWidth = 1;
    rounded(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 6);
    ctx.stroke();

    // Compass ring.
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.strokeStyle = 'rgba(247, 239, 220, 0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.455, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(247, 239, 220, 0.16)';
    for (let i = 0; i < 36; i += 1) {
      const angle = (i / 36) * TAU;
      const major = i % 9 === 0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (size * 0.44), Math.sin(angle) * (size * 0.44));
      ctx.lineTo(Math.cos(angle) * (size * (major ? 0.41 : 0.428)), Math.sin(angle) * (size * (major ? 0.41 : 0.428)));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(247, 239, 220, 0.75)';
    ctx.font = '800 12px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cardinals = [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]];
    for (const [letter, dx, dz] of cardinals) {
      const r = size * 0.485;
      ctx.save();
      ctx.translate(dx * r, dz * r);
      ctx.rotate(-rotation);
      ctx.fillStyle = letter === 'N' ? '#ffc857' : 'rgba(247, 239, 220, 0.75)';
      ctx.fillText(letter, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Map content, clipped to the square.
    ctx.save();
    rounded(ctx, x + pad, y + pad, mapSize, mapSize, 3);
    ctx.clip();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    const px = player.x;
    const pz = player.z;
    // Sea and beach.
    ctx.fillStyle = CLOCK.waterDeep;
    ctx.fillRect(CITY.waterX - px, -this.range - pz, 900, this.range * 2 + 900);
    ctx.fillStyle = '#c9b184';
    ctx.fillRect(CITY.beachX - px, -this.range - pz, CITY.waterX - CITY.beachX, this.range * 2 + 900);
    // Blocks.
    ctx.fillStyle = '#1d2a2e';
    for (const info of game.world.blockInfo.values()) {
      const rect = info.rect;
      ctx.fillRect(rect.x - px, rect.z - pz, rect.w, rect.d);
    }
    // Park.
    const park = game.world.blockInfo.get('2,2');
    if (park) {
      ctx.fillStyle = '#3c533a';
      ctx.fillRect(park.rect.x - px, park.rect.z - pz, park.rect.w, park.rect.d);
    }
    // Roads.
    ctx.strokeStyle = 'rgba(226, 220, 204, 0.8)';
    ctx.lineWidth = 15.2;
    ctx.beginPath();
    for (const edge of game.roads.hEdges) {
      ctx.moveTo(edge.x0 - px, edge.z - pz);
      ctx.lineTo(edge.x1 - px, edge.z - pz);
    }
    for (const edge of game.roads.vEdges) {
      ctx.moveTo(edge.x - px, edge.z0 - pz);
      ctx.lineTo(edge.x - px, edge.z1 - pz);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(14, 26, 32, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const edge of game.roads.hEdges) {
      ctx.moveTo(edge.x0 - px, edge.z - pz);
      ctx.lineTo(edge.x1 - px, edge.z - pz);
    }
    for (const edge of game.roads.vEdges) {
      ctx.moveTo(edge.x - px, edge.z0 - pz);
      ctx.lineTo(edge.x - px, edge.z1 - pz);
    }
    ctx.stroke();

    // Blips.
    const time = game.tick;
    for (const car of game.vehicles.list) {
      if (car.driver === 'player') continue;
      const d = dist(car.x, car.z, px, pz);
      if (d > this.range * 1.25) continue;
      if (car.driver === 'police') {
        ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff5c5c' : '#79b8ff';
        ctx.fillRect(car.x - px - 1.4, car.z - pz - 1.4, 2.8, 2.8);
      } else {
        ctx.fillStyle = 'rgba(247, 239, 220, 0.45)';
        ctx.fillRect(car.x - px - 0.8, car.z - pz - 0.8, 1.6, 1.6);
      }
    }
    for (const ped of game.pedestrians.peds) {
      if (!ped.alive) continue;
      if (dist(ped.x, ped.z, px, pz) > this.range) continue;
      ctx.fillStyle = 'rgba(255, 214, 160, 0.45)';
      ctx.fillRect(ped.x - px - 0.5, ped.z - pz - 0.5, 1.1, 1.1);
    }
    for (const blip of game.missions.blips()) {
      ctx.fillStyle = blip.color;
      ctx.beginPath();
      ctx.arc(blip.x - px, blip.z - pz, 2.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#0f1b22';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    // Traffic lights near the player, tiny warm dots.
    for (const unit of game.police.units) {
      if (!unit.alive) continue;
      const ux = unit.kind === 'car' ? unit.car.x : unit.x;
      const uz = unit.kind === 'car' ? unit.car.z : unit.z;
      if (dist(ux, uz, px, pz) > this.range) continue;
      ctx.fillStyle = unit.kind === 'air' ? '#8ed6e8' : '#79b8ff';
      ctx.beginPath();
      ctx.arc(ux - px, uz - pz, 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Player ring and facing wedge.
    this.pulse += 0.016;
    const pulse = 0.5 + 0.5 * Math.sin(this.pulse * 3);
    ctx.strokeStyle = `rgba(255, 200, 87, ${0.55 + pulse * 0.35})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#f7efdc';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 6);
    ctx.lineTo(centerX + 4.4, centerY + 4.6);
    ctx.lineTo(centerX, centerY + 2.2);
    ctx.lineTo(centerX - 4.4, centerY + 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffc857';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1.6, 0, TAU);
    ctx.fill();

    // Inner border over the clip.
    ctx.strokeStyle = 'rgba(247, 239, 220, 0.22)';
    rounded(ctx, x + pad, y + pad, mapSize, mapSize, 3);
    ctx.stroke();
    ctx.restore();
  }

  stateLine() {
    const game = this.game;
    if (game.police.wanted > 0) return `ALERT · ${game.police.stars}`;
    const player = game.player;
    const col = clamp(Math.floor(player.x / WORLD.pitch), 0, WORLD.cols - 1);
    const row = clamp(Math.floor(player.z / WORLD.pitch), 0, WORLD.rows - 1);
    const sector = 10 + (col * 7 + row * 3);
    return `NEUTRAL · ${sector}`;
  }
}

export function rounded(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export const MINIMAP_UI = UI;
