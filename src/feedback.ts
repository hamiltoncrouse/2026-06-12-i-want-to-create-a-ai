// Lightweight tactile/audible UI feedback: a tiny haptic buzz (where supported)
// plus a short, soft tick so taps feel responsive. Kept deliberately quiet so
// it sits under the music rather than competing with it.

type TickKind = 'select' | 'play'

let uiCtx: AudioContext | null = null

function getUiCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!uiCtx) {
    const Ctor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    uiCtx = new Ctor()
  }
  return uiCtx
}

export function feedback(kind: TickKind = 'select') {
  // Haptic: a short pulse. Supported on most Android browsers; a no-op on iOS.
  try {
    navigator.vibrate?.(kind === 'play' ? 18 : 10)
  } catch {
    // Ignore: vibration is best-effort.
  }

  // Audible tick: a quick descending blip, distinct per action.
  const ctx = getUiCtx()
  if (!ctx) return
  try {
    ctx.resume?.().catch(() => undefined)
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    const start = kind === 'play' ? 720 : 920
    osc.frequency.setValueAtTime(start, t)
    osc.frequency.exponentialRampToValueAtTime(start * 0.6, t + 0.08)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(kind === 'play' ? 0.09 : 0.06, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.15)
  } catch {
    // Ignore: audio feedback is best-effort.
  }
}
