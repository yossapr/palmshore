// The minimap: a circular window over a little painted map of the whole city, with the player's
// arrow, mission blips, police, the safehouse and the sea. The map itself is painted once into
// an offscreen canvas, then scrolled and clipped every frame.

import { PALETTE, CITY, CITY_WIDTH, CITY_HEIGHT, COAST_X, HARBOR_Y, DISTRICT_NAMES } from './config.js';
import { clamp } from './math.js';

const MAP_SCALE = 0.11;

export function createMinimap(world) {
  const map = document.createElement('canvas');
  map.width = Math.ceil(CITY_WIDTH * MAP_SCALE);
  map.height = Math.ceil(CITY_HEIGHT * MAP_SCALE);
  const mctx = map.getContext('2d');

  function paint() {
    mctx.fillStyle = '#c9b183';
    mctx.fillRect(0, 0, map.width, map.height);
    // Blocks
    for (const block of world.blocks) {
      const x = block.x * MAP_SCALE;
      const y = block.y * MAP_SCALE;
      const w = block.w * MAP_SCALE;
      const h = block.h * MAP_SCALE;
      if (block.district === 'park') mctx.fillStyle = '#78965f';
      else if (block.district === 'beach') mctx.fillStyle = '#e8d3a0';
      else if (block.district === 'docks') mctx.fillStyle = '#b3aa98';
      else if (block.district === 'downtown') mctx.fillStyle = '#cdbb9b';
      else mctx.fillStyle = '#d8c7a6';
      mctx.fillRect(x, y, w, h);
    }
    // Buildings as soft dark blocks.
    mctx.fillStyle = 'rgba(62,52,42,0.55)';
    for (const b of world.buildings) {
      mctx.fillRect(b.x * MAP_SCALE, b.y * MAP_SCALE, b.w * MAP_SCALE, b.h * MAP_SCALE);
    }
    // Roads: each named line, wider than a hairline.
    mctx.strokeStyle = 'rgba(250,242,222,0.92)';
    mctx.lineWidth = CITY.roadW * MAP_SCALE * 0.7;
    for (const v of world.roads.verticals) {
      mctx.beginPath();
      mctx.moveTo(v.x * MAP_SCALE, 0);
      mctx.lineTo(v.x * MAP_SCALE, CITY_HEIGHT * MAP_SCALE);
      mctx.stroke();
    }
    for (const h of world.roads.horizontals) {
      mctx.beginPath();
      mctx.moveTo(0, h.y * MAP_SCALE);
      mctx.lineTo(CITY_WIDTH * MAP_SCALE, h.y * MAP_SCALE);
      mctx.stroke();
    }
    // Sea, sand and the harbour.
    const coastX = COAST_X * MAP_SCALE;
    mctx.fillStyle = '#e8d5a8';
    mctx.fillRect((COAST_X - 320) * MAP_SCALE, 0, 320 * MAP_SCALE, HARBOR_Y * MAP_SCALE);
    mctx.fillStyle = '#79c2b8';
    mctx.fillRect(coastX, 0, map.width - coastX, HARBOR_Y * MAP_SCALE);
    mctx.fillRect(0, HARBOR_Y * MAP_SCALE, map.width, map.height - HARBOR_Y * MAP_SCALE);
    mctx.strokeStyle = 'rgba(248,240,214,0.8)';
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.moveTo(coastX, 0);
    mctx.lineTo(coastX, HARBOR_Y * MAP_SCALE);
    mctx.moveTo(0, HARBOR_Y * MAP_SCALE);
    mctx.lineTo(map.width, HARBOR_Y * MAP_SCALE);
    mctx.stroke();
  }
  paint();

  /** Draw into a circle of radius `radius`, centred on screen at (cx, cy). */
  function draw(ctx, game, cx, cy, radius, alpha = 1) {
    const p = game.player;
    const focus = p.mode === 'car' && p.car ? p.car : p;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Backing plate and ring.
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28,24,20,0.88)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();

    const zoom = 1.5;
    const srcW = (radius * 2) / zoom;
    const sx = focus.x * MAP_SCALE - srcW / 2;
    const sy = focus.y * MAP_SCALE - srcW / 2;
    ctx.drawImage(map, sx, sy, srcW, srcW, cx - radius, cy - radius, radius * 2, radius * 2);

    // A warm haze over the map so it sits in the same light as the city.
    const haze = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.4, radius * 0.1, cx, cy, radius);
    haze.addColorStop(0, 'rgba(255,226,170,0.16)');
    haze.addColorStop(1, 'rgba(60,40,24,0.18)');
    ctx.fillStyle = haze;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    const toMap = (wx, wy) => ({
      x: cx + (wx * MAP_SCALE - focus.x * MAP_SCALE) * zoom,
      y: cy + (wy * MAP_SCALE - focus.y * MAP_SCALE) * zoom,
    });

    // Mission blip(s).
    const missions = game.missions;
    if (missions?.marker) {
      const m = toMap(missions.marker.x, missions.marker.y);
      if (Math.hypot(m.x - cx, m.y - cy) < radius - 6) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.strokeStyle = '#f7edd7';
        ctx.lineWidth = 1;
        ctx.strokeRect(-4, -4, 8, 8);
        ctx.restore();
      }
    }
    if (missions?.blips) {
      for (const blip of missions.blips) {
        const m = toMap(blip.x, blip.y);
        if (Math.hypot(m.x - cx, m.y - cy) > radius - 6) continue;
        ctx.fillStyle = blip.color ?? PALETTE.coral;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Police.
    const flashing = Math.floor((game.time ?? 0) * 4) % 2 === 0;
    for (const car of game.police?.cars ?? []) {
      if (car.removed || car.exploded) continue;
      const m = toMap(car.x, car.y);
      if (Math.hypot(m.x - cx, m.y - cy) > radius - 4) continue;
      ctx.fillStyle = flashing ? '#6fa8dc' : '#d75b5b';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f2ead7';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    for (const cop of game.police?.cops ?? []) {
      if (cop.dead) continue;
      const m = toMap(cop.x, cop.y);
      if (Math.hypot(m.x - cx, m.y - cy) > radius - 4) continue;
      ctx.fillStyle = '#6fa8dc';
      ctx.fillRect(m.x - 2, m.y - 2, 4, 4);
    }
    if (game.police?.heli) {
      const h = toMap(game.police.heli.x, game.police.heli.y);
      if (Math.hypot(h.x - cx, h.y - cy) < radius - 4) {
        ctx.strokeStyle = '#e8e0cc';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
        ctx.moveTo(h.x - 6, h.y);
        ctx.lineTo(h.x + 6, h.y);
        ctx.stroke();
      }
    }

    // Safehouse and garage.
    if (game.world.landmarks.safehouse) {
      const s = toMap(game.world.landmarks.safehouse.x, game.world.landmarks.safehouse.y);
      if (Math.hypot(s.x - cx, s.y - cy) < radius - 6) {
        ctx.fillStyle = '#7fc0a0';
        ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
      }
    }

    // The player: a cream arrow with an ink outline.
    const pcx = cx;
    const pcy = cy;
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate((p.mode === 'car' && p.car ? p.car.angle : p.angle) + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -6.4);
    ctx.lineTo(4.6, 5.2);
    ctx.lineTo(0, 2.8);
    ctx.lineTo(-4.6, 5.2);
    ctx.closePath();
    ctx.fillStyle = '#fff6df';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#241e19';
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Ring and north marker.
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(247,237,215,0.9)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(33,29,25,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f7edd7';
    ctx.font = '700 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - radius + 12);
    ctx.restore();
  }

  function districtLabel(world, x, y) {
    let best = null;
    let bestD = Infinity;
    for (const block of world.blocks) {
      if (x >= block.x && x <= block.x + block.w && y >= block.y && y <= block.y + block.h) {
        best = block;
        break;
      }
      const d = Math.hypot(block.x + block.w / 2 - x, block.y + block.h / 2 - y);
      if (d < bestD) {
        bestD = d;
        best = block;
      }
    }
    return best ? DISTRICT_NAMES[best.district] ?? 'PALMSHORE' : 'PALMSHORE';
  }

  return { draw, districtLabel, map };
}

export function minimapScale() {
  return clamp(MAP_SCALE, 0, 1);
}

