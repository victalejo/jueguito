import Phaser from 'phaser'
import { BALANCE, POOL_SIZES, VIEW, WORLD } from '@/config/constants'
import type { EventBus } from '@/core/EventBus'
import { Nutrient } from '@/entities/Nutrient'
import { Threat } from '@/entities/Threat'
import type { Player } from '@/entities/Player'
import { NUTRIENT_KINDS } from '@/data/nutrients'
import { nutrientRarityWeight, threatSpawnWeight } from '@/data/spawnTables'
import { roamingThreatKinds } from '@/data/threats'
import { computeThreatBudget } from '@/data/waves'
import { clamp } from '@/utils/mathUtils'
import { rng } from '@/utils/random'
import type { GameEventPayloads, NutrientKind, ThreatKind } from '@/types'

const DENSITY_DECAY_FULL_MS = 12 * 60 * 1000
const VIEW_REACH = Math.hypot(VIEW.WIDTH, VIEW.HEIGHT) / 2
const SPAWN_MARGIN = 60

/**
 * Owns the nutrient + threat pools and drives all spawning: continuous nutrient
 * flow (with decaying density + low-energy rubber-banding) and threat pressure
 * scaled to the current wave budget and stage.
 */
export class SpawnSystem {
  private readonly nutrients: Nutrient[] = []
  private readonly threats: Threat[] = []

  private nutrientTimer = 0
  private threatTimer = 0
  private elapsedMs = 0
  private spawnPausedMs = 0

  private stageId = 0
  private waveIndex = 1
  private intensity = 1
  private threatBudget = BALANCE.BASE_THREAT_BUDGET

  private readonly onWave = (p: GameEventPayloads['WAVE_STARTED']): void => {
    this.waveIndex = p.waveIndex
    this.intensity = p.intensity
    this.recomputeBudget()
  }
  private readonly onEvolved = (p: GameEventPayloads['STAGE_EVOLVED']): void => {
    this.stageId = p.stageId
    this.recomputeBudget()
    this.spawnPausedMs = BALANCE.EVOLUTION_CALM_SECONDS * 1000
    this.clearHazardousThreatsNear(this.player.x, this.player.y, 420)
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: EventBus,
    private readonly player: Player,
  ) {
    for (let i = 0; i < POOL_SIZES.NUTRIENTS; i++) this.nutrients.push(new Nutrient(scene))
    for (let i = 0; i < POOL_SIZES.THREATS; i++) this.threats.push(new Threat(scene))
    bus.on('WAVE_STARTED', this.onWave)
    bus.on('STAGE_EVOLVED', this.onEvolved)
  }

  getNutrientPool(): readonly Nutrient[] {
    return this.nutrients
  }
  getThreatPool(): readonly Threat[] {
    return this.threats
  }

  private recomputeBudget(): void {
    this.threatBudget = computeThreatBudget(this.waveIndex, this.stageId)
  }

  private get densityMult(): number {
    const t = clamp(this.elapsedMs / DENSITY_DECAY_FULL_MS, 0, 1)
    return Phaser.Math.Linear(
      BALANCE.NUTRIENT_DENSITY_START_MULT,
      BALANCE.NUTRIENT_DENSITY_END_MULT,
      t,
    )
  }

  private countActive(pool: readonly { active: boolean }[]): number {
    let n = 0
    for (const e of pool) if (e.active) n++
    return n
  }

  private firstInactive<T extends { active: boolean }>(pool: T[]): T | null {
    for (const e of pool) if (!e.active) return e
    return null
  }

  update(dtMs: number): void {
    this.elapsedMs += dtMs
    if (this.spawnPausedMs > 0) this.spawnPausedMs -= dtMs

    this.updateNutrients(dtMs)
    this.updateThreats(dtMs)

    for (const n of this.nutrients) if (n.active) n.update(dtMs)
    const target = { x: this.player.x, y: this.player.y, radius: this.player.getRadius() }
    for (const t of this.threats) if (t.active) t.update(dtMs, target)
  }

  private updateNutrients(dtMs: number): void {
    this.nutrientTimer -= dtMs
    if (this.nutrientTimer > 0) return

    const lowEnergy =
      this.player.getEnergy() / Math.max(1, this.player.getMaxEnergy()) <
      BALANCE.LOW_ENERGY_THRESHOLD
    const rate = this.densityMult * (lowEnergy ? 1 + BALANCE.LOW_ENERGY_NUTRIENT_SPAWN_BOOST : 1)
    const base =
      BALANCE.NUTRIENT_SPAWN_INTERVAL_MS +
      rng.range(-1, 1) * BALANCE.NUTRIENT_SPAWN_INTERVAL_JITTER_MS
    this.nutrientTimer = base / Math.max(0.1, rate)

    if (this.countActive(this.nutrients) >= BALANCE.MAX_CONCURRENT_NUTRIENTS) return
    this.spawnNutrient()
  }

  private updateThreats(dtMs: number): void {
    if (this.spawnPausedMs > 0) return
    this.threatTimer -= dtMs
    if (this.threatTimer > 0) return

    const desired = Math.min(BALANCE.MAX_CONCURRENT_THREATS, Math.round(this.threatBudget))
    if (this.countActive(this.threats) >= desired) {
      this.threatTimer = 300
      return
    }
    this.threatTimer = rng.range(280, 620)
    this.spawnThreat()
  }

  private spawnNutrient(): void {
    const slot = this.firstInactive(this.nutrients)
    if (!slot) return
    const kind = rng.weightedPick<NutrientKind>(NUTRIENT_KINDS, nutrientRarityWeight)
    const angle = rng.angle()
    const dist = rng.range(140, VIEW_REACH)
    const x = clamp(this.player.x + Math.cos(angle) * dist, SPAWN_MARGIN, WORLD.WIDTH - SPAWN_MARGIN)
    const y = clamp(this.player.y + Math.sin(angle) * dist, SPAWN_MARGIN, WORLD.HEIGHT - SPAWN_MARGIN)
    slot.spawn(x, y, kind)
  }

  private spawnThreat(): void {
    const kinds = roamingThreatKinds(this.stageId)
    if (kinds.length === 0) return
    const slot = this.firstInactive(this.threats)
    if (!slot) return

    const kind = rng.weightedPick<ThreatKind>(kinds, (k) => threatSpawnWeight(k, this.waveIndex))
    const angle = rng.angle()
    const dist = VIEW_REACH + rng.range(40, 200)
    const x = clamp(this.player.x + Math.cos(angle) * dist, SPAWN_MARGIN, WORLD.WIDTH - SPAWN_MARGIN)
    const y = clamp(this.player.y + Math.sin(angle) * dist, SPAWN_MARGIN, WORLD.HEIGHT - SPAWN_MARGIN)
    slot.spawn(x, y, kind, this.intensity)
  }

  /** Despawn DoT threats near a point (evolution calm cleanup). */
  private clearHazardousThreatsNear(x: number, y: number, radius: number): void {
    const r2 = radius * radius
    for (const t of this.threats) {
      if (!t.active || !t.isDoT()) continue
      const dx = t.x - x
      const dy = t.y - y
      if (dx * dx + dy * dy <= r2) t.despawn()
    }
  }

  destroy(): void {
    this.bus.off('WAVE_STARTED', this.onWave)
    this.bus.off('STAGE_EVOLVED', this.onEvolved)
  }
}
