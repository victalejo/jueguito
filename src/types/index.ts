/**
 * Shared type contracts for Soup Genesis. Every module depends on this barrel;
 * nothing here imports Phaser so it stays portable and cheap to type-check.
 */

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Vec2 {
  readonly x: number
  readonly y: number
}

// ---------------------------------------------------------------------------
// Identifier unions (kept in sync with the data layer)
// ---------------------------------------------------------------------------

export type StageKey =
  | 'molecule'
  | 'protocell'
  | 'prokaryote'
  | 'eukaryote'
  | 'colonial'
  | 'multicellular'
  | 'organism'

export type NutrientKind =
  | 'sugar'
  | 'amino_acid'
  | 'lipid'
  | 'nucleotide'
  | 'mineral_ion'
  | 'atp_globule'
  | 'protein_cluster'
  | 'prebiotic_gem'

export type ThreatKind =
  | 'free_radical'
  | 'toxin_blob'
  | 'uv_burst'
  | 'predator_microbe'
  | 'phage'
  | 'acid_current'
  | 'amoeba_hunter'
  | 'toxin_jelly'
  | 'apex_predator'

export type ThreatBehavior =
  | 'wander'
  | 'drift_dot'
  | 'telegraph_aoe'
  | 'chase'
  | 'ambush_lunge'
  | 'push_band'
  | 'pack_flank'
  | 'trail_hazard'
  | 'smart_hunter'

export type AbilityId = 'dash' | 'toxinPulse' | 'engulf' | 'spinSweep' | 'lunge'

export type HazardKind = 'uv' | 'radical' | 'acid'

export type MutationId =
  | 'efficient_metabolism'
  | 'voracious'
  | 'rapid_growth'
  | 'streamlined'
  | 'thick_membrane'
  | 'wide_cilia'
  | 'regen_vacuole'
  | 'toxin_resistance'
  | 'barbed_membrane'
  | 'adrenal_burst'
  | 'second_membrane'
  | 'energy_storage'
  | 'chemotaxis'
  | 'predator_sense'
  | 'reactive_armor'
  | 'photosynthate'
  | 'mitotic_overdrive'
  | 'apex_predator_instinct'

// ---------------------------------------------------------------------------
// Player modifiers — exactly the set of stats a mutation can touch.
// Multiplier-type fields default to 1; additive-type fields default to 0.
// Applying a mutation is always `modifiers[stat] += magnitude`.
// ---------------------------------------------------------------------------

export interface PlayerModifiers {
  energyDrainMult: number
  energyGainMult: number
  biomassGainMult: number
  speedMult: number
  damageReduction: number
  pickupRadiusMult: number
  healthRegen: number
  toxinDamageMult: number
  contactDamage: number
  dashPowerMult: number
  maxHealthMult: number
  maxEnergyMult: number
  reflectMult: number
  passiveEnergyRegen: number
  comboBiomassMult: number
  engulfPowerMult: number
  nutrientRadar: number
  threatRadar: number
}

export type ModifierStat = keyof PlayerModifiers

/** Live, resolved stats of the player at the current stage (base × modifiers). */
export interface OrganismStats {
  stageId: number
  radius: number
  speed: number
  maxSpeed: number
  maxHealth: number
  maxEnergy: number
  energyDrainPerSecond: number
  membraneDamageReduction: number
  pickupRadius: number
}

// ---------------------------------------------------------------------------
// Data records
// ---------------------------------------------------------------------------

export interface EvolutionStage {
  readonly id: number
  readonly key: StageKey
  readonly name: string
  readonly sciName: string
  readonly description: string
  /** Membrane rim / accent colour for this stage. */
  readonly color: number
  readonly baseRadius: number
  readonly baseSpeed: number
  readonly baseMaxHealth: number
  readonly maxEnergy: number
  readonly energyDrainPerSecond: number
  readonly membraneDamageReduction: number
  readonly biomassToEvolve: number
  /** Ability granted as the stage's primary (Space/Click), or null at stage 0. */
  readonly primaryAbility: AbilityId | null
  readonly unlocks: readonly string[]
  readonly textureKey: string
}

export interface Mutation {
  readonly id: MutationId
  readonly name: string
  readonly description: string
  readonly stat: ModifierStat
  readonly magnitude: number
  readonly tier: number
  readonly minStage: number
  readonly iconKey: string
}

/** A single choice shown on the evolution screen (currently 1:1 with Mutation). */
export type MutationChoice = Mutation

export interface NutrientDef {
  readonly kind: NutrientKind
  readonly name: string
  readonly energy: number
  readonly biomass: number
  readonly radius: number
  readonly rarityWeight: number
  readonly color: number
  readonly driftSpeed: number
  readonly textureKey: string
  readonly special?: 'speedBoost'
}

export interface ThreatDef {
  readonly kind: ThreatKind
  readonly name: string
  readonly behavior: ThreatBehavior
  readonly damage: number
  readonly speed: number
  readonly radius: number
  readonly fromStage: number
  readonly color: number
  readonly textureKey: string
  /** Threat applies damage-over-time while overlapping rather than on contact. */
  readonly dot?: boolean
  /** Global event hazard (UV/acid) rather than a free-roaming entity. */
  readonly isEvent?: boolean
  readonly telegraphMs?: number
}

export interface AbilityDef {
  readonly id: AbilityId
  readonly name: string
  readonly cooldownMs: number
  readonly energyCost: number
  readonly description: string
}

// ---------------------------------------------------------------------------
// Per-frame input (immutable snapshot produced by InputController)
// ---------------------------------------------------------------------------

export interface InputState {
  /** Normalised desired movement direction (zero vector when idle). */
  readonly dir: Vec2
  readonly sprinting: boolean
  /** Edge-triggered: true only on the frame the key/button went down. */
  readonly primaryPressed: boolean
  readonly secondaryPressed: boolean
  readonly pausePressed: boolean
  readonly mutePressed: boolean
  /** World-space aim point when the pointer is active, else null. */
  readonly aim: Vec2 | null
  /** Card hotkey just pressed on the evolution screen: 0 = none, 1..3 = card. */
  readonly cardSelect: number
}

// ---------------------------------------------------------------------------
// FX + run results
// ---------------------------------------------------------------------------

export interface BurstConfig {
  count: number
  color: number
  speed: number
  speedVariance?: number
  lifespan: number
  scale?: number
}

export type DeathCause = 'starvation' | 'threat'
export type RunEndCause = DeathCause | 'victory'

export interface RunResult {
  stageReached: number
  stageName: string
  biomassCollected: number
  survivalMs: number
  score: number
  waveReached: number
  cause: RunEndCause
  nutrientsEaten: number
  threatsKilled: number
  isNewBestStage: boolean
  isNewHighScore: boolean
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface SaveStats {
  nutrientsEaten: number
  threatsKilled: number
  deathsByStarvation: number
  deathsByThreat: number
  maxWaveReached: number
}

export interface SaveSettings {
  muted: boolean
  sfxVolume: number
  showDamageNumbers: boolean
  reduceMotion: boolean
  colorblindMode: boolean
}

export interface SaveData {
  version: number
  bestStageId: number
  highScore: number
  totalRuns: number
  totalPlaytimeMs: number
  unlockedMutations: string[]
  hasWon: boolean
  stats: SaveStats
  settings: SaveSettings
  lastUpdatedIso: string
}

// ---------------------------------------------------------------------------
// Typed event bus
// ---------------------------------------------------------------------------

export interface HazardZone {
  x: number
  y: number
  r: number
}

export interface GameEventPayloads {
  PLAYER_ENERGY_CHANGED: { energy: number; maxEnergy: number }
  PLAYER_HEALTH_CHANGED: { health: number; maxHealth: number }
  PLAYER_BIOMASS_CHANGED: { biomass: number; biomassToNext: number; stageId: number }
  SCORE_CHANGED: { score: number; delta: number }
  COMBO_CHANGED: { combo: number }
  NUTRIENT_COLLECTED: {
    kind: NutrientKind
    x: number
    y: number
    energy: number
    biomass: number
  }
  PLAYER_DAMAGED: {
    amount: number
    threatKind: ThreatKind | 'starvation'
    x: number
    y: number
    energyRemaining: number
    healthRemaining: number
  }
  EVOLUTION_READY: { fromStageId: number; toStageId: number; choices: MutationChoice[] }
  MUTATION_CHOSEN: { mutationId: MutationId; toStageId: number }
  STAGE_EVOLVED: { stageId: number; stageName: string; stats: OrganismStats }
  WAVE_STARTED: { waveIndex: number; durationMs: number; intensity: number }
  WAVE_CLEARED: { waveIndex: number; bonusScore: number }
  HAZARD_BURST: { kind: HazardKind; warningMs: number; zones: HazardZone[] }
  GAME_PAUSED: Record<string, never>
  GAME_RESUMED: Record<string, never>
  EVOLUTION_CLOSED: Record<string, never>
  PLAYER_DIED: { cause: DeathCause; summary: RunResult }
  GAME_WON: { summary: RunResult }
  ABILITY_USED: { ability: AbilityId; cooldownMs: number }
  ABILITY_READY: { ability: AbilityId }
  PLAYER_MOVED: { x: number; y: number }
  THREAT_KILLED: { kind: ThreatKind; x: number; y: number; biomass: number }
  VICTORY_PROGRESS: { secondsHeld: number; secondsNeeded: number }
  TOAST: { text: string; color?: number; durationMs?: number }
}

export type GameEventName = keyof GameEventPayloads
