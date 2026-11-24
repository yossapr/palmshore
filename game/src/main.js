// Skeleton boot: build the stage, the city, a walkable stand-in, and prove the sun works.

import { WORLD, CITY, CLOCK } from './config.js';
import { Renderer } from './render.js';
import { Roads } from './roads.js';
import { World } from './world.js';
import { ChaseCamera } from './camera.js';
import { Input } from './input.js';
import { clamp, wrapAngle } from './math.js';

const worldCanvas = document.getElementById('world');
const hudCanvas = document.getElementById('hud');
const hud = hudCanvas.getContext('2d');
const renderer = new Renderer(worldCanvas);
const roads = new Roads(WORLD.seed);
roads.buildMeshes(renderer.scene);
const world = new World(renderer.scene, roads);
const chase = new ChaseCamera(renderer.camera);
const input = new Input(hudCanvas);

const params = new URLSearchParams(location.search);
const player = {
  x: Number(params.get('x') ?? 361.4),
  z: Number(params.get('z') ?? 152),
  y: 0.2,
  heading: Number(params.get('yaw') ?? -Math.PI / 2),
  speed: 0, walkPhase: 0,
};
const stand = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.34), new THREE.MeshLambertMaterial({ color: '#d96f5f' }));
body.position.y = 1.0;
body.castShadow = true;
stand.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshLambertMaterial({ color: '#c78e63' }));
head.position.y = 1.65;
head.castShadow = true;
stand.add(head);
renderer.scene.add(stand);
chase.reset(player, player.heading);

let width = 1280;
let height = 720;
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  renderer.resize(width, height);
  hudCanvas.width = Math.round(width * Math.min(window.devicePixelRatio || 1, 2));
  hudCanvas.height = Math.round(height * Math.min(window.devicePixelRatio || 1, 2));
  hudCanvas.style.width = `${width}px`;
  hudCanvas.style.height = `${height}px`;
  hud.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);
}
resize();
window.addEventListener('resize', resize);
document.getElementById('boot')?.classList.add('hidden');

const clock = new THREE.Clock();
let gameTime = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  gameTime += dt;
  const { dx, dy } = input.consumeMouseDelta();
  if (dx || dy) chase.orbit(dx, dy);
  const axis = input.axis();
  const forward = { x: Math.cos(chase.yaw), z: Math.sin(chase.yaw) };
  const right = { x: -forward.z, z: forward.x };
  let mx = forward.x * -axis.y + right.x * axis.x;
  let mz = forward.z * -axis.y + right.z * axis.x;
  const len = Math.hypot(mx, mz);
  const moving = len > 0.01;
  if (moving) {
    mx /= len;
    mz /= len;
    player.heading = Math.atan2(mz, mx);
    const speed = 4.6;
    player.x += mx * speed * dt;
    player.z += mz * speed * dt;
    player.walkPhase += dt * 9;
  }
  world.resolveCircle(player, 0.42);
  player.x = clamp(player.x, 1, CITY.waterX - 1.2);
  player.z = clamp(player.z, 1, WORLD.rows * WORLD.pitch + 40);
  player.y = world.heightAt(player.x, player.z);
  stand.position.set(player.x, player.y, player.z);
  stand.rotation.y = -player.heading + Math.PI / 2;

  chase.update({ x: player.x, y: player.y + 0.9, z: player.z, heading: player.heading }, dt, {
    mode: 'foot', moving, moveYaw: player.heading, speed: 4.6,
  });
  renderer.update({ x: player.x, z: player.z }, gameTime);
  roads.updateSignals(gameTime);
  world.update(gameTime);
  renderer.render();

  hud.clearRect(0, 0, width, height);
  hud.fillStyle = 'rgba(14, 26, 32, 0.78)';
  hud.fillRect(24, 24, 330, 86);
  hud.fillStyle = CLOCK.horizon;
  hud.font = '700 13px "Trebuchet MS", Arial, sans-serif';
  hud.fillText('SKELETON ONLINE · CITY WALKABLE', 42, 52);
  hud.fillStyle = '#f7efdc';
  hud.font = '700 18px "Trebuchet MS", Arial, sans-serif';
  hud.fillText(`${CLOCK.label} · ${Math.round(player.x)}, ${Math.round(player.z)}`, 42, 82);
  hud.font = '600 11px "Trebuchet MS", Arial, sans-serif';
  hud.fillStyle = '#d9d0bb';
  hud.fillText('WASD TO WALK · MOUSE TO LOOK', 42, 100);

  input.endFrame();
  frames += 1;
  if (frames > 20) window.__PALMSHORE_READY__ = true;
  requestAnimationFrame(frame);
}
let frames = 0;
requestAnimationFrame(frame);
