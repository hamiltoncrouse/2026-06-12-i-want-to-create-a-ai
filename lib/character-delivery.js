// Delivery bounds derived from the existing personalities in src/data.ts.
// Tags are optional accents, never a replacement for the selected voice.
const profile = (tone, tags, maxPerSegment = 1, maxPerBreak = 2) =>
  ({ tone, tags, maxPerSegment, maxPerBreak })
const restrained = (tone, tags) => profile(tone, tags, 1, 1)
const neutral = restrained('Natural, conversational, low intensity; follow the supplied character style without adding hype.', ['warm', 'curious'])

export const characterDelivery = {
  'torch-bar': profile('Relaxed, warm, quick barroom host; no announcer hype.', ['warm', 'conversational', 'wry']),
  neilos: profile('Hospitable supper-club emcee; generous and inviting, never a hard sell.', ['warm', 'welcoming', 'playful']),
  'johnny-london': profile('Neighborly morning-drive confidence and gentle humor.', ['warm', 'conversational', 'wry']),
  mona: profile('Velvet confidence, wit and a clean punchline.', ['warm', 'wry', 'playful']),
  ada: restrained('Intimate, thoughtful after-midnight stories; quiet curiosity, no hype.', ['softly', 'thoughtful', 'curious']),
  'calvin-stone': profile('Grounded, steady, direct and good-humored.', ['warm', 'conversational', 'wry']),
  'tasha-lake': profile('Bright, quick, stylish Friday-night energy; conversational rather than shouting.', ['upbeat', 'playful', 'excited']),
  'ray-santos': restrained('Low, smooth, cinematic and unhurried; relaxed but awake.', ['warm', 'measured', 'softly']),
  'cosmic-charlie': profile('Warm, relaxed cosmic enthusiasm and taper wit; never a hype man.', ['warm', 'wry', 'curious']),
  'blaze-morning-crew': profile('Rex: brash, fast, playfully overconfident banter, not constant shouting.', ['excited', 'incredulous', 'laughing', 'playful'], 2, 3),
  'count-devinyl': profile('Camp theatrical horror-host delight; playful and knowingly ridiculous.', ['dramatic', 'mischievous', 'laughing', 'delighted'], 2, 3),
  'dex-monroe': restrained('Low, warm, intimate, unhurried jazz and supper-club delivery with martini-dry wit. Never hype, shout, cheer, or ramp up excitement; even imaging stays understated.', ['warm', 'measured', 'dryly', 'softly']),
  'dottie-marquee': profile('Warm theatrical Broadway enthusiasm, big-hearted and a little dramatic.', ['warm', 'dramatic', 'delighted', 'playful'], 2, 3),
  'moog-morrison': restrained('Patient, erudite, gently obsessive prog scholar with dry humor.', ['thoughtful', 'dryly', 'curious']),
  'dusty-boone': restrained('Unhurried front-porch warmth, heart and space; no hype.', ['warm', 'measured', 'reflective']),
  'sir-paul': profile('Warm, cheeky and modest; a conversational twinkle rather than a boast.', ['warm', 'playful', 'wry']),
}

export function deliveryProfile(djId, speaker = 'dj') {
  if (speaker === 'reporter') return restrained('Measured, crisp reporting; no excitement or comic reactions.', ['measured'])
  if (speaker === 'caller') return restrained('Casual listener, natural and conversational.', ['conversational', 'curious'])
  if (speaker === 'cohost' && djId === 'blaze-morning-crew') {
    return profile('Roxie: dry, quick, sarcastic and unimpressed; not Rex\'s bombast.', ['dryly', 'skeptical', 'wry'])
  }
  if (speaker === 'cohost') return neutral
  // Imaging must respect the station character instead of defaulting to hype.
  return Object.hasOwn(characterDelivery, djId) ? characterDelivery[djId] : neutral
}

export function deliveryInstructions(djId) {
  return [
    'Audio tags are optional, not required. Untagged natural delivery is preferred to unnecessary direction. Use only the exact tags allowed for each speaker below; never combine words to create new tags, use SSML, sound effects, or other stage directions.',
    `Across the entire break use at most ${deliveryProfile(djId).maxPerBreak} tags. Character delivery takes precedence over generic punchy or energetic radio instructions. Do not use all-caps, repeated exclamation marks, or hype wording to compensate for forbidden tags.`,
    ...['dj', 'cohost', 'reporter', 'caller', 'imaging'].map((speaker) => {
      const p = deliveryProfile(djId, speaker)
      return `${speaker}: ${p.tone} Allowed tags: ${p.tags.map((tag) => `[${tag}]`).join(', ')}. At most ${p.maxPerSegment} per segment.`
    }),
    'Never add tags to a real listenerCall transcript; preserve it verbatim.',
  ].join(' ')
}

export function constrainAudioTags(text, djId, speaker = 'dj', budget) {
  const p = deliveryProfile(djId, speaker)
  let remaining = Math.min(p.maxPerSegment, budget?.remaining ?? p.maxPerSegment)
  const input = String(text || '')
  const tokens = /\[[^\]]*(?:\]|$)/g
  let output = '', cursor = 0
  for (const match of input.matchAll(tokens)) {
    output += input.slice(cursor, match.index).replace(/[\[\]]/g, '')
    const raw = match[0]
    const tag = raw.slice(1, -1).trim().toLowerCase()
    if (/^\[[a-z -]+\]$/i.test(raw) && p.tags.includes(tag) && remaining > 0) {
      remaining -= 1
      if (budget) budget.remaining -= 1
      output += `[${tag}]`
    }
    cursor = match.index + raw.length
  }
  output += input.slice(cursor).replace(/[\[\]]/g, '')
  return output.replace(/ {2,}/g, ' ').trim()
}

export function constrainBreakDelivery(plan, body, enabled) {
  const djId = body.dj?.id
  const budget = { remaining: enabled ? deliveryProfile(djId).maxPerBreak : 0 }
  const segments = plan.segments.map((segment) => ({
    ...segment,
    text: segment.speaker === 'caller' && body.listenerCall
      ? String(body.listenerCall.text || '')
      : constrainAudioTags(segment.text, djId, segment.speaker, budget),
  }))
  return { ...plan, segments, script: segments.map((segment) => segment.text).join(' ') }
}
