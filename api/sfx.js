// Generates short radio transition sound effects via the ElevenLabs Sound
// Effects API. The API key stays server-side; the browser only ever receives
// audio. Returns 204 when no key is configured so the client falls back to its
// built-in synthesized stinger.

const MAX_PROMPT = 300

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { prompt, durationSeconds, promptInfluence } = req.body || {}
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    res.status(204).end()
    return
  }

  // ElevenLabs accepts roughly 0.5–22 seconds; keep transitions short.
  const duration =
    typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
      ? Math.min(8, Math.max(0.5, durationSeconds))
      : undefined
  const influence =
    typeof promptInfluence === 'number' && Number.isFinite(promptInfluence)
      ? Math.min(1, Math.max(0, promptInfluence))
      : 0.45

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: prompt.slice(0, MAX_PROMPT),
        duration_seconds: duration,
        prompt_influence: influence,
      }),
    })

    if (!response.ok) {
      res.status(204).end()
      return
    }

    const audio = Buffer.from(await response.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    // Transition beds are reusable; let the edge cache them hard.
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable')
    res.status(200).send(audio)
  } catch {
    res.status(204).end()
  }
}
