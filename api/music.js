// Generates short produced jingles/stings via the ElevenLabs Music API. The
// key stays server-side; the browser only ever receives audio. Returns 204
// when no key is configured. Used to make station jingles (e.g. a sung WICH
// bumper) — not wired into playback unless explicitly added.

function elevenKey() {
  return (
    process.env.ELEVENLABS_API_KEY ||
    process.env.ElevenKey ||
    process.env.ELEVEN_API_KEY ||
    process.env.ELEVENLABS_KEY ||
    ''
  )
}

// Music generation can take a while; give the function room.
export const maxDuration = 60

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { prompt, lengthMs, forceInstrumental } = req.body || {}
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }

  const apiKey = elevenKey()
  if (!apiKey) {
    res.status(204).end()
    return
  }

  const length =
    typeof lengthMs === 'number' && Number.isFinite(lengthMs)
      ? Math.min(30000, Math.max(3000, lengthMs))
      : 12000

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 2000),
        music_length_ms: length,
        ...(forceInstrumental ? { force_instrumental: true } : {}),
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      res.status(502).json({ error: `Music API returned ${response.status}`, detail: detail.slice(0, 800) })
      return
    }

    const audio = Buffer.from(await response.arrayBuffer())
    res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(audio)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Music generation failed' })
  }
}
