import { useCallback, useEffect, useRef, useState } from 'react'
import { demoTracks, imagingVoice, pickCompanionVoice, selectBreakKind } from './data'
import type {
  BreakKind,
  BreakPlan,
  BreakSegment,
  BreakSpeaker,
  DjProfile,
  StationContext,
  Track,
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

export type StationMode = 'idle' | 'loading' | 'break' | 'song' | 'paused'

export type BreakEntry = BreakPlan & { id: number; at: string }

type VoiceFx = {
  dry: GainNode
  phone: GainNode
  echo: GainNode
}

function artworkDataUrl(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#0a0c11"/><circle cx="256" cy="256" r="200" fill="#15181f"/><circle cx="256" cy="256" r="74" fill="${color}"/><circle cx="256" cy="256" r="12" fill="#0a0c11"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function useStation(dj: DjProfile, context: StationContext, breakEvery: number) {
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

  const songRef = useRef<HTMLAudioElement | null>(null)
  const breakRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserNodeRef = useRef<AnalyserNode | null>(null)
  const fxRef = useRef<VoiceFx | null>(null)
  const stopRef = useRef(false)
  const phaseRef = useRef<StationMode>('idle')
  const tracksRef = useRef(tracks)
  const djRef = useRef(dj)
  const contextRef = useRef(context)
  const indexRef = useRef(0)
  const countRef = useRef(0)
  const breakSeqRef = useRef(0)
  const songsSinceBreakRef = useRef(0)
  const breakEveryRef = useRef(breakEvery)
  const masterRef = useRef(1)
  const duckRef = useRef(1)
  const rampRef = useRef<number | null>(null)
  const recentScriptsRef = useRef<string[]>([])
  const preloadRef = useRef<Map<string, Promise<BreakPlan>>>(new Map())
  const standbyLinerRef = useRef<Map<string, Promise<BreakPlan | null>>>(new Map())
  const goodTracksRef = useRef<Set<string>>(new Set())
  const badTracksRef = useRef<Set<string>>(new Set())
  const nextIndexPromiseRef = useRef<Promise<number> | null>(null)
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
    breakEveryRef.current = Math.max(1, breakEvery)
  }, [breakEvery])

  // Cached breaks were written for the old city; drop them so the next break
  // (including the warmed opener) reflects the new station context.
  useEffect(() => {
    preloadRef.current.clear()
  }, [context.city])

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

        const dry = ctx.createGain()
        dry.gain.value = 1
        source.connect(dry)
        dry.connect(node)

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
        phone.connect(node)

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
        echo.connect(node)

        node.connect(ctx.destination)
        audioCtxRef.current = ctx
        analyserNodeRef.current = node
        fxRef.current = { dry, phone, echo }
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
      fx.phone.gain.value = 1.7
      fx.echo.gain.value = 0
    } else if (speaker === 'reporter') {
      // A lighter "remote line" blend for field reports.
      fx.dry.gain.value = 0.35
      fx.phone.gain.value = 1.1
      fx.echo.gain.value = 0
    } else if (speaker === 'imaging') {
      fx.dry.gain.value = 1
      fx.phone.gain.value = 0
      fx.echo.gain.value = 0.42
    } else {
      fx.dry.gain.value = 1
      fx.phone.gain.value = 0
      fx.echo.gain.value = 0
    }
  }, [])

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

      if (plan.kind === 'bumper') {
        playStinger()
        await new Promise((resolve) => window.setTimeout(resolve, 260))
      }

      for (let i = 0; i < voiced.length; i++) {
        if (stopRef.current) break
        setVoiceEffect(voiced[i].speaker)
        const isLast = i === voiced.length - 1
        await playAudioUrl(voiced[i].audioUrl as string, isLast ? onNearEnd : undefined)
      }
      setVoiceEffect('dj')
    },
    [playAudioUrl, playStinger, setVoiceEffect, speakFallback],
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
    async (from: number) => {
      const activeTracks = tracksRef.current
      for (let step = 0; step < activeTracks.length; step++) {
        const index = (from + step) % activeTracks.length
        const track = activeTracks[index]
        if (!track) break
        if (await probeTrack(track)) return index
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
      let cursor = from
      const maxAttempts = Math.max(activeTracks.length * count, count)
      for (let attempt = 0; attempt < maxAttempts && sequence.length < count; attempt++) {
        const index = await findPlayableIndex(cursor % activeTracks.length)
        sequence.push(index)
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
        intro: `${activeDj.name} on Airbreak, live from ${city}. We are starting with ${nextTitle}. Stay close.`,
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

  const requestBreak = useCallback((index: number, kind: BreakKind, previousIndex?: number) => {
    const activeTracks = tracksRef.current
    const nextTrack = activeTracks[index]
    const previousTrack = typeof previousIndex === 'number' ? activeTracks[previousIndex] : undefined
    const queuedAfter = activeTracks[(index + 1) % activeTracks.length]
    const key = [
      index,
      kind,
      previousTrack?.id || 'no-prev',
      nextTrack?.id || 'empty',
      queuedAfter?.id || 'no-after',
      djRef.current.id,
    ].join(':')
    const existing = preloadRef.current.get(key)
    if (existing) return existing

    const promise = (async (): Promise<BreakPlan> => {
      setBufferStatus('Writing the next break')
      const breakResponse = await fetch('/api/dj-break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dj: djRef.current,
          context: contextRef.current,
          kind,
          previousTrack,
          nextTrack,
          queue: activeTracks.slice(index, index + 6),
          recentScripts: recentScriptsRef.current,
        }),
      })
      const plan = (await breakResponse.json()) as BreakPlan
      setBufferStatus('Recording the voice takes')

      const activeDj = djRef.current
      const segments: BreakSegment[] = plan.segments?.length
        ? plan.segments
        : [{ speaker: 'dj', text: plan.script }]
      const callerVoice = pickCompanionVoice(activeDj.voice, key)
      const reporterVoice = pickCompanionVoice([activeDj.voice, callerVoice], `${key}:reporter`)

      await Promise.all(
        segments.map(async (segment) => {
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
  }, [makeBackupBreak])

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

      void (async () => {
        const nextIndex = await promise
        const songsUntilBreak = Math.max(0, breakEveryRef.current - songsSinceBreakRef.current)
        const breakKind = selectBreakKind(breakSeqRef.current)
        if (songsUntilBreak === 0) {
          requestBreak(nextIndex, selectBreakKind(breakSeqRef.current), index)
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
    [findPlayableIndex, findPlayableSequence, requestBreak],
  )

  const updateMediaSession = useCallback((track: Track) => {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: `Airbreak · ${djRef.current.name}`,
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
      updateMediaSession(track)
      audio.play().catch(() => {
        setStatus('Tap play to enable audio')
      })
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

      const breakKind = selectBreakKind(breakSeqRef.current)
      phaseRef.current = 'loading'
      setMode('loading')
      setStatus('Cueing the mic')
      const breakPlan = await requestBreakForAir(index, breakKind, previousIndex)
      if (stopRef.current) return

      phaseRef.current = 'break'
      setMode('break')
      setStatus('On the mic')
      setNowScript(breakPlan.script)
      recentScriptsRef.current = [...recentScriptsRef.current, breakPlan.script].slice(-3)
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

      await playPlanAudio(breakPlan, startSongUnder)
      if (stopRef.current) return

      startSongUnder()
      phaseRef.current = 'song'
      setMode('song')
      setStatus('On air')
      rampDuck(1, SWELL_MS)
    },
    [beginSong, playPlanAudio, prepareNext, rampDuck, requestBreakForAir],
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
      const pending = nextIndexPromiseRef.current
      nextIndexPromiseRef.current = null
      const nextIndex = pending
        ? await pending
        : await findPlayableIndex((fromIndex + 1) % Math.max(1, tracksRef.current.length))
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
        requestBreak(indexRef.current, selectBreakKind(breakSeqRef.current))
      },
      context.generatedAt ? 300 : 4000,
    )
    return () => window.clearTimeout(timer)
  }, [mode, tracks, currentIndex, dj.id, context.generatedAt, requestBreak])

  const start = useCallback(() => {
    if (!tracksRef.current.length) {
      setStatus('Add music first')
      return
    }
    ensureAudioGraph()
    requestStandbyLiner()
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
    nextTrack: tracks.length ? tracks[(currentIndex + 1) % tracks.length] : undefined,
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
