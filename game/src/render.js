// The renderer: one WebGL scene, one sun with long shadows, warm fog, and the sky dome.
// Game systems add their own meshes; this file owns the stage and the lights.

import { CLOCK, VIEW, WORLD } from './config.js';
import { buildSky, updateSky } from './sky.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setClearColor(CLOCK.fog);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(CLOCK.fog, WORLD.fogNear, WORLD.fogFar);

    this.camera = new THREE.PerspectiveCamera(VIEW.fov, 16 / 9, VIEW.near, VIEW.far);
    this.camera.position.set(0, 8, 20);

    const hemi = new THREE.HemisphereLight('#ffd6a4', '#4a4034', 0.46);
    this.scene.add(hemi);
    const ambient = new THREE.AmbientLight('#ffb87a', 0.12);
    this.scene.add(ambient);

    this.sun = new THREE.DirectionalLight('#ffc07c', 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -48;
    this.sun.shadow.camera.right = 48;
    this.sun.shadow.camera.top = 48;
    this.sun.shadow.camera.bottom = -48;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 190;
    this.sun.shadow.bias = -0.0007;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun);
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    // Cool bounce from the sea, low and without shadows.
    this.fill = new THREE.DirectionalLight('#8fd3df', 0.35);
    this.fill.position.set(80, 22, 30);
    this.scene.add(this.fill);

    this.sky = buildSky(this.scene);
    this.width = 1280;
    this.height = 480;
    this.time = 0;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(focus, time) {
    this.time = time;
    const fx = focus?.x ?? 0;
    const fz = focus?.z ?? 0;
    this.sunTarget.position.set(fx, 0, fz);
    this.sunTarget.updateMatrixWorld();
    this.sun.position.set(fx - 58, 20, fz + 18);
    this.fill.position.set(fx + 70, 24, fz + 20);
    updateSky(this.sky, this.camera, time);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  get info() {
    return this.renderer.info.render;
  }
}

export function toneColor(hex, amount) {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  hsl.l = Math.max(0, Math.min(1, hsl.l + amount));
  color.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${color.getHexString()}`;
}
