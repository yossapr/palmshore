// Drawing: the sun-bleached city, its cars and people, and the effects on top. Everything is
// Canvas 2D paths, no images. The renderer culls to the camera, paints ground, road markings,
// buildings with long afternoon shadows, palms, props, entities and particles, then a warm light
// wash and vignette that hold the limited palette together.

import { PALETTE, FONT, DISTRICTS, WORLD } from './config.js';
import { ROAD_HALF, VX, HY, BLOCK_INSET } from './roads.js';
import { clamp, roundRect } from './math.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = window.innerWidth;
  let height = window.innerHeight;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw(game) {
    const camera = game.camera;
    const bounds = camera.bounds;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width / 2 + camera.shakeX, height / 2 + camera.shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    drawGround(game, bounds);
    drawRoads(game, bounds);
    drawRoadMarkings(game, bounds);
    drawBlocks(game, bounds);
    drawPark(game, bounds);
    drawScorches(game, bounds);
    drawSkidMarks(game, bounds);
    drawMarkers(game, bounds);
    drawPickups(game, bounds);
    drawPalms(game, bounds);
    drawProps(game, bounds);
    drawVehicles(game, bounds);
    drawPeople(game, bounds);
    drawBullets(game);
    drawHeli(game);
    drawParticles(game);
    ctx.restore();
    drawLightWash(game);
    drawHudOverlays(game, width, height);
  }

  function inView(bounds, x, y, margin = 60) {
    return x > bounds.x0 - margin && x < bounds.x1 + margin && y > bounds.y0 - margin && y < bounds.y1 + margin;
  }

  function rectInView(bounds, x, y, w, h) {
    return x + w > bounds.x0 && x < bounds.x1 && y + h > bounds.y0 && y < bounds.y1;
  }

  function drawGround(game, bounds) {
    const world = game.world;
    ctx.fillStyle = '#c3b28f';
    ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
    // The sea: broad bands of colour and moving crests, no photographs.
    const seaX = world.waterX;
    if (bounds.x1 > seaX) {
      const gradient = ctx.createLinearGradient(seaX, 0, world.width + 200, 0);
      gradient.addColorStop(0, '#4f9fa7');
      gradient.addColorStop(0.35, PALETTE.sea);
      gradient.addColorStop(1, PALETTE.seaDeep);
      ctx.fillStyle = gradient;
      ctx.fillRect(seaX, bounds.y0, bounds.x1 - seaX + 60, bounds.y1 - bounds.y0);
      ctx.strokeStyle = 'rgba(232,249,242,0.6)';
      ctx.lineWidth = 2;
      const startY = Math.floor(bounds.y0 / 26) * 26;
      for (let y = startY; y < bounds.y1; y += 26) {
        const drift = Math.sin(y * 0.02 + game.time * 0.6) * 22 + game.time * 9;
        const startX = Math.max(seaX + 14, bounds.x0);
        for (let x = Math.floor(startX / 70) * 70 + (drift % 70); x < bounds.x1; x += 70) {
          const wave = 10 + Math.sin(y * 0.05 + x * 0.03 + game.time) * 5;
          ctx.globalAlpha = 0.22 + (Math.sin(x * 0.02 + y + game.time * 1.3) + 1) * 0.16;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + wave * 0.5, y - 3, x + wave, y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      // Shore foam.
      ctx.strokeStyle = 'rgba(235,249,240,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const startY2 = Math.floor(bounds.y0 / 30) * 30;
      for (let y = startY2; y <= bounds.y1; y += 30) {
        const x = seaX + Math.sin(y * 0.03 + game.time * 0.9) * 5;
        if (y === startY2) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      for (let y = startY2; y <= bounds.y1; y += 30) {
        const x = seaX - 8 + Math.sin(y * 0.03 + game.time * 0.9) * 4;
        if (y === startY2) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Sand.
    if (bounds.x1 > world.sandX && bounds.x0 < seaX) {
      const x0 = Math.max(world.sandX, bounds.x0);
      const x1 = Math.min(seaX, bounds.x1);
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(x0, bounds.y0, x1 - x0, bounds.y1 - bounds.y0);
      ctx.fillStyle = PALETTE.sandDark;
      const startY = Math.floor(bounds.y0 / 34) * 34;
      for (let y = startY; y < bounds.y1; y += 34) {
        for (let x = Math.floor(x0 / 34) * 34; x < x1; x += 34) {
          const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          if (hash - Math.floor(hash) > 0.7) ctx.fillRect(x + 5, y + 7, 2, 2);
        }
      }
      // Dune lines.
      ctx.strokeStyle = 'rgba(196,166,112,0.4)';
      ctx.lineWidth = 2;
      for (let y = startY; y < bounds.y1; y += 96) {
        ctx.beginPath();
        ctx.moveTo(Math.max(x0, world.sandX + 20), y);
        ctx.quadraticCurveTo((x0 + x1) / 2, y + 16, x1 - 20, y + 4);
        ctx.stroke();
      }
    }
    // The pier planks are drawn as a prop but the water under them needs a base.
    if (bounds.x0 < seaX + 250 && bounds.y1 > 2780) {
      ctx.fillStyle = '#9d815a';
      ctx.fillRect(4056, 2838, 240, 44);
      ctx.fillStyle = 'rgba(62,47,32,0.25)';
      for (let x = 4060; x < 4290; x += 16) ctx.fillRect(x, 2840, 2, 40);
    }
  }

  function drawRoads(game, bounds) {
    const world = game.world;
    ctx.fillStyle = PALETTE.asphalt;
    for (const y of HY) {
      if (y + ROAD_HALF > bounds.y0 && y - ROAD_HALF < bounds.y1) {
        ctx.fillRect(bounds.x0, y - ROAD_HALF, bounds.x1 - bounds.x0, ROAD_HALF * 2);
      }
    }
    for (const x of VX) {
      if (x + ROAD_HALF > bounds.x0 && x - ROAD_HALF < bounds.x1) {
        ctx.fillRect(x - ROAD_HALF, bounds.y0, ROAD_HALF * 2, bounds.y1 - bounds.y0);
      }
    }
    // Slightly different tone down the centre of each carriageway: tar seams and wear.
    ctx.fillStyle = 'rgba(255,238,205,0.035)';
    for (const y of HY) {
      if (y + ROAD_HALF > bounds.y0 && y - ROAD_HALF < bounds.y1) ctx.fillRect(bounds.x0, y - ROAD_HALF + 4, bounds.x1 - bounds.x0, 9);
    }
    for (const x of VX) {
      if (x + ROAD_HALF > bounds.x0 && x - ROAD_HALF < bounds.x1) ctx.fillRect(x - ROAD_HALF + 4, bounds.y0, 9, bounds.y1 - bounds.y0);
    }
    // Kerb lines.
    ctx.strokeStyle = PALETTE.curb;
    ctx.lineWidth = 3;
    for (const y of HY) {
      if (y + ROAD_HALF > bounds.y0 && y - ROAD_HALF < bounds.y1) {
        ctx.beginPath();
        ctx.moveTo(bounds.x0, y - ROAD_HALF);
        ctx.lineTo(bounds.x1, y - ROAD_HALF);
        ctx.moveTo(bounds.x0, y + ROAD_HALF);
        ctx.lineTo(bounds.x1, y + ROAD_HALF);
        ctx.stroke();
      }
    }
    for (const x of VX) {
      if (x + ROAD_HALF > bounds.x0 && x - ROAD_HALF < bounds.x1) {
        ctx.beginPath();
        ctx.moveTo(x - ROAD_HALF, bounds.y0);
        ctx.lineTo(x - ROAD_HALF, bounds.y1);
        ctx.moveTo(x + ROAD_HALF, bounds.y0);
        ctx.lineTo(x + ROAD_HALF, bounds.y1);
        ctx.stroke();
      }
    }
    // Crosswalks at every junction.
    ctx.fillStyle = 'rgba(240,230,207,0.62)';
    for (const node of world.intersections) {
      if (!inView(bounds, node.x, node.y, 120)) continue;
      for (const dir of [-1, 1]) {
        const bx = node.x + dir * (ROAD_HALF + 18);
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(bx - 6, node.y + i * 14 - 4, 12, 8);
        }
        const by = node.y + dir * (ROAD_HALF + 18);
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(node.x + i * 14 - 4, by - 6, 8, 12);
        }
      }
    }
  }

  function drawRoadMarkings(game, bounds) {
    ctx.save();
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([22, 26]);
    ctx.globalAlpha = 0.62;
    for (const y of HY) {
      if (y + ROAD_HALF > bounds.y0 && y - ROAD_HALF < bounds.y1) {
        ctx.beginPath();
        ctx.moveTo(bounds.x0, y);
        ctx.lineTo(bounds.x1, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(bounds.x0, y - ROAD_HALF + 9);
        ctx.lineTo(bounds.x1, y - ROAD_HALF + 9);
        ctx.moveTo(bounds.x0, y + ROAD_HALF - 9);
        ctx.lineTo(bounds.x1, y + ROAD_HALF - 9);
        ctx.stroke();
        ctx.setLineDash([22, 26]);
      }
    }
    for (const x of VX) {
      if (x + ROAD_HALF > bounds.x0 && x - ROAD_HALF < bounds.x1) {
        ctx.beginPath();
        ctx.moveTo(x, bounds.y0);
        ctx.lineTo(x, bounds.y1);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x - ROAD_HALF + 9, bounds.y0);
        ctx.lineTo(x - ROAD_HALF + 9, bounds.y1);
        ctx.moveTo(x + ROAD_HALF - 9, bounds.y0);
        ctx.lineTo(x + ROAD_HALF - 9, bounds.y1);
        ctx.stroke();
        ctx.setLineDash([22, 26]);
      }
    }
    ctx.restore();
    // A few worn arrows on the boulevards.
    ctx.fillStyle = 'rgba(236,225,198,0.5)';
    for (const y of HY) {
      for (let x = 420; x < game.world.waterX; x += 340) {
        if (!inView(bounds, x, y, 40)) continue;
        for (const dir of [-1, 1]) {
          const ay = y + dir * 27;
          ctx.save();
          ctx.translate(x, ay);
          if (dir < 0) ctx.rotate(Math.PI);
          ctx.beginPath();
          ctx.moveTo(0, -9);
          ctx.lineTo(7, 3);
          ctx.lineTo(2, 3);
          ctx.lineTo(2, 10);
          ctx.lineTo(-2, 10);
          ctx.lineTo(-2, 3);
          ctx.lineTo(-7, 3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  function drawBlocks(game, bounds) {
    for (const block of game.world.blocks) {
      if (!rectInView(bounds, block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0)) continue;
      const district = DISTRICTS[block.district];
      const inset = BLOCK_INSET;
      // Sidewalk band.
      ctx.fillStyle = PALETTE.walk;
      ctx.fillRect(block.x0 + ROAD_HALF, block.y0 + ROAD_HALF, block.x1 - block.x0 - ROAD_HALF * 2, block.y1 - block.y0 - ROAD_HALF * 2);
      ctx.strokeStyle = PALETTE.walkEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x0 + ROAD_HALF, block.y0 + ROAD_HALF, block.x1 - block.x0 - ROAD_HALF * 2, block.y1 - block.y0 - ROAD_HALF * 2);
      // Pavement joints.
      ctx.strokeStyle = 'rgba(150,132,102,0.22)';
      ctx.lineWidth = 1;
      for (let x = block.x0 + ROAD_HALF; x < block.x1 - ROAD_HALF; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, block.y0 + ROAD_HALF);
        ctx.lineTo(x, block.y0 + inset);
        ctx.moveTo(x, block.y1 - inset);
        ctx.lineTo(x, block.y1 - ROAD_HALF);
        ctx.stroke();
      }
      for (let y = block.y0 + ROAD_HALF; y < block.y1 - ROAD_HALF; y += 42) {
        ctx.beginPath();
        ctx.moveTo(block.x0 + ROAD_HALF, y);
        ctx.lineTo(block.x0 + inset, y);
        ctx.moveTo(block.x1 - inset, y);
        ctx.lineTo(block.x1 - ROAD_HALF, y);
        ctx.stroke();
      }
      // Block ground.
      ctx.fillStyle = district.ground;
      ctx.fillRect(block.x0 + inset, block.y0 + inset, block.x1 - block.x0 - inset * 2, block.y1 - block.y0 - inset * 2);
      ctx.strokeStyle = 'rgba(90,74,52,0.18)';
      ctx.strokeRect(block.x0 + inset, block.y0 + inset, block.x1 - block.x0 - inset * 2, block.y1 - block.y0 - inset * 2);
      if (block.district === 'suburb') {
        ctx.fillStyle = 'rgba(110,134,74,0.35)';
        ctx.fillRect(block.x0 + inset, block.y0 + inset, block.x1 - block.x0 - inset * 2, block.y1 - block.y0 - inset * 2);
      }
      if (block.district === 'park') {
        ctx.fillStyle = PALETTE.grass;
        ctx.fillRect(block.x0 + inset, block.y0 + inset, block.x1 - block.x0 - inset * 2, block.y1 - block.y0 - inset * 2);
      }
    }
    // Parking lots sit on top of block ground.
    for (const lot of game.world.lots) {
      if (!rectInView(bounds, lot.x, lot.y, lot.w, lot.h)) continue;
      ctx.fillStyle = '#55524a';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(238,228,204,0.4)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 20; x < lot.x + lot.w; x += 56) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 12);
        ctx.lineTo(x, lot.y + lot.h - 12);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(40,36,30,0.4)';
      ctx.strokeRect(lot.x, lot.y, lot.w, lot.h);
    }
    for (const building of game.world.buildings) {
      if (!rectInView(bounds, building.x, building.y, building.w, building.h)) continue;
      drawBuilding(building);
    }
  }

  function drawBuilding(b) {
    // Afternoon shadow, thrown south-east.
    ctx.fillStyle = 'rgba(74,56,36,0.24)';
    ctx.fillRect(b.x + 13, b.y + 17, b.w, b.h);
    ctx.fillStyle = 'rgba(74,56,36,0.12)';
    ctx.fillRect(b.x + 24, b.y + 30, b.w, b.h);
    // Base and roof.
    const gradient = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    gradient.addColorStop(0, b.light);
    gradient.addColorStop(1, b.roof);
    ctx.fillStyle = gradient;
    roundRect(ctx, b.x, b.y, b.w, b.h, b.style === 'house' ? 5 : 3);
    ctx.fill();
    ctx.strokeStyle = b.edge;
    ctx.lineWidth = 3;
    ctx.stroke();
    // Parapet.
    ctx.strokeStyle = 'rgba(255,247,228,0.28)';
    ctx.lineWidth = 2;
    roundRect(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 2);
    ctx.stroke();
    if (b.style === 'tower') {
      ctx.fillStyle = 'rgba(92,132,142,0.22)';
      for (let x = b.x + 14; x < b.x + b.w - 12; x += 26) {
        ctx.fillRect(x, b.y + 13, 12, b.h - 26);
      }
      ctx.fillStyle = 'rgba(240,246,238,0.16)';
      for (let x = b.x + 20; x < b.x + b.w - 12; x += 52) {
        ctx.fillRect(x, b.y + 18, 4, b.h - 36);
      }
      if (b.w > 200) {
        ctx.fillStyle = 'rgba(60,74,78,0.55)';
        ctx.fillRect(b.x + b.w * 0.5 - 20, b.y + b.h * 0.5 - 20, 40, 40);
        ctx.strokeStyle = 'rgba(240,244,236,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x + b.w * 0.5, b.y + b.h * 0.5, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.5 - 8, b.y + b.h * 0.5);
        ctx.lineTo(b.x + b.w * 0.5 + 8, b.y + b.h * 0.5);
        ctx.moveTo(b.x + b.w * 0.5, b.y + b.h * 0.5 - 8);
        ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.5 + 8);
        ctx.stroke();
      }
    } else if (b.style === 'house') {
      ctx.strokeStyle = 'rgba(74,52,40,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + 8, b.y + b.h * 0.45);
      ctx.lineTo(b.x + b.w - 8, b.y + b.h * 0.45);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,244,220,0.16)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h * 0.36);
    } else if (b.style === 'warehouse') {
      ctx.strokeStyle = 'rgba(46,52,46,0.22)';
      ctx.lineWidth = 2;
      for (let y = b.y + 14; y < b.y + b.h - 10; y += 18) {
        ctx.beginPath();
        ctx.moveTo(b.x + 8, y);
        ctx.lineTo(b.x + b.w - 8, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(235,224,200,0.3)';
      ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.55, b.w * 0.2, b.h * 0.22);
      // Skylight strip and a roof hatch break up the long dock roofs.
      const sx = b.x + b.w * 0.56;
      const sy = b.y + b.h * 0.6;
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = 'rgba(22,30,32,0.45)';
        ctx.fillRect(sx + i * 40 + 2, sy + 3, 30, 22);
        ctx.fillStyle = 'rgba(126,174,180,0.7)';
        ctx.fillRect(sx + i * 40, sy, 30, 22);
        ctx.strokeStyle = 'rgba(246,238,218,0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx + i * 40, sy, 30, 22);
        ctx.fillStyle = 'rgba(248,242,224,0.3)';
        ctx.fillRect(sx + i * 40 + 4, sy + 4, 9, 14);
      }
      ctx.fillStyle = 'rgba(52,46,38,0.6)';
      roundRect(ctx, b.x + b.w * 0.12, b.y + b.h * 0.2, 28, 22, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(226,214,190,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const bay = (Math.floor(b.x / 90) + Math.floor(b.y / 90)) % 9 + 1;
      ctx.fillStyle = 'rgba(250,242,222,0.35)';
      ctx.font = `800 20px ${FONT.display}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`BAY ${bay}`, b.x + b.w * 0.32, b.y + b.h * 0.75);
    } else if (b.style === 'shop') {
      // Striped awning facing the street.
      const stripe = b.district === 'midtown' ? 10 : 9;
      for (let i = 0; i < Math.floor(b.w / (stripe * 2)); i += 1) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(214,100,90,0.55)' : 'rgba(246,234,210,0.5)';
        ctx.fillRect(b.x + 6 + i * stripe * 2, b.y + b.h - 15, stripe, 12);
      }
      // A short skylight and a roof stair box give the flat shop roofs a scale cue.
      const seed = Math.floor(b.x) + Math.floor(b.y);
      const roomy = b.w > 118 && b.h > 76;
      for (let i = 0; roomy && i < 2; i += 1) {
        ctx.fillStyle = 'rgba(60,82,86,0.5)';
        ctx.fillRect(b.x + 18 + i * 34 + 2, b.y + 20 + 2, 26, 16);
        ctx.fillStyle = 'rgba(136,182,186,0.75)';
        ctx.fillRect(b.x + 18 + i * 34, b.y + 20, 26, 16);
        ctx.strokeStyle = 'rgba(248,240,220,0.7)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(b.x + 18 + i * 34, b.y + 20, 26, 16);
      }
      if (b.w > 86 && b.h > 64) {
        ctx.fillStyle = 'rgba(60,52,42,0.55)';
        roundRect(ctx, b.x + b.w - 44, b.y + 18, 26, 24, 2);
        ctx.fill();
      }
      if (roomy && seed % 3 === 0) {
        const tx = b.x + b.w * 0.76;
        const ty = b.y + b.h * 0.52;
        ctx.fillStyle = 'rgba(54,44,32,0.25)';
        ctx.beginPath();
        ctx.ellipse(tx + 6, ty + 7, 16, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8b7a60';
        ctx.beginPath();
        ctx.arc(tx, ty, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(54,44,32,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(232,218,186,0.35)';
        ctx.beginPath();
        ctx.arc(tx - 3, ty - 3, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (b.pool) {
      const px = b.x + b.w * 0.55;
      const py = b.y + b.h * 0.2;
      ctx.fillStyle = 'rgba(28,74,80,0.3)';
      roundRect(ctx, px + 5, py + 6, b.w * 0.3, b.h * 0.22, 5);
      ctx.fill();
      ctx.fillStyle = '#6fc3c9';
      roundRect(ctx, px, py, b.w * 0.3, b.h * 0.22, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240,252,246,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(38,104,112,0.4)';
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(248,242,226,0.9)';
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(px + b.w * 0.31 + 3, py + 6 + i * 11, 9, 4);
        ctx.fillRect(px - 12, py + 6 + i * 11, 9, 4);
      }
    }
    if (b.style === 'tower' && b.floors >= 4 && b.w > 160) {
      const gw = b.w * 0.42;
      const gh = b.h * 0.26;
      const gx = b.x + b.w * 0.3;
      const gy = b.y + b.h * 0.4;
      ctx.fillStyle = 'rgba(24,32,38,0.25)';
      roundRect(ctx, gx + 5, gy + 7, gw, gh, 6);
      ctx.fill();
      const glass = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
      glass.addColorStop(0, 'rgba(118,176,190,0.85)');
      glass.addColorStop(0.5, 'rgba(76,132,152,0.9)');
      glass.addColorStop(1, 'rgba(146,196,204,0.8)');
      ctx.fillStyle = glass;
      roundRect(ctx, gx, gy, gw, gh, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(246,240,222,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(244,238,220,0.5)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(gx + (gw / 4) * i, gy + 2);
        ctx.lineTo(gx + (gw / 4) * i, gy + gh - 2);
        ctx.stroke();
      }
      for (let i = 1; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(gx + 2, gy + (gh / 3) * i);
        ctx.lineTo(gx + gw - 2, gy + (gh / 3) * i);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,250,235,0.22)';
      ctx.fillRect(gx + 4, gy + 4, gw * 0.22, gh - 8);
    }
    if (b.hut) {
      const hx = b.x + b.hut.x * b.w;
      const hy = b.y + b.hut.y * b.h;
      ctx.fillStyle = 'rgba(26,21,16,0.3)';
      ctx.fillRect(hx + 6, hy + 9, b.hut.w, b.hut.h);
      ctx.fillStyle = b.edge;
      roundRect(ctx, hx, hy, b.hut.w, b.hut.h, 3);
      ctx.fill();
      ctx.fillStyle = shadeHex(b.roof, -32);
      roundRect(ctx, hx + 3, hy + 3, b.hut.w - 6, b.hut.h - 6, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,230,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,26,20,0.65)';
      ctx.fillRect(hx + b.hut.w * 0.7, hy + b.hut.h * 0.55, b.hut.w * 0.18, b.hut.h * 0.4);
    }
    if (b.helipad) {
      const hx = b.x + b.w * 0.74;
      const hy = b.y + b.h * 0.72;
      const r = Math.min(30, Math.min(b.w, b.h) * 0.13);
      ctx.fillStyle = 'rgba(54,58,58,0.55)';
      ctx.beginPath();
      ctx.arc(hx + 3, hy + 4, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(70,74,72,0.85)';
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,232,204,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, r - 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(246,236,212,0.92)';
      ctx.font = `800 ${Math.round(r * 1.1)}px ${FONT.display}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', hx, hy + 1);
    }
    if (b.billboard) {
      const bw = Math.min(176, b.w * 0.72);
      const bh = 30;
      const bx = b.x + (b.w - bw) / 2;
      const by = b.y + b.h - bh - 12;
      ctx.fillStyle = 'rgba(28,22,16,0.32)';
      ctx.fillRect(bx + 7, by + 8, bw, bh);
      ctx.fillStyle = b.billboard.color;
      roundRect(ctx, bx, by, bw, bh, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(42,32,22,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,232,0.95)';
      ctx.font = `800 ${Math.round(bh * 0.46)}px ${FONT.display}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.billboard.text, bx + bw / 2, by + bh / 2 + 1);
    }
    if (b.district === 'beach') {
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(226,96,74,0.55)' : 'rgba(246,234,210,0.6)';
        ctx.fillRect(b.x + b.w - 13, b.y + 16 + i * 18, 11, 12);
      }
    }
    for (const vent of b.vents) {
      const vx = b.x + vent.x * b.w;
      const vy = b.y + vent.y * b.h;
      if (vent.kind === 'tank') {
        ctx.fillStyle = '#8b7a60';
        ctx.beginPath();
        ctx.arc(vx, vy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60,48,34,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(90,100,100,0.8)';
        ctx.fillRect(vx - vent.w / 2, vy - vent.h / 2, vent.w, vent.h);
        ctx.strokeStyle = 'rgba(240,240,228,0.3)';
        ctx.strokeRect(vx - vent.w / 2, vy - vent.h / 2, vent.w, vent.h);
      }
    }
    if (b.sign) {
      ctx.save();
      const size = Math.max(11, Math.min(22, b.w / (b.sign.length * 0.6)));
      ctx.font = `800 ${size}px ${FONT.display}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (b.style === 'warehouse') {
        const sy = b.y + 54;
        const tw = ctx.measureText(b.sign).width;
        ctx.fillStyle = 'rgba(30,24,18,0.55)';
        roundRect(ctx, b.x + b.w / 2 - tw / 2 - 10, sy - size * 0.8, tw + 20, size * 1.6, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(246,234,206,0.9)';
        ctx.fillText(b.sign, b.x + b.w / 2, sy);
      } else {
        ctx.fillStyle = 'rgba(30,24,18,0.28)';
        ctx.fillText(b.sign, b.x + b.w / 2 + 2, b.y + 21);
        ctx.fillStyle = 'rgba(46,38,28,0.78)';
        ctx.fillText(b.sign, b.x + b.w / 2, b.y + 19);
      }
      ctx.restore();
    }
  }

  function drawPark(game, bounds) {
    const block = game.world.blocks.find((b) => b.district === 'park');
    if (!block || !rectInView(bounds, block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0)) return;
    const inset = BLOCK_INSET;
    const x0 = block.x0 + inset;
    const y0 = block.y0 + inset;
    const w = block.x1 - block.x0 - inset * 2;
    const h = block.y1 - block.y0 - inset * 2;
    // Winding paths.
    ctx.strokeStyle = '#d9c8a4';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 + 20, y0 + h * 0.5);
    ctx.bezierCurveTo(x0 + w * 0.3, y0 + h * 0.38, x0 + w * 0.55, y0 + h * 0.68, x0 + w - 20, y0 + h * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.5, y0 + 18);
    ctx.bezierCurveTo(x0 + w * 0.42, y0 + h * 0.35, x0 + w * 0.58, y0 + h * 0.62, x0 + w * 0.5, y0 + h - 18);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Pond.
    ctx.fillStyle = '#5f9fa2';
    ctx.beginPath();
    ctx.ellipse(x0 + w * 0.32, y0 + h * 0.72, 78, 46, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,246,228,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(126,170,120,0.6)';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(x0 + w * 0.32 + Math.sin(i * 2.1) * 60, y0 + h * 0.72 + Math.cos(i * 1.7) * 34, 5 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Flower beds.
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 ? 'rgba(226,96,74,0.5)' : 'rgba(242,185,75,0.5)';
      ctx.beginPath();
      ctx.arc(x0 + 60 + (i * 131) % (w - 120), y0 + 60 + (i * 97) % (h - 120), 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawScorches(game, bounds) {
    for (const scorch of game.scorches) {
      if (!inView(bounds, scorch.x, scorch.y, 80)) continue;
      ctx.fillStyle = `rgba(38,31,25,${scorch.alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(scorch.x, scorch.y, scorch.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSkidMarks(game, bounds) {
    ctx.strokeStyle = 'rgba(20,17,14,0.9)';
    for (const mark of game.marks) {
      if (!inView(bounds, mark.x1, mark.y1, 20)) continue;
      ctx.globalAlpha = (mark.life / mark.max) * mark.alpha;
      ctx.lineWidth = mark.w;
      ctx.beginPath();
      ctx.moveTo(mark.x1, mark.y1);
      ctx.lineTo(mark.x2, mark.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMarkers(game, bounds) {
    const pulse = (Math.sin(game.time * 2.6) + 1) / 2;
    for (const marker of game.markers) {
      if (!inView(bounds, marker.x, marker.y, 90)) continue;
      const color = marker.kind === 'mission' ? PALETTE.gold : marker.kind === 'activity' ? '#f2a23e' : '#8fc3b4';
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.globalAlpha = marker.kind === 'shop' ? 0.55 : 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30 + pulse * 6, 18 + pulse * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30 + pulse * 6, 18 + pulse * 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -34 - pulse * 6);
      ctx.lineTo(8, -22 - pulse * 6);
      ctx.lineTo(-8, -22 - pulse * 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // The active mission objective gets a taller, brighter marker.
    if (game.objective?.x != null) {
      const { x, y } = game.objective;
      if (inView(bounds, x, y, 110)) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.24 + pulse * 0.12;
        const gradient = ctx.createRadialGradient(0, 0, 6, 0, 0, 52);
        gradient.addColorStop(0, 'rgba(255,215,106,0.9)');
        gradient.addColorStop(1, 'rgba(255,215,106,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#ffd76a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 36 + pulse * 5, 22 + pulse * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -48 - pulse * 7);
        ctx.lineTo(11, -32 - pulse * 7);
        ctx.lineTo(-11, -32 - pulse * 7);
        ctx.closePath();
        ctx.fillStyle = '#ffd76a';
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawPickups(game, bounds) {
    const bob = Math.sin(game.time * 3) * 2;
    for (const pickup of game.world.pickups.concat(game.pickups)) {
      if (pickup.taken || !inView(bounds, pickup.x, pickup.y, 30)) continue;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.fillStyle = 'rgba(50,38,25,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 8 - bob, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pickup.kind === 'health') {
        ctx.fillStyle = '#f4efe2';
        roundRect(ctx, -9, -9, 18, 18, 4);
        ctx.fill();
        ctx.fillStyle = PALETTE.danger;
        ctx.fillRect(-2.5, -6, 5, 12);
        ctx.fillRect(-6, -2.5, 12, 5);
      } else if (pickup.kind === 'armour') {
        ctx.fillStyle = '#7fb3cf';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(9, -5);
        ctx.lineTo(8, 5);
        ctx.lineTo(0, 11);
        ctx.lineTo(-8, 5);
        ctx.lineTo(-9, -5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e9f4f2';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (pickup.kind === 'ammo') {
        ctx.fillStyle = '#7c6b4f';
        roundRect(ctx, -9, -7, 18, 14, 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(-5, -4, 3, 8);
        ctx.fillRect(0, -4, 3, 8);
        ctx.fillRect(5, -4, 3, 8);
      } else {
        ctx.fillStyle = '#7fae6a';
        roundRect(ctx, -10, -7, 20, 14, 3);
        ctx.fill();
        ctx.fillStyle = '#f6ead2';
        ctx.font = `800 11px ${FONT.ui}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0.5);
      }
      ctx.restore();
    }
  }

  function drawPalms(game, bounds) {
    for (const palm of game.world.palms) {
      if (!inView(bounds, palm.x, palm.y, 90)) continue;
      const size = palm.size;
      ctx.save();
      ctx.translate(palm.x, palm.y);
      // Shadow.
      ctx.fillStyle = 'rgba(66,48,30,0.22)';
      ctx.beginPath();
      ctx.ellipse(size * 13, size * 16, size * 30, size * 13, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Trunk.
      ctx.strokeStyle = PALETTE.palmTrunk;
      ctx.lineWidth = 5.5 * size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(3 * size, -14 * size, 1 * size, -24 * size);
      ctx.stroke();
      // Fronds.
      const fronds = 7;
      for (let i = 0; i < fronds; i += 1) {
        const angle = (i / fronds) * Math.PI * 2 + palm.seed;
        const length = (26 + (i % 3) * 5) * size;
        const sway = Math.sin(game.time * 0.7 + palm.seed * 3 + i) * 2;
        ctx.fillStyle = i % 2 === 0 ? PALETTE.palm : PALETTE.palmLight;
        ctx.beginPath();
        ctx.moveTo(1 * size, -24 * size);
        ctx.quadraticCurveTo(
          Math.cos(angle) * length * 0.55 + sway, -24 * size + Math.sin(angle) * length * 0.5 - 6,
          Math.cos(angle) * length + sway, -24 * size + Math.sin(angle) * length * 0.66,
        );
        ctx.quadraticCurveTo(
          Math.cos(angle) * length * 0.55 + sway - Math.sin(angle) * 4, -24 * size + Math.sin(angle) * length * 0.5 + 5,
          1 * size, -24 * size,
        );
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#5c7a3c';
      ctx.beginPath();
      ctx.arc(1 * size, -24 * size, 5 * size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawProps(game, bounds) {
    for (const prop of game.world.props) {
      if (prop.kind === 'parking') continue;
      if (prop.w && prop.h) {
        if (!rectInView(bounds, prop.x, prop.y, prop.w, prop.h)) continue;
      } else if (!inView(bounds, prop.x, prop.y, 70)) continue;
      ctx.save();
      switch (prop.kind) {
        case 'lamp': {
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.beginPath();
          ctx.ellipse(prop.x + 9, prop.y + 10, 14, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#5a5347';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(prop.x, prop.y);
          ctx.lineTo(prop.x, prop.y - 26);
          ctx.stroke();
          ctx.fillStyle = '#e9d6a4';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y - 28, 4.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'hydrant':
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.beginPath();
          ctx.ellipse(prop.x + 4, prop.y + 5, 7, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#cf5a48';
          roundRect(ctx, prop.x - 4, prop.y - 7, 8, 12, 3);
          ctx.fill();
          ctx.fillStyle = '#e8d6b4';
          ctx.fillRect(prop.x - 1, prop.y - 9, 2, 5);
          break;
        case 'bench':
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.fillRect(prop.x - 12, prop.y + 3, 24, 6);
          ctx.fillStyle = '#8d6b46';
          ctx.fillRect(prop.x - 12, prop.y - 4, 24, 7);
          ctx.fillStyle = '#5b4a34';
          ctx.fillRect(prop.x - 10, prop.y + 2, 3, 5);
          ctx.fillRect(prop.x + 7, prop.y + 2, 3, 5);
          break;
        case 'bin':
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.beginPath();
          ctx.ellipse(prop.x + 4, prop.y + 5, 8, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4d5a52';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#8a958a';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          break;
        case 'dumpster':
          ctx.fillStyle = 'rgba(66,48,30,0.22)';
          ctx.fillRect(prop.x - 22, prop.y - 10, 48, 24);
          ctx.fillStyle = '#587266';
          roundRect(ctx, prop.x - 24, prop.y - 14, 48, 24, 3);
          ctx.fill();
          ctx.strokeStyle = '#34463f';
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        case 'umbrella':
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.beginPath();
          ctx.ellipse(prop.x + 10, prop.y + 12, 22, 11, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = prop.color;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 19, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(250,244,228,0.7)';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 19, -0.4, 0.4);
          ctx.lineTo(prop.x, prop.y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#e8dcc2';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 3.2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'towel':
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(prop.angle);
          ctx.fillStyle = prop.color;
          ctx.fillRect(-9, -26, 18, 44);
          ctx.fillStyle = 'rgba(255,250,236,0.42)';
          ctx.fillRect(-9, -26, 18, 7);
          ctx.restore();
          break;
        case 'lifeguard':
          ctx.fillStyle = 'rgba(66,48,30,0.22)';
          ctx.fillRect(prop.x - 20, prop.y - 16, 44, 42);
          ctx.fillStyle = '#e9e3cf';
          ctx.fillRect(prop.x - 18, prop.y - 18, 36, 34);
          ctx.fillStyle = '#d96450';
          ctx.fillRect(prop.x - 18, prop.y - 18, 36, 7);
          ctx.strokeStyle = '#8a7a60';
          ctx.lineWidth = 2;
          ctx.strokeRect(prop.x - 18, prop.y - 18, 36, 34);
          break;
        case 'pier':
          ctx.fillStyle = '#a4875f';
          ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
          ctx.strokeStyle = 'rgba(60,44,28,0.4)';
          ctx.lineWidth = 1.5;
          for (let x = prop.x; x < prop.x + prop.w; x += 13) {
            ctx.beginPath();
            ctx.moveTo(x, prop.y);
            ctx.lineTo(x, prop.y + prop.h);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(44,32,20,0.3)';
          ctx.fillRect(prop.x, prop.y, prop.w, 4);
          break;
        case 'pierSign':
          ctx.fillStyle = '#3f3a30';
          ctx.fillRect(prop.x - 2, prop.y - 34, 4, 30);
          ctx.fillStyle = '#f2d9a8';
          roundRect(ctx, prop.x - 44, prop.y - 48, 88, 18, 3);
          ctx.fill();
          ctx.fillStyle = '#3a2f22';
          ctx.font = `800 11px ${FONT.ui}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(prop.label, prop.x, prop.y - 39);
          break;
        case 'boat':
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(prop.angle);
          ctx.fillStyle = 'rgba(20,48,56,0.35)';
          ctx.beginPath();
          ctx.ellipse(4, 6, 22, 34, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = prop.color;
          ctx.beginPath();
          ctx.moveTo(0, -28);
          ctx.quadraticCurveTo(18, -4, 12, 22);
          ctx.lineTo(-12, 22);
          ctx.quadraticCurveTo(-18, -4, 0, -28);
          ctx.fill();
          ctx.fillStyle = '#3f5e66';
          ctx.fillRect(-7, -6, 14, 18);
          ctx.restore();
          break;
        case 'crane':
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.fillRect(prop.x - 34, prop.y - 34, 90, 80);
          ctx.strokeStyle = '#c9a24c';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(prop.x - 26, prop.y + 26);
          ctx.lineTo(prop.x - 26, prop.y - 38);
          ctx.lineTo(prop.x + 36, prop.y - 38);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(prop.x - 26, prop.y - 38);
          ctx.lineTo(prop.x + 8, prop.y - 12);
          ctx.stroke();
          ctx.fillStyle = '#d8b45e';
          ctx.fillRect(prop.x + 30, prop.y - 44, 12, 30);
          ctx.strokeStyle = 'rgba(60,48,30,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(prop.x + 36, prop.y - 14);
          ctx.lineTo(prop.x + 36, prop.y + 18);
          ctx.stroke();
          break;
        case 'driveway':
          ctx.fillStyle = '#b7aa92';
          ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
          ctx.strokeStyle = 'rgba(120,104,80,0.4)';
          ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
          break;
        case 'container':
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(prop.angle);
          ctx.fillStyle = 'rgba(66,48,30,0.24)';
          ctx.fillRect(-28, -11, 62, 30);
          ctx.fillStyle = prop.color;
          ctx.fillRect(-30, -13, 60, 26);
          ctx.strokeStyle = 'rgba(30,30,25,0.4)';
          ctx.lineWidth = 1.5;
          for (let x = -26; x < 28; x += 7) {
            ctx.beginPath();
            ctx.moveTo(x, -13);
            ctx.lineTo(x, 13);
            ctx.stroke();
          }
          ctx.restore();
          break;
        case 'crate':
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.fillRect(prop.x - 10, prop.y - 6, 24, 18);
          ctx.fillStyle = '#a47c4b';
          ctx.fillRect(prop.x - 11, prop.y - 11, 22, 22);
          ctx.strokeStyle = '#6e5334';
          ctx.lineWidth = 2;
          ctx.strokeRect(prop.x - 11, prop.y - 11, 22, 22);
          break;
        case 'parkBench':
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.fillRect(prop.x - 15, prop.y + 4, 30, 6);
          ctx.fillStyle = '#9a7850';
          ctx.fillRect(prop.x - 15, prop.y - 4, 30, 8);
          break;
        case 'bandstand':
          ctx.fillStyle = 'rgba(66,48,30,0.2)';
          ctx.beginPath();
          ctx.arc(prop.x + 8, prop.y + 10, 38, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e3d2ae';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 33, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#b09a74';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = '#c7b48c';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 22, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'planter':
          ctx.fillStyle = 'rgba(52,38,24,0.22)';
          ctx.beginPath();
          ctx.ellipse(prop.x + 4, prop.y + 5, 12, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#a38a63';
          roundRect(ctx, prop.x - 11, prop.y - 8, 22, 16, 3);
          ctx.fill();
          ctx.fillStyle = '#4f7a3a';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y - 1, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#6c9146';
          ctx.beginPath();
          ctx.arc(prop.x - 3, prop.y - 4, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'hedge':
          ctx.fillStyle = 'rgba(52,38,24,0.2)';
          ctx.fillRect(prop.x + 6, prop.y + 7, prop.w, prop.h);
          ctx.fillStyle = '#5f7d42';
          roundRect(ctx, prop.x, prop.y, prop.w, prop.h, 7);
          ctx.fill();
          ctx.fillStyle = '#73924e';
          for (let i = 0; i < 5; i += 1) {
            ctx.beginPath();
            ctx.arc(prop.x + 8 + (i % 2) * 18, prop.y + 12 + i * 17, 6, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'sailboat':
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(prop.angle);
          ctx.fillStyle = 'rgba(18,48,56,0.3)';
          ctx.beginPath();
          ctx.ellipse(4, 7, 16, 26, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = prop.color;
          ctx.beginPath();
          ctx.moveTo(0, -20);
          ctx.quadraticCurveTo(12, -2, 9, 16);
          ctx.lineTo(-9, 16);
          ctx.quadraticCurveTo(-12, -2, 0, -20);
          ctx.fill();
          ctx.fillStyle = 'rgba(250,247,236,0.9)';
          ctx.beginPath();
          ctx.moveTo(0, -26);
          ctx.lineTo(0, 2);
          ctx.lineTo(11, 2);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(60,54,42,0.6)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, -26);
          ctx.lineTo(0, 10);
          ctx.stroke();
          ctx.restore();
          break;
        case 'ship':
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(prop.angle);
          ctx.fillStyle = 'rgba(12,36,44,0.32)';
          ctx.beginPath();
          ctx.ellipse(8, 10, 44, 160, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = prop.color;
          roundRect(ctx, -40, -150, 80, 300, 22);
          ctx.fill();
          ctx.fillStyle = '#e8e2cf';
          ctx.fillRect(-26, -132, 52, 52);
          ctx.fillStyle = '#2c3f46';
          ctx.fillRect(-20, -124, 40, 10);
          for (let i = 0; i < 5; i += 1) {
            ctx.fillStyle = ['#a8523f', '#4e7f86', '#b78a43', '#73805f', '#8a5b63'][i];
            ctx.fillRect(-34 + (i % 2) * 4, -66 + i * 26, 62, 20);
          }
          ctx.restore();
          break;
        case 'fountain':
          ctx.fillStyle = '#d8c9a6';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 28, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#74b1b4';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(236,250,244,0.8)';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, 5, 0, Math.PI * 2);
          ctx.fill();
          break;
        default:
          break;
      }
      ctx.restore();
    }
  }

  function drawVehicles(game, bounds) {
    for (const car of game.vehicles) {
      if (!inView(bounds, car.x, car.y, 90)) continue;
      drawVehicle(game, car);
    }
  }

  function drawVehicle(game, car) {
    const stats = car.stats;
    const length = car.length;
    const width = car.width;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(52,38,24,0.28)';
    roundRect(ctx, -length / 2 + 7, -width / 2 + 9, length, width, 7);
    ctx.fill();
    const bodyColor = car.exploded ? '#4a453d' : car.color;
    const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    gradient.addColorStop(0, shadeHex(bodyColor, -16));
    gradient.addColorStop(0.45, bodyColor);
    gradient.addColorStop(1, shadeHex(bodyColor, 12));
    ctx.fillStyle = gradient;
    roundRect(ctx, -length / 2, -width / 2, length, width, 6);
    ctx.fill();
    ctx.strokeStyle = car.hitFlash > 0 ? '#ffe3b0' : 'rgba(35,28,20,0.65)';
    ctx.lineWidth = car.hitFlash > 0 ? 3 : 2;
    ctx.stroke();
    // Wheels.
    ctx.fillStyle = '#262422';
    for (const side of [-1, 1]) {
      for (const axle of [-0.3, 0.32]) {
        ctx.save();
        ctx.translate(length * axle, side * (width / 2 - 1));
        ctx.rotate(car.steer * 0.4 * (axle > 0 ? 1 : 0));
        ctx.fillRect(-length * 0.09, -3.6, length * 0.18, 7.2);
        ctx.restore();
      }
    }
    // Cabin and glass.
    ctx.fillStyle = car.exploded ? '#2f2b25' : 'rgba(53,73,82,0.92)';
    if (car.type === 'pickup') {
      roundRect(ctx, -length * 0.34, -width / 2 + 4, length * 0.3, width - 8, 3);
      ctx.fill();
      ctx.fillStyle = '#7a6c54';
      ctx.fillRect(length * 0.02, -width / 2 + 4, length * 0.42, width - 8);
      ctx.strokeStyle = 'rgba(30,26,20,0.5)';
      ctx.strokeRect(length * 0.02, -width / 2 + 4, length * 0.42, width - 8);
    } else if (car.type === 'van') {
      roundRect(ctx, -length / 2 + 5, -width / 2 + 4, length - 10, width - 8, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,250,232,0.3)';
      ctx.fillRect(-length / 2 + 8, -width / 2 + 6, length * 0.2, width - 12);
    } else {
      roundRect(ctx, -length * 0.2, -width / 2 + 3.5, length * 0.44, width - 7, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(215,232,230,0.25)';
      ctx.fillRect(-length * 0.16, -width / 2 + 5, length * 0.14, width - 10);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(-3, -width / 2 + 1, 6, width - 2);
      ctx.fillStyle = '#3b3327';
      ctx.fillRect(-5, -7, 10, 6);
    }
    // Lights.
    ctx.fillStyle = 'rgba(255,241,190,0.95)';
    ctx.fillRect(length / 2 - 3, -width / 2 + 3, 3, 5);
    ctx.fillRect(length / 2 - 3, width / 2 - 8, 3, 5);
    ctx.fillStyle = 'rgba(190,52,42,0.9)';
    ctx.fillRect(-length / 2, -width / 2 + 3, 2.6, 4);
    ctx.fillRect(-length / 2, width / 2 - 7, 2.6, 4);
    if (car.type === 'police') {
      const flash = Math.sin(car.sirenPhase) > 0;
      ctx.fillStyle = '#2d4f78';
      ctx.fillRect(-length * 0.34, -width / 2 + 2, length * 0.3, 4);
      ctx.fillRect(-length * 0.34, width / 2 - 6, length * 0.3, 4);
      ctx.fillRect(length * 0.08, -width / 2 + 2, length * 0.16, 3);
      ctx.fillStyle = '#1e242a';
      roundRect(ctx, -5, -width / 2 + 2, 10, width - 4, 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#f25a4a' : '#4a86c8';
      ctx.fillRect(-4, -width / 2 + 3, 8, width / 2 - 3);
      ctx.fillStyle = flash ? '#4a86c8' : '#f25a4a';
      ctx.fillRect(-4, 0, 8, width / 2 - 3);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(-1, -width / 2 + 2, 2, width - 4);
      if (car.siren) {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = flash ? '#f25a4a' : '#4a86c8';
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (car.burning > 0) {
      ctx.fillStyle = 'rgba(255,140,50,0.7)';
      ctx.beginPath();
      ctx.arc(-length * 0.2, 0, 8 + Math.sin(game.time * 20) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car === game.player.inCar) {
      ctx.strokeStyle = 'rgba(255,215,106,0.7)';
      ctx.lineWidth = 2;
      roundRect(ctx, -length / 2 - 2, -width / 2 - 2, length + 4, width + 4, 7);
      ctx.stroke();
    }
    if (car.label) {
      ctx.save();
      ctx.rotate(-car.angle);
      ctx.fillStyle = 'rgba(30,24,18,0.65)';
      roundRect(ctx, -34, -width / 2 - 20, 68, 14, 7);
      ctx.fill();
      ctx.fillStyle = '#ffe6a8';
      ctx.font = `700 9px ${FONT.ui}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(car.label, 0, -width / 2 - 13);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPeople(game, bounds) {
    for (const person of game.people) {
      if (!inView(bounds, person.x, person.y, 40)) continue;
      drawPerson(game, person);
    }
    const player = game.player;
    if (!player.inCar) drawPlayer(game, player);
  }

  function drawPerson(game, person) {
    const appearance = person.appearance;
    ctx.save();
    ctx.translate(person.x, person.y);
    if (person.dead) {
      ctx.rotate(person.angle + Math.PI / 2);
      ctx.globalAlpha = clamp(1 - Math.max(0, person.deadTimer - 9) / 5, 0, 1) * 0.85;
      ctx.fillStyle = 'rgba(44,32,22,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 2, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = appearance.pants;
      roundRect(ctx, -12, -5, 24, 10, 4);
      ctx.fill();
      ctx.fillStyle = appearance.shirt;
      roundRect(ctx, -4, -6, 12, 12, 4);
      ctx.fill();
      ctx.fillStyle = appearance.skin;
      ctx.beginPath();
      ctx.arc(9, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(person.angle);
    const bob = Math.sin(person.walkPhase) * 1.4;
    // Shadow.
    ctx.fillStyle = 'rgba(44,32,22,0.24)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs.
    ctx.fillStyle = appearance.pants;
    ctx.fillRect(-3, -6 + bob, 5, 5);
    ctx.fillRect(-3, 1 - bob, 5, 5);
    // Body.
    ctx.fillStyle = person.hitFlash > 0 ? '#fff2d0' : appearance.shirt;
    roundRect(ctx, -6, -7, 12, 14, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(35,27,20,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Arms and weapon.
    ctx.strokeStyle = appearance.skin;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.lineTo(7, -9);
    ctx.moveTo(2, 6);
    if (person.armed) ctx.lineTo(11, 3);
    else ctx.lineTo(7, 9);
    ctx.stroke();
    if (person.armed) {
      ctx.strokeStyle = '#2d2b27';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(10, 3);
      ctx.lineTo(16, 3);
      ctx.stroke();
    }
    // Head.
    ctx.fillStyle = appearance.skin;
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = appearance.hair;
    ctx.beginPath();
    ctx.arc(2.6, 0, 4.4, Math.PI * 0.45, Math.PI * 1.55);
    ctx.fill();
    if (person.team === 'police') {
      ctx.fillStyle = '#22364d';
      ctx.beginPath();
      ctx.arc(3.6, 0, 5.4, Math.PI * 0.6, Math.PI * 1.4);
      ctx.fill();
      ctx.fillStyle = '#e2c25a';
      ctx.fillRect(7, -4.5, 2, 2);
    }
    if (person.boss) {
      ctx.strokeStyle = '#f0d89a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (person.hitFlash > 0) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ffe7b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawPlayer(game, player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.strokeStyle = 'rgba(255,214,128,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(player.angle);
    ctx.fillStyle = 'rgba(44,32,22,0.28)';
    ctx.beginPath();
    ctx.ellipse(1, 4, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Limbs.
    ctx.fillStyle = '#2f4257';
    ctx.fillRect(-3.5, -7, 6, 5);
    ctx.fillRect(-3.5, 2, 6, 5);
    // Torso: Dee's sunset-orange jacket.
    const gradient = ctx.createLinearGradient(0, -7, 0, 7);
    gradient.addColorStop(0, '#f07a5a');
    gradient.addColorStop(1, '#c94f3d');
    ctx.fillStyle = gradient;
    roundRect(ctx, -6, -7.5, 13, 15, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(32,24,18,0.65)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // Arm + weapon.
    ctx.strokeStyle = '#d7a077';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.lineTo(8, -8.5);
    ctx.moveTo(2, 6);
    ctx.lineTo(9, 7);
    ctx.stroke();
    if (player.weapon !== 'fists') {
      ctx.strokeStyle = '#2b2a27';
      ctx.lineWidth = player.weapon === 'shotgun' ? 3.4 : 2.6;
      const reach = player.weapon === 'shotgun' ? 20 : 16;
      ctx.beginPath();
      ctx.moveTo(8, 4);
      ctx.lineTo(reach, 4);
      ctx.stroke();
    }
    // Head and dark hair.
    ctx.fillStyle = '#d7a077';
    ctx.beginPath();
    ctx.arc(4, 0, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b211a';
    ctx.beginPath();
    ctx.arc(2.2, 0, 4.6, Math.PI * 0.4, Math.PI * 1.6);
    ctx.fill();
    ctx.restore();
  }

  function drawBullets(game) {
    ctx.lineCap = 'round';
    for (const bullet of game.bullets) {
      ctx.strokeStyle = bullet.owner === 'player' ? 'rgba(255,226,150,0.95)' : 'rgba(255,198,150,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.014, bullet.y - bullet.vy * 0.014);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function drawHeli(game) {
    const heli = game.heli;
    if (!heli) return;
    // Spotlight on the ground.
    ctx.save();
    ctx.globalAlpha = 0.16;
    const gradient = ctx.createRadialGradient(heli.spotX, heli.spotY, 8, heli.spotX, heli.spotY, 92);
    gradient.addColorStop(0, 'rgba(255,244,198,0.95)');
    gradient.addColorStop(1, 'rgba(255,244,198,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(heli.spotX, heli.spotY, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shadow.
    ctx.fillStyle = 'rgba(30,26,20,0.22)';
    ctx.beginPath();
    ctx.ellipse(heli.x + 30, heli.y + 46, 34, 18, heli.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(heli.angle);
    ctx.fillStyle = '#2c3a42';
    ctx.fillRect(-52, -2.5, 30, 5);
    ctx.beginPath();
    ctx.moveTo(-52, 0);
    ctx.lineTo(-58, -9);
    ctx.lineTo(-46, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(225,232,226,0.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-52, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#20282c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.lineTo(12, -12);
    ctx.moveTo(-14, 12);
    ctx.lineTo(12, 12);
    ctx.stroke();
    const body = ctx.createLinearGradient(0, -12, 0, 12);
    body.addColorStop(0, '#44606a');
    body.addColorStop(0.55, '#2f434b');
    body.addColorStop(1, '#223238');
    ctx.fillStyle = body;
    roundRect(ctx, -24, -11, 46, 22, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(18,24,27,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,206,214,0.8)';
    roundRect(ctx, 10, -8, 13, 16, 6);
    ctx.fill();
    ctx.fillStyle = '#e9e4d2';
    ctx.fillRect(-18, -3.5, 24, 3);
    ctx.fillStyle = '#31506b';
    ctx.fillRect(-18, 0.5, 24, 2.5);
    ctx.fillStyle = 'rgba(246,240,222,0.9)';
    ctx.font = `700 6px ${FONT.ui}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', -6, -6);
    ctx.fillStyle = 'rgba(215,228,224,0.10)';
    ctx.beginPath();
    ctx.arc(0, 0, 37, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(24,30,31,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 37, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(225,232,226,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i += 1) {
      const a = heli.rotor + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 37, Math.sin(a) * 37);
      ctx.lineTo(Math.cos(a + Math.PI) * 37, Math.sin(a + Math.PI) * 37);
      ctx.stroke();
    }
    ctx.fillStyle = '#20282c';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = Math.sin(game.time * 10) > 0 ? '#e0493e' : '#4a86c8';
    ctx.beginPath();
    ctx.arc(-12, 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(game) {
    for (const p of game.particles) {
      const alpha = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'spark') {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx ?? 0) * 0.02, p.y - (p.vy ?? 0) * 0.02);
        ctx.stroke();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = alpha * 0.36;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'fire') {
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - alpha) * p.grow, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'flash') {
        ctx.save();
        const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.size * 2.2);
        glow.addColorStop(0, 'rgba(255,232,172,0.55)');
        glow.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffe3a3';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(24, -8);
        ctx.lineTo(32, 0);
        ctx.lineTo(24, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLightWash(game) {
    // Warm late-afternoon light from the north-west, a light bloom and a vignette.
    const warm = ctx.createLinearGradient(0, 0, width, height);
    warm.addColorStop(0, 'rgba(255,220,160,0.16)');
    warm.addColorStop(0.45, 'rgba(255,190,120,0.05)');
    warm.addColorStop(1, 'rgba(60,40,30,0.12)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, width, height);
    const sun = ctx.createRadialGradient(width * 0.12, -40, 10, width * 0.12, -40, height * 1.4);
    sun.addColorStop(0, 'rgba(255,238,196,0.3)');
    sun.addColorStop(0.5, 'rgba(255,220,160,0.06)');
    sun.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.34, width / 2, height / 2, Math.max(width, height) * 0.78);
    vignette.addColorStop(0, 'rgba(24,18,12,0)');
    vignette.addColorStop(1, 'rgba(24,18,12,0.34)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    if (game.hitFlash > 0) {
      ctx.fillStyle = `rgba(196,48,38,${game.hitFlash * 0.35})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawHudOverlays(game, w, h) {
    // Speed streaks at the very edge when the player is really moving.
    const car = game.player.inCar;
    if (car) {
      const speed = Math.hypot(car.vx, car.vy);
      if (speed > 260) {
        const alpha = clamp((speed - 260) / 220, 0, 0.5);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'rgba(255,246,224,0.8)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 18; i += 1) {
          const t = (i * 0.11 + (game.time * 1.6) % 1) % 1;
          const side = i % 2 === 0 ? -1 : 1;
          const x = side < 0 ? t * w * 0.16 : w - t * w * 0.16;
          const y = ((i * 97) % h);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + side * 38, y + 6);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  return { resize, draw, ctx, get width() { return width; }, get height() { return height; } };
}

function shadeHex(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = clamp(((value >> 16) & 255) + amount, 0, 255);
  const g = clamp(((value >> 8) & 255) + amount, 0, 255);
  const b = clamp((value & 255) + amount, 0, 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export { WORLD };
