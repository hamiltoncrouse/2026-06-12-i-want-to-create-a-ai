function extractRssTitles(xml) {
  return [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)]
    .map((match) => (match[1] || match[2] || '').replace(/&amp;/g, '&').trim())
    .filter(Boolean)
    .filter((title) => !title.includes('Google News'))
    .slice(0, 3)
}

async function getCoordinates(city) {
  const searchName = city.split(',')[0].trim() || city
  const params = new URLSearchParams({ name: searchName, count: '1', language: 'en', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!response.ok) return null
  const data = await response.json()
  const result = data.results?.[0]
  if (!result) return null
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: [result.name, result.admin1].filter(Boolean).join(', '),
  }
}

async function getWeather(city) {
  const coordinates = await getCoordinates(city)
  if (!coordinates) return 'Weather unavailable'

  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,wind_speed_10m',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) return 'Weather unavailable'
  const data = await response.json()
  const current = data.current
  if (!current) return 'Weather unavailable'

  const temp = Math.round(current.temperature_2m)
  const feels = Math.round(current.apparent_temperature)
  const wind = Math.round(current.wind_speed_10m)
  const rain = current.precipitation ? `${current.precipitation} inches precipitation` : 'dry'
  return `${temp}F, feels like ${feels}F, ${rain}, wind ${wind} mph`
}

async function getHeadlines(city) {
  const query = encodeURIComponent(`${city} local news`)
  const response = await fetch(`https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`, {
    headers: { 'User-Agent': 'Airbreak AI DJ/1.0' },
  })
  if (!response.ok) return []
  return extractRssTitles(await response.text())
}

export default async function handler(req, res) {
  const city =
    typeof req.query.city === 'string' ? req.query.city.replace(/\+/g, ' ') : 'New York, NY'

  try {
    const [weather, headlines] = await Promise.all([getWeather(city), getHeadlines(city)])
    res.status(200).json({
      city,
      weather,
      headlines,
      generatedAt: new Date().toISOString(),
    })
  } catch {
    res.status(200).json({
      city,
      weather: 'Weather unavailable',
      headlines: [],
      generatedAt: new Date().toISOString(),
    })
  }
}
