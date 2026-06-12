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
