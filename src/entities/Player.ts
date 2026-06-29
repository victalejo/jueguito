import Phaser from 'phaser'
import { BALANCE, DEPTHS } from '@/config/constants'
import { getAudio } from '@/core/audio'
import { ABILITY_DEFS } from '@/data/abilities'
import type { EventBus } from '@/core/EventBus'
import type {
  AbilityId,
  EvolutionStage,
  Mutation,
  MutationId,
  OrganismStats,
  PlayerModifiers,
  ThreatKind,
} from '@/types'
import { clamp, fromAngle, normalize, rotateToward, TAU } from '@/utils/mathUtils'
import { setCircleBody } from '@/utils/bodies'

/** Kinds whose damage is mitigated by Toxin Resistance. */
const TOXIN_KINDS = new Set<ThreatKind>([
  'free_radical',
  'toxin_blob',
  'toxin_jelly',
  'acid_current',
  'uv_burst',
])

function createDefaultModifiers(): PlayerModifiers {
  return {
    energyDrainMult: 1,
    energyGainMult: 1,
    biomassGainMult: 1,
    speedMult: 1,
    damageReduction: 0,
    pickupRadiusMult: 1,
    healthRegen: 0,
    toxinDamageMult: 1,
    contactDamage: 0,
    dashPowerMult: 1,
    maxHealthMult: 1,
    maxEnergyMult: 1,
    reflectMult: 0,
    passiveEnergyRegen: 0,
    comboBiomassMult: 0,
    engulfPowerMult: 1,
    nutrientRadar: 0,
    threatRadar: 0,
  }
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  private stage: EvolutionStage
  private readonly modifiers: PlayerModifiers = createDefaultModifiers()
  private readonly owned = new Set<MutationId>()

  private energy = 0
  private maxEnergy = 100
  private health = 0
  private maxHealth = 100
  private biomass = 0
  private totalBiomass = 0

  private stats!: OrganismStats
  private secondaryAbility: AbilityId | null = null
  private readonly cooldowns: Partial<Record<AbilityId, number>> = {}

  private alive = true
  private deathCause: 'threat' | 'starvation' = 'threat'
  private iframeMs = 0
  private speedBoostMs = 0
  private dashMs = 0
  private dashDir = { x: 1, y: 0 }
  private dashSpeed = 0
  private facing = 0
  private combo = 0
  private comboMs = 0
  private ageMs = 0
  private starveTickMs = 0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bus: EventBus,
    stage: EvolutionStage,
  ) {
    super(scene, x, y, stage.textureKey)
    this.stage = stage
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setDepth(DEPTHS.PLAYER)

    const body = this.getBody()
    body.setCollideWorldBounds(true)
    body.setDrag(0, 0)

    this.applyStage(stage, true)
    this.energy = this.maxEnergy * BALANCE.START_ENERGY_FRACTION
    this.health = this.maxHealth
    this.emitVitals()
  }

  // ---------------------------------------------------------------- stats

  private resolveStats(): void {
    const m = this.modifiers
    const s = this.stage
    this.maxEnergy = s.maxEnergy * m.maxEnergyMult
    this.maxHealth = s.baseMaxHealth * m.maxHealthMult
    const speed = Math.min(s.baseSpeed * m.speedMult, BALANCE.PLAYER_MAX_SPEED_CAP)
    this.stats = {
      stageId: s.id,
      radius: s.baseRadius,
      speed,
      maxSpeed: speed,
      maxHealth: this.maxHealth,
      maxEnergy: this.maxEnergy,
      energyDrainPerSecond: s.energyDrainPerSecond * m.energyDrainMult,
      membraneDamageReduction: Math.min(
        BALANCE.MAX_DAMAGE_REDUCTION,
        s.membraneDamageReduction + m.damageReduction,
      ),
      pickupRadius: (s.baseRadius + BALANCE.PICKUP_RADIUS_BASE) * m.pickupRadiusMult,
    }
    setCircleBody(this, s.baseRadius)
  }

  private applyStage(stage: EvolutionStage, initial = false): void {
    this.stage = stage
    this.setTexture(stage.textureKey)
    this.resolveStats()
    this.secondaryAbility =
      stage.id >= 1 && stage.primaryAbility !== 'dash' ? 'dash' : null
    if (!initial) {
      // Evolution is a power spike: top up vitals.
      this.health = this.maxHealth
      this.energy = this.maxEnergy
      this.scene.tweens.add({
        targets: this,
        scale: { from: 1.35, to: 1 },
        duration: 420,
        ease: 'Back.easeOut',
      })
    }
  }

  setStage(stage: EvolutionStage): void {
    this.applyStage(stage)
    this.emitVitals()
  }

  /** Subtract spent biomass after an evolution (carry the overflow forward). */
  consumeBiomass(amount: number): void {
    this.biomass = Math.max(0, this.biomass - amount)
    this.emitBiomass()
  }

  addMutation(m: Mutation): void {
    if (this.owned.has(m.id)) return
    this.owned.add(m.id)
    const prevMaxHealth = this.maxHealth
    const prevMaxEnergy = this.maxEnergy
    this.modifiers[m.stat] += m.magnitude
    this.resolveStats()
    // Preserve vital fractions when capacity grows.
    if (prevMaxHealth > 0) this.health = (this.health / prevMaxHealth) * this.maxHealth
    if (prevMaxEnergy > 0) this.energy = (this.energy / prevMaxEnergy) * this.maxEnergy
    this.emitVitals()
  }

  // ---------------------------------------------------------------- loop

  update(dtMs: number, input: PlayerInput): void {
    if (!this.alive) {
      this.getBody().setVelocity(0, 0)
      return
    }
    const dt = dtMs / 1000
    this.ageMs += dtMs

    this.tickTimers(dtMs)
    this.applyMovement(input, dt)
    this.handleAbilityInput(input)
    this.metabolism(dt)
    this.updateVisual()
    this.emitEnergy()
  }

  private tickTimers(dtMs: number): void {
    if (this.iframeMs > 0) this.iframeMs -= dtMs
    if (this.speedBoostMs > 0) this.speedBoostMs -= dtMs
    if (this.dashMs > 0) this.dashMs -= dtMs
    for (const id of Object.keys(this.cooldowns) as AbilityId[]) {
      const cd = this.cooldowns[id] ?? 0
      if (cd > 0) {
        const next = cd - dtMs
        this.cooldowns[id] = next
        if (next <= 0) this.bus.emit('ABILITY_READY', { ability: id })
      }
    }
    if (this.comboMs > 0) {
      this.comboMs -= dtMs
      if (this.comboMs <= 0 && this.combo > 0) {
        this.combo = 0
        this.bus.emit('COMBO_CHANGED', { combo: 0 })
      }
    }
  }

  private applyMovement(input: PlayerInput, dt: number): void {
    const body = this.getBody()

    if (this.dashMs > 0) {
      body.setVelocity(this.dashDir.x * this.dashSpeed, this.dashDir.y * this.dashSpeed)
      return
    }

    const accel = BALANCE.PLAYER_ACCELERATION
    let vx = body.velocity.x + input.dir.x * accel * dt
    let vy = body.velocity.y + input.dir.y * accel * dt

    const dragFactor = Math.pow(BALANCE.PLAYER_DRAG, dt * 60)
    vx *= dragFactor
    vy *= dragFactor

    const sprinting = input.sprinting && this.energy > 0
    let max = this.stats.maxSpeed
    if (sprinting) max *= BALANCE.SPRINT_SPEED_MULTIPLIER
    if (this.speedBoostMs > 0) max *= 1 + BALANCE.SPEED_BOOST_FROM_MINERAL_MULT

    const sp = Math.hypot(vx, vy)
    if (sp > max && sp > 0) {
      vx = (vx / sp) * max
      vy = (vy / sp) * max
    }
    body.setVelocity(vx, vy)

    if (sp > 8) this.facing = rotateToward(this.facing, Math.atan2(vy, vx), dt * 9)
    else if (input.aim) this.facing = Math.atan2(input.aim.y - this.y, input.aim.x - this.x)
    this.setRotation(this.facing)
  }

  private handleAbilityInput(input: PlayerInput): void {
    if (input.primaryPressed && this.stage.primaryAbility) {
      this.useAbility(this.stage.primaryAbility)
    }
    if (input.secondaryPressed && this.secondaryAbility) {
      this.useAbility(this.secondaryAbility)
    }
  }

  private metabolism(dt: number): void {
    const before = this.energy
    this.energy -= this.stats.energyDrainPerSecond * dt
    this.energy += this.modifiers.passiveEnergyRegen * dt
    if (this.stage.id >= 3) this.energy += 1.0 * dt // mitochondrial regen
    this.energy = clamp(this.energy, 0, this.maxEnergy)

    // Health regen mutation while well-fed.
    if (this.modifiers.healthRegen > 0 && this.energy > this.maxEnergy * 0.5) {
      this.health = Math.min(this.maxHealth, this.health + this.modifiers.healthRegen * dt)
    }

    // Starvation.
    if (this.energy <= 0) {
      this.starveTickMs += dt * 1000
      this.health -= BALANCE.STARVATION_DAMAGE_PER_SECOND * dt
      if (this.starveTickMs >= 500) {
        this.starveTickMs = 0
        this.bus.emit('PLAYER_DAMAGED', {
          amount: BALANCE.STARVATION_DAMAGE_PER_SECOND * 0.5,
          threatKind: 'starvation',
          x: this.x,
          y: this.y,
          energyRemaining: 0,
          healthRemaining: Math.max(0, this.health),
        })
      }
      this.emitHealth()
      if (this.health <= 0) this.die('starvation')
    }
    if (this.energy !== before && this.energy > 0) {
      /* energy changes are emitted by emitEnergy() each frame */
    }
  }

  private updateVisual(): void {
    if (this.dashMs > 0) return // dash tween owns scale briefly
    const energyFrac = this.maxEnergy > 0 ? this.energy / this.maxEnergy : 0
    const amp = 0.03 + 0.03 * energyFrac
    this.setScale(1 + Math.sin(this.ageMs * 0.005) * amp)
  }

  // ---------------------------------------------------------------- abilities

  useAbility(id: AbilityId): boolean {
    if (!this.alive) return false
    const def = ABILITY_DEFS[id]
    if ((this.cooldowns[id] ?? 0) > 0) return false

    const isMovement = id === 'dash' || id === 'lunge'
    const costScale = isMovement ? 1 / Math.max(1, this.modifiers.dashPowerMult) : 1
    const cost = def.energyCost * costScale
    if (this.energy < cost) return false

    this.energy -= cost
    this.cooldowns[id] = def.cooldownMs

    if (isMovement) this.startDash(id)
    else this.bumpScale(1.12)

    this.bus.emit('ABILITY_USED', { ability: id, cooldownMs: def.cooldownMs })
    getAudio(this.scene.game)?.play(isMovement ? 'dash' : 'ability')
    return true
  }

  private startDash(id: AbilityId): void {
    const power = this.modifiers.dashPowerMult
    const isLunge = id === 'lunge'
    this.dashMs = (isLunge ? BALANCE.LUNGE_DURATION_MS : BALANCE.DASH_DURATION_MS) * power
    this.dashSpeed =
      this.stats.maxSpeed *
      (isLunge ? BALANCE.LUNGE_SPEED_MULTIPLIER : BALANCE.DASH_SPEED_MULTIPLIER)
    const body = this.getBody()
    const moving = Math.hypot(body.velocity.x, body.velocity.y) > 8
    this.dashDir = moving
      ? normalize(body.velocity.x, body.velocity.y)
      : fromAngle(this.facing, 1)
    // Squash & stretch.
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.3,
      scaleY: 0.78,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
  }

  private bumpScale(to: number): void {
    this.scene.tweens.add({
      targets: this,
      scale: { from: to, to: 1 },
      duration: 180,
      ease: 'Back.easeOut',
    })
  }

  // ---------------------------------------------------------------- feeding & damage

  feed(energy: number, biomass: number): void {
    if (!this.alive) return
    this.combo = Math.min(BALANCE.COMBO_MAX_STACKS, this.combo + 1)
    this.comboMs = BALANCE.COMBO_WINDOW_MS
    this.bus.emit('COMBO_CHANGED', { combo: this.combo })

    const comboBonus =
      this.modifiers.comboBiomassMult * (this.combo / BALANCE.COMBO_MAX_STACKS)
    const gainedEnergy = energy * this.modifiers.energyGainMult
    const gainedBiomass = biomass * this.modifiers.biomassGainMult * (1 + comboBonus)

    this.energy = Math.min(this.maxEnergy, this.energy + gainedEnergy)
    this.biomass += gainedBiomass
    this.totalBiomass += gainedBiomass

    this.bumpScale(1.1)
    this.emitEnergy()
    this.emitBiomass()
  }

  /** Bonus biomass from a phagocytosed / swept threat kill. */
  addKillBiomass(amount: number): void {
    if (!this.alive) return
    this.biomass += amount
    this.totalBiomass += amount
    this.emitBiomass()
  }

  grantSpeedBoost(): void {
    this.speedBoostMs = BALANCE.SPEED_BOOST_FROM_MINERAL_MS
  }

  /** Returns the actual damage dealt (post-mitigation), for reflect math. */
  takeDamage(
    amount: number,
    kind: ThreatKind | 'starvation',
    x: number,
    y: number,
    ignoreIFrames = false,
  ): number {
    if (!this.alive) return 0
    if (!ignoreIFrames && this.iframeMs > 0) return 0

    const isToxin = kind !== 'starvation' && TOXIN_KINDS.has(kind)
    let dmg = amount * (1 - this.stats.membraneDamageReduction)
    if (isToxin) dmg *= this.modifiers.toxinDamageMult
    dmg = Math.max(0, dmg)

    if (!ignoreIFrames) {
      this.iframeMs = BALANCE.CONTACT_INVULNERABILITY_MS
      // Knockback away from the source.
      const away = normalize(this.x - x, this.y - y)
      const body = this.getBody()
      body.setVelocity(body.velocity.x + away.x * 200, body.velocity.y + away.y * 200)
      this.flashDamage()
    }

    this.health = Math.max(0, this.health - dmg)
    this.bus.emit('PLAYER_DAMAGED', {
      amount: dmg,
      threatKind: kind,
      x,
      y,
      energyRemaining: this.energy,
      healthRemaining: this.health,
    })
    this.emitHealth()
    if (this.health <= 0) this.die(kind === 'starvation' ? 'starvation' : 'threat')
    return dmg
  }

  private flashDamage(): void {
    this.setTintFill(0xffffff)
    this.scene.time.delayedCall(60, () => {
      if (!this.active) return
      this.setTint(0xff6b6b)
      this.scene.time.delayedCall(120, () => this.active && this.clearTint())
    })
  }

  private die(cause: 'threat' | 'starvation'): void {
    if (!this.alive) return
    this.alive = false
    this.deathCause = cause
    this.getBody().setVelocity(0, 0)
  }

  // ---------------------------------------------------------------- events

  private emitEnergy(): void {
    this.bus.emit('PLAYER_ENERGY_CHANGED', { energy: this.energy, maxEnergy: this.maxEnergy })
  }
  private emitHealth(): void {
    this.bus.emit('PLAYER_HEALTH_CHANGED', { health: this.health, maxHealth: this.maxHealth })
  }
  private emitBiomass(): void {
    this.bus.emit('PLAYER_BIOMASS_CHANGED', {
      biomass: this.biomass,
      biomassToNext: this.stage.biomassToEvolve,
      stageId: this.stage.id,
    })
  }
  private emitVitals(): void {
    this.emitEnergy()
    this.emitHealth()
    this.emitBiomass()
  }

  // ---------------------------------------------------------------- getters

  getBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body
  }
  getStats(): Readonly<OrganismStats> {
    return this.stats
  }
  getModifiers(): Readonly<PlayerModifiers> {
    return this.modifiers
  }
  getOwnedMutations(): ReadonlySet<MutationId> {
    return this.owned
  }
  getStage(): EvolutionStage {
    return this.stage
  }
  getStageId(): number {
    return this.stage.id
  }
  getRadius(): number {
    return this.stats.radius
  }
  getPickupRadius(): number {
    return this.stats.pickupRadius
  }
  getEnergy(): number {
    return this.energy
  }
  getMaxEnergy(): number {
    return this.maxEnergy
  }
  getHealth(): number {
    return this.health
  }
  getMaxHealth(): number {
    return this.maxHealth
  }
  getBiomass(): number {
    return this.biomass
  }
  getBiomassToNext(): number {
    return this.stage.biomassToEvolve
  }
  getTotalBiomass(): number {
    return this.totalBiomass
  }
  getCombo(): number {
    return this.combo
  }
  isAlive(): boolean {
    return this.alive
  }
  isInvulnerable(): boolean {
    return this.iframeMs > 0
  }
  getDeathCause(): 'threat' | 'starvation' {
    return this.deathCause
  }
}

/** The slice of InputState the Player consumes (kept structurally compatible). */
export interface PlayerInput {
  dir: { x: number; y: number }
  sprinting: boolean
  primaryPressed: boolean
  secondaryPressed: boolean
  aim: { x: number; y: number } | null
}

void TAU
