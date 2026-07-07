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
  // Diagnostic: ?detail=<voiceId> returns the voice's metadata (owner/sharing/
  // samples/high_quality_base_model_ids) so we can see why it might fail.
  const detailId = req.query && req.query.detail
  if (detailId) {
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(detailId)}`,
        { headers: { 'xi-api-key': apiKey } },
      )
      const body = await r.text().catch(() => '')
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).send(body)
    } catch (error) {
      res.status(200).json({ error: error instanceof Error ? error.message : 'detail failed' })
    }
    return
  }
  // Diagnostic: ?probe=<voiceId> tries several synthesis strategies (mirroring
  // what the ElevenLabs website does) and reports which, if any, succeed.
  const probeId = req.query && req.query.probe
  if (probeId) {
    const strategies = [
      { name: 'turbo+text', url: `text-to-speech/${encodeURIComponent(probeId)}`, body: { text: 'probe test one two', model_id: 'eleven_turbo_v2_5' } },
      { name: 'multilingual+text', url: `text-to-speech/${encodeURIComponent(probeId)}`, body: { text: 'probe test one two', model_id: 'eleven_multilingual_v2' } },
      { name: 'no-model', url: `text-to-speech/${encodeURIComponent(probeId)}`, body: { text: 'probe test one two' } },
      { name: 'multilingual+stream', url: `text-to-speech/${encodeURIComponent(probeId)}/stream`, body: { text: 'probe test one two', model_id: 'eleven_multilingual_v2' } },
      { name: 'multilingual+outfmt+settings', url: `text-to-speech/${encodeURIComponent(probeId)}?output_format=mp3_44100_128`, body: { text: 'probe test one two', model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true } } },
    ]
    const results = []
    for (const s of strategies) {
      try {
        const r = await fetch(`https://api.elevenlabs.io/v1/${s.url}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify(s.body),
        })
        const detail = r.ok ? '' : (await r.text().catch(() => '')).slice(0, 300)
        results.push({ strategy: s.name, status: r.status, ok: r.ok, detail })
      } catch (error) {
        results.push({ strategy: s.name, error: error instanceof Error ? error.message : 'failed' })
      }
    }
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ probeId, results })
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
