// Read-only helper: lists the ElevenLabs voices saved in the account (name +
// id) so a DJ can be pointed at the right voice without hunting for the ID.
// Key-gated; only ever returns voice names and their public IDs.

function elevenKey() {
  return (
    process.env.ELEVENLABS_API_KEY ||
    process.env.ElevenKey ||
    process.env.ELEVEN_API_KEY ||
    process.env.ELEVENLABS_KEY ||
    ''
  )
}

export default async function handler(req, res) {
  const apiKey = elevenKey()
  if (!apiKey) {
    res.status(204).end()
    return
  }
  // Diagnostic: ?probe=<voiceId> attempts a tiny TTS synthesis and reports the
  // raw ElevenLabs status + error body, so we can see WHY a voice fails.
  const probeId = req.query && req.query.probe
  if (probeId) {
    try {
      const model = (req.query && req.query.model) || process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(probeId)}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({ text: 'probe', model_id: model }),
        },
      )
      const ok = r.ok
      const detail = ok ? '' : (await r.text().catch(() => '')).slice(0, 800)
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ probeId, status: r.status, ok, detail })
    } catch (error) {
      res.status(200).json({ probeId, error: error instanceof Error ? error.message : 'probe failed' })
    }
    return
  }
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    })
    if (!response.ok) {
      res.status(502).json({ error: `Voices API returned ${response.status}` })
      return
    }
    const data = await response.json()
    const voices = (data.voices || []).map((voice) => ({
      name: voice.name,
      id: voice.voice_id,
      category: voice.category,
    }))
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ voices })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list voices' })
  }
}
