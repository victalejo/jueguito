import Phaser from 'phaser'
import { TEX } from '@/config/constants'
import { createEventBus } from '@/core/EventBus'
import { REGISTRY } from '@/core/registryKeys'
import { WebAudioManager } from '@/core/WebAudioManager'
import { NUTRIENT_DEFS, NUTRIENT_KINDS } from '@/data/nutrients'
import { MUTATION_LIST } from '@/data/mutations'
import { EVOLUTION_STAGES } from '@/data/stages'
import { THREAT_DEFS, THREAT_KINDS } from '@/data/threats'
import { SaveSystem } from '@/systems/SaveSystem'
import { generateAll } from '@/utils/TextureFactory'

/**
 * Generates every procedural texture, wires the global singletons (EventBus,
 * SaveSystem, AudioManager) onto the registry, then hands off to the menu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create(): void {
    generateAll(this)
    this.ensureFallbackTextures()

    const bus = createEventBus()
    const save = new SaveSystem()
    const settings = save.get().settings
    const audio = new WebAudioManager({ muted: settings.muted, volume: settings.sfxVolume })

    this.registry.set(REGISTRY.BUS, bus)
    this.registry.set(REGISTRY.SAVE, save)
    this.registry.set(REGISTRY.AUDIO, audio)

    // Resume the AudioContext on the first user gesture (browser autoplay policy).
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => audio.unlock())
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown', () => audio.unlock())
    }

    const splash = document.getElementById('boot')
    if (splash) splash.classList.add('hidden')

    this.scene.start('MenuScene')
  }

  /**
   * Safety net: if any expected texture was not produced by the TextureFactory,
   * bake a plain coloured circle so the game still renders instead of crashing
   * on a missing key.
   */
  private ensureFallbackTextures(): void {
    const required: { key: string; color: number; r: number }[] = [
      { key: TEX.SOFT_GLOW, color: 0xffffff, r: 40 },
      { key: TEX.SPARK, color: 0xffffff, r: 8 },
    ]
    for (const stage of EVOLUTION_STAGES) {
      required.push({ key: stage.textureKey, color: stage.color, r: stage.baseRadius })
    }
    for (const kind of NUTRIENT_KINDS) {
      const d = NUTRIENT_DEFS[kind]
      required.push({ key: d.textureKey, color: d.color, r: d.radius })
    }
    for (const kind of THREAT_KINDS) {
      const d = THREAT_DEFS[kind]
      required.push({ key: d.textureKey, color: d.color, r: Math.max(8, d.radius) })
    }
    for (const m of MUTATION_LIST) {
      required.push({ key: m.iconKey, color: 0x9b7bff, r: 18 })
    }

    for (const req of required) {
      if (this.textures.exists(req.key)) continue
      const size = Math.ceil(req.r * 2 + 8)
      const g = this.add.graphics()
      g.fillStyle(req.color, 1)
      g.fillCircle(size / 2, size / 2, req.r)
      g.generateTexture(req.key, size, size)
      g.destroy()
    }
  }
}
