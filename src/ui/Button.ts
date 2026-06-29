/**
 * Button — a glowing, "juicy" rounded-rect UI button for Soup Genesis.
 *
 * Visuals are drawn entirely with a Phaser.GameObjects.Graphics rounded rect
 * (no external assets), layered as: soft outer glow + filled body + accent
 * border + centered label + optional corner hotkey badge. Interaction is fully
 * tweened (hover scale/brighten, press squash) and wired to the Web Audio UI
 * cues via the shared AudioManager.
 *
 * The button is a self-contained Container: it adds itself to the scene on
 * construction and exposes a tiny imperative API (setLabel / setEnabled).
 */
import Phaser from 'phaser'
import { COLORS } from '@/config/constants'
import { getAudio } from '@/core/audio'

/** Optional construction overrides. All have sensible defaults. */
export interface ButtonOpts {
  width?: number
  height?: number
  fontSize?: number
  /** Brighter accent fill/border, used for the dominant call-to-action. */
  primary?: boolean
  /** Small badge text shown in the top-right corner (e.g. 'E', 'Space'). */
  hotkey?: string
}

const DEFAULTS = {
  WIDTH: 240,
  HEIGHT: 56,
  FONT_SIZE: 22,
} as const

export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly labelText: Phaser.GameObjects.Text
  private readonly hotkeyBadge?: Phaser.GameObjects.Text

  private readonly bw: number
  private readonly bh: number
  private readonly primary: boolean
  private readonly onClick: () => void

  /** When false the button is greyed out and ignores all pointer input. */
  private isEnabled = true
  /** Tracks press state so pointerup off the button does not fire onClick. */
  private isPressed = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    opts: ButtonOpts = {},
  ) {
    super(scene, x, y)

    this.bw = opts.width ?? DEFAULTS.WIDTH
    this.bh = opts.height ?? DEFAULTS.HEIGHT
    this.primary = opts.primary ?? false
    this.onClick = onClick

    this.bg = scene.add.graphics()
    this.add(this.bg)
    this.drawBody(false)

    this.labelText = scene.add
      .text(0, 0, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${opts.fontSize ?? DEFAULTS.FONT_SIZE}px`,
        fontStyle: this.primary ? 'bold' : 'normal',
        color: toHexColor(COLORS.UI_TEXT),
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(2)
    this.add(this.labelText)

    if (opts.hotkey) {
      this.hotkeyBadge = scene.add
        .text(this.bw / 2 - 10, -this.bh / 2 + 10, opts.hotkey, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Math.round((opts.fontSize ?? DEFAULTS.FONT_SIZE) * 0.6)}px`,
          fontStyle: 'bold',
          color: toHexColor(COLORS.UI_DIM),
          align: 'center',
        })
        .setOrigin(1, 0)
        .setResolution(2)
      this.add(this.hotkeyBadge)
    }

    this.setSize(this.bw, this.bh)
    this.setInteractive(
      new Phaser.Geom.Rectangle(-this.bw / 2, -this.bh / 2, this.bw, this.bh),
      Phaser.Geom.Rectangle.Contains,
    )
    this.wireInput()

    scene.add.existing(this)
  }

  /** Update the centered label text. Returns `this` for chaining. */
  setLabel(text: string): this {
    this.labelText.setText(text)
    return this
  }

  /**
   * Enable / disable the button. Disabled buttons fade to ~50% alpha, drop any
   * hover/press state, and stop responding to pointer input.
   */
  setEnabled(enabled: boolean): this {
    if (this.isEnabled === enabled) return this
    this.isEnabled = enabled

    if (enabled) {
      if (this.input) this.input.enabled = true
      this.setAlpha(1)
    } else {
      if (this.input) this.input.enabled = false
      this.isPressed = false
      this.scene.tweens.killTweensOf(this)
      this.setScale(1)
      this.drawBody(false)
      this.setAlpha(0.5)
    }
    return this
  }

  private wireInput(): void {
    this.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (!this.isEnabled) return
      this.drawBody(true)
      this.tweenScale(1.05)
      getAudio(this.scene.game)?.play('uiHover')
    })

    this.on(Phaser.Input.Events.POINTER_OUT, () => {
      if (!this.isEnabled) return
      this.isPressed = false
      this.drawBody(false)
      this.tweenScale(1)
    })

    this.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.isEnabled) return
      this.isPressed = true
      this.tweenScale(0.96)
    })

    this.on(Phaser.Input.Events.POINTER_UP, () => {
      if (!this.isEnabled || !this.isPressed) return
      this.isPressed = false
      this.tweenScale(1.05)
      getAudio(this.scene.game)?.play('uiSelect')
      this.onClick()
    })
  }

  private tweenScale(target: number): void {
    this.scene.tweens.killTweensOf(this)
    this.scene.tweens.add({
      targets: this,
      scaleX: target,
      scaleY: target,
      duration: 120,
      ease: 'Back.easeOut',
    })
  }

  /**
   * Redraw the rounded-rect body. `hovered` raises the glow + border intensity
   * for the "luminous microscopy" feel. Primary buttons read brighter/greener.
   */
  private drawBody(hovered: boolean): void {
    const g = this.bg
    g.clear()

    const radius = Math.min(16, this.bh / 2)
    const halfW = this.bw / 2
    const halfH = this.bh / 2

    const border = this.primary ? COLORS.UI_PANEL_BORDER : COLORS.UI_DIM
    const fill = this.primary ? COLORS.UI_PANEL_BORDER : COLORS.UI_PANEL
    const fillAlpha = this.primary ? (hovered ? 0.45 : 0.32) : hovered ? 0.95 : 0.85
    const glowAlpha = hovered ? 0.4 : 0.18
    const borderAlpha = hovered ? 1 : 0.8
    const borderWidth = this.primary ? 3 : 2

    g.fillStyle(border, glowAlpha)
    g.fillRoundedRect(-halfW - 6, -halfH - 6, this.bw + 12, this.bh + 12, radius + 6)
    g.fillStyle(border, glowAlpha * 0.6)
    g.fillRoundedRect(-halfW - 12, -halfH - 12, this.bw + 24, this.bh + 24, radius + 12)

    g.fillStyle(fill, fillAlpha)
    g.fillRoundedRect(-halfW, -halfH, this.bw, this.bh, radius)

    g.lineStyle(borderWidth, border, borderAlpha)
    g.strokeRoundedRect(-halfW, -halfH, this.bw, this.bh, radius)

    g.fillStyle(COLORS.WHITE, hovered ? 0.1 : 0.06)
    g.fillRoundedRect(-halfW + 4, -halfH + 4, this.bw - 8, this.bh * 0.4, radius - 4)
  }
}

/** Convert a numeric 0xRRGGBB colour to the '#rrggbb' string Phaser.Text needs. */
function toHexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`
}
