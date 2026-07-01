// Transcribes a listener's recorded call (base64 audio in, text out) so the
// DJ knows what the caller actually said. The audio itself still airs — the
// transcript is only for writing the DJ's response and matching song requests.

const MAX_BASE64_CHARS = 4_000_000 // ~3 MB of audio; calls are capped at ~15s

function extensionFor(mime) {
  if (!mime) return 'webm'
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { audio, mime } = req.body || {}
  if (!audio || typeof audio !== 'string') {
    res.status(400).json({ error: 'Missing audio' })
    return
  }
  if (audio.length > MAX_BASE64_CHARS) {
    res.status(413).json({ error: 'Recording too long' })
    return
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(204).end()
    return
  }

  try {
    const buffer = Buffer.from(audio, 'base64')
    const form = new FormData()
    form.append(
      'file',
      new Blob([buffer], { type: mime || 'audio/webm' }),
      `call.${extensionFor(mime)}`,
    )
    form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1')
    form.append(
      'prompt',
      'A listener calling in to a radio show with a song request, dedication, or shout-out.',
    )

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    })

    if (!response.ok) {
      res.status(204).end()
      return
    }

    const data = await response.json()
    res.status(200).json({ text: String(data.text || '').trim().slice(0, 500) })
  } catch {
    res.status(204).end()
  }
}
