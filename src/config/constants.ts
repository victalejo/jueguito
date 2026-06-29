/**
 * Immutable tuning constants for "Soup Genesis: Rise of the Cell".
 *
 * Arrays indexed by stage use the numeric stage id 0..6.
 * Everything here is `as const` so the values are the single source of truth.
 */

export const VIEW = { WIDTH: 1280, HEIGHT: 720 } as const

export const WORLD = { WIDTH: 2400, HEIGHT: 1800 } as const

export const STAGE_COUNT = 7
export const FINAL_STAGE_ID = 6

/** Render depth ordering inside GameScene (the HUD lives in its own scene). */
export const DEPTHS = {
  BACKGROUND: 0,
  PARTICLES_FAR: 2,
  PARTICLES_MID: 3,
  NUTRIENT: 8,
  PARTICLES_NEAR: 9,
  THREAT_TELEGRAPH: 11,
  THREAT: 12,
  PLAYER: 16,
  FX: 24,
  DISH: 28,
  VIGNETTE: 30,
} as const

export const POOL_SIZES = {
  NUTRIENTS: 120,
  THREATS: 60,
} as const

/** Shared UI / FX colours (numeric, Phaser-ready). */
export const COLORS = {
  UI_TEXT: 0xf2fbff,
  UI_DIM: 0x8fb3c4,
  UI_PANEL: 0x081820,
  UI_PANEL_BORDER: 0x2bb98a,
  ENERGY_HIGH: 0xffd166,
  ENERGY_LOW: 0xff5252,
  HEALTH: 0x4ee59a,
  BIOMASS: 0x9b7bff,
  SCORE: 0xffe27a,
  DANGER: 0xff4d6d,
  BACKDROP: 0x04121a,
  WHITE: 0xffffff,
} as const

/**
 * Core gameplay balance. Stage-indexed arrays are length 7 (ids 0..6).
 * See the design spec §9 for the rationale behind each value.
 */
export const BALANCE = {
  // Camera
  CAMERA_LERP: 0.1,

  // Energy / hunger
  BASE_ENERGY_DRAIN_PER_SECOND: 0.9,
  ENERGY_DRAIN_PER_STAGE: [0.9, 1.15, 1.45, 1.75, 2.05, 2.35, 2.6],
  MAX_ENERGY_BASE: 100,
  MAX_ENERGY_PER_STAGE: [100, 120, 145, 175, 210, 250, 300],
  START_ENERGY_FRACTION: 0.7,
  STARVATION_DAMAGE_PER_SECOND: 6,
  LOW_ENERGY_THRESHOLD: 0.15,
  LOW_ENERGY_NUTRIENT_SPAWN_BOOST: 0.25,

  // Biomass / evolution
  BIOMASS_TO_EVOLVE_PER_STAGE: [40, 64, 102, 163, 261, 418, 640],

  // Nutrients
  NUTRIENT_SPAWN_INTERVAL_MS: 650,
  NUTRIENT_SPAWN_INTERVAL_JITTER_MS: 250,
  MAX_CONCURRENT_NUTRIENTS: 60,
  NUTRIENT_DENSITY_START_MULT: 1.0,
  NUTRIENT_DENSITY_END_MULT: 0.7,
  NUTRIENT_DRIFT_SPEED: 18,
  NUTRIENT_DESPAWN_MS: 22000,
  PICKUP_RADIUS_BASE: 18,

  // Waves / threats
  WAVE_DURATION_MS: 30000,
  BASE_THREAT_BUDGET: 3,
  THREAT_BUDGET_GROWTH_PER_WAVE: 0.18,
  INTENSITY_CAP: 4.5,
  STAGE_THREAT_MULTIPLIER: [0.6, 0.8, 1.0, 1.2, 1.45, 1.7, 2.0],
  MAX_CONCURRENT_THREATS: 28,
  THREAT_SPAWN_MARGIN_PX: 80,
  MIN_THREAT_SPAWN_DISTANCE_FROM_PLAYER: 220,
  EVENT_WAVE_INTERVAL: 3,
  EVOLUTION_CALM_SECONDS: 4,

  // Abilities
  DASH_ENERGY_COST: 12,
  DASH_SPEED_MULTIPLIER: 3.2,
  DASH_DURATION_MS: 220,
  DASH_COOLDOWN_MS: 1400,
  SPRINT_ENERGY_DRAIN_PER_SECOND: 6,
  SPRINT_SPEED_MULTIPLIER: 1.5,
  TOXIN_PULSE_ENERGY_COST: 18,
  TOXIN_PULSE_RADIUS: 120,
  TOXIN_PULSE_DAMAGE: 25,
  TOXIN_PULSE_COOLDOWN_MS: 3500,
  ENGULF_ENERGY_COST: 15,
  ENGULF_RADIUS: 44,
  ENGULF_DAMAGE: 40,
  ENGULF_COOLDOWN_MS: 2500,
  SPIN_SWEEP_ENERGY_COST: 20,
  SPIN_SWEEP_RADIUS: 95,
  SPIN_SWEEP_DAMAGE: 30,
  SPIN_SWEEP_COOLDOWN_MS: 4000,
  LUNGE_ENERGY_COST: 16,
  LUNGE_SPEED_MULTIPLIER: 4.2,
  LUNGE_DURATION_MS: 300,
  LUNGE_COOLDOWN_MS: 1800,

  // Defence
  MEMBRANE_DAMAGE_REDUCTION_PER_STAGE: [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4],
  CONTACT_INVULNERABILITY_MS: 700,
  MAX_DAMAGE_REDUCTION: 0.85,

  // Movement physics
  PLAYER_ACCELERATION: 900,
  PLAYER_DRAG: 0.86,
  PLAYER_MAX_SPEED_CAP: 420,

  // Mutations
  MUTATION_CHOICES_PER_LEVEL: 3,

  // Score
  SCORE_PER_BIOMASS: 1,
  SCORE_PER_SURVIVAL_SECOND: 2,
  SCORE_PER_STAGE: 500,
  SCORE_PER_THREAT_KILL: 25,

  // Victory
  VICTORY_HOLD_SECONDS_AT_FINAL_STAGE: 60,

  // Combo
  COMBO_WINDOW_MS: 2000,
  COMBO_MAX_STACKS: 10,
  SPEED_BOOST_FROM_MINERAL_MS: 3000,
  SPEED_BOOST_FROM_MINERAL_MULT: 0.25,
} as const

export const SAVE_KEY = 'soupGenesis.save.v1'
export const SAVE_VERSION = 1

/**
 * Texture-key registry. Both the data layer and the TextureFactory reference
 * these helpers, so a texture is never addressed by a stringly-typed literal.
 */
export const TEX = {
  SOFT_GLOW: 'soft_glow',
  SPARK: 'spark',
  VIGNETTE: 'vignette',
  DISH: 'dish',
  EVOLVE_BURST: 'evolve_burst',
  PANEL: 'ui_panel',
  CARD: 'ui_card',
  player: (key: string): string => `player_${key}`,
  nutrient: (id: string): string => `nutrient_${id}`,
  threat: (id: string): string => `threat_${id}`,
  mutationIcon: (id: string): string => `mut_${id}`,
  soup: (stageId: number): string => `soup_${stageId}`,
} as const
