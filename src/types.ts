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
  voice: VoiceName
  style: string
  backstory: string
  color: string
}

export type StationContext = {
  city: string
  weather: string
  headlines: string[]
  generatedAt: string
}

export type BreakKind = 'intro' | 'songTalk' | 'newsWeather' | 'commercial'

export type BreakPlan = {
  kind: BreakKind
  title: string
  script: string
  tease: string
  audioUrl?: string
  source: 'openai' | 'fallback'
}
