import Phaser from 'phaser'
import { DEPTHS, TEX } from '@/config/constants'
import type { BurstConfig } from '@/types'

/**
 * Lightweight one-shot particle bursts (eat pops, damage debris, ability FX).
 * Each burst spins up a short-lived additive emitter that self-destroys, which
 * keeps colour/scale fully per-call without juggling a shared emitter's state.
 */
export class ParticleBurst {
  constructor(private readonly scene: Phaser.Scene) {}

  burst(x: number, y: number, config: BurstConfig): void {
    const { count, color, speed, lifespan } = config
    const variance = config.speedVariance ?? speed * 0.5
    const scale = config.scale ?? 0.7

    const emitter = this.scene.add.particles(x, y, TEX.SPARK, {
      speed: { min: Math.max(0, speed - variance), max: speed + variance },
      angle: { min: 0, max: 360 },
      lifespan,
      quantity: count,
      scale: { start: scale, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: color,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    emitter.setDepth(DEPTHS.FX)
    emitter.explode(count, x, y)

    this.scene.time.delayedCall(lifespan + 80, () => emitter.destroy())
  }

  /** Expanding glow ring used for ability pulses / evolve shockwaves. */
  ring(x: number, y: number, color: number, radius: number, durationMs = 360): void {
    const img = this.scene.add.image(x, y, TEX.SOFT_GLOW)
    img.setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTHS.FX)
    img.setScale(0.2)
    this.scene.tweens.add({
      targets: img,
      scale: (radius / 64) * 2,
      alpha: { from: 0.8, to: 0 },
      duration: durationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => img.destroy(),
    })
  }
}
