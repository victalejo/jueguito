import type { ThreatBehavior, ThreatKind, Vec2 } from '@/types'
import { angleTo, dist, fromAngle, normalize } from '@/utils/mathUtils'
import { rng } from '@/utils/random'

/** Minimal surface a behaviour needs from a threat (avoids a Threat import cycle). */
export interface ThreatAgent {
  x: number
  y: number
  readonly speed: number
  readonly kind: ThreatKind
  /** Mutable per-threat scratch space, cleared on spawn. */
  readonly state: Record<string, number>
}

export interface BehaviorTarget {
  x: number
  y: number
  radius: number
}

export type BehaviorFn = (threat: ThreatAgent, target: BehaviorTarget, dtMs: number) => Vec2

const heading = (t: ThreatAgent): number => {
  if (t.state.heading === undefined) t.state.heading = rng.angle()
  return t.state.heading
}

const wander: BehaviorFn = (t, _target, dtMs) => {
  t.state.turn = (t.state.turn ?? 0) - dtMs
  if (t.state.turn <= 0) {
    t.state.turn = rng.range(250, 700)
    t.state.heading = heading(t) + rng.range(-1.1, 1.1)
  }
  return fromAngle(heading(t), t.speed)
}

const driftDot: BehaviorFn = (t) => fromAngle(heading(t), t.speed)

const chase: BehaviorFn = (t, target) => {
  const dir = normalize(target.x - t.x, target.y - t.y)
  return { x: dir.x * t.speed, y: dir.y * t.speed }
}

const ambushLunge: BehaviorFn = (t, target, dtMs) => {
  t.state.cooldown = (t.state.cooldown ?? 0) - dtMs
  t.state.lunge = (t.state.lunge ?? 0) - dtMs

  if (t.state.lunge > 0) {
    return fromAngle(t.state.lungeDir ?? 0, t.speed)
  }
  const d = dist(t.x, t.y, target.x, target.y)
  if (d < 320 && t.state.cooldown <= 0) {
    t.state.lungeDir = angleTo(t.x, t.y, target.x, target.y)
    t.state.lunge = 420
    t.state.cooldown = 1600
    return fromAngle(t.state.lungeDir, t.speed)
  }
  // Dormant: slow shimmer drift.
  return fromAngle(heading(t), t.speed * 0.18)
}

const packFlank: BehaviorFn = (t, target) => {
  if (t.state.flank === undefined) t.state.flank = rng.sign()
  const toTarget = angleTo(t.x, t.y, target.x, target.y)
  const flankAngle = toTarget + t.state.flank * 0.8
  const aimX = target.x + Math.cos(flankAngle) * (target.radius + 60)
  const aimY = target.y + Math.sin(flankAngle) * (target.radius + 60)
  const dir = normalize(aimX - t.x, aimY - t.y)
  return { x: dir.x * t.speed, y: dir.y * t.speed }
}

const trailHazard: BehaviorFn = (t, target, dtMs) => {
  // Medusa-like slow pulsing pursuit.
  t.state.pulse = (t.state.pulse ?? 0) + dtMs
  const pulse = 0.6 + 0.4 * Math.sin(t.state.pulse * 0.004)
  const dir = normalize(target.x - t.x, target.y - t.y)
  return { x: dir.x * t.speed * pulse, y: dir.y * t.speed * pulse }
}

const smartHunter: BehaviorFn = (t, target, dtMs) => {
  t.state.dash = (t.state.dash ?? 0) - dtMs
  t.state.dashCd = (t.state.dashCd ?? 0) - dtMs
  const dir = normalize(target.x - t.x, target.y - t.y)
  if (t.state.dash > 0) {
    return { x: dir.x * t.speed * 2.4, y: dir.y * t.speed * 2.4 }
  }
  if (t.state.dashCd <= 0 && dist(t.x, t.y, target.x, target.y) < 360) {
    t.state.dash = 300
    t.state.dashCd = 2200
  }
  return { x: dir.x * t.speed, y: dir.y * t.speed }
}

const stationary: BehaviorFn = () => ({ x: 0, y: 0 })

export const THREAT_BEHAVIORS: Record<ThreatBehavior, BehaviorFn> = {
  wander,
  drift_dot: driftDot,
  telegraph_aoe: stationary,
  chase,
  ambush_lunge: ambushLunge,
  push_band: driftDot,
  pack_flank: packFlank,
  trail_hazard: trailHazard,
  smart_hunter: smartHunter,
}

export const applyBehavior = (
  behavior: ThreatBehavior,
  threat: ThreatAgent,
  target: BehaviorTarget,
  dtMs: number,
): Vec2 => THREAT_BEHAVIORS[behavior](threat, target, dtMs)
