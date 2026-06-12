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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { text, voice, style } = req.body || {}
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
        instructions:
          typeof style === 'string'
            ? `Radio DJ delivery. Natural, conversational, tight pacing. If the script quotes a caller or another speaker, shift tone subtly for the quoted words. ${style}`
            : 'Radio DJ delivery. Natural, conversational, tight pacing. If the script quotes a caller or another speaker, shift tone subtly for the quoted words.',
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
