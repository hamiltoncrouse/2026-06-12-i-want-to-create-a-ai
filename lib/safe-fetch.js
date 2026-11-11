// Guarded fetch for user-supplied URLs (the library scanner). The server will
// fetch whatever a visitor types into the music-source box, so refuse anything
// that is not plain public http(s): no other schemes, no credentials, and no
// loopback, link-local or private-network hosts, including via redirects.
// This screens literal hosts; it does not defend against DNS rebinding.

const MAX_REDIRECTS = 4

function privateIPv4(host) {
  const parts = host.split('.')
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return false
  const [a, b] = parts.map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  )
}

export function isPublicHttpUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (url.username || url.password) return false
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return false
  // Any IPv6 literal is refused: a music folder never needs one, and it avoids
  // enumerating every mapped/loopback/unique-local form.
  if (host.startsWith('[')) return false
  if (host === 'localhost' || /\.(localhost|local|internal|lan|home|intranet)$/.test(host)) return false
  if (!host.includes('.')) return false
  // WHATWG URL parsing has already normalized decimal/hex/octal IPv4 forms.
  if (privateIPv4(host)) return false
  return true
}

// Fetches a public URL as text, following redirects by hand so every hop is
// screened, with a deadline and a body-size cap. Throws on any refusal.
export async function fetchPublicText(sourceUrl, { timeoutMs = 10000, maxBytes = 5_000_000, headers } = {}) {
  const signal = AbortSignal.timeout(timeoutMs)
  let current = sourceUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHttpUrl(current)) throw new Error('Source URL is not allowed')
    const response = await fetch(current, { headers, redirect: 'manual', signal })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error(`Source returned ${response.status}`)
      current = new URL(location, current).toString()
      continue
    }
    if (!response.ok) throw new Error(`Source returned ${response.status}`)
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error('Source is too large')
    const body = await response.text()
    if (body.length > maxBytes) throw new Error('Source is too large')
    return { body, contentType: response.headers.get('content-type') || '', url: current }
  }
  throw new Error('Too many redirects')
}
