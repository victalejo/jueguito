import type { Vec2 } from '@/types'

export const TAU = Math.PI * 2

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value

export const clamp01 = (value: number): number => clamp(value, 0, 1)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const len = (x: number, y: number): number => Math.hypot(x, y)

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(bx - ax, by - ay)

export const distSq = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax
  const dy = by - ay
  return dx * dx + dy * dy
}

export const angleTo = (ax: number, ay: number, bx: number, by: number): number =>
  Math.atan2(by - ay, bx - ax)

/** Normalised direction (zero vector when the input has no length). */
export const normalize = (x: number, y: number): Vec2 => {
  const l = Math.hypot(x, y)
  return l > 1e-6 ? { x: x / l, y: y / l } : { x: 0, y: 0 }
}

/** Move a scalar toward a target by at most `step`. */
export const approach = (current: number, target: number, step: number): number => {
  if (current < target) return Math.min(current + step, target)
  if (current > target) return Math.max(current - step, target)
  return target
}

/** Vector from `from` toward `to`, length capped at `maxStep`. */
export const toward = (from: Vec2, to: Vec2, maxStep: number): Vec2 => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const l = Math.hypot(dx, dy)
  if (l <= maxStep || l < 1e-6) return { x: dx, y: dy }
  return { x: (dx / l) * maxStep, y: (dy / l) * maxStep }
}

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s })

export const fromAngle = (angle: number, length = 1): Vec2 => ({
  x: Math.cos(angle) * length,
  y: Math.sin(angle) * length,
})

/** Shortest signed difference between two angles, in (-PI, PI]. */
export const angleDelta = (from: number, to: number): number => {
  let d = (to - from) % TAU
  if (d < -Math.PI) d += TAU
  if (d > Math.PI) d -= TAU
  return d
}

/** Smoothly rotate an angle toward a target by at most `maxStep` radians. */
export const rotateToward = (current: number, target: number, maxStep: number): number => {
  const delta = angleDelta(current, target)
  if (Math.abs(delta) <= maxStep) return target
  return current + Math.sign(delta) * maxStep
}

/** Wrap a value into the half-open range [min, max). */
export const wrap = (value: number, min: number, max: number): number => {
  const range = max - min
  if (range <= 0) return min
  let v = (value - min) % range
  if (v < 0) v += range
  return v + min
}

/** Frame-rate independent exponential smoothing factor. */
export const damp = (factor: number, dtSeconds: number): number =>
  1 - Math.pow(1 - factor, dtSeconds * 60)
