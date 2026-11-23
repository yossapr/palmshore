// The painter. Draws Palmshore from above: ocean shimmer, sand, asphalt and crossings, blocks
// and their rooftops, palms, street furniture, cars and people, then the sun wash and vignette
// that tie it together. Every shape is Canvas 2D; shadows are one warm ink offset to the south-east.

import { CITY, CITY_WIDTH, CITY_HEIGHT, COAST_X, HARBOR_Y, PALETTE, SUN, FONT, PLAYER } from './config.js';
import { clamp, hash2, roundRectPath } from './math.js';
import { drawPerson } from './people.js';
import { PLAYER_LOOK } from './player.js';

const LOT_COLORS = {
  downtown: '#d8c8ab',
  beach: '#ead9b0',
  suburbs: '#96a872',
  docks: '#b7b0a2',
  park: '#87a06b',
  midtown: '#d4c7ac',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let time = 0;

  function resize() {
    // The main loop sizes the backing store; this keeps the renderer honest after a resize.
  }

  function visible(x, y, w, h, view) {
    return x < view.x + view.w && x + w > view.x && y < view.y + view.h && y + h > view.y;
  }

  // ---- ground ------------------------------------------------------------------------------
  function drawOcean(view, t) {
    if (view.x + view.w < COAST_X - 120) return;
    const left = Math.max(view.x - 60, COAST_X - 60);
    const right = view.x + view.w + 60;
    const top = Math.max(view.y - 60, 0);
    const bottom = Math.min(view.y + view.h + 60, HARBOR_Y + 20);
    if (bottom <= top) return;
    const g = ctx.createLinearGradient(left, 0, right, 0);
    g.addColorStop(0, '#69b7ae');
    g.addColorStop(0.25, '#4ba3a2');
    g.addColorStop(1, '#1f7079');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(right, bottom);
    ctx.lineTo(right, top);
    const step = 70;
    for (let x = right; x >= left; x -= step) {
      const shore = COAST_X + Math.sin(x * 0.011) * 18 + Math.sin(x * 0.0031 + 1.7) * 26;
      ctx.lineTo(shore, top);
    }
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();

    // Slow shimmering bands.
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#c9efe4';
    ctx.lineWidth = 2.6;
    for (let k = 0; k < 7; k += 1) {
      const off = ((t * 9 + k * 90) % (view.h + 300)) - 150;
      const y = view.y + off;
      if (y < top || y > HARBOR_Y + 20) continue;
      ctx.beginPath();
      for (let x = left; x <= right; x += 26) {
        const wave = Math.sin(x * 0.017 + t * 0.7 + k) * 5;
        if (x === left) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = '#f3f7e8';
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 6; k += 1) {
      const y = top + 40 + k * 92 + Math.sin(t * 0.5 + k) * 26;
      if (y < top || y > bottom) continue;
      ctx.beginPath();
      for (let x = left; x <= right; x += 34) {
        const wave = Math.sin(x * 0.03 + k * 2 + t) * 3;
        if (x === left) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    // Small whitecaps, scattered but stable.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#f7f9ea';
    ctx.lineWidth = 1.1;
    for (let k = 0; k < 18; k += 1) {
      const x = COAST_X + 70 + hash2(k, 4) * 300;
      const y = view.y + hash2(k, 9) * view.h;
      if (y < 60 || y > HARBOR_Y) continue;
      ctx.beginPath();
      ctx.arc(x + Math.sin(t + k) * 4, y, 4 + hash2(k, 2) * 6, 0.2, 2.6);
      ctx.stroke();
    }
    ctx.restore();

    // Wet sand, foam and a brighter crest line along the shore.
    ctx.save();
    ctx.fillStyle = 'rgba(184,157,112,0.45)';
    ctx.beginPath();
    for (let x = left; x <= right; x += 28) {
      const shore = COAST_X + Math.sin(x * 0.011) * 18 + Math.sin(x * 0.0031 + 1.7) * 26 - 34;
      if (x === left) ctx.moveTo(shore, top);
      else ctx.lineTo(shore, bottom);
    }
    for (let x = right; x >= left; x -= 28) {
      const shore = COAST_X + Math.sin(x * 0.011) * 18 + Math.sin(x * 0.0031 + 1.7) * 26 - 8;
      ctx.lineTo(shore, bottom);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(247,248,232,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = left; x <= right; x += 24) {
      const shore = COAST_X + Math.sin(x * 0.011) * 18 + Math.sin(x * 0.0031 + 1.7) * 26 - 3;
      if (x === left) ctx.moveTo(shore, top);
      else ctx.lineTo(shore, top + (bottom - top));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(247,248,232,0.35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    for (let x = left; x <= right; x += 26) {
      const shore = COAST_X + Math.sin(x * 0.011) * 18 + Math.sin(x * 0.0031 + 1.7) * 26 - 16;
      if (x === left) ctx.moveTo(shore, top);
      else ctx.lineTo(shore, bottom);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawHarbor(view, t) {
    if (view.y + view.h < HARBOR_Y - 80) return;
    const top = HARBOR_Y;
    const left = view.x - 60;
    const right = view.x + view.w + 60;
    const bottom = view.y + view.h + 60;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, '#2f8187');
    g.addColorStop(1, '#155962');
    ctx.fillStyle = g;
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#bfe7dc';
    ctx.lineWidth = 2.4;
    for (let k = 0; k < 5; k += 1) {
      const y = top + 40 + k * 52 + Math.sin(t * 0.6 + k) * 6;
      ctx.beginPath();
      for (let x = left; x <= right; x += 30) {
        const wave = Math.sin(x * 0.02 + t + k) * 4;
        if (x === left) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    ctx.restore();
    // Quay wall and its shadow.
    ctx.fillStyle = '#cfc5b1';
    ctx.fillRect(left, HARBOR_Y - 96, right - left, 96);
    ctx.fillStyle = 'rgba(34,29,24,0.25)';
    ctx.fillRect(left, HARBOR_Y - 12, right - left, 12);
    ctx.fillStyle = '#a99f8d';
    ctx.fillRect(left, HARBOR_Y - 96, right - left, 10);
  }

  function drawSandDetails(view, t) {
    const shoreMin = COAST_X - 340;
    if (view.x + view.w < shoreMin) return;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#bda579';
    ctx.lineWidth = 1.4;
    const x0 = Math.max(view.x, shoreMin);
    const x1 = Math.min(view.x + view.w, COAST_X + 40);
    for (let y = Math.max(view.y, 0); y < Math.min(view.y + view.h, HARBOR_Y); y += 26) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 40) {
        const yy = y + Math.sin(x * 0.02 + y * 0.01) * 4;
        if (x === x0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    // Boardwalk between the coast road and the sand.
    const bx = CITY.cols * CITY.pitch + CITY.roadW + 16;
    ctx.fillStyle = '#c9a879';
    ctx.fillRect(bx, view.y - 20, 26, view.h + 40);
    ctx.fillStyle = 'rgba(44,35,25,0.18)';
    for (let y = view.y - 20; y < view.y + view.h + 40; y += 18) ctx.fillRect(bx, y, 26, 1.6);
  }

  function drawRoads(view, t) {
    const roads = gameRef.world.roads;
    // Asphalt strips, clipped to land.
    const landBottom = HARBOR_Y - 8;
    for (const v of roads.verticals) {
      if (v.x + CITY.roadW / 2 < view.x || v.x - CITY.roadW / 2 > view.x + view.w) continue;
      const x = v.x - CITY.roadW / 2;
      const y0 = Math.max(view.y, 0);
      const y1 = Math.min(view.y + view.h, landBottom);
      if (y1 <= y0) continue;
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(x, y0, CITY.roadW, y1 - y0);
      // Gutters.
      ctx.fillStyle = PALETTE.gutter;
      ctx.fillRect(x, y0, 8, y1 - y0);
      ctx.fillRect(x + CITY.roadW - 8, y0, 8, y1 - y0);
      ctx.fillStyle = 'rgba(255,240,205,0.16)';
      ctx.fillRect(x + 8, y0, 2, y1 - y0);
      ctx.fillRect(x + CITY.roadW - 10, y0, 2, y1 - y0);
    }
    for (const h of roads.horizontals) {
      if (h.y + CITY.roadW / 2 < view.y || h.y - CITY.roadW / 2 > view.y + view.h) continue;
      const y = h.y - CITY.roadW / 2;
      const x0 = Math.max(view.x, 0);
      const x1 = Math.min(view.x + view.w, CITY.cols * CITY.pitch + CITY.roadW);
      if (x1 <= x0) continue;
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(x0, y, x1 - x0, CITY.roadW);
      ctx.fillStyle = PALETTE.gutter;
      ctx.fillRect(x0, y, x1 - x0, 8);
      ctx.fillRect(x0, y + CITY.roadW - 8, x1 - x0, 8);
      ctx.fillStyle = 'rgba(255,240,205,0.16)';
      ctx.fillRect(x0, y + 8, x1 - x0, 2);
      ctx.fillRect(x0, y + CITY.roadW - 10, x1 - x0, 2);
    }

    // Faded lane paint: a double gold centre line with white dashes either side.
    const nodeGap = 52;
    ctx.lineWidth = 1.6;
    for (const v of roads.verticals) {
      if (v.x < view.x - 80 || v.x > view.x + view.w + 80) continue;
      const y0 = Math.max(view.y, 0);
      const y1 = Math.min(view.y + view.h, landBottom);
      if (y1 <= y0) continue;
      if (v.i > 0 && v.i < CITY.cols) {
        ctx.strokeStyle = 'rgba(224,190,112,0.5)';
        ctx.beginPath();
        ctx.moveTo(v.x - 3, y0);
        ctx.lineTo(v.x - 3, y1);
        ctx.moveTo(v.x + 3, y0);
        ctx.lineTo(v.x + 3, y1);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(244,235,214,0.3)';
        for (const side of [-33, 33]) {
          ctx.beginPath();
          for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) {
            const nearNode = Math.abs(((y - CITY.roadW / 2) % CITY.pitch)) < nodeGap;
            if (nearNode) continue;
            ctx.moveTo(v.x + side, y);
            ctx.lineTo(v.x + side, y + 20);
          }
          ctx.stroke();
        }
        // Manholes and patches.
        for (let y = Math.floor(y0 / 240) * 240; y < y1; y += 240) {
          const hx = hash2(v.i, y);
          if (hx < 0.5) continue;
          ctx.fillStyle = 'rgba(45,41,36,0.35)';
          ctx.beginPath();
          ctx.arc(v.x + (hx - 0.5) * 58, y + 70, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (const h of roads.horizontals) {
      if (h.y < view.y - 80 || h.y > view.y + view.h + 80) continue;
      const x0 = Math.max(view.x, 0);
      const x1 = Math.min(view.x + view.w, CITY.cols * CITY.pitch + CITY.roadW);
      if (x1 <= x0) continue;
      ctx.strokeStyle = 'rgba(224,190,112,0.5)';
      ctx.beginPath();
      ctx.moveTo(x0, h.y - 3);
      ctx.lineTo(x1, h.y - 3);
      ctx.moveTo(x0, h.y + 3);
      ctx.lineTo(x1, h.y + 3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(244,235,214,0.3)';
      for (const side of [-33, 33]) {
        ctx.beginPath();
        for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) {
          const nearNode = Math.abs(((x - CITY.roadW / 2) % CITY.pitch)) < nodeGap;
          if (nearNode) continue;
          ctx.moveTo(x, h.y + side);
          ctx.lineTo(x + 20, h.y + side);
        }
        ctx.stroke();
      }
    }

    // Lane arrows, faint, one per lane on each segment.
    for (const v of roads.verticals) {
      if (v.x < view.x - 100 || v.x > view.x + view.w + 100) continue;
      for (let j = 0; j < CITY.rows; j += 1) {
        const segY = j * CITY.pitch + CITY.roadW + CITY.blockW * 0.5;
        if (segY < view.y - 60 || segY > view.y + view.h + 60) continue;
        drawArrow(v.x + 21, segY, -Math.PI / 2, 0.24);
        drawArrow(v.x + 45, segY, -Math.PI / 2, 0.18);
        drawArrow(v.x - 21, segY + 40, Math.PI / 2, 0.24);
        drawArrow(v.x - 45, segY + 40, Math.PI / 2, 0.18);
      }
    }
    for (const h of roads.horizontals) {
      if (h.y < view.y - 100 || h.y > view.y + view.h + 100) continue;
      for (let i = 0; i < CITY.cols; i += 1) {
        const segX = i * CITY.pitch + CITY.roadW + CITY.blockW * 0.5;
        if (segX < view.x - 60 || segX > view.x + view.w + 60) continue;
        drawArrow(segX, h.y + 21, 0, 0.24);
        drawArrow(segX, h.y + 45, 0, 0.18);
        drawArrow(segX + 40, h.y - 21, Math.PI, 0.24);
        drawArrow(segX + 40, h.y - 45, Math.PI, 0.18);
      }
    }

    // Zebra crossings at every visible junction.
    for (const v of roads.verticals) {
      for (const h of roads.horizontals) {
        if (v.x < view.x - 120 || v.x > view.x + view.w + 120) continue;
        if (h.y < view.y - 120 || h.y > view.y + view.h + 120) continue;
        drawCrossings(v.x, h.y);
      }
    }
  }

  function drawArrow(x, y, angle, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(0, -2.2);
    ctx.lineTo(-12, -2.2);
    ctx.lineTo(-12, 2.2);
    ctx.lineTo(0, 2.2);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCrossings(x, y) {
    const r = CITY.roadW / 2;
    const landRight = CITY.cols * CITY.pitch + CITY.roadW;
    ctx.fillStyle = 'rgba(248,241,222,0.62)';
    for (let k = 0; k < 7; k += 1) {
      const off = -r + 10 + k * 15;
      ctx.fillRect(x + off, y - r - 20, 8, 15);
      ctx.fillRect(x + off, y + r + 5, 8, 15);
      ctx.fillRect(x - r - 20, y + off, 15, 8);
      if (x + r + 5 + 15 <= landRight) ctx.fillRect(x + r + 5, y + off, 15, 8);
    }
  }

  function drawBlocks(view, t) {
    for (const block of gameRef.world.blocks) {
      if (!visible(block.x, block.y, block.w, block.h, view)) continue;
      // Sidewalk apron.
      ctx.fillStyle = '#efe3c6';
      ctx.fillRect(block.x, block.y, block.w, block.h);
      // Kerb.
      ctx.strokeStyle = 'rgba(54,46,37,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(block.x + 1.5, block.y + 1.5, block.w - 3, block.h - 3);
      ctx.strokeStyle = 'rgba(255,248,226,0.35)';
      ctx.strokeRect(block.x + 4, block.y + 4, block.w - 8, block.h - 8);
      // Pavement joints.
      ctx.strokeStyle = 'rgba(120,104,82,0.16)';
      ctx.lineWidth = 1;
      for (let x = block.x + 24; x < block.x + block.w; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, block.y + 3);
        ctx.lineTo(x, block.y + CITY.sidewalk - 3);
        ctx.moveTo(x, block.y + block.h - CITY.sidewalk + 3);
        ctx.lineTo(x, block.y + block.h - 3);
        ctx.stroke();
      }
      for (let y = block.y + 24; y < block.y + block.h; y += 36) {
        ctx.beginPath();
        ctx.moveTo(block.x + 3, y);
        ctx.lineTo(block.x + CITY.sidewalk - 3, y);
        ctx.moveTo(block.x + block.w - CITY.sidewalk + 3, y);
        ctx.lineTo(block.x + block.w - 3, y);
        ctx.stroke();
      }
      // Lot.
      const lot = block.lot;
      ctx.fillStyle = LOT_COLORS[block.district] ?? '#d4c7ac';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      if (block.district === 'park') {
        drawPark(block, t);
      } else if (block.district === 'docks') {
        ctx.fillStyle = 'rgba(70,65,57,0.12)';
        for (let y = lot.y + 20; y < lot.y + lot.h; y += 46) ctx.fillRect(lot.x, y, lot.w, 2);
      } else if (block.district === 'downtown' || block.district === 'midtown') {
        // Paving seams and planted edges.
        ctx.strokeStyle = 'rgba(104,90,70,0.12)';
        ctx.lineWidth = 1;
        for (let x = lot.x + 34; x < lot.x + lot.w; x += 44) {
          ctx.beginPath();
          ctx.moveTo(x, lot.y);
          ctx.lineTo(x, lot.y + lot.h);
          ctx.stroke();
        }
      }
      // Lot rim shadow.
      ctx.strokeStyle = 'rgba(56,48,40,0.16)';
      ctx.lineWidth = 2;
      ctx.strokeRect(lot.x + 1, lot.y + 1, lot.w - 2, lot.h - 2);
    }
  }

  function drawPark(block, t) {
    const lot = block.lot;
    ctx.fillStyle = '#8aa66c';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    // Lawn mowing bands.
    ctx.fillStyle = 'rgba(255,248,210,0.055)';
    for (let y = lot.y; y < lot.y + lot.h; y += 40) ctx.fillRect(lot.x, y, lot.w, 18);
    // Cross paths.
    ctx.strokeStyle = '#e8d9b4';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(lot.x + lot.w * 0.12, lot.y + lot.h * 0.5);
    ctx.lineTo(lot.x + lot.w * 0.88, lot.y + lot.h * 0.5);
    ctx.moveTo(lot.x + lot.w * 0.72, lot.y + lot.h * 0.1);
    ctx.lineTo(lot.x + lot.w * 0.72, lot.y + lot.h * 0.92);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,230,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lot.x + lot.w * 0.12, lot.y + lot.h * 0.5);
    ctx.lineTo(lot.x + lot.w * 0.88, lot.y + lot.h * 0.5);
    ctx.stroke();
    // Flower beds.
    for (let k = 0; k < 5; k += 1) {
      const x = lot.x + 30 + hash2(block.i * 7, k) * (lot.w - 60);
      const y = lot.y + 30 + hash2(k, block.j * 9) * (lot.h - 60);
      ctx.fillStyle = k % 2 ? PALETTE.coralLight : '#e8c46a';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(43,92,64,0.6)';
      ctx.beginPath();
      ctx.arc(x - 4, y + 3, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- buildings ---------------------------------------------------------------------------
  function drawBuildingShadows(view) {
    for (const b of gameRef.world.buildings) {
      if (!visible(b.x - 8, b.y - 8, b.w + 60, b.h + 60, view)) continue;
      const dx = SUN.dx + b.floors * 2.1;
      const dy = SUN.dy + b.floors * 2.4;
      ctx.fillStyle = 'rgba(36,29,23,0.16)';
      roundRectPath(ctx, b.x + dx * 0.55, b.y + dy * 0.55, b.w, b.h, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(36,29,23,0.24)';
      roundRectPath(ctx, b.x + dx, b.y + dy, b.w, b.h, 4);
      ctx.fill();
    }
  }

  function drawBuildings(view, t) {
    for (const b of gameRef.world.buildings) {
      if (!visible(b.x - 60, b.y - 60, b.w + 120, b.h + 120, view)) continue;
      drawBuilding(b, t);
    }
  }

  function signRect(b) {
    const width = clamp(b.w * 0.66, 72, 190);
    if (b.face === 's') return { x: b.x + (b.w - width) / 2, y: b.y + b.h - 30, w: width, h: 22 };
    if (b.face === 'n') return { x: b.x + (b.w - width) / 2, y: b.y + 8, w: width, h: 22 };
    return { x: b.x + (b.w - width) / 2, y: b.y + b.h * 0.5 - 11, w: width, h: 22 };
  }

  function drawAwning(b) {
    if (!b.awning) return;
    const stripes = Math.max(4, Math.floor((b.w - 20) / 16));
    const col = b.awningColor;
    ctx.save();
    if (b.face === 's' || b.face === 'n') {
      const y = b.face === 's' ? b.y + b.h + 1 : b.y - 14;
      ctx.fillStyle = 'rgba(36,29,23,0.2)';
      ctx.fillRect(b.x + 8, y + 4, b.w - 16, 14);
      for (let k = 0; k < stripes; k += 1) {
        ctx.fillStyle = k % 2 ? PALETTE.cream : col;
        ctx.fillRect(b.x + 10 + k * ((b.w - 20) / stripes), y, (b.w - 20) / stripes + 0.5, 13);
      }
      ctx.strokeStyle = 'rgba(40,32,25,0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 10, y, b.w - 20, 13);
    } else {
      const x = b.face === 'e' ? b.x + b.w + 1 : b.x - 14;
      ctx.fillStyle = 'rgba(36,29,23,0.2)';
      ctx.fillRect(x + 4, b.y + 8, 13, b.h - 16);
      const rows = Math.max(4, Math.floor((b.h - 20) / 16));
      for (let k = 0; k < rows; k += 1) {
        ctx.fillStyle = k % 2 ? PALETTE.cream : col;
        ctx.fillRect(x, b.y + 10 + k * ((b.h - 20) / rows), 13, (b.h - 20) / rows + 0.5);
      }
      ctx.strokeStyle = 'rgba(40,32,25,0.28)';
      ctx.strokeRect(x, b.y + 10, 13, b.h - 20);
    }
    ctx.restore();
  }

  function drawEntrance(b, t) {
    const isV = b.face === 'n' || b.face === 's';
    const x = b.x + b.w / 2;
    const y = b.face === 's' ? b.y + b.h : b.face === 'n' ? b.y : b.y + b.h / 2;
    const ex = isV ? x : b.face === 'e' ? b.x + b.w : b.x;
    const ey = isV ? y : b.y + b.h / 2;
    const glow = ctx.createRadialGradient(ex, ey, 1, ex, ey, 26);
    glow.addColorStop(0, 'rgba(255,214,140,0.5)');
    glow.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex, ey, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b241e';
    if (isV) ctx.fillRect(ex - 12, ey - 5, 24, 10);
    else ctx.fillRect(ex - 5, ey - 12, 10, 24);
    ctx.fillStyle = 'rgba(246,206,132,0.9)';
    if (isV) ctx.fillRect(ex - 9, ey - 2.5, 18, 3.5);
    else ctx.fillRect(ex - 2.5, ey - 9, 3.5, 18);
    // Lit shop windows either side of the door.
    ctx.fillStyle = 'rgba(250,207,132,0.55)';
    for (const t of [-0.27, 0.27]) {
      if (isV) {
        const wx = b.x + b.w * (0.5 + t);
        ctx.fillRect(wx - 7, ey - 2, 14, 4);
      } else {
        const wy = b.y + b.h * (0.5 + t);
        ctx.fillRect(ex - 2, wy - 7, 4, 14);
      }
    }
  }

  function drawBuilding(b, t) {
    const roof = b.roof;
    // Entrance first (under the roof edge).
    drawEntrance(b, t);
    drawAwning(b);

    // Roof slab.
    ctx.fillStyle = roof;
    roundRectPath(ctx, b.x, b.y, b.w, b.h, 3);
    ctx.fill();
    // Parapet: lit on the north-west, ink on the shadowed sides.
    ctx.fillStyle = 'rgba(255,246,220,0.3)';
    ctx.fillRect(b.x, b.y, b.w, 4);
    ctx.fillStyle = 'rgba(40,32,25,0.22)';
    ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    ctx.fillRect(b.x + b.w - 4, b.y, 4, b.h);
    ctx.strokeStyle = b.trim;
    ctx.lineWidth = 3;
    roundRectPath(ctx, b.x + 4, b.y + 4, b.w - 8, b.h - 8, 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(50,41,32,0.3)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3, 3);
    ctx.stroke();

    // Roof tone variations (gravel, panels, stains).
    const seed = b.seed;
    if (b.floors > 4) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#fff6dc';
      for (let k = 0; k < 5; k += 1) {
        const rx = b.x + 14 + hash2(seed, k) * (b.w - 28);
        const ry = b.y + 14 + hash2(k + 3, seed) * (b.h - 28);
        ctx.fillRect(rx, ry, 20 + hash2(k, seed + 1) * 26, 2);
      }
      ctx.globalAlpha = 1;
    }

    if (b.district === 'docks') {
      ctx.strokeStyle = 'rgba(50,56,54,0.22)';
      ctx.lineWidth = 1;
      for (let x = b.x + 10; x < b.x + b.w - 6; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, b.y + 6);
        ctx.lineTo(x, b.y + b.h - 6);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(247,237,215,0.35)';
      ctx.font = `700 ${Math.min(46, b.h * 0.32)}px ${FONT.display}`;
      ctx.textAlign = 'center';
      ctx.fillText(String((b.seed % 9) + 1), b.x + b.w * 0.82, b.y + b.h * 0.72);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(120,190,185,0.25)';
      roundRectPath(ctx, b.x + b.w * 0.1, b.y + b.h * 0.12, b.w * 0.3, b.h * 0.16, 2);
      ctx.fill();
    }

    // Rooftop pool for the lucky ones.
    if (b.pool && b.w > 110 && b.h > 90) {
      const pw = b.w * 0.4;
      const ph = b.h * 0.26;
      const px = b.x + b.w * 0.5 - pw / 2;
      const py = b.y + b.h * 0.6;
      ctx.fillStyle = '#e9dcc0';
      roundRectPath(ctx, px - 5, py - 5, pw + 10, ph + 10, 7);
      ctx.fill();
      const wg = ctx.createLinearGradient(px, py, px + pw, py + ph);
      wg.addColorStop(0, '#6cc6bc');
      wg.addColorStop(1, '#2b8f92');
      ctx.fillStyle = wg;
      roundRectPath(ctx, px, py, pw, ph, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,240,0.45)';
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath();
        ctx.moveTo(px + 6, py + 6 + k * 6 + Math.sin(t * 1.4 + k) * 1.5);
        ctx.lineTo(px + pw - 8, py + 6 + k * 6 + Math.cos(t * 1.2 + k) * 1.5);
        ctx.stroke();
      }
      for (let k = 0; k < 3; k += 1) {
        ctx.fillStyle = '#f0e4c8';
        roundRectPath(ctx, px + 4 + k * (pw / 3.4), py + ph + 6, 15, 7, 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(px + 4 + k * (pw / 3.4), py + ph + 6, 4, 7);
      }
    }
    if (b.district === 'beach' && b.w > 170 && b.h > 100) {
      const dx = b.x + b.w * 0.5;
      const dy = b.y + b.h * 0.38;
      const dw = b.w * 0.46;
      const dh = b.h * 0.34;
      ctx.fillStyle = '#c9a878';
      roundRectPath(ctx, dx - dw / 2, dy - dh / 2, dw, dh, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,66,50,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx - dw / 2 + 4, dy - dh / 2 + 4, dw - 8, dh - 8);
      ctx.fillStyle = PALETTE.coral;
      ctx.beginPath();
      ctx.arc(dx - dw * 0.22, dy - dh * 0.18, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.teal;
      ctx.beginPath();
      ctx.arc(dx + dw * 0.24, dy + dh * 0.12, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6ecd8';
      ctx.fillRect(dx - dw * 0.34, dy + dh * 0.16, 16, 6);
      ctx.fillRect(dx + dw * 0.1, dy - dh * 0.3, 16, 6);
      ctx.fillStyle = 'rgba(255,246,220,0.5)';
      ctx.beginPath();
      ctx.arc(dx - dw * 0.22, dy - dh * 0.18, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.helipad && b.w > 120 && b.h > 110) {
      const cx = b.x + b.w * 0.28;
      const cy = b.y + b.h * 0.33;
      const r = Math.min(b.w, b.h) * 0.16;
      ctx.fillStyle = 'rgba(52,45,37,0.28)';
      ctx.beginPath();
      ctx.arc(cx + 4, cy + 5, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cfc6b3';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f3e8cd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.76, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#3a332a';
      ctx.font = `700 ${Math.round(r * 0.85)}px ${FONT.display}`;
      ctx.textAlign = 'center';
      ctx.fillText('H', cx, cy + r * 0.28);
      ctx.textAlign = 'left';
    }

    // Rooftop furniture.
    for (const prop of b.props) {
      drawRoofProp(prop, b);
    }

    // The name painted across the roof, faded by years of sun.
    if (b.w > 105 && b.floors >= 4) {
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, b.x + 6, b.y + 6, b.w - 12, b.h - 12, 2);
      ctx.clip();
      let paintSize = Math.min(42, (b.h - 30) * 0.42);
      ctx.font = `700 ${paintSize}px ${FONT.display}`;
      while (ctx.measureText(b.name).width > b.w * 0.78 && paintSize > 12) {
        paintSize -= 1;
        ctx.font = `700 ${paintSize}px ${FONT.display}`;
      }
      ctx.fillStyle = 'rgba(56,44,32,0.16)';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2 + 1, b.y + b.h * 0.5 + paintSize * 0.34);
      ctx.fillStyle = 'rgba(255,248,224,0.12)';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h * 0.5 + paintSize * 0.32);
      ctx.restore();
      ctx.textAlign = 'left';
    }

    // Street-facing name plate.
    const sr = signRect(b);
    ctx.fillStyle = 'rgba(34,27,21,0.24)';
    roundRectPath(ctx, sr.x + 3, sr.y + 4, sr.w, sr.h, 2);
    ctx.fill();
    const fancy = b.district === 'beach' || (b.floors >= 6 && b.seed % 3 === 0);
    ctx.fillStyle = fancy ? b.sign : PALETTE.cream;
    roundRectPath(ctx, sr.x, sr.y, sr.w, sr.h, 2);
    ctx.fill();
    ctx.fillStyle = fancy ? 'rgba(255,246,220,0.9)' : b.sign;
    ctx.fillRect(sr.x, sr.y, 4, sr.h);
    ctx.fillStyle = fancy ? '#fdf3dc' : '#241e19';
    const text = b.name;
    let fontSize = Math.min(17, sr.h * 0.74);
    ctx.font = `700 ${fontSize}px ${FONT.narrow}`;
    while (ctx.measureText(text).width > sr.w - 14 && fontSize > 7) {
      fontSize -= 0.5;
      ctx.font = `700 ${fontSize}px ${FONT.narrow}`;
    }
    ctx.textAlign = 'center';
    ctx.fillText(text, sr.x + sr.w / 2 + 2, sr.y + sr.h * 0.72);
    ctx.textAlign = 'left';
  }

  function drawRoofProp(prop, b) {
    const x = prop.x;
    const y = prop.y;
    ctx.save();
    ctx.translate(x, y);
    if (prop.rot) ctx.rotate(prop.rot);
    if (prop.type === 'ac') {
      ctx.fillStyle = 'rgba(34,28,22,0.22)';
      roundRectPath(ctx, -prop.w / 2 + 3, -prop.h / 2 + 4, prop.w, prop.h, 2);
      ctx.fill();
      ctx.fillStyle = '#b9b4a6';
      roundRectPath(ctx, -prop.w / 2, -prop.h / 2, prop.w, prop.h, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,64,55,0.5)';
      ctx.lineWidth = 1;
      for (let k = -2; k <= 2; k += 1) {
        ctx.beginPath();
        ctx.moveTo(k * 4, -prop.h / 2 + 2);
        ctx.lineTo(k * 4, prop.h / 2 - 2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,240,0.3)';
      ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, 2);
    } else if (prop.type === 'vent') {
      ctx.fillStyle = 'rgba(34,28,22,0.22)';
      ctx.beginPath();
      ctx.arc(2, 3, prop.w * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a9a294';
      ctx.beginPath();
      ctx.arc(0, 0, prop.w * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,54,46,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, prop.w * 0.24, 0, Math.PI * 2);
      ctx.stroke();
    } else if (prop.type === 'tank') {
      ctx.fillStyle = 'rgba(34,28,22,0.24)';
      ctx.beginPath();
      ctx.arc(4, 5, prop.w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b9a88b';
      ctx.beginPath();
      ctx.arc(0, 0, prop.w * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e6d9bb';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, prop.w * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(90,74,55,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-prop.w * 0.22, 0);
      ctx.lineTo(prop.w * 0.22, 0);
      ctx.stroke();
    } else if (prop.type === 'skylight') {
      ctx.fillStyle = 'rgba(34,28,22,0.2)';
      ctx.fillRect(-prop.w / 2 + 2, -prop.h / 2 + 3, prop.w, prop.h);
      ctx.fillStyle = '#7fb6b4';
      ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
      ctx.strokeStyle = '#e9dcc0';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
      ctx.fillStyle = 'rgba(255,255,250,0.3)';
      ctx.beginPath();
      ctx.moveTo(-prop.w / 2 + 2, -prop.h / 2 + 2);
      ctx.lineTo(prop.w / 2 - 4, -prop.h / 2 + 2);
      ctx.lineTo(-prop.w / 2 + 2, prop.h / 2 - 4);
      ctx.closePath();
      ctx.fill();
    } else if (prop.type === 'solar') {
      ctx.fillStyle = '#33414d';
      ctx.save();
      ctx.rotate(-0.12);
      ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
      ctx.strokeStyle = 'rgba(160,200,214,0.45)';
      ctx.lineWidth = 0.8;
      for (let k = 1; k < 4; k += 1) {
        ctx.beginPath();
        ctx.moveTo(-prop.w / 2, -prop.h / 2 + (k * prop.h) / 4);
        ctx.lineTo(prop.w / 2, -prop.h / 2 + (k * prop.h) / 4);
        ctx.stroke();
      }
      ctx.restore();
    } else if (prop.type === 'stair') {
      ctx.fillStyle = 'rgba(34,28,22,0.2)';
      ctx.fillRect(-prop.w / 2 + 2, -prop.h / 2 + 3, prop.w, prop.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
      ctx.strokeStyle = 'rgba(60,50,40,0.4)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 3; k += 1) {
        ctx.beginPath();
        ctx.moveTo(-prop.w / 2, -prop.h / 2 + (k * prop.h) / 3);
        ctx.lineTo(prop.w / 2, -prop.h / 2 + (k * prop.h) / 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- street furniture, water and palms ----------------------------------------------------
  function drawProps(view, t) {
    for (const p of gameRef.world.props) {
      if (p.x < view.x - 70 || p.x > view.x + view.w + 70 || p.y < view.y - 70 || p.y > view.y + view.h + 70) continue;
      drawProp(p, t);
    }
  }

  function drawProp(p, t) {
    ctx.save();
    ctx.translate(p.x, p.y);
    switch (p.type) {
      case 'lamp': {
        ctx.fillStyle = 'rgba(34,28,22,0.22)';
        ctx.beginPath();
        ctx.ellipse(10, 13, 5, 3.4, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f4a48';
        ctx.beginPath();
        ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3f4a48';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -11);
        ctx.stroke();
        ctx.fillStyle = '#f4e3b4';
        ctx.beginPath();
        ctx.arc(0, -12, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,224,150,0.18)';
        ctx.beginPath();
        ctx.arc(0, -12, 12, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'hydrant': {
        ctx.fillStyle = 'rgba(34,28,22,0.2)';
        ctx.beginPath();
        ctx.ellipse(3, 4, 4.4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.coral;
        ctx.beginPath();
        ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8c34a';
        ctx.fillRect(-1.2, -4.4, 2.4, 2);
        break;
      }
      case 'bin': {
        ctx.fillStyle = 'rgba(34,28,22,0.22)';
        ctx.beginPath();
        ctx.ellipse(2.5, 3, 4.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a534e';
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6d7770';
        ctx.beginPath();
        ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'bench': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(34,28,22,0.2)';
        ctx.fillRect(-10, -2, 22, 7);
        ctx.fillStyle = '#9a734a';
        ctx.fillRect(-11, -4, 22, 5);
        ctx.fillStyle = '#c39662';
        ctx.fillRect(-11, -4, 22, 1.6);
        ctx.fillStyle = '#5b4a38';
        ctx.fillRect(-9, 1, 2.4, 3);
        ctx.fillRect(7, 1, 2.4, 3);
        break;
      }
      case 'busstop': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(34,28,22,0.22)';
        ctx.fillRect(-20, -9, 44, 24);
        ctx.fillStyle = '#2e8f86';
        ctx.fillRect(-20, -12, 40, 22);
        ctx.fillStyle = '#e9dcc0';
        ctx.fillRect(-20, -12, 40, 5);
        ctx.fillStyle = 'rgba(255,255,250,0.24)';
        ctx.fillRect(-14, -6, 28, 9);
        ctx.fillStyle = '#f3e8cd';
        ctx.fillRect(-16, 6, 30, 3);
        break;
      }
      case 'planter': {
        ctx.fillStyle = 'rgba(34,28,22,0.2)';
        ctx.beginPath();
        ctx.ellipse(3, 4, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b86a4b';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4d7f57';
        ctx.beginPath();
        ctx.arc(-2, 1, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6f9c64';
        ctx.beginPath();
        ctx.arc(3, -1, 3.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'pool': {
        ctx.fillStyle = '#e9dcc0';
        roundRectPath(ctx, -p.w / 2 - 8, -p.h / 2 - 8, p.w + 16, p.h + 16, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,74,55,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-p.w / 2 - 8, -p.h / 2 - 8, p.w + 16, p.h + 16);
        ctx.fillStyle = '#5cb7ad';
        roundRectPath(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,245,0.5)';
        ctx.lineWidth = 1.3;
        for (let k = 0; k < 4; k += 1) {
          ctx.beginPath();
          ctx.moveTo(-p.w / 2 + 8, -p.h / 2 + 9 + k * 10 + Math.sin(t + k) * 1.6);
          ctx.lineTo(p.w / 2 - 8, -p.h / 2 + 9 + k * 10 + Math.cos(t + k) * 1.6);
          ctx.stroke();
        }
        ctx.strokeStyle = '#efe3c8';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(p.w / 2 - 14, -p.h / 2);
        ctx.lineTo(p.w / 2 - 14, -p.h / 2 + 10);
        ctx.moveTo(p.w / 2 - 8, -p.h / 2);
        ctx.lineTo(p.w / 2 - 8, -p.h / 2 + 10);
        ctx.stroke();
        break;
      }
      case 'lounger': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(34,28,22,0.2)';
        ctx.fillRect(-9, -3, 20, 8);
        ctx.fillStyle = '#f0e4c8';
        roundRectPath(ctx, -10, -5, 18, 8, 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(-10, -5, 4, 8);
        break;
      }
      case 'umbrella': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(34,28,22,0.2)';
        ctx.beginPath();
        ctx.arc(5, 6, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,248,224,0.5)';
        for (let k = 0; k < 6; k += 1) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 16, (k * Math.PI) / 3, (k * Math.PI) / 3 + 0.28);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#f4e8cc';
        ctx.beginPath();
        ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'dune': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = '#d9c191';
        ctx.beginPath();
        ctx.ellipse(2, 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#eddaa9';
        ctx.beginPath();
        ctx.ellipse(-3, -3, p.w / 2.6, p.h / 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,104,72,0.5)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k += 1) {
          ctx.beginPath();
          ctx.moveTo(-p.w / 3, -2 + k * 4);
          ctx.lineTo(p.w / 3, -2 + k * 4);
          ctx.stroke();
        }
        break;
      }
      case 'lifeguard': {
        ctx.fillStyle = 'rgba(34,28,22,0.22)';
        ctx.fillRect(-9, 2, 26, 16);
        ctx.fillStyle = '#efe3c6';
        ctx.fillRect(-12, -10, 24, 22);
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(-12, -10, 24, 6);
        ctx.fillStyle = '#2e8f86';
        ctx.fillRect(-12, 4, 24, 3);
        ctx.strokeStyle = 'rgba(60,50,40,0.4)';
        ctx.strokeRect(-12, -10, 24, 22);
        break;
      }
      case 'volley': {
        ctx.strokeStyle = 'rgba(245,238,220,0.65)';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(-34, -18, 68, 36);
        ctx.fillStyle = '#3f4a48';
        ctx.fillRect(-35, -19, 2.5, 38);
        ctx.fillRect(32, -19, 2.5, 38);
        break;
      }
      case 'pier': {
        ctx.fillStyle = 'rgba(30,25,20,0.2)';
        ctx.fillRect(-p.w / 2 + 4, -p.h / 2 + 6, p.w, p.h);
        ctx.fillStyle = '#b58f62';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fillStyle = 'rgba(80,58,38,0.4)';
        for (let y = -p.h / 2 + 4; y < p.h / 2; y += 8) ctx.fillRect(-p.w / 2, y, p.w, 1.4);
        break;
      }
      case 'pierhut': {
        ctx.fillStyle = 'rgba(30,25,20,0.24)';
        ctx.fillRect(-14, -6, 34, 26);
        ctx.fillStyle = '#e8d9b4';
        ctx.fillRect(-17, -10, 34, 24);
        ctx.fillStyle = PALETTE.teal;
        ctx.fillRect(-17, -10, 34, 5);
        ctx.fillStyle = '#2a231c';
        ctx.fillRect(-4, 2, 8, 12);
        break;
      }
      case 'hpier': {
        ctx.fillStyle = 'rgba(30,25,20,0.22)';
        ctx.fillRect(-p.w / 2 + 4, -20, p.w, p.h);
        ctx.fillStyle = '#a98a63';
        ctx.fillRect(-p.w / 2, -20, p.w, p.h);
        ctx.fillStyle = 'rgba(70,52,34,0.45)';
        for (let y = -16; y < p.h - 20; y += 9) ctx.fillRect(-p.w / 2, y, p.w, 1.6);
        ctx.fillStyle = '#5b4c3d';
        for (let y = 10; y < p.h - 20; y += 34) {
          ctx.beginPath();
          ctx.arc(-p.w / 2 + 3, y, 2.6, 0, Math.PI * 2);
          ctx.arc(p.w / 2 - 3, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'ship': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(18,45,50,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 10, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#39474e';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240,236,218,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w / 2 - 2, p.h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Cargo deck and containers.
        ctx.fillStyle = '#8e9189';
        roundRectPath(ctx, -p.w * 0.34, -p.h * 0.24, p.w * 0.56, p.h * 0.48, 3);
        ctx.fill();
        const colors = [PALETTE.coral, PALETTE.teal, '#c7a45a', '#527a8a', PALETTE.coralDeep];
        for (let r = 0; r < 2; r += 1) {
          for (let c = 0; c < 4; c += 1) {
            ctx.fillStyle = colors[(r * 3 + c) % colors.length];
            ctx.fillRect(-p.w * 0.31 + c * (p.w * 0.125), -p.h * 0.19 + r * (p.h * 0.22), p.w * 0.11, p.h * 0.17);
          }
        }
        // Bridge and funnel at the stern.
        ctx.fillStyle = '#f0e6d0';
        roundRectPath(ctx, -p.w * 0.46, -p.h * 0.24, p.w * 0.11, p.h * 0.48, 2);
        ctx.fill();
        ctx.fillStyle = '#32424a';
        ctx.fillRect(-p.w * 0.44, -p.h * 0.15, p.w * 0.07, p.h * 0.1);
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(-p.w * 0.39, -p.h * 0.08, p.w * 0.04, p.h * 0.16);
        ctx.fillStyle = 'rgba(255,255,245,0.5)';
        ctx.fillRect(-p.w * 0.34, p.h * 0.3, p.w * 0.62, 2);
        break;
      }
      case 'boat': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(20,50,55,0.25)';
        ctx.beginPath();
        ctx.ellipse(3, 5, 26, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 25, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,245,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(36, 0);
        ctx.stroke();
        ctx.fillStyle = '#f6ecd4';
        ctx.fillRect(-4, -6, 12, 12);
        ctx.fillStyle = '#32424a';
        ctx.fillRect(-2, -4, 8, 8);
        break;
      }
      case 'poolside': {
        ctx.fillStyle = '#efe3c6';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        break;
      }
      case 'bollard': {
        ctx.fillStyle = 'rgba(30,25,20,0.25)';
        ctx.beginPath();
        ctx.arc(3, 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#454f4e';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d8cfb9';
        ctx.beginPath();
        ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'container': {
        ctx.fillStyle = 'rgba(34,28,22,0.24)';
        ctx.fillRect(-p.w / 2 + 4, -p.h / 2 + 5, p.w, p.h);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeStyle = 'rgba(30,25,20,0.35)';
        ctx.lineWidth = 1;
        for (let x = -p.w / 2 + 5; x < p.w / 2; x += 6) {
          ctx.beginPath();
          ctx.moveTo(x, -p.h / 2 + 2);
          ctx.lineTo(x, p.h / 2 - 2);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,250,230,0.35)';
        ctx.strokeRect(-p.w / 2 + 1, -p.h / 2 + 1, p.w - 2, p.h - 2);
        break;
      }
      case 'crate': {
        ctx.fillStyle = 'rgba(34,28,22,0.22)';
        ctx.fillRect(-p.w / 2 + 3, -p.h / 2 + 4, p.w, p.h);
        ctx.fillStyle = '#b08a5c';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeStyle = '#7e6038';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(-p.w / 2 + 2, -p.h / 2 + 2, p.w - 4, p.h - 4);
        ctx.beginPath();
        ctx.moveTo(-p.w / 2 + 2, -p.h / 2 + 2);
        ctx.lineTo(p.w / 2 - 2, p.h / 2 - 2);
        ctx.stroke();
        break;
      }
      case 'crane': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(34,28,22,0.22)';
        ctx.fillRect(-30, 2, 70, 8);
        ctx.strokeStyle = '#c8b04c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(44, 0);
        ctx.moveTo(-20, 0);
        ctx.lineTo(0, -26);
        ctx.lineTo(22, 0);
        ctx.stroke();
        ctx.fillStyle = '#4a4a42';
        ctx.fillRect(-6, -6, 12, 10);
        ctx.strokeStyle = '#5a5648';
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(30, 16);
        ctx.stroke();
        ctx.fillStyle = '#d8c9a6';
        ctx.fillRect(26, 16, 8, 6);
        break;
      }
      case 'fountain': {
        ctx.fillStyle = 'rgba(34,28,22,0.22)';
        ctx.beginPath();
        ctx.arc(4, 5, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d9cdb3';
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5bb3ad';
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,245,0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 9 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#e8dcc2';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'pond': {
        ctx.fillStyle = '#6b8b5a';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx + 9, p.ry + 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4f9b8f';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240,250,236,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx - 5, p.ry - 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(247,244,222,0.5)';
        for (let k = 0; k < 5; k += 1) {
          const a = k * 1.3;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * p.rx * 0.5, Math.sin(a) * p.ry * 0.5, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'driveway': {
        ctx.fillStyle = '#cfc4ae';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeStyle = 'rgba(120,104,82,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        break;
      }
      case 'hedge': {
        ctx.fillStyle = '#5d8052';
        roundRectPath(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,250,220,0.16)';
        roundRectPath(ctx, -p.w / 2 + 3, -p.h / 2 + 2, p.w - 6, p.h - 4, 3);
        ctx.fill();
        break;
      }
      case 'dockoffice': {
        const w = p.w ?? 140;
        const h = p.h ?? 60;
        ctx.fillStyle = 'rgba(30,25,20,0.25)';
        ctx.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
        ctx.fillStyle = '#e6d9bd';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#8d9490';
        ctx.fillRect(-w / 2, -h / 2, w, 9);
        ctx.fillStyle = '#527a8a';
        for (let k = 0; k < 4; k += 1) ctx.fillRect(-w / 2 + 12 + k * 30, -h / 2 + 20, 18, 14);
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(-w / 2 + 10, h / 2 - 15, w - 20, 8);
        ctx.fillStyle = 'rgba(30,25,20,0.7)';
        ctx.font = '700 6px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HARBOR CO.', 0, h / 2 + 8);
        ctx.textAlign = 'left';
        break;
      }
      case 'docksign': {
        ctx.fillStyle = 'rgba(30,25,20,0.22)';
        ctx.fillRect(-30, -10, 66, 34);
        ctx.fillStyle = '#6d6a5f';
        ctx.fillRect(-26, -2, 4, 26);
        ctx.fillRect(22, -2, 4, 26);
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(-34, -20, 68, 22);
        ctx.strokeStyle = 'rgba(255,245,220,0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-31, -17, 62, 16);
        ctx.fillStyle = '#fff5dc';
        ctx.font = '700 8px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PIER 9', 0, -6);
        ctx.textAlign = 'left';
        break;
      }
      case 'kiosk': {
        ctx.fillStyle = 'rgba(30,25,20,0.22)';
        ctx.fillRect(-20, -8, 48, 30);
        ctx.fillStyle = '#efe1c2';
        ctx.fillRect(-24, -12, 44, 26);
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(-26, -18, 48, 8);
        ctx.fillStyle = '#7c5a3a';
        ctx.fillRect(-20, 8, 36, 5);
        ctx.fillStyle = '#2e8f86';
        ctx.fillRect(-18, -8, 8, 12);
        ctx.fillStyle = 'rgba(30,25,20,0.7)';
        ctx.font = '700 5px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('COCONUTS', 0, 18);
        ctx.textAlign = 'left';
        break;
      }
      case 'barrel': {
        ctx.fillStyle = 'rgba(30,25,20,0.22)';
        ctx.beginPath();
        ctx.ellipse(3, 4, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color ?? '#527a8a';
        ctx.beginPath();
        ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,250,230,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'forklift': {
        ctx.fillStyle = 'rgba(30,25,20,0.22)';
        ctx.fillRect(-16, -6, 34, 22);
        ctx.fillStyle = '#e0a94f';
        roundRectPath(ctx, -18, -10, 24, 20, 2);
        ctx.fill();
        ctx.fillStyle = '#3c3a34';
        ctx.fillRect(-14, -6, 14, 12);
        ctx.fillStyle = '#4a4a42';
        ctx.fillRect(6, -14, 5, 28);
        ctx.fillRect(11, -10, 14, 3);
        ctx.fillStyle = '#26221f';
        ctx.fillRect(-14, 8, 5, 4);
        ctx.fillRect(-2, 8, 5, 4);
        ctx.fillStyle = '#c4503c';
        ctx.fillRect(-18, 8, 3, 3);
        break;
      }
      case 'towel': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color ?? PALETTE.coral;
        roundRectPath(ctx, -14, -8, 28, 16, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,250,235,0.7)';
        ctx.fillRect(-14, -2, 28, 2.4);
        break;
      }
      case 'surfboard': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(30,25,20,0.18)';
        ctx.beginPath();
        ctx.ellipse(3, 3, 20, 4.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color ?? PALETTE.cream;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.teal;
        ctx.fillRect(-4, -4, 3, 8);
        break;
      }
      case 'sailboat': {
        ctx.rotate(p.rot ?? 0);
        const w = p.w ?? 110;
        const h = p.h ?? 30;
        ctx.fillStyle = 'rgba(18,45,50,0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 8, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color ?? '#f4ecd8';
        ctx.beginPath();
        ctx.moveTo(-w / 2, 0);
        ctx.quadraticCurveTo(0, h / 2, w / 2, 0);
        ctx.quadraticCurveTo(0, -h / 2, -w / 2, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,250,0.75)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(6, -2);
        ctx.lineTo(6, -h * 1.9);
        ctx.stroke();
        ctx.fillStyle = 'rgba(250,246,232,0.92)';
        ctx.beginPath();
        ctx.moveTo(8, -h * 1.85);
        ctx.lineTo(8 + w * 0.32, -h * 0.55);
        ctx.lineTo(8, -h * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.coral;
        ctx.fillRect(-w * 0.28, -1.5, w * 0.4, 3);
        break;
      }
      case 'yacht': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(18,45,50,0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 10, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4ecd8';
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, 0);
        ctx.quadraticCurveTo(0, -p.h / 2, p.w / 2, 0);
        ctx.quadraticCurveTo(0, p.h / 2, -p.w / 2, 0);
        ctx.fill();
        ctx.fillStyle = '#dfd5bd';
        ctx.beginPath();
        ctx.ellipse(-p.w * 0.1, 0, p.w * 0.26, p.h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e8f86';
        ctx.fillRect(-p.w * 0.34, -1.6, p.w * 0.6, 3.2);
        ctx.fillStyle = '#32424a';
        ctx.fillRect(p.w * 0.02, -p.h * 0.16, p.w * 0.22, p.h * 0.32);
        ctx.strokeStyle = 'rgba(255,255,245,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-p.w / 2 - 8, 0);
        ctx.lineTo(-p.w / 2 - 34, 0);
        ctx.stroke();
        break;
      }
      case 'jetski': {
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = 'rgba(20,50,55,0.3)';
        ctx.beginPath();
        ctx.ellipse(2, 3, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color ?? PALETTE.coral;
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 4.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4ecd8';
        ctx.fillRect(-3, -2, 6, 4);
        ctx.strokeStyle = 'rgba(255,255,245,0.7)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-32, 0);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  function drawPalms(view, t) {
    for (const palm of gameRef.world.palms) {
      if (palm.x < view.x - 90 || palm.x > view.x + view.w + 90 || palm.y < view.y - 110 || palm.y > view.y + view.h + 90) continue;
      drawPalm(palm, t);
    }
  }

  function drawPalm(palm, t) {
    const size = palm.size;
    const sway = Math.sin(t * 0.9 + palm.phase) * 0.1 + palm.lean;
    const crownX = palm.x + Math.sin(sway) * 6 * size;
    const crownY = palm.y - 7 * size;
    const r = 15 * size;
    ctx.fillStyle = 'rgba(30,25,20,0.2)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 9 * size, palm.y + 11 * size, 13 * size, 6.4 * size, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#84643f';
    ctx.lineWidth = 3.6 * size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y + 3 * size);
    ctx.quadraticCurveTo(palm.x + sway * 10, palm.y - 4 * size, crownX, crownY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,238,196,0.28)';
    ctx.lineWidth = 1.1 * size;
    ctx.beginPath();
    ctx.moveTo(palm.x - 1, palm.y + 1);
    ctx.quadraticCurveTo(palm.x + sway * 9, palm.y - 4 * size, crownX - 1, crownY);
    ctx.stroke();
    const fronds = 8;
    for (let k = 0; k < fronds; k += 1) {
      const a = (k / fronds) * Math.PI * 2 + sway * 1.4 + 0.2;
      const len = r * (0.95 + (k % 3) * 0.09);
      const tipX = crownX + Math.cos(a) * len;
      const tipY = crownY + Math.sin(a) * len * 0.92;
      const px = -Math.sin(a) * 4.2 * size;
      const py = Math.cos(a) * 3.2 * size;
      ctx.fillStyle = k % 2 ? '#2c5a41' : '#3f7450';
      ctx.beginPath();
      ctx.moveTo(crownX, crownY);
      ctx.quadraticCurveTo(crownX + Math.cos(a) * len * 0.5 + px, crownY + Math.sin(a) * len * 0.5 + py, tipX, tipY);
      ctx.quadraticCurveTo(crownX + Math.cos(a) * len * 0.5 - px * 0.6, crownY + Math.sin(a) * len * 0.5 - py * 0.6, crownX, crownY);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,48,32,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(170,200,140,0.45)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(crownX + Math.cos(a) * 3, crownY + Math.sin(a) * 3);
      ctx.lineTo(crownX + Math.cos(a) * len * 0.82, crownY + Math.sin(a) * len * 0.82);
      ctx.stroke();
    }
    ctx.fillStyle = '#52703d';
    ctx.beginPath();
    ctx.arc(crownX, crownY, 3.2 * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#45331f';
    for (let k = 0; k < 3; k += 1) {
      const a = (k / 3) * Math.PI * 2 + 0.6;
      ctx.beginPath();
      ctx.arc(crownX + Math.cos(a) * 4.4 * size, crownY + Math.sin(a) * 4.4 * size, 1.7 * size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- vehicles and people ------------------------------------------------------------------
  function drawVehicles(view, t) {
    for (const car of gameRef.vehicles) {
      if (car.removed || car.exploded) continue;
      if (car.x < view.x - 80 || car.x > view.x + view.w + 80 || car.y < view.y - 80 || car.y > view.y + view.h + 80) continue;
      drawVehicle(car, t);
    }
  }

  function drawVehicle(car, t) {
    const L = car.length;
    const W = car.width;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(30,25,20,0.24)';
    roundRectPath(ctx, -L / 2 + SUN.dx * 0.55, -W / 2 + SUN.dy * 0.55, L, W, 5);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    roundRectPath(ctx, -L / 2, -W / 2, L, W, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,25,20,0.4)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, -L / 2, -W / 2, L, W, 5);
    ctx.stroke();
    // Bonnet and boot shading.
    ctx.fillStyle = 'rgba(255,250,235,0.16)';
    roundRectPath(ctx, -L * 0.46, -W * 0.36, L * 0.26, W * 0.72, 3);
    ctx.fill();
    // Cabin.
    ctx.fillStyle = car.police ? '#26323c' : 'rgba(28,24,21,0.55)';
    roundRectPath(ctx, -L * 0.2, -W * 0.38, L * 0.42, W * 0.76, 4);
    ctx.fill();
    // Windscreen and rear glass.
    ctx.fillStyle = 'rgba(150,206,202,0.7)';
    roundRectPath(ctx, L * 0.1, -W * 0.32, L * 0.12, W * 0.64, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,170,168,0.55)';
    roundRectPath(ctx, -L * 0.34, -W * 0.3, L * 0.08, W * 0.6, 2);
    ctx.fill();
    // Roof highlight.
    ctx.fillStyle = 'rgba(255,255,240,0.12)';
    roundRectPath(ctx, -L * 0.13, -W * 0.3, L * 0.2, W * 0.12, 2);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#26221f';
    for (const sx of [-L * 0.3, L * 0.27]) {
      ctx.fillRect(sx, -W / 2 - 1.6, 8, 4);
      ctx.fillRect(sx, W / 2 - 2.4, 8, 4);
    }
    // Lights.
    ctx.fillStyle = '#f7e9b8';
    ctx.fillRect(L / 2 - 3, -W * 0.34, 3, 4);
    ctx.fillRect(L / 2 - 3, W * 0.34 - 4, 3, 4);
    ctx.fillStyle = '#c4503c';
    ctx.fillRect(-L / 2, -W * 0.34, 2.5, 4);
    ctx.fillRect(-L / 2, W * 0.34 - 4, 2.5, 4);
    if (car.police) {
      ctx.fillStyle = '#26323c';
      ctx.fillRect(-L * 0.16, -W / 2 + 1.5, L * 0.32, W * 0.22);
      ctx.fillRect(-L * 0.16, W / 2 - W * 0.22 - 1.5, L * 0.32, W * 0.22);
      ctx.fillStyle = '#2e8f86';
      ctx.fillRect(-L * 0.16, -W / 2 + 2.6, L * 0.32, 2.2);
      ctx.fillRect(-L * 0.16, W / 2 - 4.8, L * 0.32, 2.2);
      const flash = Math.floor(t * 8 + car.id) % 2 === 0;
      ctx.fillStyle = car.siren ? (flash ? '#ef6a5a' : '#5a8fd0') : '#5a8fd0';
      roundRectPath(ctx, -5, -W * 0.32, 10, W * 0.64, 2);
      ctx.fill();
      ctx.fillStyle = car.siren && !flash ? '#e05a5a' : '#3f6fa8';
      ctx.fillRect(-5, 0, 10, W * 0.32);
      if (car.siren) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = flash ? '#f36a5a' : '#6aa0e0';
        ctx.beginPath();
        ctx.arc(0, 0, W * 1.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (car.taxi) {
      ctx.fillStyle = '#f0d58a';
      ctx.fillRect(-4, -3, 9, 6);
      ctx.fillStyle = '#2a241e';
      ctx.fillRect(-2, -1.4, 5, 2.8);
    }
    if (car.health < car.maxHealth * 0.6) {
      ctx.fillStyle = 'rgba(45,36,28,0.5)';
      ctx.beginPath();
      ctx.arc(-L * 0.1, W * 0.16, 4.4, 0, Math.PI * 2);
      ctx.arc(L * 0.16, -W * 0.2, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.hitFlash > 0) {
      ctx.globalAlpha = car.hitFlash * 0.35;
      ctx.fillStyle = '#ffffff';
      roundRectPath(ctx, -L / 2, -W / 2, L, W, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawPeople(view, t) {
    const game = gameRef;
    for (const person of game.pedestrians?.people ?? []) {
      if (person.x < view.x - 40 || person.x > view.x + view.w + 40 || person.y < view.y - 40 || person.y > view.y + view.h + 40) continue;
      drawPerson(ctx, person, t);
    }
    for (const cop of game.police?.cops ?? []) {
      if (cop.removed) continue;
      if (cop.x < view.x - 40 || cop.x > view.x + view.w + 40 || cop.y < view.y - 40 || cop.y > view.y + view.h + 40) continue;
      drawPerson(ctx, cop, t);
    }
    for (const enemy of game.enemies ?? []) {
      if (enemy.x < view.x - 40 || enemy.x > view.x + view.w + 40 || enemy.y < view.y - 40 || enemy.y > view.y + view.h + 40) continue;
      drawPerson(ctx, enemy, t);
      if (enemy.boss && !enemy.dead) {
        ctx.fillStyle = 'rgba(28,22,18,0.7)';
        ctx.font = '700 10px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VARGAS', enemy.x, enemy.y - 18);
        ctx.textAlign = 'left';
      }
    }
    const p = game.player;
    if (p && p.mode === 'foot' && !p.dead && !p.busted) {
      ctx.save();
      ctx.strokeStyle = 'rgba(247,237,215,0.6)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 3, 14, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      const look = {
        ...p,
        x: p.x,
        y: p.y,
        angle: p.aimBlend > 0.5 ? p.aim : p.angle,
        skin: PLAYER_LOOK.skin,
        hair: PLAYER_LOOK.hair,
        shirt: PLAYER_LOOK.shirt,
        pants: PLAYER_LOOK.pants,
        kind: 'player',
        armed: p.weapon !== 'fists',
        hat: null,
        walk: p.walk,
        phase: p.phase,
        hurtFlash: p.hurtFlash,
      };
      drawPerson(ctx, look, t);
      // A small coral collar so Ray reads apart from the crowd.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(look.angle);
      ctx.fillStyle = PLAYER_LOOK.accent;
      ctx.fillRect(-2.5, -2.2, 3, 4.4);
      ctx.restore();
    }
  }

  // ---- markers, helicopter, weather ---------------------------------------------------------
  function drawPickups(view, t) {
    const pickups = gameRef.combat?.pickups ?? [];
    for (const pick of pickups) {
      if (pick.x < view.x - 40 || pick.x > view.x + view.w + 40 || pick.y < view.y - 40 || pick.y > view.y + view.h + 40) continue;
      const bob = Math.sin(t * 2.4 + (pick.bob ?? 0)) * 2;
      ctx.save();
      ctx.translate(pick.x, pick.y + bob);
      ctx.fillStyle = 'rgba(30,25,20,0.2)';
      ctx.beginPath();
      ctx.ellipse(2, 10, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pick.type === 'cash') {
        ctx.rotate(pick.rot ?? 0);
        ctx.fillStyle = '#d9c98f';
        roundRectPath(ctx, -8, -5, 16, 10, 1.5);
        ctx.fill();
        ctx.fillStyle = '#5c7a4f';
        ctx.fillRect(-6, -3, 12, 2);
        ctx.fillStyle = '#3a4a32';
        ctx.font = '700 7px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 4);
      } else if (pick.type === 'health') {
        ctx.fillStyle = '#f0e6cf';
        roundRectPath(ctx, -8, -8, 16, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#b34a37';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-6, -2, 12, 4);
      } else if (pick.type === 'armour') {
        ctx.fillStyle = '#6f9db8';
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, -5);
        ctx.lineTo(7, 4);
        ctx.lineTo(0, 9);
        ctx.lineTo(-7, 4);
        ctx.lineTo(-8, -5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,250,235,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#3b382f';
        roundRectPath(ctx, -7, -5, 14, 10, 2);
        ctx.fill();
        ctx.fillStyle = '#f0c96a';
        ctx.fillRect(-4, -2, 8, 4);
      }
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  function drawBullets(view) {
    const bullets = gameRef.combat?.bullets ?? [];
    ctx.lineCap = 'round';
    for (const b of bullets) {
      if (b.x < view.x || b.x > view.x + view.w || b.y < view.y || b.y > view.y + view.h) continue;
      const tx = b.x - b.vx * 0.022;
      const ty = b.y - b.vy * 0.022;
      ctx.strokeStyle = b.owner === 'player' ? 'rgba(255,222,150,0.22)' : 'rgba(255,210,150,0.2)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = b.owner === 'player' ? 'rgba(255,236,178,0.95)' : 'rgba(255,214,150,0.9)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,247,220,0.9)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarkers(view, t) {
    const marker = gameRef.missions?.marker;
    if (!marker) return;
    if (marker.x < view.x - 80 || marker.x > view.x + view.w + 80 || marker.y < view.y - 80 || marker.y > view.y + view.h + 80) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    ctx.save();
    ctx.translate(marker.x, marker.y);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
    glow.addColorStop(0, 'rgba(235,120,90,0.3)');
    glow.addColorStop(1, 'rgba(235,120,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(240,201,106,${0.55 + pulse * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([9, 8]);
    ctx.lineDashOffset = -t * 16;
    ctx.beginPath();
    ctx.arc(0, 0, 27 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = PALETTE.coral;
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#f7edd7';
    ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
    ctx.restore();
    ctx.font = `700 11px ${FONT.narrow}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(28,23,19,0.76)';
    ctx.strokeText(marker.label ?? 'OBJECTIVE', 0, -38);
    ctx.fillStyle = '#fff2cf';
    ctx.fillText(marker.label ?? 'OBJECTIVE', 0, -38);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawSpotlight(heli) {
    if (!heli) return;
    const g = ctx.createRadialGradient(heli.x, heli.y, 4, heli.x, heli.y, 130);
    g.addColorStop(0, 'rgba(255,244,200,0.28)');
    g.addColorStop(0.55, 'rgba(255,236,178,0.11)');
    g.addColorStop(1, 'rgba(255,236,178,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(heli.x, heli.y, 130, 86, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHelicopter(heli, t) {
    if (!heli) return;
    const x = heli.x;
    const y = heli.y - 42;
    // Ground shadow far below.
    ctx.fillStyle = 'rgba(25,20,16,0.24)';
    ctx.beginPath();
    ctx.ellipse(x + 30, y + 52, 24, 10, heli.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heli.orbit + Math.PI / 2);
    // Tail.
    ctx.strokeStyle = '#2f3a3c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-40, 0);
    ctx.stroke();
    ctx.fillStyle = '#e8c34a';
    ctx.beginPath();
    ctx.arc(-40, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = '#31414a';
    roundRectPath(ctx, -18, -9, 36, 18, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.25)';
    roundRectPath(ctx, -14, -7, 20, 5, 3);
    ctx.fill();
    ctx.fillStyle = '#7fb6b4';
    ctx.beginPath();
    ctx.arc(9, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    // Skids.
    ctx.strokeStyle = '#202a2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.lineTo(12, -12);
    ctx.moveTo(-14, 12);
    ctx.lineTo(12, 12);
    ctx.stroke();
    // Rotor blur.
    ctx.strokeStyle = 'rgba(230,224,200,0.5)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k += 1) {
      const a = heli.rotor + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(240,230,205,0.22)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawScreenLight() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // The sun's wash from the north-west.
    const wash = ctx.createRadialGradient(w * 0.14, h * 0.02, 30, w * 0.3, h * 0.3, Math.max(w, h) * 1.05);
    wash.addColorStop(0, 'rgba(255,206,138,0.2)');
    wash.addColorStop(0.4, 'rgba(255,190,120,0.09)');
    wash.addColorStop(1, 'rgba(255,180,100,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,180,105,0.05)';
    ctx.fillRect(0, 0, w, h);
    // A couple of long light rays.
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffe5b0';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.52, 0);
    ctx.lineTo(w * 0.2, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.24, 0);
    ctx.lineTo(w * 0.08, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Vignette.
    const vig = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.25, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(40,26,18,0)');
    vig.addColorStop(0.72, 'rgba(40,26,18,0.12)');
    vig.addColorStop(1, 'rgba(30,18,12,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  let gameRef = null;

  function draw(game, shotTime) {
    gameRef = game;
    time = shotTime ?? game.time ?? 0;
    const t = time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2e7f82';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    game.camera.apply(ctx);
    const view = game.camera.view(160);

    // Land base.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    drawOcean(view, t);
    drawHarbor(view, t);
    drawSandDetails(view, t);
    drawBlocks(view, t);
    drawRoads(view, t);
    drawBuildingShadows(view);
    drawProps(view, t);
    effectsRef?.drawGround(ctx, view);
    drawBuildings(view, t);
    drawPalms(view, t);
    drawMarkers(view, t);
    drawVehicles(view, t);
    drawPeople(view, t);
    drawPickups(view, t);
    drawBullets(view);
    effectsRef?.drawAir(ctx, view);
    if (game.police?.heli) {
      const heli = game.police.heli;
      drawSpotlight({ x: heli.x, y: heli.y });
      drawHelicopter(heli, t);
    }
    drawScreenLight();
  }

  let effectsRef = null;
  function attach(game) {
    effectsRef = game.effects;
  }

  return { draw, attach, resize, get ctx() { return ctx; } };
}
