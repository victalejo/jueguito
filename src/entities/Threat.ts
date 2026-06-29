import Phaser from 'phaser'
import { DEPTHS } from '@/config/constants'
import { THREAT_DEFS } from '@/data/threats'
import { setCircleBody } from '@/utils/bodies'
import type { ThreatDef, ThreatKind } from '@/types'
import { applyBehavior, type BehaviorTarget, type ThreatAgent } from './threatBehaviors'

/**
 * A pooled hazard. Movement is delegated to a behaviour strategy keyed by the
 * threat def; HP lets abilities and barbed contact destroy it for biomass.
 */
export class Threat extends Phaser.Physics.Arcade.Sprite implements ThreatAgent {
  private def: ThreatDef = THREAT_DEFS.free_radical
  kind: ThreatKind = 'free_radical'
  speed = 0
  readonly behaviorState: Record<string, number> = {}

  private hp = 1
  private intensity = 1
  private ageMs = 0

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, THREAT_DEFS.free_radical.textureKey)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setDepth(DEPTHS.THREAT)
    this.disableBody(true, true)
  }

  spawn(x: number, y: number, kind: ThreatKind, intensity = 1): this {
    this.def = THREAT_DEFS[kind]
    this.kind = kind
    this.speed = this.def.speed
    this.intensity = intensity
    this.hp = this.def.radius * 2 + this.def.damage * 1.5 + 8
    this.ageMs = 0
    for (const key of Object.keys(this.behaviorState)) delete this.behaviorState[key]

    this.setTexture(this.def.textureKey)
    this.enableBody(true, x, y, true, true)
    this.setActive(true).setVisible(true)
    this.setAlpha(1).setScale(1).setAngle(0)
    this.clearTint()
    setCircleBody(this, this.def.radius)
    return this
  }

  despawn(): void {
    this.disableBody(true, true)
    this.setActive(false).setVisible(false)
  }

  update(dtMs: number, target: BehaviorTarget): void {
    if (!this.active) return
    this.ageMs += dtMs
    const v = applyBehavior(this.def.behavior, this, target, dtMs)
    this.setVelocity(v.x, v.y)

    const moving = Math.abs(v.x) + Math.abs(v.y) > 5
    const facer =
      this.def.behavior === 'chase' ||
      this.def.behavior === 'smart_hunter' ||
      this.def.behavior === 'ambush_lunge' ||
      this.def.behavior === 'pack_flank'
    if (facer && moving) {
      this.setRotation(Math.atan2(v.y, v.x))
    } else {
      this.rotation += (dtMs / 1000) * 0.6
    }
    this.setScale(1 + Math.sin(this.ageMs * 0.012) * 0.05)
  }

  getKind(): ThreatKind {
    return this.kind
  }

  getDef(): ThreatDef {
    return this.def
  }

  /** Contact damage, scaled by the wave intensity it spawned with. */
  getDamage(): number {
    return this.def.damage * this.intensity
  }

  getRadius(): number {
    return this.def.radius
  }

  isDoT(): boolean {
    return this.def.dot === true
  }

  isAlive(): boolean {
    return this.active && this.hp > 0
  }

  /** Apply damage; returns true if it killed the threat. */
  takeDamage(amount: number): boolean {
    if (!this.active) return false
    this.hp -= amount
    this.setTintFill(0xffffff)
    this.scene.time.delayedCall(70, () => {
      if (this.active) this.clearTint()
    })
    return this.hp <= 0
  }

  getBiomassReward(): number {
    return Math.round(this.def.radius * 0.6 + this.def.damage * 0.5)
  }
}
