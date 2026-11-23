// Make Palmshore's four screenshots: start the static server, drive the headless Chrome that is
// already listening at ws://127.0.0.1:9223, open ?shot=<scene>&seed=1 at 1280x480, wait for the
// staged frame and write a JPEG into screenshots/. Usage: node tools/shoot.mjs [scene ...]

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const outDir = join(repo, 'screenshots');
const PORT = 8091;
const DEBUG = 'http://127.0.0.1:9223';

const SCENES = [
  { name: 'cover', file: '1-cover.jpg' },
  { name: 'beach', file: '2-beach.jpg' },
  { name: 'shootout', file: '3-shootout.jpg' },
  { name: 'docks', file: '4-docks.jpg' },
];

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const scenes = wanted.length ? SCENES.filter((s) => wanted.includes(s.name)) : SCENES;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function serverIsUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/index.html`, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverIsUp()) return null;
  const child = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 50; i += 1) {
    await sleep(120);
    if (await serverIsUp()) return child;
  }
  throw new Error('static server did not start');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', (event) => reject(new Error(`websocket error: ${event.message ?? 'unknown'}`)), { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
      } else if (msg.method) {
        const list = this.handlers.get(msg.method);
        if (list) for (const fn of list) fn(msg.params, msg.sessionId);
      }
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const server = await ensureServer();
  const version = await (await fetch(`${DEBUG}/json/version`)).json();
  const cdp = new Cdp(version.webSocketDebuggerUrl);
  await cdp.ready;
  const errors = [];
  cdp.on('Runtime.exceptionThrown', (params) => {
    const text = params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? 'exception';
    errors.push(text);
    console.error('page exception:', text.split('\n')[0]);
  });
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      const text = params.args?.map((a) => a.value ?? a.description ?? '').join(' ') ?? '';
      errors.push(text);
      console.error('console:', text);
    }
  });
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 480, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, sessionId);

  for (const scene of scenes) {
    const url = `http://127.0.0.1:${PORT}/?shot=${scene.name}&seed=1`;
    await cdp.send('Page.navigate', { url }, sessionId);
    let ready = false;
    for (let i = 0; i < 120; i += 1) {
      await sleep(150);
      try {
        const res = await cdp.send('Runtime.evaluate', { expression: 'Boolean(window.__shotReady)', returnByValue: true }, sessionId);
        if (res.result?.value) {
          ready = true;
          break;
        }
      } catch {
        // Page is between navigations; try again.
      }
    }
    if (!ready) throw new Error(`scene ${scene.name} never became ready`);
    await sleep(250);
    let quality = 86;
    let bytes = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, fromSurface: true, captureBeyondViewport: false }, sessionId);
      const data = Buffer.from(shot.data, 'base64');
      if (data.length <= 262144) {
        bytes = data;
        break;
      }
      quality -= 6;
    }
    if (!bytes) throw new Error(`scene ${scene.name} could not be squeezed under 256 KiB`);
    writeFileSync(join(outDir, scene.file), bytes);
    console.log(`${scene.file}  ${bytes.length} bytes  q${quality}  shot=${scene.name}`);
  }
  await cdp.send('Target.closeTarget', { targetId });
  cdp.close();
  if (server) server.kill();
  if (errors.length) console.log(`page errors: ${errors.length}`);
  setTimeout(() => process.exit(0), 200);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
