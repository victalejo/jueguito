import { TEX } from '@/config/constants'
import type { Mutation, MutationChoice, MutationId, ModifierStat } from '@/types'
import type { RNG } from '@/utils/random'

interface MutationSeed {
  id: MutationId
  name: string
  description: string
  stat: ModifierStat
  magnitude: number
  tier: 1 | 2 | 3
}

/** Tier → earliest stage at which the mutation can be offered. */
const TIER_MIN_STAGE: Record<1 | 2 | 3, number> = { 1: 1, 2: 3, 3: 5 }

const SEEDS: readonly MutationSeed[] = [
  // Tier 1
  { id: 'efficient_metabolism', name: 'Metabolismo Eficiente', description: 'El hambre drena un 18% más lento.', stat: 'energyDrainMult', magnitude: -0.18, tier: 1 },
  { id: 'voracious', name: 'Absorción Voraz', description: 'Los nutrientes restauran un 30% más de energía.', stat: 'energyGainMult', magnitude: 0.3, tier: 1 },
  { id: 'rapid_growth', name: 'Crecimiento Rápido', description: '+30% de biomasa de los nutrientes; evolucionas antes.', stat: 'biomassGainMult', magnitude: 0.3, tier: 1 },
  { id: 'streamlined', name: 'Cuerpo Hidrodinámico', description: '+15% de velocidad de movimiento.', stat: 'speedMult', magnitude: 0.15, tier: 1 },
  { id: 'thick_membrane', name: 'Membrana Gruesa', description: 'Recibes un 15% menos de daño de todas las fuentes.', stat: 'damageReduction', magnitude: 0.15, tier: 1 },
  { id: 'wide_cilia', name: 'Cilios Amplios', description: '+40% de radio de recolección de nutrientes.', stat: 'pickupRadiusMult', magnitude: 0.4, tier: 1 },
  // Tier 2
  { id: 'regen_vacuole', name: 'Vacuola Regenerativa', description: '+2 HP/s mientras la energía supere el 50%.', stat: 'healthRegen', magnitude: 2, tier: 2 },
  { id: 'toxin_resistance', name: 'Resistencia a Toxinas', description: 'Reduce a la mitad el daño de toxinas, radicales y ácido.', stat: 'toxinDamageMult', magnitude: -0.5, tier: 2 },
  { id: 'barbed_membrane', name: 'Membrana con Púas', description: 'Inflige 8 de daño por contacto a las amenazas que te tocan.', stat: 'contactDamage', magnitude: 8, tier: 2 },
  { id: 'adrenal_burst', name: 'Ráfaga Adrenal', description: 'El impulso/embestida viaja 50% más lejos y cuesta menos.', stat: 'dashPowerMult', magnitude: 0.5, tier: 2 },
  { id: 'second_membrane', name: 'Segunda Membrana', description: '+25% de salud máxima.', stat: 'maxHealthMult', magnitude: 0.25, tier: 2 },
  { id: 'energy_storage', name: 'Reservas de Energía', description: '+30% de capacidad máxima de energía.', stat: 'maxEnergyMult', magnitude: 0.3, tier: 2 },
  // Tier 3
  { id: 'chemotaxis', name: 'Sentido Quimiotáctico', description: 'Los nutrientes valiosos se marcan en el HUD.', stat: 'nutrientRadar', magnitude: 1, tier: 3 },
  { id: 'predator_sense', name: 'Sentido del Depredador', description: 'Las amenazas fuera de pantalla se marcan en el borde del HUD.', stat: 'threatRadar', magnitude: 1, tier: 3 },
  { id: 'reactive_armor', name: 'Armadura Reactiva', description: 'Refleja el 40% del daño recibido al atacante.', stat: 'reflectMult', magnitude: 0.4, tier: 3 },
  { id: 'photosynthate', name: 'Parche Fotosintético', description: '+1.5 de energía/s de regeneración pasiva.', stat: 'passiveEnergyRegen', magnitude: 1.5, tier: 3 },
  { id: 'mitotic_overdrive', name: 'Sobremarcha Mitótica', description: 'Hasta +50% de biomasa con el combo de alimentación al máximo.', stat: 'comboBiomassMult', magnitude: 0.5, tier: 3 },
  { id: 'apex_predator_instinct', name: 'Instinto Apex', description: 'Fagocitar/Girar puede consumir amenazas mayores y otorgar biomasa.', stat: 'engulfPowerMult', magnitude: 0.75, tier: 3 },
]

export const MUTATIONS = SEEDS.reduce(
  (acc, seed) => {
    acc[seed.id] = {
      id: seed.id,
      name: seed.name,
      description: seed.description,
      stat: seed.stat,
      magnitude: seed.magnitude,
      tier: seed.tier,
      minStage: TIER_MIN_STAGE[seed.tier],
      iconKey: TEX.mutationIcon(seed.id),
    }
    return acc
  },
  {} as Record<MutationId, Mutation>,
)

export const MUTATION_LIST: readonly Mutation[] = SEEDS.map((s) => MUTATIONS[s.id])

export const getMutation = (id: MutationId): Mutation => MUTATIONS[id]

/**
 * Roll `n` distinct mutation choices eligible for the given stage, excluding
 * already-owned ones, soft-weighted toward higher tiers. Falls back to the full
 * eligible set if everything is owned (so the picker is never empty).
 */
export function rollMutationChoices(
  stageId: number,
  owned: ReadonlySet<string>,
  rng: RNG,
  n: number = 3,
): MutationChoice[] {
  const eligible = MUTATION_LIST.filter((m) => m.minStage <= stageId)
  const unowned = eligible.filter((m) => !owned.has(m.id))
  const work = (unowned.length > 0 ? unowned : eligible).slice()

  const weight = (m: Mutation): number => 1 + (m.tier - 1) * 0.35
  const chosen: Mutation[] = []
  while (chosen.length < n && work.length > 0) {
    const picked = rng.weightedPick(work, weight)
    chosen.push(picked)
    const idx = work.indexOf(picked)
    if (idx >= 0) work.splice(idx, 1)
  }
  return chosen
}
