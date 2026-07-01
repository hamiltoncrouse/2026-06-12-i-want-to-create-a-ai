import {
  CalendarDays,
  Check,
  ChevronDown,
  Cloud,
  Download,
  Headphones,
  ListMusic,
  Loader2,
  MapPin,
  Mic2,
  Music2,
  Newspaper,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Search,
  Send,
  SkipForward,
  Trash2,
  Upload,
  Users,
  UtensilsCrossed,
  Volume2,
  X,
} from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  blankVenue,
  breakKindLabels,
  cleanVenue,
  defaultDjId,
  defaultFolderUrl,
  djPalette,
  elevenVoiceLibrary,
  emptyContext,
  emptySteering,
  formatTime,
  initials,
  presetDjs,
  selectBreakKind,
  shuffleTracks,
  splitArtistTitle,
  voiceOptions,
} from './data'
import type {
  CoHostProfile,
  DjProfile,
  ListenerRequest,
  StationContext,
  Track,
  VenueProfile,
  VoiceName,
} from './types'

// Pretty display names for genre manifest files.
const genreLabelOverrides: Record<string, string> = {
  'punk-newwave': 'Punk / New Wave',
  standards: 'Great American Songbook',
  'humorous-novelty': 'Novelty',
}
function prettyGenre(file: string) {
  const base = file.replace(/\.json$/i, '')
  if (genreLabelOverrides[base]) return genreLabelOverrides[base]
  return base
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
// Genre files the app always offers (when reachable) even if the remote
// index.json has not been updated to list them yet.
const bundledGenreFiles = [
  'rock.json',
  'hard-rock.json',
  'prog-rock.json',
  'punk-newwave.json',
  'folk.json',
  'country.json',
  'jazz.json',
  'disco.json',
  'oldies.json',
  'musicals.json',
  'standards.json',
  'humorous-novelty.json',
  'grateful-dead-live.json',
]

// Curated playlists — a separate concept from genres. These are vibe-based sets;
// the labels override is for any name that title-casing doesn't capture well.
const playlistFiles = [
  'late-night-radio.json',
  'sunday-morning.json',
  'road-trip.json',
  'dance-floor.json',
  'pub-rowdy.json',
  'storytellers.json',
  'chill.json',
  'gym.json',
]
const playlistLabelOverrides: Record<string, string> = {
  'late-night-radio': 'Late Night Radio',
  'pub-rowdy': 'Pub Rowdy',
}
function prettyPlaylist(file: string) {
  const base = file.replace(/\.json$/i, '')
  if (playlistLabelOverrides[base]) return playlistLabelOverrides[base]
  return base
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
// A stable hue per playlist so each mood tile gets its own color identity.
function playlistHue(file: string) {
  let hash = 0
  for (const char of file) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 360
}

// Some genres show a logo instead of a text label on their chip.
function genreIcon(file: string) {
  const base = file.replace(/\.json$/i, '')
  if (base === 'grateful-dead-live') return <StealYourFace size={20} className="genreStealie" />
  return null
}
// A genre chip's contents: the logo when one exists, otherwise the name.
function GenreLabel({ file, label }: { file: string; label: string }) {
  const icon = genreIcon(file)
  if (icon) {
    return (
      <span className="genreChipIcon" role="img" aria-label={label} title={label}>
        {icon}
      </span>
    )
  }
  return <>{label}</>
}

// The folder the manifest and genre files live in.
const musicBase = new URL('.', defaultFolderUrl).toString()

// Normalize an artist name into a stable matching key (case- and "The"-folded)
// so "The Beatles" and "beatles" collapse to the same artist.
function normalizeArtist(name: string) {
  return (name || '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Narrow a track pool to a chosen set of artists. If the selection matches
// nothing in this pool (e.g. after a genre change), fall back to the whole
// pool so the station never goes silent.
function filterByArtists(pool: Track[], selectedKeys: string[]) {
  if (!selectedKeys.length) return pool
  const set = new Set(selectedKeys)
  const filtered = pool.filter((track) => set.has(normalizeArtist(track.artist)))
  return filtered.length ? filtered : pool
}

// Minimal shape of a Screen Wake Lock sentinel (avoids depending on DOM lib
// typings that aren't always present in the build).
type WakeLockLike = { release: () => Promise<void> }
import { useStation } from './useStation'
import { Visualizer } from './Visualizer'
import { StealYourFace } from './StealYourFace'
import { feedback } from './feedback'

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
  // Remember the chosen DJ across refreshes; fall back to Johnny on a first
  // visit (or if the saved DJ no longer exists).
  const [selectedDjId, setSelectedDjId] = useState(
    () => localStorage.getItem('ai-dj-selected') || defaultDjId,
  )
  const [context, setContext] = useState<StationContext>(emptyContext)
  const [contextEpoch, setContextEpoch] = useState(0)
  const [tab, setTab] = useState<Tab>('onair')
  const [folderUrl, setFolderUrl] = useState(defaultFolderUrl)
  const [libraryMessage, setLibraryMessage] = useState('')
  const [scanning, setScanning] = useState(false)
  // The full loaded pool (before the artist filter); the rotation shown by the
  // engine is this pool narrowed to the chosen artists.
  const [libraryPool, setLibraryPool] = useState<Track[]>([])
  const [selectedArtists, setSelectedArtists] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ai-dj-artists') || '[]') as string[]
    } catch {
      return []
    }
  })
  const [artistSearch, setArtistSearch] = useState('')
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
  const [genreList, setGenreList] = useState<{ file: string; label: string }[]>([])
  // Always start on "All" (everything); genre filtering is a per-session
  // choice that resets each time the app opens.
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  // Curated playlists are a separate lens from genres: a single chosen playlist
  // (its filename) takes over the rotation; null means "off, use genres."
  const [playlistList, setPlaylistList] = useState<{ file: string; label: string }[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [playlistsOpen, setPlaylistsOpen] = useState(false)
  const [previewingVoice, setPreviewingVoice] = useState(false)
  const [voicePreviewStatus, setVoicePreviewStatus] = useState('')
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewAudioUrlRef = useRef<string | null>(null)
  const djFormRef = useRef<HTMLDivElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [importMessage, setImportMessage] = useState('')

  // Preset DJs can be edited; the edits are stored as overrides and merged on
  // top of the built-in profile so they can also be reverted.
  const presetList = presetDjs.map((dj) => ({ ...dj, ...(djOverrides[dj.id] || {}) }))
  const djs = [...presetList, ...customDjs]
  const selectedDj =
    djs.find((dj) => dj.id === selectedDjId) ||
    djs.find((dj) => dj.id === defaultDjId) ||
    djs[0]

  const handleRequestsAired = useCallback((ids: string[]) => {
    setListenerRequests((requests) => requests.filter((request) => !ids.includes(request.id)))
  }, [])

  const station = useStation(
    selectedDj,
    context,
    breakEvery,
    listenerRequests,
    handleRequestsAired,
    emptySteering,
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

  // Mirror the artist selection and loaded pool into refs so the loaders can
  // apply the current filter without being recreated on every change.
  const selectedArtistsRef = useRef(selectedArtists)
  useEffect(() => {
    selectedArtistsRef.current = selectedArtists
  }, [selectedArtists])
  const libraryPoolRef = useRef(libraryPool)
  useEffect(() => {
    libraryPoolRef.current = libraryPool
  }, [libraryPool])

  // Every music load funnels through here: remember the full pool, then push
  // the artist-filtered, shuffled rotation into the engine.
  const commitLibrary = useCallback(
    (pool: Track[], shuffle = true) => {
      setLibraryPool(pool)
      const ordered = shuffle ? shuffleTracks(pool) : pool
      setLibrary(filterByArtists(ordered, selectedArtistsRef.current))
    },
    [setLibrary],
  )

  // Re-filter the already-loaded pool when the artist selection changes.
  const reapplyArtists = useCallback(
    (keys: string[]) => {
      const pool = libraryPoolRef.current
      if (pool.length) setLibrary(filterByArtists(shuffleTracks(pool), keys))
    },
    [setLibrary],
  )

  const persistArtists = useCallback((next: string[]) => {
    localStorage.setItem('ai-dj-artists', JSON.stringify(next))
  }, [])

  const toggleArtist = useCallback(
    (key: string) => {
      feedback('select')
      setSelectedArtists((current) => {
        const next = current.includes(key)
          ? current.filter((artist) => artist !== key)
          : [...current, key]
        persistArtists(next)
        reapplyArtists(next)
        return next
      })
    },
    [persistArtists, reapplyArtists],
  )

  const clearArtists = useCallback(() => {
    feedback('select')
    setSelectedArtists([])
    persistArtists([])
    reapplyArtists([])
  }, [persistArtists, reapplyArtists])

  // Distinct artists in the loaded pool, with a stable key and a display name.
  const artistOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>()
    for (const track of libraryPool) {
      const name = (track.artist || '').trim()
      if (!name || /^unknown artist$/i.test(name)) continue
      const key = normalizeArtist(name)
      const existing = map.get(key)
      if (existing) existing.count += 1
      else map.set(key, { key, name, count: 1 })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [libraryPool])

  const artistByKey = useMemo(
    () => new Map(artistOptions.map((option) => [option.key, option])),
    [artistOptions],
  )

  // The pickable artists (search-filtered, selected ones live in their own row).
  const visibleArtists = useMemo(() => {
    const query = artistSearch.trim().toLowerCase()
    const selected = new Set(selectedArtists)
    let list = artistOptions.filter((option) => !selected.has(option.key))
    if (query) list = list.filter((option) => option.name.toLowerCase().includes(query))
    return list.slice(0, 60)
  }, [artistOptions, artistSearch, selectedArtists])

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

  // Remember which DJ is on so a refresh keeps you where you were.
  useEffect(() => {
    localStorage.setItem('ai-dj-selected', selectedDjId)
  }, [selectedDjId])

  // When the editor opens (create or edit), bring it into view so you can
  // start typing without hunting for it down the page.
  useEffect(() => {
    if (!isDjFormOpen) return
    const id = window.setTimeout(() => {
      djFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    return () => window.clearTimeout(id)
  }, [isDjFormOpen, editingId])

  // Hold a screen wake lock while we're on the air so phones don't dim and
  // suspend audio mid-show. The lock is dropped automatically by the browser
  // if the tab is hidden, so we re-acquire it whenever the page is shown again.
  useEffect(() => {
    if (!isOnAir) return
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> }
    }
    if (!nav.wakeLock) return
    let sentinel: WakeLockLike | null = null
    let released = false
    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request('screen')
      } catch {
        // Ignore: wake lock is best-effort (denied in background, etc.).
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
    }
  }, [isOnAir])

  // Keep weather, news, and sports fresh during long listening sessions.
  useEffect(() => {
    const interval = window.setInterval(() => setContextEpoch((epoch) => epoch + 1), 4 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  // Build the genre picker from the app's known genre files plus anything the
  // remote index.json lists — but never from a playlist file, so playlists and
  // genres stay fully separate even if index.json gets repurposed. Each
  // candidate is probed so only genres that actually resolve are shown.
  useEffect(() => {
    let cancelled = false
    const playlistSet = new Set(playlistFiles)
    ;(async () => {
      const candidates = new Set(bundledGenreFiles)
      try {
        const response = await fetch(`${musicBase}index.json`)
        if (response.ok) {
          const obj = (await response.json()) as Record<string, number>
          for (const file of Object.keys(obj)) candidates.add(file)
        }
      } catch {
        // No index available; fall back to the known genre files.
      }
      for (const playlist of playlistSet) candidates.delete(playlist)
      const checked = await Promise.all(
        [...candidates].map(async (file) => {
          try {
            const probe = await fetch(`${musicBase}${file}`, { method: 'HEAD' })
            return probe.ok ? file : null
          } catch {
            return null
          }
        }),
      )
      if (cancelled) return
      const files = checked.filter((file): file is string => Boolean(file))
      if (!files.length) return
      const list = files
        .map((file) => ({ file, label: prettyGenre(file) }))
        .sort((a, b) => a.label.localeCompare(b.label))
      setGenreList(list)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Probe the curated playlists and list the ones that resolve (kept in the
  // order defined above so the lineup reads like a hand-built set).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const available = await Promise.all(
        playlistFiles.map(async (file) => {
          try {
            const probe = await fetch(`${musicBase}${file}`, { method: 'HEAD' })
            return probe.ok ? file : null
          } catch {
            return null
          }
        }),
      )
      if (cancelled) return
      setPlaylistList(
        available
          .filter((file): file is string => Boolean(file))
          .map((file) => ({ file, label: prettyPlaylist(file) })),
      )
    })()
    return () => {
      cancelled = true
    }
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
    feedback('play')
    if (isOnAir) pause()
    else if (mode === 'paused') resume()
    else start()
  }, [isOnAir, mode, pause, resume, start])

  const selectDj = useCallback((id: string) => {
    feedback('select')
    setSelectedDjId(id)
  }, [])

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
      commitLibrary(data.tracks)
      setLibraryMessage(`${data.tracks.length} tracks loaded, shuffled`)
    } catch {
      setLibraryMessage('Source scan failed')
    } finally {
      setScanning(false)
    }
  }, [commitLibrary, folderUrl])

  // Load the selected genres (or the whole library) into rotation. Genre files
  // and the full manifest both come through the library API, which parses the
  // rich per-track metadata; tracks are merged, de-duped, and shuffled.
  const loadGenres = useCallback(
    async (genres: string[]) => {
      setScanning(true)
      setLibraryMessage(genres.length ? 'Loading your genres' : 'Loading all music')
      const fetchTracks = async (sources: string[]) => {
        const urls = sources.length
          ? sources.map((file) => `${musicBase}${file}`)
          : [defaultFolderUrl]
        const lists = await Promise.all(
          urls.map(async (url) => {
            try {
              const response = await fetch(`/api/library?${new URLSearchParams({ url })}`)
              const data = (await response.json()) as { tracks?: Track[] }
              return response.ok && Array.isArray(data.tracks) ? data.tracks : []
            } catch {
              return []
            }
          }),
        )
        const seen = new Set<string>()
        const tracks: Track[] = []
        for (const list of lists) {
          for (const track of list) {
            if (!seen.has(track.url)) {
              seen.add(track.url)
              tracks.push(track)
            }
          }
        }
        // Which selected genre files came back empty (missing/404/no audio).
        const missing = sources.filter((_, index) => lists[index].length === 0)
        return { tracks, missing }
      }

      try {
        const { tracks, missing } = await fetchTracks(genres)
        if (tracks.length) {
          // Drop any genres that returned nothing so the picker reflects reality.
          if (missing.length) {
            const kept = genres.filter((genre) => !missing.includes(genre))
            setSelectedGenres(kept)
            setLibraryMessage(
              `${kept.length || 'All'} genre${kept.length === 1 ? '' : 's'} · ${tracks.length} tracks · ${missing
                .map(prettyGenre)
                .join(', ')} unavailable`,
            )
          } else {
            setLibraryMessage(
              genres.length
                ? `${genres.length} genre${genres.length > 1 ? 's' : ''} · ${tracks.length} tracks`
                : `All genres · ${tracks.length} tracks`,
            )
          }
          commitLibrary(tracks)
        } else if (genres.length) {
          // The whole selection is unavailable — fall back to everything so the
          // room never goes silent, and reset the picker to All.
          const all = await fetchTracks([])
          setSelectedGenres([])
          if (all.tracks.length) {
            commitLibrary(all.tracks)
            setLibraryMessage(
              `${missing.map(prettyGenre).join(', ')} unavailable — playing all · ${all.tracks.length} tracks`,
            )
          } else {
            setLibraryMessage('Could not load music right now')
          }
        } else {
          setLibraryMessage('Could not load music right now')
        }
      } finally {
        setScanning(false)
      }
    },
    [commitLibrary],
  )

  const toggleGenre = useCallback(
    (file: string) => {
      feedback('select')
      // Choosing a genre turns any active playlist off — they don't mix.
      setSelectedPlaylist(null)
      setSelectedGenres((current) => {
        const next = current.includes(file)
          ? current.filter((genre) => genre !== file)
          : [...current, file]
        loadGenres(next)
        return next
      })
    },
    [loadGenres],
  )

  const selectAllGenres = useCallback(() => {
    feedback('select')
    setSelectedPlaylist(null)
    setSelectedGenres([])
    loadGenres([])
  }, [loadGenres])

  // Picking a playlist takes over the rotation; picking it again turns it off
  // and falls back to "all genres." Genres and playlists never blend.
  const selectedPlaylistRef = useRef(selectedPlaylist)
  useEffect(() => {
    selectedPlaylistRef.current = selectedPlaylist
  }, [selectedPlaylist])

  const selectPlaylist = useCallback(
    (file: string) => {
      feedback('select')
      setSelectedGenres([])
      if (selectedPlaylistRef.current === file) {
        setSelectedPlaylist(null)
        loadGenres([])
      } else {
        setSelectedPlaylist(file)
        loadGenres([file])
      }
    },
    [loadGenres],
  )

  // Track the live selection so the DJ effect can avoid needless reloads.
  const selectedGenresRef = useRef(selectedGenres)
  useEffect(() => {
    selectedGenresRef.current = selectedGenres
  }, [selectedGenres])

  // A DJ can carry default genres (empty = all). Selecting a DJ loads its
  // genres; switching between DJs only reloads if the genre set actually
  // changes, so picking a same-genre DJ doesn't interrupt playback.
  const libraryLoadedRef = useRef(false)
  const djGenresKey = (selectedDj.genres ?? []).join(',')
  useEffect(() => {
    // A manually chosen playlist wins over a DJ's default genres — don't let
    // switching DJs yank the room off the playlist the user picked.
    if (libraryLoadedRef.current && selectedPlaylistRef.current) return
    const djGenres = djGenresKey ? djGenresKey.split(',') : []
    const same = djGenres.join(',') === selectedGenresRef.current.join(',')
    if (libraryLoadedRef.current && same) return
    libraryLoadedRef.current = true
    setSelectedGenres(djGenres)
    loadGenres(djGenres)
  }, [selectedDjId, djGenresKey, loadGenres])

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
      commitLibrary(nextTracks, false)
      setLibraryMessage(`${nextTracks.length} local tracks loaded`)
    },
    [commitLibrary],
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

  const toggleCoHost = useCallback(() => {
    setDraftDj((dj) => ({
      ...dj,
      coHost: dj.coHost ? null : { name: '', voice: 'echo', style: '' },
    }))
  }, [])

  const updateCoHost = useCallback((patch: Partial<CoHostProfile>) => {
    setDraftDj((dj) => ({
      ...dj,
      coHost: { name: '', voice: 'echo', ...(dj.coHost || {}), ...patch },
    }))
  }, [])

  const toggleDraftGenre = useCallback((file: string) => {
    setDraftDj((dj) => {
      const current = dj.genres ?? []
      const next = current.includes(file)
        ? current.filter((genre) => genre !== file)
        : [...current, file]
      return { ...dj, genres: next }
    })
  }, [])

  const clearDraftGenres = useCallback(() => {
    setDraftDj((dj) => ({ ...dj, genres: [] }))
  }, [])

  const saveDj = useCallback(() => {
    const name = draftDj.name.trim()
    if (!name) return
    // A venue with no name is treated as no venue at all.
    let venue = draftDj.venue ? cleanVenue(draftDj.venue) : null
    if (venue && !venue.name) venue = null
    // A co-host needs a name; otherwise drop it back to a solo show.
    let coHost = draftDj.coHost
      ? {
          name: draftDj.coHost.name.trim(),
          voice: draftDj.coHost.voice,
          style: (draftDj.coHost.style || '').trim() || undefined,
        }
      : null
    if (coHost && !coHost.name) coHost = null
    const cleaned = { ...draftDj, name, venue, coHost }
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

  // Save a DJ to a small JSON file the user can keep or share.
  const exportDj = useCallback((dj: DjProfile) => {
    const rest: Partial<DjProfile> = { ...dj }
    delete rest.id
    const payload = { type: 'airbreak-dj', version: 1, dj: rest }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const slug =
      dj.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'dj'
    const link = document.createElement('a')
    link.href = url
    link.download = `${slug}.airbreak-dj.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [])

  // Read a DJ JSON file and add it as a new custom DJ, then switch to it.
  const importDjFile = useCallback(
    async (file: File) => {
      setImportMessage('')
      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as
          | { type?: string; dj?: Partial<DjProfile> }
          | Partial<DjProfile>
        // Accept either our wrapped export or a bare DJ object.
        const raw = (parsed && 'dj' in parsed && parsed.dj ? parsed.dj : parsed) as Partial<DjProfile>
        if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) {
          setImportMessage("That file doesn't look like a DJ.")
          return
        }
        const id = `custom-${Date.now()}`
        const venue = raw.venue ? cleanVenue(raw.venue) : null
        const imported: DjProfile = {
          ...blankDraft,
          ...raw,
          venue: venue && venue.name ? venue : null,
          id,
        }
        persistCustom([...customDjs, imported])
        setSelectedDjId(id)
        setImportMessage(`Imported “${imported.name}.”`)
      } catch {
        setImportMessage("Couldn't read that file — make sure it's a DJ export.")
      }
    },
    [customDjs, persistCustom],
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

  const progressPct = progress.duration ? (progress.time / progress.duration) * 100 : 0
  const volumePct = volume * 100

  return (
    <div className="app" style={{ '--dj': selectedDj.color } as CSSProperties}>
      <div className="grain" aria-hidden="true" />
      <header className="topBar">
        <div className="brand">
          <span className="brandMark">
            <Radio size={18} aria-hidden="true" />
          </span>
          <span className="brandStack">
            <span className="brandName">Airbreak</span>
            <span className="brandFreq">{selectedDj.stationName || 'AI Radio'}</span>
          </span>
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
              <span
                className={mode === 'song' ? 'tonearm playing' : 'tonearm'}
                aria-hidden="true"
              />
              {bloomKey > 0 && <span key={bloomKey} className="bloom" aria-hidden="true" />}
            </div>

            <div className="nowPlaying">
              <p className="eyebrow">{mode === 'break' ? 'Coming up' : 'Now playing'}</p>
              <h1>{currentTrack?.title || 'No track loaded'}</h1>
              <p className="artistLine">{currentTrack?.artist || 'Load some music to begin'}</p>
            </div>

            {nextTrack && nextTrack.id !== currentTrack?.id && (
              <div className="ticker" aria-label="Up next">
                <span className="tickerTag">Up next</span>
                <span className="tickerText">
                  {nextTrack.title} — {nextTrack.artist}
                </span>
              </div>
            )}

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

            <div className="djRail" role="group" aria-label="Switch DJ">
              {djs.map((dj) => (
                <button
                  key={dj.id}
                  type="button"
                  className={dj.id === selectedDj.id ? 'railDj active' : 'railDj'}
                  onClick={() => selectDj(dj.id)}
                  aria-pressed={dj.id === selectedDj.id}
                  title={dj.name}
                >
                  <span className="railAvatar" style={{ background: dj.color }}>
                    {initials(dj.name)}
                  </span>
                  <span className="railName">{dj.name.split(' ')[0]}</span>
                </button>
              ))}
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

            <div className="genrePanel">
              <div className="steeringHeader">
                <span className="upNextLabel">
                  <Music2 size={13} aria-hidden="true" />
                  Genres
                </span>
                {scanning && <Loader2 className="spinIcon" size={15} aria-hidden="true" />}
              </div>
              <div className="genreOptions">
                <button
                  type="button"
                  className={
                    selectedGenres.length === 0 && !selectedPlaylist
                      ? 'genreChip active'
                      : 'genreChip'
                  }
                  onClick={selectAllGenres}
                  disabled={scanning}
                >
                  All
                </button>
                {genreList.map((genre) => (
                  <button
                    key={genre.file}
                    type="button"
                    className={selectedGenres.includes(genre.file) ? 'genreChip active' : 'genreChip'}
                    onClick={() => toggleGenre(genre.file)}
                    disabled={scanning}
                  >
                    <GenreLabel file={genre.file} label={genre.label} />
                  </button>
                ))}
              </div>
            </div>

            {playlistList.length > 0 && (
              <div className="playlistPanel">
                <button
                  type="button"
                  className="playlistToggle"
                  onClick={() => setPlaylistsOpen((open) => !open)}
                  aria-expanded={playlistsOpen}
                >
                  <span className="upNextLabel">
                    <ListMusic size={13} aria-hidden="true" />
                    Playlists
                  </span>
                  {selectedPlaylist && (
                    <span className="playlistActiveTag">{prettyPlaylist(selectedPlaylist)}</span>
                  )}
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={playlistsOpen ? 'playlistChevron open' : 'playlistChevron'}
                  />
                </button>
                {playlistsOpen && (
                  <div className="playlistOptions">
                    {playlistList.map((playlist) => (
                      <button
                        key={playlist.file}
                        type="button"
                        className={
                          selectedPlaylist === playlist.file
                            ? 'playlistTile active'
                            : 'playlistTile'
                        }
                        style={{ '--pl-hue': playlistHue(playlist.file) } as CSSProperties}
                        onClick={() => selectPlaylist(playlist.file)}
                        disabled={scanning}
                      >
                        <span className="playlistTileName">{playlist.label}</span>
                        <span className="playlistTileSub">
                          {selectedPlaylist === playlist.file ? 'Now spinning' : 'Curated set'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
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
                  <button
                    className="djSelect"
                    type="button"
                    onClick={() => selectDj(dj.id)}
                    aria-pressed={dj.id === selectedDj.id}
                  >
                    <span className="djAvatar large" style={{ background: dj.color }}>
                      {initials(dj.name)}
                      {dj.id === selectedDj.id && (
                        <span className="djAvatarCheck" aria-hidden="true">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="djMeta">
                      <strong>
                        {dj.name}
                        {dj.id === selectedDj.id && (
                          <span className="djOnAirBadge">
                            <Radio size={11} strokeWidth={2.5} aria-hidden="true" />
                            On air
                          </span>
                        )}
                      </strong>
                      <small>
                        {dj.handle}
                        {dj.coHost?.name ? ` · with ${dj.coHost.name}` : ''}
                      </small>
                      <small className="djTags">
                        {dj.city} · {dj.stationName || 'Airbreak'} · voice “{dj.voice}”
                        {dj.coHost?.name ? ` + “${dj.coHost.voice}”` : ''}
                        {djOverrides[dj.id] ? ' · edited' : ''}
                      </small>
                    </span>
                  </button>
                  <button
                    className="djEdit"
                    type="button"
                    onClick={() => exportDj(dj)}
                    aria-label={`Export ${dj.name}`}
                  >
                    <Download size={16} />
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

            <div className="djFormActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => (isDjFormOpen ? closeDjForm() : startCreate())}
              >
                <Plus size={18} />
                {isDjFormOpen ? 'Close editor' : 'Create a DJ'}
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={18} />
                Import a DJ
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) importDjFile(file)
                  event.target.value = ''
                }}
              />
            </div>
            {importMessage && <p className="smallStatus">{importMessage}</p>}

            {isDjFormOpen && (
              <div className="djForm" ref={djFormRef}>
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
                <label>
                  <span>ElevenLabs voice</span>
                  <select
                    value={draftDj.elevenVoice || ''}
                    onChange={(event) =>
                      setDraftDj({ ...draftDj, elevenVoice: event.target.value || undefined })
                    }
                  >
                    <option value="">Default (match voice name)</option>
                    {elevenVoiceLibrary.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                    {draftDj.elevenVoice &&
                      !elevenVoiceLibrary.some((voice) => voice.id === draftDj.elevenVoice) && (
                        <option value={draftDj.elevenVoice}>
                          Current ({draftDj.elevenVoice.slice(0, 8)}…)
                        </option>
                      )}
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
                    className={draftDj.coHost ? 'freqChip active' : 'freqChip'}
                    onClick={toggleCoHost}
                  >
                    <Users size={15} />
                    {draftDj.coHost ? 'Co-host: on' : 'Add a co-host'}
                  </button>
                </div>
                {draftDj.coHost && (
                  <>
                    <p className="hintLine wideField">
                      Two hosts share the mic: breaks become a live back-and-forth, each host in
                      their own voice.
                    </p>
                    <label>
                      <span>Co-host name</span>
                      <input
                        value={draftDj.coHost.name}
                        onChange={(event) => updateCoHost({ name: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Co-host voice</span>
                      <select
                        value={draftDj.coHost.voice}
                        onChange={(event) =>
                          updateCoHost({ voice: event.target.value as VoiceName })
                        }
                      >
                        {voiceOptions.map((voice) => (
                          <option key={voice} value={voice}>
                            {voice}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="wideField">
                      <span>Co-host style</span>
                      <input
                        value={draftDj.coHost.style || ''}
                        onChange={(event) => updateCoHost({ style: event.target.value })}
                        placeholder="e.g. dry, sarcastic sidekick who pokes holes in everything"
                      />
                    </label>
                  </>
                )}

                {genreList.length > 0 && (
                  <div className="wideField">
                    <span className="fieldLabel">Genres this DJ opens with</span>
                    <div className="genreOptions">
                      <button
                        type="button"
                        className={
                          (draftDj.genres?.length ?? 0) === 0 ? 'genreChip active' : 'genreChip'
                        }
                        onClick={clearDraftGenres}
                      >
                        All
                      </button>
                      {genreList.map((genre) => (
                        <button
                          key={genre.file}
                          type="button"
                          className={
                            draftDj.genres?.includes(genre.file) ? 'genreChip active' : 'genreChip'
                          }
                          onClick={() => toggleDraftGenre(genre.file)}
                        >
                          <GenreLabel file={genre.file} label={genre.label} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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

            <div className="artistPanel">
              <div className="steeringHeader">
                <span className="upNextLabel">
                  <Users size={13} aria-hidden="true" />
                  Artists
                </span>
                <button
                  type="button"
                  className="resetSteering"
                  onClick={clearArtists}
                  disabled={!selectedArtists.length}
                >
                  All artists
                </button>
              </div>
              <p className="hintLine">
                Pick the artists you want and the station plays only them. Leave empty for
                everything.
              </p>
              {selectedArtists.length > 0 && (
                <div className="artistSelected">
                  {selectedArtists.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="artistChip selected"
                      onClick={() => toggleArtist(key)}
                      title="Remove"
                    >
                      <span>{artistByKey.get(key)?.name || key}</span>
                      <X size={13} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
              {artistOptions.length > 0 && (
                <>
                  <div className="artistSearch">
                    <Search size={15} aria-hidden="true" />
                    <input
                      value={artistSearch}
                      onChange={(event) => setArtistSearch(event.target.value)}
                      placeholder={`Search ${artistOptions.length} artists…`}
                      aria-label="Search artists"
                    />
                  </div>
                  <div className="artistOptions">
                    {visibleArtists.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className="artistChip"
                        onClick={() => toggleArtist(option.key)}
                      >
                        {option.name}
                      </button>
                    ))}
                    {!visibleArtists.length && (
                      <span className="hintLine">No artists match “{artistSearch}”.</span>
                    )}
                  </div>
                </>
              )}
              <p className="smallStatus">
                {selectedArtists.length
                  ? `${selectedArtists.length} artist${selectedArtists.length > 1 ? 's' : ''} · ${tracks.length} track${tracks.length === 1 ? '' : 's'} in rotation`
                  : `All artists · ${tracks.length} tracks`}
              </p>
            </div>

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

      {tab !== 'onair' && currentTrack && mode !== 'idle' && (
        <div className="miniPlayer">
          <button
            className="miniOpen"
            type="button"
            onClick={() => setTab('onair')}
            aria-label="Open the player"
          >
            <span
              className={mode === 'song' ? 'miniDisc spinning' : 'miniDisc'}
              style={{ '--dj': selectedDj.color } as CSSProperties}
            />
            <span className="miniMeta">
              <strong>
                {mode === 'break' || mode === 'loading'
                  ? `${selectedDj.name} on the mic`
                  : currentTrack.title}
              </strong>
              <small>
                {mode === 'break' || mode === 'loading'
                  ? selectedDj.stationName || 'Airbreak'
                  : currentTrack.artist}
              </small>
            </span>
          </button>
          <button
            className="miniBtn"
            type="button"
            onClick={handleToggle}
            aria-label={isOnAir ? 'Pause station' : 'Start station'}
          >
            {isOnAir ? <Pause size={19} /> : <Play size={19} className="playGlyph" />}
          </button>
          <button className="miniBtn" type="button" onClick={skip} aria-label="Skip track">
            <SkipForward size={17} />
          </button>
        </div>
      )}

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
