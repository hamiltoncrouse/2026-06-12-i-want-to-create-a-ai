export type VoiceName =
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

export type Track = {
  id: string
  title: string
  artist: string
  url: string
  source: 'demo' | 'folder' | 'local'
  album?: string
  year?: number
  genre?: string[]
  mood?: string[]
  energy?: number
  tempo?: 'slow' | 'mid' | 'upbeat' | 'fast' | string
  durationSec?: number
  introSec?: number
  outroSec?: number
  facts?: string[]
  djNotes?: string
  requestTags?: string[]
  dayparts?: string[]
  weight?: number
  metadataConfidence?: 'high' | 'medium' | 'low' | string
}

export type DjProfile = {
  id: string
  name: string
  handle: string
  format: string
  city: string
  stationName?: string
  callsign?: string
  voice: VoiceName
  style: string
  backstory: string
  color: string
}

export type StationContext = {
  city: string
  weather: string
  headlines: string[]
  sports?: string[]
  facts?: string
  timezone?: string
  generatedAt: string
}

export type ListenerRequest = {
  id: string
  text: string
  at: string
}

export type SessionSteering = {
  targetMoods: string[]
  targetGenres: string[]
  avoidGenres: string[]
  avoidMoods: string[]
  avoidArtists: string[]
  tempos: string[]
  dayparts: string[]
  energyRange?: [number, number]
  note?: string
  updatedAt?: number
}

export type UsageTip = {
  id: string
  feature: 'requestLine' | 'steering' | 'customDj' | 'voicePreview'
  text: string
}

export type BreakKind =
  | 'intro'
  | 'songTalk'
  | 'newsWeather'
  | 'commercial'
  | 'bumper'
  | 'caller'

export type BreakSpeaker = 'dj' | 'caller' | 'reporter' | 'imaging' | 'spot'

// A pre-produced advertisement attached to a DJ: the host's lines are voiced
// at runtime; the "spot" parts play fixed audio assets (phone ring, a guest's
// recording) bundled with the app. Host parts carry a pool of line variants so
// the framing varies from airing to airing.
export type SpotPart = { speaker: 'dj'; texts: string[] } | { speaker: 'spot'; audioUrl: string }

export type ProducedSpot = { id: string; title: string; parts: SpotPart[] }

export type BreakSegment = {
  speaker: BreakSpeaker
  text: string
  audioUrl?: string
}

export type BreakPlan = {
  kind: BreakKind
  title: string
  script: string
  tease: string
  showNote?: string
  segments?: BreakSegment[]
  audioUrl?: string
  source: 'openai' | 'fallback'
  usageTipId?: string
}
