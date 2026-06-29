import { FINAL_STAGE_ID, SAVE_VERSION } from '@/config/constants'
import { DEFAULT_SAVE } from '@/data/saveDefaults'
import type { SaveData, SaveSettings, SaveStats } from '@/types'
import { clamp } from './mathUtils'

type Dict = Record<string, unknown>

const asDict = (v: unknown): Dict => (v && typeof v === 'object' ? (v as Dict) : {})

export const asInt = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export const asNumberClamped = (
  v: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? clamp(n, min, max) : fallback
}

export const asBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback

export const asString = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback

export const asStringArray = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : fallback.slice()

function coerceStats(raw: unknown): SaveStats {
  const o = asDict(raw)
  const d = DEFAULT_SAVE.stats
  return {
    nutrientsEaten: Math.max(0, asInt(o.nutrientsEaten, d.nutrientsEaten)),
    threatsKilled: Math.max(0, asInt(o.threatsKilled, d.threatsKilled)),
    deathsByStarvation: Math.max(0, asInt(o.deathsByStarvation, d.deathsByStarvation)),
    deathsByThreat: Math.max(0, asInt(o.deathsByThreat, d.deathsByThreat)),
    maxWaveReached: Math.max(0, asInt(o.maxWaveReached, d.maxWaveReached)),
  }
}

function coerceSettings(raw: unknown): SaveSettings {
  const o = asDict(raw)
  const d = DEFAULT_SAVE.settings
  return {
    muted: asBool(o.muted, d.muted),
    sfxVolume: asNumberClamped(o.sfxVolume, d.sfxVolume, 0, 1),
    showDamageNumbers: asBool(o.showDamageNumbers, d.showDamageNumbers),
    reduceMotion: asBool(o.reduceMotion, d.reduceMotion),
    colorblindMode: asBool(o.colorblindMode, d.colorblindMode),
  }
}

/**
 * Field-by-field defensive parse of untrusted localStorage data. Corrupt or
 * missing fields are replaced with defaults rather than rejecting the whole
 * blob, so a partial/old save still loads.
 */
export function coerceSaveData(raw: unknown): SaveData {
  const o = asDict(raw)
  const uniqueMutations = Array.from(
    new Set(asStringArray(o.unlockedMutations, DEFAULT_SAVE.unlockedMutations)),
  )
  return {
    version: SAVE_VERSION,
    bestStageId: clamp(asInt(o.bestStageId, 0), 0, FINAL_STAGE_ID),
    highScore: Math.max(0, asInt(o.highScore, 0)),
    totalRuns: Math.max(0, asInt(o.totalRuns, 0)),
    totalPlaytimeMs: Math.max(0, asInt(o.totalPlaytimeMs, 0)),
    unlockedMutations: uniqueMutations,
    hasWon: asBool(o.hasWon, false),
    stats: coerceStats(o.stats),
    settings: coerceSettings(o.settings),
    lastUpdatedIso: asString(o.lastUpdatedIso, DEFAULT_SAVE.lastUpdatedIso),
  }
}
