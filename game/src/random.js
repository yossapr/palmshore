// The seeded generator behind the whole city: one numeric seed builds the same streets,
// buildings, palms, cars, crowd and missions every time. mulberry32 plus small draws.

export function createRandom(seed) {
  let a = (seed | 0) || 1;
  const random = function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  random.range = (lo, hi) => lo + random() * (hi - lo);
  random.int = (lo, hi) => Math.floor(lo + random() * (hi - lo + 1));
  random.pick = (list) => list[Math.floor(random() * list.length)];
  random.chance = (p) => random() < p;
  random.sign = () => (random() < 0.5 ? -1 : 1);
  random.shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return random;
}

/** A generator with a stable sub-stream, so adding a feature later does not reshuffle the city. */
export function streamOf(seed, salt) {
  return createRandom((seed * 2654435761 + salt * 40503) | 0);
}
