import type { BreakKind, DjProfile, StationContext, Track, VoiceName } from './types'

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
    style: 'Smart, intimate, slightly mysterious, turns song facts into tiny stories.',
    backstory:
      'Ada built a pirate-radio stream in college and now hosts from a converted print shop behind a theater.',
    color: '#8467d7',
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
  city: 'New York, NY',
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

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
