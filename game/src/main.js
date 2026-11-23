// Boot and the one loop. It builds the game, reads ?seed and ?shot, switches scenes, and advances
// the simulation in fixed 1/60 s steps before drawing world + HUD. In ?shot mode it stages a
// deterministic frame, paints it, and raises window.__shotReady for the capture tool.

import { STEP } from './config.js';
import {
  createGame, stepGame, drawGame, updateTitle, startNewGame, continueGame, togglePause,
  runPauseAction, respawnNow, leaveEndCard, toggleSound, quitToTitle,
} from './game.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.2;
const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 424242;
const shot = params.get('shot');
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(canvas, seed);
window.__palmshore = game;

let accumulator = 0;
let last = performance.now();
let shotFrames = 0;

if (shot) {
  stageShot(shot, game);
  game.mode = 'shot';
  status.textContent = 'Screenshot scene loaded.';
}

window.addEventListener('resize', () => {
  game.renderer.resize();
});

window.addEventListener('keydown', () => {
  game.audio.resume();
});

function announce(text) {
  status.textContent = text;
}

function handleMenus() {
  const input = game.input;
  if (game.mode === 'title') {
    const clicked = input.takeClick();
    if (input.take('Enter') || input.take('NumpadEnter') || clicked) {
      if (game.save) continueGame(game);
      else startNewGame(game);
      announce('Playing Palmshore.');
    } else if (input.take('KeyN')) {
      startNewGame(game);
      announce('New game started.');
    } else if (input.take('KeyS')) {
      toggleSound(game);
      game.titleItems[2] = { label: `S   SOUND: ${game.audio.enabled ? 'ON' : 'OFF'}` };
      announce(`Sound ${game.audio.enabled ? 'on' : 'off'}.`);
    }
    return;
  }
  if (game.mode === 'paused') {
    if (input.take('Escape') || input.take('KeyP')) {
      togglePause(game);
      announce('Playing.');
      return;
    }
    if (input.take('ArrowUp') || input.take('KeyW')) {
      game.pauseIndex = (game.pauseIndex + game.pauseItems.length - 1) % game.pauseItems.length;
      game.audio.ui();
    }
    if (input.take('ArrowDown') || input.take('KeyS')) {
      game.pauseIndex = (game.pauseIndex + 1) % game.pauseItems.length;
      game.audio.ui();
    }
    if (input.take('Enter') || input.take('NumpadEnter')) {
      runPauseAction(game);
      if (game.mode === 'title') announce('Returned to title.');
      else announce('Playing.');
    }
    return;
  }
  if (game.mode === 'dead' || game.mode === 'busted') {
    if (input.take('Enter') || input.take('NumpadEnter') || input.take('Space')) {
      respawnNow(game);
      announce('Back on the street.');
    }
    return;
  }
  if (game.mode === 'endcard') {
    if (input.take('Enter') || input.take('NumpadEnter')) {
      leaveEndCard(game);
      announce('Free roam.');
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;

  if (game.mode === 'shot') {
    drawGame(game);
    shotFrames += 1;
    if (shotFrames >= 3) window.__shotReady = true;
    game.input.endFrame();
    return;
  }

  handleMenus();

  if (game.mode === 'title') {
    updateTitle(game, elapsed);
  } else if (game.mode === 'play') {
    accumulator += elapsed;
    while (accumulator >= STEP && game.mode === 'play') {
      stepGame(game, STEP, game.input);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
    if (game.mode === 'dead' || game.mode === 'busted') {
      game.respawnTimer -= elapsed;
      game.time += elapsed;
      if (game.respawnTimer <= 0) respawnNow(game);
      updateTitleAmbient(elapsed);
    }
  }

  drawGame(game);
  game.input.endFrame();
}

/** Effects keep breathing behind the wasted/busted panels. */
function updateTitleAmbient(elapsed) {
  game.shake = Math.max(0, game.shake - game.shake * 6 * elapsed);
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const p = game.particles[i];
    p.life -= elapsed;
    if (p.life <= 0) game.particles.splice(i, 1);
    else {
      p.x += (p.vx ?? 0) * elapsed;
      p.y += (p.vy ?? 0) * elapsed;
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'play') togglePause(game);
});

setTimeout(() => game.audio.resume(), 400);
requestAnimationFrame(frame);
