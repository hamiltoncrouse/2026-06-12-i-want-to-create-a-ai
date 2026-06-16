import { useCallback, useEffect, useRef, useState } from 'react'
import {
  breakSfxCategory,
  demoTracks,
  djSpots,
  emptySteering,
  hasSteering,
  imagingVoice,
  pickCompanionVoice,
  scoreTrackForSteering,
  selectBreakKind,
  sfxCategories,
  shuffleTracks,
  spotBreakDue,
} from './data'
import type {
  BreakKind,
  BreakPlan,
  BreakSegment,
  BreakSpeaker,
  DjProfile,
  ListenerRequest,
  SessionSteering,
  StationContext,
  Track,
  UsageTip,
} from './types'

const silentAudioUrl =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA=='

// The DJ speaks dry; the next song fades in under the final seconds of the
// talk-up, then swells to full volume when the voice ends.
const DUCK_LEVEL = 0.25
const SWELL_MS = 1500
const TALKUP_OVERLAP_S = 5
// Approximate spoken pace used to time the overlap when no voiced audio exists.
const SPOKEN_WORDS_PER_SECOND = 2.6
// Give slow networks the benefit of the doubt when probing tracks.
const PROBE_TIMEOUT_MS = 8000
// If the full break is still pending at a transition, use the short pre-voiced
// liner instead of a synthetic browser-speech fallback.
const BREAK_GRACE_MS = 900
// Transition beds are normalized to this peak, then trimmed so they sit just
// under the DJ instead of jumping out.
const SFX_TARGET_PEAK = 0.7
const SFX_TRIM = 0.6

export type StationMode = 'idle' | 'loading' | 'break' | 'song' | 'paused'

export type BreakEntry = BreakPlan & { id: number; at: string }

type VoiceFx = {
  dry: GainNode
  phone: GainNode
  echo: GainNode
  output: GainNode
  compressor: DynamicsCompressorNode
  presence: BiquadFilterNode
  air: BiquadFilterNode
}

// Gentle soft-clip curve for the voice bus: adds warmth/density (that
// "processed radio" thickness) without audible distortion at low drive.
function makeSaturationCurve(amount: number) {
  const samples = 1024
  const curve = new Float32Array(samples)
  const norm = Math.tanh(amount)
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = Math.tanh(x * amount) / norm
  }
  return curve
}

function artworkDataUrl(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#0a0c11"/><circle cx="256" cy="256" r="200" fill="#15181f"/><circle cx="256" cy="256" r="74" fill="${color}"/><circle cx="256" cy="256" r="12" fill="#0a0c11"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function trackBrief(track?: Track) {
  if (!track) return null
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    year: track.year,
    genre: track.genre?.slice(0, 4),
    mood: track.mood?.slice(0, 4),
    energy: track.energy,
    tempo: track.tempo,
    durationSec: track.durationSec,
    facts: track.metadataConfidence === 'low' ? undefined : track.facts?.slice(0, 2),
    djNotes: track.djNotes,
    requestTags: track.requestTags?.slice(0, 8),
    dayparts: track.dayparts?.slice(0, 4),
    metadataConfidence: track.metadataConfidence,
  }
}

function isSparseMetadataTrack(track?: Track) {
  if (!track) return false
  return (
    track.metadataConfidence === 'low' ||
    !track.genre?.length ||
    !track.mood?.length ||
    (track.requestTags?.length || 0) <= 1
  )
}

function uniqueCandidates(candidates: { index: number; score: number }[]) {
  const seen = new Set<number>()
  return candidates.filter((candidate) => {
    if (seen.has(candidate.index)) return false
    seen.add(candidate.index)
    return true
  })
}

export function useStation(
  dj: DjProfile,
  context: StationContext,
  breakEvery: number,
  listenerRequests: ListenerRequest[] = [],
  onRequestsAired?: (ids: string[]) => void,
  steering: SessionSteering = emptySteering,
) {
  const [tracks, setTracks] = useState<Track[]>(demoTracks)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playCount, setPlayCount] = useState(0)
  const [breakSeq, setBreakSeq] = useState(0)
  const [mode, setMode] = useState<StationMode>('idle')
  const [status, setStatus] = useState('Ready to broadcast')
  const [nowScript, setNowScript] = useState('')
  const [bufferStatus, setBufferStatus] = useState('Next break not loaded')
  const [breakLog, setBreakLog] = useState<BreakEntry[]>([])
  const [progress, setProgress] = useState({ time: 0, duration: 0 })
  const [volume, setVolumeState] = useState(1)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [plannedNextIndex, setPlannedNextIndex] = useState<number | null>(null)

  const songRef = useRef<HTMLAudioElement | null>(null)
  const breakRef = useRef<HTMLAudioElement | null>(null)
  const sfxRef = useRef<HTMLAudioElement | null>(null)
  const sfxManifestRef = useRef<Record<string, string[]> | null>(null)
  const sfxRuntimeCacheRef = useRef<Map<string, Promise<string | null>>>(new Map())
  const sfxLimiterRef = useRef<DynamicsCompressorNode | null>(null)
  const sfxBufferCacheRef = useRef<Map<string, { buffer: AudioBuffer; gain: number } | null>>(
    new Map(),
  )
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserNodeRef = useRef<AnalyserNode | null>(null)
  const fxRef = useRef<VoiceFx | null>(null)
  const stopRef = useRef(false)
  const phaseRef = useRef<StationMode>('idle')
  const tracksRef = useRef(tracks)
  const djRef = useRef(dj)
  const contextRef = useRef(context)
  const listenerRequestsRef = useRef(listenerRequests)
  const onRequestsAiredRef = useRef(onRequestsAired)
  const steeringRef = useRef(steering)
  const indexRef = useRef(0)
  const countRef = useRef(0)
  const breakSeqRef = useRef(0)
  const songsSinceBreakRef = useRef(0)
  const breakEveryRef = useRef(breakEvery)
  const masterRef = useRef(1)
  const duckRef = useRef(1)
  const rampRef = useRef<number | null>(null)
  const recentScriptsRef = useRef<string[]>([])
  const showNotesRef = useRef<string[]>([])
  const recentTrackIdsRef = useRef<string[]>([])
  const recentArtistsRef = useRef<string[]>([])
  const passPlayedRef = useRef<Set<string>>(new Set())
  const preloadRef = useRef<Map<string, Promise<BreakPlan>>>(new Map())
  const standbyLinerRef = useRef<Map<string, Promise<BreakPlan | null>>>(new Map())
  const goodTracksRef = useRef<Set<string>>(new Set())
  const badTracksRef = useRef<Set<string>>(new Set())
  const nextIndexPromiseRef = useRef<Promise<number> | null>(null)
  const lastUsageTipBreakRef = useRef(-12)
  const lastUsageTipIdRef = useRef('')
  const chainRef = useRef<(index: number, count: number, previousIndex?: number) => Promise<void>>(
    async () => undefined,
  )

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    djRef.current = dj
  }, [dj])

  useEffect(() => {
    contextRef.current = context
  }, [context])

  useEffect(() => {
    listenerRequestsRef.current = listenerRequests
  }, [listenerRequests])

  useEffect(() => {
    onRequestsAiredRef.current = onRequestsAired
  }, [onRequestsAired])

  useEffect(() => {
    steeringRef.current = steering
    preloadRef.current.clear()
    nextIndexPromiseRef.current = null
  }, [steering])

  useEffect(() => {
    breakEveryRef.current = Math.max(1, breakEvery)
  }, [breakEvery])

  // Cached breaks were written for the old city; drop them so the next break
  // (including the warmed opener) reflects the new station context.
  useEffect(() => {
    preloadRef.current.clear()
  }, [context.city])

  const selectUsageTip = useCallback((kind: BreakKind): UsageTip | undefined => {
    if (kind !== 'songTalk') return undefined
    const currentBreak = breakSeqRef.current
    if (currentBreak < 4 || currentBreak - lastUsageTipBreakRef.current < 8) return undefined
    const tips: UsageTip[] = [
      {
        id: 'request-line',
        feature: 'requestLine',
        text: 'The request line is open if you want to send one up to the booth.',
      },
      {
        id: 'steering',
        feature: 'steering',
        text: 'If you want the hour warmer, louder, or less of a style, steer the music and I will follow it.',
      },
      {
        id: 'custom-dj',
        feature: 'customDj',
        text: 'You can build your own host anytime, but I am keeping the chair warm.',
      },
    ]
    const preferred = !listenerRequestsRef.current.length
      ? tips[0]
      : hasSteering(steeringRef.current)
        ? tips[1]
        : tips[currentBreak % tips.length]
    if (preferred.id !== lastUsageTipIdRef.current) return preferred
    return tips.find((tip) => tip.id !== lastUsageTipIdRef.current)
  }, [])

  const getSongAudio = useCallback(() => {
    if (!songRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      songRef.current = audio
    }
    return songRef.current
  }, [])

  const getBreakAudio = useCallback(() => {
    if (!breakRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      breakRef.current = audio
    }
    return breakRef.current
  }, [])

  const applyVolumes = useCallback(() => {
    if (songRef.current) {
      songRef.current.volume = Math.min(1, Math.max(0, duckRef.current * masterRef.current))
    }
    if (breakRef.current && !breakRef.current.loop) {
      breakRef.current.volume = masterRef.current
    }
  }, [])

  const setVolume = useCallback(
    (value: number) => {
      masterRef.current = Math.min(1, Math.max(0, value))
      setVolumeState(masterRef.current)
      applyVolumes()
    },
    [applyVolumes],
  )

  const rampDuck = useCallback(
    (target: number, ms: number) => {
      if (rampRef.current) cancelAnimationFrame(rampRef.current)
      // Animation frames do not run with the screen off; jump straight to the
      // target so the song is not stuck quiet until the phone unlocks.
      if (document.hidden) {
        duckRef.current = target
        applyVolumes()
        return
      }
      const from = duckRef.current
      const startedAt = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - startedAt) / ms)
        duckRef.current = from + (target - from) * t
        applyVolumes()
        if (t < 1) rampRef.current = requestAnimationFrame(step)
      }
      rampRef.current = requestAnimationFrame(step)
    },
    [applyVolumes],
  )

  const ensureAudioGraph = useCallback(() => {
    // Route the voice element through Web Audio: a dry path, a phone-line path
    // (band-passed with a presence peak) for callers and remote reporters, and
    // a slap-echo path for station imaging. Voice audio is always a local
    // blob, so piping it through Web Audio is CORS-safe.
    try {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        const ctx = new Ctor()
        const source = ctx.createMediaElementSource(getBreakAudio())
        const node = ctx.createAnalyser()
        node.fftSize = 256
        node.smoothingTimeConstant = 0.8

        const voiceBus = ctx.createGain()
        voiceBus.gain.value = 1

        const dry = ctx.createGain()
        dry.gain.value = 1
        source.connect(dry)
        dry.connect(voiceBus)

        const phoneHp = ctx.createBiquadFilter()
        phoneHp.type = 'highpass'
        phoneHp.frequency.value = 320
        const phoneLp = ctx.createBiquadFilter()
        phoneLp.type = 'lowpass'
        phoneLp.frequency.value = 3200
        const phonePeak = ctx.createBiquadFilter()
        phonePeak.type = 'peaking'
        phonePeak.frequency.value = 1800
        phonePeak.gain.value = 7
        phonePeak.Q.value = 1
        const phone = ctx.createGain()
        phone.gain.value = 0
        source.connect(phoneHp)
        phoneHp.connect(phoneLp)
        phoneLp.connect(phonePeak)
        phonePeak.connect(phone)
        phone.connect(voiceBus)

        const echoDelay = ctx.createDelay(1)
        echoDelay.delayTime.value = 0.17
        const echoFeedback = ctx.createGain()
        echoFeedback.gain.value = 0.36
        const echo = ctx.createGain()
        echo.gain.value = 0
        source.connect(echoDelay)
        echoDelay.connect(echoFeedback)
        echoFeedback.connect(echoDelay)
        echoDelay.connect(echo)
        echo.connect(voiceBus)

        const voiceLowCut = ctx.createBiquadFilter()
        voiceLowCut.type = 'highpass'
        voiceLowCut.frequency.value = 80
        voiceLowCut.Q.value = 0.7

        // Proximity warmth: the close, full-chested low end of a radio voice.
        const warmth = ctx.createBiquadFilter()
        warmth.type = 'lowshelf'
        warmth.frequency.value = 150
        warmth.gain.value = 3.5

        const mudCut = ctx.createBiquadFilter()
        mudCut.type = 'peaking'
        mudCut.frequency.value = 300
        mudCut.gain.value = -2
        mudCut.Q.value = 1

        const presence = ctx.createBiquadFilter()
        presence.type = 'peaking'
        presence.frequency.value = 2900
        presence.gain.value = 3
        presence.Q.value = 0.9

        // De-esser: tame the sibilance/harshness that makes TTS sound brittle.
        const deEss = ctx.createBiquadFilter()
        deEss.type = 'peaking'
        deEss.frequency.value = 6500
        deEss.gain.value = -3
        deEss.Q.value = 2.2

        const air = ctx.createBiquadFilter()
        air.type = 'highshelf'
        air.frequency.value = 10500
        air.gain.value = 2

        // Subtle harmonic saturation for that dense, "produced" radio thickness.
        const saturator = ctx.createWaveShaper()
        saturator.curve = makeSaturationCurve(1.6)
        saturator.oversample = '2x'

        const compressor = ctx.createDynamicsCompressor()
        compressor.threshold.value = -26
        compressor.knee.value = 16
        compressor.ratio.value = 6
        compressor.attack.value = 0.005
        compressor.release.value = 0.18

        const limiter = ctx.createDynamicsCompressor()
        limiter.threshold.value = -4
        limiter.knee.value = 0
        limiter.ratio.value = 18
        limiter.attack.value = 0.002
        limiter.release.value = 0.08

        const output = ctx.createGain()
        output.gain.value = 1

        voiceBus.connect(voiceLowCut)
        voiceLowCut.connect(warmth)
        warmth.connect(mudCut)
        mudCut.connect(presence)
        presence.connect(deEss)
        deEss.connect(air)
        air.connect(saturator)
        saturator.connect(compressor)
        compressor.connect(limiter)
        limiter.connect(output)
        output.connect(node)

        // Sound effects get their own brickwall limiter so a hot bed can never
        // overshoot the DJ; per-bed normalization happens before this node.
        const sfxLimiter = ctx.createDynamicsCompressor()
        sfxLimiter.threshold.value = -3
        sfxLimiter.knee.value = 0
        sfxLimiter.ratio.value = 20
        sfxLimiter.attack.value = 0.002
        sfxLimiter.release.value = 0.12
        sfxLimiter.connect(node)
        sfxLimiterRef.current = sfxLimiter

        node.connect(ctx.destination)
        audioCtxRef.current = ctx
        analyserNodeRef.current = node
        fxRef.current = { dry, phone, echo, output, compressor, presence, air }
        setAnalyser(node)
      }
      audioCtxRef.current.resume().catch(() => undefined)
    } catch {
      // The visualizer and voice effects fall back gracefully.
    }
  }, [getBreakAudio])

  const setVoiceEffect = useCallback((speaker: BreakSpeaker) => {
    const fx = fxRef.current
    if (!fx) return
    if (speaker === 'caller') {
      fx.dry.gain.value = 0
      fx.phone.gain.value = 1.25
      fx.echo.gain.value = 0
      fx.output.gain.value = 0.95
      fx.presence.gain.value = 2.5
      fx.air.gain.value = 0.5
      fx.compressor.threshold.value = -22
      fx.compressor.ratio.value = 4.5
    } else if (speaker === 'reporter') {
      // A lighter "remote line" blend for field reports.
      fx.dry.gain.value = 0.35
      fx.phone.gain.value = 1.1
      fx.echo.gain.value = 0
      fx.output.gain.value = 0.96
      fx.presence.gain.value = 3
      fx.air.gain.value = 1.2
      fx.compressor.threshold.value = -24
      fx.compressor.ratio.value = 5
    } else if (speaker === 'imaging') {
      fx.dry.gain.value = 1.05
      fx.phone.gain.value = 0
      fx.echo.gain.value = 0.5
      fx.output.gain.value = 1
      fx.presence.gain.value = 5
      fx.air.gain.value = 3
      fx.compressor.threshold.value = -30
      fx.compressor.ratio.value = 8
    } else if (speaker === 'spot') {
      // Pre-recorded assets (phone ring, guest recording): play clean and
      // natural with only gentle leveling, no presence/air hyping. Lifted ~20%
      // so the vintage recording sits up with the DJ instead of feeling quiet.
      fx.dry.gain.value = 1
      fx.phone.gain.value = 0
      fx.echo.gain.value = 0
      fx.output.gain.value = 1.18
      fx.presence.gain.value = 1.5
      fx.air.gain.value = 0.5
      fx.compressor.threshold.value = -24
      fx.compressor.ratio.value = 4
    } else {
      fx.dry.gain.value = 1
      fx.phone.gain.value = 0
      fx.echo.gain.value = 0
      fx.output.gain.value = 0.98
      fx.presence.gain.value = 3.5
      fx.air.gain.value = 1.8
      fx.compressor.threshold.value = -25
      fx.compressor.ratio.value = 5.5
    }
  }, [])

  // Transition beds are pre-generated into public/sfx/ and listed in a
  // manifest. Load it once; if it is missing we fall back to runtime
  // generation, then to the synth stinger.
  const loadSfxManifest = useCallback(async () => {
    if (sfxManifestRef.current) return sfxManifestRef.current
    try {
      const response = await fetch('/sfx/manifest.json')
      // A missing manifest may 404 or (under the SPA dev server) return the
      // HTML shell; only parse a real JSON document.
      const isJson = response.ok && response.headers.get('content-type')?.includes('json')
      sfxManifestRef.current = isJson ? ((await response.json()) as Record<string, string[]>) : {}
    } catch {
      sfxManifestRef.current = {}
    }
    return sfxManifestRef.current
  }, [])

  // Fallback only: generate one bed on demand if no pre-generated pool exists.
  const getRuntimeSfx = useCallback((category: string) => {
    const config = sfxCategories[category]
    if (!config) return Promise.resolve(null)
    const cached = sfxRuntimeCacheRef.current.get(category)
    if (cached) return cached
    const promise = (async (): Promise<string | null> => {
      const response = await fetch('/api/sfx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: config.prompts[0], durationSeconds: config.durationSeconds }),
      })
      if (!response.ok || !response.headers.get('content-type')?.includes('audio')) return null
      return URL.createObjectURL(await response.blob())
    })().catch(() => null)
    sfxRuntimeCacheRef.current.set(category, promise)
    return promise
  }, [])

  // Decode a bed once and measure its peak so we can normalize every effect to
  // the same level — ElevenLabs renders vary a lot in loudness.
  const loadSfxBuffer = useCallback(async (url: string) => {
    const ctx = audioCtxRef.current
    if (!ctx) return null
    const cached = sfxBufferCacheRef.current.get(url)
    if (cached !== undefined) return cached
    try {
      const response = await fetch(url)
      if (!response.ok) {
        sfxBufferCacheRef.current.set(url, null)
        return null
      }
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer())
      let peak = 0
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch)
        for (let i = 0; i < data.length; i++) {
          const value = Math.abs(data[i])
          if (value > peak) peak = value
        }
      }
      // Bring each bed to a common target peak; cap the boost so near-silent
      // files don't explode.
      const gain = peak > 0.0001 ? Math.min(SFX_TARGET_PEAK / peak, 4) : 1
      const entry = { buffer, gain }
      sfxBufferCacheRef.current.set(url, entry)
      return entry
    } catch {
      sfxBufferCacheRef.current.set(url, null)
      return null
    }
  }, [])

  const playSfx = useCallback(
    async (category: string) => {
      const manifest = await loadSfxManifest()
      const pool = manifest[category]
      // Prefer a random bed from the pre-generated pool; else generate once.
      const url = pool?.length
        ? pool[Math.floor(Math.random() * pool.length)]
        : await getRuntimeSfx(category)
      if (!url || stopRef.current) return false

      const ctx = audioCtxRef.current
      const limiter = sfxLimiterRef.current
      // Preferred path: decode, peak-normalize, and play through the SFX
      // limiter so the bed sits a notch under the DJ and never spikes.
      if (ctx && limiter) {
        const entry = await loadSfxBuffer(url)
        if (entry && !stopRef.current) {
          ctx.resume().catch(() => undefined)
          return new Promise<boolean>((resolve) => {
            let settled = false
            const done = (ok: boolean) => {
              if (settled) return
              settled = true
              resolve(ok)
            }
            const source = ctx.createBufferSource()
            source.buffer = entry.buffer
            const gain = ctx.createGain()
            gain.gain.value = entry.gain * SFX_TRIM * masterRef.current
            source.connect(gain)
            gain.connect(limiter)
            source.onended = () => done(true)
            source.start()
            window.setTimeout(() => done(true), entry.buffer.duration * 1000 + 400)
          })
        }
      }

      // Fallback: plain element playback at a trimmed volume.
      return new Promise<boolean>((resolve) => {
        if (!sfxRef.current) {
          sfxRef.current = new Audio()
          sfxRef.current.preload = 'auto'
        }
        const audio = sfxRef.current
        let settled = false
        const done = (ok: boolean) => {
          if (settled) return
          settled = true
          resolve(ok)
        }
        audio.onended = () => done(true)
        audio.onerror = () => done(false)
        audio.volume = Math.min(1, masterRef.current * SFX_TRIM)
        audio.src = url
        audio.load()
        audio.play().catch(() => done(false))
        window.setTimeout(() => done(true), 2600)
      })
    },
    [getRuntimeSfx, loadSfxBuffer, loadSfxManifest],
  )

  const playStinger = useCallback(() => {
    // A synthesized whoosh-and-boom under station bumpers.
    const ctx = audioCtxRef.current
    const out = analyserNodeRef.current
    if (!ctx || !out) return
    try {
      const t = ctx.currentTime
      const level = masterRef.current

      const length = Math.floor(ctx.sampleRate * 0.7)
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      const sweep = ctx.createBiquadFilter()
      sweep.type = 'bandpass'
      sweep.Q.value = 1.2
      sweep.frequency.setValueAtTime(3400, t)
      sweep.frequency.exponentialRampToValueAtTime(220, t + 0.62)
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.0001, t)
      noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.5 * level), t + 0.07)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.68)
      noise.connect(sweep)
      sweep.connect(noiseGain)
      noiseGain.connect(out)

      const boom = ctx.createOscillator()
      boom.type = 'sine'
      boom.frequency.setValueAtTime(170, t + 0.08)
      boom.frequency.exponentialRampToValueAtTime(45, t + 0.5)
      const boomGain = ctx.createGain()
      boomGain.gain.setValueAtTime(0.0001, t)
      boomGain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.6 * level), t + 0.12)
      boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.62)
      boom.connect(boomGain)
      boomGain.connect(out)

      noise.start(t)
      noise.stop(t + 0.72)
      boom.start(t)
      boom.stop(t + 0.66)
    } catch {
      // Sweetener only.
    }
  }, [])

  const speakFallback = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        globalThis.setTimeout(resolve, 1200)
        return
      }
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.98
      utterance.pitch = 1
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
    })
  }, [])

  const playAudioUrl = useCallback(
    (url: string, onNearEnd?: () => void) => {
      return new Promise<void>((resolve) => {
        const audio = getBreakAudio()
        // Mobile browsers suspend the Web Audio context on screen lock; wake
        // it up so the voice is audible, not silently routed into a dead graph.
        audioCtxRef.current?.resume().catch(() => undefined)
        audio.onended = () => resolve()
        audio.onerror = () => resolve()
        audio.ontimeupdate = () => {
          const remaining = audio.duration - audio.currentTime
          if (Number.isFinite(remaining) && remaining <= TALKUP_OVERLAP_S) onNearEnd?.()
        }
        audio.loop = false
        audio.volume = masterRef.current
        audio.src = url
        audio.load()
        audio.play().catch(() => resolve())
      })
    },
    [getBreakAudio],
  )

  const playPlanAudio = useCallback(
    async (plan: BreakPlan, onNearEnd: () => void) => {
      const voiced: BreakSegment[] = (plan.segments || []).filter((segment) => segment.audioUrl)
      if (!voiced.length && plan.audioUrl) {
        voiced.push({ speaker: 'dj', text: plan.script, audioUrl: plan.audioUrl })
      }

      // Open the transition with a produced sound effect, whatever voice
      // follows. Prefer a pre-generated ElevenLabs bed; if none is available,
      // bumpers still get the synth stinger so the imaging never falls flat.
      const sfxCategory = breakSfxCategory[plan.kind]
      const playedSfx = sfxCategory ? await playSfx(sfxCategory) : false
      if (!playedSfx && plan.kind === 'bumper') {
        playStinger()
        await new Promise((resolve) => window.setTimeout(resolve, 260))
      }
      if (stopRef.current) return

      if (!voiced.length) {
        const words = plan.script.split(/\s+/).length
        const overlapDelay = Math.max(
          0,
          (words / SPOKEN_WORDS_PER_SECOND - TALKUP_OVERLAP_S) * 1000,
        )
        const overlapTimer = window.setTimeout(onNearEnd, overlapDelay)
        await speakFallback(plan.script)
        window.clearTimeout(overlapTimer)
        return
      }

      for (let i = 0; i < voiced.length; i++) {
        if (stopRef.current) break
        setVoiceEffect(voiced[i].speaker)
        const isLast = i === voiced.length - 1
        await playAudioUrl(voiced[i].audioUrl as string, isLast ? onNearEnd : undefined)
      }
      setVoiceEffect('dj')
    },
    [playAudioUrl, playSfx, playStinger, setVoiceEffect, speakFallback],
  )

  const hasVoicedAudio = useCallback((plan: BreakPlan) => {
    return Boolean(plan.audioUrl || plan.segments?.some((segment) => segment.audioUrl))
  }, [])

  const requestStandbyLiner = useCallback(() => {
    const activeDj = djRef.current
    const key = `${activeDj.id}:${activeDj.voice}:${activeDj.style}:${activeDj.callsign || ''}`
    const existing = standbyLinerRef.current.get(key)
    if (existing) return existing

    const station = activeDj.callsign || activeDj.stationName || 'Airbreak'
    const text = `You're listening to ${activeDj.name} on ${station}. Keep listening.`
    const promise = (async (): Promise<BreakPlan | null> => {
      const voiceResponse = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: activeDj.voice,
          speaker: 'dj',
          style: activeDj.style,
        }),
      })
      if (!voiceResponse.ok || !voiceResponse.headers.get('content-type')?.includes('audio')) {
        return null
      }
      const blob = await voiceResponse.blob()
      const audioUrl = URL.createObjectURL(blob)
      return {
        kind: 'bumper',
        title: 'Standby liner',
        source: 'fallback',
        tease: 'Keep listening',
        script: text,
        segments: [{ speaker: 'dj', text, audioUrl }],
      }
    })().catch(() => null)

    standbyLinerRef.current.set(key, promise)
    if (standbyLinerRef.current.size > 4) {
      const oldest = standbyLinerRef.current.keys().next().value
      if (oldest) standbyLinerRef.current.delete(oldest)
    }
    return promise
  }, [])

  const probeTrack = useCallback((track: Track) => {
    if (goodTracksRef.current.has(track.id)) return Promise.resolve(true)
    if (badTracksRef.current.has(track.id)) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const probe = new Audio()
      probe.preload = 'metadata'
      let settled = false
      const finish = (ok: boolean, remember: boolean) => {
        if (settled) return
        settled = true
        probe.onloadedmetadata = null
        probe.onerror = null
        probe.removeAttribute('src')
        if (remember) {
          if (ok) goodTracksRef.current.add(track.id)
          else badTracksRef.current.add(track.id)
        }
        resolve(ok)
      }
      const timer = window.setTimeout(() => finish(true, false), PROBE_TIMEOUT_MS)
      probe.onloadedmetadata = () => {
        window.clearTimeout(timer)
        finish(true, true)
      }
      probe.onerror = () => {
        window.clearTimeout(timer)
        finish(false, true)
      }
      probe.src = track.url
      probe.load()
    })
  }, [])

  const findPlayableIndex = useCallback(
    async (from: number, excluded = new Set<number>()) => {
      const activeTracks = tracksRef.current
      if (!hasSteering(steeringRef.current)) {
        for (let step = 0; step < activeTracks.length; step++) {
          const index = (from + step) % activeTracks.length
          if (excluded.has(index)) continue
          const track = activeTracks[index]
          if (!track) break
          if (await probeTrack(track)) return index
        }
        return from
      }

      const candidates: { index: number; score: number }[] = []
      const blocked: { index: number; score: number }[] = []
      for (let step = 0; step < activeTracks.length; step++) {
        const index = (from + step) % activeTracks.length
        if (excluded.has(index)) continue
        const track = activeTracks[index]
        if (!track) break
        const score = scoreTrackForSteering(
          track,
          steeringRef.current,
          recentTrackIdsRef.current,
          recentArtistsRef.current,
        )
        if (score <= -900) blocked.push({ index, score })
        else candidates.push({ index, score })
      }

      const rotationCandidates = [...candidates]
      const sparseCandidates = rotationCandidates.filter((candidate) =>
        isSparseMetadataTrack(activeTracks[candidate.index]),
      )
      candidates.sort((a, b) => b.score - a.score)
      const explorationTurn = countRef.current > 0 && countRef.current % 5 === 0
      const probeCandidates = uniqueCandidates(
        explorationTurn
          ? [
              ...sparseCandidates.slice(0, 8),
              ...rotationCandidates.slice(0, 8),
              ...candidates.slice(0, 18),
            ]
          : [
              ...candidates.slice(0, 20),
              ...sparseCandidates.slice(0, 6),
              ...rotationCandidates.slice(0, 6),
            ],
      )

      for (const candidate of probeCandidates) {
        const track = activeTracks[candidate.index]
        if (track && (await probeTrack(track))) return candidate.index
      }

      // If all preferred candidates are unavailable, keep the station moving
      // with the normal rotation before relaxing explicit avoid rules.
      for (let step = 0; step < activeTracks.length; step++) {
        const index = (from + step) % activeTracks.length
        if (excluded.has(index) || blocked.some((candidate) => candidate.index === index)) continue
        const track = activeTracks[index]
        if (track && (await probeTrack(track))) return index
      }

      blocked.sort((a, b) => b.score - a.score)
      for (const candidate of blocked.slice(0, 8)) {
        const track = activeTracks[candidate.index]
        if (track && (await probeTrack(track))) return candidate.index
      }
      return from
    },
    [probeTrack],
  )

  const findPlayableSequence = useCallback(
    async (from: number, count: number) => {
      const activeTracks = tracksRef.current
      if (!activeTracks.length || count <= 0) return []
      const sequence: number[] = []
      const excluded = new Set<number>()
      let cursor = from
      const maxAttempts = Math.max(activeTracks.length * count, count)
      for (let attempt = 0; attempt < maxAttempts && sequence.length < count; attempt++) {
        const index = await findPlayableIndex(cursor % activeTracks.length, excluded)
        sequence.push(index)
        excluded.add(index)
        cursor = (index + 1) % activeTracks.length
      }
      return sequence
    },
    [findPlayableIndex],
  )

  const makeBackupBreak = useCallback(
    (index: number, kind: BreakKind, previousIndex?: number): BreakPlan => {
      const activeDj = djRef.current
      const city = contextRef.current.city || activeDj.city
      const stationName = activeDj.stationName || 'Airbreak'
      const previousTrack =
        typeof previousIndex === 'number' ? tracksRef.current[previousIndex] : undefined
      const nextTrack = tracksRef.current[index]
      const nextTitle = nextTrack?.title || 'another cut'
      const previousTitle = previousTrack?.title || 'the last track'
      const scripts: Record<BreakKind, string> = {
        intro: `${activeDj.name} on ${stationName}, live from ${city}. We are starting with ${nextTitle}. Stay close.`,
        songTalk: previousTrack
          ? `${activeDj.name} here. That was ${previousTitle}, and up next we have ${nextTitle} on a ${contextRef.current.weather.toLowerCase()} day in ${city}.`
          : `${activeDj.name} here. Up next we have ${nextTitle} on a ${contextRef.current.weather.toLowerCase()} day in ${city}.`,
        newsWeather: `Quick check-in from ${city}: ${contextRef.current.weather}. ${contextRef.current.headlines[0] || 'More music straight ahead.'} Now back to it with ${nextTitle}.`,
        commercial: `This hour of ${stationName} comes courtesy of Needle Drop Coffee, keeping the control room awake since forever. Back to the music with ${nextTitle}.`,
        bumper: `${activeDj.callsign || 'Airbreak'}. ${activeDj.name}. ${city}. More music right now.`,
        caller: `Just had a listener on the line asking for ${nextTitle} - you got it. This one is for you.`,
      }
      const script = scripts[kind] || scripts.songTalk
      return {
        kind,
        title: 'Live backup break',
        source: 'fallback',
        tease: `Next: ${nextTitle}`,
        script,
        segments: [{ speaker: kind === 'bumper' ? 'imaging' : 'dj', text: script }],
      }
    },
    [],
  )

  // Resolve the kind for the break at the current sequence number. For a DJ
  // with a produced spot, force its commercial onto the spot cadence and
  // suppress the rotation's other commercials so the spot is the only ad.
  const resolveKind = useCallback((): BreakKind => {
    const seq = breakSeqRef.current
    const hasSpot = Boolean(djSpots[djRef.current.id]?.length)
    if (hasSpot && spotBreakDue(seq)) return 'commercial'
    const base = selectBreakKind(seq)
    if (hasSpot && base === 'commercial') return 'songTalk'
    return base
  }, [])

  const requestBreak = useCallback((index: number, kind: BreakKind, previousIndex?: number) => {
    const activeTracks = tracksRef.current
    const nextTrack = activeTracks[index]
    const previousTrack = typeof previousIndex === 'number' ? activeTracks[previousIndex] : undefined
    const queuedAfter = activeTracks[(index + 1) % activeTracks.length]
    const queuedRequests = listenerRequestsRef.current.slice(0, 3)
    const requestKey = queuedRequests.map((request) => request.id).join(',') || 'no-requests'
    const usageTip = selectUsageTip(kind)
    const steeringKey = JSON.stringify({
      targetMoods: steeringRef.current.targetMoods,
      targetGenres: steeringRef.current.targetGenres,
      avoidGenres: steeringRef.current.avoidGenres,
      avoidMoods: steeringRef.current.avoidMoods,
      avoidArtists: steeringRef.current.avoidArtists,
      tempos: steeringRef.current.tempos,
      dayparts: steeringRef.current.dayparts,
      energyRange: steeringRef.current.energyRange,
    })
    const key = [
      index,
      kind,
      previousTrack?.id || 'no-prev',
      nextTrack?.id || 'empty',
      queuedAfter?.id || 'no-after',
      requestKey,
      usageTip?.id || 'no-tip',
      steeringKey,
      djRef.current.id,
    ].join(':')
    const existing = preloadRef.current.get(key)
    if (existing) return existing

    // A produced spot (e.g. Johnny London's Blue Ribbon Pontiac ad) replaces
    // the AI commercial on its scheduled cadence: host lines are still voiced
    // live, but the ring and the guest recording are fixed assets.
    const spots =
      kind === 'commercial' && spotBreakDue(breakSeqRef.current)
        ? djSpots[djRef.current.id]
        : undefined
    const spot = spots?.length ? spots[Math.floor(Math.random() * spots.length)] : undefined

    const promise = (async (): Promise<BreakPlan> => {
      setBufferStatus('Writing the next break')
      const activeDj = djRef.current
      let plan: BreakPlan
      let segments: BreakSegment[]

      if (spot) {
        segments = spot.parts.map((part) =>
          part.speaker === 'spot'
            ? { speaker: 'spot', text: '', audioUrl: part.audioUrl }
            : { speaker: 'dj', text: part.texts[Math.floor(Math.random() * part.texts.length)] },
        )
        plan = {
          kind: 'commercial',
          title: spot.title,
          source: 'fallback',
          tease: spot.title,
          script: segments.map((segment) => segment.text).filter(Boolean).join(' '),
          segments,
        }
        setBufferStatus('Cueing the spot')
      } else {
        const breakResponse = await fetch('/api/dj-break', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dj: djRef.current,
            context: contextRef.current,
            kind,
            previousTrack: trackBrief(previousTrack),
            nextTrack: trackBrief(nextTrack),
            queue: activeTracks.slice(index, index + 6).map(trackBrief).filter(Boolean),
            listenerRequests: queuedRequests,
            steering: steeringRef.current,
            usageTip,
            recentScripts: recentScriptsRef.current,
            showNotes: showNotesRef.current,
          }),
        })
        plan = (await breakResponse.json()) as BreakPlan
        plan.usageTipId = usageTip?.id
        segments = plan.segments?.length ? plan.segments : [{ speaker: 'dj', text: plan.script }]
      }
      setBufferStatus('Recording the voice takes')

      const callerVoice = pickCompanionVoice(activeDj.voice, key)
      const reporterVoice = pickCompanionVoice([activeDj.voice, callerVoice], `${key}:reporter`)

      await Promise.all(
        segments.map(async (segment) => {
          if (segment.audioUrl) {
            // Pre-recorded assets (ring, guest spot) point at a static file.
            // Preload them into an in-memory blob so playback at the transition
            // can't lose a network race and get silently skipped.
            if (segment.speaker === 'spot' && !segment.audioUrl.startsWith('blob:')) {
              try {
                const assetResponse = await fetch(segment.audioUrl)
                if (assetResponse.ok) {
                  segment.audioUrl = URL.createObjectURL(await assetResponse.blob())
                }
              } catch {
                // Keep the static URL as a fallback.
              }
            }
            return
          }
          const voice =
            segment.speaker === 'caller'
              ? callerVoice
              : segment.speaker === 'reporter'
                ? reporterVoice
                : segment.speaker === 'imaging'
                  ? imagingVoice(activeDj.voice)
                  : activeDj.voice
          const voiceResponse = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: segment.text,
              voice,
              speaker: segment.speaker,
              style: segment.speaker === 'dj' || segment.speaker === 'imaging' ? activeDj.style : undefined,
            }),
          })
          if (voiceResponse.ok && voiceResponse.headers.get('content-type')?.includes('audio')) {
            const blob = await voiceResponse.blob()
            segment.audioUrl = URL.createObjectURL(blob)
          }
        }),
      ).catch(() => undefined)

      plan.segments = segments
      setBufferStatus('Next break is loaded')
      return plan
    })().catch((): BreakPlan => {
      const fallback = makeBackupBreak(index, kind, previousIndex)
      setBufferStatus('Loaded an offline break')
      return fallback
    })

    preloadRef.current.set(key, promise)
    if (preloadRef.current.size > 10) {
      const oldest = preloadRef.current.keys().next().value
      if (oldest) preloadRef.current.delete(oldest)
    }
    return promise
  }, [makeBackupBreak, selectUsageTip])

  useEffect(() => {
    if (!tracksRef.current.length) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const fromIndex = indexRef.current
        const nextIndex = await findPlayableIndex(
          (fromIndex + 1) % Math.max(1, tracksRef.current.length),
        )
        if (cancelled) return
        setPlannedNextIndex(nextIndex)
        nextIndexPromiseRef.current = Promise.resolve(nextIndex)
        if (phaseRef.current === 'song') {
          requestBreak(nextIndex, resolveKind(), fromIndex)
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [findPlayableIndex, requestBreak, resolveKind, steering])

  const requestBreakForAir = useCallback(
    async (index: number, kind: BreakKind, previousIndex?: number) => {
      const breakPromise = requestBreak(index, kind, previousIndex)
      const standbyPromise = requestStandbyLiner()
      let fallbackTimer: number | undefined
      const gracePromise = new Promise<'grace'>((resolve) => {
        fallbackTimer = window.setTimeout(() => {
          resolve('grace')
        }, BREAK_GRACE_MS)
      })

      const result = await Promise.race([breakPromise, gracePromise])
      if (fallbackTimer) window.clearTimeout(fallbackTimer)

      if (result !== 'grace') {
        if (hasVoicedAudio(result)) return result
        const standby = await standbyPromise
        return standby || result
      }

      const backupResult = await Promise.race([
        standbyPromise.then((plan) => ({ type: 'standby' as const, plan })),
        breakPromise.then((plan) => ({ type: 'break' as const, plan })),
      ])

      if (backupResult.type === 'standby' && backupResult.plan) {
        setBufferStatus('Using the standby liner')
        breakPromise.catch(() => undefined)
        return backupResult.plan
      }

      if (backupResult.type === 'break') return backupResult.plan

      setBufferStatus('Waiting for the voiced break')
      const plan = await breakPromise
      breakPromise.catch(() => undefined)
      return plan
    },
    [hasVoicedAudio, requestBreak, requestStandbyLiner],
  )

  // While a song plays, verify the next track is playable and, when the next
  // scheduled transition includes a break, write and voice it as early as we can.
  const prepareNext = useCallback(
    (index: number) => {
      const promise = (async () => {
        const length = Math.max(1, tracksRef.current.length)
        return findPlayableIndex((index + 1) % length)
      })()
      promise.catch(() => undefined)
      nextIndexPromiseRef.current = promise
      promise.then((nextIndex) => setPlannedNextIndex(nextIndex)).catch(() => undefined)

      void (async () => {
        const nextIndex = await promise
        const songsUntilBreak = Math.max(0, breakEveryRef.current - songsSinceBreakRef.current)
        const breakKind = resolveKind()
        if (songsUntilBreak === 0) {
          requestBreak(nextIndex, resolveKind(), index)
          return
        }

        const sequence = await findPlayableSequence(nextIndex, songsUntilBreak + 1)
        const previousBreakIndex = sequence[songsUntilBreak - 1]
        const nextBreakIndex = sequence[songsUntilBreak]
        if (typeof previousBreakIndex === 'number' && typeof nextBreakIndex === 'number') {
          requestBreak(nextBreakIndex, breakKind, previousBreakIndex)
        }
      })()
    },
    [findPlayableIndex, findPlayableSequence, requestBreak, resolveKind],
  )

  const updateMediaSession = useCallback((track: Track) => {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: `${djRef.current.stationName || 'Airbreak'} · ${djRef.current.name}`,
        artwork: [
          { src: artworkDataUrl(djRef.current.color), sizes: '512x512', type: 'image/svg+xml' },
        ],
      })
    } catch {
      // Metadata is a nice-to-have.
    }
  }, [])

  const advanceRef = useRef<(fromIndex: number, prevCount: number) => void>(() => undefined)

  const beginSong = useCallback(
    (index: number, count: number, duck = DUCK_LEVEL) => {
      const audio = getSongAudio()
      const track = tracksRef.current[index]
      if (!track) return
      audio.onended = () => {
        if (stopRef.current) return
        advanceRef.current(index, count)
      }
      audio.onerror = () => {
        if (stopRef.current) return
        if (track.id) badTracksRef.current.add(track.id)
        advanceRef.current(index, count)
      }
      audio.ontimeupdate = () => {
        setProgress({
          time: audio.currentTime,
          duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        })
      }
      audio.loop = false
      duckRef.current = duck
      applyVolumes()
      if (audio.currentSrc !== track.url) {
        audio.src = track.url
        audio.load()
      }
      try {
        audio.currentTime = 0
      } catch {
        // Some remote files cannot seek until metadata is available.
      }
      recentTrackIdsRef.current = [
        track.id,
        ...recentTrackIdsRef.current.filter((id) => id !== track.id),
      ].slice(0, 12)
      const artist = (track.artist || '').trim().toLowerCase()
      if (artist) {
        recentArtistsRef.current = [
          artist,
          ...recentArtistsRef.current.filter((name) => name !== artist),
        ].slice(0, 8)
      }
      updateMediaSession(track)
      audio.play().catch(() => {
        setStatus('Tap play to enable audio')
      })
      try {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
      } catch {
        // Optional hint for lock-screen controls.
      }
    },
    [applyVolumes, getSongAudio, updateMediaSession],
  )

  const segueToSong = useCallback(
    (index: number, count: number) => {
      phaseRef.current = 'song'
      setMode('song')
      setStatus('On air')
      indexRef.current = index
      setCurrentIndex(index)
      setProgress({ time: 0, duration: 0 })
      beginSong(index, count, 1)
      prepareNext(index)
    },
    [beginSong, prepareNext],
  )

  const playBreakThenSong = useCallback(
    async (index: number, count: number, previousIndex?: number) => {
      const activeTracks = tracksRef.current
      if (!activeTracks.length || stopRef.current) return

      const breakKind = resolveKind()
      phaseRef.current = 'loading'
      setMode('loading')
      setStatus('Cueing the mic')
      const breakPlan = await requestBreakForAir(index, breakKind, previousIndex)
      if (stopRef.current) return
      if (breakPlan.title !== 'Standby liner') {
        const airedRequestIds = listenerRequestsRef.current.slice(0, 3).map((request) => request.id)
        if (airedRequestIds.length) onRequestsAiredRef.current?.(airedRequestIds)
        if (breakPlan.usageTipId) {
          lastUsageTipBreakRef.current = breakSeqRef.current
          lastUsageTipIdRef.current = breakPlan.usageTipId
        }
      }

      phaseRef.current = 'break'
      setMode('break')
      setStatus('On the mic')
      setNowScript(breakPlan.script)
      recentScriptsRef.current = [...recentScriptsRef.current, breakPlan.script].slice(-3)
      if (breakPlan.showNote?.trim()) {
        showNotesRef.current = [...showNotesRef.current, breakPlan.showNote.trim()].slice(-8)
      }
      breakSeqRef.current += 1
      setBreakSeq(breakSeqRef.current)
      setBreakLog((prev) =>
        [
          {
            ...breakPlan,
            id: Date.now(),
            at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          },
          ...prev,
        ].slice(0, 12),
      )
      indexRef.current = index
      setCurrentIndex(index)
      setProgress({ time: 0, duration: 0 })

      // The DJ speaks dry; the song fades in under the last seconds of the talk.
      let songStarted = false
      const startSongUnder = () => {
        if (songStarted || stopRef.current) return
        songStarted = true
        songsSinceBreakRef.current = 1
        beginSong(index, count)
        prepareNext(index)
      }

      // Keep the song element rolling on a silent loop through the dry voice.
      // If it ever fully stops, mobile browsers tear down background playback
      // and reject the next play() once the screen is locked.
      const bed = getSongAudio()
      bed.onended = null
      bed.onerror = null
      bed.loop = true
      bed.volume = 0
      if (bed.currentSrc !== silentAudioUrl) {
        bed.src = silentAudioUrl
        bed.load()
      }
      bed.play().catch(() => undefined)

      await playPlanAudio(breakPlan, startSongUnder)
      if (stopRef.current) return

      startSongUnder()
      phaseRef.current = 'song'
      setMode('song')
      setStatus('On air')
      rampDuck(1, SWELL_MS)
    },
    [beginSong, getSongAudio, playPlanAudio, prepareNext, rampDuck, requestBreakForAir, resolveKind],
  )

  useEffect(() => {
    chainRef.current = playBreakThenSong
  }, [playBreakThenSong])

  const advance = useCallback(
    async (fromIndex: number, prevCount: number) => {
      if (stopRef.current) return
      const nextCount = prevCount + 1
      countRef.current = nextCount
      setPlayCount(nextCount)

      // Track coverage for this pass. Once every playable song has aired,
      // reshuffle so the next pass through the library plays in a fresh order.
      const finishedTrack = tracksRef.current[fromIndex]
      if (finishedTrack?.id) passPlayedRef.current.add(finishedTrack.id)
      const playable = Math.max(1, tracksRef.current.length - badTracksRef.current.size)
      let reshuffled = false
      if (tracksRef.current.length > 2 && passPlayedRef.current.size >= playable) {
        const newOrder = shuffleTracks(tracksRef.current)
        tracksRef.current = newOrder
        setTracks(newOrder)
        preloadRef.current.clear()
        nextIndexPromiseRef.current = null
        passPlayedRef.current.clear()
        reshuffled = true
      }

      const pending = reshuffled ? null : nextIndexPromiseRef.current
      nextIndexPromiseRef.current = null
      let nextIndex: number
      if (pending) {
        nextIndex = await pending
      } else if (reshuffled) {
        // Avoid replaying the song that just finished as the first of the
        // new pass.
        const excluded = new Set<number>()
        const justPlayed = tracksRef.current.findIndex((track) => track.id === finishedTrack?.id)
        if (justPlayed >= 0) excluded.add(justPlayed)
        nextIndex = await findPlayableIndex(0, excluded)
      } else {
        nextIndex = await findPlayableIndex((fromIndex + 1) % Math.max(1, tracksRef.current.length))
      }
      if (stopRef.current) return
      if (songsSinceBreakRef.current >= breakEveryRef.current) {
        chainRef.current(nextIndex, nextCount, fromIndex)
      } else {
        songsSinceBreakRef.current += 1
        segueToSong(nextIndex, nextCount)
      }
    },
    [findPlayableIndex, segueToSong],
  )

  useEffect(() => {
    advanceRef.current = advance
  }, [advance])

  useEffect(() => {
    if (!listenerRequests.length || phaseRef.current !== 'song' || !tracksRef.current.length) return
    const timer = window.setTimeout(() => {
      void (async () => {
        const fromIndex = indexRef.current
        const nextIndex =
          nextIndexPromiseRef.current ||
          findPlayableIndex((fromIndex + 1) % Math.max(1, tracksRef.current.length))
        const resolvedIndex = await nextIndex
        requestBreak(resolvedIndex, resolveKind(), fromIndex)
      })()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [findPlayableIndex, listenerRequests, requestBreak, resolveKind])

  // Self-healing watchdog: mobile browsers reject play() or stall streams
  // after interruptions (screen lock, phone calls, flaky cell data). Retry
  // paused audio that should be playing, and skip tracks that stop advancing.
  const stallRef = useRef({ time: 0, at: 0 })
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (stopRef.current) return
      const phase = phaseRef.current
      if (phase !== 'song' && phase !== 'break') return
      audioCtxRef.current?.resume().catch(() => undefined)
      if (phase === 'song') {
        const audio = songRef.current
        if (!audio?.src) return
        if (audio.paused && !audio.ended) {
          audio.play().catch(() => undefined)
          return
        }
        const now = Date.now()
        if (Math.abs(audio.currentTime - stallRef.current.time) > 0.5) {
          stallRef.current = { time: audio.currentTime, at: now }
        } else if (stallRef.current.at && now - stallRef.current.at > 45000) {
          // The stream has been frozen for 45 seconds; move the show along.
          stallRef.current = { time: 0, at: 0 }
          if (tracksRef.current[indexRef.current]?.id) {
            badTracksRef.current.add(tracksRef.current[indexRef.current].id)
          }
          advanceRef.current(indexRef.current, countRef.current)
        }
      } else {
        const audio = breakRef.current
        if (audio?.src && audio.paused && !audio.ended && !window.speechSynthesis?.speaking) {
          audio.play().catch(() => undefined)
        }
      }
    }, 4000)
    return () => window.clearInterval(interval)
  }, [])

  // When the app comes back to the foreground, wake the audio graph and
  // restart anything an interruption left paused.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden || stopRef.current) return
      audioCtxRef.current?.resume().catch(() => undefined)
      const phase = phaseRef.current
      if (phase === 'song') {
        const audio = songRef.current
        if (audio?.src && audio.paused && !audio.ended) audio.play().catch(() => undefined)
      } else if (phase === 'break') {
        const audio = breakRef.current
        if (audio?.src && audio.paused && !audio.ended && !window.speechSynthesis?.speaking) {
          audio.play().catch(() => undefined)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Keep a short, real-voice station liner ready as the emergency on-air bridge.
  useEffect(() => {
    if (mode !== 'idle') return
    requestStandbyLiner()
  }, [mode, dj.id, requestStandbyLiner])

  // Warm the opening break (script + voice) while the station is idle so
  // pressing Start goes straight to air with no dead time. Re-warms when the
  // DJ, library, or station context changes; the cache dedupes repeats.
  useEffect(() => {
    if (mode !== 'idle' || !tracks.length) return
    const timer = window.setTimeout(
      () => {
        requestBreak(indexRef.current, resolveKind())
      },
      context.generatedAt ? 300 : 4000,
    )
    return () => window.clearTimeout(timer)
  }, [mode, tracks, currentIndex, dj.id, context.generatedAt, requestBreak, resolveKind])

  const start = useCallback(() => {
    if (!tracksRef.current.length) {
      setStatus('Add music first')
      return
    }
    ensureAudioGraph()
    requestStandbyLiner()
    // Load the transition-bed manifest so the first produced break is instant.
    void loadSfxManifest()
    // Unlock the SFX element inside the user gesture for mobile autoplay.
    if (!sfxRef.current) {
      sfxRef.current = new Audio()
      sfxRef.current.preload = 'auto'
    }
    sfxRef.current.src = silentAudioUrl
    sfxRef.current.play().catch(() => undefined)
    // Prime both elements inside the user gesture so later src swaps autoplay.
    const breakAudio = getBreakAudio()
    breakAudio.loop = true
    breakAudio.volume = 0
    breakAudio.src = silentAudioUrl
    breakAudio.play().catch(() => undefined)
    const songAudio = getSongAudio()
    const track = tracksRef.current[indexRef.current]
    if (track) {
      songAudio.loop = true
      songAudio.volume = 0
      songAudio.src = track.url
      songAudio.play().catch(() => undefined)
    }
    stopRef.current = false
    setBufferStatus('Writing the opening break')
    countRef.current = 0
    setPlayCount(0)
    breakSeqRef.current = 0
    setBreakSeq(0)
    songsSinceBreakRef.current = 0
    recentScriptsRef.current = []
    showNotesRef.current = []
    passPlayedRef.current.clear()
    void (async () => {
      const startIndex = await findPlayableIndex(indexRef.current)
      if (stopRef.current) return
      indexRef.current = startIndex
      setCurrentIndex(startIndex)
      playBreakThenSong(startIndex, 0)
    })()
  }, [
    ensureAudioGraph,
    findPlayableIndex,
    getBreakAudio,
    getSongAudio,
    loadSfxManifest,
    playBreakThenSong,
    requestStandbyLiner,
  ])

  const pause = useCallback(() => {
    stopRef.current = true
    if (rampRef.current) cancelAnimationFrame(rampRef.current)
    window.speechSynthesis?.cancel()
    breakRef.current?.pause()
    songRef.current?.pause()
    setMode('paused')
    setStatus('Paused')
    try {
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
    } catch {
      // Optional hint for lock-screen controls.
    }
  }, [])

  const resume = useCallback(() => {
    stopRef.current = false
    ensureAudioGraph()
    const audio = songRef.current
    if (phaseRef.current === 'song' && audio?.src) {
      duckRef.current = 1
      applyVolumes()
      audio.play().catch(() => undefined)
      setMode('song')
      setStatus('On air')
      return
    }
    playBreakThenSong(indexRef.current, countRef.current)
  }, [applyVolumes, ensureAudioGraph, playBreakThenSong])

  const skip = useCallback(() => {
    if (!tracksRef.current.length) return
    const previousIndex = phaseRef.current === 'song' ? indexRef.current : undefined
    stopRef.current = true
    if (rampRef.current) cancelAnimationFrame(rampRef.current)
    window.speechSynthesis?.cancel()
    breakRef.current?.pause()
    songRef.current?.pause()
    const nextCount = countRef.current + 1
    countRef.current = nextCount
    setPlayCount(nextCount)
    stopRef.current = false
    void (async () => {
      const nextIndex = await findPlayableIndex(
        (indexRef.current + 1) % Math.max(1, tracksRef.current.length),
      )
      if (stopRef.current) return
      playBreakThenSong(nextIndex, nextCount, previousIndex)
    })()
  }, [findPlayableIndex, playBreakThenSong])

  const playTrack = useCallback(
    (index: number) => {
      indexRef.current = index
      setCurrentIndex(index)
      if (phaseRef.current === 'idle' || mode === 'idle' || mode === 'paused') {
        // Just cue the track; resume/start will pick it up from the top.
        phaseRef.current = 'idle'
        return
      }
      const previousIndex = phaseRef.current === 'song' ? indexRef.current : undefined
      stopRef.current = true
      if (rampRef.current) cancelAnimationFrame(rampRef.current)
      window.speechSynthesis?.cancel()
      breakRef.current?.pause()
      songRef.current?.pause()
      const nextCount = countRef.current + 1
      countRef.current = nextCount
      setPlayCount(nextCount)
      stopRef.current = false
      playBreakThenSong(index, nextCount, previousIndex)
    },
    [mode, playBreakThenSong],
  )

  const seek = useCallback((time: number) => {
    const audio = songRef.current
    if (!audio || !Number.isFinite(time)) return
    try {
      audio.currentTime = time
    } catch {
      // Stream may not be seekable yet.
    }
  }, [])

  const setLibrary = useCallback((next: Track[]) => {
    stopRef.current = true
    if (rampRef.current) cancelAnimationFrame(rampRef.current)
    window.speechSynthesis?.cancel()
    breakRef.current?.pause()
    songRef.current?.pause()
    preloadRef.current.clear()
    goodTracksRef.current.clear()
    badTracksRef.current.clear()
    passPlayedRef.current.clear()
    nextIndexPromiseRef.current = null
    breakSeqRef.current = 0
    setBreakSeq(0)
    songsSinceBreakRef.current = 0
    phaseRef.current = 'idle'
    setMode('idle')
    setStatus('Ready to broadcast')
    setTracks(next)
    indexRef.current = 0
    setCurrentIndex(0)
    setPlannedNextIndex(next.length > 1 ? 1 : null)
    setProgress({ time: 0, duration: 0 })
  }, [])

  const pauseRef = useRef(pause)
  const resumeRef = useRef(resume)
  const skipRef = useRef(skip)
  useEffect(() => {
    pauseRef.current = pause
    resumeRef.current = resume
    skipRef.current = skip
  }, [pause, resume, skip])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    try {
      session.setActionHandler('play', () => resumeRef.current())
      session.setActionHandler('pause', () => pauseRef.current())
      session.setActionHandler('nexttrack', () => skipRef.current())
    } catch {
      return
    }
    return () => {
      try {
        session.setActionHandler('play', null)
        session.setActionHandler('pause', null)
        session.setActionHandler('nexttrack', null)
      } catch {
        // Ignore teardown failures.
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      stopRef.current = true
      if (rampRef.current) cancelAnimationFrame(rampRef.current)
      window.speechSynthesis?.cancel()
      breakRef.current?.pause()
      songRef.current?.pause()
      audioCtxRef.current?.close().catch(() => undefined)
    }
  }, [])

  const isOnAir = mode === 'break' || mode === 'song' || mode === 'loading'

  return {
    tracks,
    setLibrary,
    currentIndex,
    currentTrack: tracks[currentIndex] as Track | undefined,
    nextTrack:
      plannedNextIndex !== null
        ? (tracks[plannedNextIndex] as Track | undefined)
        : tracks.length
          ? tracks[(currentIndex + 1) % tracks.length]
          : undefined,
    mode,
    status,
    isOnAir,
    nowScript,
    bufferStatus,
    breakLog,
    playCount,
    breakSeq,
    progress,
    volume,
    setVolume,
    analyser,
    start,
    pause,
    resume,
    skip,
    playTrack,
    seek,
  }
}
