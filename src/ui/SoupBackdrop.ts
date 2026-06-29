import Phaser from 'phaser'

import { COLORS, DEPTHS, TEX, VIEW, WORLD } from '@/config/constants'
import { getPalette, type Palette } from '@/data/palettes'

/**
 * Construction options for {@link SoupBackdrop}.
 *
 * - `world`    — when true the backdrop fills the full WORLD bounds (for
 *                GameScene) and pins itself to the camera through parallax
 *                scroll factors; when false it covers just the VIEW (menus).
 * - `parallax` — only meaningful when `world` is true. Disables differential
 *                scroll factors so the whole backdrop scrolls with the camera.
 */
export interface SoupBackdropOptions {
  readonly world?: boolean
  readonly parallax?: boolean
}

/** A single huge, slowly drifting "light pool" smear behind the soup. */
interface LightPool {
  readonly img: Phaser.GameObjects.Image
  readonly baseX: number
  readonly baseY: number
  readonly driftRadius: number
  readonly phase: number
  readonly speed: number
  /** Which palette role this pool is tinted with (lets re-tint follow). */
  readonly tone: 'accentMid' | 'glowBright' | 'accentDark'
}

/** A small ambient mote that drifts and wraps within the bounds. */
interface Mote {
  readonly img: Phaser.GameObjects.Image
  vx: number
  vy: number
  readonly twinkleSpeed: number
  readonly twinklePhase: number
  readonly baseAlpha: number
}

const MAX_MOTES = 60
const LIGHT_POOL_COUNT = 5
const RETINT_MS = 600

/**
 * Procedural, animated primordial-soup background.
 *
 * Built entirely from generated textures (no external assets): a flat deep
 * fill, several huge additive "light pools", a field of drifting ambient
 * motes, and a soft vignette for depth. The whole thing re-tints to the
 * current evolution-stage palette via {@link setStage}.
 */
export class SoupBackdrop extends Phaser.GameObjects.Container {
  private readonly isWorld: boolean
  private readonly useParallax: boolean
  private readonly boundsW: number
  private readonly boundsH: number

  private readonly base: Phaser.GameObjects.Rectangle
  private readonly midWash: Phaser.GameObjects.Image
  private readonly pools: LightPool[] = []
  private readonly motes: Mote[] = []
  private readonly vignette: Phaser.GameObjects.Image

  private currentStage = 0
  private palette: Palette
  private retintTween?: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene, opts: SoupBackdropOptions = {}) {
    super(scene, 0, 0)

    this.isWorld = opts.world === true
    this.useParallax = this.isWorld && opts.parallax !== false
    this.boundsW = this.isWorld ? WORLD.WIDTH : VIEW.WIDTH
    this.boundsH = this.isWorld ? WORLD.HEIGHT : VIEW.HEIGHT

    this.palette = getPalette(0)

    // The container itself never scrolls; children carry their own scroll
    // factors so parallax depth works while a single object owns everything.
    this.setDepth(DEPTHS.BACKGROUND)
    this.setScrollFactor(0)

    // (1) Flat deep base fill — the darkest layer of the soup.
    this.base = scene.add
      .rectangle(0, 0, this.boundsW, this.boundsH, this.palette.bgDeep, 1)
      .setOrigin(0, 0)
      .setScrollFactor(this.useParallax ? 1 : 0)
    this.add(this.base)

    // A single oversized soft-glow wash gives the base a subtle mid-tone
    // gradient without needing a real gradient texture.
    this.midWash = scene.add
      .image(this.boundsW * 0.5, this.boundsH * 0.5, TEX.SOFT_GLOW)
      .setScrollFactor(this.useParallax ? 0.85 : 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.palette.bgMid)
      .setAlpha(0.55)
    this.fitToBounds(this.midWash, 1.25)
    this.add(this.midWash)

    this.buildLightPools(scene)
    this.buildMotes(scene)

    // (2) Soft vignette over the top for depth. In world mode it must hug the
    // camera (scrollFactor 0) so the dark frame stays put as the player moves.
    this.vignette = scene.add
      .image(0, 0, TEX.VIGNETTE)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDisplaySize(VIEW.WIDTH, VIEW.HEIGHT)
      .setTint(COLORS.BACKDROP)
      .setAlpha(this.isWorld ? 0.55 : 0.4)
    this.add(this.vignette)

    scene.add.existing(this)
  }

  /** Scale a soft-glow image to span the bounds (times an oversize factor). */
  private fitToBounds(img: Phaser.GameObjects.Image, oversize: number): void {
    const span = Math.max(this.boundsW, this.boundsH) * oversize
    img.setDisplaySize(span, span)
  }

  private buildLightPools(scene: Phaser.Scene): void {
    const tones: LightPool['tone'][] = [
      'accentMid',
      'glowBright',
      'accentDark',
      'accentMid',
      'glowBright',
    ]

    for (let i = 0; i < LIGHT_POOL_COUNT; i += 1) {
      const baseX = (this.boundsW / (LIGHT_POOL_COUNT + 1)) * (i + 1)
      const baseY =
        this.boundsH * (0.22 + 0.6 * ((i * 0.37) % 1)) // pseudo-scattered
      const tone = tones[i % tones.length]
      const scale = 0.55 + (i % 3) * 0.35

      // Parallax: pools sit "deeper" than motes, so they scroll slowest.
      const scrollFactor = this.useParallax ? 0.35 + (i % 3) * 0.12 : 0

      const img = scene.add
        .image(baseX, baseY, TEX.SOFT_GLOW)
        .setScrollFactor(scrollFactor)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(this.palette[tone])
        .setAlpha(0.16 + (i % 2) * 0.05)
      const span = Math.min(this.boundsW, this.boundsH) * scale
      img.setDisplaySize(span, span)
      this.add(img)

      this.pools.push({
        img,
        baseX,
        baseY,
        driftRadius: 28 + (i % 4) * 18,
        phase: (i / LIGHT_POOL_COUNT) * Math.PI * 2,
        speed: 0.00008 + (i % 3) * 0.00004,
        tone,
      })
    }
  }

  private buildMotes(scene: Phaser.Scene): void {
    // Fewer motes for the small menu view, capped for the large world view.
    const count = this.isWorld ? MAX_MOTES : Math.round(MAX_MOTES * 0.6)

    for (let i = 0; i < count; i += 1) {
      const x = Math.random() * this.boundsW
      const y = Math.random() * this.boundsH
      const size = 3 + Math.random() * 9
      const baseAlpha = 0.08 + Math.random() * 0.18

      // Near/mid/far layering drives both depth-tint and parallax speed.
      const layer = i % 3
      const scrollFactor = this.useParallax ? 0.5 + layer * 0.22 : 0
      const tint =
        layer === 2
          ? this.palette.highlight
          : layer === 1
            ? this.palette.glowBright
            : this.palette.accentMid

      const img = scene.add
        .image(x, y, TEX.SOFT_GLOW)
        .setDisplaySize(size, size)
        .setScrollFactor(scrollFactor)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setAlpha(baseAlpha)
      this.add(img)

      const speed = 4 + Math.random() * 12
      const dir = Math.random() * Math.PI * 2
      this.motes.push({
        img,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        twinkleSpeed: 0.001 + Math.random() * 0.002,
        twinklePhase: Math.random() * Math.PI * 2,
        baseAlpha,
      })
    }
  }

  /**
   * Advance ambient drift. `timeMs` is the scene clock, `deltaMs` the frame
   * delta. Motes wrap within the bounds; light pools orbit their base point.
   */
  update(timeMs: number, deltaMs: number): void {
    const dt = deltaMs / 1000

    // Light pools — gentle elliptical orbit + slow alpha breathing.
    for (const pool of this.pools) {
      const t = timeMs * pool.speed + pool.phase
      pool.img.x = pool.baseX + Math.cos(t) * pool.driftRadius
      pool.img.y = pool.baseY + Math.sin(t * 0.8) * pool.driftRadius * 0.7
    }

    // Subtle wash drift so the mid-tone gradient is never perfectly static.
    this.midWash.x =
      this.boundsW * 0.5 + Math.cos(timeMs * 0.00005) * this.boundsW * 0.04
    this.midWash.y =
      this.boundsH * 0.5 + Math.sin(timeMs * 0.00004) * this.boundsH * 0.04

    // Ambient motes — drift, wrap, twinkle.
    for (const mote of this.motes) {
      const img = mote.img
      img.x += mote.vx * dt
      img.y += mote.vy * dt

      if (img.x < -16) img.x = this.boundsW + 16
      else if (img.x > this.boundsW + 16) img.x = -16
      if (img.y < -16) img.y = this.boundsH + 16
      else if (img.y > this.boundsH + 16) img.y = -16

      const twinkle =
        0.65 + 0.35 * Math.sin(timeMs * mote.twinkleSpeed + mote.twinklePhase)
      img.setAlpha(mote.baseAlpha * twinkle)
    }
  }

  /**
   * Re-tint the backdrop to the palette for `stageId`. When `animate` is not
   * explicitly false the colours cross-fade over ~600ms; otherwise they snap.
   */
  setStage(stageId: number, animate = true): this {
    const next = getPalette(stageId)
    this.currentStage = stageId

    if (this.retintTween) {
      this.retintTween.stop()
      this.retintTween = undefined
    }

    if (!animate) {
      this.applyPalette(next)
      this.palette = next
      return this
    }

    const from = this.palette
    const fromColors = this.snapshot(from)
    const toColors = this.snapshot(next)

    this.retintTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: RETINT_MS,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0
        const blended: Palette = {
          bgDeep: this.mix(fromColors.bgDeep, toColors.bgDeep, t),
          bgMid: this.mix(fromColors.bgMid, toColors.bgMid, t),
          accentDark: this.mix(fromColors.accentDark, toColors.accentDark, t),
          accentMid: this.mix(fromColors.accentMid, toColors.accentMid, t),
          glowBright: this.mix(fromColors.glowBright, toColors.glowBright, t),
          highlight: this.mix(fromColors.highlight, toColors.highlight, t),
          danger: this.mix(fromColors.danger, toColors.danger, t),
        }
        this.applyPalette(blended)
      },
      onComplete: () => {
        this.applyPalette(next)
        this.palette = next
        this.retintTween = undefined
      },
    })

    return this
  }

  /** Push the given palette onto every tinted element. */
  private applyPalette(p: Palette): void {
    this.base.setFillStyle(p.bgDeep, 1)
    this.midWash.setTint(p.bgMid)

    for (const pool of this.pools) {
      pool.img.setTint(p[pool.tone])
    }

    // Motes follow their layered roles; recompute by index layer.
    for (let i = 0; i < this.motes.length; i += 1) {
      const layer = i % 3
      const tint =
        layer === 2 ? p.highlight : layer === 1 ? p.glowBright : p.accentMid
      this.motes[i].img.setTint(tint)
    }
  }

  /** Capture the palette's numeric colours (already numbers — identity copy). */
  private snapshot(p: Palette): Palette {
    return { ...p }
  }

  /** Interpolate between two packed RGB colours, returning a packed colour. */
  private mix(a: number, b: number, t: number): number {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(a),
      Phaser.Display.Color.ValueToColor(b),
      100,
      Math.round(t * 100),
    )
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b)
  }

  /** Current stage id this backdrop is tuned to. */
  get stage(): number {
    return this.currentStage
  }
}
