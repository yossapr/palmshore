from pathlib import Path

p = Path('game/src/world.js')
s = p.read_text()

helper = '''function verticalSignTexture(name, accent) {
  const key = `v:${name}`;
  if (signCache.has(key)) return signCache.get(key);
  const canvas = canvas2d(128, 512);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0e1d24';
  ctx.fillRect(0, 0, 128, 512);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 120, 504);
  ctx.font = '800 44px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letters = name.replace(/ /g, '').slice(0, 10).split('');
  letters.forEach((letter, i) => {
    ctx.fillStyle = i % 2 === 0 ? '#f7efdc' : accent;
    ctx.fillText(letter, 64, 60 + i * 44);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  signCache.set(key, texture);
  return texture;
}

function sidewalkTexture() {
  const key = 'sidewalk-tile';
  if (signCache.has(key)) return signCache.get(key);
  const canvas = canvas2d(256, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cdc4ae';
  ctx.fillRect(0, 0, 256, 256);
  const rng = new Rng(0x51de);
  for (let i = 0; i < 500; i += 1) {
    const r = rng.int(80, 150);
    const g = rng.int(76, 140);
    const b = rng.int(66, 120);
    ctx.fillStyle = `rgba(${r},${g},${b},${rng.range(0.035, 0.12)})`;
    ctx.fillRect(rng.range(0, 256), rng.range(0, 256), rng.range(1, 4), rng.range(1, 2));
  }
  ctx.strokeStyle = 'rgba(96, 88, 74, 0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(110, 100, 82, 0.18)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    let x = rng.range(10, 240);
    let y = rng.range(10, 240);
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j += 1) {
      x += rng.range(-14, 14);
      y += rng.range(4, 20);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.anisotropy = 4;
  signCache.set(key, texture);
  return texture;
}

export class World {'''
s = s.replace('export class World {', helper, 1)

old = """        this.box(rect.w + 0.5, 0.13, rect.d + 0.5, rect.x + rect.w / 2, 0.045, rect.z + rect.d / 2, CLOCK.curb, this.group, { castShadow: false });
        this.box(rect.w, 0.2, rect.d, rect.x + rect.w / 2, 0.1, rect.z + rect.d / 2, CLOCK.sidewalk, this.group, { castShadow: false });
        this.buildLots(info, district, walk);"""
new = """        this.box(rect.w + 0.5, 0.13, rect.d + 0.5, rect.x + rect.w / 2, 0.045, rect.z + rect.d / 2, CLOCK.curb, this.group, { castShadow: false });
        this.box(rect.w, 0.2, rect.d, rect.x + rect.w / 2, 0.1, rect.z + rect.d / 2, CLOCK.sidewalk, this.group, { castShadow: false });
        const walkMat = new THREE.MeshLambertMaterial({ map: sidewalkTexture() });
        const walkTop = new THREE.Mesh(new THREE.PlaneGeometry(rect.w, rect.d), walkMat);
        walkTop.rotation.x = -Math.PI / 2;
        walkTop.position.set(rect.x + rect.w / 2, 0.202, rect.z + rect.d / 2);
        walkTop.receiveShadow = true;
        this.group.add(walkTop);
        this.buildLots(info, district, walk);"""
assert old in s
s = s.replace(old, new)

old = """      const band = new THREE.Mesh(new THREE.BoxGeometry(plot.w + 0.12, 1.05, plot.d + 0.12), glassMat);
      band.position.set(cx, y, cz);
      band.castShadow = false;
      band.receiveShadow = false;
      this.group.add(band);
    }"""
new = """      const band = new THREE.Mesh(new THREE.BoxGeometry(plot.w + 0.03, 0.9, plot.d + 0.03), glassMat);
      band.position.set(cx, y, cz);
      band.castShadow = false;
      band.receiveShadow = false;
      this.group.add(band);
    }
    // Corner fins give the low-poly boxes a sense of structure.
    for (const [fx, fz] of [
      [plot.x + 0.28, plot.z + 0.28], [plot.x + plot.w - 0.28, plot.z + 0.28],
      [plot.x + 0.28, plot.z + plot.d - 0.28], [plot.x + plot.w - 0.28, plot.z + plot.d - 0.28],
    ]) {
      this.box(0.42, height, 0.42, fx, base + height / 2, fz, roofColor, this.group, { castShadow: false });
    }"""
assert old in s
s = s.replace(old, new)

old = """    this.group.add(blade);
    void height;
  }"""
new = """    this.group.add(blade);
    // Landmark storefronts get a rooftop billboard and a tall neon blade, so the
    // beachfront reads as a named strip from down the road.
    const iconic = ['SUNFADE LIQUOR', 'MANGO TANGO', 'SEAGLASS HOTEL', 'THE NEON CONCH', 'PELICAN PAWN', 'MARLIN HARDWARE'];
    if (iconic.includes(sign.name)) {
      const rooftop = new THREE.Group();
      const billW = Math.min(plot.w - 1, 8);
      const bill = new THREE.Mesh(
        new THREE.PlaneGeometry(billW, billW * 0.23),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
      );
      bill.position.set(t.x + outward.x * 0.7, base + Math.max(height + 2.4, 7.2), t.z + outward.z * 0.7);
      bill.rotation.y = t.rot;
      rooftop.add(bill);
      for (const dx of [-billW * 0.33, billW * 0.33]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), this.material('#2c383d'));
        pole.position.set(
          t.x + outward.x * 0.7 + Math.cos(t.rot) * dx,
          base + Math.max(height + 1.1, 5.9),
          t.z + outward.z * 0.7 + Math.sin(t.rot) * dx,
        );
        rooftop.add(pole);
      }
      this.group.add(rooftop);
      const vtex = verticalSignTexture(sign.name, sign.color);
      const vmat = new THREE.MeshBasicMaterial({ map: vtex, side: THREE.FrontSide });
      const vgroup = new THREE.Group();
      vgroup.position.set(t.x + outward.x * 0.55, base + 4.7, t.z + outward.z * 0.55);
      vgroup.rotation.y = t.rot + Math.PI / 2;
      const vplane = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 4.0), vmat);
      vplane.position.z = 0.07;
      vgroup.add(vplane);
      const vback = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 4.0), vmat);
      vback.rotation.y = Math.PI;
      vback.position.z = -0.07;
      vgroup.add(vback);
      this.group.add(vgroup);
    }
    void district;
    void height;
  }"""
assert old in s
s = s.replace(old, new)

old = """    this.makeLifeguardTower(CITY.beachX + 30, 158);
    this.landmarks.set('CORAL BEACH', { x: CITY.beachX + 24, z: 150 });"""
new = """    this.makeLifeguardTower(CITY.beachX + 30, 158);
    for (let i = 0; i < 3; i += 1) {
      const x = CITY.beachX + 13 + i * 13;
      const z = 34 + i * 52;
      const shack = new THREE.Group();
      shack.position.set(x, 0.02, z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.3, 3.0), this.material(['#e8b54a', '#ff8a5b', '#7fc9c0'][i]));
      body.position.y = 1.15;
      body.castShadow = true;
      shack.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 3.5), this.material('#f2e2bf'));
      roof.position.y = 2.4;
      roof.rotation.z = 0.05;
      shack.add(roof);
      const hatch = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), new THREE.MeshBasicMaterial({ color: '#2a4a50', side: THREE.DoubleSide }));
      hatch.position.set(0, 1.5, 1.51);
      shack.add(hatch);
      this.group.add(shack);
    }
    this.landmarks.set('CORAL BEACH', { x: CITY.beachX + 24, z: 150 });"""
assert old in s
s = s.replace(old, new)
p.write_text(s)

p = Path('game/src/render.js')
s = p.read_text()
s = s.replace("new THREE.HemisphereLight('#ffd6a4', '#5b5142', 0.72)", "new THREE.HemisphereLight('#ffd6a4', '#4a4034', 0.46)")
s = s.replace("new THREE.AmbientLight('#ffb87a', 0.2)", "new THREE.AmbientLight('#ffb87a', 0.12)")
s = s.replace("new THREE.DirectionalLight('#ffc890', 2.4)", "new THREE.DirectionalLight('#ffc07c', 3.1)")
s = s.replace("this.sun.shadow.camera.left = -58;\n    this.sun.shadow.camera.right = 58;\n    this.sun.shadow.camera.top = 58;\n    this.sun.shadow.camera.bottom = -58;", "this.sun.shadow.camera.left = -48;\n    this.sun.shadow.camera.right = 48;\n    this.sun.shadow.camera.top = 48;\n    this.sun.shadow.camera.bottom = -48;")
s = s.replace("this.sun.position.set(fx - 72, 30, fz + 22);", "this.sun.position.set(fx - 58, 20, fz + 18);")
s = s.replace("this.renderer.toneMappingExposure = 1.06;", "this.renderer.toneMappingExposure = 1.02;")
p.write_text(s)

p = Path('game/src/config.js')
s = p.read_text()
s = s.replace("skyTop: '#1d4266'", "skyTop: '#2a5678'")
s = s.replace("skyMid: '#7f8fa0'", "skyMid: '#a38f90'")
s = s.replace("horizon: '#ffcf92'", "horizon: '#ffcb8b'")
s = s.replace("fog: '#eeb887'", "fog: '#e9b489'")
p.write_text(s)

p = Path('game/src/sky.js')
s = p.read_text()
# Remove the cloud construction entirely.
start = s.index('  const cloudMat = new THREE.SpriteMaterial')
end = s.index('  scene.add(skyGroup);')
s = s[:start] + '  // The shader sky carries the haze; no sprites needed above the horizon.\n\n' + s[end:]
p.write_text(s)
print('patched world, render, config, sky')
