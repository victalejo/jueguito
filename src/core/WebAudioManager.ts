import type { AudioManager, SfxName, SfxParams } from '@/core/audio'

/**
 * WebAudioManager — a tiny procedural synthesiser that implements {@link AudioManager}
 * entirely with the Web Audio API. No audio files are loaded; every cue is built
 * from oscillators, gain envelopes and a short white-noise buffer.
 *
 * Design goals:
 *  - Robust: the AudioContext is created lazily (browser autoplay policy) inside a
 *    try/catch. If construction ever fails, every method silently no-ops.
 *  - Click-free: every envelope uses a short attack ramp and a smooth release so we
 *    never produce hard discontinuities.
 *  - Modest gains: a master GainNode keeps the mix well below clipping and acts as a
 *    crude soft limiter by never letting individual voices run hot.
 */

interface WebAudioOptions {
  muted?: boolean
  volume?: number
}

/** Base master gain — voices are summed under this, kept low to avoid clipping. */
const BASE_MASTER_GAIN = 0.5
/** Minimum spacing (seconds) between consecutive 'eat' blips so rapid eats don't machine-gun. */
const EAT_THROTTLE = 0.04

export class WebAudioManager implements AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private muted: boolean
  /** Logical volume 0..1 chosen by the player; master gain = BASE * volume (when unmuted). */
  private volume: number
  /** Timestamp (ctx time) of the last 'eat' cue, used for throttling. */
  private lastEatAt = 0
  /** True once we have permanently given up on audio (creation failed). */
  private dead = false

  constructor(opts: WebAudioOptions = {}) {
    this.muted = opts.muted ?? false
    this.volume = clamp01(opts.volume ?? 1)
    // NOTE: deliberately do NOT create the AudioContext here — browsers block it
    // outside a user gesture. It is created lazily in ensureContext().
  }

  // ---------------------------------------------------------------------------
  // Lifecycle / context management
  // ---------------------------------------------------------------------------

  /**
   * Lazily create the AudioContext + master chain. Returns the context, or null if
   * audio is unavailable. Safe to call repeatedly.
   */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    if (this.dead) return null
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        this.dead = true
        return null
      }
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : BASE_MASTER_GAIN * this.volume
      master.connect(ctx.destination)

      this.ctx = ctx
      this.master = master
      this.noiseBuffer = this.buildNoiseBuffer(ctx)
      return ctx
    } catch {
      // Any failure → permanently no-op. Never throw out of the audio layer.
      this.dead = true
      this.ctx = null
      this.master = null
      return null
    }
  }

  /** Build a 1-second mono white-noise buffer reused by all noise-based cues. */
  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  unlock(): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      // resume() returns a promise; ignore rejection (some browsers reject if
      // called outside a gesture — harmless, we'll retry on the next unlock()).
      void ctx.resume().catch(() => undefined)
    }
  }

  // ---------------------------------------------------------------------------
  // Mute / volume
  // ---------------------------------------------------------------------------

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyMasterGain()
  }

  isMuted(): boolean {
    return this.muted
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  setVolume(volume: number): void {
    this.volume = clamp01(volume)
    this.applyMasterGain()
  }

  /** Push the current muted/volume state onto the master gain with a tiny ramp. */
  private applyMasterGain(): void {
    if (!this.ctx || !this.master) return
    // Ramp to a tiny epsilon rather than hard 0 to avoid a click on some browsers.
    const target = this.muted ? 0.0001 : BASE_MASTER_GAIN * this.volume
    const now = this.ctx.currentTime
    const g = this.master.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(Math.max(0.0001, g.value), now)
    // Short linear ramp avoids a click when toggling mute.
    g.linearRampToValueAtTime(target, now + 0.02)
  }

  destroy(): void {
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    this.noiseBuffer = null
    this.dead = true
    if (!ctx) return
    try {
      void ctx.close().catch(() => undefined)
    } catch {
      // ignore — nothing more we can do
    }
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  play(name: SfxName, params: SfxParams = {}): void {
    if (this.muted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.master) return
    // If still suspended, attempt a resume; the cue may be near-silent until the
    // first real gesture, which is acceptable.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)

    const t = ctx.currentTime
    try {
      switch (name) {
        case 'eat':
          this.playEat(ctx, t, params)
          break
        case 'rare':
          this.playRare(ctx, t)
          break
        case 'hurt':
          this.playHurt(ctx, t, params)
          break
        case 'dash':
          this.playDash(ctx, t)
          break
        case 'ability':
          this.playAbility(ctx, t)
          break
        case 'evolve':
          this.playEvolve(ctx, t)
          break
        case 'waveUp':
          this.playWaveUp(ctx, t)
          break
        case 'uiHover':
          this.playClick(ctx, t, 1500, 0.05)
          break
        case 'uiSelect':
          this.playClick(ctx, t, 900, 0.08)
          break
        case 'lowEnergy':
          this.playLowEnergy(ctx, t)
          break
        default:
          break
      }
    } catch {
      // A bad schedule should never crash the game loop.
    }
  }

  // ---------------------------------------------------------------------------
  // Voice helpers
  // ---------------------------------------------------------------------------

  /** Create a fresh gain node connected to the master bus. */
  private bus(ctx: AudioContext): GainNode {
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(this.master as GainNode)
    return g
  }

  /**
   * Schedule a single tone with a click-free attack/release envelope.
   * Returns nothing — the oscillator self-stops at the release tail.
   */
  private tone(
    ctx: AudioContext,
    opts: {
      type: OscillatorType
      freq: number
      start: number
      duration: number
      peak: number
      attack?: number
      release?: number
      detune?: number
      glideTo?: number
      dest?: AudioNode
    }
  ): void {
    const attack = opts.attack ?? 0.006
    const release = opts.release ?? 0.08
    const osc = ctx.createOscillator()
    osc.type = opts.type
    osc.frequency.setValueAtTime(opts.freq, opts.start)
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, opts.start)
    if (opts.glideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.glideTo), opts.start + opts.duration)
    }

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, opts.start)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.peak), opts.start + attack)
    const end = opts.start + opts.duration
    env.gain.exponentialRampToValueAtTime(0.0001, end + release)

    osc.connect(env)
    env.connect(opts.dest ?? (this.master as GainNode))
    osc.start(opts.start)
    osc.stop(end + release + 0.02)
  }

  /** Schedule a noise burst routed through an optional filter, with an envelope. */
  private noise(
    ctx: AudioContext,
    opts: {
      start: number
      duration: number
      peak: number
      filter?: BiquadFilterNode
      attack?: number
      dest?: AudioNode
    }
  ): void {
    if (!this.noiseBuffer) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const env = ctx.createGain()
    const attack = opts.attack ?? 0.005
    env.gain.setValueAtTime(0.0001, opts.start)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.peak), opts.start + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.duration)

    let head: AudioNode = src
    if (opts.filter) {
      src.connect(opts.filter)
      head = opts.filter
    }
    head.connect(env)
    env.connect(opts.dest ?? (this.master as GainNode))
    src.start(opts.start)
    src.stop(opts.start + opts.duration + 0.02)
  }

  // ---------------------------------------------------------------------------
  // Individual cues
  // ---------------------------------------------------------------------------

  /** Soft sine blip that rises in pitch with the feed combo, plus a faint harmonic. */
  private playEat(ctx: AudioContext, t: number, params: SfxParams): void {
    if (t - this.lastEatAt < EAT_THROTTLE) return
    this.lastEatAt = t
    const combo = Math.max(0, params.combo ?? 0)
    const base = Math.min(720, 440 + combo * 20)
    this.tone(ctx, { type: 'sine', freq: base, start: t, duration: 0.07, peak: 0.22, attack: 0.006, release: 0.06 })
    // Faint detuned harmonic an octave-ish up for sparkle.
    this.tone(ctx, {
      type: 'sine',
      freq: base * 1.5,
      start: t + 0.005,
      duration: 0.05,
      peak: 0.07,
      detune: 6,
      release: 0.05
    })
  }

  /** Brighter two-note triangle up-arpeggio for a rare pickup. */
  private playRare(ctx: AudioContext, t: number): void {
    this.tone(ctx, { type: 'triangle', freq: 660, start: t, duration: 0.08, peak: 0.2, release: 0.07 })
    this.tone(ctx, { type: 'triangle', freq: 990, start: t + 0.07, duration: 0.12, peak: 0.22, release: 0.1 })
    // High shimmer tail.
    this.tone(ctx, { type: 'sine', freq: 1320, start: t + 0.12, duration: 0.1, peak: 0.08, release: 0.12 })
  }

  /** Detuned saw burst sweeping down + a filtered noise transient. Depth scales with intensity. */
  private playHurt(ctx: AudioContext, t: number, params: SfxParams): void {
    const intensity = clamp01(params.intensity ?? 0.5)
    const peak = 0.16 + intensity * 0.16
    this.tone(ctx, {
      type: 'sawtooth',
      freq: 220,
      glideTo: 90,
      start: t,
      duration: 0.15,
      peak,
      attack: 0.005,
      release: 0.06,
      detune: -8
    })
    // Square layer adds grit, detuned the other way for beating.
    this.tone(ctx, {
      type: 'square',
      freq: 218,
      glideTo: 92,
      start: t,
      duration: 0.13,
      peak: peak * 0.5,
      release: 0.05,
      detune: 10
    })
    // Lowpass noise transient = the "impact".
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1800, t)
    lp.frequency.exponentialRampToValueAtTime(400, t + 0.08)
    this.noise(ctx, { start: t, duration: 0.07, peak: 0.12 + intensity * 0.1, filter: lp })
  }

  /** Bandpass-swept noise whoosh for a dash. */
  private playDash(ctx: AudioContext, t: number): void {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.setValueAtTime(6, t)
    bp.frequency.setValueAtTime(400, t)
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.18)
    this.noise(ctx, { start: t, duration: 0.2, peak: 0.18, attack: 0.01, filter: bp })
  }

  /** Short zap: square tone with a quick downward sweep. */
  private playAbility(ctx: AudioContext, t: number): void {
    this.tone(ctx, {
      type: 'square',
      freq: 880,
      glideTo: 220,
      start: t,
      duration: 0.12,
      peak: 0.18,
      attack: 0.004,
      release: 0.05
    })
    this.tone(ctx, { type: 'sine', freq: 1320, start: t, duration: 0.06, peak: 0.08, release: 0.05 })
  }

  /** Centerpiece evolve fanfare: rising major arpeggio with a feedback-delay shimmer. */
  private playEvolve(ctx: AudioContext, t: number): void {
    // Build a short feedback delay to give the arpeggio a glittering tail.
    const delay = ctx.createDelay(1.0)
    delay.delayTime.setValueAtTime(0.13, t)
    const feedback = ctx.createGain()
    feedback.gain.setValueAtTime(0.34, t)
    const wet = ctx.createGain()
    wet.gain.setValueAtTime(0.4, t)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(this.master as GainNode)

    // Rising major-ish arpeggio (C, E, G, C, E across ~1.1s).
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]
    const step = 0.16
    notes.forEach((freq, i) => {
      const start = t + i * step
      // Stack a sine + triangle for a warm but bright voice; route to both dry & delay.
      this.tone(ctx, { type: 'sine', freq, start, duration: 0.22, peak: 0.2, attack: 0.008, release: 0.18 })
      this.tone(ctx, { type: 'triangle', freq, start, duration: 0.22, peak: 0.1, attack: 0.008, release: 0.18, dest: delay })
    })
    // Final sustained shimmer chord.
    const tail = t + notes.length * step
    this.tone(ctx, { type: 'sine', freq: 1046.5, start: tail, duration: 0.3, peak: 0.14, release: 0.3, dest: delay })
  }

  /** Low ominous sine swell + a soft noise thump announcing a new wave. */
  private playWaveUp(ctx: AudioContext, t: number): void {
    this.tone(ctx, {
      type: 'sine',
      freq: 70,
      glideTo: 130,
      start: t,
      duration: 0.5,
      peak: 0.24,
      attack: 0.08,
      release: 0.25
    })
    this.tone(ctx, { type: 'sine', freq: 140, start: t, duration: 0.45, peak: 0.1, attack: 0.08, release: 0.2 })
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(220, t)
    this.noise(ctx, { start: t, duration: 0.18, peak: 0.14, attack: 0.02, filter: lp })
  }

  /** Tiny soft UI click. Lower freq = "select", higher = "hover". */
  private playClick(ctx: AudioContext, t: number, freq: number, peak: number): void {
    this.tone(ctx, {
      type: 'sine',
      freq,
      start: t,
      duration: 0.025,
      peak,
      attack: 0.003,
      release: 0.03
    })
  }

  /** Subtle low sine heartbeat (double pulse) warning of low energy. */
  private playLowEnergy(ctx: AudioContext, t: number): void {
    this.tone(ctx, { type: 'sine', freq: 110, start: t, duration: 0.1, peak: 0.16, attack: 0.01, release: 0.1 })
    this.tone(ctx, { type: 'sine', freq: 96, start: t + 0.16, duration: 0.12, peak: 0.12, attack: 0.01, release: 0.12 })
  }
}

/** Clamp a value into the inclusive 0..1 range. */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}
