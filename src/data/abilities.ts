import { BALANCE } from '@/config/constants'
import type { AbilityDef, AbilityId } from '@/types'

/** Active abilities, keyed by id. Cooldowns/costs come from BALANCE. */
export const ABILITY_DEFS: Record<AbilityId, AbilityDef> = {
  dash: {
    id: 'dash',
    name: 'Impulso',
    cooldownMs: BALANCE.DASH_COOLDOWN_MS,
    energyCost: BALANCE.DASH_ENERGY_COST,
    description: 'Ráfaga corta de velocidad para esquivar el peligro.',
  },
  toxinPulse: {
    id: 'toxinPulse',
    name: 'Pulso Tóxico',
    cooldownMs: BALANCE.TOXIN_PULSE_COOLDOWN_MS,
    energyCost: BALANCE.TOXIN_PULSE_ENERGY_COST,
    description: 'Libera una onda tóxica que daña a las amenazas cercanas.',
  },
  engulf: {
    id: 'engulf',
    name: 'Fagocitar',
    cooldownMs: BALANCE.ENGULF_COOLDOWN_MS,
    energyCost: BALANCE.ENGULF_ENERGY_COST,
    description: 'Engulle y digiere amenazas pequeñas a tu alrededor.',
  },
  spinSweep: {
    id: 'spinSweep',
    name: 'Giro Barredor',
    cooldownMs: BALANCE.SPIN_SWEEP_COOLDOWN_MS,
    energyCost: BALANCE.SPIN_SWEEP_ENERGY_COST,
    description: 'Gira tu cúmulo para barrer amenazas y nutrientes.',
  },
  lunge: {
    id: 'lunge',
    name: 'Embestida Contráctil',
    cooldownMs: BALANCE.LUNGE_COOLDOWN_MS,
    energyCost: BALANCE.LUNGE_ENERGY_COST,
    description: 'Embestida larga que atraviesa la amenaza.',
  },
}

export const getAbility = (id: AbilityId): AbilityDef => ABILITY_DEFS[id]
