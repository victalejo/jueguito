import Phaser from 'phaser'
import { VIEW } from '@/config/constants'
import { Button } from '@/ui/Button'
import type { RunResult } from '@/types'

const CX = VIEW.WIDTH / 2

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Modal results screen for death or victory. */
export class GameOverScene extends Phaser.Scene {
  private summary!: RunResult

  constructor() {
    super('GameOverScene')
  }

  init(data: { summary: RunResult }): void {
    this.summary = data.summary
  }

  create(): void {
    const s = this.summary
    const victory = s.cause === 'victory'
    this.add.rectangle(CX, VIEW.HEIGHT / 2, VIEW.WIDTH, VIEW.HEIGHT, 0x02080d, 0.82)

    const title = victory ? '¡APEX DEL CALDO!' : s.cause === 'starvation' ? 'INANICIÓN' : 'FIN'
    const titleColor = victory ? '#ffe27a' : '#ff6b6b'
    this.add
      .text(CX, 130, title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '62px',
        fontStyle: 'bold',
        color: titleColor,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, victory ? '#9b7bff' : '#3a0d12', 24, false, true)

    const lines = [
      `Etapa alcanzada:  ${s.stageName}`,
      `Biomasa total:  ${s.biomassCollected}`,
      `Tiempo:  ${formatTime(s.survivalMs)}`,
      `Oleada:  ${s.waveReached}`,
      `Nutrientes:  ${s.nutrientsEaten}    Amenazas:  ${s.threatsKilled}`,
    ]
    this.add
      .text(CX, 300, lines.join('\n'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#d8ffd0',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5)

    this.add
      .text(CX, 410, `Puntuación  ${s.score}`, {
        fontFamily: 'monospace',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffe27a',
      })
      .setOrigin(0.5)

    if (s.isNewHighScore) {
      const badge = this.add
        .text(CX, 452, '¡NUEVO RÉCORD!', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#7fe3ff',
        })
        .setOrigin(0.5)
      this.tweens.add({
        targets: badge,
        scale: { from: 1, to: 1.12 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    new Button(this, CX - 150, 560, 'Reintentar', () => this.retry(), { primary: true, width: 260 })
    new Button(this, CX + 150, 560, 'Menú', () => this.toMenu(), { width: 260 })
  }

  private retry(): void {
    this.scene.start('GameScene')
    this.scene.stop()
  }

  private toMenu(): void {
    this.scene.stop('GameScene')
    this.scene.start('MenuScene')
    this.scene.stop()
  }
}
