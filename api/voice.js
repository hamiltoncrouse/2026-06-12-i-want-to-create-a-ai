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
  caller:
    'You are an everyday radio listener calling into a station on your cell phone. Casual, spontaneous, real-person energy, a little informal, slightly excited to be on the air.',
  reporter:
    'You are a professional broadcast reporter filing a quick live radio hit. Crisp, fast, authoritative, with a friendly toss back at the end.',
  imaging:
    'You are a larger-than-life radio station imaging voice. Deep, booming, dramatic, and produced, with big confident energy and every word landing hard.',
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

  if (!process.env.OPENAI_API_KEY) {
    res.status(204).end()
    return
  }

  try {
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
        ]
          .filter(Boolean)
          .join(' '),
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      res.status(204).end()
      return
    }

    const audio = Buffer.from(await response.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(audio)
  } catch {
    res.status(204).end()
  }
}
