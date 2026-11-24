from pathlib import Path

p = Path('game/src/hud.js')
s = p.read_text(encoding='utf-8')
reps = [
("    const y = 128;\n    const slotW = 48;", "    const y = 154;\n    const slotW = 48;"),
("      const cy = ay + i * 29;", "      const cy = ay + i * 30;"),
("      rounded(ctx, x, cy, totalW, 25, 3);", "      rounded(ctx, x, cy, totalW, 27, 3);"),
("      rounded(ctx, x + 0.5, cy + 0.5, totalW - 1, 24, 3);", "      rounded(ctx, x + 0.5, cy + 0.5, totalW - 1, 26, 3);"),
("      this.text(ctx, ability.name, x + 28, cy + 12, {\n        size: 9.5, color: UI.cream, weight: 800, tracking: 0.8,\n      });\n      this.text(ctx, ability.desc, x + 28, cy + 21, {\n        size: 9.5, color: UI.creamDim, weight: 600,\n      });", "      this.text(ctx, ability.name, x + 28, cy + 12, {\n        size: 10.5, color: UI.cream, weight: 800, tracking: 0.8,\n      });\n      this.text(ctx, ability.desc, x + 28, cy + 22, {\n        size: 10, color: UI.creamDim, weight: 600,\n      });"),
("    this.text(ctx, 'WEAPONS · 1—5', x + totalW, y - 7, {\n      size: 9, color: UI.creamDim, align: 'right', weight: 800, tracking: 1.7,\n    });", "    this.text(ctx, 'WEAPONS · 1—5', x + totalW, y - 7, {\n      size: 10, color: UI.creamDim, align: 'right', weight: 800, tracking: 1.7,\n    });"),
("      this.text(ctx, String(i + 1), sx + 5, y + 12, {\n        size: 9, color: active ? UI.gold : UI.creamDim, family: FONTS.mono, weight: 700,\n      });", "      this.text(ctx, String(i + 1), sx + 5, y + 12, {\n        size: 10, color: active ? UI.gold : UI.creamDim, family: FONTS.mono, weight: 700,\n      });"),
("      this.text(ctx, def.short, sx + slotW / 2, y + 26, {\n        size: 10, color: owned ? UI.cream : 'rgba(247, 239, 220, 0.3)', align: 'center', weight: 800, tracking: 0.7,\n      });", "      this.text(ctx, def.short, sx + slotW / 2, y + 27, {\n        size: 11, color: owned ? UI.cream : 'rgba(247, 239, 220, 0.3)', align: 'center', weight: 800, tracking: 0.7,\n      });"),
("        size: 15, color: active ? UI.gold : owned ? UI.cream : 'rgba(247, 239, 220, 0.3)',", "        size: 16, color: active ? UI.gold : owned ? UI.cream : 'rgba(247, 239, 220, 0.3)',"),
("    this.text(ctx, 'PALMSHORE', x + size + 2, y - 7, {\n      size: 9, color: UI.creamDim, weight: 700, tracking: 1.4, align: 'right',\n    });\n", ""),
("    this.text(ctx, district.name, x + 11, y - 7, {\n      size: 11.5, color: UI.cream, weight: 800, tracking: 1.6,\n    });", "    this.text(ctx, district.name, x + 11, y - 7, {\n      size: 12.5, color: UI.cream, weight: 800, tracking: 1.6,\n    });"),
("    this.text(ctx, state, x + 2, y + size + 17, {\n      size: 11, color: game.police.wanted > 0 ? UI.coral : UI.mint, weight: 800, family: FONTS.mono, tracking: 0.8,\n    });", "    this.text(ctx, state, x + 2, y + size + 18, {\n      size: 12, color: game.police.wanted > 0 ? UI.coral : UI.mint, weight: 800, family: FONTS.mono, tracking: 0.8,\n    });"),
("    this.text(ctx, label, x, y + 9, {\n      size: 9.5, color: UI.creamDim, weight: 800, tracking: 1.8,\n    });", "    this.text(ctx, label, x, y + 10, {\n      size: 10.5, color: UI.creamDim, weight: 800, tracking: 1.8,\n    });"),
("    this.text(ctx, String(Math.round(value)), x + w, y + 9, {\n      size: 12, color: UI.cream, align: 'right', family: FONTS.mono, weight: 700,\n    });", "    this.text(ctx, String(Math.round(value)), x + w, y + 10, {\n      size: 13, color: UI.cream, align: 'right', family: FONTS.mono, weight: 700,\n    });"),
("    this.text(ctx, 'CASH', x + panelW - 14, y + 20, {\n      size: 9, color: UI.creamDim, align: 'right', weight: 700, tracking: 1.7,\n    });\n    this.text(ctx, player.rank.name, x + panelW - 14, y + 34, {\n      size: 10, color: UI.gold, align: 'right', weight: 800, tracking: 0.7,\n    });", "    this.text(ctx, 'CASH', x + panelW - 14, y + 20, {\n      size: 10, color: UI.creamDim, align: 'right', weight: 700, tracking: 1.7,\n    });\n    this.text(ctx, player.rank.name, x + panelW - 14, y + 34, {\n      size: 10.5, color: UI.gold, align: 'right', weight: 800, tracking: 0.7,\n    });"),
("      size: 9, color: police.wanted > 0 ? '#ffd166' : UI.creamDim, weight: 800, tracking: 1.6,", "      size: 10, color: police.wanted > 0 ? '#ffd166' : UI.creamDim, weight: 800, tracking: 1.6,"),
("      size: 13, color: police.wanted > 0 ? '#a8d4ff' : UI.creamDim, weight: 700, tracking: 0.2,", "      size: 13.5, color: police.wanted > 0 ? '#a8d4ff' : UI.creamDim, weight: 700, tracking: 0.2,"),
("    this.text(ctx, 'RANK', x + 14, y + 98, {\n      size: 9, color: UI.creamDim, weight: 700, tracking: 1.6,\n    });", "    this.text(ctx, 'RANK', x + 14, y + 98, {\n      size: 10, color: UI.creamDim, weight: 700, tracking: 1.6,\n    });"),
("    this.text(ctx, player.rank.name, x + 52, y + 98, {\n      size: 11, color: UI.cream, weight: 800, tracking: 0.5,\n    });", "    this.text(ctx, player.rank.name, x + 54, y + 98, {\n      size: 11.5, color: UI.cream, weight: 800, tracking: 0.5,\n    });"),
("    this.text(ctx, `${player.rp} / ${player.nextRankRp} RP`, x + panelW - 14, y + 98, {\n      size: 10, color: UI.creamDim, align: 'right', family: FONTS.mono, weight: 600,\n    });", "    this.text(ctx, `${player.rp} / ${player.nextRankRp} RP`, x + panelW - 14, y + 98, {\n      size: 10.5, color: UI.creamDim, align: 'right', family: FONTS.mono, weight: 600,\n    });"),
("      this.text(ctx, unit.role, x + 88, rowY + 8, {\n        size: 10, color: UI.creamDim, weight: 700, tracking: 1.3,\n      });", "      this.text(ctx, unit.role, x + 92, rowY + 8, {\n        size: 11.5, color: UI.creamDim, weight: 700, tracking: 1.3,\n      });"),
("    this.text(ctx, 'ACTIVE JOB', x + 16, y + 18, { size: 10, color: card.accent, weight: 800, tracking: 2.1 });", "    this.text(ctx, 'ACTIVE JOB', x + 16, y + 18, { size: 11, color: card.accent, weight: 800, tracking: 2.1 });"),
("      size: 12, color: card.accent, weight: 800, tracking: 1.1,", "      size: 12.5, color: card.accent, weight: 800, tracking: 1.1,"),
("      size: 14.5, color: UI.cream, weight: 800, tracking: 0.3,", "      size: 15.5, color: UI.cream, weight: 800, tracking: 0.3,"),
("    this.text(ctx, 'NEXT', x + 16, nextY, {\n      size: 9.5, color: card.accent, weight: 800, tracking: 2,\n    });\n    this.text(ctx, card.next, x + 58, nextY, {\n      size: 12, color: UI.creamDim, weight: 600,\n    });", "    this.text(ctx, 'NEXT', x + 16, nextY, {\n      size: 10.5, color: card.accent, weight: 800, tracking: 2,\n    });\n    this.text(ctx, card.next, x + 60, nextY, {\n      size: 12.5, color: UI.creamDim, weight: 600,\n    });"),
("    this.text(ctx, line.character.title, x + 84, y + 35, {\n      size: 8.5, color: UI.creamDim, weight: 700, tracking: 1.3,\n    });", "    this.text(ctx, line.character.title, x + 84, y + 35, {\n      size: 9.5, color: UI.creamDim, weight: 700, tracking: 1.3,\n    });"),
("      size: 14, color: line.character.accent, weight: 800, tracking: 0.8,", "      size: 15, color: line.character.accent, weight: 800, tracking: 0.8,"),
("      size: 14, color: UI.cream, weight: 600,\n    });\n    ctx.fillStyle = 'rgba(247, 239, 220, 0.08)';", "      size: 15, color: UI.cream, weight: 600,\n    });\n    ctx.fillStyle = 'rgba(247, 239, 220, 0.08)';"),
("    this.text(ctx, 'KM/H', x + 112, y + 40, {\n      size: 10.5, color: UI.gold, weight: 800, tracking: 1.6,\n    });", "    this.text(ctx, 'KM/H', x + 112, y + 40, {\n      size: 11.5, color: UI.gold, weight: 800, tracking: 1.6,\n    });"),
("    this.text(ctx, 'GEAR', x + 112, y + 56, {\n      size: 9, color: UI.creamDim, weight: 700, tracking: 1.7,\n    });", "    this.text(ctx, 'GEAR', x + 112, y + 56, {\n      size: 10, color: UI.creamDim, weight: 700, tracking: 1.7,\n    });"),
("      size: 13, color: UI.cream, weight: 800, align: 'right', tracking: 0.6,", "      size: 14, color: UI.cream, weight: 800, align: 'right', tracking: 0.6,"),
("      size: 11, color: damage > 55 ? UI.coral : UI.creamDim, weight: 800, align: 'right', family: FONTS.mono,", "      size: 12, color: damage > 55 ? UI.coral : UI.creamDim, weight: 800, align: 'right', family: FONTS.mono,"),
("        size: 10.5, color: UI.cream, weight: 800, tracking: 0.7,", "        size: 11.5, color: UI.cream, weight: 800, tracking: 0.7,"),
]
for a, b in reps:
    if a not in s:
        print('MISS', a[:70].replace('\n', '|'))
    s = s.replace(a, b)
p.write_text(s, encoding='utf-8')

p = Path('game/src/config.js')
s = p.read_text(encoding='utf-8')
s = s.replace("  rp: 620,\n  missionIndex: 2,", "  rp: 760,\n  missionIndex: 2,")
p.write_text(s, encoding='utf-8')

p = Path('game/src/missions.js')
s = p.read_text(encoding='utf-8')
old = """  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.09, 6, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.85, 9, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 4.5;
  group.add(beam);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    new THREE.MeshBasicMaterial({ color }),
  );
  gem.position.y = 2.2;
  group.add(gem);
  group.visible = false;
  return { group, ring, gem, color };"""
new = """  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.13, 6, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.15, 16, 14, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 8;
  group.add(beam);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshBasicMaterial({ color }),
  );
  gem.position.y = 2.8;
  group.add(gem);
  const iconCanvas = document.createElement('canvas');
  iconCanvas.width = 128;
  iconCanvas.height = 128;
  const ictx = iconCanvas.getContext('2d');
  ictx.fillStyle = color;
  ictx.beginPath();
  ictx.moveTo(64, 4);
  ictx.lineTo(120, 64);
  ictx.lineTo(64, 124);
  ictx.lineTo(8, 64);
  ictx.closePath();
  ictx.fill();
  ictx.fillStyle = '#101b22';
  ictx.font = '800 62px "Arial Black", sans-serif';
  ictx.textAlign = 'center';
  ictx.textBaseline = 'middle';
  ictx.fillText('!', 64, 66);
  const iconTex = new THREE.CanvasTexture(iconCanvas);
  iconTex.colorSpace = THREE.SRGBColorSpace;
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex, transparent: true, depthWrite: false }));
  icon.scale.set(1.5, 1.5, 1);
  icon.position.y = 4.6;
  group.add(icon);
  group.visible = false;
  return { group, ring, gem, icon, color };"""
assert old in s
s = s.replace(old, new)
s = s.replace("      marker.gem.position.y = 2.2 + Math.sin(this.time * 2.2) * 0.18;", "      marker.gem.position.y = 2.8 + Math.sin(this.time * 2.2) * 0.22;\n      marker.icon.position.y = 4.6 + Math.sin(this.time * 2.2) * 0.16;")
p.write_text(s, encoding='utf-8')
print('patched hud, config, missions')
