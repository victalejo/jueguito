import Phaser from 'phaser'

/**
 * Give an Arcade Image/Sprite a centered circular body sized to a world-space
 * radius, independent of the texture's actual pixel dimensions. This keeps the
 * hitbox honest even though entity textures include glow padding around the
 * visible core. Call AFTER enableBody()/setTexture() and any scaling.
 */
export function setCircleBody(
  obj: Phaser.Physics.Arcade.Image | Phaser.Physics.Arcade.Sprite,
  worldRadius: number,
): void {
  const body = obj.body as Phaser.Physics.Arcade.Body | null
  if (!body) return
  const sx = obj.scaleX || 1
  const rt = Math.max(1, worldRadius / sx)
  body.setCircle(rt, obj.width / 2 - rt, obj.height / 2 - rt)
}
