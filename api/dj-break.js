const breakKinds = ['intro', 'songTalk', 'newsWeather', 'commercial', 'bumper', 'caller', 'legalId', 'request']
const speakers = ['dj', 'caller', 'reporter', 'imaging']

const kindNotes = {
  intro:
    'Open the show: welcome listeners, set the vibe for this hour in the DJ\'s voice, then set up the first song. One segment, speaker "dj".',
  songTalk:
    'If previousTrack is present, back-announce it in one line, then talk up nextTrack with something specific. If previousTrack is missing, only introduce nextTrack. One segment, speaker "dj".',
  newsWeather:
    'The DJ tosses to a station colleague, then the colleague (speaker "reporter") introduces themselves by first and last name and their role, delivers the update using only facts from the context (weather and headlines or sports), and tosses back. End with one short "dj" segment reacting and setting up the song. Structure: dj, reporter, dj.',
  commercial:
    'A 20 to 40 second spot for an obviously fictional local business that fits the city, with a slogan or fictional address. One segment, speaker "dj". Then hand back to the music.',
  bumper:
    'A produced station imaging sweeper, 8 to 20 words maximum: the station identity, the DJ name or show vibe, straight into the next song. One segment, speaker "imaging". Punchy, no filler.',
  caller:
    'A listener call-in. Structure segments: a short "dj" segment answering the phones, then the "caller" (a plausible first name from a real neighborhood or suburb of the station city) speaking for themselves — requesting the next track or telling a one-line story about it, sounding like a real person on a cell phone — then a short "dj" segment reacting and sending it to the song. Structure: dj, caller, dj.',
  legalId:
    'A top-of-the-hour legal station identification like real American radio: the station callsign or name, the city, the local time from localTime, and the DJ name. Twelve to twenty-five words. One segment, speaker "dj".',
  request:
    'A real listener wrote to the request line; requestText holds their exact message. Read or paraphrase it warmly on air, give the shoutout or dedication by name, and tie it to nextTrack — if the message asked for a song, present nextTrack as that request granted. One or two segments, all speaker "dj". Personal, specific, never mocking.',
}

const reporterRoles = [
  'the news desk update',
  'the Airbreak traffic-copter report from above the city, with plausible but generic road references unless the context names real roads',
  'the sports desk update, using the sports items from the context',
]

const angles = [
  'share one true-sounding fact about the artist, the song, or the genre',
  'connect the moment to the current local time of day and what listeners are probably doing',
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
  const previous = body.previousTrack || {}
  const next = body.nextTrack || body.currentTrack || {}
  const context = body.context || {}
  const kind = breakKinds.includes(body.kind) ? body.kind : 'songTalk'

  const weather = context.weather ? `Local weather: ${context.weather}.` : ''
  const headline = context.headlines?.[0] ? `Also watching: ${context.headlines[0]}.` : ''
  const name = dj.name || 'your AI DJ'
  const city = context.city || dj.city || 'the station'
  const stationName = dj.stationName || 'Airbreak'
  const callsign = dj.callsign || stationName
  const tease = next.title ? `Next: ${next.title}` : 'More music ahead'

  if (kind === 'bumper') {
    const script = `${callsign}. ${name}. ${city}. More music right now.`
    return {
      kind,
      title: 'Station bumper',
      tease,
      source: 'fallback',
      script,
      showNote: '',
      segments: [{ speaker: 'imaging', text: script }],
    }
  }

  if (kind === 'legalId') {
    const time = stationLocalTime(context.timezone)
    const script = `${stationName}, ${city}. It's ${time}. I'm ${name}.`
    return {
      kind,
      title: 'Station ID',
      tease,
      source: 'fallback',
      script,
      showNote: '',
      segments: [{ speaker: 'dj', text: script }],
    }
  }

  if (kind === 'request') {
    const script = `Got your message on the ${stationName} request line${body.requestText ? ` — "${body.requestText}"` : ''}. You got it. ${next.title ? `Here comes ${next.title}${next.artist ? ` by ${next.artist}` : ''}, going out to you.` : 'This one is going out to you.'}`
    return {
      kind,
      title: 'Request line',
      tease,
      source: 'fallback',
      script,
      showNote: '',
      segments: [{ speaker: 'dj', text: script }],
    }
  }

  if (kind === 'caller') {
    const callerLine = `Hey, longtime listener! Any chance you can play ${next.title || 'that next one'}${next.artist ? ` by ${next.artist}` : ''}? It has been stuck in my head all day.`
    return {
      kind,
      title: 'Caller request',
      tease,
      source: 'fallback',
      showNote: '',
      script: `Phones are lit at ${stationName}. ${callerLine} You got it — this one is going out to you.`,
      segments: [
        { speaker: 'dj', text: `Phones are lit at ${stationName}. Go ahead, you are on the air.` },
        { speaker: 'caller', text: callerLine },
        { speaker: 'dj', text: 'You got it — this one is going out to you.' },
      ],
    }
  }

  if (kind === 'newsWeather') {
    const reporterText = `Thanks! This is Robin Vale at the ${stationName} news desk. ${weather || 'Weather is holding steady.'} ${headline || 'A quiet day around town.'} Back to you.`
    return {
      kind,
      title: 'News and weather',
      tease,
      source: 'fallback',
      showNote: '',
      script: `Time for a quick local check-in. ${reporterText} Thanks Robin — back to the music.`,
      segments: [
        { speaker: 'dj', text: 'Time for a quick local check-in.' },
        { speaker: 'reporter', text: reporterText },
        { speaker: 'dj', text: 'Thanks Robin — back to the music.' },
      ],
    }
  }

  const sponsor =
    kind === 'commercial'
      ? 'This hour is brought to you by fictional sponsor Needle Drop Coffee, keeping the control room awake.'
      : ''
  const intro =
    kind === 'intro'
      ? `This is ${name} on the desk at ${stationName}, broadcasting from ${city}.`
      : `${name} back with you.`

  const script = [
    intro,
    previous.title && kind !== 'intro'
      ? `That was ${previous.title}${previous.artist ? ` by ${previous.artist}` : ''}.`
      : '',
    next.title ? `Coming up, ${next.title}${next.artist ? ` by ${next.artist}` : ''}.` : '',
    weather,
    headline,
    sponsor,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    kind,
    title: kind === 'commercial' ? 'Commercial break' : 'DJ break',
    tease,
    source: 'fallback',
    showNote: '',
    script,
    segments: [{ speaker: 'dj', text: script }],
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
  const reporterRole = reporterRoles[Math.floor(Math.random() * reporterRoles.length)]
  const lengthRule =
    kind === 'bumper'
      ? 'Maximum 20 words.'
      : kind === 'legalId'
        ? 'Maximum 25 words.'
        : kind === 'commercial'
          ? 'Keep the whole break under 80 words.'
          : 'Keep the whole break under 110 words.'
  const useAngle = kind !== 'bumper' && kind !== 'legalId' && kind !== 'request'

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
          'You are the production writer for Airbreak, an AI radio station, writing live on-air copy.',
          'Write compact, spoken radio that sounds live, specific, and human.',
          'The station broadcasts from context.city. context.weather, context.headlines, context.sports, context.facts, and localTime are the only sources of local truth — never invent local facts beyond them.',
          'The DJ persona city is backstory only; the show is local to context.city.',
          'If dj.stationName or dj.callsign is present, use it as the station identity instead of the generic Airbreak name.',
          'previousTrack is the song that just ended before this break. nextTrack is the song that starts after this break. Never say nextTrack already played.',
          'If previousTrack is null or missing, do not back-announce a song; just set up nextTrack.',
          'Return the break as ordered segments, each with a speaker: "dj" for the host, "caller" for a listener on the phone, "reporter" for a station colleague, "imaging" for the produced station voice.',
          `This break is a "${kind}" break. ${kindNotes[kind]}`,
          kind === 'newsWeather' ? `For this break the reporter segment is ${reporterRole}.` : '',
          useAngle ? `Angle for this break: ${angle}.` : '',
          'recentScripts contains what went on air in the last few breaks: never reuse their opening words, jokes, names, or facts, and vary sentence rhythm from break to break.',
          'showNotes is the DJ\'s memory of this show so far: honor any promises in it, pay off teases, keep running bits and sponsor lore consistent, and never contradict it.',
          'Return in showNote one short line worth remembering from this break — a promise to listeners, a running bit, a sponsor mention — or an empty string if nothing carries forward.',
          'trackIntel, when present, contains verified facts about nextTrack (canonical artist, release year, a short artist bio). These are the ONLY artist or song facts you may state.',
          'When trackIntel is null, keep music talk impressionistic: mood, feel, memories — no factual claims about the artist or song.',
          'Do not invent chart positions, dates, deaths, awards, or quotes unless the input makes them clear.',
          'Match the show energy to the local time of day in localTime: bright at morning drive, easy midday, looser after dark.',
          'Say numbers and temperatures in spoken form. No markdown. No stage directions. No emoji.',
          'The script field must be the segments joined in order.',
          lengthRule,
        ]
          .filter(Boolean)
          .join(' '),
        input: JSON.stringify({
          dj: body.dj,
          context: body.context,
          kind,
          previousTrack: body.previousTrack || null,
          nextTrack: body.nextTrack,
          queue: body.queue,
          trackIntel: body.trackIntel || null,
          requestText: body.requestText || null,
          showNotes: body.showNotes || [],
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
              required: ['kind', 'title', 'script', 'tease', 'showNote', 'segments'],
              properties: {
                kind: { type: 'string', enum: breakKinds },
                title: { type: 'string' },
                script: { type: 'string' },
                tease: { type: 'string' },
                showNote: { type: 'string' },
                segments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['speaker', 'text'],
                    properties: {
                      speaker: { type: 'string', enum: speakers },
                      text: { type: 'string' },
                    },
                  },
                },
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
