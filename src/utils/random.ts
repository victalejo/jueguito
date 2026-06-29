import type { Vec2 } from '@/types'
import { TAU } from './mathUtils'

/**
 * Small, fast, seedable PRNG (mulberry32). Deterministic when seeded, which
 * keeps spawn/mutation rolls reproducible for debugging.
 */
export class RNG {
  private state: number

  constructor(seed?: number) {
    this.state = (seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** -1 or +1. */
  sign(): number {
    return this.next() < 0.5 ? -1 : 1
  }

  /** Angle in [0, TAU). */
  angle(): number {
    return this.next() * TAU
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }

  /** Weighted pick; `weight` must return a non-negative number. */
  weightedPick<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0
    for (const item of items) total += Math.max(0, weight(item))
    if (total <= 0) return this.pick(items)
    let roll = this.next() * total
    for (const item of items) {
      roll -= Math.max(0, weight(item))
      if (roll <= 0) return item
    }
    return items[items.length - 1]
  }

  /** Returns a NEW shuffled array (Fisher–Yates); does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const tmp = out[i]
      out[i] = out[j]
      out[j] = tmp
    }
    return out
  }

  /** Point on a circle's circumference. */
  onCircle(cx: number, cy: number, radius: number): Vec2 {
    const a = this.angle()
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius }
  }

  /** Uniformly distributed point inside a circle. */
  insideCircle(cx: number, cy: number, radius: number): Vec2 {
    const a = this.angle()
    const r = radius * Math.sqrt(this.next())
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  }
}

export function createRng(seed?: number): RNG {
  return new RNG(seed)
}

/** Shared default generator for non-deterministic gameplay rolls. */
export const rng = new RNG()
