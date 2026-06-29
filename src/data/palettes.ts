import { clamp } from '@/utils/mathUtils'
import { STAGE_COUNT } from './stages'

/**
 * Per-stage colour palette (design spec §11). The soup, framing and FX tween
 * between these as the player evolves: early = cold/sparse, late = warm/radiant.
 * Order: [bgDeep, bgMid, accentDark, accentMid, glowBright, highlight, danger].
 */
export interface Palette {
  readonly bgDeep: number
  readonly bgMid: number
  readonly accentDark: number
  readonly accentMid: number
  readonly glowBright: number
  readonly highlight: number
  readonly danger: number
}

export const PALETTES: readonly Palette[] = [
  // 0 Molecule — cold, fragile, lonely
  { bgDeep: 0x04070d, bgMid: 0x0a1622, accentDark: 0x123047, accentMid: 0x1f6f8f, glowBright: 0x6fe3ff, highlight: 0xbff7ff, danger: 0xe85d75 },
  // 1 Protocell — tentative teal hope
  { bgDeep: 0x06121a, bgMid: 0x0d2530, accentDark: 0x15414a, accentMid: 0x2fa39a, glowBright: 0x5ff0c8, highlight: 0xc9fff0, danger: 0xff7a59 },
  // 2 Prokaryote — busy, competitive bloom
  { bgDeep: 0x071512, bgMid: 0x0e2a1f, accentDark: 0x1a5237, accentMid: 0x36b56a, glowBright: 0x86f59b, highlight: 0xd8ffd0, danger: 0xff5a4d },
  // 3 Eukaryote — warm, ornate, golden
  { bgDeep: 0x120e08, bgMid: 0x241a0e, accentDark: 0x4a3416, accentMid: 0xc79234, glowBright: 0xffd66b, highlight: 0xfff3cf, danger: 0xff4f7a },
  // 4 Colonial — confident, lush, social
  { bgDeep: 0x0a1410, bgMid: 0x163020, accentDark: 0x2a6b3a, accentMid: 0x7fd64f, glowBright: 0xd6ff7a, highlight: 0xfdffe0, danger: 0xff6a3d },
  // 5 Multicellular — lush, shifting violet
  { bgDeep: 0x100a16, bgMid: 0x1d1430, accentDark: 0x3a2a5a, accentMid: 0x9a6fd6, glowBright: 0xd6a6ff, highlight: 0xf6e6ff, danger: 0xff5a7a },
  // 6 Apex — triumphant, transcendent, luminous
  { bgDeep: 0x0c0a14, bgMid: 0x1c1630, accentDark: 0x3a2f6b, accentMid: 0x9b7bff, glowBright: 0xffe27a, highlight: 0xffffff, danger: 0xff4d6d },
]

export const getPalette = (stageId: number): Palette =>
  PALETTES[clamp(Math.round(stageId), 0, STAGE_COUNT - 1)]
