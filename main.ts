// Palmshore's hand-in: copy the playable static game and its four screenshots from this repository
// into the grader's output directory, then write dossier.json with the vendored make.fun library.
// Node 22, standard library only, no network. Run it as:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing; Palmshore has nothing to hand in');
}
if (out === resolve(here) || out === resolve(here, '..')) {
  throw new Error(`refusing to replace ${out}; set MAKEFUN_OUTPUT_DIR to a separate output folder`);
}

// A clean output makes both grader runs write the same bytes, even if a previous run left files.
mkdirSync(out, { recursive: true });
for (const name of ['game', 'screenshots']) rmSync(join(out, name), { recursive: true, force: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// Fail early on the same limits the judge's gate applies, instead of handing in a refused entry.
const screenshotNames = readdirSync(join(out, 'screenshots')).filter((name) => !name.startsWith('.')).sort();
if (screenshotNames.length !== 4) {
  throw new Error(`expected four screenshots, found ${screenshotNames.length}`);
}
for (const name of screenshotNames) {
  const size = statSync(join(out, 'screenshots', name)).size;
  if (size > 262144) throw new Error(`${name} is ${size} bytes; screenshots must stay under 256 KiB`);
}
const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
console.log(`palmshore: game/ (${gameFiles} entries) + screenshots/ (${screenshotNames.join(', ')}) -> ${out}`);

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`palmshore: wrote ${join(out, 'dossier.json')}`);
