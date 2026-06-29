import type Phaser from 'phaser'
import { REGISTRY } from './registryKeys'

/** Logical sound cues. The concrete WebAudioManager synthesises each one. */
export type SfxName =
  | 'eat'
  | 'rare'
  | 'hurt'
  | 'dash'
  | 'ability'
  | 'evolve'
  | 'waveUp'
  | 'uiHover'
  | 'uiSelect'
  | 'lowEnergy'

export interface SfxParams {
  /** Feed combo level (raises eat pitch). */
  combo?: number
  /** 0..1 generic intensity (e.g. damage amount → hurt depth). */
  intensity?: number
}

/**
 * Minimal audio contract. Keeping the surface tiny (`play(name, params)`)
 * means call sites never depend on synthesis details and audio can no-op
 * safely if the AudioContext is unavailable.
 */
export interface AudioManager {
  /** Resume the AudioContext — must be called from a user-gesture handler. */
  unlock(): void
  play(name: SfxName, params?: SfxParams): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  toggleMuted(): boolean
  setVolume(volume: number): void
  destroy(): void
}

export function getAudio(game: Phaser.Game): AudioManager | undefined {
  return game.registry.get(REGISTRY.AUDIO) as AudioManager | undefined
}

/** Safe one-liner: plays the cue if an AudioManager is registered, else no-ops. */
export function playSfx(game: Phaser.Game, name: SfxName, params?: SfxParams): void {
  getAudio(game)?.play(name, params)
}
