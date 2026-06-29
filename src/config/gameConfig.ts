import Phaser from 'phaser'
import { COLORS, VIEW } from '@/config/constants'

/** Builds the Phaser game config with our fixed logical resolution + Arcade physics. */
export function createGameConfig(
  scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW.WIDTH,
    height: VIEW.HEIGHT,
    backgroundColor: COLORS.BACKDROP,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    render: {
      antialias: true,
      roundPixels: false,
    },
    fps: { target: 60, min: 30 },
    scene: scenes,
  }
}
