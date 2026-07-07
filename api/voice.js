const voices = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
])

const speakerInstructions = {
  dj: 'You are a seasoned FM radio DJ on a music station, working the mic. Warm, rich, resonant tone with a smile in the voice and easy confidence. Energetic and forward, smooth and articulate, never flat or robotic. Conversational but punchy: lean into key words, vary your pace, let it breathe, and land the last line with confidence like you are throwing to the song. Sound close to the mic and full-chested.',
  cohost:
    'You are the co-host on a two-person radio show, sharing the mic with the lead host. React in the moment like you are bouncing off a real partner: interrupt, agree, needle them, land a quick aside. Looser and more spontaneous than a solo announcer, with banter energy and good comic timing, but still a confident broadcast voice close to the mic.',
  caller:
    'You are an everyday radio listener calling into a station on your cell phone. Casual, spontaneous, real-person energy, a little informal, slightly excited to be on the air.',
  reporter:
    'You are a professional broadcast reporter filing a quick live radio hit. Crisp, fast, authoritative, with a friendly toss back at the end.',
  imaging:
    'You are a larger-than-life radio station imaging voice. Deep, booming, dramatic, and produced, with big confident energy and every word landing hard.',
}

const PACING =
  'Keep an even, natural, conversational pace. Do not insert long pauses at commas — keep phrases connected and flowing rather than clipping a beat after every comma, especially around a name in direct address.'

// Fallback map from the app's voice names to ElevenLabs' built-in default
// voices (available in every account). Used for callers/reporters and any DJ
// that doesn't carry an explicit elevenVoice. Override without a code change by
// setting ELEVENLABS_VOICE_MAP to a JSON object of name -> voiceId.
const defaultElevenVoiceMap = {
  alloy: 'SAz9YHcvj6GT2YYXdXww', // River (neutral)
  ash: 'cjVigY5qzO86Huf0OWal', // Eric (male)
  ballad: 'TX3LPaxmHKxFdv7VOQHJ', // Liam (male)
  coral: 'cgSgspJ2msm6clMCkdW9', // Jessica (female)
  echo: 'CwhRBWXzGAHq8TQ4Fs17', // Roger (male)
  fable: 'JBFqnCBsd6RMkjVDRZzb', // George (male)
  nova: '9BWtsMINqrJLrRacOk9x', // Aria (female)
  onyx: 'nPczCjzI2devNBz1zQrb', // Brian (deep male)
  sage: 'XrExE9yKIg1WjnnlVkGX', // Matilda (female)
  shimmer: 'FGY2WhTYpPnrIDTdsKH5', // Laura (female)
  verse: 'iP95p4xoKVk53GoZ742B', // Chris (male)
  marin: 'SAz9YHcvj6GT2YYXdXww', // River (neutral default)
  cedar: 'pqHfZKP75CvOlQylNhV4', // Bill (older male)
}

let elevenVoiceMap = defaultElevenVoiceMap
try {
  if (process.env.ELEVENLABS_VOICE_MAP) {
    elevenVoiceMap = { ...defaultElevenVoiceMap, ...JSON.parse(process.env.ELEVENLABS_VOICE_MAP) }
  }
} catch {
  // Ignore a malformed override and fall back to the defaults.
}

function mapVoiceToEleven(voice) {
  return (
    elevenVoiceMap[voice] ||
    process.env.ELEVENLABS_DEFAULT_VOICE_ID ||
    elevenVoiceMap.marin ||
    'nPczCjzI2devNBz1zQrb'
  )
}

function envNum(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

// Tuned for radio-DJ delivery: stability low enough to stay lively and
// expressive on the mic without getting erratic, a touch of style, and a hair
// of extra pace for energy. Station imaging gets more drama; callers stay
// plain. All values are overridable via env vars.
function elevenVoiceSettings(speaker) {
  const speed = envNum('ELEVENLABS_SPEED', 1.04)
  const similarity = envNum('ELEVENLABS_SIMILARITY', 0.8)
  if (speaker === 'imaging') {
    return {
      stability: envNum('ELEVENLABS_STABILITY', 0.3),
      similarity_boost: similarity,
      style: envNum('ELEVENLABS_STYLE', 0.65),
      use_speaker_boost: true,
      speed,
    }
  }
  if (speaker === 'caller') {
    return {
      stability: envNum('ELEVENLABS_STABILITY', 0.5),
      similarity_boost: 0.75,
      style: 0.2,
      use_speaker_boost: true,
      speed: 1.0,
    }
  }
  return {
    stability: envNum('ELEVENLABS_STABILITY', 0.4),
    similarity_boost: similarity,
    style: envNum('ELEVENLABS_STYLE', 0.4),
    use_speaker_boost: true,
    speed,
  }
}

// Returns an audio Buffer, or null on any failure (the app then falls back to a
// standby liner rather than airing dead silence).
async function synthOpenAI({ text, voice, style, speaker }) {
  if (!process.env.OPENAI_API_KEY) return null
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: voices.has(voice) ? voice : 'marin',
      input: text.slice(0, 1800),
      instructions: [
        speakerInstructions[speaker] || speakerInstructions.dj,
        typeof style === 'string' ? style : '',
        PACING,
      ]
        .filter(Boolean)
        .join(' '),
      response_format: 'mp3',
    }),
  })
  if (!response.ok) return null
  return Buffer.from(await response.arrayBuffer())
}

function warnProviderFailure(provider, response, detail = '') {
  const safeDetail = String(detail || '').replace(/\s+/g, ' ').slice(0, 500)
  console.warn(
    `${provider} voice synthesis failed: ${response.status} ${response.statusText}${
      safeDetail ? ` - ${safeDetail}` : ''
    }`,
  )
}

// Accept a few common names for the ElevenLabs key so it works regardless of
// what the env var was called when it was added.
function elevenKey() {
  return (
    process.env.ELEVENLABS_API_KEY ||
    process.env.ElevenKey ||
    process.env.ELEVEN_API_KEY ||
    process.env.ELEVENLABS_KEY ||
    ''
  )
}

async function synthElevenLabs({ text, voice, speaker, elevenVoiceId }) {
  const apiKey = elevenKey()
  if (!apiKey) return null
  const voiceId = elevenVoiceId || mapVoiceToEleven(voice)
  const model = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 1800),
        model_id: model,
        voice_settings: elevenVoiceSettings(speaker),
        // 'auto' lets ElevenLabs expand numbers/symbols sensibly; call letters
        // are already spaced upstream so they read letter by letter.
        apply_text_normalization: process.env.ELEVENLABS_NORMALIZE || 'auto',
      }),
    },
  )
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    warnProviderFailure('ElevenLabs', response, detail)
    return null
  }
  return Buffer.from(await response.arrayBuffer())
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { text, voice, style, speaker, elevenVoiceId } = req.body || {}
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing text' })
    return
  }

  const provider = (process.env.VOICE_PROVIDER || 'openai').toLowerCase()

  try {
    const wantsElevenLabs = provider === 'elevenlabs' || provider === '11labs'
    let usedProvider = 'openai'
    let audio = null
    if (wantsElevenLabs) {
      audio = await synthElevenLabs({ text, voice, speaker, elevenVoiceId })
      if (audio) {
        usedProvider = 'elevenlabs'
      } else {
        audio = await synthOpenAI({ text, voice, style, speaker })
        usedProvider = audio ? 'openai-fallback' : 'none'
      }
    } else {
      audio = await synthOpenAI({ text, voice, style, speaker })
    }

    if (!audio) {
      res.status(204).end()
      return
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    // Diagnostic: which TTS provider actually produced this audio. Lets us tell
    // a real ElevenLabs voice from a silent fallback to the OpenAI voice.
    res.setHeader('X-Voice-Provider', usedProvider)
    res.status(200).send(audio)
  } catch {
    res.status(204).end()
  }
}
