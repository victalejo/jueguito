/**
 * Bar — a juicy, glowing HUD meter for "Soup Genesis: Rise of the Cell".
 *
 * Renders a rounded translucent background, a rounded fill that glides toward
 * its target value (so health/energy/biomass changes feel organic rather than
 * snapping), a thin luminous outline, and an optional small label.
 *
 * Visual direction: "luminous microscopy" — soft halos and additive-feeling
 * glow. The bar is treated with its top-left at (x, y); it adds itself to the
 * scene on construction.
 */

import Phaser from 'phaser'
import { COLORS } from '@/config/constants'

/** Default translucent backing colour for the trough. */
const DEFAULT_BG_COLOR = 0x0a1822
/** How fast the displayed value chases its target, in fraction units / second. */
const DEFAULT_BG_ALPHA = 0.62
/** Corner radius is derived from height so the bar always reads as a capsule. */
const RADIUS_RATIO = 0.5

export interface BarOptions {
  label?: string
  bgColor?: number
  glyph?: string
}

export class Bar extends Phaser.GameObjects.Container {
  private readonly barWidth: number
  private readonly barHeight: number
  private readonly radius: number

  /** Static backing trough (drawn once). */
  private readonly bgGfx: Phaser.GameObjects.Graphics
  /** Dynamic fill, redrawn every time the displayed value changes. */
  private readonly fillGfx: Phaser.GameObjects.Graphics
  /** Thin luminous rim drawn over everything (static). */
  private readonly outlineGfx: Phaser.GameObjects.Graphics
  /** Optional label / glyph shown to the left of the fill, vertically centred. */
  private readonly labelText: Phaser.GameObjects.Text | null

  private fillColor: number
  private readonly bgColor: number

  /** The value we are animating toward (0..1). */
  private targetValue = 1
  /** The value currently rendered (0..1) — glides toward {@link targetValue}. */
  private displayedValue = 1

  private fillTween: Phaser.Tweens.Tween | null = null
  private flashTween: Phaser.Tweens.Tween | null = null
  private pulseTween: Phaser.Tweens.Tween | null = null

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number,
    opts: BarOptions = {},
  ) {
    super(scene, x, y)

    this.barWidth = Math.max(1, width)
    this.barHeight = Math.max(1, height)
    this.radius = Math.min(this.barWidth, this.barHeight) * RADIUS_RATIO
    this.fillColor = fillColor
    this.bgColor = opts.bgColor ?? DEFAULT_BG_COLOR

    // --- Backing trough -----------------------------------------------------
    this.bgGfx = scene.add.graphics()
    this.add(this.bgGfx)
    this.drawBackground()

    // --- Dynamic fill -------------------------------------------------------
    this.fillGfx = scene.add.graphics()
    this.add(this.fillGfx)

    // --- Luminous outline ---------------------------------------------------
    this.outlineGfx = scene.add.graphics()
    this.add(this.outlineGfx)
    this.drawOutline()

    // --- Optional label -----------------------------------------------------
    const labelString = opts.glyph ?? opts.label ?? null
    if (labelString !== null && labelString.length > 0) {
      const fontSize = Math.max(9, Math.round(this.barHeight * 0.62))
      this.labelText = scene.add
        .text(6, this.barHeight / 2, labelString, {
          fontFamily: 'Arial, sans-serif',
          fontSize: `${fontSize}px`,
          color: hex(COLORS.UI_TEXT),
        })
        .setOrigin(0, 0.5)
      this.labelText.setShadow(0, 0, hex(COLORS.WHITE), 4, false, true)
      this.add(this.labelText)
    } else {
      this.labelText = null
    }

    // Container origin is its registration point; we treat (x, y) as top-left,
    // which is the natural local space for all child graphics drawn from 0,0.
    this.setSize(this.barWidth, this.barHeight)

    // Start full so the first real setValue glides down rather than popping up.
    this.redrawFill()

    scene.add.existing(this)
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Set the target fill fraction (clamped to 0..1). When {@link animate} is not
   * explicitly false, the displayed value glides toward the target via a tween;
   * otherwise it snaps immediately.
   */
  setValue(fraction: number, animate = true): this {
    const next = Phaser.Math.Clamp(fraction, 0, 1)
    this.targetValue = next

    this.fillTween?.remove()
    this.fillTween = null

    if (!animate || this.scene === undefined) {
      this.displayedValue = next
      this.redrawFill()
      return this
    }

    // Distance-proportional duration keeps small ticks snappy and big swings
    // (e.g. a fresh evolution) smooth, capped so it never feels sluggish.
    const distance = Math.abs(next - this.displayedValue)
    const duration = Phaser.Math.Clamp(distance * 520, 90, 420)

    this.fillTween = this.scene.tweens.add({
      targets: this,
      displayedValue: next,
      duration,
      ease: 'Sine.easeOut',
      onUpdate: () => this.redrawFill(),
      onComplete: () => {
        this.displayedValue = next
        this.redrawFill()
      },
    })

    return this
  }

  /** Swap the fill colour and immediately re-render with it. */
  setFillColor(color: number): this {
    this.fillColor = color
    this.redrawFill()
    return this
  }

  /** Replace the label text (creates nothing if the bar has no label slot). */
  setLabel(text: string): this {
    if (this.labelText !== null) {
      this.labelText.setText(text)
    }
    return this
  }

  /** Brief scale + alpha pulse to draw the player's eye to this bar. */
  pulse(): this {
    if (this.scene === undefined) {
      return this
    }
    this.pulseTween?.remove()
    this.setScale(1)
    this.setAlpha(1)

    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1.06,
      scaleY: 1.18,
      duration: 110,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        this.setScale(1)
      },
    })
    return this
  }

  /**
   * Quick colour flash over the fill — typically used on damage. Restores the
   * original fill colour once the flash completes.
   */
  flash(color: number = COLORS.DANGER): this {
    if (this.scene === undefined) {
      return this
    }
    this.flashTween?.remove()

    const original = this.fillColor
    const flashState = { t: 0 }

    this.flashTween = this.scene.tweens.add({
      targets: flashState,
      t: 1,
      duration: 220,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        // Interpolate from the flash colour back toward the original.
        const blended = blendColor(color, original, flashState.t)
        this.fillColor = blended
        this.redrawFill()
      },
      onComplete: () => {
        this.fillColor = original
        this.redrawFill()
      },
    })
    return this
  }

  /** Tear down owned tweens before the container is destroyed. */
  override destroy(fromScene?: boolean): void {
    this.fillTween?.remove()
    this.flashTween?.remove()
    this.pulseTween?.remove()
    this.fillTween = null
    this.flashTween = null
    this.pulseTween = null
    super.destroy(fromScene)
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /** Translucent rounded trough — drawn once at construction. */
  private drawBackground(): void {
    this.bgGfx.clear()
    this.bgGfx.fillStyle(this.bgColor, DEFAULT_BG_ALPHA)
    this.bgGfx.fillRoundedRect(0, 0, this.barWidth, this.barHeight, this.radius)
  }

  /** Thin double-stroke rim for a soft glowing edge — drawn once. */
  private drawOutline(): void {
    this.outlineGfx.clear()
    // Outer faint halo stroke.
    this.outlineGfx.lineStyle(2.5, COLORS.WHITE, 0.06)
    this.outlineGfx.strokeRoundedRect(
      -0.5,
      -0.5,
      this.barWidth + 1,
      this.barHeight + 1,
      this.radius,
    )
    // Crisp inner rim.
    this.outlineGfx.lineStyle(1, COLORS.UI_PANEL_BORDER, 0.55)
    this.outlineGfx.strokeRoundedRect(
      0.5,
      0.5,
      this.barWidth - 1,
      this.barHeight - 1,
      Math.max(0, this.radius - 0.5),
    )
  }

  /** Redraw the dynamic fill to the current displayed value. */
  private redrawFill(): void {
    this.fillGfx.clear()

    const fraction = Phaser.Math.Clamp(this.displayedValue, 0, 1)
    if (fraction <= 0) {
      return
    }

    // The fill must never overflow the rounded ends, so it is at least one
    // diameter wide before it reads as a capsule.
    const fillW = Math.max(this.barHeight, this.barWidth * fraction)
    const w = Math.min(fillW, this.barWidth)
    const r = Math.min(this.radius, w * RADIUS_RATIO)

    // Soft under-glow: a slightly larger, very translucent pass behind the fill.
    this.fillGfx.fillStyle(this.fillColor, 0.22)
    this.fillGfx.fillRoundedRect(-1, -1, w + 2, this.barHeight + 2, r + 1)

    // Main fill.
    this.fillGfx.fillStyle(this.fillColor, 0.95)
    this.fillGfx.fillRoundedRect(0, 0, w, this.barHeight, r)

    // Top highlight sheen for a wet, luminous look.
    const sheenH = Math.max(1, this.barHeight * 0.34)
    this.fillGfx.fillStyle(COLORS.WHITE, 0.16)
    this.fillGfx.fillRoundedRect(
      1.5,
      1.5,
      Math.max(0, w - 3),
      sheenH,
      Math.min(r, sheenH * 0.5),
    )
  }
}

// ---------------------------------------------------------------------------
// Local colour helpers (numeric in, numeric/string out — never leaks "#abc"
// strings into Phaser fill/tint APIs; only the Text style consumes a string).
// ---------------------------------------------------------------------------

/** Convert a 0xRRGGBB numeric colour into the "#rrggbb" string Text styles need. */
function hex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`
}

/**
 * Linearly interpolate between two numeric colours.
 * @param from numeric colour at t = 0
 * @param to   numeric colour at t = 1
 * @param t    interpolation factor 0..1
 */
function blendColor(from: number, to: number, t: number): number {
  const clamped = Phaser.Math.Clamp(t, 0, 1)
  const result = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(from),
    Phaser.Display.Color.ValueToColor(to),
    100,
    Math.round(clamped * 100),
  )
  return Phaser.Display.Color.GetColor(result.r, result.g, result.b)
}
