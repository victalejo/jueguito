import Phaser from 'phaser'
import { COLORS, STAGE_COUNT, TEX, VIEW } from '@/config/constants'
import { getAudio } from '@/core/audio'
import { EventBus, subscribe } from '@/core/EventBus'
import { REGISTRY } from '@/core/registryKeys'
import { getMutation } from '@/data/mutations'
import { getStage } from '@/data/stages'
import { Bar } from '@/ui/Bar'
import { MutationIconStrip } from '@/ui/MutationIconStrip'
import { Toast } from '@/ui/Toast'
import type { MutationId } from '@/types'

const HAZARD_LABEL: Record<string, string> = {
  uv: '¡ESTALLIDO UV!',
  radical: '¡TORMENTA DE RADICALES!',
  acid: '¡CORRIENTE ÁCIDA!',
}

/** Parallel, event-driven overlay. Reads no GameScene state — only the bus. */
export class HUDScene extends Phaser.Scene {
  private bus!: EventBus
  private energyBar!: Bar
  private healthBar!: Bar
  private biomassBar!: Bar
  private stageLabel!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private comboText!: Phaser.GameObjects.Text
  private victoryText!: Phaser.GameObjects.Text
  private strip!: MutationIconStrip
  private toast!: Toast
  private vignetteDamage!: Phaser.GameObjects.Image
  private vignetteLow!: Phaser.GameObjects.Image

  private energyFrac = 1
  private lowEnergySfxMs = 0
  private unsubscribe?: () => void

  constructor() {
    super('HUDScene')
  }

  create(): void {
    this.bus = this.registry.get(REGISTRY.BUS) as EventBus

    // Damage + low-energy red vignettes (under the HUD, over the world).
    this.vignetteLow = this.fullVignette(0)
    this.vignetteDamage = this.fullVignette(0)

    this.energyBar = new Bar(this, 20, 20, 240, 18, COLORS.ENERGY_HIGH, { label: 'Energía' })
    this.healthBar = new Bar(this, 20, 46, 240, 14, COLORS.HEALTH, { label: 'Vida' })

    this.stageLabel = this.add
      .text(VIEW.WIDTH / 2, 18, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#bff7ff',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 0, '#04121a', 6)
    this.biomassBar = new Bar(this, VIEW.WIDTH / 2 - 140, 56, 280, 12, COLORS.BIOMASS, {
      label: 'Biomasa',
    })

    this.scoreText = this.add
      .text(VIEW.WIDTH - 20, 18, '0', {
        fontFamily: 'monospace',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffe27a',
      })
      .setOrigin(1, 0)
    this.waveText = this.add
      .text(VIEW.WIDTH - 20, 52, 'OLEADA 1', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#8fb3c4',
      })
      .setOrigin(1, 0)

    this.comboText = this.add
      .text(VIEW.WIDTH / 2, 96, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffd166',
      })
      .setOrigin(0.5)
    this.victoryText = this.add
      .text(VIEW.WIDTH / 2, VIEW.HEIGHT - 60, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffe27a',
        align: 'center',
      })
      .setOrigin(0.5)

    this.strip = new MutationIconStrip(this, 22, 78)
    this.toast = new Toast(this, VIEW.WIDTH / 2, 150)

    this.setStageLabel(0)
    this.subscribeEvents()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.())
  }

  private fullVignette(alpha: number): Phaser.GameObjects.Image {
    return this.add
      .image(VIEW.WIDTH / 2, VIEW.HEIGHT / 2, TEX.VIGNETTE)
      .setDisplaySize(VIEW.WIDTH, VIEW.HEIGHT)
      .setTint(COLORS.DANGER)
      .setAlpha(alpha)
      .setDepth(5)
  }

  private setStageLabel(stageId: number): void {
    const stage = getStage(stageId)
    this.stageLabel.setText(`${stage.name.toUpperCase()}  ·  ${stageId + 1}/${STAGE_COUNT}`)
    this.stageLabel.setColor(`#${(stage.color & 0xffffff).toString(16).padStart(6, '0')}`)
  }

  private subscribeEvents(): void {
    this.unsubscribe = subscribe(this.bus, {
      PLAYER_ENERGY_CHANGED: ({ energy, maxEnergy }) => {
        this.energyFrac = maxEnergy > 0 ? energy / maxEnergy : 0
        this.energyBar.setValue(this.energyFrac)
        this.energyBar.setFillColor(this.energyFrac < 0.25 ? COLORS.ENERGY_LOW : COLORS.ENERGY_HIGH)
      },
      PLAYER_HEALTH_CHANGED: ({ health, maxHealth }) => {
        this.healthBar.setValue(maxHealth > 0 ? health / maxHealth : 0)
      },
      PLAYER_BIOMASS_CHANGED: ({ biomass, biomassToNext }) => {
        this.biomassBar.setValue(biomassToNext > 0 ? biomass / biomassToNext : 0)
      },
      STAGE_EVOLVED: ({ stageId }) => {
        this.setStageLabel(stageId)
        this.stageLabel.setScale(1.3)
        this.tweens.add({ targets: this.stageLabel, scale: 1, duration: 360, ease: 'Back.easeOut' })
        this.biomassBar.setValue(0)
        this.toast.show('¡EVOLUCIÓN!', getStage(stageId).color, 1600)
      },
      SCORE_CHANGED: ({ score }) => {
        this.scoreText.setText(String(score))
      },
      WAVE_STARTED: ({ waveIndex }) => {
        this.waveText.setText(`OLEADA ${waveIndex}`)
        if (waveIndex > 1) {
          this.toast.show(`OLEADA ${waveIndex}`, COLORS.UI_TEXT, 1200)
          getAudio(this.game)?.play('waveUp')
        }
      },
      COMBO_CHANGED: ({ combo }) => {
        this.comboText.setText(combo > 1 ? `Combo x${combo}` : '')
      },
      MUTATION_CHOSEN: ({ mutationId }) => {
        this.strip.addMutation(getMutation(mutationId as MutationId))
      },
      PLAYER_DAMAGED: ({ amount }) => {
        if (amount < 0.5) return
        this.vignetteDamage.setAlpha(0.45)
        this.tweens.add({ targets: this.vignetteDamage, alpha: 0, duration: 320, ease: 'Quad.easeOut' })
      },
      HAZARD_BURST: ({ kind }) => {
        this.toast.show(HAZARD_LABEL[kind] ?? '¡PELIGRO!', COLORS.DANGER, 1400)
      },
      VICTORY_PROGRESS: ({ secondsHeld, secondsNeeded }) => {
        const left = Math.max(0, Math.ceil(secondsNeeded - secondsHeld))
        this.victoryText.setText(`Sobrevive como apex: ${left} s`)
      },
      GAME_WON: () => {
        this.victoryText.setText('')
        this.toast.show('¡APEX DEL CALDO!', 0xffe27a, 2000)
      },
      TOAST: ({ text, color, durationMs }) => {
        this.toast.show(text, color ?? COLORS.UI_TEXT, durationMs ?? 1400)
      },
    })
  }

  override update(time: number, delta: number): void {
    // Low-energy heartbeat: red vignette pulse + throttled audio heartbeat.
    if (this.energyFrac < 0.25) {
      const pulse = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(time * 0.008))
      this.vignetteLow.setAlpha(pulse * (1 - this.energyFrac / 0.25))
      this.lowEnergySfxMs -= delta
      if (this.lowEnergySfxMs <= 0) {
        this.lowEnergySfxMs = 1800
        getAudio(this.game)?.play('lowEnergy')
      }
    } else {
      this.vignetteLow.setAlpha(0)
      this.lowEnergySfxMs = 0
    }
  }
}
