import Phaser from 'phaser'
import { VIEW } from '@/config/constants'
import { getAudio } from '@/core/audio'
import type { EventBus } from '@/core/EventBus'
import { REGISTRY } from '@/core/registryKeys'
import type { SaveSystem } from '@/systems/SaveSystem'
import { Button } from '@/ui/Button'

const CX = VIEW.WIDTH / 2

/** Modal pause overlay (Esc/P or window blur). */
export class PauseScene extends Phaser.Scene {
  private bus!: EventBus

  constructor() {
    super('PauseScene')
  }

  create(): void {
    this.bus = this.registry.get(REGISTRY.BUS) as EventBus
    this.add.rectangle(CX, VIEW.HEIGHT / 2, VIEW.WIDTH, VIEW.HEIGHT, 0x02080d, 0.7)
    this.add
      .text(CX, 190, 'PAUSA', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#bff7ff',
      })
      .setOrigin(0.5)

    new Button(this, CX, 312, 'Reanudar', () => this.resumeGame(), { primary: true, width: 260 })
    new Button(this, CX, 384, 'Reiniciar', () => this.restart(), { width: 260 })
    new Button(this, CX, 456, 'Salir al menú', () => this.toMenu(), { width: 260 })
    new Button(this, CX, 528, 'Silencio', () => this.toggleMute(), { width: 260 })

    const kb = this.input.keyboard
    if (kb) {
      kb.on('keydown-ESC', () => this.resumeGame())
      kb.on('keydown-P', () => this.resumeGame())
    }
  }

  private resumeGame(): void {
    this.bus.emit('GAME_RESUMED', {})
    this.scene.stop()
  }

  private restart(): void {
    this.scene.stop('HUDScene')
    this.scene.start('GameScene')
    this.scene.stop()
  }

  private toMenu(): void {
    this.scene.stop('HUDScene')
    this.scene.stop('GameScene')
    this.scene.start('MenuScene')
    this.scene.stop()
  }

  private toggleMute(): void {
    const audio = getAudio(this.game)
    if (!audio) return
    const muted = audio.toggleMuted()
    ;(this.registry.get(REGISTRY.SAVE) as SaveSystem).setMuted(muted)
  }
}
