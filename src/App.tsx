import {
  Cloud,
  ListMusic,
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
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  breakKindLabels,
  defaultFolderUrl,
  djPalette,
  emptyContext,
  formatTime,
  initials,
  presetDjs,
  selectBreakKind,
  shuffleTracks,
  splitArtistTitle,
  voiceOptions,
} from './data'
import type { DjProfile, StationContext, Track, VoiceName } from './types'
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
  voice: 'marin',
  style: 'Friendly, witty, specific, concise, and natural on mic.',
  backstory: 'A station host who loves connecting songs to local life.',
  color: '#e0b13b',
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

  const djs = [...presetDjs, ...customDjs]
  const selectedDj = djs.find((dj) => dj.id === selectedDjId) || djs[0]

  const station = useStation(selectedDj, context, breakEvery)
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
    const interval = window.setInterval(() => setContextEpoch((epoch) => epoch + 1), 10 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

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

  const saveCustomDj = useCallback(() => {
    if (!draftDj.name.trim()) return
    const id = `custom-${Date.now()}`
    const nextDj = { ...draftDj, id, name: draftDj.name.trim() }
    const nextCustomDjs = [...customDjs, nextDj]
    setCustomDjs(nextCustomDjs)
    localStorage.setItem('ai-dj-custom-djs', JSON.stringify(nextCustomDjs))
    setSelectedDjId(id)
    setIsDjFormOpen(false)
    setDraftDj(blankDraft)
  }, [customDjs, draftDj])

  const deleteCustomDj = useCallback(
    (id: string) => {
      const nextCustomDjs = customDjs.filter((dj) => dj.id !== id)
      setCustomDjs(nextCustomDjs)
      localStorage.setItem('ai-dj-custom-djs', JSON.stringify(nextCustomDjs))
      if (selectedDjId === id) setSelectedDjId(presetDjs[0].id)
    },
    [customDjs, selectedDjId],
  )

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
            <Visualizer analyser={analyser} mode={mode} color={selectedDj.color}>
              <div className={mode === 'song' ? 'vinyl spinning' : 'vinyl'}>
                <span className="vinylLabel">{initials(selectedDj.name)}</span>
              </div>
            </Visualizer>

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
                        {dj.city} · voice “{dj.voice}”
                      </small>
                    </span>
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
              <p className="eyebrow">Backstory</p>
              <p>{selectedDj.backstory}</p>
            </div>

            <button
              className="secondaryButton"
              type="button"
              onClick={() => setIsDjFormOpen((open) => !open)}
            >
              <Plus size={18} />
              {isDjFormOpen ? 'Close editor' : 'Create a DJ'}
            </button>

            {isDjFormOpen && (
              <div className="djForm">
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
                <button className="primaryButton wideField" type="button" onClick={saveCustomDj}>
                  <Save size={18} />
                  Save DJ
                </button>
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
