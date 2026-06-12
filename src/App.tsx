import {
  Cloud,
  Disc3,
  Loader2,
  MapPin,
  Mic2,
  Music2,
  Newspaper,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  SkipForward,
  Upload,
  Volume2,
} from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type VoiceName =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'fable'
  | 'nova'
  | 'onyx'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'marin'
  | 'cedar'

type Track = {
  id: string
  title: string
  artist: string
  url: string
  source: 'demo' | 'folder' | 'local'
}

type DjProfile = {
  id: string
  name: string
  handle: string
  format: string
  city: string
  voice: VoiceName
  style: string
  backstory: string
  color: string
}

type StationContext = {
  city: string
  weather: string
  headlines: string[]
  generatedAt: string
}

type BreakKind = 'intro' | 'songTalk' | 'newsWeather' | 'commercial'

type BreakPlan = {
  kind: BreakKind
  title: string
  script: string
  tease: string
  audioUrl?: string
  source: 'openai' | 'fallback'
}

const defaultFolderUrl = 'https://mwalk.neocities.org/music/manifest.json'
const silentAudioUrl =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA=='

const demoTracks: Track[] = [
  {
    id: 'demo-1',
    title: 'SoundHelix Song 1',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    source: 'demo',
  },
  {
    id: 'demo-2',
    title: 'SoundHelix Song 2',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    source: 'demo',
  },
  {
    id: 'demo-3',
    title: 'SoundHelix Song 3',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    source: 'demo',
  },
]

const presetDjs: DjProfile[] = [
  {
    id: 'jet',
    name: 'Jet Morales',
    handle: 'Late-night FM storyteller',
    format: 'album rock, left-field pop, and night-drive classics',
    city: 'New York, NY',
    voice: 'marin',
    style:
      'Warm, dry, cinematic, knows too much about records, never corny, never over-explains.',
    backstory:
      'Jet started as a graveyard-shift board op in Queens, spent years interviewing touring bands, and still keeps a notebook of strange studio stories.',
    color: '#f45d48',
  },
  {
    id: 'mona',
    name: 'Mona Vinyl',
    handle: 'Soul radio lifer',
    format: 'soul, disco, funk, jazz-pop, and golden-hour grooves',
    city: 'Philadelphia, PA',
    voice: 'cedar',
    style:
      'Confident, funny, velvet delivery, quick with a cultural reference and a clean punchline.',
    backstory:
      'Mona grew up around her uncle’s record shop and learned radio by producing Sunday-morning community shows.',
    color: '#1f9d8a',
  },
  {
    id: 'ada',
    name: 'Ada Night',
    handle: 'Indie station archivist',
    format: 'indie rock, synthpop, ambient, and curious deep cuts',
    city: 'Austin, TX',
    voice: 'nova',
    style:
      'Smart, intimate, slightly mysterious, turns song facts into tiny stories.',
    backstory:
      'Ada built a pirate-radio stream in college and now hosts from a converted print shop behind a theater.',
    color: '#8467d7',
  },
]

const voiceOptions: VoiceName[] = [
  'marin',
  'cedar',
  'nova',
  'coral',
  'fable',
  'onyx',
  'sage',
  'shimmer',
  'verse',
  'alloy',
  'ash',
  'ballad',
  'echo',
]

const emptyContext: StationContext = {
  city: 'New York, NY',
  weather: 'Weather unavailable',
  headlines: [],
  generatedAt: '',
}

function formatTrackName(name: string) {
  return decodeURIComponent(name)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitArtistTitle(name: string) {
  const cleaned = formatTrackName(name)
  const parts = cleaned.split(/\s+-\s+/)
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') }
  }
  return { artist: 'Unknown Artist', title: cleaned || 'Untitled Track' }
}

function selectBreakKind(playCount: number): BreakKind {
  if (playCount === 0) return 'intro'
  if (playCount > 0 && playCount % 5 === 0) return 'newsWeather'
  if (playCount > 0 && playCount % 4 === 0) return 'commercial'
  return 'songTalk'
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
  const [selectedDjId, setSelectedDjId] = useState(presetDjs[0].id)
  const [tracks, setTracks] = useState<Track[]>(demoTracks)
  const [folderUrl, setFolderUrl] = useState(defaultFolderUrl)
  const [context, setContext] = useState<StationContext>(emptyContext)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playCount, setPlayCount] = useState(0)
  const [mode, setMode] = useState<'idle' | 'loading' | 'break' | 'song'>('idle')
  const [status, setStatus] = useState('Ready')
  const [nowScript, setNowScript] = useState('')
  const [bufferStatus, setBufferStatus] = useState('Next break not loaded')
  const [libraryMessage, setLibraryMessage] = useState('')
  const [isCustomOpen, setIsCustomOpen] = useState(false)
  const [draftDj, setDraftDj] = useState<DjProfile>({
    id: 'custom',
    name: 'Casey Current',
    handle: 'Local AI DJ',
    format: 'listener-curated music',
    city: 'New York, NY',
    voice: 'marin',
    style: 'Friendly, witty, specific, concise, and natural on mic.',
    backstory: 'A station host who loves connecting songs to local life.',
    color: '#e0b13b',
  })

  const breakAudioRef = useRef<HTMLAudioElement | null>(null)
  const songAudioRef = useRef<HTMLAudioElement | null>(null)
  const stopRef = useRef(false)
  const tracksRef = useRef(tracks)
  const djRef = useRef(presetDjs[0])
  const contextRef = useRef(context)
  const playCountRef = useRef(playCount)
  const preloadRef = useRef<Map<string, Promise<BreakPlan>>>(new Map())
  const preloadStartedRef = useRef<string | null>(null)
  const playBreakThenSongRef = useRef<(index: number, count: number) => Promise<void>>(async () => undefined)

  const djs = useMemo(() => [...presetDjs, ...customDjs], [customDjs])
  const selectedDj = djs.find((dj) => dj.id === selectedDjId) || djs[0]
  const currentTrack = tracks[currentIndex] || tracks[0]
  const onAir = mode === 'break' || mode === 'song'

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    djRef.current = selectedDj
  }, [selectedDj])

  useEffect(() => {
    contextRef.current = context
  }, [context])

  useEffect(() => {
    playCountRef.current = playCount
  }, [playCount])

  useEffect(() => {
    const controller = new AbortController()
    async function loadContext() {
      try {
        const params = new URLSearchParams({ city: selectedDj.city })
        const response = await fetch(`/api/context?${params}`, {
          signal: controller.signal,
        })
        const data = (await response.json()) as StationContext
        setContext(data)
      } catch {
        setContext({ ...emptyContext, city: selectedDj.city })
      }
    }
    loadContext()
    return () => controller.abort()
  }, [selectedDj.city])

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

  const playAudioUrl = useCallback((url: string) => {
    return new Promise<void>((resolve) => {
      const audio = breakAudioRef.current
      if (!audio) {
        resolve()
        return
      }
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      audio.loop = false
      audio.volume = 1
      audio.src = url
      audio.load()
      audio.play().catch(() => resolve())
    })
  }, [])

  const requestBreak = useCallback(async (index: number, kind: BreakKind) => {
    const activeTracks = tracksRef.current
    const track = activeTracks[index]
    const upcomingTrack = activeTracks[(index + 1) % activeTracks.length]
    const key = `${index}:${kind}:${track?.id || 'empty'}:${djRef.current.id}`
    const existing = preloadRef.current.get(key)
    if (existing) return existing

    const promise = (async (): Promise<BreakPlan> => {
      setBufferStatus('Writing next break')
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
          recentScript: nowScript,
        }),
      })
      const plan = (await breakResponse.json()) as BreakPlan
      setBufferStatus('Voicing next break')

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

      setBufferStatus('Next break loaded')
      return plan
    })().catch(() => {
      const fallback: BreakPlan = {
        kind,
        title: 'Live break',
        source: 'fallback',
        tease: 'Fallback script',
        script: `${djRef.current.name} here. That was ${track?.title || 'the last track'}, and up next we have ${upcomingTrack?.title || 'another cut'} on a ${contextRef.current.weather.toLowerCase()} day in ${djRef.current.city}.`,
      }
      setBufferStatus('Fallback break loaded')
      return fallback
    })

    preloadRef.current.set(key, promise)
    return promise
  }, [nowScript])

  const playBreakThenSong = useCallback(
    async (index: number, count: number) => {
      const activeTracks = tracksRef.current
      if (!activeTracks.length || stopRef.current) return

      const breakKind = selectBreakKind(count)
      setMode('loading')
      setStatus('Loading break')
      const breakPlan = await requestBreak(index, breakKind)
      if (stopRef.current) return

      setMode('break')
      setStatus(breakPlan.title)
      setNowScript(breakPlan.script)
      preloadStartedRef.current = null

      if (breakPlan.audioUrl) {
        await playAudioUrl(breakPlan.audioUrl)
      } else {
        await speakFallback(breakPlan.script)
      }

      if (stopRef.current) return

      const audio = songAudioRef.current
      const track = activeTracks[index]
      if (!audio || !track) return

      setMode('song')
      setStatus('On air')
      setCurrentIndex(index)
      audio.onended = () => {
        if (stopRef.current) return
        const nextIndex = (index + 1) % tracksRef.current.length
        const nextCount = count + 1
        setPlayCount(nextCount)
        playBreakThenSongRef.current(nextIndex, nextCount)
      }
      audio.ontimeupdate = () => {
        const remaining = audio.duration - audio.currentTime
        const nextIndex = (index + 1) % tracksRef.current.length
        const nextKind = selectBreakKind(count + 1)
        const preloadKey = `${nextIndex}:${nextKind}`
        if (Number.isFinite(remaining) && remaining < 45 && preloadStartedRef.current !== preloadKey) {
          preloadStartedRef.current = preloadKey
          requestBreak(nextIndex, nextKind)
        }
      }
      audio.onerror = () => {
        const nextIndex = (index + 1) % tracksRef.current.length
        const nextCount = count + 1
        setPlayCount(nextCount)
        playBreakThenSongRef.current(nextIndex, nextCount)
      }
      audio.loop = false
      audio.volume = 1
      if (audio.currentSrc !== track.url) {
        audio.src = track.url
        audio.load()
      }
      try {
        audio.currentTime = 0
      } catch {
        // Some remote files cannot seek until metadata is available.
      }
      await audio.play().catch(() => {
        setMode('idle')
        setStatus('Tap audio play to continue')
      })
    },
    [playAudioUrl, requestBreak, speakFallback],
  )

  useEffect(() => {
    playBreakThenSongRef.current = playBreakThenSong
  }, [playBreakThenSong])

  const startStation = useCallback(() => {
    if (!tracksRef.current.length) {
      setStatus('Add music first')
      return
    }
    const breakAudio = breakAudioRef.current
    if (breakAudio) {
      breakAudio.loop = true
      breakAudio.volume = 0
      breakAudio.src = silentAudioUrl
      breakAudio.play().catch(() => undefined)
    }
    const songAudio = songAudioRef.current
    const track = tracksRef.current[currentIndex]
    if (songAudio && track) {
      songAudio.loop = true
      songAudio.volume = 0
      songAudio.src = track.url
      songAudio.play().catch(() => undefined)
    }
    stopRef.current = false
    preloadRef.current.clear()
    setBufferStatus('Preparing first break')
    setPlayCount(0)
    playBreakThenSong(currentIndex, 0)
  }, [currentIndex, playBreakThenSong])

  const pauseStation = useCallback(() => {
    stopRef.current = true
    window.speechSynthesis?.cancel()
    breakAudioRef.current?.pause()
    songAudioRef.current?.pause()
    setMode('idle')
    setStatus('Paused')
  }, [])

  const skipTrack = useCallback(() => {
    stopRef.current = true
    breakAudioRef.current?.pause()
    songAudioRef.current?.pause()
    window.speechSynthesis?.cancel()
    const nextIndex = (currentIndex + 1) % tracksRef.current.length
    const nextCount = playCountRef.current + 1
    setCurrentIndex(nextIndex)
    setPlayCount(nextCount)
    stopRef.current = false
    playBreakThenSong(nextIndex, nextCount)
  }, [currentIndex, playBreakThenSong])

  const loadFolder = useCallback(async () => {
    setLibraryMessage('Scanning folder')
    try {
      const params = new URLSearchParams({ url: folderUrl })
      const response = await fetch(`/api/library?${params}`)
      const data = (await response.json()) as { tracks?: Track[]; error?: string }
      if (!response.ok || !data.tracks?.length) {
        setLibraryMessage(data.error || 'No playable audio links found')
        return
      }
      setTracks(data.tracks)
      setCurrentIndex(0)
      setLibraryMessage(`${data.tracks.length} tracks loaded`)
    } catch {
      setLibraryMessage('Folder scan failed')
    }
  }, [folderUrl])

  const addLocalFiles = useCallback((files: FileList | null) => {
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
    setTracks(nextTracks)
    setCurrentIndex(0)
    setLibraryMessage(`${nextTracks.length} local tracks loaded`)
  }, [])

  const saveCustomDj = useCallback(() => {
    const id = `custom-${Date.now()}`
    const nextDj = { ...draftDj, id }
    const nextCustomDjs = [...customDjs, nextDj]
    setCustomDjs(nextCustomDjs)
    localStorage.setItem('ai-dj-custom-djs', JSON.stringify(nextCustomDjs))
    setSelectedDjId(id)
    setIsCustomOpen(false)
  }, [customDjs, draftDj])

  return (
    <main className="appShell" style={{ '--dj-color': selectedDj.color } as CSSProperties}>
      <section className="topBar">
        <div className="brandLockup">
          <div className="brandMark">
            <Radio size={24} aria-hidden="true" />
          </div>
          <div>
            <h1>Airbreak</h1>
            <p>AI station desk</p>
          </div>
        </div>
        <div className="signalPill">
          <span className={onAir ? 'signalDot live' : 'signalDot'} />
          {status}
        </div>
      </section>

      <section className="consoleGrid">
        <section className="deckPanel">
          <div className="deckHeader">
            <div>
              <p className="eyebrow">Now playing</p>
              <h2>{currentTrack?.title || 'No track loaded'}</h2>
              <p>{currentTrack?.artist || 'Add a song source'}</p>
            </div>
            <div className="sourceBadge">{currentTrack?.source || 'empty'}</div>
          </div>

          <div className="visualDeck" aria-hidden="true">
            <div className={mode === 'song' ? 'record spinning' : 'record'}>
              <div className="recordLabel">
                <Disc3 size={34} />
              </div>
            </div>
            <div className="vuStack">
              {Array.from({ length: 16 }).map((_, index) => (
                <span key={index} style={{ animationDelay: `${index * 0.06}s` }} />
              ))}
            </div>
          </div>

          <div className="transportBar">
            <button className="primaryButton" type="button" onClick={onAir ? pauseStation : startStation}>
              {onAir ? <Pause size={20} /> : <Play size={20} />}
              {onAir ? 'Pause' : 'Start'}
            </button>
            <button className="iconButton" type="button" onClick={skipTrack} aria-label="Skip track">
              <SkipForward size={20} />
            </button>
            <audio ref={songAudioRef} controls preload="auto" />
            <audio ref={breakAudioRef} preload="auto" />
          </div>
        </section>

        <section className="hostPanel">
          <div className="hostCard">
            <div className="hostAvatar">
              <Mic2 size={34} />
            </div>
            <div>
              <p className="eyebrow">Virtual DJ</p>
              <h2>{selectedDj.name}</h2>
              <p>{selectedDj.handle}</p>
            </div>
          </div>

          <label>
            <span>DJ</span>
            <select value={selectedDjId} onChange={(event) => setSelectedDjId(event.target.value)}>
              {djs.map((dj) => (
                <option key={dj.id} value={dj.id}>
                  {dj.name}
                </option>
              ))}
            </select>
          </label>

          <div className="personaBlock">
            <div>
              <span>Format</span>
              <p>{selectedDj.format}</p>
            </div>
            <div>
              <span>Backstory</span>
              <p>{selectedDj.backstory}</p>
            </div>
          </div>

          <button className="secondaryButton" type="button" onClick={() => setIsCustomOpen((open) => !open)}>
            <Plus size={18} />
            Custom DJ
          </button>
        </section>
      </section>

      <section className="workbench">
        <section className="libraryPanel">
          <div className="sectionTitle">
            <Cloud size={20} />
            <h2>Library</h2>
          </div>
          <div className="folderRow">
            <input value={folderUrl} onChange={(event) => setFolderUrl(event.target.value)} />
            <button className="iconButton" type="button" onClick={loadFolder} aria-label="Load shared folder">
              <Cloud size={20} />
            </button>
          </div>
          <label className="fileDrop">
            <Upload size={20} />
            <span>Local audio</span>
            <input type="file" accept="audio/*" multiple onChange={(event) => addLocalFiles(event.target.files)} />
          </label>
          <p className="smallStatus">{libraryMessage || `${tracks.length} tracks in rotation`}</p>
          <div className="trackList">
            {tracks.map((track, index) => (
              <button
                key={track.id}
                className={index === currentIndex ? 'trackRow active' : 'trackRow'}
                type="button"
                onClick={() => setCurrentIndex(index)}
              >
                <Music2 size={17} />
                <span>
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="scriptPanel">
          <div className="sectionTitle">
            <Volume2 size={20} />
            <h2>Break Queue</h2>
          </div>
          <div className="breakReadout">
            {mode === 'loading' && <Loader2 className="spinIcon" size={20} />}
            <p>{nowScript || 'The first DJ break will appear here when the station starts.'}</p>
          </div>
          <div className="queueMeta">
            <span>{bufferStatus}</span>
            <span>{selectBreakKind(playCount)}</span>
          </div>
        </section>

        <section className="localPanel">
          <div className="sectionTitle">
            <MapPin size={20} />
            <h2>{context.city}</h2>
          </div>
          <p className="weatherLine">{context.weather}</p>
          <div className="headlineList">
            <Newspaper size={18} />
            <div>
              {(context.headlines.length ? context.headlines : ['Headlines will load with station context.']).map(
                (headline) => (
                  <p key={headline}>{headline}</p>
                ),
              )}
            </div>
          </div>
        </section>
      </section>

      {isCustomOpen && (
        <section className="customPanel">
          <div className="sectionTitle">
            <Mic2 size={20} />
            <h2>Custom DJ</h2>
          </div>
          <div className="formGrid">
            <label>
              <span>Name</span>
              <input value={draftDj.name} onChange={(event) => setDraftDj({ ...draftDj, name: event.target.value })} />
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
              <input value={draftDj.city} onChange={(event) => setDraftDj({ ...draftDj, city: event.target.value })} />
            </label>
            <label>
              <span>Voice</span>
              <select
                value={draftDj.voice}
                onChange={(event) => setDraftDj({ ...draftDj, voice: event.target.value as VoiceName })}
              >
                {voiceOptions.map((voice) => (
                  <option key={voice} value={voice}>
                    {voice}
                  </option>
                ))}
              </select>
            </label>
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
          </div>
          <button className="primaryButton" type="button" onClick={saveCustomDj}>
            <Save size={18} />
            Save DJ
          </button>
        </section>
      )}
    </main>
  )
}

export default App
