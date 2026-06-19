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
  // For live recordings (e.g. Grateful Dead shows): where and when it was taped.
  liveShow?: {
    date?: string
    dateText?: string
    venue?: string
    location?: string
    source?: string
  }
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
  venue?: VenueProfile | null
  // Genre manifest files this DJ opens with; empty/undefined means all genres.
  genres?: string[]
  // An optional second host. When present, breaks become a back-and-forth
  // between the main host and this co-host (each with their own voice).
  coHost?: CoHostProfile | null
  // ElevenLabs voice ID for this DJ (used when VOICE_PROVIDER=elevenlabs).
  // Falls back to a name-based mapping when unset.
  elevenVoice?: string
  color: string
}

export type CoHostProfile = {
  name: string
  voice: VoiceName
  style?: string
  elevenVoice?: string
}

// When a DJ has a venue, the broadcast is framed as coming live from inside it
// and all real-world news/weather/traffic/sports are replaced by in-house
// content drawn from these fields.
export type VenueProfile = {
  name: string
  tagline?: string
  cuisine: string
  owners: string
  chef: string
  team: string[]
  signatureDishes: string[]
  specials: string[]
  drinks: string[]
  events: string[]
  hours: string
  vibe: string
  lore: string[]
}

export type StationContext = {
  city: string
  weather: string
  headlines: string[]
  national?: string[]
  world?: string[]
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

export type BreakSpeaker = 'dj' | 'cohost' | 'caller' | 'reporter' | 'imaging' | 'spot'

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
