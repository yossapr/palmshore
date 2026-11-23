// Keyboard and mouse. Held keys answer `down`, one-shot presses answer `pressed` until the frame
// ends, and the pointer position is kept in canvas pixels so aiming and menus share it.

const BLOCK = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyR', 'KeyQ', 'KeyH', 'KeyP', 'KeyM',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Tab', 'Escape', 'Enter',
]);

export function createInput(canvas) {
  const held = new Set();
  const edge = new Set();
  const mouse = { x: canvas.width * 0.5 || 640, y: canvas.height * 0.5 || 240, left: false, right: false };

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
  }

  window.addEventListener('keydown', (event) => {
    if (BLOCK.has(event.code)) event.preventDefault();
    if (!event.repeat) edge.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.left = false;
    mouse.right = false;
  });
  canvas.addEventListener('pointermove', updateMouse);
  canvas.addEventListener('pointerdown', (event) => {
    updateMouse(event);
    if (event.button === 0) {
      mouse.left = true;
      edge.add('Mouse0');
    }
    if (event.button === 2) {
      mouse.right = true;
      edge.add('Mouse2');
    }
    canvas.setPointerCapture?.(event.pointerId);
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.left = false;
    if (event.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    down(code) {
      return held.has(code);
    },
    pressed(code) {
      return edge.has(code);
    },
    endFrame() {
      edge.clear();
    },
    clear() {
      held.clear();
      edge.clear();
    },
  };
}
