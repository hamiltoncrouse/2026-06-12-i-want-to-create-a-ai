const breakKinds = ['intro', 'songTalk', 'newsWeather', 'commercial']

function fallbackBreak(body) {
  const dj = body.dj || {}
  const current = body.currentTrack || {}
  const next = body.nextTrack || {}
  const context = body.context || {}
  const kind = breakKinds.includes(body.kind) ? body.kind : 'songTalk'

  const weather = context.weather ? `Local weather: ${context.weather}.` : ''
  const headline = context.headlines?.[0] ? `Also watching: ${context.headlines[0]}.` : ''
  const sponsor =
    kind === 'commercial'
      ? 'This hour is brought to you by fictional sponsor Needle Drop Coffee, keeping the control room awake.'
      : ''
  const intro =
    kind === 'intro'
      ? `This is ${dj.name || 'your AI DJ'} on the desk, broadcasting from ${dj.city || context.city || 'the station'}.`
      : `${dj.name || 'Your AI DJ'} back with you.`

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
          'You are a production writer for an AI radio DJ app.',
          'Write compact, spoken DJ breaks that sound live and specific.',
          'Use the DJ backstory, station city, weather, headlines, and queue.',
          'Talk up the next song and, when safe, include one true-sounding cultural or musical fact.',
          'Do not invent chart positions, dates, deaths, awards, or quotes unless the input makes them clear.',
          'For commercial breaks, invent an obviously fictional local sponsor.',
          'Keep scripts under 95 words. No markdown. No stage directions.',
        ].join(' '),
        input: JSON.stringify({
          dj: body.dj,
          context: body.context,
          kind: body.kind,
          currentTrack: body.currentTrack,
          nextTrack: body.nextTrack,
          queue: body.queue,
          recentScript: body.recentScript,
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
