/**
 * TextureFactory — generates EVERY procedural texture the game uses, once, at boot.
 *
 * Visual direction: "luminous microscopy" — glowing translucent organisms, additive
 * halos, organic blobs. Everything is drawn with a single reusable Phaser Graphics
 * object (no canvas-2D, no external assets) and baked into the texture atlas via
 * `generateTexture`. The universal light primitive (TEX.SOFT_GLOW) is rendered pure
 * white so it can be tinted to any colour and ADD-blended at runtime.
 *
 * All textures have transparent backgrounds. Generation is guarded so calling
 * `generateAll` twice is a no-op (textures are never regenerated).
 */

import Phaser from 'phaser'
import { COLORS, TEX, VIEW } from '@/config/constants'
import { EVOLUTION_STAGES } from '@/data/stages'
import { NUTRIENT_DEFS, NUTRIENT_KINDS } from '@/data/nutrients'
import { THREAT_DEFS, THREAT_KINDS } from '@/data/threats'
import { MUTATION_LIST } from '@/data/mutations'
import type { Mutation } from '@/types'

const TAU = Math.PI * 2

// Tier accent colours for mutation emblems.
const TIER_COLORS: Record<number, number> = {
  1: 0x5ff0c8, // teal
  2: 0xffd166, // amber
  3: 0x9b7bff, // violet
}

// ---------------------------------------------------------------------------
// Low-level drawing helpers (all operate on a single shared Graphics object)
// ---------------------------------------------------------------------------

/**
 * Radial glow: concentric filled circles from `r` down to 1, alpha ramping from
 * ~0 at the edge to `maxAlpha` at the centre. The core light primitive.
 */
function drawGlow(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
  maxAlpha: number,
): void {
  const steps = Math.max(8, Math.round(r))
  for (let i = steps; i >= 1; i--) {
    const t = i / steps // 1 at edge → ~0 at centre
    const radius = r * t
    // Quadratic falloff reads as a soft, bright-cored halo.
    const alpha = maxAlpha * (1 - t) * (1 - t)
    if (alpha <= 0.002) continue
    g.fillStyle(color, alpha)
    g.fillCircle(cx, cy, radius)
  }
}

/** A crisp translucent membrane blob: soft fill + bright rim stroke. */
function drawMembrane(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
  fillAlpha = 0.35,
  rimAlpha = 0.9,
  rimWidth = 2,
): void {
  g.fillStyle(color, fillAlpha)
  g.fillCircle(cx, cy, r)
  g.lineStyle(rimWidth, color, rimAlpha)
  g.strokeCircle(cx, cy, r)
}

/** Build a regular polygon point list (optionally rotated / jittered). */
function polygon(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation = 0,
  jitter = 0,
): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = []
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * TAU
    const rr = jitter > 0 ? r * (1 - jitter + Math.random() * jitter * 2) : r
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr))
  }
  return pts
}

/** A jagged spiky star — alternating outer/inner radii. Reads as "danger". */
function spikyStar(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  spikes: number,
  rotation = 0,
): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const a = rotation + (i / (spikes * 2)) * TAU
    const rr = i % 2 === 0 ? outer : inner
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr))
  }
  return pts
}

/** Bake the current Graphics content into a texture, then wipe it clean. */
function bake(
  g: Phaser.GameObjects.Graphics,
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
): void {
  if (scene.textures.exists(key)) {
    g.clear()
    return
  }
  g.generateTexture(key, w, h)
  g.clear()
}

// ---------------------------------------------------------------------------
// 1. Static / UI / FX primitives
// ---------------------------------------------------------------------------

function generateSoftGlow(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  const size = 128
  drawGlow(g, size / 2, size / 2, 62, COLORS.WHITE, 0.95)
  bake(g, scene, TEX.SOFT_GLOW, size, size)
}

function generateSpark(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  const size = 24
  drawGlow(g, size / 2, size / 2, 11, COLORS.WHITE, 0.95)
  bake(g, scene, TEX.SPARK, size, size)
}

function generateVignette(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  const w = VIEW.WIDTH
  const h = VIEW.HEIGHT
  const cx = w / 2
  const cy = h / 2
  // Stack progressively larger transparent ellipses "subtracted" by drawing an
  // opaque white frame and carving a hole. Graphics has no blend-erase, so we
  // instead ramp opaque rings from the edge inward, fading to nothing at ~55%.
  const maxR = Math.hypot(cx, cy)
  const inner = Math.min(w, h) * 0.42 // fully transparent inside this radius
  const steps = 48
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const radius = maxR - t * (maxR - inner)
    // Closer to the edge (small t) = stronger ring.
    const edge = 1 - (radius - inner) / Math.max(1, maxR - inner)
    const alpha = Math.pow(edge, 1.6) * 0.85
    if (alpha <= 0.003) continue
    g.fillStyle(COLORS.WHITE, alpha)
    g.fillEllipse(cx, cy, radius * 2, radius * 2)
  }
  bake(g, scene, TEX.VIGNETTE, w, h)
}

function generateDish(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  const size = Math.min(VIEW.WIDTH, VIEW.HEIGHT)
  const cx = size / 2
  const cy = size / 2
  const edge = size / 2

  // Soft outer alpha falloff hugging the rim (transparent centre).
  const ringR = edge * 0.94
  const falloffSteps = 26
  for (let i = 0; i < falloffSteps; i++) {
    const t = i / (falloffSteps - 1)
    const radius = edge - t * (edge * 0.22)
    const alpha = Math.pow(t, 1.8) * 0.18
    g.fillStyle(COLORS.WHITE, alpha)
    g.fillCircle(cx, cy, radius)
  }

  // 3 concentric glowing stroked rings near the edge.
  const ringSpecs = [
    { r: ringR, w: 5, a: 0.55 },
    { r: ringR - 10, w: 2, a: 0.35 },
    { r: ringR - 22, w: 1, a: 0.18 },
  ]
  for (const spec of ringSpecs) {
    g.lineStyle(spec.w, COLORS.WHITE, spec.a)
    g.strokeCircle(cx, cy, spec.r)
  }

  // Faint top-left specular arc (a brighter partial ring).
  g.lineStyle(3, COLORS.WHITE, 0.5)
  g.beginPath()
  g.arc(cx, cy, ringR - 4, Math.PI * 1.05, Math.PI * 1.55, false)
  g.strokePath()

  bake(g, scene, TEX.DISH, size, size)
}

function generateEvolveBurst(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  const size = 256
  const cx = size / 2
  const cy = size / 2
  // Central white flash.
  drawGlow(g, cx, cy, 110, COLORS.WHITE, 0.95)
  // ~24 thin radial rays.
  const rays = 24
  const inner = 14
  const outer = 124
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU
    const alpha = i % 2 === 0 ? 0.85 : 0.45
    g.lineStyle(i % 2 === 0 ? 3 : 1.5, COLORS.WHITE, alpha)
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
    g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
    g.strokePath()
  }
  bake(g, scene, TEX.EVOLVE_BURST, size, size)
}

function generatePanel(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  const w = 320
  const h = 180
  const radius = 18
  g.fillStyle(COLORS.UI_PANEL, 0.82)
  g.fillRoundedRect(1, 1, w - 2, h - 2, radius)
  // Glowing membrane border (double stroke: soft halo + crisp line).
  g.lineStyle(4, COLORS.UI_PANEL_BORDER, 0.22)
  g.strokeRoundedRect(1, 1, w - 2, h - 2, radius)
  g.lineStyle(1.5, COLORS.UI_PANEL_BORDER, 0.9)
  g.strokeRoundedRect(1, 1, w - 2, h - 2, radius)
  bake(g, scene, TEX.PANEL, w, h)
}

function generateCard(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  const w = 240
  const h = 320
  const radius = 22
  // Translucent dark fill with a subtle vertical inner glow at the top.
  g.fillStyle(COLORS.UI_PANEL, 0.86)
  g.fillRoundedRect(2, 2, w - 4, h - 4, radius)
  g.fillStyle(0x12384a, 0.4)
  g.fillRoundedRect(2, 2, w - 4, (h - 4) * 0.4, radius)
  // Fancier glowing border: soft outer halo, mid, then bright crisp edge.
  g.lineStyle(6, 0x4ee5c8, 0.18)
  g.strokeRoundedRect(2, 2, w - 4, h - 4, radius)
  g.lineStyle(3, 0x37d6a8, 0.45)
  g.strokeRoundedRect(2, 2, w - 4, h - 4, radius)
  g.lineStyle(1.5, 0x7ff0d4, 0.95)
  g.strokeRoundedRect(2, 2, w - 4, h - 4, radius)
  bake(g, scene, TEX.CARD, w, h)
}

// ---------------------------------------------------------------------------
// 2. Players — one glowing organism per evolution stage
// ---------------------------------------------------------------------------

function generatePlayers(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  for (const stage of EVOLUTION_STAGES) {
    const r = stage.baseRadius
    const size = Math.max(64, Math.round(r * 6))
    const cx = size / 2
    const cy = size / 2
    const color = stage.color

    // Universal soft white-ish glow core behind every organism.
    drawGlow(g, cx, cy, r * 2.4, 0xeaffff, 0.22)
    drawGlow(g, cx, cy, r * 1.4, color, 0.4)

    switch (stage.key) {
      case 'molecule': {
        // A few small bonded dots around a faint central node.
        drawMembrane(g, cx, cy, r, color, 0.3, 0.85, 1.5)
        const bonds = 3
        for (let i = 0; i < bonds; i++) {
          const a = (i / bonds) * TAU - Math.PI / 2
          const bx = cx + Math.cos(a) * r * 0.9
          const by = cy + Math.sin(a) * r * 0.9
          g.lineStyle(1, color, 0.5)
          g.beginPath()
          g.moveTo(cx, cy)
          g.lineTo(bx, by)
          g.strokePath()
          drawGlow(g, bx, by, r * 0.7, color, 0.7)
          g.fillStyle(0xffffff, 0.9)
          g.fillCircle(bx, by, r * 0.35)
        }
        g.fillStyle(0xffffff, 0.9)
        g.fillCircle(cx, cy, r * 0.4)
        break
      }
      case 'protocell': {
        // Single bubble + inner inclusion.
        drawMembrane(g, cx, cy, r, color, 0.32, 0.9, 2)
        g.fillStyle(0xffffff, 0.18)
        g.fillCircle(cx - r * 0.28, cy - r * 0.3, r * 0.55)
        drawGlow(g, cx + r * 0.3, cy + r * 0.25, r * 0.7, color, 0.7)
        g.fillStyle(color, 0.85)
        g.fillCircle(cx + r * 0.3, cy + r * 0.25, r * 0.3)
        break
      }
      case 'prokaryote': {
        // Capsule body + a drawn flagellum tail.
        // Flagellum first (behind body): a wavy tail to the lower-right.
        g.lineStyle(2, color, 0.7)
        g.beginPath()
        g.moveTo(cx + r * 0.7, cy)
        const segs = 10
        for (let i = 1; i <= segs; i++) {
          const t = i / segs
          const fx = cx + r * 0.7 + t * r * 1.7
          const fy = cy + Math.sin(t * Math.PI * 3) * r * 0.4
          g.lineTo(fx, fy)
        }
        g.strokePath()
        // Capsule (rounded rect-ish drawn as overlapping circles).
        drawMembrane(g, cx - r * 0.25, cy, r * 0.85, color, 0.33, 0.9, 2)
        drawMembrane(g, cx + r * 0.35, cy, r * 0.7, color, 0.33, 0.9, 2)
        g.fillStyle(0xffffff, 0.85)
        g.fillCircle(cx - r * 0.2, cy - r * 0.2, r * 0.3)
        break
      }
      case 'eukaryote': {
        // Round body + nucleus + a few organelle dots.
        drawMembrane(g, cx, cy, r, color, 0.3, 0.9, 2)
        // Nucleus.
        drawGlow(g, cx, cy, r * 0.9, 0xffffff, 0.4)
        g.fillStyle(0xffffff, 0.5)
        g.fillCircle(cx, cy, r * 0.4)
        g.lineStyle(1.5, color, 0.8)
        g.strokeCircle(cx, cy, r * 0.4)
        // Organelles.
        const orgs = 4
        for (let i = 0; i < orgs; i++) {
          const a = (i / orgs) * TAU + 0.4
          const ox = cx + Math.cos(a) * r * 0.62
          const oy = cy + Math.sin(a) * r * 0.62
          g.fillStyle(color, 0.85)
          g.fillCircle(ox, oy, r * 0.16)
        }
        break
      }
      case 'colonial': {
        // Cluster of bound mini-blobs.
        const cells = 6
        const cluster = r * 0.55
        // Binding membrane behind.
        drawGlow(g, cx, cy, r * 1.05, color, 0.25)
        for (let i = 0; i < cells; i++) {
          const a = (i / cells) * TAU
          const mx = cx + Math.cos(a) * cluster
          const my = cy + Math.sin(a) * cluster
          drawMembrane(g, mx, my, r * 0.42, color, 0.4, 0.9, 1.5)
          g.fillStyle(0xffffff, 0.6)
          g.fillCircle(mx, my, r * 0.16)
        }
        // Central cell.
        drawMembrane(g, cx, cy, r * 0.45, color, 0.45, 0.95, 2)
        g.fillStyle(0xffffff, 0.8)
        g.fillCircle(cx, cy, r * 0.2)
        break
      }
      case 'multicellular': {
        // Larger cluster with a gut arc.
        drawMembrane(g, cx, cy, r, color, 0.28, 0.9, 2.5)
        // Inner cells.
        const cells = 7
        for (let i = 0; i < cells; i++) {
          const a = (i / cells) * TAU + 0.2
          const rr = i === 0 ? 0 : r * 0.55
          const mx = cx + Math.cos(a) * rr
          const my = cy + Math.sin(a) * rr
          g.fillStyle(color, 0.55)
          g.fillCircle(mx, my, r * 0.26)
          g.fillStyle(0xffffff, 0.45)
          g.fillCircle(mx, my, r * 0.12)
        }
        // Gut arc.
        g.lineStyle(2.5, 0xffffff, 0.55)
        g.beginPath()
        g.arc(cx, cy + r * 0.1, r * 0.6, Math.PI * 0.15, Math.PI * 0.85, false)
        g.strokePath()
        break
      }
      case 'organism':
      default: {
        // Apex: radiant core + orbiting cells + bright filaments.
        drawGlow(g, cx, cy, r * 1.6, 0xffffff, 0.35)
        drawMembrane(g, cx, cy, r, color, 0.26, 0.95, 3)
        // Bright filaments radiating outward.
        const fils = 10
        for (let i = 0; i < fils; i++) {
          const a = (i / fils) * TAU
          g.lineStyle(1.5, 0xffffff, 0.4)
          g.beginPath()
          g.moveTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5)
          g.lineTo(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05)
          g.strokePath()
        }
        // Orbiting cells.
        const orbit = 6
        for (let i = 0; i < orbit; i++) {
          const a = (i / orbit) * TAU + 0.3
          const ox = cx + Math.cos(a) * r * 0.72
          const oy = cy + Math.sin(a) * r * 0.72
          drawMembrane(g, ox, oy, r * 0.22, color, 0.5, 0.95, 1.5)
        }
        // Radiant core.
        drawGlow(g, cx, cy, r * 0.6, 0xffffff, 0.85)
        break
      }
    }

    bake(g, scene, stage.textureKey, size, size)
  }
}

// ---------------------------------------------------------------------------
// 3. Nutrients — friendly glowing collectibles, one per kind
// ---------------------------------------------------------------------------

function generateNutrients(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  for (const kind of NUTRIENT_KINDS) {
    const def = NUTRIENT_DEFS[kind]
    const r = def.radius
    const size = Math.max(28, Math.round(r * 5))
    const cx = size / 2
    const cy = size / 2
    const color = def.color

    // Friendly halo.
    drawGlow(g, cx, cy, r * 2.0, color, 0.5)

    switch (kind) {
      case 'sugar': {
        // Amber polygon ring + core.
        const pts = polygon(cx, cy, r * 1.1, 6, -Math.PI / 2)
        g.lineStyle(2, color, 0.9)
        g.strokePoints(pts, true, true)
        g.fillStyle(0xffffff, 0.9)
        g.fillCircle(cx, cy, r * 0.45)
        break
      }
      case 'amino_acid': {
        // Dot + kink (a small bent connector).
        drawGlow(g, cx, cy, r * 1.1, color, 0.8)
        g.fillStyle(0xffffff, 0.95)
        g.fillCircle(cx, cy, r * 0.55)
        g.lineStyle(2, color, 0.9)
        g.beginPath()
        g.moveTo(cx + r * 0.4, cy)
        g.lineTo(cx + r * 1.1, cy - r * 0.5)
        g.lineTo(cx + r * 1.4, cy + r * 0.2)
        g.strokePath()
        break
      }
      case 'lipid': {
        // Gold teardrop.
        g.fillStyle(color, 0.85)
        g.fillCircle(cx, cy + r * 0.2, r * 0.9)
        const tip = new Phaser.Geom.Point(cx, cy - r * 1.2)
        const left = new Phaser.Geom.Point(cx - r * 0.7, cy + r * 0.1)
        const right = new Phaser.Geom.Point(cx + r * 0.7, cy + r * 0.1)
        g.fillPoints([tip, left, right], true)
        g.fillStyle(0xffffff, 0.85)
        g.fillCircle(cx - r * 0.2, cy + r * 0.1, r * 0.35)
        break
      }
      case 'nucleotide': {
        // Paired green dots bound together.
        g.lineStyle(2, color, 0.8)
        g.beginPath()
        g.moveTo(cx - r * 0.5, cy - r * 0.5)
        g.lineTo(cx + r * 0.5, cy + r * 0.5)
        g.strokePath()
        drawGlow(g, cx - r * 0.45, cy - r * 0.45, r * 0.9, color, 0.85)
        drawGlow(g, cx + r * 0.45, cy + r * 0.45, r * 0.9, color, 0.85)
        g.fillStyle(0xffffff, 0.9)
        g.fillCircle(cx - r * 0.45, cy - r * 0.45, r * 0.45)
        g.fillCircle(cx + r * 0.45, cy + r * 0.45, r * 0.45)
        break
      }
      case 'mineral_ion': {
        // Cyan crystal facets (diamond/4-point).
        const pts = polygon(cx, cy, r * 1.1, 4, 0)
        g.fillStyle(color, 0.7)
        g.fillPoints(pts, true)
        g.lineStyle(1.5, 0xffffff, 0.9)
        g.strokePoints(pts, true, true)
        // Facet seam.
        g.lineStyle(1, 0xffffff, 0.6)
        g.beginPath()
        g.moveTo(cx, cy - r * 1.1)
        g.lineTo(cx, cy + r * 1.1)
        g.strokePath()
        break
      }
      case 'atp_globule': {
        // Bright gold pulsing dot (concentric bright rings).
        drawGlow(g, cx, cy, r * 1.6, color, 0.9)
        g.fillStyle(0xffffff, 0.95)
        g.fillCircle(cx, cy, r * 0.55)
        g.lineStyle(1.5, color, 0.9)
        g.strokeCircle(cx, cy, r * 0.95)
        break
      }
      case 'protein_cluster': {
        // Pink knotted blob (overlapping lobes).
        const lobes = 5
        for (let i = 0; i < lobes; i++) {
          const a = (i / lobes) * TAU
          const lx = cx + Math.cos(a) * r * 0.45
          const ly = cy + Math.sin(a) * r * 0.45
          g.fillStyle(color, 0.7)
          g.fillCircle(lx, ly, r * 0.55)
        }
        g.fillStyle(0xffffff, 0.55)
        g.fillCircle(cx, cy, r * 0.4)
        break
      }
      case 'prebiotic_gem':
      default: {
        // Violet faceted crystal (sharp octagon with inner facets).
        const pts = polygon(cx, cy, r * 1.15, 8, Math.PI / 8)
        g.fillStyle(color, 0.6)
        g.fillPoints(pts, true)
        g.lineStyle(1.5, 0xffffff, 0.95)
        g.strokePoints(pts, true, true)
        // Inner facet lines toward centre.
        g.lineStyle(1, 0xffffff, 0.45)
        for (let i = 0; i < pts.length; i += 2) {
          g.beginPath()
          g.moveTo(cx, cy)
          g.lineTo(pts[i].x, pts[i].y)
          g.strokePath()
        }
        g.fillStyle(0xffffff, 0.85)
        g.fillCircle(cx, cy, r * 0.3)
        break
      }
    }

    bake(g, scene, def.textureKey, size, size)
  }
}

// ---------------------------------------------------------------------------
// 4. Threats — harsh, saturated, spiky silhouettes that read as DANGER
// ---------------------------------------------------------------------------

function generateThreats(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  for (const kind of THREAT_KINDS) {
    const def = THREAT_DEFS[kind]
    const r = Math.max(def.radius, 12)
    const size = r * 5
    const cx = size / 2
    const cy = size / 2
    const color = def.color

    // Harsher, tighter halo than nutrients (more saturated, less soft).
    drawGlow(g, cx, cy, r * 1.7, color, 0.4)

    switch (kind) {
      case 'free_radical': {
        // Red spark star — jagged radiating points.
        const pts = spikyStar(cx, cy, r * 1.3, r * 0.4, 5, -Math.PI / 2)
        g.fillStyle(color, 0.85)
        g.fillPoints(pts, true)
        g.lineStyle(1.5, 0xffffff, 0.85)
        g.strokePoints(pts, true, true)
        g.fillStyle(0xffffff, 0.9)
        g.fillCircle(cx, cy, r * 0.3)
        break
      }
      case 'toxin_blob': {
        // Acid-green dripping blob.
        const pts = polygon(cx, cy - r * 0.1, r, 9, 0, 0.28)
        g.fillStyle(color, 0.8)
        g.fillPoints(pts, true)
        g.lineStyle(1.5, 0x4a7a1a, 0.9)
        g.strokePoints(pts, true, true)
        // Drips below.
        for (let i = -1; i <= 1; i++) {
          const dx = cx + i * r * 0.5
          g.fillStyle(color, 0.7)
          g.fillCircle(dx, cy + r * 0.9, r * 0.22)
        }
        g.fillStyle(0xeaffd0, 0.5)
        g.fillCircle(cx - r * 0.25, cy - r * 0.25, r * 0.3)
        break
      }
      case 'uv_burst': {
        // Violet-white ring (telegraph flash).
        drawGlow(g, cx, cy, r * 1.5, color, 0.5)
        g.lineStyle(3, 0xffffff, 0.85)
        g.strokeCircle(cx, cy, r * 1.1)
        g.lineStyle(2, color, 0.7)
        g.strokeCircle(cx, cy, r * 0.7)
        g.fillStyle(0xffffff, 0.5)
        g.fillCircle(cx, cy, r * 0.35)
        break
      }
      case 'predator_microbe': {
        // Grey-green amoeba with a mouth arc.
        const pts = polygon(cx, cy, r, 10, 0, 0.18)
        g.fillStyle(color, 0.8)
        g.fillPoints(pts, true)
        g.lineStyle(2, 0xffffff, 0.6)
        g.strokePoints(pts, true, true)
        // Mouth.
        g.lineStyle(3, 0x2a0a00, 0.8)
        g.beginPath()
        g.arc(cx + r * 0.15, cy, r * 0.55, Math.PI * 1.7, Math.PI * 0.3, false)
        g.strokePath()
        // Eye spots.
        g.fillStyle(0xffffff, 0.85)
        g.fillCircle(cx - r * 0.35, cy - r * 0.4, r * 0.16)
        break
      }
      case 'phage': {
        // Spiky icosahedral head + tail fibers.
        const head = polygon(cx, cy - r * 0.4, r * 0.7, 6, -Math.PI / 2)
        g.fillStyle(color, 0.85)
        g.fillPoints(head, true)
        g.lineStyle(1.5, 0xffffff, 0.8)
        g.strokePoints(head, true, true)
        // Sheath.
        g.fillStyle(color, 0.7)
        g.fillRect(cx - r * 0.18, cy + r * 0.2, r * 0.36, r * 0.7)
        // Tail fibers.
        g.lineStyle(1.5, 0xffffff, 0.7)
        for (let i = -2; i <= 2; i++) {
          g.beginPath()
          g.moveTo(cx + i * r * 0.12, cy + r * 0.9)
          g.lineTo(cx + i * r * 0.45, cy + r * 1.5)
          g.strokePath()
        }
        break
      }
      case 'acid_current': {
        // Cyan band streak — horizontal flowing hazard.
        for (let i = 0; i < 4; i++) {
          const yy = cy + (i - 1.5) * r * 0.4
          const alpha = 0.55 - i * 0.06
          g.lineStyle(r * 0.28, color, Math.max(0.1, alpha))
          g.beginPath()
          g.moveTo(cx - r * 1.6, yy + Math.sin(i) * r * 0.2)
          g.lineTo(cx + r * 1.6, yy - Math.sin(i) * r * 0.2)
          g.strokePath()
        }
        // Bright bubbles.
        for (let i = 0; i < 5; i++) {
          g.fillStyle(0xffffff, 0.6)
          g.fillCircle(cx - r * 1.2 + i * r * 0.6, cy + (i % 2 ? -r * 0.3 : r * 0.3), r * 0.14)
        }
        break
      }
      case 'amoeba_hunter': {
        // Dark-orange blob with reaching arms.
        const arms = 5
        for (let i = 0; i < arms; i++) {
          const a = (i / arms) * TAU + 0.3
          const ax = cx + Math.cos(a) * r * 1.2
          const ay = cy + Math.sin(a) * r * 1.2
          g.lineStyle(r * 0.3, color, 0.7)
          g.beginPath()
          g.moveTo(cx, cy)
          g.lineTo(ax, ay)
          g.strokePath()
          g.fillStyle(color, 0.7)
          g.fillCircle(ax, ay, r * 0.22)
        }
        const body = polygon(cx, cy, r * 0.8, 8, 0, 0.16)
        g.fillStyle(color, 0.85)
        g.fillPoints(body, true)
        g.fillStyle(0x2a0a00, 0.7)
        g.fillCircle(cx, cy, r * 0.3)
        g.fillStyle(0xffd0a0, 0.6)
        g.fillCircle(cx - r * 0.2, cy - r * 0.2, r * 0.18)
        break
      }
      case 'toxin_jelly': {
        // Teal medusa bell with trailing tentacles.
        g.fillStyle(color, 0.7)
        g.beginPath()
        g.arc(cx, cy - r * 0.1, r * 0.85, Math.PI, TAU, false)
        g.closePath()
        g.fillPath()
        g.lineStyle(2, 0xffffff, 0.6)
        g.beginPath()
        g.arc(cx, cy - r * 0.1, r * 0.85, Math.PI, TAU, false)
        g.strokePath()
        // Tentacles.
        g.lineStyle(1.5, color, 0.7)
        for (let i = -2; i <= 2; i++) {
          const tx = cx + i * r * 0.35
          g.beginPath()
          g.moveTo(tx, cy - r * 0.1)
          g.lineTo(tx + Math.sin(i) * r * 0.2, cy + r * 1.2)
          g.strokePath()
        }
        g.fillStyle(0xffffff, 0.45)
        g.fillCircle(cx, cy - r * 0.25, r * 0.35)
        break
      }
      case 'apex_predator':
      default: {
        // Dark-red sharp hunter — aggressive spiky maw.
        const outer = spikyStar(cx, cy, r * 1.25, r * 0.6, 8, -Math.PI / 2)
        g.fillStyle(color, 0.88)
        g.fillPoints(outer, true)
        g.lineStyle(2, 0xff5a5a, 0.9)
        g.strokePoints(outer, true, true)
        // Inner maw.
        g.fillStyle(0x1a0000, 0.85)
        g.fillCircle(cx, cy, r * 0.55)
        // Fangs.
        g.fillStyle(0xffffff, 0.9)
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + Math.PI / 4
          const fx = cx + Math.cos(a) * r * 0.5
          const fy = cy + Math.sin(a) * r * 0.5
          g.fillCircle(fx, fy, r * 0.12)
        }
        // Predator eye.
        drawGlow(g, cx, cy, r * 0.4, 0xff3030, 0.9)
        break
      }
    }

    bake(g, scene, def.textureKey, size, size)
  }
}

// ---------------------------------------------------------------------------
// 5. Mutation icons — tier-tinted emblems with a stat-hinting glyph
// ---------------------------------------------------------------------------

/** Draw a glyph hinting at the mutation's stat onto the 48x48 emblem. */
function drawMutationGlyph(
  g: Phaser.GameObjects.Graphics,
  m: Mutation,
  cx: number,
  cy: number,
  s: number,
  tint: number,
): void {
  const stat = m.stat
  g.lineStyle(3, COLORS.WHITE, 0.95)
  g.fillStyle(COLORS.WHITE, 0.95)

  // Group stats into a handful of recognisable glyph families.
  if (
    stat === 'speedMult' ||
    stat === 'biomassGainMult' ||
    stat === 'energyGainMult' ||
    stat === 'maxHealthMult' ||
    stat === 'maxEnergyMult' ||
    stat === 'comboBiomassMult' ||
    stat === 'engulfPowerMult' ||
    stat === 'dashPowerMult'
  ) {
    // Arrow up (boost).
    g.beginPath()
    g.moveTo(cx, cy - s)
    g.lineTo(cx - s * 0.7, cy)
    g.lineTo(cx + s * 0.7, cy)
    g.closePath()
    g.fillPath()
    g.fillRect(cx - s * 0.22, cy, s * 0.44, s)
  } else if (
    stat === 'damageReduction' ||
    stat === 'toxinDamageMult' ||
    stat === 'reflectMult'
  ) {
    // Shield.
    g.beginPath()
    g.moveTo(cx, cy - s)
    g.lineTo(cx + s * 0.8, cy - s * 0.5)
    g.lineTo(cx + s * 0.8, cy + s * 0.2)
    g.lineTo(cx, cy + s)
    g.lineTo(cx - s * 0.8, cy + s * 0.2)
    g.lineTo(cx - s * 0.8, cy - s * 0.5)
    g.closePath()
    g.fillPath()
    g.lineStyle(2, tint, 0.9)
    g.beginPath()
    g.moveTo(cx, cy - s * 0.6)
    g.lineTo(cx, cy + s * 0.5)
    g.strokePath()
  } else if (
    stat === 'healthRegen' ||
    stat === 'passiveEnergyRegen' ||
    stat === 'energyDrainMult'
  ) {
    // Droplet (regen / sustain).
    g.beginPath()
    g.moveTo(cx, cy - s)
    g.lineTo(cx + s * 0.75, cy + s * 0.45)
    g.arc(cx, cy + s * 0.45, s * 0.75, 0, Math.PI, false)
    g.closePath()
    g.fillPath()
    g.fillStyle(tint, 0.6)
    g.fillCircle(cx - s * 0.25, cy + s * 0.3, s * 0.22)
  } else if (stat === 'contactDamage') {
    // Spikes (barbs).
    const pts = spikyStar(cx, cy, s, s * 0.4, 6, -Math.PI / 2)
    g.fillPoints(pts, true)
  } else if (stat === 'pickupRadiusMult' || stat === 'nutrientRadar' || stat === 'threatRadar') {
    // Concentric radar rings + dot.
    g.lineStyle(2.5, COLORS.WHITE, 0.95)
    g.strokeCircle(cx, cy, s)
    g.strokeCircle(cx, cy, s * 0.6)
    g.fillCircle(cx, cy, s * 0.22)
  } else {
    // Default: a bright star burst.
    const pts = spikyStar(cx, cy, s, s * 0.45, 5, -Math.PI / 2)
    g.fillPoints(pts, true)
  }
}

function generateMutationIcons(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  for (const m of MUTATION_LIST) {
    const size = 48
    const cx = size / 2
    const cy = size / 2
    const tint = TIER_COLORS[m.tier] ?? TIER_COLORS[1]

    // Tier-tinted emblem disc with glow.
    drawGlow(g, cx, cy, 22, tint, 0.55)
    g.fillStyle(0x0a1a1f, 0.9)
    g.fillCircle(cx, cy, 20)
    g.lineStyle(2.5, tint, 0.95)
    g.strokeCircle(cx, cy, 20)

    drawMutationGlyph(g, m, cx, cy, 9, tint)

    bake(g, scene, m.iconKey, size, size)
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Generate every procedural texture the game needs. Idempotent: existing
 * textures are skipped, so it is safe to call from BootScene on every boot.
 */
export function generateAll(scene: Phaser.Scene): void {
  // One reusable Graphics object; never added to the display list.
  const g = new Phaser.GameObjects.Graphics(scene)

  try {
    // 1. Static / UI / FX.
    generateSoftGlow(g, scene)
    generateSpark(g, scene)
    generateVignette(g, scene)
    generateDish(g, scene)
    generateEvolveBurst(g, scene)
    generatePanel(g, scene)
    generateCard(g, scene)

    // 2-5. Data-driven sets (iterate the data arrays so keys never drift).
    generatePlayers(g, scene)
    generateNutrients(g, scene)
    generateThreats(g, scene)
    generateMutationIcons(g, scene)
  } finally {
    g.destroy()
  }
}

export const TextureFactory = { generateAll }
