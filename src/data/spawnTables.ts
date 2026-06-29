import type { NutrientKind, ThreatKind } from '@/types'
import { NUTRIENT_DEFS, NUTRIENT_KINDS } from './nutrients'
import { THREAT_DEFS, roamingThreatKinds } from './threats'

/** Spawn weight for a nutrient kind (its rarity). */
export const nutrientRarityWeight = (kind: NutrientKind): number =>
  NUTRIENT_DEFS[kind].rarityWeight

/**
 * Spawn weight for a roaming threat. Newer threats (higher `fromStage`) become
 * relatively more common as waves climb, ramping pressure without ever fully
 * dropping the early threats.
 */
export const threatSpawnWeight = (kind: ThreatKind, waveIndex: number): number => {
  const def = THREAT_DEFS[kind]
  const recencyBias = 1 + def.fromStage * 0.12 * Math.max(0, waveIndex - 1) * 0.2
  return Math.max(0.05, recencyBias)
}

export interface SpawnPlan {
  readonly nutrientKinds: readonly NutrientKind[]
  readonly threatKinds: readonly ThreatKind[]
}

/** Which kinds may spawn at a given player stage. */
export const getSpawnPlan = (stageId: number): SpawnPlan => ({
  nutrientKinds: NUTRIENT_KINDS,
  threatKinds: roamingThreatKinds(stageId),
})
