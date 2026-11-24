// Seeded randomness. Every city, crowd and traffic jam in Palmshore comes from here,
// so the same seed always paints the same street.

export function hashString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.next = mulberry32(this.seed);
    this.calls = 0;
  }

  float() {
    this.calls += 1;
    return this.next();
  }

  range(min, max) {
    return min + (max - min) * this.float();
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p) {
    return this.float() < p;
  }

  pick(list) {
    return list[Math.floor(this.float() * list.length)];
  }

  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.float() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  weighted(entries) {
    let total = 0;
    for (const entry of entries) total += entry.weight;
    let roll = this.float() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.value;
    }
    return entries[entries.length - 1].value;
  }

  fork(salt) {
    return new Rng((this.seed ^ hashString(String(salt))) >>> 0);
  }
}

// A stable jitter for decoration that does not consume the main stream.
export function jitter(seed, index, min, max) {
  const r = mulberry32((seed ^ Math.imul(index + 1, 2654435761)) >>> 0)();
  return min + (max - min) * r;
}
