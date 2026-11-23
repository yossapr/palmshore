// Keyboard and mouse: held keys for movement and driving, one-shot presses for interactions and
// menus, and the pointer for aiming. A press is consumed once by the loop, so a fast tap between
// two frames is never lost and never counted twice.

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyR', 'KeyH', 'KeyM',
  'Digit1', 'Digit2', 'Digit3', 'Escape', 'KeyP', 'Enter', 'KeyL', 'KeyC', 'Tab',
]);

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (!GAME_KEYS.has(event.code)) return;
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    held.add(event.code);
    pressed.add(event.code);
    if (event.code === 'Space' || event.code === 'Tab') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    if (GAME_KEYS.has(event.code)) event.preventDefault();
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    mouse.down = true;
    mouse.clicked = true;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held: (code) => held.has(code),
    take: (code) => {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    takeAny: (...codes) => {
      for (const code of codes) {
        if (pressed.delete(code)) return true;
      }
      return false;
    },
    takeClick: () => {
      if (!mouse.clicked) return false;
      mouse.clicked = false;
      return true;
    },
    mouse,
    /** Movement on foot, already normalised: x right, y down. */
    moveVector() {
      const right = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const down = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      const length = Math.hypot(right, down);
      if (length === 0) return { x: 0, y: 0 };
      return { x: right / length, y: down / length };
    },
    driving() {
      return {
        throttle: held.has('KeyW') || held.has('ArrowUp') ? 1 : 0,
        brake: held.has('KeyS') || held.has('ArrowDown') ? 1 : 0,
        steer: (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0),
        handbrake: held.has('Space'),
      };
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
