import { BALANCE, TEX } from '@/config/constants'
import type { NutrientDef, NutrientKind } from '@/types'

const DRIFT = BALANCE.NUTRIENT_DRIFT_SPEED

/** Collectible molecules. `rarityWeight` = relative spawn weight (higher = more common). */
export const NUTRIENT_DEFS: Record<NutrientKind, NutrientDef> = {
  sugar: {
    kind: 'sugar',
    name: 'Azúcar',
    energy: 8,
    biomass: 2,
    radius: 7,
    rarityWeight: 1.0,
    color: 0xffffff,
    driftSpeed: DRIFT,
    textureKey: TEX.nutrient('sugar'),
  },
  amino_acid: {
    kind: 'amino_acid',
    name: 'Aminoácido',
    energy: 12,
    biomass: 4,
    radius: 6,
    rarityWeight: 0.7,
    color: 0x7fe3ff,
    driftSpeed: DRIFT,
    textureKey: TEX.nutrient('amino_acid'),
  },
  lipid: {
    kind: 'lipid',
    name: 'Lípido',
    energy: 22,
    biomass: 3,
    radius: 8,
    rarityWeight: 0.5,
    color: 0xffe26b,
    driftSpeed: DRIFT,
    textureKey: TEX.nutrient('lipid'),
  },
  nucleotide: {
    kind: 'nucleotide',
    name: 'Nucleótido',
    energy: 6,
    biomass: 8,
    radius: 7,
    rarityWeight: 0.4,
    color: 0x9cffb0,
    driftSpeed: DRIFT,
    textureKey: TEX.nutrient('nucleotide'),
  },
  mineral_ion: {
    kind: 'mineral_ion',
    name: 'Ion Mineral',
    energy: 5,
    biomass: 1,
    radius: 9,
    rarityWeight: 0.3,
    color: 0xb0c4de,
    driftSpeed: DRIFT * 0.6,
    textureKey: TEX.nutrient('mineral_ion'),
    special: 'speedBoost',
  },
  atp_globule: {
    kind: 'atp_globule',
    name: 'Glóbulo de ATP',
    energy: 40,
    biomass: 2,
    radius: 8,
    rarityWeight: 0.12,
    color: 0xffd93b,
    driftSpeed: DRIFT * 1.2,
    textureKey: TEX.nutrient('atp_globule'),
  },
  protein_cluster: {
    kind: 'protein_cluster',
    name: 'Cúmulo Proteico',
    energy: 18,
    biomass: 14,
    radius: 10,
    rarityWeight: 0.1,
    color: 0xff6fa8,
    driftSpeed: DRIFT * 0.8,
    textureKey: TEX.nutrient('protein_cluster'),
  },
  prebiotic_gem: {
    kind: 'prebiotic_gem',
    name: 'Cristal Prebiótico',
    energy: 15,
    biomass: 24,
    radius: 11,
    rarityWeight: 0.05,
    color: 0xc77dff,
    driftSpeed: DRIFT * 0.5,
    textureKey: TEX.nutrient('prebiotic_gem'),
  },
}

export const NUTRIENT_KINDS = Object.keys(NUTRIENT_DEFS) as NutrientKind[]

export const getNutrientDef = (kind: NutrientKind): NutrientDef => NUTRIENT_DEFS[kind]
