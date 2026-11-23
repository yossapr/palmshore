// Palmshore's hand-in program: it packages the static game beside this file and writes the dossier
// the judge reads. No network, no build, no dependencies beyond Node's standard library and the
// vendored make.fun library. Run it with:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// In the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used. The program refuses to write over
// the repository itself, clears only its own previous output folders, and keeps every cap the
// scorer's gate.json uses so a hand-in fails here rather than at the site.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here);
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

if (out === repo || out === resolve(repo, 'game') || out === resolve(repo, 'screenshots')) {
  throw new Error(`Refusing to write output over the repository: ${out}`);
}
if (!existsSync(join(repo, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing');
}
if (!existsSync(join(repo, 'screenshots'))) {
  throw new Error('screenshots/ is missing');
}

mkdirSync(out, { recursive: true });

// Replace the packaged folders rather than merging, so a stale screenshot or module can never
// survive from an earlier run and push the dossier past its screenshot or source caps.
for (const folder of ['game', 'screenshots']) {
  rmSync(join(out, folder), { recursive: true, force: true });
  cpSync(join(repo, folder), join(out, folder), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, dossier);

const count = (folder) => {
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        files += 1;
        bytes += statSync(path).size;
      }
    }
  };
  walk(folder);
  return { files, bytes };
};
const game = count(join(out, 'game'));
const shots = count(join(out, 'screenshots'));
console.log(`Palmshore → ${out}`);
console.log(`  game/        ${game.files} files, ${(game.bytes / 1024).toFixed(1)} KiB`);
console.log(`  screenshots/ ${shots.files} files, ${(shots.bytes / 1024).toFixed(1)} KiB`);
console.log(`  dossier.json ${(dossier.length / 1024).toFixed(1)} KiB (cap 1536 KiB)`);
