// The interface: a sun-faded field report pinned over the city. Every element is fed by
// live state and sized to stay legible at half resolution.

import {
  UI, FONTS, CLOCK, ABILITIES, WEAPONS, CAR_MODELS, RANKS,
} from './config.js';
import { clamp, formatMoney } from './math.js';
import { Minimap, rounded } from './minimap.js';
import { drawPortrait } from './people.js';

function wrapLines(ctx, text, maxWidth) {
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

function starPath(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export class Hud {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 1280;
    this.height = 480;
    this.dpr = 1;
    this.minimap = new Minimap(game);
    this.toasts = [];
    this.titleTime = 0;
    this.saveFlash = 0;
    this.wantedFlash = 0;
    this.lastWanted = 0;
    this.scale = 1;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.scale = clamp(Math.min(width / 1280, height / 480), 0.8, 1.7);
  }

  update(dt) {
    this.titleTime += dt;
    for (let i = this.toasts.length - 1; i >= 0; i -= 1) {
      this.toasts[i].life -= dt;
      if (this.toasts[i].life <= 0) this.toasts.splice(i, 1);
    }
    this.saveFlash = Math.max(0, this.saveFlash - dt);
    const wanted = this.game.police.wanted;
    if (wanted > this.lastWanted + 0.05) this.wantedFlash = 1;
    this.lastWanted = wanted;
    this.wantedFlash = Math.max(0, this.wantedFlash - dt * 1.6);
    if (this.game.police.hudPulse > 0) this.wantedFlash = Math.max(this.wantedFlash, this.game.police.hudPulse);
    this.prompt = this.game.missions?.prompt ?? '';
  }

  toast(text, color = UI.gold, life = 3.4) {
    this.toasts.unshift({ text, color, life, maxLife: life });
    if (this.toasts.length > 4) this.toasts.length = 4;
  }

  flashWanted() {
    this.wantedFlash = 1;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const s = this.scale;
    ctx.save();
    ctx.scale(s, s);
    const w = this.width / s;
    const h = this.height / s;
    if (this.game.mode === 'title') {
      this.drawTitle(ctx, w, h);
    } else {
      this.drawWorldHud(ctx, w, h);
      if (this.game.mode === 'paused') this.drawPause(ctx, w, h);
      if (this.game.mode === 'wasted' || this.game.mode === 'busted') this.drawDown(ctx, w, h);
    }
    this.drawToasts(ctx, w, h);
    ctx.restore();
  }

  drawWorldHud(ctx, w, h) {
    const game = this.game;
    const player = game.player;
    if (game.timeScale < 0.8) this.drawFocusVignette(ctx, w, h);
    if (game.police.wanted > 0) this.drawWantedEdge(ctx, w, h);
    this.drawMissionCard(ctx, 18, 14);
    this.drawTopRight(ctx, w);
    if (game.police.wanted > 0) this.drawPoliceTable(ctx, 18, 128);
    this.drawBottomLeft(ctx, w, h);
    this.drawWeaponWheel(ctx, w, h);
    this.drawSpeedometer(ctx, w, h);
    this.drawDialogue(ctx, w, h);
    this.drawPrompt(ctx, w, h);
    this.drawCrosshair(ctx, w, h);
    if (player.hitFlash > 0) {
      ctx.fillStyle = `rgba(190, 30, 30, ${player.hitFlash * 0.16})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawVignette(ctx, w, h, strength = 0.35) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.9);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(6, 14, 18, ${strength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  drawFocusVignette(ctx, w, h) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.95);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(20, 60, 76, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  drawWantedEdge(ctx, w, h) {
    const strength = 0.12 + this.wantedFlash * 0.22;
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.16);
    grad.addColorStop(0, `rgba(200, 40, 40, ${strength})`);
    grad.addColorStop(1, 'rgba(200, 40, 40, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h * 0.16);
    const grad2 = ctx.createLinearGradient(w, 0, w - 200, 0);
    grad2.addColorStop(0, `rgba(120, 30, 240, ${strength * 0.55})`);
    grad2.addColorStop(1, 'rgba(120, 30, 240, 0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(w - 200, 0, 200, h);
  }

  panel(ctx, x, y, w, h, options = {}) {
    const radius = options.radius ?? 6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    rounded(ctx, x + 3, y + 4, w, h, radius);
    ctx.fill();
    ctx.fillStyle = options.fill ?? UI.panel;
    rounded(ctx, x, y, w, h, radius);
    ctx.fill();
    if (options.accent) {
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, options.accent);
      grad.addColorStop(1, `${options.accent}22`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y + 2, options.barWidth ?? 4, h - 4);
    }
    ctx.strokeStyle = options.stroke ?? 'rgba(247, 239, 220, 0.26)';
    ctx.lineWidth = 1;
    rounded(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
    ctx.stroke();
    // Notched corner.
    ctx.fillStyle = options.accent ?? 'rgba(247, 239, 220, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x + w - 16, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = UI.panelSolid;
    ctx.beginPath();
    ctx.moveTo(x + w - 12, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + 12);
    ctx.closePath();
    ctx.fill();
  }

  text(ctx, value, x, y, options = {}) {
    const size = options.size ?? 13;
    const family = options.family ?? FONTS.head;
    const weight = options.weight ?? 600;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = options.color ?? UI.cream;
    ctx.textAlign = options.align ?? 'left';
    ctx.textBaseline = options.baseline ?? 'alphabetic';
    ctx.globalAlpha = options.alpha ?? 1;
    if (options.tracking) {
      const chars = [...value];
      const widths = chars.map((ch) => ctx.measureText(ch).width);
      const total = widths.reduce((sum, n) => sum + n, 0) + options.tracking * (chars.length - 1);
      let cursor = x;
      if (ctx.textAlign === 'center') cursor = x - total / 2;
      if (ctx.textAlign === 'right') cursor = x - total;
      ctx.textAlign = 'left';
      for (let i = 0; i < chars.length; i += 1) {
        ctx.fillText(chars[i], cursor, y);
        cursor += widths[i] + options.tracking;
      }
    } else {
      ctx.fillText(value, x, y);
    }
    ctx.globalAlpha = 1;
    return ctx.measureText(value).width;
  }

  rule(ctx, x, y, w, color = UI.line) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
  }

  drawMissionCard(ctx, x, y) {
    const card = this.game.missions.card();
    if (!card) return;
    const w = 340;
    const h = 108;
    this.panel(ctx, x, y, w, h, { accent: card.accent, barWidth: 5 });
    this.text(ctx, 'ACTIVE JOB', x + 16, y + 18, { size: 11, color: card.accent, weight: 800, tracking: 2.1 });
    this.text(ctx, `17:42`, x + w - 16, y + 18, {
      size: 10, color: UI.creamDim, align: 'right', family: FONTS.mono, weight: 600,
    });
    this.text(ctx, `STAGE ${card.stage}/${card.total}`, x + 16, y + 38, {
      size: 12.5, color: card.accent, weight: 800, tracking: 1.1,
    });
    this.text(ctx, '·', x + 104, y + 38, { size: 12, color: UI.creamDim, weight: 700 });
    this.text(ctx, card.title, x + 114, y + 38, {
      size: 15.5, color: UI.cream, weight: 800, tracking: 0.3,
    });
    ctx.font = `600 14px ${FONTS.head}`;
    const lines = wrapLines(ctx, card.objective, w - 34).slice(0, 2);
    lines.forEach((line, i) => {
      this.text(ctx, line, x + 16, y + 60 + i * 17, { size: 14, color: UI.cream, weight: 600 });
    });
    const nextY = y + (lines.length > 1 ? 92 : 80);
    this.text(ctx, 'NEXT', x + 16, nextY, {
      size: 10.5, color: card.accent, weight: 800, tracking: 2,
    });
    this.text(ctx, card.next, x + 60, nextY, {
      size: 12.5, color: UI.creamDim, weight: 600,
    });
    // Stage pips.
    for (let i = 0; i < card.total; i += 1) {
      ctx.fillStyle = i < card.stage ? card.accent : 'rgba(247, 239, 220, 0.22)';
      ctx.fillRect(x + w - 16 - (card.total - i) * 11, y + 66, 7, 4);
    }
    const distance = this.game.missions.objectiveDistance;
    if (distance !== null) {
      this.text(ctx, `${Math.round(distance)} M`, x + w - 16, y + 18, {
        size: 10.5, color: UI.creamDim, align: 'right', family: FONTS.mono, weight: 700,
      });
    }
  }

  drawTopRight(ctx, w) {
    const game = this.game;
    const player = game.player;
    const police = game.police;
    const x = w - 18 - 306;
    const y = 14;
    const panelW = 306;
    this.panel(ctx, x, y, panelW, 112, { accent: police.wanted > 0 ? UI.police : UI.gold });
    // Money.
    const coinX = x + 22;
    const coinY = y + 25;
    ctx.fillStyle = '#ffc857';
    ctx.beginPath();
    ctx.arc(coinX, coinY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4d13';
    ctx.beginPath();
    ctx.arc(coinX, coinY, 8.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.font = `800 12px ${FONTS.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', coinX, coinY + 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    this.text(ctx, formatMoney(player.money), x + 40, y + 34, {
      size: 27, color: UI.cream, family: FONTS.mono, weight: 800, tracking: 0.2,
    });
    this.text(ctx, 'CASH', x + panelW - 14, y + 20, {
      size: 10, color: UI.creamDim, align: 'right', weight: 700, tracking: 1.7,
    });
    this.text(ctx, player.rank.name, x + panelW - 14, y + 34, {
      size: 10.5, color: UI.gold, align: 'right', weight: 800, tracking: 0.7,
    });
    // Wanted stars.
    const filled = police.wanted;
    const starY = y + 53;
    for (let i = 0; i < 5; i += 1) {
      const fill = clamp(filled - i, 0, 1);
      this.drawStar(ctx, x + 27 + i * 22, starY, 8.2, 3.6, fill, fill > 0 ? '#ffd166' : 'rgba(247, 239, 220, 0.2)');
    }
    this.text(ctx, police.wanted > 0 ? 'WANTED' : 'CLEAN', x + 148, y + 56, {
      size: 10, color: police.wanted > 0 ? '#ffd166' : UI.creamDim, weight: 800, tracking: 1.6,
    });
    // Response line.
    const pulse = 0.55 + Math.sin(this.game.tick * 4) * 0.35;
    ctx.fillStyle = police.wanted > 0 ? `rgba(121, 184, 255, ${pulse})` : 'rgba(247, 239, 220, 0.4)';
    ctx.beginPath();
    ctx.arc(x + 19, y + 73, 3, 0, Math.PI * 2);
    ctx.fill();
    this.text(ctx, police.reportLine, x + 28, y + 77, {
      size: 13.5, color: police.wanted > 0 ? '#a8d4ff' : UI.creamDim, weight: 700, tracking: 0.2,
    });
    this.rule(ctx, x + 14, y + 84, panelW - 28);
    this.text(ctx, 'RANK', x + 14, y + 98, {
      size: 10, color: UI.creamDim, weight: 700, tracking: 1.6,
    });
    this.text(ctx, player.rank.name, x + 54, y + 98, {
      size: 11.5, color: UI.cream, weight: 800, tracking: 0.5,
    });
    this.text(ctx, `${player.rp} / ${player.nextRankRp} RP`, x + panelW - 14, y + 98, {
      size: 10.5, color: UI.creamDim, align: 'right', family: FONTS.mono, weight: 600,
    });
    this.bar(ctx, x + 14, y + 103, panelW - 28, 4, player.rankProgress, UI.gold, 'rgba(247, 239, 220, 0.14)');
  }

  drawStar(ctx, cx, cy, outer, inner, fraction, color) {
    ctx.save();
    starPath(ctx, cx, cy, outer, inner);
    ctx.fillStyle = 'rgba(12, 22, 27, 0.8)';
    ctx.fill();
    if (fraction > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - outer, cy - outer, outer * 2 * fraction, outer * 2);
      ctx.clip();
      starPath(ctx, cx, cy, outer, inner);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
    starPath(ctx, cx, cy, outer, inner);
    ctx.strokeStyle = fraction > 0 ? '#ffd166' : 'rgba(247, 239, 220, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  bar(ctx, x, y, w, h, fraction, color, back = 'rgba(255, 255, 255, 0.1)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(fraction, 0, 1), h);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  drawPoliceTable(ctx, x, y) {
    const game = this.game;
    const units = game.police.tableUnits();
    if (!units.length) return;
    const w = 340;
    const rowH = 26;
    const h = 22 + units.length * rowH + 4;
    this.panel(ctx, x, y, w, h, { accent: UI.police });
    this.text(ctx, 'POLICE RESPONSE', x + 16, y + 16, {
      size: 10, color: UI.police, weight: 800, tracking: 2,
    });
    const live = 0.5 + Math.sin(this.game.tick * 6) * 0.4;
    ctx.fillStyle = `rgba(255, 92, 92, ${live})`;
    ctx.beginPath();
    ctx.arc(x + w - 18, y + 12, 3, 0, Math.PI * 2);
    ctx.fill();
    this.text(ctx, 'LIVE', x + w - 28, y + 16, {
      size: 9, color: UI.creamDim, align: 'right', weight: 700, tracking: 1.4,
    });
    units.forEach((unit, i) => {
      const rowY = y + 32 + i * rowH;
      if (i > 0) this.rule(ctx, x + 16, rowY - 12, w - 32, 'rgba(247, 239, 220, 0.12)');
      this.text(ctx, unit.callsign, x + 16, rowY + 8, {
        size: 14, color: '#a8d4ff', family: FONTS.mono, weight: 800,
      });
      this.text(ctx, unit.role, x + 92, rowY + 8, {
        size: 11.5, color: UI.creamDim, weight: 700, tracking: 1.3,
      });
      this.text(ctx, `${unit.distance} M`, x + w - 16, rowY + 8, {
        size: 14, color: UI.cream, family: FONTS.mono, weight: 700, align: 'right',
      });
    });
  }

  drawBottomLeft(ctx, w, h) {
    const game = this.game;
    const player = game.player;
    const x = 18;
    const size = 156;
    const y = h - 228;
    const district = game.world.districtAt(player.x, player.z);
    ctx.fillStyle = 'rgba(10, 20, 25, 0.88)';
    rounded(ctx, x - 2, y - 22, 178, 21, 3);
    ctx.fill();
    ctx.fillStyle = district.accent;
    ctx.fillRect(x + 1, y - 18, 4, 12);
    this.text(ctx, district.name, x + 11, y - 7, {
      size: 13, color: UI.cream, weight: 800, tracking: 1.5,
    });
    this.minimap.draw(ctx, x, y, size);
    const state = this.minimap.stateLine();
    this.text(ctx, state, x + 2, y + size + 18, {
      size: 12, color: game.police.wanted > 0 ? UI.coral : UI.mint, weight: 800, family: FONTS.mono, tracking: 0.8,
    });
    this.text(ctx, CLOCK.label, x + size - 2, y + size + 17, {
      size: 10, color: UI.creamDim, align: 'right', family: FONTS.mono, weight: 600,
    });

    const barY = y + size + 27;
    this.statBar(ctx, x + 2, barY, size - 2, 'HEALTH', player.health, 100, player.health <= 30 ? UI.danger : '#6fe0a0');
    this.statBar(ctx, x + 2, barY + 21, size - 2, 'ARMOUR', player.armour, 100, '#79b8ff');
  }

  statBar(ctx, x, y, w, label, value, max, color) {
    this.text(ctx, label, x, y + 10, {
      size: 10.5, color: UI.creamDim, weight: 800, tracking: 1.8,
    });
    this.text(ctx, String(Math.round(value)), x + w, y + 10, {
      size: 13, color: UI.cream, align: 'right', family: FONTS.mono, weight: 700,
    });
    this.bar(ctx, x, y + 13, w, 6, value / max, color, 'rgba(247, 239, 220, 0.12)');
  }

  drawWeaponWheel(ctx, w, h) {
    const game = this.game;
    const player = game.player;
    const totalW = 266;
    const x = w - 18 - totalW;
    const y = 154;
    const slotW = 48;
    const slotH = 54;
    this.text(ctx, 'WEAPONS · 1—5', x + totalW, y - 7, {
      size: 10, color: UI.creamDim, align: 'right', weight: 800, tracking: 1.7,
    });
    const order = ['fists', 'sidearm', 'smg', 'shotgun', 'rifle'];
    for (let i = 0; i < order.length; i += 1) {
      const id = order[i];
      const def = WEAPONS.find((weapon) => weapon.id === id);
      const slot = player.weapons[id];
      const active = player.currentWeapon === id;
      const owned = id === 'fists' || slot?.owned;
      const sx = x + i * (slotW + 6.5);
      ctx.fillStyle = active ? 'rgba(255, 200, 87, 0.16)' : 'rgba(12, 23, 29, 0.9)';
      rounded(ctx, sx, y, slotW, slotH, 4);
      ctx.fill();
      ctx.strokeStyle = active ? UI.gold : 'rgba(247, 239, 220, 0.24)';
      ctx.lineWidth = active ? 2 : 1;
      rounded(ctx, sx + 0.5, y + 0.5, slotW - 1, slotH - 1, 4);
      ctx.stroke();
      this.text(ctx, String(i + 1), sx + 5, y + 12, {
        size: 10, color: active ? UI.gold : UI.creamDim, family: FONTS.mono, weight: 700,
      });
      this.text(ctx, def.short, sx + slotW / 2, y + 27, {
        size: 11, color: owned ? UI.cream : 'rgba(247, 239, 220, 0.3)', align: 'center', weight: 800, tracking: 0.7,
      });
      const ammo = id === 'fists' ? '∞' : owned ? String(slot.ammo) : '—';
      this.text(ctx, ammo, sx + slotW / 2, y + 45, {
        size: 16, color: active ? UI.gold : owned ? UI.cream : 'rgba(247, 239, 220, 0.3)',
        align: 'center', family: FONTS.mono, weight: 800,
      });
    }
    // Abilities.
    const ay = y + 66;
    for (let i = 0; i < ABILITIES.length; i += 1) {
      const ability = ABILITIES[i];
      const cy = ay + i * 36;
      const cooldown = player.cooldowns[ability.id] ?? 0;
      const activeTimer = ability.id === 'focus' ? player.focusTimer : ability.id === 'wind' ? player.windTimer : 0;
      ctx.fillStyle = 'rgba(12, 23, 29, 0.86)';
      rounded(ctx, x, cy, totalW, 33, 3);
      ctx.fill();
      ctx.strokeStyle = activeTimer > 0 ? UI.gold : 'rgba(247, 239, 220, 0.18)';
      ctx.lineWidth = 1;
      rounded(ctx, x + 0.5, cy + 0.5, totalW - 1, 32, 3);
      ctx.stroke();
      ctx.fillStyle = activeTimer > 0 ? UI.gold : 'rgba(255, 200, 87, 0.16)';
      rounded(ctx, x + 4, cy + 5, 21, 21, 3);
      ctx.fill();
      this.text(ctx, ability.key, x + 14.5, cy + 19.5, {
        size: 12.5, color: UI.ink, align: 'center', weight: 800, family: FONTS.mono,
      });
      this.text(ctx, ability.name, x + 32, cy + 14, {
        size: 11.5, color: UI.cream, weight: 800, tracking: 0.8,
      });
      this.text(ctx, ability.desc, x + 32, cy + 26, {
        size: 11.5, color: UI.creamDim, weight: 600,
      });
      if (cooldown > 0) {
        this.text(ctx, `${Math.ceil(cooldown)}s`, x + totalW - 6, cy + 19, {
          size: 9.5, color: UI.coral, align: 'right', family: FONTS.mono, weight: 700,
        });
      }
    }
  }

  drawSpeedometer(ctx, w, h) {
    const car = this.game.player.car;
    if (!car) return;
    const model = CAR_MODELS[car.modelId] ?? CAR_MODELS.marlin;
    const panelW = 256;
    const x = w - 18 - panelW;
    const y = h - 104;
    this.panel(ctx, x, y, panelW, 88, { accent: UI.gold });
    const speed = Math.round(Math.abs(car.speed) * 3.6);
    this.text(ctx, String(speed), x + 16, y + 56, {
      size: 50, color: UI.cream, family: FONTS.mono, weight: 800,
    });
    this.text(ctx, 'KM/H', x + 112, y + 40, {
      size: 11.5, color: UI.gold, weight: 800, tracking: 1.6,
    });
    this.text(ctx, 'GEAR', x + 112, y + 56, {
      size: 10, color: UI.creamDim, weight: 700, tracking: 1.7,
    });
    const gear = Math.abs(car.speed) < 0.5 ? 'N' : car.speed < 0 ? 'R' : String(Math.min(6, 1 + Math.floor(Math.abs(car.speed) / 7)));
    this.text(ctx, gear, x + 112, y + 72, {
      size: 17, color: UI.cream, family: FONTS.mono, weight: 800,
    });
    this.text(ctx, car.customName ?? model.name, x + panelW - 14, y + 26, {
      size: 14, color: UI.cream, weight: 800, align: 'right', tracking: 0.6,
    });
    const damage = Math.round(car.damage);
    const state = damage < 10 ? 'MINT' : damage < 40 ? 'DENTED' : damage < 70 ? 'BASHED' : 'WRECKED';
    this.text(ctx, `${damage}% · ${state}`, x + panelW - 14, y + 44, {
      size: 12, color: damage > 55 ? UI.coral : UI.creamDim, weight: 800, align: 'right', family: FONTS.mono,
    });
    this.bar(ctx, x + 112, y + 76, panelW - 126, 4, damage / 100, damage > 55 ? UI.coral : UI.gold, 'rgba(247, 239, 220, 0.12)');
  }

  drawDialogue(ctx, w, h) {
    const line = this.game.story.line;
    if (!line) return;
    const width = 620;
    const x = (w - width) / 2;
    const y = h - 96;
    const height = 82;
    this.panel(ctx, x, y, width, height, { accent: line.character.accent, radius: 7 });
    drawPortrait(ctx, x + 9, y + 9, 64, line.character, this.game.tick, line.character.accent);
    this.text(ctx, line.character.name, x + 84, y + 22, {
      size: 15, color: line.character.accent, weight: 800, tracking: 0.8,
    });
    this.text(ctx, line.character.title, x + 84, y + 35, {
      size: 9.5, color: UI.creamDim, weight: 700, tracking: 1.3,
    });
    ctx.font = `600 14px ${FONTS.body}`;
    const lines = wrapLines(ctx, line.text || ' ', width - 104).slice(-2);
    lines.forEach((text, i) => {
      this.text(ctx, text, x + 84, y + 55 + i * 18, {
        size: 15, color: UI.cream, weight: 600,
      });
    });
    ctx.fillStyle = 'rgba(247, 239, 220, 0.08)';
    ctx.font = `800 54px ${FONTS.display}`;
    ctx.textAlign = 'right';
    ctx.fillText('”', x + width - 14, y + 66);
    ctx.textAlign = 'left';
  }

  drawPrompt(ctx, w, h) {
    if (!this.prompt) return;
    const text = this.prompt;
    ctx.font = `800 11px ${FONTS.head}`;
    const tw = ctx.measureText(text).width;
    const width = tw + 46;
    const x = (w - width) / 2;
    const y = h - 126;
    ctx.fillStyle = 'rgba(8, 16, 21, 0.92)';
    rounded(ctx, x, y, width, 24, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 200, 87, 0.55)';
    ctx.lineWidth = 1;
    rounded(ctx, x + 0.5, y + 0.5, width - 1, 23, 12);
    ctx.stroke();
    ctx.fillStyle = UI.gold;
    ctx.beginPath();
    ctx.arc(x + 15, y + 12, 7, 0, Math.PI * 2);
    ctx.fill();
    this.text(ctx, 'E', x + 15, y + 16, {
      size: 9, color: UI.ink, align: 'center', weight: 800, family: FONTS.mono,
    });
    this.text(ctx, text, x + 28, y + 16, { size: 11, color: UI.cream, weight: 800, tracking: 0.4 });
  }

  drawCrosshair(ctx, w, h) {
    if (this.game.player.car || this.game.player.dead) return;
    const cx = w / 2;
    const cy = h / 2;
    const aiming = this.game.player.aiming;
    ctx.strokeStyle = aiming ? 'rgba(255, 200, 87, 0.95)' : 'rgba(247, 239, 220, 0.55)';
    ctx.lineWidth = 1.4;
    const r = aiming ? 9 : 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = aiming ? UI.gold : 'rgba(247, 239, 220, 0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(247, 239, 220, 0.35)';
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * (r + 3), cy + dy * (r + 3));
      ctx.lineTo(cx + dx * (r + 8), cy + dy * (r + 8));
      ctx.stroke();
    }
  }

  drawToasts(ctx, w, h) {
    const list = this.toasts.slice(0, 4);
    let y = 14;
    for (const toast of list) {
      ctx.font = `800 11px ${FONTS.head}`;
      const textW = ctx.measureText(toast.text).width;
      const width = Math.min(w - 40, textW + 56);
      const x = (w - width) / 2;
      const alpha = clamp(toast.life * 2, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(8, 17, 22, 0.94)';
      rounded(ctx, x, y, width, 28, 14);
      ctx.fill();
      ctx.strokeStyle = toast.color;
      ctx.lineWidth = 1;
      rounded(ctx, x + 0.5, y + 0.5, width - 1, 27, 14);
      ctx.stroke();
      ctx.fillStyle = toast.color;
      ctx.beginPath();
      ctx.arc(x + 16, y + 14, 7.5, 0, Math.PI * 2);
      ctx.fill();
      this.text(ctx, '✓', x + 16, y + 18, {
        size: 10, color: UI.ink, align: 'center', weight: 800,
      });
      this.text(ctx, toast.text, x + 30, y + 18, {
        size: 11.5, color: UI.cream, weight: 800, tracking: 0.7,
      });
      ctx.globalAlpha = 1;
      y += 34;
    }
  }

  drawDown(ctx, w, h) {
    const busted = this.game.mode === 'busted';
    const color = busted ? '#79b8ff' : '#ff5c5c';
    ctx.fillStyle = 'rgba(5, 10, 14, 0.68)';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, busted ? 'rgba(20, 50, 100, 0.55)' : 'rgba(120, 20, 20, 0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    this.text(ctx, busted ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 4, {
      size: 64, color, align: 'center', weight: 800, family: FONTS.display, tracking: 7,
    });
    this.rule(ctx, w / 2 - 150, h / 2 + 16, 300, color);
    this.text(ctx, busted ? 'PALMSHORE PD · BADGE 114' : 'ST. AGNES MEMORIAL · CORAL STRIP', w / 2, h / 2 + 40, {
      size: 11, color: UI.cream, align: 'center', weight: 800, tracking: 1.8,
    });
    this.text(ctx, busted ? 'BAIL $750 · WEAPONS IMPOUNDED' : 'HOSPITAL BILL $500 · DIGNITY LOST', w / 2, h / 2 + 58, {
      size: 11, color: UI.creamDim, align: 'center', weight: 600,
    });
    this.text(ctx, `RESPAWN IN ${Math.max(0, this.game.player.respawnTimer).toFixed(1)}`, w / 2, h / 2 + 84, {
      size: 12, color: color, align: 'center', family: FONTS.mono, weight: 800,
    });
  }

  drawTitle(ctx, w, h) {
    const game = this.game;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(8, 18, 24, 0.68)');
    grad.addColorStop(0.5, 'rgba(8, 18, 24, 0.28)');
    grad.addColorStop(1, 'rgba(8, 18, 24, 0.82)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Sun disc.
    const sunX = w * 0.72;
    const sunY = h * 0.38;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180);
    sunGrad.addColorStop(0, 'rgba(255, 225, 170, 0.8)');
    sunGrad.addColorStop(0.22, 'rgba(255, 180, 100, 0.25)');
    sunGrad.addColorStop(1, 'rgba(255, 150, 80, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 180, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe0a8';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
    // Wordmark.
    this.text(ctx, 'PALMSHORE', 52, 132, {
      size: 82, color: UI.cream, family: FONTS.display, weight: 800, tracking: 5,
    });
    ctx.fillStyle = UI.gold;
    ctx.fillRect(56, 146, 520, 4);
    this.text(ctx, 'A SUN-BLEACHED CRIME STORY', 58, 170, {
      size: 14, color: UI.gold, weight: 800, tracking: 4.4,
    });
    this.text(ctx, 'CITY OF SALT · COUNTY OF BAD DECISIONS', 58, 188, {
      size: 10, color: UI.creamDim, weight: 600, tracking: 2.2,
    });
    // Menu.
    const menuX = 58;
    let menuY = 240;
    const pulse = 0.65 + Math.sin(this.titleTime * 3) * 0.35;
    ctx.fillStyle = `rgba(255, 200, 87, ${0.14 + pulse * 0.1})`;
    rounded(ctx, menuX, menuY - 22, 346, 38, 4);
    ctx.fill();
    ctx.strokeStyle = UI.gold;
    ctx.lineWidth = 1.4;
    rounded(ctx, menuX + 0.5, menuY - 21.5, 345, 37, 4);
    ctx.stroke();
    this.text(ctx, 'ENTER', menuX + 14, menuY + 3, {
      size: 13, color: UI.gold, family: FONTS.mono, weight: 800, tracking: 1,
    });
    this.text(ctx, 'START A NEW SHIFT', menuX + 84, menuY + 3, {
      size: 14, color: UI.cream, weight: 800, tracking: 1.4,
    });
    menuY += 46;
    const save = game.savedGame;
    this.text(ctx, 'C', menuX + 14, menuY + 3, {
      size: 13, color: save ? UI.gold : 'rgba(247, 239, 220, 0.3)', family: FONTS.mono, weight: 800,
    });
    this.text(ctx, save ? 'CONTINUE SAVED SHIFT' : 'NO SAVE ON THIS SHORE', menuX + 84, menuY + 3, {
      size: 13, color: save ? UI.cream : 'rgba(247, 239, 220, 0.4)', weight: 700, tracking: 1,
    });
    // Story teaser.
    this.text(ctx, 'FIVE JOBS · ONE STRIP · NO CLEAN HANDS', menuX, 346, {
      size: 10, color: UI.creamDim, weight: 700, tracking: 2.2,
    });
    this.text(ctx, 'Marisol Vane has work. Dex Calloway has a Regent. Det. Salt has a ledger.', menuX, 364, {
      size: 11, color: 'rgba(247, 239, 220, 0.75)', weight: 500,
    });
    this.text(ctx, 'Aurelio Pike has the docks. You have a bad idea and a full tank.', menuX, 380, {
      size: 11, color: 'rgba(247, 239, 220, 0.55)', weight: 500,
    });
    // Controls card.
    const cx = w - 372;
    const cy = 226;
    this.panel(ctx, cx, cy, 354, 206, { accent: UI.gold });
    this.text(ctx, 'HOW TO RUN THE STRIP', cx + 16, cy + 22, {
      size: 10.5, color: UI.gold, weight: 800, tracking: 2,
    });
    const rows = [
      ['WASD', 'MOVE · DRIVE'],
      ['MOUSE', 'LOOK · AIM'],
      ['LMB / RMB', 'FIRE · MELEE'],
      ['F', 'ENTER / EXIT CAR'],
      ['E', 'INTERACT · ROB'],
      ['1—5 / Q / R', 'WEAPONS / CYCLE / RELOAD'],
      ['SHIFT / SPACE', 'SPRINT / HANDBRAKE'],
      ['Z / C / X', 'FOCUS / SIDEWINDER / PATCH'],
      ['P / ESC', 'PAUSE · SAVE'],
    ];
    rows.forEach(([key, desc], i) => {
      const rowY = cy + 46 + i * 17;
      this.text(ctx, key, cx + 16, rowY, {
        size: 10, color: UI.cream, family: FONTS.mono, weight: 800,
      });
      this.text(ctx, desc, cx + 122, rowY, {
        size: 10, color: UI.creamDim, weight: 600, tracking: 0.3,
      });
    });
    this.text(ctx, 'PALMSHORE · AN ORIGINAL GAME · NO NETWORK', w - 18, h - 16, {
      size: 9, color: 'rgba(247, 239, 220, 0.5)', align: 'right', weight: 700, tracking: 1.4,
    });
  }

  drawPause(ctx, w, h) {
    ctx.fillStyle = 'rgba(5, 11, 15, 0.7)';
    ctx.fillRect(0, 0, w, h);
    const panelW = 700;
    const panelH = 344;
    const x = (w - panelW) / 2;
    const y = (h - panelH) / 2;
    this.panel(ctx, x, y, panelW, panelH, { accent: UI.gold, radius: 8 });
    this.text(ctx, 'PAUSED', x + 26, y + 42, {
      size: 38, color: UI.cream, family: FONTS.display, weight: 800, tracking: 4,
    });
    this.text(ctx, 'THE STRIP CAN WAIT', x + 28, y + 60, {
      size: 10, color: UI.gold, weight: 800, tracking: 3,
    });
    this.rule(ctx, x + 26, y + 76, panelW - 52);
    this.text(ctx, 'CONTROLS', x + 26, y + 98, {
      size: 10, color: UI.gold, weight: 800, tracking: 2,
    });
    const rows = [
      ['WASD', 'MOVE / DRIVE'], ['MOUSE', 'AIM / LOOK'], ['LMB / RMB', 'FIRE / MELEE'],
      ['F', 'ENTER / EXIT CAR'], ['E', 'INTERACT / ROB'], ['1—5', 'WEAPONS'],
      ['R', 'RELOAD'], ['SHIFT', 'SPRINT'], ['SPACE', 'JUMP / HANDBRAKE'],
      ['Z C X', 'ABILITIES'], ['M', 'MUTE AUDIO'],
    ];
    rows.forEach(([key, desc], i) => {
      const col = i < 6 ? 0 : 1;
      const row = i < 6 ? i : i - 6;
      const rx = x + 28 + col * 300;
      const ry = y + 122 + row * 20;
      this.text(ctx, key, rx, ry, { size: 10, color: UI.cream, family: FONTS.mono, weight: 800 });
      this.text(ctx, desc, rx + 90, ry, { size: 10.5, color: UI.creamDim, weight: 600 });
    });
    const saveX = x + 26;
    const saveY = y + 262;
    this.text(ctx, 'S · SAVE GAME', saveX, saveY, {
      size: 13, color: UI.gold, weight: 800, tracking: 1.6,
    });
    this.text(ctx, 'ESC · RESUME', saveX + 190, saveY, {
      size: 13, color: UI.cream, weight: 800, tracking: 1.6,
    });
    this.text(ctx, 'Q · QUIT TO TITLE', saveX + 350, saveY, {
      size: 13, color: UI.creamDim, weight: 800, tracking: 1.6,
    });
    this.text(ctx, `${this.game.player.rank.name} · ${formatMoney(this.game.player.money)} · ${this.game.player.rp} RP`, saveX, saveY + 24, {
      size: 10.5, color: UI.creamDim, weight: 600, family: FONTS.mono,
    });
    this.text(ctx, 'AUTOSAVE ON MISSION COMPLETE · SLOT 01', saveX, saveY + 42, {
      size: 9, color: 'rgba(247, 239, 220, 0.45)', weight: 700, tracking: 1.4,
    });
  }

  drawSaveToast(ctx, w, h) {
    const x = w / 2 - 104;
    const y = 14;
    ctx.fillStyle = 'rgba(8, 17, 22, 0.94)';
    rounded(ctx, x, y, 208, 26, 13);
    ctx.fill();
    ctx.strokeStyle = UI.mint;
    rounded(ctx, x + 0.5, y + 0.5, 207, 25, 13);
    ctx.stroke();
    this.text(ctx, 'SAVED · SLOT 01', x + 20, y + 17, {
      size: 10.5, color: UI.mint, weight: 800, tracking: 1.5,
    });
    this.text(ctx, CLOCK.label, x + 188, y + 17, {
      size: 10, color: UI.creamDim, align: 'right', family: FONTS.mono, weight: 600,
    });
  }
}

export const HUD_ICON_WEAPONS = WEAPONS;
export const HUD_RANKS = RANKS;
export const HUD_ABILITIES = ABILITIES;
