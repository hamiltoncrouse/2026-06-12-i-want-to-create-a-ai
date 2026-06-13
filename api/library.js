const audioExtensions = /\.(mp3|m4a|wav|ogg|oga|aac|flac|webm)(\?.*)?$/i

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return value
  }
}

function fileNameFromUrl(url) {
  try {
    return new URL(url).pathname.split('/').pop() || url
  } catch {
    return url.split('/').pop() || url
  }
}

function cleanName(name) {
  return decodeURIComponent(name)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitArtistTitle(name) {
  const cleaned = cleanName(name)
  const parts = cleaned.split(/\s+-\s+/)
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') }
  }
  return { artist: 'Unknown Artist', title: cleaned || 'Untitled Track' }
}

function stringArray(value, maxItems = 8, maxLength = 80) {
  if (!Array.isArray(value)) return undefined
  const cleaned = value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength))
  return cleaned.length ? cleaned : undefined
}

function finiteNumber(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return undefined
  return Math.min(max, Math.max(min, number))
}

function optionalString(value, maxLength = 220) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text ? text.slice(0, maxLength) : undefined
}

function trackMetadata(item) {
  if (!item || typeof item !== 'object') return {}
  const metadata = {}
  const album = optionalString(item.album, 120)
  const tempo = optionalString(item.tempo, 24)
  const djNotes = optionalString(item.djNotes, 240)
  const metadataConfidence = optionalString(item.metadataConfidence, 20)
  const year = finiteNumber(item.year, 1900, 2100)
  const energy = finiteNumber(item.energy, 1, 5)
  const durationSec = finiteNumber(item.durationSec, 1, 60 * 60)
  const introSec = finiteNumber(item.introSec, 0, 600)
  const outroSec = finiteNumber(item.outroSec, 0, 600)
  const weight = finiteNumber(item.weight, 0.1, 10)
  const genre = stringArray(item.genre)
  const mood = stringArray(item.mood)
  const facts = stringArray(item.facts, 3, 160)
  const requestTags = stringArray(item.requestTags, 16, 80)
  const dayparts = stringArray(item.dayparts, 6, 40)

  if (album) metadata.album = album
  if (typeof year === 'number') metadata.year = Math.round(year)
  if (genre) metadata.genre = genre
  if (mood) metadata.mood = mood
  if (typeof energy === 'number') metadata.energy = Math.round(energy)
  if (tempo) metadata.tempo = tempo
  if (typeof durationSec === 'number') metadata.durationSec = Math.round(durationSec)
  if (typeof introSec === 'number') metadata.introSec = Math.round(introSec)
  if (typeof outroSec === 'number') metadata.outroSec = Math.round(outroSec)
  if (facts) metadata.facts = facts
  if (djNotes) metadata.djNotes = djNotes
  if (requestTags) metadata.requestTags = requestTags
  if (dayparts) metadata.dayparts = dayparts
  if (typeof weight === 'number') metadata.weight = Number(weight.toFixed(2))
  if (metadataConfidence) metadata.metadataConfidence = metadataConfidence
  return metadata
}

function trackFromManifestItem(item, index, manifestUrl) {
  const file = typeof item === 'string' ? item : item.file || item.url || item.href || item.path
  if (!file || !audioExtensions.test(file)) return null

  const base = new URL('.', manifestUrl).toString()
  const url = absoluteUrl(file, base)
  const parsed = splitArtistTitle(item.title || fileNameFromUrl(file))

  return {
    id: `folder-${index}-${file}`,
    title: item.title || parsed.title,
    artist: item.artist || parsed.artist,
    url,
    source: 'folder',
    ...trackMetadata(item),
  }
}

function parseHtmlLinks(html, folderUrl) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1])
  return hrefs
    .filter((href) => audioExtensions.test(href))
    .map((href, index) => {
      const url = absoluteUrl(href, folderUrl)
      const parsed = splitArtistTitle(fileNameFromUrl(href))
      return {
        id: `folder-${index}-${href}`,
        title: parsed.title,
        artist: parsed.artist,
        url,
        source: 'folder',
      }
    })
}

export default async function handler(req, res) {
  const sourceUrl = req.query.url
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    res.status(400).json({ error: 'Missing url' })
    return
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Airbreak AI DJ/1.0' },
    })
    if (!response.ok) {
      res.status(400).json({ error: `Source returned ${response.status}` })
      return
    }

    const contentType = response.headers.get('content-type') || ''
    const body = await response.text()
    let tracks = []

    if (contentType.includes('json') || sourceUrl.endsWith('.json')) {
      const json = JSON.parse(body)
      const items = Array.isArray(json) ? json : json.tracks || json.files || []
      tracks = items.map((item, index) => trackFromManifestItem(item, index, sourceUrl)).filter(Boolean)
    } else {
      tracks = parseHtmlLinks(body, sourceUrl)
    }

    if (!tracks.length) {
      res.status(404).json({ error: 'No playable audio links found', tracks: [] })
      return
    }

    res.status(200).json({ tracks })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Library scan failed' })
  }
}
