// Capture tool: serves game/ on 127.0.0.1:8091, drives the already-running headless Chrome over
// the DevTools protocol at ws://127.0.0.1:9223, opens each ?shot= scene at 1280x480, waits for the
// deterministic frame, and writes PNG (or JPEG when PNG would break the 256 KiB screenshot cap)
// into screenshots/.
//
//   node tools/shoot.mjs                 capture every scene
//   node tools/shoot.mjs chase boulevard capture just those scenes

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const outDir = join(repo, 'screenshots');
const PORT = 8091;
const DEBUG = 'http://127.0.0.1:9223';
const MAX_BYTES = 256 * 1024;

const SCENES = [
  { shot: 'chase', file: '1-ocean-drive-pursuit' },
  { shot: 'boulevard', file: '2-verano-boulevard' },
  { shot: 'shootout', file: '3-wanted-level-four' },
  { shot: 'crane', file: '4-dock-heist' },
];

const wanted = process.argv.slice(2);
const scenes = wanted.length ? SCENES.filter((scene) => wanted.includes(scene.shot) || wanted.includes(scene.file)) : SCENES;

let server = null;

async function portIsUp() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await portIsUp()) {
    console.log(`reusing static server on ${PORT}`);
    return;
  }
  server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], {
    cwd: repo,
    stdio: 'ignore',
    windowsHide: true,
  });
  for (let i = 0; i < 40; i += 1) {
    if (await portIsUp()) {
      console.log(`static server up on ${PORT}`);
      return;
    }
    await sleep(250);
  }
  throw new Error('static server did not start');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(`${message.error.message} (${message.error.code})`));
        else entry.resolve(message.result);
      } else {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  await startServer();
  const version = await (await fetch(`${DEBUG}/json/version`)).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP websocket timeout')), 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
    ws.addEventListener('error', (event) => { clearTimeout(timer); reject(new Error(`CDP websocket error: ${event.message ?? 'unknown'}`)); });
  });
  const cdp = new Cdp(ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 480, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 480,
  }, sessionId);

  let errors = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params?.exceptionDetails;
      errors.push(details?.exception?.description ?? details?.text ?? 'exception');
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
      errors.push(message.params.args?.map((arg) => arg.value ?? arg.description).join(' '));
    }
  });

  const written = [];
  for (const scene of scenes) {
    errors = [];
    const url = `http://127.0.0.1:${PORT}/?shot=${encodeURIComponent(scene.shot)}&seed=1`;
    await cdp.send('Page.navigate', { url }, sessionId);
    let ready = false;
    for (let i = 0; i < 120; i += 1) {
      await sleep(200);
      const result = await cdp.send('Runtime.evaluate', {
        expression: 'window.__shotReady === true', returnByValue: true,
      }, sessionId);
      if (result.result?.value) {
        ready = true;
        break;
      }
    }
    if (!ready) {
      console.error(`scene ${scene.shot}: timed out waiting for __shotReady`);
      const state = await cdp.send('Runtime.evaluate', { expression: 'window.__palmshore ? window.__palmshore.mode : "no game"' , returnByValue: true }, sessionId);
      console.error('  game mode:', state.result?.value);
    }
    if (errors.length) {
      console.error(`scene ${scene.shot}: page errors:`);
      for (const error of errors.slice(0, 6)) console.error('  ' + error);
    }
    await sleep(500);
    let data = '';
    let extension = '.png';
    const png = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
    let buffer = Buffer.from(png.data, 'base64');
    if (buffer.length > MAX_BYTES) {
      const jpeg = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, fromSurface: true }, sessionId);
      buffer = Buffer.from(jpeg.data, 'base64');
      extension = '.jpg';
      if (buffer.length > MAX_BYTES) {
        const smaller = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82, fromSurface: true }, sessionId);
        buffer = Buffer.from(smaller.data, 'base64');
        if (buffer.length > MAX_BYTES) throw new Error(`${scene.file} still over 256 KiB`);
      }
    }
    const file = `${scene.file}${extension}`;
    writeFileSync(join(outDir, file), buffer);
    written.push({ file, bytes: buffer.length });
    console.log(`${file}  ${(buffer.length / 1024).toFixed(1)} KiB`);
  }

  await cdp.send('Target.closeTarget', { targetId });
  ws.close();
  if (server) server.kill();
  if (written.length) {
    console.log('\ncaptured:');
    for (const entry of written) console.log(`  screenshots/${entry.file}  ${entry.bytes} bytes`);
  }
}

main().catch(async (error) => {
  console.error(error.stack ?? error);
  if (server) server.kill();
  process.exit(1);
});
