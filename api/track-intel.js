// Verified song facts from MusicBrainz and Wikipedia so the DJ talks about
// real music history instead of inventing it.

const cache = new Map()
const CACHE_MS = 1000 * 60 * 60 * 12
const userAgent = 'Airbreak AI DJ/1.0 (radio app)'

const musicalWords =
  /\b(band|singer|musician|rapper|composer|songwriter|guitarist|vocalist|group|duo|trio|producer|dj|orchestra|ensemble|artist)\b/i

async function lookupRecording(artist, title) {
  const query = encodeURIComponent(`artist:"${artist}" AND recording:"${title}"`)
  const response = await fetch(
    `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=1`,
    { headers: { 'User-Agent': userAgent } },
  )
  if (!response.ok) return null
  const data = await response.json()
  const recording = data.recordings?.[0]
  if (!recording || (typeof recording.score === 'number' && recording.score < 80)) return null
  return {
    canonicalArtist: recording['artist-credit']?.[0]?.name || artist,
    year: (recording['first-release-date'] || '').slice(0, 4),
  }
}

async function lookupWikiPage(name) {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
    { headers: { 'User-Agent': userAgent, Accept: 'application/json' } },
  )
  if (!response.ok) return ''
  const data = await response.json()
  if (data.type === 'disambiguation' || !data.extract) return ''
  // Guard against same-named non-musicians (places, monarchs, common words).
  if (!musicalWords.test(`${data.description || ''} ${data.extract.slice(0, 240)}`)) return ''
  const sentences = data.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ')
  return sentences.length > 500 ? `${sentences.slice(0, 500)}…` : sentences
}

async function lookupArtistBio(name) {
  const direct = await lookupWikiPage(name)
  if (direct) return direct
  // Ambiguous names like "Queen" resolve to the wrong page; try the
  // disambiguated music articles before giving up.
  for (const suffix of [' (band)', ' (musician)', ' (singer)']) {
    const bio = await lookupWikiPage(`${name}${suffix}`)
    if (bio) return bio
  }
  return ''
}

export default async function handler(req, res) {
  const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : ''
  const title = typeof req.query.title === 'string' ? req.query.title.trim() : ''
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')

  if (!artist || /^unknown artist$/i.test(artist)) {
    res.status(200).json({ intel: null })
    return
  }

  const key = `${artist.toLowerCase()}|${title.toLowerCase()}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) {
    res.status(200).json({ intel: cached.intel })
    return
  }

  try {
    const recording = await lookupRecording(artist, title)
    const canonicalArtist = recording?.canonicalArtist || artist
    const bio = await lookupArtistBio(canonicalArtist)
    const intel =
      recording || bio
        ? {
            artist: canonicalArtist,
            title,
            year: recording?.year || '',
            bio,
          }
        : null
    cache.set(key, { intel, at: Date.now() })
    if (cache.size > 500) {
      const oldest = cache.keys().next().value
      if (oldest) cache.delete(oldest)
    }
    res.status(200).json({ intel })
  } catch {
    res.status(200).json({ intel: null })
  }
}
