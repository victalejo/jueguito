/**
 * Toast.ts — transient centered messages for "Soup Genesis: Rise of the Cell".
 *
 * Used to announce wave starts ("WAVE 3"), evolution readiness
 * ("¡EVOLUCIÓN LISTA!"), hazard warnings, etc. Multiple rapid `show()` calls
 * are buffered in an internal queue so they appear one after another, each with
 * a small vertical offset so a burst of toasts reads as a little stack.
 *
 * Visual language: a glowing label with a soft dark backing + stroke for
 * contrast, fading and rising into view, holding, then fading out and being
 * destroyed. Pure Phaser — no external assets.
 */

import Phaser from 'phaser'
import { COLORS } from '@/config/constants'

/** A single queued / active toast request. */
interface ToastRequest {
  readonly text: string
  readonly color: number
  readonly durationMs: number
}

/** Animation / layout tuning for toasts (kept local — purely presentational). */
const TOAST = {
  RISE_IN_MS: 180,
  FADE_OUT_MS: 260,
  DEFAULT_HOLD_MS: 1500,
  RISE_DISTANCE: 26,
  /** Vertical gap between concurrently visible toasts. */
  STACK_OFFSET: 46,
  /** Hard cap so a runaway caller can never spawn unbounded objects. */
  MAX_VISIBLE: 5,
  FONT_SIZE: 30,
  STROKE_THICKNESS: 6,
  PADDING_X: 18,
  PADDING_Y: 8,
} as const

export class Toast extends Phaser.GameObjects.Container {
  /** Pending messages waiting for a free visible slot. */
  private readonly queue: ToastRequest[] = []

  /** Currently animating toast objects (text + its backing), newest last. */
  private readonly activeToasts: Phaser.GameObjects.Container[] = []

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    scene.add.existing(this)
  }

  /**
   * Display a transient message. Safe to call rapidly — overlapping calls are
   * queued and shown in order, never throwing.
   */
  show(text: string, color: number = COLORS.UI_TEXT, durationMs: number = TOAST.DEFAULT_HOLD_MS): void {
    // Guard against destruction races: if the container or scene is gone, drop.
    if (!this.scene || !this.activeToasts) return

    const safeText = (text ?? '').toString().trim() || ' '
    const safeColor = Number.isFinite(color) ? color : COLORS.UI_TEXT
    const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : TOAST.DEFAULT_HOLD_MS

    this.queue.push({ text: safeText, color: safeColor, durationMs: safeDuration })
    this.pump()
  }

  /** Promote queued toasts into visible slots while capacity allows. */
  private pump(): void {
    while (this.queue.length > 0 && this.activeToasts.length < TOAST.MAX_VISIBLE) {
      const request = this.queue.shift()
      if (!request) break
      this.spawn(request)
    }
  }

  /** Build the visual for one toast and run its in/hold/out tween chain. */
  private spawn(request: ToastRequest): void {
    const scene = this.scene
    if (!scene) return

    // Each toast is its own sub-container so backing + text move/fade together.
    const item = scene.add.container(0, 0)
    item.setAlpha(0)

    // Label first, so we can size the dark backing to it.
    const label = scene.add.text(0, 0, request.text, {
      fontFamily: 'Arial, "Segoe UI", sans-serif',
      fontSize: `${TOAST.FONT_SIZE}px`,
      fontStyle: 'bold',
      color: this.toHexString(request.color),
      align: 'center',
      stroke: this.toHexString(COLORS.BACKDROP),
      strokeThickness: TOAST.STROKE_THICKNESS,
    })
    label.setOrigin(0.5, 0.5)
    label.setShadow(0, 2, this.toHexString(COLORS.BACKDROP), 6, false, true)

    // Soft dark backing for legibility over a busy, luminous scene.
    const halfW = label.width / 2 + TOAST.PADDING_X
    const halfH = label.height / 2 + TOAST.PADDING_Y
    const backing = scene.add.graphics()
    backing.fillStyle(COLORS.UI_PANEL, 0.55)
    backing.fillRoundedRect(-halfW, -halfH, halfW * 2, halfH * 2, 10)
    backing.lineStyle(1, request.color, 0.45)
    backing.strokeRoundedRect(-halfW, -halfH, halfW * 2, halfH * 2, 10)

    item.add(backing)
    item.add(label)

    // Stack newcomers below existing toasts so a burst fans out vertically.
    const slot = this.activeToasts.length
    const restY = slot * TOAST.STACK_OFFSET
    item.setY(restY + TOAST.RISE_DISTANCE)

    this.add(item)
    this.activeToasts.push(item)

    // Rise + fade in.
    scene.tweens.add({
      targets: item,
      y: restY,
      alpha: 1,
      duration: TOAST.RISE_IN_MS,
      ease: 'Back.easeOut',
    })

    // Hold, then fade + drift up and self-destruct.
    scene.time.delayedCall(TOAST.RISE_IN_MS + request.durationMs, () => {
      if (!item.scene) {
        this.retire(item)
        return
      }
      scene.tweens.add({
        targets: item,
        y: item.y - TOAST.RISE_DISTANCE,
        alpha: 0,
        duration: TOAST.FADE_OUT_MS,
        ease: 'Sine.easeIn',
        onComplete: () => this.retire(item),
      })
    })
  }

  /** Remove a finished toast, destroy it, then let the queue advance. */
  private retire(item: Phaser.GameObjects.Container): void {
    const index = this.activeToasts.indexOf(item)
    if (index !== -1) this.activeToasts.splice(index, 1)
    if (item.scene) item.destroy()

    // Slide remaining toasts up to close the gap left behind.
    this.activeToasts.forEach((active, slot) => {
      if (!active.scene || !this.scene) return
      this.scene.tweens.add({
        targets: active,
        y: slot * TOAST.STACK_OFFSET,
        duration: 160,
        ease: 'Sine.easeOut',
      })
    })

    this.pump()
  }

  /** Convert a numeric 0xRRGGBB colour into the "#rrggbb" string Phaser text needs. */
  private toHexString(color: number): string {
    const clamped = (color >>> 0) & 0xffffff
    return `#${clamped.toString(16).padStart(6, '0')}`
  }

  /** Clean up queue + active toasts when the container is destroyed. */
  destroy(fromScene?: boolean): void {
    this.queue.length = 0
    this.activeToasts.length = 0
    super.destroy(fromScene)
  }
}
