import { SAVE_KEY, SAVE_VERSION } from '@/config/constants'
import type { SaveData } from '@/types'

export { SAVE_KEY, SAVE_VERSION }

/** Pristine save used for first run, reset, and as a repair template. */
export const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  bestStageId: 0,
  highScore: 0,
  totalRuns: 0,
  totalPlaytimeMs: 0,
  unlockedMutations: [],
  hasWon: false,
  stats: {
    nutrientsEaten: 0,
    threatsKilled: 0,
    deathsByStarvation: 0,
    deathsByThreat: 0,
    maxWaveReached: 0,
  },
  settings: {
    muted: false,
    sfxVolume: 0.6,
    showDamageNumbers: true,
    reduceMotion: false,
    colorblindMode: false,
  },
  lastUpdatedIso: '1970-01-01T00:00:00.000Z',
}

/** Deep copy of the default save (the constant must never be mutated). */
export function cloneDefaultSave(): SaveData {
  return JSON.parse(JSON.stringify(DEFAULT_SAVE)) as SaveData
}
