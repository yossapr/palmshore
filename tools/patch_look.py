from pathlib import Path

# --- world: closer sea, no street sign clutter, east-facing storefronts, wave crests
p = Path('game/src/config.js')
s = p.read_text(encoding='utf-8')
s = s.replace("  beach: 48,", "  beach: 32,")
p.write_text(s, encoding='utf-8')

p = Path('game/src/roads.js')
s = p.read_text(encoding='utf-8')
s = s.replace("    this.buildSignals(group);\n    this.buildStreetSigns(group);", "    this.buildSignals(group);")
p.write_text(s, encoding='utf-8')

p = Path('game/src/world.js')
s = p.read_text(encoding='utf-8')
# east-first lots for beach-side blocks
s = s.replace("      for (let i = 0; i < 2; i += 1) {\n        for (let j = 0; j < 2; j += 1) {", "      for (let i = 1; i >= 0; i -= 1) {\n        for (let j = 1; j >= 0; j -= 1) {")
# force east frontage on the beach blocks
s = s.replace("  frontSide(info, plot) {\n    const rect = info.rect;", "  frontSide(info, plot) {\n    const rect = info.rect;\n    if (info.col >= 5) return 'e';")
# larger blade signs
s = s.replace("    const bladePlane = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.98), bladeMat);\n    bladePlane.position.z = 0.012;\n    blade.add(bladePlane);\n    const bladeBack = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.98), bladeMat);", "    const bladePlane = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.25), bladeMat);\n    bladePlane.position.z = 0.012;\n    blade.add(bladePlane);\n    const bladeBack = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.25), bladeMat);")
s = s.replace("    blade.position.set(bx, base + 4.55, bz);", "    blade.position.set(bx, base + 5.1, bz);")
# sea wave crests
s = s.replace("    this.sea = sea;", "    this.sea = sea;\n    const crestMat = new THREE.MeshBasicMaterial({ color: '#d8efe6', transparent: true, opacity: 0.34 });\n    for (let i = 0; i < 34; i += 1) {\n      const crest = new THREE.Mesh(new THREE.PlaneGeometry(this.rng.range(2.5, 10), 0.24), crestMat);\n      crest.rotation.x = -Math.PI / 2;\n      crest.position.set(this.rng.range(CITY.waterX + 2, CITY.waterX + 210), 0.03, this.rng.range(-20, 360));\n      this.group.add(crest);\n    }")
p.write_text(s, encoding='utf-8')

# --- marker icon bigger
p = Path('game/src/missions.js')
s = p.read_text(encoding='utf-8')
s = s.replace("  icon.scale.set(1.5, 1.5, 1);", "  icon.scale.set(2.3, 2.3, 1);")
s = s.replace("  icon.position.y = 4.6;", "  icon.position.y = 5.4;")
s = s.replace("      marker.icon.position.y = 4.6 + Math.sin(this.time * 2.2) * 0.16;", "      marker.icon.position.y = 5.4 + Math.sin(this.time * 2.2) * 0.2;")
p.write_text(s, encoding='utf-8')

# --- HUD: bigger ability cards, district label pill, compass letters
p = Path('game/src/hud.js')
s = p.read_text(encoding='utf-8')
s = s.replace("      const cy = ay + i * 30;", "      const cy = ay + i * 36;")
s = s.replace("      rounded(ctx, x, cy, totalW, 27, 3);", "      rounded(ctx, x, cy, totalW, 33, 3);")
s = s.replace("      rounded(ctx, x + 0.5, cy + 0.5, totalW - 1, 26, 3);", "      rounded(ctx, x + 0.5, cy + 0.5, totalW - 1, 32, 3);")
s = s.replace("      rounded(ctx, x + 4, cy + 4, 17, 17, 3);", "      rounded(ctx, x + 4, cy + 5, 21, 21, 3);")
s = s.replace("      this.text(ctx, ability.key, x + 12.5, cy + 16.5, {", "      this.text(ctx, ability.key, x + 14.5, cy + 19.5, {")
s = s.replace("        size: 11, color: UI.ink, align: 'center', weight: 800, family: FONTS.mono,", "        size: 12.5, color: UI.ink, align: 'center', weight: 800, family: FONTS.mono,")
s = s.replace("      this.text(ctx, ability.name, x + 28, cy + 12, {\n        size: 10.5, color: UI.cream, weight: 800, tracking: 0.8,\n      });\n      this.text(ctx, ability.desc, x + 28, cy + 22, {\n        size: 10, color: UI.creamDim, weight: 600,\n      });", "      this.text(ctx, ability.name, x + 32, cy + 14, {\n        size: 11.5, color: UI.cream, weight: 800, tracking: 0.8,\n      });\n      this.text(ctx, ability.desc, x + 32, cy + 26, {\n        size: 11.5, color: UI.creamDim, weight: 600,\n      });")
s = s.replace("        this.text(ctx, `${Math.ceil(cooldown)}s`, x + totalW - 6, cy + 16, {", "        this.text(ctx, `${Math.ceil(cooldown)}s`, x + totalW - 6, cy + 19, {")
s = s.replace("    ctx.fillStyle = district.accent;\n    ctx.fillRect(x + 1, y - 17, 4, 11);", "    ctx.fillStyle = 'rgba(10, 20, 25, 0.88)';\n    rounded(ctx, x - 2, y - 22, 178, 21, 3);\n    ctx.fill();\n    ctx.fillStyle = district.accent;\n    ctx.fillRect(x + 1, y - 18, 4, 12);")
s = s.replace("      size: 12.5, color: UI.cream, weight: 800, tracking: 1.6,", "      size: 13, color: UI.cream, weight: 800, tracking: 1.5,")
p.write_text(s, encoding='utf-8')

p = Path('game/src/minimap.js')
s = p.read_text(encoding='utf-8')
s = s.replace("    ctx.font = '700 10px Consolas, monospace';", "    ctx.font = '800 12px Consolas, monospace';")
s = s.replace("      const r = size * 0.49;", "      const r = size * 0.485;")
p.write_text(s, encoding='utf-8')

print('patched world, hud, minimap')
