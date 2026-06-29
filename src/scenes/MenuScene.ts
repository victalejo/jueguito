import Phaser from 'phaser'
import { COLORS, STAGE_COUNT, VIEW } from '@/config/constants'
import { getAudio } from '@/core/audio'
import { REGISTRY } from '@/core/registryKeys'
import { getStage } from '@/data/stages'
import type { SaveSystem } from '@/systems/SaveSystem'
import { Button } from '@/ui/Button'
import { SoupBackdrop } from '@/ui/SoupBackdrop'

const CX = VIEW.WIDTH / 2

/** Title screen: animated soup, play/help/reset/mute, and a best-run banner. */
export class MenuScene extends Phaser.Scene {
  private backdrop!: SoupBackdrop
  private helpPanel?: Phaser.GameObjects.Container

  constructor() {
    super('MenuScene')
  }

  create(): void {
    const save = this.registry.get(REGISTRY.SAVE) as SaveSystem
    const data = save.get()

    this.backdrop = new SoupBackdrop(this, { world: false })
    this.backdrop.setStage(Math.min(STAGE_COUNT - 1, data.bestStageId), false)

    this.add
      .text(CX, 150, 'EVOLUCIÓN', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '76px',
        fontStyle: 'bold',
        color: '#7fe3ff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#2bb98a', 26, false, true)

    this.add
      .text(CX, 214, 'del átomo a la célula', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#c9fff0',
        align: 'center',
      })
      .setOrigin(0.5)

    const hasProgress = data.bestStageId > 0 || data.highScore > 0
    if (hasProgress) {
      const best = getStage(data.bestStageId).name
      this.add
        .text(CX, 262, `Mejor etapa: ${best}   ·   Récord: ${data.highScore}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#8fb3c4',
        })
        .setOrigin(0.5)
    }

    new Button(this, CX, 348, 'JUGAR', () => this.startGame(), {
      width: 280,
      height: 64,
      fontSize: 26,
      primary: true,
    })
    new Button(this, CX, 426, 'Cómo se juega', () => this.toggleHelp(), { width: 240 })
    new Button(this, CX - 130, 500, 'Silencio', () => this.toggleMute(), { width: 220 })
    new Button(this, CX + 130, 500, 'Reiniciar progreso', () => this.resetProgress(save), {
      width: 220,
    })

    this.add
      .text(CX, 620, 'Mover: WASD / Flechas    ·    Habilidad: Espacio / Clic    ·    Esquiva: E    ·    Pausa: Esc', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#5e7a88',
        align: 'center',
      })
      .setOrigin(0.5)
  }

  override update(time: number, delta: number): void {
    this.backdrop.update(time, delta)
  }

  private startGame(): void {
    getAudio(this.game)?.unlock()
    this.scene.start('GameScene')
  }

  private toggleMute(): void {
    const audio = getAudio(this.game)
    if (!audio) return
    const muted = audio.toggleMuted()
    const save = this.registry.get(REGISTRY.SAVE) as SaveSystem
    save.setMuted(muted)
  }

  private resetProgress(save: SaveSystem): void {
    save.resetSave()
    this.scene.restart()
  }

  private toggleHelp(): void {
    if (this.helpPanel) {
      this.helpPanel.destroy()
      this.helpPanel = undefined
      return
    }
    const bg = this.add.rectangle(0, 0, 560, 300, 0x041018, 0.92).setStrokeStyle(2, 0x2bb98a, 0.8)
    const text = this.add
      .text(
        0,
        0,
        [
          'Sobrevive en el caldo primigenio.',
          '',
          '• Recolecta moléculas para ganar ENERGÍA y BIOMASA.',
          '• La energía baja con el tiempo: ¡no dejes de comer!',
          '• Esquiva radicales, toxinas, depredadores y estallidos UV.',
          '• Al llenar la BIOMASA evolucionas y eliges una mutación.',
          '• Llega a la etapa apex y sobrevive 60 s para ganar.',
        ].join('\n'),
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '17px',
          color: '#d8ffd0',
          align: 'left',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5)
    this.helpPanel = this.add.container(CX, 430, [bg, text]).setDepth(50)
  }
}
