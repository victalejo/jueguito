/**
 * MutationCard — a single selectable evolution-mutation card.
 *
 * Rendered on the evolution screen as a glowing, luminous-microscopy panel:
 * a soft card background (TEX.CARD), an enlarged mutation icon, the mutation's
 * name + description (word-wrapped), a tier-coloured rim, and a hotkey badge.
 *
 * The card is fully self-contained: it builds its own children, wires its own
 * pointer interactivity (hover lift + glow, click → select), and exposes a
 * small imperative API (playIntro / setHighlighted / select) so the parent
 * scene can orchestrate staggered reveals and keyboard selection.
 */

import Phaser from 'phaser'
import { TEX, COLORS } from '@/config/constants'
import { getAudio } from '@/core/audio'
import type { Mutation } from '@/types'

/** Card geometry (the world has no hard rects, but the UI layer may). */
const CARD_W = 220
const CARD_H = 300

/** Tier → rim accent colour (teal / amber / violet). */
const TIER_COLORS: Record<number, number> = {
  1: 0x2bd6a6, // teal
  2: 0xffb454, // amber
  3: 0xb98bff, // violet
}

const DEFAULT_TIER_COLOR = 0x2bd6a6

export class MutationCard extends Phaser.GameObjects.Container {
  private readonly mutation: Mutation
  private readonly cardIndex: number
  private readonly onSelect: (mutation: Mutation, index: number) => void

  private readonly tierColor: number

  /** Children we animate/restyle imperatively. */
  private readonly bg: Phaser.GameObjects.Image
  private readonly glow: Phaser.GameObjects.Image
  private readonly rim: Phaser.GameObjects.Graphics
  private readonly icon: Phaser.GameObjects.Image
  private readonly nameText: Phaser.GameObjects.Text
  private readonly descText: Phaser.GameObjects.Text
  private readonly badge: Phaser.GameObjects.Container

  private highlighted = false
  private selected = false
  private hovered = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    mutation: Mutation,
    index: number,
    onSelect: (mutation: Mutation, index: number) => void,
  ) {
    super(scene, x, y)

    this.mutation = mutation
    this.cardIndex = index
    this.onSelect = onSelect
    this.tierColor = TIER_COLORS[mutation.tier] ?? DEFAULT_TIER_COLOR

    // --- Outer additive glow halo (sits behind the card) ------------------
    this.glow = scene.add
      .image(0, 6, TEX.SOFT_GLOW)
      .setDisplaySize(CARD_W * 1.5, CARD_H * 1.45)
      .setTint(this.tierColor)
      .setAlpha(0.22)
      .setBlendMode(Phaser.BlendModes.ADD)

    // --- Card background panel --------------------------------------------
    this.bg = scene.add
      .image(0, 0, TEX.CARD)
      .setDisplaySize(CARD_W, CARD_H)
      .setTint(0xffffff)

    // --- Tier rim (drawn rounded rect outline in the tier colour) ---------
    this.rim = scene.add.graphics()
    this.drawRim(0.85)

    // --- Mutation icon (enlarged, near the top) ---------------------------
    const iconY = -CARD_H / 2 + 78
    this.icon = scene.add
      .image(0, iconY, mutation.iconKey)
      .setDisplaySize(96, 96)
    // Soft inner glow behind the icon for a luminous core.
    const iconGlow = scene.add
      .image(0, iconY, TEX.SOFT_GLOW)
      .setDisplaySize(132, 132)
      .setTint(this.tierColor)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)

    // --- Name (bold, wrapped) ---------------------------------------------
    this.nameText = scene.add
      .text(0, -CARD_H / 2 + 150, mutation.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '19px',
        fontStyle: 'bold',
        color: this.toCss(COLORS.UI_TEXT),
        align: 'center',
        wordWrap: { width: CARD_W - 36 },
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 1, '#001016', 4, false, true)

    // --- Description (smaller, wrapped) -----------------------------------
    this.descText = scene.add
      .text(0, -CARD_H / 2 + 196, mutation.description, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: this.toCss(COLORS.UI_DIM),
        align: 'center',
        lineSpacing: 3,
        wordWrap: { width: CARD_W - 40 },
      })
      .setOrigin(0.5, 0)

    // --- Hotkey badge (corner) --------------------------------------------
    this.badge = this.buildBadge(scene, index + 1)

    this.add([
      this.glow,
      this.bg,
      this.rim,
      iconGlow,
      this.icon,
      this.nameText,
      this.descText,
      this.badge,
    ])

    // --- Interactivity over the card rectangle ----------------------------
    this.setSize(CARD_W, CARD_H)
    this.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains,
    )

    // Remember the resting Y so hover lifts are relative, not cumulative.
    this._baseY = y

    this.on(Phaser.Input.Events.POINTER_OVER, this.handlePointerOver, this)
    this.on(Phaser.Input.Events.POINTER_OUT, this.handlePointerOut, this)
    this.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    // Clean listener teardown when destroyed.
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.removeAllListeners()
    })

    scene.add.existing(this)
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Staggered drift-and-fade reveal. Returns `this` for chaining. */
  playIntro(delayMs = 0): this {
    const restY = this._baseY
    this.setAlpha(0)
    this.setScale(0.9)
    this.y = restY + 26

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: 1,
      y: restY,
      ease: 'Back.easeOut',
      duration: 460,
      delay: delayMs,
    })
    return this
  }

  /**
   * Toggle the "keyboard-focused" highlight state. Independent from hover so
   * either input modality can light the card up.
   */
  setHighlighted(highlighted: boolean): this {
    if (this.highlighted === highlighted) return this
    this.highlighted = highlighted
    this.refreshVisualState()
    return this
  }

  /** Confirm this card: play the select cue, animate, and fire the callback. */
  select(): void {
    if (this.selected) return
    this.selected = true

    getAudio(this.scene.game)?.play('uiSelect')

    // A satisfying punch-out: pop, flash the glow, then settle.
    this.scene.tweens.add({
      targets: this,
      scale: 1.12,
      duration: 110,
      ease: 'Quad.easeOut',
      yoyo: true,
    })
    this.scene.tweens.add({
      targets: this.glow,
      alpha: 0.6,
      duration: 130,
      ease: 'Quad.easeOut',
      yoyo: true,
    })

    this.onSelect(this.mutation, this.cardIndex)
  }

  // -----------------------------------------------------------------------
  // Pointer handlers
  // -----------------------------------------------------------------------

  private handlePointerOver(): void {
    if (this.hovered || this.selected) return
    this.hovered = true
    getAudio(this.scene.game)?.play('uiHover')
    this.refreshVisualState()
  }

  private handlePointerOut(): void {
    if (!this.hovered) return
    this.hovered = false
    this.refreshVisualState()
  }

  private handlePointerUp(): void {
    this.select()
  }

  // -----------------------------------------------------------------------
  // Visual state
  // -----------------------------------------------------------------------

  /**
   * Recompute the card's resting visuals from hover + highlight flags and
   * tween towards them. A lifted/scaled/brighter card reads as "active".
   */
  private refreshVisualState(): void {
    if (this.selected) return
    const active = this.hovered || this.highlighted

    this.scene.tweens.add({
      targets: this,
      y: this.baseY + (active ? -8 : 0),
      scale: active ? 1.04 : 1,
      duration: 160,
      ease: 'Quad.easeOut',
    })
    this.scene.tweens.add({
      targets: this.glow,
      alpha: active ? 0.42 : 0.22,
      duration: 160,
      ease: 'Quad.easeOut',
    })
    this.drawRim(active ? 1 : 0.85)
  }

  /** The card's baseline Y, set once at construction (hover lifts are relative). */
  private get baseY(): number {
    return this._baseY
  }
  private _baseY = 0

  /** Draw the tier-coloured rounded-rect rim at a given line alpha. */
  private drawRim(lineAlpha: number): void {
    const g = this.rim
    g.clear()
    g.lineStyle(2.5, this.tierColor, lineAlpha)
    g.strokeRoundedRect(
      -CARD_W / 2 + 4,
      -CARD_H / 2 + 4,
      CARD_W - 8,
      CARD_H - 8,
      18,
    )
  }

  // -----------------------------------------------------------------------
  // Builders / helpers
  // -----------------------------------------------------------------------

  /** Small circular hotkey badge in the top-left corner. */
  private buildBadge(scene: Phaser.Scene, num: number): Phaser.GameObjects.Container {
    const bx = -CARD_W / 2 + 24
    const by = -CARD_H / 2 + 24
    const r = 15

    const disc = scene.add.graphics()
    disc.fillStyle(this.tierColor, 0.92)
    disc.fillCircle(0, 0, r)
    disc.lineStyle(2, COLORS.UI_PANEL, 0.9)
    disc.strokeCircle(0, 0, r)

    const label = scene.add
      .text(0, 0, String(num), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: this.toCss(COLORS.UI_PANEL),
      })
      .setOrigin(0.5)

    return scene.add.container(bx, by, [disc, label])
  }

  /** Numeric 0xRRGGBB → '#rrggbb' CSS string (Text styles need strings). */
  private toCss(color: number): string {
    return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`
  }
}
