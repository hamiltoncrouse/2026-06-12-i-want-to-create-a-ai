const breakKinds = ['intro', 'songTalk', 'newsWeather', 'commercial', 'bumper', 'caller']

const kindNotes = {
  intro:
    'Open the show: welcome listeners, set the vibe for this hour in the DJ\'s voice, then set up the first song.',
  songTalk:
    'Back-announce the previous song in a line, then talk up the next one with something specific.',
  newsWeather:
    'A quick local update: the weather right now and the rest of the day in spoken language, then one or two headlines in plain words, then hand it back to the music.',
  commercial:
    'A 20 to 40 second spot for an obviously fictional local business that fits the city, with a slogan or fictional address. Then hand back to the music.',
  bumper:
    'A station imaging sweeper, 8 to 20 words maximum: the station name Airbreak, the DJ name or show vibe, straight into the next song. Punchy, no filler.',
  caller:
    'Invent a plausible listener call-in: a first name and a neighborhood or nearby suburb of the station city, requesting the next track or sharing a one-line story about it. Quote the caller briefly, react warmly or wryly, then send it to the song.',
}

const angles = [
  'share one true-sounding fact about the artist, the song, or the genre',
  'connect the moment to the current time of day and what listeners are probably doing',
  'use the weather to paint a quick scene before the next song',
  'pull a small story from the DJ backstory and land it in a line or two',
  'react to one local headline with a single dry line, then pivot to the music',
  'tease something coming later this hour without naming a specific song',
  'use a local detail from the city facts: a neighborhood, landmark, or piece of history',
  'talk directly to one imagined listener, like the night-shift worker or the kid doing homework',
  'compare the next song to the one that just played in one sharp observation',
]

function fallbackBreak(body) {
  const dj = body.dj || {}
  const current = body.currentTrack || {}
  const next = body.nextTrack || {}
  const context = body.context || {}
  const kind = breakKinds.includes(body.kind) ? body.kind : 'songTalk'

  const weather = context.weather ? `Local weather: ${context.weather}.` : ''
  const headline = context.headlines?.[0] ? `Also watching: ${context.headlines[0]}.` : ''
  const name = dj.name || 'your AI DJ'
  const city = dj.city || context.city || 'the station'

  if (kind === 'bumper') {
    return {
      kind,
      title: 'Station bumper',
      tease: next.title ? `Next: ${next.title}` : 'More music ahead',
      source: 'fallback',
      script: `Airbreak. ${name}. ${city}. More music right now.`,
    }
  }

  if (kind === 'caller') {
    return {
      kind,
      title: 'Caller request',
      tease: next.title ? `Next: ${next.title}` : 'More music ahead',
      source: 'fallback',
      script: `Phones are lit at Airbreak. Just had a listener ask for ${next.title || 'this next one'}${next.artist ? ` by ${next.artist}` : ''} — you got it. This one is going out to you.`,
    }
  }

  const sponsor =
    kind === 'commercial'
      ? 'This hour is brought to you by fictional sponsor Needle Drop Coffee, keeping the control room awake.'
      : ''
  const intro =
    kind === 'intro'
      ? `This is ${name} on the desk, broadcasting from ${city}.`
      : `${name} back with you.`

  return {
    kind,
    title: kind === 'commercial' ? 'Commercial break' : 'DJ break',
    tease: next.title ? `Next: ${next.title}` : 'More music ahead',
    source: 'fallback',
    script: [
      intro,
      current.title ? `We are setting up ${current.title}${current.artist ? ` by ${current.artist}` : ''}.` : '',
      next.title ? `After that, ${next.title}${next.artist ? ` by ${next.artist}` : ''} is waiting in the rack.` : '',
      weather,
      headline,
      sponsor,
    ]
      .filter(Boolean)
      .join(' '),
  }
}

function stationLocalTime(timezone) {
  const options = { weekday: 'long', hour: 'numeric', minute: '2-digit' }
  try {
    return new Date().toLocaleString('en-US', { ...options, timeZone: timezone || 'America/New_York' })
  } catch {
    return new Date().toLocaleString('en-US', options)
  }
}

function parseResponseText(response) {
  if (response.output_text) return response.output_text

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text
    }
  }

  return ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = req.body || {}
  if (!process.env.OPENAI_API_KEY) {
    res.status(200).json(fallbackBreak(body))
    return
  }

  const kind = breakKinds.includes(body.kind) ? body.kind : 'songTalk'
  const angle = angles[Math.floor(Math.random() * angles.length)]
  const lengthRule =
    kind === 'bumper'
      ? 'Maximum 20 words.'
      : kind === 'commercial'
        ? 'Keep it under 80 words.'
        : 'Keep it under 95 words.'

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SCRIPT_MODEL || 'gpt-5.4-mini',
        instructions: [
          'You are the production writer for Airbreak, an AI radio station, writing live on-air copy for one DJ.',
          'Write compact, spoken DJ breaks that sound live, specific, and human.',
          'Use the DJ persona and backstory, the station city, the weather, the city facts, the headlines, and the song queue.',
          `This break is a "${kind}" break. ${kindNotes[kind]}`,
          kind === 'bumper' ? '' : `Angle for this break: ${angle}.`,
          'recentScripts contains what the DJ said in the last few breaks: never reuse their opening words, jokes, facts, or sign-offs, and vary sentence rhythm from break to break.',
          'Do not invent chart positions, dates, deaths, awards, or quotes unless the input makes them clear.',
          'Say numbers and temperatures in spoken form. No markdown. No stage directions. No emoji.',
          lengthRule,
        ]
          .filter(Boolean)
          .join(' '),
        input: JSON.stringify({
          dj: body.dj,
          context: body.context,
          kind,
          currentTrack: body.currentTrack,
          nextTrack: body.nextTrack,
          queue: body.queue,
          recentScripts: body.recentScripts || (body.recentScript ? [body.recentScript] : []),
          localTime: stationLocalTime(body.context?.timezone),
        }),
        text: {
          format: {
            type: 'json_schema',
            name: 'dj_break',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'title', 'script', 'tease'],
              properties: {
                kind: { type: 'string', enum: breakKinds },
                title: { type: 'string' },
                script: { type: 'string' },
                tease: { type: 'string' },
              },
            },
          },
        },
      }),
    })

    if (!response.ok) {
      res.status(200).json(fallbackBreak(body))
      return
    }

    const data = await response.json()
    const text = parseResponseText(data)
    const plan = JSON.parse(text)
    res.status(200).json({ ...plan, source: 'openai' })
  } catch {
    res.status(200).json(fallbackBreak(body))
  }
}
