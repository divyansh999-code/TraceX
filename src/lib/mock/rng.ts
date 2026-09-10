/**
 * Deterministic seeded pseudo-random generator (mulberry32 + FNV-1a hashing).
 * All TraceX mock data is generated from stable seeds so every render,
 * on every machine, produces the exact same "telemetry".
 */

export function hashStr(str: string): number {
  let h = 2166136261 >>> 0; // FNV-1a 32-bit offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  private s: number;

  constructor(seed: number | string) {
    this.s = typeof seed === "string" ? hashStr(seed) : seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }

  /** Uniform float in [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1 - 1e-9));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Approximate normal distribution via Box-Muller */
  gauss(mean = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-9);
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Bounded gaussian to keep values sane */
  clampGauss(min: number, max: number, mean: number, sd: number): number {
    return Math.min(max, Math.max(min, this.gauss(mean, sd)));
  }
}

/** Build a seed from arbitrary parts, e.g. rngFrom('series', topicId, range, platform) */
export function rngFrom(...parts: (string | number)[]): Rng {
  return new Rng(parts.join("|"));
}
