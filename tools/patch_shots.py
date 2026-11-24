from pathlib import Path

p = Path('game/src/hud.js')
s = p.read_text(encoding='utf-8')
s = s.replace("        size: 14, color: UI.cream, weight: 600,\n      });\n    });\n    ctx.fillStyle = 'rgba(247, 239, 220, 0.08)';", "        size: 15, color: UI.cream, weight: 600,\n      });\n    });\n    ctx.fillStyle = 'rgba(247, 239, 220, 0.08)';")
p.write_text(s, encoding='utf-8')

p = Path('game/src/world.js')
s = p.read_text(encoding='utf-8')
old = """      this.group.add(rooftop);
      const vtex = verticalSignTexture(sign.name, sign.color);"""
new = """      // A second billboard across the roofline, facing down the avenue.
      const cross = new THREE.Mesh(
        new THREE.PlaneGeometry(billW * 0.86, billW * 0.2),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
      );
      cross.position.set(
        t.x + outward.x * 0.9 + Math.cos(t.rot) * billW * 0.32,
        base + Math.max(height + 2.7, 7.5),
        t.z + outward.z * 0.9 + Math.sin(t.rot) * billW * 0.32,
      );
      cross.rotation.y = t.rot + Math.PI / 2;
      rooftop.add(cross);
      this.group.add(rooftop);
      const vtex = verticalSignTexture(sign.name, sign.color);"""
assert old in s
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

p = Path('game/src/shots.js')
s = p.read_text(encoding='utf-8')
# Street placement
s = s.replace("  game.player.setPosition(425.2, 174, -Math.PI / 2);\n  game.player.health = 100;", "  game.player.setPosition(445.4, 174, -1.44);\n  game.chase.yaw = -1.44;\n  game.chase.aimYaw = -1.44;\n  game.player.health = 100;")
s = s.replace("    snapShotCamera(game, -Math.PI / 2, 5.9, 3.02, 0.25);", "    game.player.heading = -1.44;\n    snapShotCamera(game, -1.44, 6.1, 3.05, 0.25);")
# Add promenade peds to streetLife
s = s.replace("    { x: 424.8, z: 108, state: 'walk', heading: -Math.PI / 2, tx: 424.8, tz: 132 },\n", "    { x: 424.8, z: 108, state: 'walk', heading: -Math.PI / 2, tx: 424.8, tz: 132 },\n    { x: 446.2, z: 150, state: 'walk', heading: -Math.PI / 2, tx: 446.2, tz: 126 },\n    { x: 447.1, z: 196, state: 'walk', heading: Math.PI, tx: 447.1, tz: 220 },\n    { x: 444.8, z: 226, state: 'idle', heading: -Math.PI / 2 },\n")
# Story placement
s = s.replace("    game.player.setPosition(424.4, 236, -Math.PI / 2);", "    game.player.setPosition(445.2, 238, -1.5);\n    game.chase.yaw = -1.5;\n    game.chase.aimYaw = -1.5;")
s = s.replace("      snapShotCamera(game, -Math.PI / 2, 5.6, 3.05, 0.25);", "      game.player.heading = -1.5;\n      snapShotCamera(game, -1.5, 5.9, 3.05, 0.25);")
# Wanted placement and police positions
s = s.replace("    game.player.setPosition(423.6, 175, -Math.PI / 2);", "    game.player.setPosition(429.2, 176, -Math.PI / 2);\n    game.chase.yaw = -Math.PI / 2;\n    game.chase.aimYaw = -Math.PI / 2;")
s = s.replace("    game.police.spawnCruiser('PURSUIT', { x: 432, z: 160, heading: Math.PI / 2 });\n    game.police.spawnCruiser('RAMMING', { x: 414, z: 186, heading: 0 });\n    game.police.spawnOfficer('MARKSMAN', { x: 429.6, z: 198 });", "    game.police.spawnCruiser('PURSUIT', { x: 438.2, z: 164, heading: Math.PI / 2 });\n    game.police.spawnCruiser('RAMMING', { x: 413, z: 186, heading: 0 });")
# Peds for wanted (promenade)
s = s.replace("    addPeds(game, [\n      { x: 444, z: 160, state: 'idle', heading: Math.PI },\n      { x: 448, z: 192, state: 'walk', heading: Math.PI / 2, tx: 448, tz: 218 },\n    ]);", "    addPeds(game, [\n      { x: 446, z: 158, state: 'idle', heading: Math.PI },\n      { x: 448, z: 196, state: 'flee', heading: Math.PI / 2 },\n    ]);")
p.write_text(s, encoding='utf-8')
print('patched')
