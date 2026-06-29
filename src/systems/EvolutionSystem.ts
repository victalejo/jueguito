import { BALANCE, FINAL_STAGE_ID } from '@/config/constants'
import type { EventBus } from '@/core/EventBus'
import type { Player } from '@/entities/Player'
import { getMutation, rollMutationChoices } from '@/data/mutations'
import { getStage } from '@/data/stages'
import { rng } from '@/utils/random'
import type { GameEventPayloads } from '@/types'
import type { SaveSystem } from './SaveSystem'

/**
 * Watches biomass against the stage threshold. When full, it opens the mutation
 * picker (EVOLUTION_READY); when the player chooses, it applies the mutation,
 * advances the stage, persists the unlock, and announces STAGE_EVOLVED.
 */
export class EvolutionSystem {
  private evolving = false

  private readonly onChosen = (p: GameEventPayloads['MUTATION_CHOSEN']): void => {
    this.applyChoice(p)
  }

  constructor(
    private readonly bus: EventBus,
    private readonly player: Player,
    private readonly save: SaveSystem,
  ) {
    bus.on('MUTATION_CHOSEN', this.onChosen)
  }

  update(): void {
    if (this.evolving || !this.player.isAlive()) return
    if (this.player.getStageId() >= FINAL_STAGE_ID) return
    if (this.player.getBiomass() < this.player.getBiomassToNext()) return

    this.evolving = true
    const fromId = this.player.getStageId()
    const toId = fromId + 1
    const choices = rollMutationChoices(
      toId,
      this.player.getOwnedMutations(),
      rng,
      BALANCE.MUTATION_CHOICES_PER_LEVEL,
    )
    this.bus.emit('EVOLUTION_READY', { fromStageId: fromId, toStageId: toId, choices })
  }

  private applyChoice(p: GameEventPayloads['MUTATION_CHOSEN']): void {
    if (!this.evolving) return
    const mutation = getMutation(p.mutationId)
    const spent = this.player.getBiomassToNext()
    this.player.addMutation(mutation)
    this.player.consumeBiomass(spent)

    const nextStage = getStage(p.toStageId)
    this.player.setStage(nextStage)
    this.save.unlockMutation(p.mutationId)

    this.bus.emit('STAGE_EVOLVED', {
      stageId: nextStage.id,
      stageName: nextStage.name,
      stats: this.player.getStats(),
    })
    this.evolving = false
  }

  isEvolving(): boolean {
    return this.evolving
  }

  destroy(): void {
    this.bus.off('MUTATION_CHOSEN', this.onChosen)
  }
}
