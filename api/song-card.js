import { lookupSongCard } from '../lib/song-cards.js'
// On-demand access to the reviewed cache; no paid research or upstream calls.
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { artist, title, album, version } = req.query || {}
  const card = lookupSongCard({ artist, title, album, version })
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return res.status(200).json({ card, coverage: card ? 'reviewed' : 'no-reviewed-card' })
}
