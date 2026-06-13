import type {
  BreakKind,
  DjProfile,
  ProducedSpot,
  SessionSteering,
  StationContext,
  Track,
  VoiceName,
} from './types'

export const defaultFolderUrl = 'https://mwalk.neocities.org/music/manifest.json'

export const demoTracks: Track[] = [
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

export const presetDjs: DjProfile[] = [
  {
    id: 'johnny-london',
    name: 'Johnny London',
    handle: 'WICH morning-drive legend',
    format: 'personality radio, oldies, community bulletins, local sports, and Norwich stories',
    city: 'Norwich, CT',
    stationName: 'WICH 1310 AM',
    callsign: 'W I C H',
    voice: 'ash',
    style:
      'Classic Eastern Connecticut morning-drive jock: warm, quick, neighborly, confident, funny without being slick, and always rooted in Norwich. He naturally drops in local sponsors and civic traditions when they fit, especially Blue Ribbon Pontiac, Joe Goldberg, and the Rose Arts Festival.',
    backstory:
      'Johnny London, born Jean Gildart, was the #1 morning drive personality in Eastern Connecticut through the 1970s, 1980s, and 1990s. He helped define WICH 1310 AM Personality Radio in Norwich, Connecticut: a 5,000-watt community station with roots back to September 1946, originally WNOC. Johnny is remembered for his 1973 fifty-four-hour continuous record-spinning endurance marathon for local youth football, his crusade to help save the historic Wauregan Hotel, and a 1997 radiothon that kept a historic Abraham Lincoln banner in Norwich. He knows Tower Hill Road, the three-tower array, Hall Communications, and the old-school WICH lineup, including Stu Bryer and Potpourri. He loves talking about Blue Ribbon Pontiac at 400 West Thames Street and owner Joe Goldberg, and he brings up the Rose Arts Festival like a hometown ritual: music acts all over town, the Pancake Breakfast, and the Rotary Club volunteers making it happen.',
    color: '#f45d48',
  },
  {
    id: 'mona',
    name: 'Mona Vinyl',
    handle: 'Soul radio lifer',
    format: 'soul, disco, funk, jazz-pop, and golden-hour grooves',
    city: 'Philadelphia, PA',
    stationName: 'WPHL Soul 97',
    callsign: 'W P H L',
    voice: 'coral',
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
    stationName: 'KATX Night Signal',
    callsign: 'K A T X',
    voice: 'nova',
    style: 'Smart, intimate, slightly mysterious, turns song facts into tiny stories.',
    backstory:
      'Ada built a pirate-radio stream in college and now hosts from a converted print shop behind a theater.',
    color: '#8467d7',
  },
  {
    id: 'calvin-stone',
    name: 'Calvin Stone',
    handle: 'Flint hometown drive-time host',
    format: 'Motown, classic rock, blue-collar soul, local sports, and Friday-night requests',
    city: 'Flint, MI',
    stationName: 'WFLT 1420',
    callsign: 'W F L T',
    voice: 'echo',
    style:
      'Grounded Flint radio voice: steady, good-humored, direct, working-class, and proud of the city without turning sentimental.',
    backstory:
      'Calvin came up board-oping high school football remotes, union hall fundraisers, and late-night request shows around Genesee County. He talks about records like someone who heard them from a dashboard speaker outside a diner after second shift.',
    color: '#3b9ce0',
  },
  {
    id: 'tasha-lake',
    name: 'Tasha Lake',
    handle: 'Great Lakes pop and R&B host',
    format: 'R&B, pop throwbacks, dance-floor favorites, and crisp lake-effect weather hits',
    city: 'Milwaukee, WI',
    stationName: 'WMKE Coast 106',
    callsign: 'W M K E',
    voice: 'shimmer',
    style:
      'Bright, fast, stylish, and conversational; sounds like a friend with perfect timing and a deep crate of hooks.',
    backstory:
      'Tasha started in street-team promotions, learned production cutting club liners, and now runs a high-energy show built around listener shout-outs and sharp song-to-song momentum.',
    color: '#d75f9e',
  },
  {
    id: 'ray-santos',
    name: 'Ray Santos',
    handle: 'West Coast night-shift selector',
    format: 'classic hip-hop, lowrider soul, Latin rock, and midnight dedications',
    city: 'Los Angeles, CA',
    stationName: 'KSONO 990',
    callsign: 'K S O N O',
    voice: 'onyx',
    style:
      'Low, smooth, cinematic, and unhurried; makes every segue feel like a story from a neon-lit boulevard.',
    backstory:
      'Ray learned radio producing overnight dedication shows and weekend car-club remotes. He keeps the energy relaxed but never sleepy, with a soft spot for songs that sound best after midnight.',
    color: '#e07a3b',
  },
]

export const voiceOptions: VoiceName[] = [
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

export const djPalette = [
  '#f45d48',
  '#e0b13b',
  '#1f9d8a',
  '#3b9ce0',
  '#8467d7',
  '#d75f9e',
  '#7bc950',
  '#e07a3b',
]

export const emptyContext: StationContext = {
  city: 'Norwich, CT',
  weather: 'Weather unavailable',
  headlines: [],
  generatedAt: '',
}

export const breakKindLabels: Record<BreakKind, string> = {
  intro: 'Show open',
  songTalk: 'Song talk',
  newsWeather: 'News & weather',
  commercial: 'Sponsor spot',
  bumper: 'Station bumper',
  caller: 'Caller request',
}

// Station transition beds are generated once by scripts/generate-sfx.mjs (via
// the ElevenLabs Sound Effects API) into public/sfx/, then reused at runtime —
// no real-time generation. Each category holds several prompt variations; the
// generator renders `count` files per category and the player picks at random.
export type SfxCategory = { count: number; durationSeconds: number; prompts: string[] }

export const sfxCategories: Record<string, SfxCategory> = {
  impact: {
    count: 6,
    durationSeconds: 1.5,
    prompts: [
      'Punchy radio station imaging stinger: a fast whoosh sweeping down into a deep bass boom impact, clean and produced, no music, no voice.',
      'Hard-hitting radio drop: short reverse swell into a sub-bass slam with a metallic tail, no music, no voice.',
      'Bright broadcast impact: quick airy whoosh into a tight punchy boom, energetic station imaging, no music, no voice.',
      'Cinematic radio bumper hit: deep boom with a short downward whoosh and a clean tail, no music, no voice.',
    ],
  },
  sweep: {
    count: 8,
    durationSeconds: 1.1,
    prompts: [
      'Short radio transition whoosh sweeping downward into a song, smooth airy noise sweep, no music, no voice.',
      'Quick noise sweep transition, soft airy downward whoosh, clean radio imaging, no music, no voice.',
      'Filtered white-noise sweep sliding down into a beat, modern radio transition, no music, no voice.',
      'Light breezy whoosh transition between songs, smooth and short, no music, no voice.',
    ],
  },
  riser: {
    count: 4,
    durationSeconds: 1.3,
    prompts: [
      'Quick upward riser sweep building into a drop, energetic radio imaging transition, no music, no voice.',
      'Rising noise swell building tension into a cut, bright radio transition, no music, no voice.',
      'Short ascending whoosh riser into an impact, punchy station imaging, no music, no voice.',
    ],
  },
  scratch: {
    count: 2,
    durationSeconds: 1,
    prompts: [
      'Single quick vinyl record scratch transition, clean turntablist zip, no music, no voice.',
      'Short DJ vinyl rewind and scratch, crisp and punchy, no music, no voice.',
    ],
  },
}

// Pre-produced advertisements keyed by DJ id. When a commercial break comes up
// for that DJ, one of these airs instead of an AI-written spot. The host lines
// are voiced live in the DJ's voice; the "spot" parts play fixed assets.
export const djSpots: Record<string, ProducedSpot[]> = {
  'johnny-london': [
    {
      id: 'blue-ribbon-joe-goldberg',
      title: 'Blue Ribbon Pontiac — Joe Goldberg',
      parts: [
        {
          speaker: 'dj',
          text: "Alright, you know what time it is. Let's check in with our good friend Joe Goldberg down at Blue Ribbon Pontiac. Let me give him a ring.",
        },
        { speaker: 'spot', audioUrl: '/audio/phone-ring.mp3' },
        { speaker: 'spot', audioUrl: '/audio/joegoldberg.mp3' },
        {
          speaker: 'dj',
          text: "Ha ha, that is Joe Goldberg, Blue Ribbon Pontiac, four hundred West Thames Street right here in Norwich. Thanks, Joe. Alright, back to the music.",
        },
      ],
    },
  ],
}

export type SfxManifest = Record<string, string[]>

// Which transition category each break kind opens with (null = none).
export const breakSfxCategory: Record<BreakKind, keyof typeof sfxCategories | null> = {
  intro: 'riser',
  songTalk: null,
  newsWeather: 'sweep',
  commercial: 'sweep',
  bumper: 'impact',
  caller: 'scratch',
}

export const emptySteering: SessionSteering = {
  targetMoods: [],
  targetGenres: [],
  avoidGenres: [],
  avoidMoods: [],
  avoidArtists: [],
  tempos: [],
  dayparts: [],
}

export const steeringPresets: {
  id: string
  label: string
  steering: Partial<SessionSteering>
}[] = [
  {
    id: 'late-night',
    label: 'Late night',
    steering: {
      targetMoods: ['late-night', 'smooth', 'warm', 'reflective'],
      tempos: ['slow', 'mid'],
      energyRange: [1, 3],
      dayparts: ['late-night', 'evening'],
      note: 'Keep the hour warmer, smoother, and more after-dark.',
    },
  },
  {
    id: 'gym',
    label: 'Gym',
    steering: {
      targetMoods: ['upbeat', 'bright', 'dance-floor'],
      tempos: ['upbeat', 'fast'],
      energyRange: [4, 5],
      note: 'Keep the momentum high and avoid sleepy segues.',
    },
  },
  {
    id: 'familiar',
    label: 'Familiar',
    steering: {
      targetMoods: ['familiar', 'warm'],
      targetGenres: ['classic hits', 'pop rock', 'soul'],
      note: 'Favor familiar, easy-to-recognize records.',
    },
  },
  {
    id: 'deep-cuts',
    label: 'Deep cuts',
    steering: {
      avoidMoods: ['familiar'],
      note: 'Lean a little less obvious without losing the station flow.',
    },
  },
]

export function formatTrackName(name: string) {
  return decodeURIComponent(name)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitArtistTitle(name: string) {
  const cleaned = formatTrackName(name)
  const parts = cleaned.split(/\s+-\s+/)
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') }
  }
  return { artist: 'Unknown Artist', title: cleaned || 'Untitled Track' }
}

// A real-station clock: song talk, sweepers, spots, calls, and news rotate.
const breakRotation: BreakKind[] = [
  'songTalk',
  'bumper',
  'commercial',
  'caller',
  'songTalk',
  'newsWeather',
  'bumper',
  'songTalk',
]

export function selectBreakKind(playCount: number): BreakKind {
  if (playCount === 0) return 'intro'
  return breakRotation[(playCount - 1) % breakRotation.length]
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function shuffleTracks<T>(list: T[]): T[] {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function normalizeSteeringTerm(value: string) {
  return value.trim().toLowerCase()
}

export function uniqueTerms(values: string[]) {
  return [...new Set(values.map(normalizeSteeringTerm).filter(Boolean))]
}

export function mergeSteering(
  current: SessionSteering,
  next: Partial<SessionSteering>,
): SessionSteering {
  return {
    targetMoods: uniqueTerms([...(current.targetMoods || []), ...(next.targetMoods || [])]),
    targetGenres: uniqueTerms([...(current.targetGenres || []), ...(next.targetGenres || [])]),
    avoidGenres: uniqueTerms([...(current.avoidGenres || []), ...(next.avoidGenres || [])]),
    avoidMoods: uniqueTerms([...(current.avoidMoods || []), ...(next.avoidMoods || [])]),
    avoidArtists: uniqueTerms([...(current.avoidArtists || []), ...(next.avoidArtists || [])]),
    tempos: uniqueTerms([...(current.tempos || []), ...(next.tempos || [])]),
    dayparts: uniqueTerms([...(current.dayparts || []), ...(next.dayparts || [])]),
    energyRange: next.energyRange || current.energyRange,
    note: next.note || current.note,
    updatedAt: Date.now(),
  }
}

export function hasSteering(steering: SessionSteering) {
  return Boolean(
    steering.targetMoods.length ||
      steering.targetGenres.length ||
      steering.avoidGenres.length ||
      steering.avoidMoods.length ||
      steering.avoidArtists.length ||
      steering.tempos.length ||
      steering.dayparts.length ||
      steering.energyRange,
  )
}

function termsFromTrack(track: Track, field: 'genre' | 'mood' | 'requestTags' | 'dayparts') {
  return (track[field] || []).map(normalizeSteeringTerm)
}

function termOverlap(trackTerms: string[], steeringTerms: string[]) {
  if (!trackTerms.length || !steeringTerms.length) return 0
  return steeringTerms.filter((term) =>
    trackTerms.some((trackTerm) => trackTerm === term || trackTerm.includes(term)),
  ).length
}

export function dominantGenre(track?: Track) {
  return track?.genre?.[0] || track?.requestTags?.find((tag) => tag.length <= 20) || ''
}

export function steeringLabels(steering: SessionSteering) {
  const labels = [
    ...steering.targetMoods,
    ...steering.targetGenres,
    ...steering.tempos,
    ...steering.dayparts,
    ...(steering.energyRange ? [`energy ${steering.energyRange[0]}-${steering.energyRange[1]}`] : []),
    ...steering.avoidGenres.map((term) => `no ${term}`),
    ...steering.avoidMoods.map((term) => `less ${term}`),
    ...steering.avoidArtists.map((term) => `skip ${term}`),
  ]
  return labels.slice(0, 5)
}

export function scoreTrackForSteering(
  track: Track,
  steering: SessionSteering,
  recentTrackIds: string[] = [],
  recentArtists: string[] = [],
) {
  const genres = termsFromTrack(track, 'genre')
  const moods = termsFromTrack(track, 'mood')
  const tags = termsFromTrack(track, 'requestTags')
  const dayparts = termsFromTrack(track, 'dayparts')
  const artist = normalizeSteeringTerm(track.artist || '')
  const tempo = normalizeSteeringTerm(track.tempo || '')
  const allTerms = [...genres, ...moods, ...tags]

  let score = Number.isFinite(track.weight) ? Number(track.weight) : 1

  const avoidedGenreHits = termOverlap([...genres, ...tags], steering.avoidGenres)
  const avoidedMoodHits = termOverlap([...moods, ...tags], steering.avoidMoods)
  const avoidedArtist = steering.avoidArtists.some((term) => artist === term || artist.includes(term))
  if (avoidedGenreHits || avoidedMoodHits || avoidedArtist) score -= 1000

  score += termOverlap([...moods, ...tags], steering.targetMoods) * 14
  score += termOverlap([...genres, ...tags], steering.targetGenres) * 12
  score += termOverlap(dayparts, steering.dayparts) * 5
  if (steering.tempos.length && steering.tempos.includes(tempo)) score += 8
  if (steering.energyRange && typeof track.energy === 'number') {
    const [min, max] = steering.energyRange
    if (track.energy >= min && track.energy <= max) score += 12
    else score -= Math.min(12, Math.abs(track.energy - (track.energy < min ? min : max)) * 5)
  }

  if (track.metadataConfidence === 'low') score -= 1
  if (recentTrackIds.includes(track.id)) score -= 80
  if (recentArtists.includes(artist)) score -= 18
  if (!allTerms.length && hasSteering(steering)) score -= 4
  // Stable per-track jitter (not Math.random): keeps ordering varied between
  // tracks while staying identical across the preload and air-time calls, so a
  // break voiced during the song still matches what airs. Random jitter here
  // made the two calls disagree and forced canned fallbacks.
  return score + (seedHash(track.id) % 1000) / 1000 * 3
}

function seedHash(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash
}

export function pickCompanionVoice(exclude: VoiceName | VoiceName[], seed: string): VoiceName {
  const excluded = new Set(Array.isArray(exclude) ? exclude : [exclude])
  const pool = voiceOptions.filter((voice) => !excluded.has(voice))
  return pool[seedHash(seed) % pool.length] || voiceOptions[0]
}

export function imagingVoice(djVoice: VoiceName): VoiceName {
  return djVoice === 'onyx' ? 'ash' : 'onyx'
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
