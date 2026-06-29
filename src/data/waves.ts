import { BALANCE } from '@/config/constants'
import { clamp } from '@/utils/mathUtils'
import { STAGE_COUNT } from './stages'

export const WAVE_CONFIG = {
  durationMs: BALANCE.WAVE_DURATION_MS,
  eventInterval: BALANCE.EVENT_WAVE_INTERVAL,
} as const

/**
 * Difficulty intensity for a 1-based wave index.
 * Wave 1 = 1.0, then +0.18 per wave, capped at INTENSITY_CAP.
 */
export const computeIntensity = (waveIndex: number): number =>
  Math.min(
    1 + BALANCE.THREAT_BUDGET_GROWTH_PER_WAVE * Math.max(0, waveIndex - 1),
    BALANCE.INTENSITY_CAP,
  )

/** Threat spawn budget for a wave at the player's current stage. */
export const computeThreatBudget = (waveIndex: number, stageId: number): number =>
  BALANCE.BASE_THREAT_BUDGET *
  computeIntensity(waveIndex) *
  BALANCE.STAGE_THREAT_MULTIPLIER[clamp(stageId, 0, STAGE_COUNT - 1)]

/** Every Nth wave (3, 6, 9 …) fires a telegraphed global hazard. */
export const isEventWave = (waveIndex: number): boolean =>
  waveIndex > 0 && waveIndex % BALANCE.EVENT_WAVE_INTERVAL === 0

/** Score awarded when a wave window closes. */
export const waveClearBonus = (waveIndex: number): number => 40 + waveIndex * 20
