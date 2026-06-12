import { useCallback, useEffect, useRef, useState } from 'react'
import { demoTracks, selectBreakKind } from './data'
import type { BreakKind, BreakPlan, DjProfile, StationContext, Track } from './types'

const silentAudioUrl =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA=='

// Songs play as a quiet bed under the DJ's voice, then swell to full volume.
const DUCK_LEVEL = 0.22
const SWELL_MS = 2000

export type StationMode = 'idle' | 'loading' | 'break' | 'song' | 'paused'

export type BreakEntry = BreakPlan & { id: number; at: string }

function artworkDataUrl(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#0a0c11"/><circle cx="256" cy="256" r="200" fill="#15181f"/><circle cx="256" cy="256" r="74" fill="${color}"/><circle cx="256" cy="256" r="12" fill="#0a0c11"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function useStation(dj: DjProfile, context: StationContext) {
  const [tracks, setTracks] = useState<Track[]>(demoTracks)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playCount, setPlayCount] = useState(0)
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
  const stopRef = useRef(false)
  const phaseRef = useRef<StationMode>('idle')
  const tracksRef = useRef(tracks)
  const djRef = useRef(dj)
  const contextRef = useRef(context)
  const indexRef = useRef(0)
  const countRef = useRef(0)
  const masterRef = useRef(1)
  const duckRef = useRef(1)
  const rampRef = useRef<number | null>(null)
  const scriptRef = useRef('')
  const preloadRef = useRef<Map<string, Promise<BreakPlan>>>(new Map())
  const preloadStartedRef = useRef<string | null>(null)
  const chainRef = useRef<(index: number, count: number) => Promise<void>>(async () => undefined)

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    djRef.current = dj
  }, [dj])

  useEffect(() => {
    contextRef.current = context
  }, [context])

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
    // Route the DJ voice through an analyser so the visualizer can draw the
    // real waveform while the host talks. Voice audio is always a local blob,
    // so it is safe to pipe through Web Audio without CORS issues.
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
        source.connect(node)
        node.connect(ctx.destination)
        audioCtxRef.current = ctx
        setAnalyser(node)
      }
      audioCtxRef.current.resume().catch(() => undefined)
    } catch {
      // The visualizer falls back to a simulated animation.
    }
  }, [getBreakAudio])

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
    (url: string) => {
      return new Promise<void>((resolve) => {
        const audio = getBreakAudio()
        audio.onended = () => resolve()
        audio.onerror = () => resolve()
        audio.loop = false
        audio.volume = masterRef.current
        audio.src = url
        audio.load()
        audio.play().catch(() => resolve())
      })
    },
    [getBreakAudio],
  )

  const requestBreak = useCallback((index: number, kind: BreakKind) => {
    const activeTracks = tracksRef.current
    const track = activeTracks[index]
    const upcomingTrack = activeTracks[(index + 1) % activeTracks.length]
    const key = `${index}:${kind}:${track?.id || 'empty'}:${djRef.current.id}`
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
          currentTrack: track,
          nextTrack: upcomingTrack,
          queue: activeTracks.slice(index, index + 6),
          recentScript: scriptRef.current,
        }),
      })
      const plan = (await breakResponse.json()) as BreakPlan
      setBufferStatus('Recording the voice take')

      const voiceResponse = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: plan.script,
          voice: djRef.current.voice,
          style: djRef.current.style,
        }),
      })

      if (voiceResponse.ok && voiceResponse.headers.get('content-type')?.includes('audio')) {
        const blob = await voiceResponse.blob()
        plan.audioUrl = URL.createObjectURL(blob)
      }

      setBufferStatus('Next break is loaded')
      return plan
    })().catch((): BreakPlan => {
      const fallback: BreakPlan = {
        kind,
        title: 'Live break',
        source: 'fallback',
        tease: 'Fallback script',
        script: `${djRef.current.name} here. That was ${track?.title || 'the last track'}, and up next we have ${upcomingTrack?.title || 'another cut'} on a ${contextRef.current.weather.toLowerCase()} day in ${djRef.current.city}.`,
      }
      setBufferStatus('Loaded an offline break')
      return fallback
    })

    preloadRef.current.set(key, promise)
    if (preloadRef.current.size > 10) {
      const oldest = preloadRef.current.keys().next().value
      if (oldest) preloadRef.current.delete(oldest)
    }
    return promise
  }, [])

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

  const beginSong = useCallback(
    (index: number, count: number) => {
      const audio = getSongAudio()
      const track = tracksRef.current[index]
      if (!track) return
      indexRef.current = index
      setCurrentIndex(index)
      audio.onended = () => {
        if (stopRef.current) return
        const nextIndex = (index + 1) % tracksRef.current.length
        const nextCount = count + 1
        countRef.current = nextCount
        setPlayCount(nextCount)
        chainRef.current(nextIndex, nextCount)
      }
      audio.onerror = () => {
        if (stopRef.current) return
        const nextIndex = (index + 1) % tracksRef.current.length
        const nextCount = count + 1
        countRef.current = nextCount
        setPlayCount(nextCount)
        chainRef.current(nextIndex, nextCount)
      }
      audio.ontimeupdate = () => {
        setProgress({
          time: audio.currentTime,
          duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        })
        const remaining = audio.duration - audio.currentTime
        const nextIndex = (index + 1) % tracksRef.current.length
        const nextKind = selectBreakKind(count + 1)
        const preloadKey = `${nextIndex}:${nextKind}`
        if (
          Number.isFinite(remaining) &&
          remaining < 45 &&
          preloadStartedRef.current !== preloadKey
        ) {
          preloadStartedRef.current = preloadKey
          requestBreak(nextIndex, nextKind)
        }
      }
      audio.loop = false
      duckRef.current = DUCK_LEVEL
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
    [applyVolumes, getSongAudio, requestBreak, updateMediaSession],
  )

  const playBreakThenSong = useCallback(
    async (index: number, count: number) => {
      const activeTracks = tracksRef.current
      if (!activeTracks.length || stopRef.current) return

      const breakKind = selectBreakKind(count)
      phaseRef.current = 'loading'
      setMode('loading')
      setStatus('Cueing the mic')
      const breakPlan = await requestBreak(index, breakKind)
      if (stopRef.current) return

      phaseRef.current = 'break'
      setMode('break')
      setStatus('On the mic')
      setNowScript(breakPlan.script)
      scriptRef.current = breakPlan.script
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
      preloadStartedRef.current = null

      // Start the song as a quiet bed under the voice, real-radio style.
      beginSong(index, count)

      if (breakPlan.audioUrl) {
        await playAudioUrl(breakPlan.audioUrl)
      } else {
        await speakFallback(breakPlan.script)
      }
      if (stopRef.current) return

      phaseRef.current = 'song'
      setMode('song')
      setStatus('On air')
      rampDuck(1, SWELL_MS)
    },
    [beginSong, playAudioUrl, rampDuck, requestBreak, speakFallback],
  )

  useEffect(() => {
    chainRef.current = playBreakThenSong
  }, [playBreakThenSong])

  const start = useCallback(() => {
    if (!tracksRef.current.length) {
      setStatus('Add music first')
      return
    }
    ensureAudioGraph()
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
    preloadRef.current.clear()
    setBufferStatus('Writing the opening break')
    countRef.current = 0
    setPlayCount(0)
    playBreakThenSong(indexRef.current, 0)
  }, [ensureAudioGraph, getBreakAudio, getSongAudio, playBreakThenSong])

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
    stopRef.current = true
    if (rampRef.current) cancelAnimationFrame(rampRef.current)
    window.speechSynthesis?.cancel()
    breakRef.current?.pause()
    songRef.current?.pause()
    const nextIndex = (indexRef.current + 1) % tracksRef.current.length
    const nextCount = countRef.current + 1
    countRef.current = nextCount
    setPlayCount(nextCount)
    stopRef.current = false
    playBreakThenSong(nextIndex, nextCount)
  }, [playBreakThenSong])

  const playTrack = useCallback(
    (index: number) => {
      indexRef.current = index
      setCurrentIndex(index)
      if (phaseRef.current === 'idle' || mode === 'idle' || mode === 'paused') {
        // Just cue the track; resume/start will pick it up from the top.
        phaseRef.current = 'idle'
        return
      }
      stopRef.current = true
      if (rampRef.current) cancelAnimationFrame(rampRef.current)
      window.speechSynthesis?.cancel()
      breakRef.current?.pause()
      songRef.current?.pause()
      const nextCount = countRef.current + 1
      countRef.current = nextCount
      setPlayCount(nextCount)
      stopRef.current = false
      playBreakThenSong(index, nextCount)
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
    preloadStartedRef.current = null
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
