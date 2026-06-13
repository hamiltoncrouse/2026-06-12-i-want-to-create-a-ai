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

export type BreakKind =
  | 'intro'
  | 'songTalk'
  | 'newsWeather'
  | 'commercial'
  | 'bumper'
  | 'caller'

export type BreakSpeaker = 'dj' | 'caller' | 'reporter' | 'imaging'

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
  segments?: BreakSegment[]
  audioUrl?: string
  source: 'openai' | 'fallback'
}
