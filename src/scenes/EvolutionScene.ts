import Phaser from 'phaser'
import { VIEW } from '@/config/constants'
import type { EventBus } from '@/core/EventBus'
import { REGISTRY } from '@/core/registryKeys'
import { getStage } from '@/data/stages'
import { MutationCard } from '@/ui/MutationCard'
import type { GameEventPayloads, Mutation, MutationChoice } from '@/types'

/** Modal mutation picker shown on each evolution. Time is frozen behind it. */
export class EvolutionScene extends Phaser.Scene {
  private bus!: EventBus
  private toStageId = 0
  private choices: MutationChoice[] = []
  private cards: MutationCard[] = []
  private chosen = false

  constructor() {
    super('EvolutionScene')
  }

  init(data: GameEventPayloads['EVOLUTION_READY']): void {
    this.toStageId = data.toStageId
    this.choices = data.choices
    this.cards = []
    this.chosen = false
  }

  create(): void {
    this.bus = this.registry.get(REGISTRY.BUS) as EventBus
    this.add.rectangle(VIEW.WIDTH / 2, VIEW.HEIGHT / 2, VIEW.WIDTH, VIEW.HEIGHT, 0x02080d, 0.74)

    const stage = getStage(this.toStageId)
    this.add
      .text(VIEW.WIDTH / 2, 110, 'EVOLUCIÓN', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#7fe3ff',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#2bb98a', 22, false, true)
    this.add
      .text(VIEW.WIDTH / 2, 168, `Te conviertes en ${stage.name}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#c9fff0',
      })
      .setOrigin(0.5)
    this.add
      .text(VIEW.WIDTH / 2, 206, 'Elige una mutación  ·  1 / 2 / 3 o clic', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#8fb3c4',
      })
      .setOrigin(0.5)

    const n = this.choices.length
    const spacing = 260
    const startX = VIEW.WIDTH / 2 - ((n - 1) * spacing) / 2
    this.choices.forEach((mutation, i) => {
      const card = new MutationCard(this, startX + i * spacing, 420, mutation, i, (m) => this.choose(m))
      card.playIntro(120 + i * 90)
      this.cards.push(card)
    })

    const kb = this.input.keyboard
    if (kb) {
      kb.on('keydown-ONE', () => this.cards[0]?.select())
      kb.on('keydown-TWO', () => this.cards[1]?.select())
      kb.on('keydown-THREE', () => this.cards[2]?.select())
    }
  }

  private choose(mutation: Mutation): void {
    if (this.chosen) return
    this.chosen = true
    this.bus.emit('MUTATION_CHOSEN', { mutationId: mutation.id, toStageId: this.toStageId })
    this.cards.forEach((c) => c.setHighlighted(false))
    this.time.delayedCall(180, () => this.scene.stop())
  }
}
