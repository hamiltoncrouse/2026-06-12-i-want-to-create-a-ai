import {
  Ban,
  CalendarDays,
  Cloud,
  Dumbbell,
  Headphones,
  ListMusic,
  Loader2,
  MapPin,
  Mic2,
  Moon,
  Music2,
  Newspaper,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Send,
  SlidersHorizontal,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  Users,
  UtensilsCrossed,
  Volume2,
} from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  blankVenue,
  breakKindLabels,
  cleanVenue,
  defaultFolderUrl,
  djPalette,
  dominantGenre,
  emptyContext,
  emptySteering,
  formatTime,
  hasSteering,
  initials,
  mergeSteering,
  defaultDjId,
  presetDjs,
  selectBreakKind,
  shuffleTracks,
  splitArtistTitle,
  steeringLabels,
  steeringPresets,
  voiceOptions,
} from './data'
import type {
  DjProfile,
  ListenerRequest,
  SessionSteering,
  StationContext,
  Track,
  VenueProfile,
  VoiceName,
} from './types'
import { useStation } from './useStation'
import { Visualizer } from './Visualizer'

type Tab = 'onair' | 'djs' | 'library' | 'station'

const tabs: { id: Tab; label: string; icon: typeof Radio }[] = [
  { id: 'onair', label: 'On Air', icon: Radio },
  { id: 'djs', label: 'DJs', icon: Mic2 },
  { id: 'library', label: 'Library', icon: ListMusic },
  { id: 'station', label: 'Station', icon: MapPin },
]

const blankDraft: DjProfile = {
  id: 'custom',
  name: 'Casey Current',
  handle: 'Local AI DJ',
  format: 'listener-curated music',
  city: 'New York, NY',
  stationName: 'Airbreak Local',
  callsign: 'Airbreak',
  voice: 'marin',
  style: 'Friendly, witty, specific, concise, and natural on mic.',
  backstory: 'A station host who loves connecting songs to local life.',
  color: '#e0b13b',
}

function restoreSteering(): SessionSteering {
  const saved = localStorage.getItem('ai-dj-session-steering')
  if (!saved) return emptySteering
  try {
    const parsed = JSON.parse(saved) as Partial<SessionSteering>
    return {
      ...emptySteering,
      ...parsed,
      targetMoods: Array.isArray(parsed.targetMoods) ? parsed.targetMoods : [],
      targetGenres: Array.isArray(parsed.targetGenres) ? parsed.targetGenres : [],
      avoidGenres: Array.isArray(parsed.avoidGenres) ? parsed.avoidGenres : [],
      avoidMoods: Array.isArray(parsed.avoidMoods) ? parsed.avoidMoods : [],
      avoidArtists: Array.isArray(parsed.avoidArtists) ? parsed.avoidArtists : [],
      tempos: Array.isArray(parsed.tempos) ? parsed.tempos : [],
      dayparts: Array.isArray(parsed.dayparts) ? parsed.dayparts : [],
    }
  } catch {
    localStorage.removeItem('ai-dj-session-steering')
    return emptySteering
  }
}

function cleanSteeringTerm(value: string) {
  return value
    .replace(/\b(music|songs|tracks|records|please|this session|session|for now|in|anymore)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32)
}

function App() {
  const [customDjs, setCustomDjs] = useState<DjProfile[]>(() => {
    const saved = localStorage.getItem('ai-dj-custom-djs')
    if (!saved) return []
    try {
      return JSON.parse(saved) as DjProfile[]
    } catch {
      localStorage.removeItem('ai-dj-custom-djs')
      return []
    }
  })
  const [djOverrides, setDjOverrides] = useState<Record<string, Partial<DjProfile>>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ai-dj-overrides') || '{}') as Record<
        string,
        Partial<DjProfile>
      >
    } catch {
      return {}
    }
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedDjId, setSelectedDjId] = useState(defaultDjId)
  const [context, setContext] = useState<StationContext>(emptyContext)
  const [contextEpoch, setContextEpoch] = useState(0)
  const [tab, setTab] = useState<Tab>('onair')
  const [folderUrl, setFolderUrl] = useState(defaultFolderUrl)
  const [libraryMessage, setLibraryMessage] = useState('')
  const [scanning, setScanning] = useState(false)
  const [isDjFormOpen, setIsDjFormOpen] = useState(false)
  const [draftDj, setDraftDj] = useState<DjProfile>(blankDraft)
  const [stationCity, setStationCity] = useState(
    () => localStorage.getItem('ai-dj-station-city') || '',
  )
  const [cityDraft, setCityDraft] = useState(
    () => localStorage.getItem('ai-dj-station-city') || '',
  )
  const [citySource, setCitySource] = useState<'dj' | 'listener'>(() =>
    localStorage.getItem('ai-dj-city-source') === 'listener' ? 'listener' : 'dj',
  )
  const [breakEvery, setBreakEvery] = useState(() => {
    const saved = Number(localStorage.getItem('ai-dj-break-every'))
    return [1, 2, 3, 5].includes(saved) ? saved : 1
  })
  const [bloomKey, setBloomKey] = useState(0)
  const [requestDraft, setRequestDraft] = useState('')
  const [listenerRequests, setListenerRequests] = useState<ListenerRequest[]>([])
  const [steering, setSteering] = useState<SessionSteering>(restoreSteering)
  const [steeringDraft, setSteeringDraft] = useState('')
  const [previewingVoice, setPreviewingVoice] = useState(false)
  const [voicePreviewStatus, setVoicePreviewStatus] = useState('')
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewAudioUrlRef = useRef<string | null>(null)

  // Preset DJs can be edited; the edits are stored as overrides and merged on
  // top of the built-in profile so they can also be reverted.
  const presetList = presetDjs.map((dj) => ({ ...dj, ...(djOverrides[dj.id] || {}) }))
  const djs = [...presetList, ...customDjs]
  const selectedDj = djs.find((dj) => dj.id === selectedDjId) || djs[0]

  const handleRequestsAired = useCallback((ids: string[]) => {
    setListenerRequests((requests) => requests.filter((request) => !ids.includes(request.id)))
  }, [])

  const station = useStation(
    selectedDj,
    context,
    breakEvery,
    listenerRequests,
    handleRequestsAired,
    steering,
  )
  const {
    tracks,
    setLibrary,
    currentIndex,
    currentTrack,
    nextTrack,
    mode,
    status,
    isOnAir,
    nowScript,
    bufferStatus,
    breakLog,
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
  } = station

  const targetCity = citySource === 'dj' ? selectedDj.city : stationCity || 'auto'
  const activeSteering = hasSteering(steering)
  const steeringSummary = steeringLabels(steering)
  const currentGenre = dominantGenre(currentTrack)

  useEffect(() => {
    const controller = new AbortController()
    async function loadContext() {
      try {
        const params = new URLSearchParams({ city: targetCity })
        const response = await fetch(`/api/context?${params}`, { signal: controller.signal })
        const data = (await response.json()) as StationContext
        setContext(data)
      } catch {
        setContext({ ...emptyContext, city: targetCity === 'auto' ? emptyContext.city : targetCity })
      }
    }
    loadContext()
    return () => controller.abort()
  }, [targetCity, contextEpoch])

  // Keep weather, news, and sports fresh during long listening sessions.
  useEffect(() => {
    const interval = window.setInterval(() => setContextEpoch((epoch) => epoch + 1), 4 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    localStorage.setItem('ai-dj-session-steering', JSON.stringify(steering))
  }, [steering])

  const applyStationCity = useCallback(() => {
    const next = cityDraft.trim()
    setStationCity(next)
    localStorage.setItem('ai-dj-station-city', next)
  }, [cityDraft])

  const updateBreakEvery = useCallback((value: number) => {
    setBreakEvery(value)
    localStorage.setItem('ai-dj-break-every', String(value))
  }, [])

  const updateCitySource = useCallback((value: 'dj' | 'listener') => {
    setCitySource(value)
    localStorage.setItem('ai-dj-city-source', value)
  }, [])

  const handleToggle = useCallback(() => {
    if (isOnAir) pause()
    else if (mode === 'paused') resume()
    else start()
  }, [isOnAir, mode, pause, resume, start])

  const loadFolder = useCallback(async () => {
    setScanning(true)
    setLibraryMessage('Scanning source')
    try {
      const params = new URLSearchParams({ url: folderUrl })
      const response = await fetch(`/api/library?${params}`)
      const data = (await response.json()) as { tracks?: Track[]; error?: string }
      if (!response.ok || !data.tracks?.length) {
        setLibraryMessage(data.error || 'No playable audio links found')
        return
      }
      setLibrary(shuffleTracks(data.tracks))
      setLibraryMessage(`${data.tracks.length} tracks loaded, shuffled`)
    } catch {
      setLibraryMessage('Source scan failed')
    } finally {
      setScanning(false)
    }
  }, [folderUrl, setLibrary])

  // Load the station playlist automatically so the app opens ready to play.
  const autoLoadedRef = useRef(false)
  useEffect(() => {
    if (autoLoadedRef.current) return
    autoLoadedRef.current = true
    loadFolder()
  }, [loadFolder])

  const addLocalFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return
      const nextTracks = Array.from(files)
        .filter((file) => file.type.startsWith('audio/'))
        .map((file, index) => {
          const parsed = splitArtistTitle(file.name)
          return {
            id: `local-${file.name}-${index}-${file.lastModified}`,
            title: parsed.title,
            artist: parsed.artist,
            url: URL.createObjectURL(file),
            source: 'local' as const,
          }
        })
      if (!nextTracks.length) return
      setLibrary(nextTracks)
      setLibraryMessage(`${nextTracks.length} local tracks loaded`)
    },
    [setLibrary],
  )

  const persistCustom = useCallback((next: DjProfile[]) => {
    setCustomDjs(next)
    localStorage.setItem('ai-dj-custom-djs', JSON.stringify(next))
  }, [])

  const persistOverrides = useCallback((next: Record<string, Partial<DjProfile>>) => {
    setDjOverrides(next)
    localStorage.setItem('ai-dj-overrides', JSON.stringify(next))
  }, [])

  const startCreate = useCallback(() => {
    setDraftDj(blankDraft)
    setEditingId(null)
    setIsDjFormOpen(true)
  }, [])

  const startEdit = useCallback((dj: DjProfile) => {
    setDraftDj({ ...dj })
    setEditingId(dj.id)
    setIsDjFormOpen(true)
  }, [])

  const closeDjForm = useCallback(() => {
    setIsDjFormOpen(false)
    setEditingId(null)
    setDraftDj(blankDraft)
  }, [])

  const updateVenue = useCallback((patch: Partial<VenueProfile>) => {
    setDraftDj((dj) => ({ ...dj, venue: { ...(dj.venue || blankVenue), ...patch } }))
  }, [])

  const toggleRestaurantMode = useCallback(() => {
    setDraftDj((dj) => ({ ...dj, venue: dj.venue ? null : { ...blankVenue } }))
  }, [])

  const saveDj = useCallback(() => {
    const name = draftDj.name.trim()
    if (!name) return
    // A venue with no name is treated as no venue at all.
    let venue = draftDj.venue ? cleanVenue(draftDj.venue) : null
    if (venue && !venue.name) venue = null
    const cleaned = { ...draftDj, name, venue }
    if (editingId == null) {
      const id = `custom-${Date.now()}`
      persistCustom([...customDjs, { ...cleaned, id }])
      setSelectedDjId(id)
    } else if (editingId.startsWith('custom-')) {
      persistCustom(customDjs.map((dj) => (dj.id === editingId ? { ...cleaned, id: editingId } : dj)))
      setSelectedDjId(editingId)
    } else {
      // Preset edit: store every field except the id as an override.
      const override: Partial<DjProfile> = { ...cleaned }
      delete (override as { id?: string }).id
      persistOverrides({ ...djOverrides, [editingId]: override })
      setSelectedDjId(editingId)
    }
    closeDjForm()
  }, [closeDjForm, customDjs, djOverrides, draftDj, editingId, persistCustom, persistOverrides])

  const resetPreset = useCallback(
    (id: string) => {
      const next = { ...djOverrides }
      delete next[id]
      persistOverrides(next)
      closeDjForm()
    },
    [closeDjForm, djOverrides, persistOverrides],
  )

  const deleteCustomDj = useCallback(
    (id: string) => {
      persistCustom(customDjs.filter((dj) => dj.id !== id))
      if (selectedDjId === id) setSelectedDjId(defaultDjId)
    },
    [customDjs, persistCustom, selectedDjId],
  )

  const previewDraftVoice = useCallback(async () => {
    if (previewingVoice) return
    setPreviewingVoice(true)
    setVoicePreviewStatus('Preparing preview')
    try {
      previewAudioRef.current?.pause()
      if (previewAudioUrlRef.current) URL.revokeObjectURL(previewAudioUrlRef.current)
      previewAudioUrlRef.current = null
      const name = draftDj.name.trim() || 'your DJ'
      const station = draftDj.callsign?.trim() || draftDj.stationName?.trim() || 'Airbreak'
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `You're listening to ${name} on ${station}. Keep listening.`,
          voice: draftDj.voice,
          speaker: 'dj',
          style: draftDj.style,
        }),
      })
      if (!response.ok || !response.headers.get('content-type')?.includes('audio')) {
        setVoicePreviewStatus('Voice preview unavailable')
        return
      }
      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)
      previewAudioUrlRef.current = audioUrl
      const audio = new Audio(audioUrl)
      previewAudioRef.current = audio
      const releasePreviewUrl = () => {
        if (previewAudioUrlRef.current === audioUrl) previewAudioUrlRef.current = null
        URL.revokeObjectURL(audioUrl)
      }
      audio.onended = releasePreviewUrl
      audio.onerror = releasePreviewUrl
      await audio.play()
      setVoicePreviewStatus('Playing preview')
    } catch {
      setVoicePreviewStatus('Voice preview failed')
    } finally {
      setPreviewingVoice(false)
    }
  }, [draftDj, previewingVoice])

  const submitRequest = useCallback(() => {
    const text = requestDraft.trim().replace(/\s+/g, ' ').slice(0, 220)
    if (!text) return
    const request: ListenerRequest = {
      id: `request-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }
    setListenerRequests((requests) => [...requests, request].slice(-8))
    setRequestDraft('')
  }, [requestDraft])

  const removeRequest = useCallback((id: string) => {
    setListenerRequests((requests) => requests.filter((request) => request.id !== id))
  }, [])

  const applyPresetSteering = useCallback((presetId: string) => {
    const preset = steeringPresets.find((item) => item.id === presetId)
    if (!preset) return
    setSteering((current) => mergeSteering(current, preset.steering))
  }, [])

  const resetSteering = useCallback(() => {
    setSteering({ ...emptySteering })
  }, [])

  const moreLikeCurrent = useCallback(() => {
    if (!currentTrack) return
    const energy = typeof currentTrack.energy === 'number' ? currentTrack.energy : undefined
    setSteering((current) =>
      mergeSteering(current, {
        targetGenres: currentTrack.genre?.slice(0, 2) || [],
        targetMoods: currentTrack.mood?.slice(0, 2) || [],
        tempos: currentTrack.tempo ? [currentTrack.tempo] : [],
        energyRange: energy ? [Math.max(1, energy - 1), Math.min(5, energy + 1)] : current.energyRange,
        note: `More like ${currentTrack.title} by ${currentTrack.artist}.`,
      }),
    )
  }, [currentTrack])

  const lessLikeCurrent = useCallback(() => {
    if (!currentTrack) return
    setSteering((current) =>
      mergeSteering(current, {
        avoidGenres: currentTrack.genre?.slice(0, 1) || [],
        avoidMoods: currentTrack.mood?.slice(0, 1) || [],
        note: `Move away from the feel of ${currentTrack.title}.`,
      }),
    )
  }, [currentTrack])

  const avoidCurrentGenre = useCallback(() => {
    if (!currentGenre) return
    setSteering((current) =>
      mergeSteering(current, {
        avoidGenres: [currentGenre],
        note: `Avoid ${currentGenre} for this session.`,
      }),
    )
  }, [currentGenre])

  const submitSteeringDraft = useCallback(() => {
    const text = steeringDraft.trim().replace(/\s+/g, ' ').slice(0, 120)
    if (!text) return
    const normalized = text.toLowerCase()
    const next: Partial<SessionSteering> = { note: text }
    if (/\b(late night|night|smooth|chill|mellow)\b/.test(normalized)) {
      next.targetMoods = ['late-night', 'smooth', 'warm']
      next.tempos = ['slow', 'mid']
      next.energyRange = [1, 3]
    }
    if (/\b(gym|workout|uptempo|up tempo|fast|high energy|dance)\b/.test(normalized)) {
      next.targetMoods = ['upbeat', 'bright', 'dance-floor']
      next.tempos = ['upbeat', 'fast']
      next.energyRange = [4, 5]
    }
    const avoidMatch = normalized.match(/\b(?:no more|no|less|avoid|skip)\s+([a-z0-9 &-]{2,40})/)
    if (avoidMatch) {
      const avoided = cleanSteeringTerm(avoidMatch[1])
      if (avoided) next.avoidGenres = [avoided]
    }
    const genreMatches = ['disco', 'funk', 'rock', 'soul', 'pop', 'jazz', 'r&b', 'country'].filter(
      (term) => normalized.includes(term) && !next.avoidGenres?.includes(term),
    )
    if (!avoidMatch && genreMatches.length) next.targetGenres = genreMatches
    setSteering((current) => mergeSteering(current, next))
    setSteeringDraft('')
  }, [steeringDraft])

  const progressPct = progress.duration ? (progress.time / progress.duration) * 100 : 0
  const volumePct = volume * 100

  return (
    <div className="app" style={{ '--dj': selectedDj.color } as CSSProperties}>
      <header className="topBar">
        <div className="brand">
          <span className="brandMark">
            <Radio size={18} aria-hidden="true" />
          </span>
          <span className="brandName">Airbreak</span>
        </div>
        <div className={isOnAir ? 'signalPill live' : 'signalPill'}>
          <span className="signalDot" />
          {status}
        </div>
      </header>

      <main className="content">
        {tab === 'onair' && (
          <section className="view onAirView" key="onair">
            <div
              className="visualizerWrap"
              onPointerDown={() => setBloomKey((key) => key + 1)}
            >
              <Visualizer analyser={analyser} mode={mode} color={selectedDj.color}>
                <div className={mode === 'song' ? 'vinyl spinning' : 'vinyl'}>
                  <span className="vinylLabel">{initials(selectedDj.name)}</span>
                </div>
              </Visualizer>
              {bloomKey > 0 && <span key={bloomKey} className="bloom" aria-hidden="true" />}
            </div>

            <div className="nowPlaying">
              <p className="eyebrow">{mode === 'break' ? 'Coming up' : 'Now playing'}</p>
              <h1>{currentTrack?.title || 'No track loaded'}</h1>
              <p className="artistLine">{currentTrack?.artist || 'Load some music to begin'}</p>
            </div>

            <div className="seekRow">
              <span className="timeLabel">{formatTime(progress.time)}</span>
              <input
                className="seekBar"
                type="range"
                min={0}
                max={progress.duration || 0}
                step={1}
                value={Math.min(progress.time, progress.duration || 0)}
                disabled={!progress.duration || mode !== 'song'}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="Seek"
                style={{
                  background: `linear-gradient(to right, var(--dj) ${progressPct}%, rgba(255, 255, 255, 0.14) ${progressPct}%)`,
                }}
              />
              <span className="timeLabel">{formatTime(progress.duration)}</span>
            </div>

            <div className="transport">
              <div className="volumeControl">
                <Volume2 size={17} aria-hidden="true" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  aria-label="Volume"
                  style={{
                    background: `linear-gradient(to right, var(--dj) ${volumePct}%, rgba(255, 255, 255, 0.14) ${volumePct}%)`,
                  }}
                />
              </div>
              <button
                className="playButton"
                type="button"
                onClick={handleToggle}
                aria-label={isOnAir ? 'Pause station' : 'Start station'}
              >
                {mode === 'loading' ? (
                  <Loader2 className="spinIcon" size={26} />
                ) : isOnAir ? (
                  <Pause size={26} />
                ) : (
                  <Play size={26} className="playGlyph" />
                )}
              </button>
              <button
                className="skipButton"
                type="button"
                onClick={skip}
                disabled={mode === 'idle'}
                aria-label="Skip track"
              >
                <SkipForward size={20} />
              </button>
            </div>

            <div className={mode === 'break' || mode === 'loading' ? 'micCard talking' : 'micCard'}>
              <div className="micHeader">
                <span className="djAvatar" style={{ background: selectedDj.color }}>
                  {initials(selectedDj.name)}
                </span>
                <div className="micMeta">
                  <strong>{selectedDj.name}</strong>
                  <small>{selectedDj.handle}</small>
                </div>
                {(mode === 'break' || mode === 'loading') && (
                  <span className="eqBars" aria-label="DJ is talking">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                )}
              </div>
              <p className="micScript">
                {nowScript ||
                  `${selectedDj.name} is standing by with ${selectedDj.format}. Hit play to go live.`}
              </p>
            </div>

            <div className="requestPanel">
              <div className="requestHeader">
                <span className="upNextLabel">Request line</span>
                <span>{listenerRequests.length} queued</span>
              </div>
              <div className="requestRow">
                <input
                  value={requestDraft}
                  onChange={(event) => setRequestDraft(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && submitRequest()}
                  placeholder="Ask for a song, dedication, or shout-out"
                  aria-label="Request line message"
                  maxLength={220}
                />
                <button
                  className="iconButton"
                  type="button"
                  onClick={submitRequest}
                  disabled={!requestDraft.trim()}
                  aria-label="Send request"
                >
                  <Send size={18} />
                </button>
              </div>
              {!!listenerRequests.length && (
                <div className="requestQueue">
                  {listenerRequests.slice(0, 3).map((request) => (
                    <button
                      className="requestChip"
                      key={request.id}
                      type="button"
                      onClick={() => removeRequest(request.id)}
                      title="Remove request"
                    >
                      <span>{request.text}</span>
                      <small>{request.at}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="steeringPanel">
              <div className="steeringHeader">
                <span className="upNextLabel">
                  <SlidersHorizontal size={13} aria-hidden="true" />
                  Steer DJ
                </span>
                <button
                  className="resetSteering"
                  type="button"
                  onClick={resetSteering}
                  disabled={!activeSteering}
                  aria-label="Reset steering"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
              <div className="steeringOptions">
                {steeringPresets.map((preset) => (
                  <button
                    className="steerChip"
                    key={preset.id}
                    type="button"
                    onClick={() => applyPresetSteering(preset.id)}
                  >
                    {preset.id === 'late-night' ? (
                      <Moon size={15} aria-hidden="true" />
                    ) : preset.id === 'gym' ? (
                      <Dumbbell size={15} aria-hidden="true" />
                    ) : (
                      <SlidersHorizontal size={15} aria-hidden="true" />
                    )}
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="steeringRow">
                <input
                  value={steeringDraft}
                  onChange={(event) => setSteeringDraft(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && submitSteeringDraft()}
                  placeholder="Late night, uptempo gym, no disco"
                  aria-label="Steer the DJ with a music preference"
                  maxLength={120}
                />
                <button
                  className="iconButton"
                  type="button"
                  onClick={submitSteeringDraft}
                  disabled={!steeringDraft.trim()}
                  aria-label="Apply steering"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="steeringActions">
                <button type="button" onClick={moreLikeCurrent} disabled={!currentTrack}>
                  <ThumbsUp size={15} aria-hidden="true" />
                  More like this
                </button>
                <button type="button" onClick={lessLikeCurrent} disabled={!currentTrack}>
                  <ThumbsDown size={15} aria-hidden="true" />
                  Less like this
                </button>
                <button type="button" onClick={avoidCurrentGenre} disabled={!currentGenre}>
                  <Ban size={15} aria-hidden="true" />
                  {currentGenre ? `No ${currentGenre}` : 'No style'}
                </button>
              </div>
              {activeSteering && (
                <div className="steeringSummary">
                  {steeringSummary.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              )}
            </div>

            {nextTrack && nextTrack.id !== currentTrack?.id && (
              <div className="upNext">
                <span className="upNextLabel">Up next</span>
                <span className="upNextTrack">
                  {nextTrack.title} · {nextTrack.artist}
                </span>
              </div>
            )}

            <div className="freqRow">
              <span className="freqLabel">DJ breaks</span>
              <div className="freqOptions">
                {[1, 2, 3, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={breakEvery === value ? 'freqChip active' : 'freqChip'}
                    onClick={() => updateBreakEvery(value)}
                  >
                    {value === 1 ? 'Every song' : `Every ${value}`}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === 'djs' && (
          <section className="view" key="djs">
            <h2 className="viewTitle">Your DJs</h2>
            <div className="djList">
              {djs.map((dj) => (
                <div
                  className={dj.id === selectedDj.id ? 'djCard selected' : 'djCard'}
                  key={dj.id}
                  style={{ '--dj-card': dj.color } as CSSProperties}
                >
                  <button className="djSelect" type="button" onClick={() => setSelectedDjId(dj.id)}>
                    <span className="djAvatar large" style={{ background: dj.color }}>
                      {initials(dj.name)}
                    </span>
                    <span className="djMeta">
                      <strong>{dj.name}</strong>
                      <small>{dj.handle}</small>
                      <small className="djTags">
                        {dj.city} · {dj.stationName || 'Airbreak'} · voice “{dj.voice}”
                        {djOverrides[dj.id] ? ' · edited' : ''}
                      </small>
                    </span>
                  </button>
                  <button
                    className="djEdit"
                    type="button"
                    onClick={() => startEdit(dj)}
                    aria-label={`Edit ${dj.name}`}
                  >
                    <Pencil size={16} />
                  </button>
                  {dj.id.startsWith('custom-') && (
                    <button
                      className="djDelete"
                      type="button"
                      onClick={() => deleteCustomDj(dj.id)}
                      aria-label={`Delete ${dj.name}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="personaCard">
              <p className="eyebrow">On the format</p>
              <p>{selectedDj.format}</p>
              <p className="eyebrow">Station</p>
              <p>
                {selectedDj.stationName || 'Airbreak'}
                {selectedDj.callsign ? ` · ${selectedDj.callsign}` : ''}
              </p>
              <p className="eyebrow">Backstory</p>
              <p>{selectedDj.backstory}</p>
            </div>

            <button
              className="secondaryButton"
              type="button"
              onClick={() => (isDjFormOpen ? closeDjForm() : startCreate())}
            >
              <Plus size={18} />
              {isDjFormOpen ? 'Close editor' : 'Create a DJ'}
            </button>

            {isDjFormOpen && (
              <div className="djForm">
                <div className="wideField formHeading">
                  {editingId == null
                    ? 'New DJ'
                    : editingId.startsWith('custom-')
                      ? `Editing ${draftDj.name || 'DJ'}`
                      : `Editing ${draftDj.name || 'DJ'} (preset)`}
                </div>
                <label>
                  <span>Name</span>
                  <input
                    value={draftDj.name}
                    onChange={(event) => setDraftDj({ ...draftDj, name: event.target.value })}
                  />
                </label>
                <label>
                  <span>Handle</span>
                  <input
                    value={draftDj.handle}
                    onChange={(event) => setDraftDj({ ...draftDj, handle: event.target.value })}
                  />
                </label>
                <label>
                  <span>City</span>
                  <input
                    value={draftDj.city}
                    onChange={(event) => setDraftDj({ ...draftDj, city: event.target.value })}
                  />
                </label>
                <label>
                  <span>Station</span>
                  <input
                    value={draftDj.stationName || ''}
                    onChange={(event) =>
                      setDraftDj({ ...draftDj, stationName: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Callsign</span>
                  <input
                    value={draftDj.callsign || ''}
                    onChange={(event) => setDraftDj({ ...draftDj, callsign: event.target.value })}
                  />
                </label>
                <label>
                  <span>Voice</span>
                  <select
                    value={draftDj.voice}
                    onChange={(event) =>
                      setDraftDj({ ...draftDj, voice: event.target.value as VoiceName })
                    }
                  >
                    {voiceOptions.map((voice) => (
                      <option key={voice} value={voice}>
                        {voice}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="voicePreview wideField">
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={previewDraftVoice}
                    disabled={previewingVoice}
                  >
                    {previewingVoice ? (
                      <Loader2 className="spinIcon" size={18} />
                    ) : (
                      <Headphones size={18} />
                    )}
                    Preview voice
                  </button>
                  <span>{voicePreviewStatus || 'Hear the selected voice with this DJ identity.'}</span>
                </div>
                <label>
                  <span>Format</span>
                  <input
                    value={draftDj.format}
                    onChange={(event) => setDraftDj({ ...draftDj, format: event.target.value })}
                  />
                </label>
                <label>
                  <span>Style</span>
                  <input
                    value={draftDj.style}
                    onChange={(event) => setDraftDj({ ...draftDj, style: event.target.value })}
                  />
                </label>
                <label className="wideField">
                  <span>Backstory</span>
                  <textarea
                    value={draftDj.backstory}
                    onChange={(event) => setDraftDj({ ...draftDj, backstory: event.target.value })}
                  />
                </label>

                <div className="wideField venueToggle">
                  <button
                    type="button"
                    className={draftDj.venue ? 'freqChip active' : 'freqChip'}
                    onClick={toggleRestaurantMode}
                  >
                    <UtensilsCrossed size={15} />
                    {draftDj.venue ? 'Restaurant mode: on' : 'Restaurant mode: off'}
                  </button>
                </div>
                {draftDj.venue && (
                  <>
                    <p className="hintLine wideField">
                      Broadcast from your venue: news, weather, and traffic are replaced by your
                      specials, kitchen, staff, and events. Put one item per line in the lists.
                    </p>
                    <label>
                      <span>Restaurant name</span>
                      <input
                        value={draftDj.venue.name}
                        onChange={(event) => updateVenue({ name: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Tagline</span>
                      <input
                        value={draftDj.venue.tagline || ''}
                        onChange={(event) => updateVenue({ tagline: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Cuisine</span>
                      <input
                        value={draftDj.venue.cuisine}
                        onChange={(event) => updateVenue({ cuisine: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Owners</span>
                      <input
                        value={draftDj.venue.owners}
                        onChange={(event) => updateVenue({ owners: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Chef</span>
                      <input
                        value={draftDj.venue.chef}
                        onChange={(event) => updateVenue({ chef: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Hours</span>
                      <input
                        value={draftDj.venue.hours}
                        onChange={(event) => updateVenue({ hours: event.target.value })}
                      />
                    </label>
                    <label className="wideField">
                      <span>Vibe</span>
                      <input
                        value={draftDj.venue.vibe}
                        onChange={(event) => updateVenue({ vibe: event.target.value })}
                      />
                    </label>
                    <label className="wideField">
                      <span>Staff &amp; roles (one per line)</span>
                      <textarea
                        value={draftDj.venue.team.join('\n')}
                        onChange={(event) => updateVenue({ team: event.target.value.split('\n') })}
                      />
                    </label>
                    <label className="wideField">
                      <span>Signature dishes (one per line)</span>
                      <textarea
                        value={draftDj.venue.signatureDishes.join('\n')}
                        onChange={(event) =>
                          updateVenue({ signatureDishes: event.target.value.split('\n') })
                        }
                      />
                    </label>
                    <label className="wideField">
                      <span>Specials (one per line)</span>
                      <textarea
                        value={draftDj.venue.specials.join('\n')}
                        onChange={(event) => updateVenue({ specials: event.target.value.split('\n') })}
                      />
                    </label>
                    <label className="wideField">
                      <span>Drinks &amp; bar (one per line)</span>
                      <textarea
                        value={draftDj.venue.drinks.join('\n')}
                        onChange={(event) => updateVenue({ drinks: event.target.value.split('\n') })}
                      />
                    </label>
                    <label className="wideField">
                      <span>Events (one per line)</span>
                      <textarea
                        value={draftDj.venue.events.join('\n')}
                        onChange={(event) => updateVenue({ events: event.target.value.split('\n') })}
                      />
                    </label>
                    <label className="wideField">
                      <span>Notes &amp; lore (one per line)</span>
                      <textarea
                        value={draftDj.venue.lore.join('\n')}
                        onChange={(event) => updateVenue({ lore: event.target.value.split('\n') })}
                      />
                    </label>
                  </>
                )}

                <div className="wideField">
                  <span className="fieldLabel">Color</span>
                  <div className="swatchRow">
                    {djPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={draftDj.color === color ? 'swatch selected' : 'swatch'}
                        style={{ background: color }}
                        onClick={() => setDraftDj({ ...draftDj, color })}
                        aria-label={`Use color ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <button className="primaryButton wideField" type="button" onClick={saveDj}>
                  <Save size={18} />
                  {editingId == null ? 'Save DJ' : 'Update DJ'}
                </button>
                {editingId != null &&
                  !editingId.startsWith('custom-') &&
                  djOverrides[editingId] && (
                    <button
                      className="secondaryButton wideField"
                      type="button"
                      onClick={() => resetPreset(editingId)}
                    >
                      <RotateCcw size={18} />
                      Reset to original
                    </button>
                  )}
              </div>
            )}
          </section>
        )}

        {tab === 'library' && (
          <section className="view" key="library">
            <h2 className="viewTitle">Library</h2>
            <div className="folderRow">
              <input
                value={folderUrl}
                onChange={(event) => setFolderUrl(event.target.value)}
                placeholder="Manifest or folder URL"
                aria-label="Music source URL"
              />
              <button
                className="iconButton"
                type="button"
                onClick={loadFolder}
                disabled={scanning}
                aria-label="Load shared source"
              >
                {scanning ? <Loader2 className="spinIcon" size={19} /> : <Cloud size={19} />}
              </button>
            </div>
            <label className="fileDrop">
              <Upload size={19} />
              <span>Add local audio files</span>
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={(event) => addLocalFiles(event.target.files)}
              />
            </label>
            <p className="smallStatus">{libraryMessage || `${tracks.length} tracks in rotation`}</p>
            <div className="trackList">
              {tracks.map((track, index) => (
                <button
                  key={track.id}
                  className={index === currentIndex ? 'trackRow active' : 'trackRow'}
                  type="button"
                  onClick={() => playTrack(index)}
                >
                  <span className="trackIcon">
                    {index === currentIndex && mode === 'song' ? (
                      <span className="eqBars small">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      <Music2 size={16} />
                    )}
                  </span>
                  <span className="trackMeta">
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                    {(track.year || track.genre?.length || track.mood?.length) && (
                      <small className="trackTags">
                        {[track.year, ...(track.genre || []).slice(0, 2), ...(track.mood || []).slice(0, 1)]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    )}
                  </span>
                  <span className="sourceChip">{track.source}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {tab === 'station' && (
          <section className="view" key="station">
            <h2 className="viewTitle">Station</h2>
            {selectedDj.venue ? (
              <>
                <div className="infoCard">
                  <div className="infoTitle">
                    <MapPin size={17} />
                    <h3>{selectedDj.venue.name}</h3>
                  </div>
                  {selectedDj.venue.tagline && <p>{selectedDj.venue.tagline}</p>}
                  <p className="factsLine">{selectedDj.venue.hours}</p>
                  <p className="hintLine">Broadcasting live from the dining room.</p>
                </div>
                <div className="infoCard">
                  <div className="infoTitle">
                    <UtensilsCrossed size={17} />
                    <h3>Tonight&apos;s specials</h3>
                  </div>
                  {selectedDj.venue.specials.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                  <div className="infoTitle subTitle">
                    <h3>From the kitchen</h3>
                  </div>
                  <p>{selectedDj.venue.chef}</p>
                  {selectedDj.venue.signatureDishes.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
                <div className="infoCard">
                  <div className="infoTitle">
                    <Users size={17} />
                    <h3>The team</h3>
                  </div>
                  <p>{selectedDj.venue.owners}</p>
                  {selectedDj.venue.team.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
                <div className="infoCard">
                  <div className="infoTitle">
                    <CalendarDays size={17} />
                    <h3>What&apos;s on</h3>
                  </div>
                  {selectedDj.venue.events.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                  <div className="infoTitle subTitle">
                    <h3>At the bar</h3>
                  </div>
                  {selectedDj.venue.drinks.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </>
            ) : (
              <>
            <div className="infoCard">
              <div className="infoTitle">
                <MapPin size={17} />
                <h3>{context.city}</h3>
              </div>
              <p>{context.weather}</p>
              {context.facts && <p className="factsLine">{context.facts}</p>}
              <div className="sourceToggle">
                <button
                  type="button"
                  className={citySource === 'dj' ? 'freqChip active' : 'freqChip'}
                  onClick={() => updateCitySource('dj')}
                >
                  DJ's home city
                </button>
                <button
                  type="button"
                  className={citySource === 'listener' ? 'freqChip active' : 'freqChip'}
                  onClick={() => updateCitySource('listener')}
                >
                  My location
                </button>
              </div>
              {citySource === 'dj' ? (
                <p className="hintLine">
                  News and weather follow {selectedDj.name}, broadcasting from {selectedDj.city}.
                </p>
              ) : (
                <>
                  <div className="cityRow">
                    <input
                      value={cityDraft}
                      onChange={(event) => setCityDraft(event.target.value)}
                      placeholder="Auto-detect my city"
                      aria-label="Station city"
                      onKeyDown={(event) => event.key === 'Enter' && applyStationCity()}
                    />
                    <button className="iconButton" type="button" onClick={applyStationCity}>
                      Set
                    </button>
                  </div>
                  <p className="hintLine">Leave empty to broadcast from your detected location.</p>
                </>
              )}
            </div>
            <div className="infoCard">
              <div className="infoTitle">
                <Newspaper size={17} />
                <h3>Local headlines</h3>
              </div>
              {(context.headlines.length
                ? context.headlines
                : ['Headlines load with station context.']
              ).map((headline) => (
                <p key={headline}>{headline}</p>
              ))}
              {!!context.national?.length && (
                <>
                  <div className="infoTitle subTitle">
                    <h3>National</h3>
                  </div>
                  {context.national.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </>
              )}
              {!!context.world?.length && (
                <>
                  <div className="infoTitle subTitle">
                    <h3>World</h3>
                  </div>
                  {context.world.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </>
              )}
              {!!context.sports?.length && (
                <>
                  <div className="infoTitle subTitle">
                    <h3>Sports desk</h3>
                  </div>
                  {context.sports.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </>
              )}
            </div>
              </>
            )}
            <div className="infoCard">
              <div className="infoTitle">
                <Mic2 size={17} />
                <h3>Break log</h3>
              </div>
              {breakLog.length === 0 && <p>Breaks will appear here once the station starts.</p>}
              {breakLog.map((entry) => (
                <div className="logEntry" key={entry.id}>
                  <div className="logMeta">
                    <span className="kindChip">{breakKindLabels[entry.kind] || entry.kind}</span>
                    <span>{entry.at}</span>
                  </div>
                  <p>{entry.script}</p>
                </div>
              ))}
            </div>
            <div className="queueMeta">
              <span>{bufferStatus}</span>
              <span>Next: {breakKindLabels[selectBreakKind(breakSeq)]}</span>
            </div>
          </section>
        )}
      </main>

      <nav className="tabBar" aria-label="Sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tabButton active' : 'tabButton'}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon size={21} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
