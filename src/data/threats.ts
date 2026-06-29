import { TEX } from '@/config/constants'
import type { ThreatDef, ThreatKind } from '@/types'

/**
 * Hazards. `fromStage` = lowest player stage at which a threat may appear.
 * `isEvent` threats (UV/acid) are fired as global HAZARD_BURST telegraphs by
 * the WaveManager rather than spawned as free-roaming entities.
 * Damage values are base; the SpawnSystem scales them by wave intensity.
 */
export const THREAT_DEFS: Record<ThreatKind, ThreatDef> = {
  free_radical: {
    kind: 'free_radical',
    name: 'Radical Libre',
    behavior: 'wander',
    damage: 5,
    speed: 90,
    radius: 6,
    fromStage: 0,
    color: 0xff5252,
    textureKey: TEX.threat('free_radical'),
  },
  toxin_blob: {
    kind: 'toxin_blob',
    name: 'Mancha Tóxica',
    behavior: 'drift_dot',
    damage: 3,
    speed: 35,
    radius: 14,
    fromStage: 0,
    color: 0x7cb342,
    textureKey: TEX.threat('toxin_blob'),
    dot: true,
  },
  uv_burst: {
    kind: 'uv_burst',
    name: 'Estallido UV',
    behavior: 'telegraph_aoe',
    damage: 18,
    speed: 0,
    radius: 130,
    fromStage: 1,
    color: 0xfff59d,
    textureKey: TEX.threat('uv_burst'),
    isEvent: true,
    telegraphMs: 1500,
  },
  predator_microbe: {
    kind: 'predator_microbe',
    name: 'Microbio Depredador',
    behavior: 'chase',
    damage: 12,
    speed: 130,
    radius: 18,
    fromStage: 2,
    color: 0xef6c00,
    textureKey: TEX.threat('predator_microbe'),
  },
  phage: {
    kind: 'phage',
    name: 'Bacteriófago',
    behavior: 'ambush_lunge',
    damage: 22,
    speed: 260,
    radius: 11,
    fromStage: 3,
    color: 0xab47bc,
    textureKey: TEX.threat('phage'),
    telegraphMs: 650,
  },
  acid_current: {
    kind: 'acid_current',
    name: 'Corriente Ácida',
    behavior: 'push_band',
    damage: 4,
    speed: 70,
    radius: 90,
    fromStage: 3,
    color: 0x80deea,
    textureKey: TEX.threat('acid_current'),
    isEvent: true,
    dot: true,
    telegraphMs: 1400,
  },
  amoeba_hunter: {
    kind: 'amoeba_hunter',
    name: 'Amiba Cazadora',
    behavior: 'pack_flank',
    damage: 20,
    speed: 105,
    radius: 30,
    fromStage: 4,
    color: 0xd84315,
    textureKey: TEX.threat('amoeba_hunter'),
  },
  toxin_jelly: {
    kind: 'toxin_jelly',
    name: 'Medusa Tóxica',
    behavior: 'trail_hazard',
    damage: 9,
    speed: 80,
    radius: 16,
    fromStage: 5,
    color: 0x26a69a,
    textureKey: TEX.threat('toxin_jelly'),
    dot: true,
  },
  apex_predator: {
    kind: 'apex_predator',
    name: 'Célula Depredadora Apex',
    behavior: 'smart_hunter',
    damage: 34,
    speed: 150,
    radius: 38,
    fromStage: 6,
    color: 0xb71c1c,
    textureKey: TEX.threat('apex_predator'),
  },
}

export const THREAT_KINDS = Object.keys(THREAT_DEFS) as ThreatKind[]

export const getThreatDef = (kind: ThreatKind): ThreatDef => THREAT_DEFS[kind]

/** Free-roaming (non-event) threats available at a given player stage. */
export const roamingThreatKinds = (stageId: number): ThreatKind[] =>
  THREAT_KINDS.filter((k) => {
    const def = THREAT_DEFS[k]
    return !def.isEvent && def.fromStage <= stageId
  })
