// Golden-hour sky: a gradient dome, a low sun, soft horizon clouds and a sea haze band.

import { CLOCK, VIEW } from './config.js';

function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  const blobs = [
    [52, 36, 44, 14], [92, 30, 54, 17], [138, 36, 46, 13],
    [176, 32, 38, 12], [208, 38, 30, 10],
  ];
  for (const [x, y, rx, ry] of blobs) {
    const grad = ctx.createRadialGradient(x, y, 1, x, y, rx);
    grad.addColorStop(0, 'rgba(255, 232, 205, 0.55)');
    grad.addColorStop(0.55, 'rgba(255, 214, 180, 0.22)');
    grad.addColorStop(1, 'rgba(255, 200, 170, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildSky(scene) {
  const skyGroup = new THREE.Group();
  skyGroup.name = 'sky';
  const uniforms = {
    topColor: { value: new THREE.Color(CLOCK.skyTop) },
    midColor: { value: new THREE.Color(CLOCK.skyMid) },
    horizonColor: { value: new THREE.Color(CLOCK.horizon) },
    sunColor: { value: new THREE.Color('#ffe0a8') },
    sunDirection: { value: new THREE.Vector3(CLOCK.sun.x, CLOCK.sun.y, CLOCK.sun.z).normalize() },
  };
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      varying vec3 vPos;
      void main() {
        vec3 dir = normalize(vPos);
        float h = clamp(dir.y, -0.2, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.2, h));
        col = mix(col, topColor, smoothstep(0.16, 0.72, h));
        float sun = max(dot(dir, normalize(sunDirection)), 0.0);
        col += sunColor * pow(sun, 42.0) * 0.65;
        col += sunColor * pow(sun, 6.0) * 0.09;
        float band = smoothstep(0.03, 0.0, abs(h - 0.02));
        col = mix(col, horizonColor * 1.06, band * 0.55);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), skyMaterial);
  skyGroup.add(sky);

  // A visible sun disc, low in the west.
  const sunPos = new THREE.Vector3(CLOCK.sun.x, CLOCK.sun.y, CLOCK.sun.z).normalize().multiplyScalar(430);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(12, 24),
    new THREE.MeshBasicMaterial({ color: '#fff2cf', fog: false, transparent: true, opacity: 0.95 }),
  );
  sun.position.copy(sunPos);
  sun.lookAt(0, 0, 0);
  skyGroup.add(sun);
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 256;
  haloCanvas.height = 256;
  const hctx = haloCanvas.getContext('2d');
  const grad = hctx.createRadialGradient(128, 128, 8, 128, 128, 124);
  grad.addColorStop(0, 'rgba(255, 235, 190, 0.85)');
  grad.addColorStop(0.28, 'rgba(255, 201, 132, 0.34)');
  grad.addColorStop(1, 'rgba(255, 180, 100, 0)');
  hctx.fillStyle = grad;
  hctx.fillRect(0, 0, 256, 256);
  const haloTexture = new THREE.CanvasTexture(haloCanvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, fog: false,
  }));
  halo.scale.set(150, 150, 1);
  halo.position.copy(sunPos);
  skyGroup.add(halo);

  // The shader sky carries the haze; no sprites needed above the horizon.

  scene.add(skyGroup);
  return { group: skyGroup, uniforms, sun };
}

export function updateSky(sky, camera, time) {
  sky.group.position.set(camera.position.x, 0, camera.position.z);
}

export const SKY_FOV = VIEW.fov;
