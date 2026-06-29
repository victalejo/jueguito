import Phaser from 'phaser'
import { BALANCE, DEPTHS } from '@/config/constants'
import { NUTRIENT_DEFS } from '@/data/nutrients'
import { rng } from '@/utils/random'
import { setCircleBody } from '@/utils/bodies'
import { fromAngle } from '@/utils/mathUtils'
import type { NutrientDef, NutrientKind } from '@/types'

const FADE_MS = 1200

/**
 * A pooled collectible molecule. Brownian drift + gentle bob, despawns after
 * NUTRIENT_DESPAWN_MS (with a fade-out tail). Reused via spawn()/despawn().
 */
export class Nutrient extends Phaser.Physics.Arcade.Image {
  private def: NutrientDef = NUTRIENT_DEFS.sugar
  private kind: NutrientKind = 'sugar'
  private lifeMs = 0
  private driftAngle = 0
  private nextDriftChange = 0

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, NUTRIENT_DEFS.sugar.textureKey)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setDepth(DEPTHS.NUTRIENT)
    this.disableBody(true, true)
  }

  spawn(x: number, y: number, kind: NutrientKind): this {
    this.kind = kind
    this.def = NUTRIENT_DEFS[kind]
    this.lifeMs = 0
    this.driftAngle = rng.angle()
    this.nextDriftChange = 0

    this.setTexture(this.def.textureKey)
    this.enableBody(true, x, y, true, true)
    this.setActive(true).setVisible(true)
    this.setAlpha(1)
    this.setScale(1)
    this.setAngle(0)
    setCircleBody(this, this.def.radius)

    const v = fromAngle(this.driftAngle, this.def.driftSpeed)
    this.setVelocity(v.x, v.y)
    return this
  }

  despawn(): void {
    this.disableBody(true, true)
    this.setActive(false).setVisible(false)
  }

  update(dtMs: number): void {
    if (!this.active) return
    this.lifeMs += dtMs

    // Brownian wandering: occasionally nudge the drift heading.
    this.nextDriftChange -= dtMs
    if (this.nextDriftChange <= 0) {
      this.nextDriftChange = rng.range(700, 1400)
      this.driftAngle += rng.range(-0.7, 0.7)
      const v = fromAngle(this.driftAngle, this.def.driftSpeed)
      this.setVelocity(v.x, v.y)
    }

    // Subtle shimmer.
    this.setScale(1 + Math.sin(this.lifeMs * 0.005) * 0.06)

    const despawnAt = BALANCE.NUTRIENT_DESPAWN_MS
    if (this.lifeMs >= despawnAt) {
      this.despawn()
      return
    }
    const remaining = despawnAt - this.lifeMs
    if (remaining < FADE_MS) this.setAlpha(remaining / FADE_MS)
  }

  getKind(): NutrientKind {
    return this.kind
  }

  getEnergyValue(): number {
    return this.def.energy
  }

  getBiomassValue(): number {
    return this.def.biomass
  }

  getRadius(): number {
    return this.def.radius
  }

  getDef(): NutrientDef {
    return this.def
  }
}
