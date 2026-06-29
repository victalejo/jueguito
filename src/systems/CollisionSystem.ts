import type { EventBus } from '@/core/EventBus'
import type { Nutrient } from '@/entities/Nutrient'
import type { Player } from '@/entities/Player'
import type { Threat } from '@/entities/Threat'
import { distSq } from '@/utils/mathUtils'

/**
 * Manual circle-vs-circle collision. Doing it by hand (rather than Arcade
 * overlaps over pooled arrays) keeps a forgiving pickup reach separate from the
 * tighter damage hitbox, and gives precise control over DoT vs contact damage.
 */
export class CollisionSystem {
  constructor(
    private readonly bus: EventBus,
    private readonly player: Player,
    private readonly nutrients: readonly Nutrient[],
    private readonly threats: readonly Threat[],
  ) {}

  update(dtMs: number): void {
    if (!this.player.isAlive()) return
    this.checkNutrients()
    this.checkThreats(dtMs)
  }

  private checkNutrients(): void {
    const px = this.player.x
    const py = this.player.y
    const pickup = this.player.getPickupRadius()

    for (const n of this.nutrients) {
      if (!n.active) continue
      const r = pickup + n.getRadius()
      if (distSq(px, py, n.x, n.y) > r * r) continue

      const energy = n.getEnergyValue()
      const biomass = n.getBiomassValue()
      this.player.feed(energy, biomass)
      if (n.getDef().special === 'speedBoost') this.player.grantSpeedBoost()
      this.bus.emit('NUTRIENT_COLLECTED', { kind: n.getKind(), x: n.x, y: n.y, energy, biomass })
      n.despawn()
    }
  }

  private checkThreats(dtMs: number): void {
    const px = this.player.x
    const py = this.player.y
    const hr = this.player.getRadius()
    const dt = dtMs / 1000
    const mods = this.player.getModifiers()

    for (const t of this.threats) {
      if (!t.active) continue
      const r = hr + t.getRadius()
      if (distSq(px, py, t.x, t.y) > r * r) continue

      if (t.isDoT()) {
        // Continuous damage, bypasses i-frames; scaled per second.
        this.player.takeDamage(t.getDamage() * dt, t.getKind(), t.x, t.y, true)
        if (mods.contactDamage > 0 && t.takeDamage(mods.contactDamage * dt)) {
          this.killThreat(t)
        }
      } else if (!this.player.isInvulnerable()) {
        const dealt = this.player.takeDamage(t.getDamage(), t.getKind(), t.x, t.y)
        const toThreat = mods.contactDamage + dealt * mods.reflectMult
        if (toThreat > 0 && t.takeDamage(toThreat)) this.killThreat(t)
      }
    }
  }

  private killThreat(t: Threat): void {
    this.bus.emit('THREAT_KILLED', {
      kind: t.getKind(),
      x: t.x,
      y: t.y,
      biomass: t.getBiomassReward(),
    })
    t.despawn()
  }
}
