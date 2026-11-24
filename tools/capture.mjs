// A small CDP capture tool: starts a static server for game/, launches desktop Chrome,
// sets the viewport, waits for the deterministic scene to report ready, and saves a JPEG.
// Usage: node tools/capture.mjs --query "?shot=street&seed=20261103" --out shots/street.jpg

import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gameRoot = join(repo, 'game');
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
}
const query = arg('query', '?shot=street&seed=20261103');
const outPath = resolve(repo, arg('out', 'shots/street.jpg'));
const width = Number(arg('width', '1280'));
const height = Number(arg('height', '480'));
const quality = Number(arg('quality', '84'));
const settle = Number(arg('settle', '400'));
const port = Number(arg('port', '8091'));
const chromePath = arg('chrome', 'C:/Users/ACER/AppData/Local/Google/Chrome/Application/chrome.exe');
const profile = join(tmpdir(), `palmshore-cdp-${process.pid}`);
const debugPort = Number(arg('debugPort', '9223'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(gameRoot, normalize(pathname)));
  if (file !== gameRoot && !file.startsWith(gameRoot + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': info.size,
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('not found');
  }
});

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function getJson(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      // Chrome is still coming up.
    }
    await wait(200);
  }
  throw new Error(`no response from ${url}`);
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: done, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else done(message.result);
      }
    });
    socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('CDP socket closed'));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    this.id += 1;
    const id = this.id;
    return new Promise((done, reject) => {
      this.pending.set(id, { resolve: done, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 60000);
    });
  }
}

let serverHandle = null;
let chrome = null;
try {
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  serverHandle = server;
  await mkdir(resolve(outPath, '..'), { recursive: true });
  chrome = spawn(chromePath, [
    '--headless=new',
    '--hide-scrollbars',
    '--mute-audio',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' });
  const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new Error('no page target');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const cdp = new Cdp(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  const url = `http://127.0.0.1:${port}/${query}`;
  await cdp.send('Page.navigate', { url });
  let ready = false;
  for (let i = 0; i < 220; i += 1) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'window.__PALMSHORE_READY__ === true && document.readyState === "complete"',
      returnByValue: true,
    }).catch(() => ({ result: { value: false } }));
    if (result.result?.value === true) {
      ready = true;
      break;
    }
    await wait(150);
  }
  if (!ready) {
    const diag = await cdp.send('Runtime.evaluate', {
      expression: 'JSON.stringify({ready: window.__PALMSHORE_READY__, err: window.__PALMSHORE_ERROR__ || null, title: document.title})',
      returnByValue: true,
    }).catch(() => null);
    throw new Error(`scene never reported ready: ${diag?.result?.value ?? 'no diagnostic'}`);
  }
  await wait(settle);
  const metrics = await cdp.send('Page.getLayoutMetrics');
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality,
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const buffer = Buffer.from(shot.data, 'base64');
  await writeFile(outPath, buffer);
  const info = await stat(outPath);
  console.log(`${outPath} · ${info.size} bytes · viewport ${width}x${height} · css ${metrics.cssVisualViewport?.clientWidth}x${metrics.cssVisualViewport?.clientHeight}`);
  socket.close();
} catch (error) {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
} finally {
  if (chrome) chrome.kill('SIGKILL');
  if (serverHandle) serverHandle.close();
}
