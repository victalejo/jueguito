import { BALANCE } from '@/config/constants'
import type { EventBus } from '@/core/EventBus'
import type { GameEventPayloads } from '@/types'

/**
 * Single source of truth for the run score. Reacts to gameplay events plus a
 * per-second survival tick, and broadcasts SCORE_CHANGED for the HUD.
 */
export class ScoreSystem {
  private score = 0
  private survivalAccum = 0

  private readonly onNutrient = (p: GameEventPayloads['NUTRIENT_COLLECTED']): void =>
    this.add(Math.max(1, Math.round(p.biomass * BALANCE.SCORE_PER_BIOMASS)))
  private readonly onStage = (): void => this.add(BALANCE.SCORE_PER_STAGE)
  private readonly onWave = (p: GameEventPayloads['WAVE_CLEARED']): void =>
    this.add(p.bonusScore)
  private readonly onKill = (): void => this.add(BALANCE.SCORE_PER_THREAT_KILL)

  constructor(private readonly bus: EventBus) {
    bus.on('NUTRIENT_COLLECTED', this.onNutrient)
    bus.on('STAGE_EVOLVED', this.onStage)
    bus.on('WAVE_CLEARED', this.onWave)
    bus.on('THREAT_KILLED', this.onKill)
  }

  update(dtMs: number): void {
    this.survivalAccum += dtMs
    while (this.survivalAccum >= 1000) {
      this.survivalAccum -= 1000
      this.add(BALANCE.SCORE_PER_SURVIVAL_SECOND)
    }
  }

  private add(delta: number): void {
    this.score += delta
    this.bus.emit('SCORE_CHANGED', { score: this.score, delta })
  }

  getScore(): number {
    return this.score
  }

  destroy(): void {
    this.bus.off('NUTRIENT_COLLECTED', this.onNutrient)
    this.bus.off('STAGE_EVOLVED', this.onStage)
    this.bus.off('WAVE_CLEARED', this.onWave)
    this.bus.off('THREAT_KILLED', this.onKill)
  }
}
