import { SAVE_KEY, SAVE_VERSION, FINAL_STAGE_ID } from '@/config/constants'
import { cloneDefaultSave } from '@/data/saveDefaults'
import { coerceSaveData } from '@/utils/validation'
import type { RunResult, SaveData, SaveSettings } from '@/types'

function deepFreeze<T>(obj: T): T {
  Object.getOwnPropertyNames(obj as object).forEach((key) => {
    const value = (obj as Record<string, unknown>)[key]
    if (value && typeof value === 'object') deepFreeze(value)
  })
  return Object.freeze(obj)
}

function nowIso(): string {
  try {
    return new Date().toISOString()
  } catch {
    return '1970-01-01T00:00:00.000Z'
  }
}

/**
 * localStorage persistence. The internal `data` is never handed out directly:
 * every getter returns a deep-frozen clone, and every mutation builds a NEW
 * object before writing. Corrupt data is repaired field-by-field on load.
 */
export class SaveSystem {
  private data: SaveData

  constructor() {
    this.data = this.readFromStorage()
  }

  private readFromStorage(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return cloneDefaultSave()
      return coerceSaveData(JSON.parse(raw))
    } catch {
      return cloneDefaultSave()
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      /* storage unavailable (private mode / quota) — game still runs */
    }
  }

  private snapshot(): SaveData {
    return deepFreeze(JSON.parse(JSON.stringify(this.data)) as SaveData)
  }

  /** Re-read from storage and return a frozen snapshot. */
  load(): SaveData {
    this.data = this.readFromStorage()
    return this.snapshot()
  }

  /** Current frozen snapshot (safe to read freely). */
  get(): SaveData {
    return this.snapshot()
  }

  getDefault(): SaveData {
    return cloneDefaultSave()
  }

  /** Shallow-merge top-level fields, stamp version + timestamp, persist. */
  save(partial: Partial<SaveData>): SaveData {
    this.data = {
      ...this.data,
      ...partial,
      version: SAVE_VERSION,
      lastUpdatedIso: nowIso(),
    }
    this.persist()
    return this.snapshot()
  }

  updateSettings(partial: Partial<SaveSettings>): SaveData {
    this.data = {
      ...this.data,
      settings: { ...this.data.settings, ...partial },
      lastUpdatedIso: nowIso(),
    }
    this.persist()
    return this.snapshot()
  }

  setMuted(muted: boolean): SaveData {
    return this.updateSettings({ muted })
  }

  unlockMutation(id: string): SaveData {
    if (this.data.unlockedMutations.includes(id)) return this.snapshot()
    this.data = {
      ...this.data,
      unlockedMutations: [...this.data.unlockedMutations, id],
      lastUpdatedIso: nowIso(),
    }
    this.persist()
    return this.snapshot()
  }

  /** Fold a finished run's stats into the persistent record. */
  recordRunResult(result: RunResult): SaveData {
    const stats = { ...this.data.stats }
    stats.nutrientsEaten += Math.max(0, result.nutrientsEaten)
    stats.threatsKilled += Math.max(0, result.threatsKilled)
    stats.maxWaveReached = Math.max(stats.maxWaveReached, result.waveReached)
    if (result.cause === 'starvation') stats.deathsByStarvation += 1
    if (result.cause === 'threat') stats.deathsByThreat += 1

    this.data = {
      ...this.data,
      totalRuns: this.data.totalRuns + 1,
      totalPlaytimeMs: this.data.totalPlaytimeMs + Math.max(0, result.survivalMs),
      bestStageId: Math.min(
        FINAL_STAGE_ID,
        Math.max(this.data.bestStageId, result.stageReached),
      ),
      highScore: Math.max(this.data.highScore, result.score),
      hasWon: this.data.hasWon || result.cause === 'victory',
      stats,
      lastUpdatedIso: nowIso(),
    }
    this.persist()
    return this.snapshot()
  }

  resetSave(): SaveData {
    this.data = cloneDefaultSave()
    this.persist()
    return this.snapshot()
  }
}
