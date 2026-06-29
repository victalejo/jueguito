import Phaser from 'phaser'
import type { InputState, Vec2 } from '@/types'
import { normalize } from '@/utils/mathUtils'

const KC = Phaser.Input.Keyboard.KeyCodes

/**
 * Translates raw keyboard + pointer into an immutable InputState snapshot each
 * frame, with edge-triggered presses for one-shot actions (abilities, pause).
 */
export class InputController {
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>
  private pointerDownQueued = false
  private pointerMoved = false
  private aimX = 0
  private aimY = 0

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard
    this.keys = kb
      ? kb.addKeys(
          {
            up: KC.W,
            down: KC.S,
            left: KC.A,
            right: KC.D,
            upArrow: KC.UP,
            downArrow: KC.DOWN,
            leftArrow: KC.LEFT,
            rightArrow: KC.RIGHT,
            space: KC.SPACE,
            shift: KC.SHIFT,
            secondary: KC.E,
            pauseP: KC.P,
            esc: KC.ESC,
            mute: KC.M,
            one: KC.ONE,
            two: KC.TWO,
            three: KC.THREE,
          },
          false,
        ) as Record<string, Phaser.Input.Keyboard.Key>
      : {}

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this)
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this)
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.leftButtonDown()) this.pointerDownQueued = true
    this.aimX = pointer.worldX
    this.aimY = pointer.worldY
    this.pointerMoved = true
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.aimX = pointer.worldX
    this.aimY = pointer.worldY
    this.pointerMoved = true
  }

  private down(name: string): boolean {
    const k = this.keys[name]
    return k ? k.isDown : false
  }

  private justDown(name: string): boolean {
    const k = this.keys[name]
    return k ? Phaser.Input.Keyboard.JustDown(k) : false
  }

  getState(): InputState {
    let dx = 0
    let dy = 0
    if (this.down('left') || this.down('leftArrow')) dx -= 1
    if (this.down('right') || this.down('rightArrow')) dx += 1
    if (this.down('up') || this.down('upArrow')) dy -= 1
    if (this.down('down') || this.down('downArrow')) dy += 1
    const dir: Vec2 = dx === 0 && dy === 0 ? { x: 0, y: 0 } : normalize(dx, dy)

    const primaryPressed = this.justDown('space') || this.pointerDownQueued
    this.pointerDownQueued = false

    const cardSelect = this.justDown('one')
      ? 1
      : this.justDown('two')
        ? 2
        : this.justDown('three')
          ? 3
          : 0

    return {
      dir,
      sprinting: this.down('shift'),
      primaryPressed,
      secondaryPressed: this.justDown('secondary'),
      pausePressed: this.justDown('pauseP') || this.justDown('esc'),
      mutePressed: this.justDown('mute'),
      aim: this.pointerMoved ? { x: this.aimX, y: this.aimY } : null,
      cardSelect,
    }
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this)
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this)
  }
}
