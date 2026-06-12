const weatherCodes = {
  0: 'clear skies',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'icy fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'rain showers',
  81: 'rain showers',
  82: 'heavy showers',
  85: 'snow showers',
  86: 'snow showers',
  95: 'thunderstorms',
  96: 'thunderstorms with hail',
  99: 'thunderstorms with hail',
}

function extractRssTitles(xml, limit) {
  return [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)]
    .map((match) => (match[1] || match[2] || '').replace(/&amp;/g, '&').trim())
    .filter(Boolean)
    .filter((title) => !title.includes('Google News'))
    .slice(0, limit)
}

const stateNames = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
}

function parseCity(city) {
  const [name, ...rest] = city.split(',').map((part) => part.trim())
  const regionRaw = rest.join(', ')
  const region = stateNames[regionRaw.toUpperCase()] || regionRaw
  return { name: name || city, region }
}

async function getCoordinates(city) {
  const { name, region } = parseCity(city)
  const params = new URLSearchParams({ name, count: '10', language: 'en', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!response.ok) return null
  const data = await response.json()
  const results = data.results || []
  if (!results.length) return null
  // "Norwich, CT" must resolve to Connecticut, not Norwich, England.
  const wanted = region.toLowerCase()
  const result =
    (wanted &&
      results.find(
        (item) =>
          (item.admin1 || '').toLowerCase() === wanted ||
          (item.country || '').toLowerCase() === wanted,
      )) ||
    results[0]
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone || '',
    name: [result.name, result.admin1].filter(Boolean).join(', '),
  }
}

async function getWeather(coordinates) {
  if (!coordinates) return 'Weather unavailable'

  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '1',
    timezone: 'auto',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) return 'Weather unavailable'
  const data = await response.json()
  const current = data.current
  if (!current) return 'Weather unavailable'

  const conditions = weatherCodes[current.weather_code] || 'mixed conditions'
  const temp = Math.round(current.temperature_2m)
  const feels = Math.round(current.apparent_temperature)
  const wind = Math.round(current.wind_speed_10m)
  const parts = [`${conditions}, ${temp}F (feels like ${feels}F)`, `wind ${wind} mph`]
  const high = data.daily?.temperature_2m_max?.[0]
  const low = data.daily?.temperature_2m_min?.[0]
  if (Number.isFinite(high) && Number.isFinite(low)) {
    parts.push(`today's range ${Math.round(low)}F to ${Math.round(high)}F`)
  }
  if (current.precipitation) parts.push(`${current.precipitation} inches precipitation`)
  return parts.join(', ')
}

async function fetchRss(url, limit) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Airbreak AI DJ/1.0' } })
    if (!response.ok) return []
    return extractRssTitles(await response.text(), limit)
  } catch {
    return []
  }
}

function searchFeed(query, limit) {
  return fetchRss(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
    limit,
  )
}

// Google News' geo section is far more accurate for a place than keyword search.
function geoFeed(place, limit) {
  return fetchRss(
    `https://news.google.com/rss/headlines/section/geo/${encodeURIComponent(place)}?hl=en-US&gl=US&ceid=US:en`,
    limit,
  )
}

async function getHeadlines(place) {
  const [name, state] = place.split(',').map((part) => part.trim())
  const [geo, search] = await Promise.all([
    geoFeed(place, 5),
    searchFeed(`"${name}"${state ? ` ${state}` : ''} local news when:2d`, 4),
  ])
  return [...new Set([...geo, ...search])].slice(0, 6)
}

function getSports(place) {
  const [name, state] = place.split(',').map((part) => part.trim())
  return searchFeed(`"${name}"${state ? ` ${state}` : ''} sports when:2d`, 3)
}

async function getCityFacts(coordinates, city) {
  const pageName = coordinates?.name || city.split(',')[0].trim()
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageName)}`,
      { headers: { 'User-Agent': 'Airbreak AI DJ/1.0', Accept: 'application/json' } },
    )
    if (!response.ok) return ''
    const data = await response.json()
    if (data.type === 'disambiguation' || !data.extract) return ''
    const sentences = data.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ')
    return sentences.length > 600 ? `${sentences.slice(0, 600)}…` : sentences
  } catch {
    return ''
  }
}

// Vercel forwards the caller's IP geolocation; use it when no city is chosen
// so the station is local to the listener by default.
function detectListenerCity(req) {
  const rawCity = req.headers['x-vercel-ip-city']
  if (!rawCity || typeof rawCity !== 'string') return null
  const cityName = decodeURIComponent(rawCity)
  const rawRegion = req.headers['x-vercel-ip-country-region']
  const region = typeof rawRegion === 'string' ? decodeURIComponent(rawRegion) : ''
  return {
    city: region ? `${cityName}, ${region}` : cityName,
    timezone:
      typeof req.headers['x-vercel-ip-timezone'] === 'string'
        ? req.headers['x-vercel-ip-timezone']
        : '',
  }
}

export default async function handler(req, res) {
  const requested =
    typeof req.query.city === 'string' ? req.query.city.replace(/\+/g, ' ').trim() : ''
  const detected = !requested || requested === 'auto' ? detectListenerCity(req) : null
  const city = detected?.city || (requested && requested !== 'auto' ? requested : 'New York, NY')

  try {
    const coordinates = await getCoordinates(city)
    // Use the geocoder's canonical "City, State" so news feeds disambiguate
    // places like Norwich, Connecticut from Norwich, England.
    const place = coordinates?.name || city
    const [weather, headlines, sports, facts] = await Promise.all([
      getWeather(coordinates),
      getHeadlines(place),
      getSports(place),
      getCityFacts(coordinates, city),
    ])
    res.status(200).json({
      city,
      weather,
      headlines,
      sports,
      facts,
      timezone: detected?.timezone || coordinates?.timezone || '',
      generatedAt: new Date().toISOString(),
    })
  } catch {
    res.status(200).json({
      city,
      weather: 'Weather unavailable',
      headlines: [],
      sports: [],
      facts: '',
      timezone: detected?.timezone || '',
      generatedAt: new Date().toISOString(),
    })
  }
}
