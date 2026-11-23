// A seeded random number generator (mulberry32) plus the extra draws the city generator needs.
// The same seed always builds the same Palmshore, which is what makes the screenshot scenes and
// the save files repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeHelpers(random) {
  const range = (lo, hi) => lo + random() * (hi - lo);
  const int = (lo, hi) => Math.floor(range(lo, hi + 1));
  const pick = (list) => list[Math.floor(random() * list.length)];
  const chance = (p) => random() < p;
  return { range, int, pick, chance };
}
