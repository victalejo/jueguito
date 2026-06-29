import { BALANCE, TEX } from '@/config/constants'
import { clamp } from '@/utils/mathUtils'
import type { AbilityId, EvolutionStage, StageKey } from '@/types'

interface StageSeed {
  key: StageKey
  name: string
  sciName: string
  description: string
  color: number
  baseRadius: number
  baseSpeed: number
  baseMaxHealth: number
  biomassToEvolve: number
  primaryAbility: AbilityId | null
  unlocks: string[]
}

const SEEDS: readonly StageSeed[] = [
  {
    key: 'molecule',
    name: 'Molécula Autorreplicante',
    sciName: 'Replicator',
    description:
      'Una hebra de química que se copia a sí misma, apenas un patrón en el caldo. Diminuta, frágil y rápida: sobrevivir es atrapar bloques flotantes antes de que algo note que existes.',
    color: 0x7fe3ff,
    baseRadius: 7,
    baseSpeed: 150,
    baseMaxHealth: 40,
    biomassToEvolve: 40,
    primaryAbility: null,
    unlocks: ['Movimiento básico', 'Absorción pasiva de nutrientes al contacto'],
  },
  {
    key: 'protocell',
    name: 'Protocélula',
    sciName: 'Protobiont',
    description:
      'Una membrana lipídica envuelve tu química en una gota verdadera. Almacenas más energía, aguantas un golpe y puedes impulsarte para escapar.',
    color: 0x9cffb0,
    baseRadius: 11,
    baseSpeed: 140,
    baseMaxHealth: 70,
    biomassToEvolve: 64,
    primaryAbility: 'dash',
    unlocks: ['Membrana (reducción de daño)', 'Impulso (Espacio)', 'Guarda 2 mutaciones'],
  },
  {
    key: 'prokaryote',
    name: 'Procariota',
    sciName: 'Bacterium',
    description:
      'Un flagelo y una pared celular te convierten en un organismo real. Nadas con propósito y puedes secretar un pulso tóxico defensivo en el caldo, ahora abarrotado.',
    color: 0xffe26b,
    baseRadius: 15,
    baseSpeed: 135,
    baseMaxHealth: 110,
    biomassToEvolve: 102,
    primaryAbility: 'toxinPulse',
    unlocks: ['Flagelo (mejor control)', 'Pulso Tóxico', 'Pared celular (resiste radicales)'],
  },
  {
    key: 'eukaryote',
    name: 'Eucariota',
    sciName: 'Protist',
    description:
      'Has engullido tus primeros simbiontes: una mitocondria te da energía y un núcleo te gobierna. Más grande y resistente, ahora puedes FAGOCITAR amenazas pequeñas enteras.',
    color: 0xffa24b,
    baseRadius: 21,
    baseSpeed: 125,
    baseMaxHealth: 170,
    biomassToEvolve: 163,
    primaryAbility: 'engulf',
    unlocks: ['Mitocondria (regen de energía)', 'Fagocitar', 'Núcleo (+1 mutación)'],
  },
  {
    key: 'colonial',
    name: 'Cúmulo Colonial',
    sciName: 'Choanoflagellate Colony',
    description:
      'Las células no se separan tras dividirse y forman un cúmulo cooperativo. Eres una constelación móvil con salud compartida, capaz de girar para barrer nutrientes y desviar peligros.',
    color: 0xff6fa8,
    baseRadius: 28,
    baseSpeed: 118,
    baseMaxHealth: 250,
    biomassToEvolve: 261,
    primaryAbility: 'spinSweep',
    unlocks: ['Cúmulo celular (cuerpo multinodo)', 'Giro Barredor', 'Radio de recolección +'],
  },
  {
    key: 'multicellular',
    name: 'Organismo Multicelular',
    sciName: 'Early Metazoan',
    description:
      'Emergen tejidos diferenciados: un intestino primitivo, fibras contráctiles, un parche sensorial. Eres un depredador-pastor del caldo, rápido para tu tamaño y devastador de cerca.',
    color: 0xc77dff,
    baseRadius: 36,
    baseSpeed: 112,
    baseMaxHealth: 360,
    biomassToEvolve: 418,
    primaryAbility: 'lunge',
    unlocks: ['Capas de tejido (armadura alta)', 'Embestida contráctil', 'Radar de amenazas'],
  },
  {
    key: 'organism',
    name: 'Organismo Apex del Caldo',
    sciName: 'Primordial Metazoan',
    description:
      'El soberano indiscutible de la placa primigenia. Un cuerpo complejo de células especializadas, inmune a casi todo peligro ambiental. Sobrevive como apex para ganar.',
    color: 0x8e5bff,
    baseRadius: 46,
    baseSpeed: 108,
    baseMaxHealth: 520,
    biomassToEvolve: 640,
    primaryAbility: 'lunge',
    unlocks: ['Cuerpo apex', 'Todas las habilidades potenciadas', 'Modo Sin Fin al ganar'],
  },
]

export const EVOLUTION_STAGES: readonly EvolutionStage[] = SEEDS.map((seed, id) => ({
  id,
  key: seed.key,
  name: seed.name,
  sciName: seed.sciName,
  description: seed.description,
  color: seed.color,
  baseRadius: seed.baseRadius,
  baseSpeed: seed.baseSpeed,
  baseMaxHealth: seed.baseMaxHealth,
  maxEnergy: BALANCE.MAX_ENERGY_PER_STAGE[id],
  energyDrainPerSecond: BALANCE.ENERGY_DRAIN_PER_STAGE[id],
  membraneDamageReduction: BALANCE.MEMBRANE_DAMAGE_REDUCTION_PER_STAGE[id],
  biomassToEvolve: seed.biomassToEvolve,
  primaryAbility: seed.primaryAbility,
  unlocks: seed.unlocks,
  textureKey: TEX.player(seed.key),
}))

export const STAGE_COUNT = EVOLUTION_STAGES.length

export const getStage = (id: number): EvolutionStage =>
  EVOLUTION_STAGES[clamp(Math.round(id), 0, STAGE_COUNT - 1)]

export const isFinalStage = (id: number): boolean => id >= STAGE_COUNT - 1
