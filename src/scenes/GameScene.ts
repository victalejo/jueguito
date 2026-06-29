import Phaser from 'phaser'
import { BALANCE, COLORS, DEPTHS, FINAL_STAGE_ID, TEX, VIEW, WORLD } from '@/config/constants'
import { getAudio } from '@/core/audio'
import type { EventBus } from '@/core/EventBus'
import { REGISTRY } from '@/core/registryKeys'
import { getStage } from '@/data/stages'
import { Player } from '@/entities/Player'
import { ParticleBurst } from '@/entities/ParticleBurst'
import type { Threat } from '@/entities/Threat'
import { CollisionSystem } from '@/systems/CollisionSystem'
import { EvolutionSystem } from '@/systems/EvolutionSystem'
import { InputController } from '@/systems/InputController'
import { SaveSystem } from '@/systems/SaveSystem'
import { ScoreSystem } from '@/systems/ScoreSystem'
import { SpawnSystem } from '@/systems/SpawnSystem'
import { WaveManager } from '@/systems/WaveManager'
import { SoupBackdrop } from '@/ui/SoupBackdrop'
import { dist } from '@/utils/mathUtils'
import type {
  AbilityId,
  DeathCause,
  GameEventPayloads,
  HazardKind,
  RunEndCause,
  RunResult,
  ThreatKind,
} from '@/types'

interface HazardInstance {
  x: number
  y: number
  r: number
  kind: HazardKind
  graphics: Phaser.GameObjects.Graphics
  phase: 'warn' | 'active'
  timer: number
  /** Whether this hazard has already landed its one-shot hit (non-acid). */
  hit: boolean
}

const HAZARD_COLOR: Record<HazardKind, number> = {
  uv: 0xfff59d,
  radical: 0xff5252,
  acid: 0x80deea,
}
const HAZARD_THREAT: Record<HazardKind, ThreatKind> = {
  uv: 'uv_burst',
  radical: 'free_radical',
  acid: 'acid_current',
}
const HAZARD_DAMAGE: Record<HazardKind, number> = { uv: 18, radical: 12, acid: 4 }

/** The only world-simulating scene: owns the player, pools, systems and FX. */
export class GameScene extends Phaser.Scene {
  private bus!: EventBus
  private save!: SaveSystem
  private player!: Player
  private controls!: InputController
  private spawn!: SpawnSystem
  private collision!: CollisionSystem
  private wave!: WaveManager
  private evolution!: EvolutionSystem
  private score!: ScoreSystem
  private particles!: ParticleBurst
  private backdrop!: SoupBackdrop

  private readonly hazards: HazardInstance[] = []
  private unsubscribe: (() => void)[] = []

  private elapsedMs = 0
  private victoryHoldMs = 0
  private nutrientsEaten = 0
  private threatsKilled = 0
  private ended = false
  private isPausedOverlay = false
  private reduceMotion = false

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.resetState()
    this.bus = this.registry.get(REGISTRY.BUS) as EventBus
    this.save = this.registry.get(REGISTRY.SAVE) as SaveSystem
    this.reduceMotion = this.save.get().settings.reduceMotion

    this.physics.world.setBounds(0, 0, WORLD.WIDTH, WORLD.HEIGHT)
    this.cameras.main.setBounds(0, 0, WORLD.WIDTH, WORLD.HEIGHT)
    this.cameras.main.setBackgroundColor(COLORS.BACKDROP)

    this.backdrop = new SoupBackdrop(this, { world: true, parallax: true })
    this.backdrop.setStage(0, false)
    this.addDishFraming()

    this.player = new Player(this, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, this.bus, getStage(0))
    this.cameras.main.startFollow(this.player, false, BALANCE.CAMERA_LERP, BALANCE.CAMERA_LERP)

    this.controls = new InputController(this)
    this.particles = new ParticleBurst(this)
    this.spawn = new SpawnSystem(this, this.bus, this.player)
    this.collision = new CollisionSystem(
      this.bus,
      this.player,
      this.spawn.getNutrientPool(),
      this.spawn.getThreatPool(),
    )
    this.wave = new WaveManager(this.bus, () => ({ x: this.player.x, y: this.player.y }))
    this.evolution = new EvolutionSystem(this.bus, this.player, this.save)
    this.score = new ScoreSystem(this.bus)

    this.wireEvents()
    this.scene.launch('HUDScene')
    this.wave.start()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this)
  }

  private resetState(): void {
    this.hazards.length = 0
    this.unsubscribe = []
    this.elapsedMs = 0
    this.victoryHoldMs = 0
    this.nutrientsEaten = 0
    this.threatsKilled = 0
    this.ended = false
    this.isPausedOverlay = false
  }

  private addDishFraming(): void {
    this.add
      .image(VIEW.WIDTH / 2, VIEW.HEIGHT / 2, TEX.DISH)
      .setScrollFactor(0)
      .setDisplaySize(VIEW.WIDTH * 1.02, VIEW.HEIGHT * 1.02)
      .setDepth(DEPTHS.DISH)
      .setAlpha(0.5)
  }

  // ----------------------------------------------------------------- events

  private wireEvents(): void {
    const onEvolutionReady = (p: GameEventPayloads['EVOLUTION_READY']): void => {
      this.scene.launch('EvolutionScene', p)
      this.scene.pause()
    }
    const onMutationChosen = (): void => {
      this.scene.resume()
      this.controls.getState() // flush queued edges so we don't dash on resume
    }
    const onResumed = (): void => {
      this.isPausedOverlay = false
      this.scene.resume()
      this.controls.getState()
    }
    const onStageEvolved = (p: GameEventPayloads['STAGE_EVOLVED']): void => {
      this.backdrop.setStage(p.stageId, true)
      this.playEvolveFx()
      getAudio(this.game)?.play('evolve')
    }
    const onNutrient = (p: GameEventPayloads['NUTRIENT_COLLECTED']): void => {
      this.nutrientsEaten++
      this.particles.burst(p.x, p.y, { count: 10, color: COLORS.WHITE, speed: 130, lifespan: 360, scale: 0.6 })
      const rare = p.kind === 'atp_globule' || p.kind === 'prebiotic_gem' || p.kind === 'protein_cluster'
      getAudio(this.game)?.play(rare ? 'rare' : 'eat', { combo: this.player.getCombo() })
    }
    const onDamaged = (p: GameEventPayloads['PLAYER_DAMAGED']): void => {
      if (p.amount < 0.5) return
      this.doShake(Math.min(0.012, 0.003 + p.amount * 0.0004), 200)
      this.particles.burst(this.player.x, this.player.y, { count: 6, color: 0x331016, speed: 90, lifespan: 260, scale: 0.5 })
      getAudio(this.game)?.play('hurt', { intensity: Math.min(1, p.amount / 30) })
    }
    const onThreatKilled = (p: GameEventPayloads['THREAT_KILLED']): void => {
      this.threatsKilled++
      this.player.addKillBiomass(p.biomass)
      this.particles.burst(p.x, p.y, { count: 12, color: 0xffe27a, speed: 150, lifespan: 380, scale: 0.7 })
    }
    const onAbility = (p: GameEventPayloads['ABILITY_USED']): void => {
      this.handleAbility(p.ability)
    }
    const onHazard = (p: GameEventPayloads['HAZARD_BURST']): void => {
      this.spawnHazards(p)
    }
    const onPaused = (): void => {
      /* requested via openPause(); state handled there */
    }

    this.bus.on('EVOLUTION_READY', onEvolutionReady)
    this.bus.on('MUTATION_CHOSEN', onMutationChosen)
    this.bus.on('GAME_RESUMED', onResumed)
    this.bus.on('STAGE_EVOLVED', onStageEvolved)
    this.bus.on('NUTRIENT_COLLECTED', onNutrient)
    this.bus.on('PLAYER_DAMAGED', onDamaged)
    this.bus.on('THREAT_KILLED', onThreatKilled)
    this.bus.on('ABILITY_USED', onAbility)
    this.bus.on('HAZARD_BURST', onHazard)
    this.bus.on('GAME_PAUSED', onPaused)

    this.unsubscribe.push(
      () => this.bus.off('EVOLUTION_READY', onEvolutionReady),
      () => this.bus.off('MUTATION_CHOSEN', onMutationChosen),
      () => this.bus.off('GAME_RESUMED', onResumed),
      () => this.bus.off('STAGE_EVOLVED', onStageEvolved),
      () => this.bus.off('NUTRIENT_COLLECTED', onNutrient),
      () => this.bus.off('PLAYER_DAMAGED', onDamaged),
      () => this.bus.off('THREAT_KILLED', onThreatKilled),
      () => this.bus.off('ABILITY_USED', onAbility),
      () => this.bus.off('HAZARD_BURST', onHazard),
      () => this.bus.off('GAME_PAUSED', onPaused),
    )

    // Auto-pause when the tab/window loses focus.
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this)
  }

  private onBlur(): void {
    if (!this.ended && !this.isPausedOverlay && this.scene.isActive()) this.openPause()
  }

  // ----------------------------------------------------------------- loop

  update(time: number, delta: number): void {
    if (this.ended) return
    const input = this.controls.getState()

    if (input.pausePressed) {
      this.openPause()
      return
    }
    if (input.mutePressed) this.toggleMute()

    this.player.update(delta, input)
    this.spawn.update(delta)
    this.collision.update(delta)
    this.wave.update(delta)
    this.evolution.update()
    this.score.update(delta)
    this.backdrop.update(time, delta)
    this.updateHazards(delta)

    this.checkVictory(delta)
    if (!this.player.isAlive()) this.endRun(this.player.getDeathCause())

    this.elapsedMs += delta
  }

  private checkVictory(delta: number): void {
    // Reaching the apex stage starts the survival countdown immediately, and
    // the HUD shows it via VICTORY_PROGRESS — no hidden biomass grind required.
    if (this.player.getStageId() < FINAL_STAGE_ID) return
    this.victoryHoldMs += delta
    const need = BALANCE.VICTORY_HOLD_SECONDS_AT_FINAL_STAGE
    this.bus.emit('VICTORY_PROGRESS', {
      secondsHeld: this.victoryHoldMs / 1000,
      secondsNeeded: need,
    })
    if (this.victoryHoldMs >= need * 1000) this.endRun('victory')
  }

  // ----------------------------------------------------------------- abilities & hazards

  private handleAbility(ability: AbilityId): void {
    if (ability === 'dash' || ability === 'lunge') {
      this.particles.burst(this.player.x, this.player.y, {
        count: 8,
        color: this.player.getStage().color,
        speed: 120,
        lifespan: 260,
        scale: 0.5,
      })
      return
    }
    const radius =
      ability === 'toxinPulse'
        ? BALANCE.TOXIN_PULSE_RADIUS
        : ability === 'spinSweep'
          ? BALANCE.SPIN_SWEEP_RADIUS
          : BALANCE.ENGULF_RADIUS
    const damage =
      ability === 'toxinPulse'
        ? BALANCE.TOXIN_PULSE_DAMAGE
        : ability === 'spinSweep'
          ? BALANCE.SPIN_SWEEP_DAMAGE
          : BALANCE.ENGULF_DAMAGE
    const power = ability === 'engulf' ? this.player.getModifiers().engulfPowerMult : 1

    this.particles.ring(this.player.x, this.player.y, this.player.getStage().color, radius)
    const threats = this.spawn.getThreatPool()
    for (const t of threats) {
      if (!t.active) continue
      if (dist(this.player.x, this.player.y, t.x, t.y) > radius + t.getRadius()) continue
      if (t.takeDamage(damage * power)) {
        this.bus.emit('THREAT_KILLED', { kind: t.getKind(), x: t.x, y: t.y, biomass: t.getBiomassReward() })
        t.despawn()
      }
    }
  }

  private spawnHazards(p: GameEventPayloads['HAZARD_BURST']): void {
    const color = HAZARD_COLOR[p.kind]
    for (const zone of p.zones) {
      const g = this.add.graphics().setDepth(DEPTHS.THREAT_TELEGRAPH)
      g.lineStyle(3, color, 0.85)
      g.strokeCircle(zone.x, zone.y, zone.r)
      g.fillStyle(color, 0.08)
      g.fillCircle(zone.x, zone.y, zone.r)
      this.hazards.push({ x: zone.x, y: zone.y, r: zone.r, kind: p.kind, graphics: g, phase: 'warn', timer: p.warningMs, hit: false })
    }
  }

  private updateHazards(delta: number): void {
    const dt = delta / 1000
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]
      h.timer -= delta
      if (h.phase === 'warn') {
        h.graphics.setAlpha(0.5 + 0.5 * Math.sin(h.timer * 0.02))
        if (h.timer <= 0) {
          h.phase = 'active'
          h.timer = 380
          const color = HAZARD_COLOR[h.kind]
          h.graphics.clear()
          h.graphics.fillStyle(color, 0.42)
          h.graphics.fillCircle(h.x, h.y, h.r)
          h.graphics.lineStyle(4, color, 0.9)
          h.graphics.strokeCircle(h.x, h.y, h.r)
        }
      } else {
        h.graphics.setAlpha(Math.max(0, h.timer / 380))
        if (this.player.isAlive() && dist(this.player.x, this.player.y, h.x, h.y) < h.r + this.player.getRadius()) {
          const kind = HAZARD_THREAT[h.kind]
          if (h.kind === 'acid') {
            this.player.takeDamage(HAZARD_DAMAGE.acid * dt, kind, h.x, h.y, true)
          } else if (!h.hit) {
            // One-shot, i-frame-independent: a prior contact must not cancel it.
            h.hit = true
            this.player.takeDamage(HAZARD_DAMAGE[h.kind], kind, h.x, h.y, true)
          }
        }
        if (h.timer <= 0) {
          h.graphics.destroy()
          this.hazards.splice(i, 1)
        }
      }
    }
  }

  // ----------------------------------------------------------------- fx & control

  private playEvolveFx(): void {
    const burst = this.add
      .image(this.player.x, this.player.y, TEX.EVOLVE_BURST)
      .setDepth(DEPTHS.FX)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.9)
      .setScale(0.1)
    this.tweens.add({
      targets: burst,
      scale: 2,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    })
    this.particles.ring(this.player.x, this.player.y, 0xffffff, 160, 520)
    if (!this.reduceMotion) {
      this.cameras.main.flash(280, 255, 255, 255)
      this.cameras.main.zoomTo(1.06, 120, 'Sine.easeInOut', true, (_cam, progress) => {
        if (progress === 1) this.cameras.main.zoomTo(1, 320, 'Sine.easeInOut')
      })
    }
  }

  private doShake(intensity: number, duration: number): void {
    if (!this.reduceMotion) this.cameras.main.shake(duration, intensity)
  }

  private toggleMute(): void {
    const audio = getAudio(this.game)
    if (!audio) return
    const muted = audio.toggleMuted()
    this.save.setMuted(muted)
    this.bus.emit('TOAST', { text: muted ? 'Silencio' : 'Sonido', durationMs: 900 })
  }

  private openPause(): void {
    if (this.ended || this.isPausedOverlay) return
    this.isPausedOverlay = true
    this.bus.emit('GAME_PAUSED', {})
    this.scene.launch('PauseScene')
    this.scene.pause()
  }

  // ----------------------------------------------------------------- run end

  private endRun(cause: RunEndCause): void {
    if (this.ended) return
    this.ended = true
    const summary = this.buildRunResult(cause)
    this.save.recordRunResult(summary)

    if (cause === 'victory') this.bus.emit('GAME_WON', { summary })
    else this.bus.emit('PLAYER_DIED', { cause: cause as DeathCause, summary })

    this.scene.stop('HUDScene')
    this.scene.launch('GameOverScene', { summary })
    this.scene.pause()
  }

  private buildRunResult(cause: RunEndCause): RunResult {
    const sd = this.save.get()
    const stageReached = this.player.getStageId()
    const score = this.score.getScore()
    return {
      stageReached,
      stageName: this.player.getStage().name,
      biomassCollected: Math.round(this.player.getTotalBiomass()),
      survivalMs: this.elapsedMs,
      score,
      waveReached: this.wave.getWaveIndex(),
      cause,
      nutrientsEaten: this.nutrientsEaten,
      threatsKilled: this.threatsKilled,
      isNewBestStage: stageReached > sd.bestStageId,
      isNewHighScore: score > sd.highScore,
    }
  }

  private cleanup(): void {
    for (const off of this.unsubscribe) off()
    this.unsubscribe = []
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this)
    this.controls?.destroy()
    this.spawn?.destroy()
    this.wave?.destroy()
    this.evolution?.destroy()
    this.score?.destroy()
    for (const h of this.hazards) h.graphics.destroy()
    this.hazards.length = 0
  }
}
