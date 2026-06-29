import Phaser from 'phaser'
import type { GameEventName, GameEventPayloads } from '@/types'

/**
 * Strongly-typed wrapper around a Phaser EventEmitter. Scenes and systems
 * communicate ONLY through this bus (stored on `game.registry` under
 * `REGISTRY.BUS`) so they stay decoupled — no scene reads another's state.
 */
export class EventBus {
  private readonly emitter = new Phaser.Events.EventEmitter()

  emit<K extends GameEventName>(event: K, payload: GameEventPayloads[K]): void {
    this.emitter.emit(event, payload)
  }

  on<K extends GameEventName>(
    event: K,
    fn: (payload: GameEventPayloads[K]) => void,
    context?: unknown,
  ): this {
    this.emitter.on(event, fn, context)
    return this
  }

  once<K extends GameEventName>(
    event: K,
    fn: (payload: GameEventPayloads[K]) => void,
    context?: unknown,
  ): this {
    this.emitter.once(event, fn, context)
    return this
  }

  off<K extends GameEventName>(
    event: K,
    fn?: (payload: GameEventPayloads[K]) => void,
    context?: unknown,
  ): this {
    this.emitter.off(event, fn, context)
    return this
  }

  /** Remove every listener (call on full teardown to avoid leaks). */
  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }
}

/**
 * Helper for scoped subscriptions. Returns an unsubscribe-all function so a
 * scene can register handlers in `create()` and drop them in `shutdown()`
 * without manually tracking every pair.
 */
export function subscribe(
  bus: EventBus,
  handlers: Partial<{ [K in GameEventName]: (payload: GameEventPayloads[K]) => void }>,
): () => void {
  const entries = Object.entries(handlers) as [
    GameEventName,
    (payload: GameEventPayloads[GameEventName]) => void,
  ][]
  for (const [event, fn] of entries) bus.on(event, fn)
  return () => {
    for (const [event, fn] of entries) bus.off(event, fn)
  }
}

export function createEventBus(): EventBus {
  return new EventBus()
}
