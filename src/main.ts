import Phaser from 'phaser'
import { createGameConfig } from '@/config/gameConfig'
import { BootScene } from '@/scenes/BootScene'
import { MenuScene } from '@/scenes/MenuScene'
import { GameScene } from '@/scenes/GameScene'
import { HUDScene } from '@/scenes/HUDScene'
import { EvolutionScene } from '@/scenes/EvolutionScene'
import { PauseScene } from '@/scenes/PauseScene'
import { GameOverScene } from '@/scenes/GameOverScene'

// Only BootScene auto-starts; everything else is started/launched on demand.
export const game = new Phaser.Game(
  createGameConfig([
    BootScene,
    MenuScene,
    GameScene,
    HUDScene,
    EvolutionScene,
    PauseScene,
    GameOverScene,
  ]),
)
