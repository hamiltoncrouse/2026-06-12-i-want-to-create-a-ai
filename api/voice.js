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

// Map the app's voice names to ElevenLabs voice IDs. These are starter
// assignments using ElevenLabs' built-in voices, roughly matched by character;
// override any of them (or add your own/cloned voices) without a code change by
// setting ELEVENLABS_VOICE_MAP to a JSON object of name -> voiceId.
const defaultElevenVoiceMap = {
  ash: 'ErXwobaYiN019PkySvjV', // Antoni (male)
  echo: 'TxGEqnHWrfWFTfGW9XjX', // Josh (deep male)
  onyx: 'pNInz6obpgDQGcFmaJgB', // Adam (deep male)
  fable: 'VR6AewLTigWG4xSOukaG', // Arnold (male)
  ballad: 'yoZ06aMxZJJ28mfd3POQ', // Sam (male)
  cedar: 'VR6AewLTigWG4xSOukaG', // Arnold (male)
  verse: 'ErXwobaYiN019PkySvjV', // Antoni (male)
  coral: 'EXAVITQu4vr4xnSDxMaL', // Bella (female)
  nova: 'AZnzlk1XvdvUeBnXmlld', // Domi (female, strong)
  shimmer: 'MF3mGyEYCl7XYWbV9V6O', // Elli (female)
  sage: '21m00Tcm4TlvDq8ikWAM', // Rachel (calm)
  alloy: '21m00Tcm4TlvDq8ikWAM', // Rachel (calm)
  marin: '21m00Tcm4TlvDq8ikWAM', // Rachel (default)
}

let elevenVoiceMap = defaultElevenVoiceMap
try {
  if (process.env.ELEVENLABS_VOICE_MAP) {
    elevenVoiceMap = { ...defaultElevenVoiceMap, ...JSON.parse(process.env.ELEVENLABS_VOICE_MAP) }
  }
} catch {
  // Ignore a malformed override and fall back to the defaults.
}

function elevenVoiceId(voice) {
  return (
    elevenVoiceMap[voice] ||
    process.env.ELEVENLABS_DEFAULT_VOICE_ID ||
    elevenVoiceMap.marin ||
    '21m00Tcm4TlvDq8ikWAM'
  )
}

function elevenVoiceSettings(speaker) {
  if (speaker === 'imaging') {
    return { stability: 0.3, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true }
  }
  if (speaker === 'caller') {
    return { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true }
  }
  return { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true }
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

async function synthElevenLabs({ text, voice, speaker }) {
  const apiKey = elevenKey()
  if (!apiKey) return null
  const voiceId = elevenVoiceId(voice)
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
      }),
    },
  )
  if (!response.ok) return null
  return Buffer.from(await response.arrayBuffer())
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { text, voice, style, speaker } = req.body || {}
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing text' })
    return
  }

  const provider = (process.env.VOICE_PROVIDER || 'openai').toLowerCase()

  try {
    const audio =
      provider === 'elevenlabs' || provider === '11labs'
        ? await synthElevenLabs({ text, voice, speaker })
        : await synthOpenAI({ text, voice, style, speaker })

    if (!audio) {
      res.status(204).end()
      return
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(audio)
  } catch {
    res.status(204).end()
  }
}
