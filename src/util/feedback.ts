/** Beeps and vibration for the countdowns. Audio must be unlocked by a tap (browser rule), so call
 *  `unlock()` from the Start button. iPhone Safari has no vibration; there the beep still works. */
export function createFeedback() {
  let ctx: AudioContext | null = null

  function unlock() {
    try {
      ctx ??= new AudioContext()
      void ctx.resume()
    } catch {
      ctx = null // no audio available; stay silent
    }
  }

  function tone(freq: number, ms: number) {
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.value = 0.15
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + ms / 1000)
  }

  return {
    unlock,
    /** The 3-2-1 ticks. */
    tick() {
      tone(660, 120)
      navigator.vibrate?.(60)
    },
    /** The end of a countdown. */
    go() {
      tone(990, 450)
      navigator.vibrate?.(350)
    },
  }
}

export type Feedback = ReturnType<typeof createFeedback>
