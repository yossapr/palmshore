// Keyboard and pointer state, with a virtual override used by deterministic captures.

const BLOCKED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyQ', 'KeyR',
  'KeyZ', 'KeyC', 'KeyX', 'KeyP', 'KeyM', 'Escape', 'Enter',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { x: 640, y: 240, down: false, clicked: false, right: false, rightClicked: false, dx: 0, dy: 0, locked: false };
    this.virtual = null;
    this.enabled = true;
    this.capturePointer = true;

    window.addEventListener('keydown', (event) => {
      if (!this.enabled) return;
      if (BLOCKED.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.down.add(event.code);
      this.pressed.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      if (BLOCKED.has(event.code)) event.preventDefault();
      this.down.delete(event.code);
      this.released.add(event.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.down = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (event) => {
      if (!this.mouse.locked) return;
      this.mouse.dx += event.movementX || 0;
      this.mouse.dy += event.movementY || 0;
    });
    canvas.addEventListener('mousemove', (event) => {
      const bounds = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - bounds.left) / bounds.width) * canvas.clientWidth;
      this.mouse.y = ((event.clientY - bounds.top) / bounds.height) * canvas.clientHeight;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
        if (this.capturePointer && !this.virtual && !this.mouse.locked) {
          canvas.requestPointerLock?.();
        }
      }
      if (event.button === 2) {
        this.mouse.right = true;
        this.mouse.rightClicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouse.down = false;
      if (event.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  setVirtual(keys, mouse = {}) {
    this.virtual = { keys: new Set(keys), mouse };
  }

  clearVirtual() {
    this.virtual = null;
  }

  isDown(code) {
    if (this.virtual) return this.virtual.keys.has(code);
    return this.down.has(code);
  }

  wasPressed(code) {
    if (this.virtual) {
      return this.virtual.keys.has(code) && this.pressed.has(code);
    }
    return this.pressed.has(code);
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    return { x, y };
  }

  consumeMouseDelta() {
    const dx = this.mouse.dx;
    const dy = this.mouse.dy;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return { dx, dy };
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.clicked = false;
    this.mouse.rightClicked = false;
  }
}
