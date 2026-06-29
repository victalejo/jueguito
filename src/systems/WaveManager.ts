import { VIEW, WORLD } from '@/config/constants'
import type { EventBus } from '@/core/EventBus'
import { computeIntensity, isEventWave, WAVE_CONFIG, waveClearBonus } from '@/data/waves'
import { clamp } from '@/utils/mathUtils'
import { rng } from '@/utils/random'
import type { GameEventPayloads, HazardKind, HazardZone, Vec2 } from '@/types'

/**
 * Drives 30-second wave windows: emits WAVE_STARTED (with escalating intensity)
 * and WAVE_CLEARED (+bonus), and fires a telegraphed global hazard every 3rd wave.
 */
export class WaveManager {
  private waveIndex = 0
  private elapsed = 0
  private intensity = 1
  private stageId = 0
  private started = false

  private readonly onEvolved = (p: GameEventPayloads['STAGE_EVOLVED']): void => {
    this.stageId = p.stageId
  }

  constructor(
    private readonly bus: EventBus,
    private readonly getPlayerPos: () => Vec2,
  ) {
    bus.on('STAGE_EVOLVED', this.onEvolved)
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.startWave(1)
  }

  update(dtMs: number): void {
    if (!this.started) return
    this.elapsed += dtMs
    if (this.elapsed >= WAVE_CONFIG.durationMs) {
      this.clearWave()
      this.startWave(this.waveIndex + 1)
    }
  }

  private startWave(index: number): void {
    this.waveIndex = index
    this.elapsed = 0
    this.intensity = computeIntensity(index)
    this.bus.emit('WAVE_STARTED', {
      waveIndex: index,
      durationMs: WAVE_CONFIG.durationMs,
      intensity: this.intensity,
    })
    if (isEventWave(index)) this.fireHazard()
  }

  private clearWave(): void {
    this.bus.emit('WAVE_CLEARED', {
      waveIndex: this.waveIndex,
      bonusScore: waveClearBonus(this.waveIndex),
    })
  }

  private fireHazard(): void {
    const kinds: HazardKind[] = ['radical']
    if (this.stageId >= 1) kinds.push('uv')
    if (this.stageId >= 3) kinds.push('acid')
    const kind = rng.pick(kinds)
    this.bus.emit('HAZARD_BURST', { kind, warningMs: 1500, zones: this.makeZones(kind) })
  }

  private makeZones(kind: HazardKind): HazardZone[] {
    const p = this.getPlayerPos()
    const cx = (x: number): number => clamp(x, 40, WORLD.WIDTH - 40)
    const cy = (y: number): number => clamp(y, 40, WORLD.HEIGHT - 40)
    const zones: HazardZone[] = []

    if (kind === 'acid') {
      const a = rng.angle()
      const len = VIEW.WIDTH * 0.9
      const dirX = Math.cos(a)
      const dirY = Math.sin(a)
      const sx = p.x - (dirX * len) / 2
      const sy = p.y - (dirY * len) / 2
      const steps = 6
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1)
        zones.push({ x: cx(sx + dirX * len * t), y: cy(sy + dirY * len * t), r: 90 })
      }
    } else {
      const count = kind === 'uv' ? 3 : 5
      const maxR = kind === 'uv' ? 150 : 100
      const minR = kind === 'uv' ? 110 : 70
      for (let i = 0; i < count; i++) {
        const a = rng.angle()
        const d = rng.range(70, VIEW.WIDTH * 0.45)
        zones.push({ x: cx(p.x + Math.cos(a) * d), y: cy(p.y + Math.sin(a) * d), r: rng.range(minR, maxR) })
      }
    }
    return zones
  }

  getWaveIndex(): number {
    return this.waveIndex
  }
  getIntensity(): number {
    return this.intensity
  }

  destroy(): void {
    this.bus.off('STAGE_EVOLVED', this.onEvolved)
  }
}
